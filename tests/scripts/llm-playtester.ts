import fs from 'node:fs';
import path from 'node:path';
import { EntityIdSchema } from '../../src/schemas/primitives.schema.js';
import { dispatchCommand } from '../../src/sim/core/engine.js';
import { createInitialWorld, WorldState } from '../../src/sim/core/world.js';
import { generateVictorianDistrict } from '../../src/sim/spatial/generator.js';
import {
  generateMockAction,
  parseLlmResponseToCommand,
  serializePlayerContext,
} from './playtester-serializer.js';

export interface PlaytestConfig {
  readonly mock: boolean;
  readonly maxTurns: number;
  readonly seed: number;
  readonly endpoint: string;
  readonly model: string;
  readonly reportPath: string;
}

export interface PlaytestMetrics {
  turnsSurvived: number;
  totalDecibels: number;
  alertTransitions: { investigating: number; combat: number };
  steamCloudsDeployed: number;
  trapsTriggered: number;
  damageDealt: number;
  damageTaken: number;
  finalBloodPct: number;
  causeOfDeath?: string;
}

export function parseCliArgs(argv: string[]): PlaytestConfig {
  const getArg = (flag: string, fallback: string): string => {
    const idx = argv.indexOf(flag);
    return idx !== -1 && argv[idx + 1] ? argv[idx + 1]! : fallback;
  };
  return {
    mock: argv.includes('--mock'),
    maxTurns: Number(getArg('--turns', '100')),
    seed: Number(getArg('--seed', '42')),
    endpoint: process.env['LLM_ENDPOINT'] || getArg('--endpoint', 'http://localhost:8642/v1/chat/completions'),
    model: process.env['LLM_MODEL'] || getArg('--model', 'hermes-agent'),
    reportPath: getArg('--report', path.join(process.cwd(), 'tests/artifacts/playtest-report.md')),
  };
}

async function queryLocalLlm(endpoint: string, model: string, prompt: string): Promise<string> {
  const controller = new AbortController();
  const timeoutMs = Number(process.env['LLM_TIMEOUT_MS'] || '60000');
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    const apiKey = process.env['API_KEY'] || process.env['LLM_API_KEY'];
    if (apiKey) {
      headers['Authorization'] = `Bearer ${apiKey}`;
    }

    const systemPrompt = 'You are playing Aether & Soot, a Victorian roguelike. Return ONLY JSON matching schema (action: MOVE/WAIT/ATTACK/TOGGLE_DOOR/VENT_STEAM/BREACH_TILE):\n\n';
    const isOpenAi = endpoint.includes('/v1/') || endpoint.endsWith('/completions');
    const body = isOpenAi
      ? JSON.stringify({
          model,
          messages: [
            {
              role: 'user',
              content: `${systemPrompt}${prompt}`,
            },
          ],
          temperature: 0.2,
        })
      : JSON.stringify({
          model,
          prompt: `${systemPrompt}${prompt}`,
          format: 'json',
          stream: false,
          options: { temperature: 0.2 },
        });

    const res = await fetch(endpoint, {
      method: 'POST',
      headers,
      signal: controller.signal,
      body,
    });
    clearTimeout(timeoutId);
    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`HTTP ${res.status}: ${errText}`);
    }
    const data = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
      response?: string;
    };
    return data.choices?.[0]?.message?.content ?? data.response ?? '{}';
  } catch (err) {
    clearTimeout(timeoutId);
    console.warn(`[llm-playtester] Local LLM unreachable (${err}), using fallback.`);
    return '{}';
  }
}

export async function runPlaytestSession(config: PlaytestConfig): Promise<PlaytestMetrics> {
  const playerId = EntityIdSchema.parse('actor_player');
  const baseWorld = createInitialWorld({ seed: config.seed, width: 48, height: 36 });
  let state: WorldState = generateVictorianDistrict(baseWorld).state;

  const metrics: PlaytestMetrics = {
    turnsSurvived: 0,
    totalDecibels: 0,
    alertTransitions: { investigating: 0, combat: 0 },
    steamCloudsDeployed: 0,
    trapsTriggered: 0,
    damageDealt: 0,
    damageTaken: 0,
    finalBloodPct: 100,
  };

  const prevAlerts = new Map<string, string>();

  for (let turn = 0; turn < config.maxTurns; turn++) {
    const player = state.entities[playerId];
    if (!player || !player.anatomy) {
      metrics.causeOfDeath = 'PLAYER_NOT_FOUND';
      break;
    }
    metrics.finalBloodPct = player.anatomy.bloodVolumePct;
    if (player.anatomy.bloodVolumePct <= 0) {
      metrics.causeOfDeath = 'EXSANGUINATION';
      break;
    }
    if ((player.anatomy.limbs['TORSO']?.hp ?? 0) <= 0 || (player.anatomy.limbs['HEAD']?.hp ?? 0) <= 0) {
      metrics.causeOfDeath = 'VITAL_ORGAN_TRAUMA';
      break;
    }

    metrics.turnsSurvived = turn + 1;
    let rawAction = '';
    if (config.mock) {
      rawAction = JSON.stringify(generateMockAction(state, playerId));
    } else {
      const context = serializePlayerContext(state, playerId);
      rawAction = await queryLocalLlm(config.endpoint, config.model, context);
      if (rawAction === '{}') rawAction = JSON.stringify(generateMockAction(state, playerId));
    }

    const command = parseLlmResponseToCommand(rawAction, state, playerId);
    if (!config.mock && turn < 15) {
      console.log(`[llm-playtester] Turn ${turn + 1}: ${command.type}`);
    }
    const stepRes = dispatchCommand(state, command);
    state = stepRes.state;

    for (const ev of stepRes.events) {
      if (ev.type === 'SOUND_EMITTED') metrics.totalDecibels += ev.decibels;
      if (ev.type === 'TRAP_TRIGGERED') metrics.trapsTriggered++;
      if (ev.type === 'STEAM_VENTED') metrics.steamCloudsDeployed++;
      if (ev.type === 'COMBAT_ATTACK_RESOLVED') {
        if (ev.attackerId === playerId) metrics.damageDealt += ev.damageDealt;
        if (ev.targetId === playerId) metrics.damageTaken += ev.damageDealt;
      }
    }

    for (const ent of Object.values(state.entities)) {
      if (ent.aiController) {
        const cur = ent.aiController.alertState;
        const prev = prevAlerts.get(ent.id) ?? 'IDLE';
        if (prev !== cur) {
          if (cur === 'INVESTIGATING') metrics.alertTransitions.investigating++;
          if (cur === 'COMBAT') metrics.alertTransitions.combat++;
          prevAlerts.set(ent.id, cur);
        }
      }
    }
  }

  writeReport(config, metrics);
  return metrics;
}

function writeReport(config: PlaytestConfig, metrics: PlaytestMetrics): void {
  const dir = path.dirname(config.reportPath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  const status = metrics.causeOfDeath ? `DEFEATED (${metrics.causeOfDeath})` : 'SURVIVED';
  const content = `# Aether & Soot — Headless Autonomous Playtest Report

- **Timestamp**: ${new Date().toISOString()}
- **Execution Mode**: ${config.mock ? 'Deterministic Mock Agent (--mock)' : `Local LLM (${config.model} @ ${config.endpoint})`}
- **Seed**: ${config.seed}
- **Survival Status**: **${status}**

## Emergent Sandbox Mechanics Metrics

| Metric | Recorded Value | Evaluation Notes |
| :--- | :--- | :--- |
| **Turns Survived** | ${metrics.turnsSurvived} / ${config.maxTurns} | Longevity under autonomous navigation |
| **Acoustic Decibels Emitted** | ${metrics.totalDecibels} dB | Footsteps, door actions, and steam releases |
| **Guard Sound Investigations** | ${metrics.alertTransitions.investigating} | NPCs transitioning to INVESTIGATING |
| **Guard Combat Engagements** | ${metrics.alertTransitions.combat} | NPCs acquiring visual lock in COMBAT |
| **Steam Clouds Deployed** | ${metrics.steamCloudsDeployed} | Vented steam to obscure LOS |
| **Clockwork Traps Triggered** | ${metrics.trapsTriggered} | Hidden tripwires / spring jaws stepped on |
| **Damage Dealt (Player)** | ${metrics.damageDealt} HP | Targeted combat damage to hostiles |
| **Damage Taken (Player)** | ${metrics.damageTaken} HP | Trauma sustained from hostiles or scalds |
| **Final Blood Volume** | ${metrics.finalBloodPct}% | Haemodynamic stability |

`;

  fs.writeFileSync(config.reportPath, content, 'utf-8');
}

if (process.argv[1]?.endsWith('llm-playtester.ts')) {
  const cfg = parseCliArgs(process.argv.slice(2));
  console.log(`[llm-playtester] Starting session (mock=${cfg.mock}, turns=${cfg.maxTurns}, seed=${cfg.seed})...`);
  runPlaytestSession(cfg).then((m) => {
    console.log(`[llm-playtester] Complete. Survived ${m.turnsSurvived}/${cfg.maxTurns} turns. Report: ${cfg.reportPath}`);
  }).catch((err) => {
    console.error('[llm-playtester] Fatal error:', err);
    process.exit(1);
  });
}
