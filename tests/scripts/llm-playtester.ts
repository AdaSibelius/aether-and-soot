import path from 'node:path';
import { EntityIdSchema } from '../../src/schemas/primitives.schema.js';
import { dispatchCommand } from '../../src/sim/core/engine.js';
import { createInitialWorld } from '../../src/sim/core/world.js';
import { generateVictorianDistrict } from '../../src/sim/spatial/generator.js';
import {
  generateMockAction,
  parseLlmResponseToCommand,
  serializePlayerContext,
} from './playtester-serializer.js';
import {
  applyPlaytestScenario,
  getScenarioObjectives,
  PlaytestScenario,
} from './playtester-scenarios.js';
import { PlaytestMetrics, writeReport } from './playtest-report.js';
import { resolveEndpoint, resolveModel, queryLocalOllama } from './local-llm-config.js';

export type { PlaytestMetrics };

export interface PlaytestConfig {
  readonly mock: boolean;
  readonly maxTurns: number;
  readonly seed: number;
  readonly endpoint: string;
  readonly model: string;
  readonly reportPath: string;
  readonly scenario: PlaytestScenario;
}

export function parseCliArgs(argv: string[]): PlaytestConfig {
  const getArg = (flag: string, fallback: string): string => {
    const idx = argv.indexOf(flag);
    return idx !== -1 && argv[idx + 1] ? argv[idx + 1]! : fallback;
  };
  const epArg = getArg('--endpoint', '');
  const modelArg = getArg('--model', '');
  return {
    mock: argv.includes('--mock'),
    maxTurns: Number(getArg('--turns', '100')),
    seed: Number(getArg('--seed', '42')),
    endpoint: resolveEndpoint(epArg || undefined),
    model: resolveModel('tier3', modelArg || undefined),
    reportPath: getArg('--report', path.join(process.cwd(), 'tests/artifacts/playtest-report.md')),
    scenario: (getArg('--scenario', 'explore') as PlaytestScenario),
  };
}

async function queryLocalLlm(endpoint: string, model: string, prompt: string): Promise<string> {
  try {
    return await queryLocalOllama(prompt, {
      endpoint,
      model,
      systemPrompt: 'You are playing Aether & Soot, a Victorian roguelike. Return ONLY JSON matching schema (action: MOVE/WAIT/ATTACK/TOGGLE_DOOR/VENT_STEAM/BREACH_TILE). Do not make function or tool calls.',
      formatJson: true,
      temperature: 0.2,
    });
  } catch (err) {
    console.warn(`[llm-playtester] Local LLM unreachable (${err}), using fallback.`);
    return '{}';
  }
}

export async function runPlaytestSession(config: PlaytestConfig): Promise<PlaytestMetrics> {
  const playerId = EntityIdSchema.parse('actor_player');
  const baseWorld = createInitialWorld({ seed: config.seed, width: 48, height: 36 });
  let state = applyPlaytestScenario(generateVictorianDistrict(baseWorld).state, config.scenario);
  const scenarioObjs = getScenarioObjectives(config.scenario);

  const metrics: PlaytestMetrics = {
    turnsSurvived: 0,
    totalDecibels: 0,
    alertTransitions: { investigating: 0, combat: 0 },
    steamCloudsDeployed: 0,
    trapsTriggered: 0,
    hostilesAttacked: 0,
    attackHits: 0,
    attackMisses: 0,
    damageDealt: 0,
    damageTaken: 0,
    itemsAcquired: 0,
    itemsUsed: 0,
    transitionsCompleted: 0,
    finalBloodPct: 100,
    uniqueTilesVisited: 0,
    commandHistogram: {},
  };

  const prevAlerts = new Map<string, string>();
  const recentPositions: Array<{ x: number; y: number }> = [];
  const visitedTiles = new Set<string>();
  let lastSystemFeedback: string | undefined;

  for (let turn = 0; turn < config.maxTurns; turn++) {
    const player = state.entities[playerId];
    if (!player || !player.anatomy) {
      metrics.causeOfDeath = 'PLAYER_NOT_FOUND';
      break;
    }
    if (player.position) {
      visitedTiles.add(`${player.position.x},${player.position.y},${player.position.stratum}`);
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
      rawAction = JSON.stringify(generateMockAction(state, playerId, recentPositions));
    } else {
      const context = serializePlayerContext(state, playerId, {
        recentPositions: recentPositions.slice(-3),
        systemFeedback: lastSystemFeedback,
        primaryObjective: scenarioObjs.primary,
        secondaryDirective: scenarioObjs.secondary,
      });
      rawAction = await queryLocalLlm(config.endpoint, config.model, context);
      if (rawAction === '{}') rawAction = JSON.stringify(generateMockAction(state, playerId, recentPositions));
    }

    const command = parseLlmResponseToCommand(rawAction, state, playerId);
    let invalidFeedback: string | undefined;
    if (command.type === 'WAIT_TURN' && !/\bwait\b/i.test(rawAction)) {
      invalidFeedback = 'Last action was unrecognized. Defaulted to WAIT_TURN.';
    }

    if (!config.mock && turn < 15) {
      console.log(`[llm-playtester] Turn ${turn + 1}: ${command.type}`);
    }
    const stepRes = dispatchCommand(state, command);
    metrics.commandHistogram[command.type] = (metrics.commandHistogram[command.type] ?? 0) + 1;
    state = stepRes.state;

    const blockedEv = stepRes.events.find((e) => e.type === 'MOVEMENT_BLOCKED');
    const combatFailed = stepRes.events.find((e) => e.type === 'COMBAT_ACTION_FAILED');
    if (combatFailed && combatFailed.type === 'COMBAT_ACTION_FAILED' && combatFailed.attackerId === playerId) {
      lastSystemFeedback = `Attack failed (${combatFailed.reason}). Target must be adjacent (within 1 tile) to strike.`;
    } else if (blockedEv && blockedEv.type === 'MOVEMENT_BLOCKED') {
      const dirDesc = command.type === 'MOVE_STEP'
        ? (command.dx > 0 ? 'East' : command.dx < 0 ? 'West' : command.dy > 0 ? 'South' : 'North')
        : 'target';
      lastSystemFeedback = `Last action failed. Attempted to move ${dirDesc}, but path was obstructed by solid wall or obstacle.`;
    } else {
      lastSystemFeedback = invalidFeedback;
    }

    if (player.position) {
      const last = recentPositions[recentPositions.length - 1];
      if (!last || last.x !== player.position.x || last.y !== player.position.y) {
        recentPositions.push({ x: player.position.x, y: player.position.y });
        if (recentPositions.length > 5) recentPositions.shift();
      }
    }

    for (const ev of stepRes.events) {
      if (ev.type === 'SOUND_EMITTED') metrics.totalDecibels += ev.decibels;
      if (ev.type === 'TRAP_TRIGGERED') metrics.trapsTriggered++;
      if (ev.type === 'STEAM_VENTED') metrics.steamCloudsDeployed++;
      if (ev.type === 'COMBAT_ATTACK_RESOLVED') {
        if (ev.attackerId === playerId) {
          metrics.hostilesAttacked++;
          if (ev.hit) {
            metrics.attackHits++;
            metrics.damageDealt += ev.damageDealt;
          } else {
            metrics.attackMisses++;
          }
        }
        if (ev.targetId === playerId) metrics.damageTaken += ev.damageDealt;
      }
      if (ev.type === 'COMBAT_ACTION_FAILED' && ev.attackerId === playerId) metrics.attackMisses++;
      if (ev.type === 'ITEM_PICKED_UP' || ev.type === 'MERCHANT_TRADE_COMPLETED') metrics.itemsAcquired++;
      if (ev.type === 'ITEM_USED') metrics.itemsUsed++;
      if (ev.type === 'STRATUM_CHANGED' || ev.type === 'DISTRICT_TRAVELED') metrics.transitionsCompleted++;
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

  metrics.uniqueTilesVisited = visitedTiles.size;
  writeReport(config, metrics);
  return metrics;
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
