import path from 'node:path';
import { GameCommand } from '../../src/schemas/commands.schema.js';
import { EntityIdSchema } from '../../src/schemas/primitives.schema.js';
import { dispatchCommand } from '../../src/sim/core/engine.js';
import { createInitialWorld } from '../../src/sim/core/world.js';
import { generateVictorianDistrict } from '../../src/sim/spatial/generator.js';
import { generateMockAction, parseLlmResponseToCommand, serializePlayerContext, LastTurnContextSummary } from './playtester-serializer.js';
import { applyPlaytestScenario, getScenarioObjectives, PlaytestScenario } from './playtester-scenarios.js';
import { PlaytestMetrics, writeReport } from './playtest-report.js';
import { resolveEndpoint, resolveModel, queryLocalOllama, ModelTier } from './local-llm-config.js';
import { recordInferenceMetric, getInferenceLedgerSummary } from './local-llm-ledger.js';
import { auditClientProjection, ClientProjectionAudit } from './playtester-projection-audit.js';
import { evaluateDecisionPolicy } from './playtester-policy.js';

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
  return {
    mock: argv.includes('--mock'),
    maxTurns: Number(getArg('--turns', '100')),
    seed: Number(getArg('--seed', '42')),
    endpoint: resolveEndpoint(getArg('--endpoint', '') || undefined),
    model: resolveModel('tier3', getArg('--model', '') || undefined),
    reportPath: getArg('--report', path.join(process.cwd(), 'tests/artifacts/playtest-report.md')),
    scenario: (getArg('--scenario', 'explore') as PlaytestScenario),
  };
}

async function queryLocalLlm(endpoint: string, model: string, prompt: string, tier?: ModelTier): Promise<string> {
  try {
    return await queryLocalOllama(prompt, {
      endpoint,
      model,
      systemPrompt: 'You are playing Aether & Soot, a Victorian roguelike. Return ONLY JSON matching schema (action: MOVE/WAIT/ATTACK/TOGGLE_DOOR/VENT_STEAM/BREACH_TILE/STOKE_BOILER/CRAFT_RECIPE/SALVAGE_ITEM/GRAFT_PROSTHETIC/FIELD_REPAIR_LIMB/PRY_OBJECT/CLAIM_SAFEHOUSE/STOCK_PEDESTAL/DISPATCH_MONORAIL/ACCEPT_CONTRACT). Do not make function or tool calls.',
      formatJson: true,
      temperature: 0.1,
      task: 'llm-playtester',
      tier: tier ?? 'tier3',
    });
  } catch {
    console.error('FATAL: Local LLM connection failed. Aborting to prevent paid token burn.');
    process.exit(1);
  }
}

export async function runPlaytestSession(config: PlaytestConfig): Promise<PlaytestMetrics> {
  const playerId = EntityIdSchema.parse('actor_player');
  const baseWorld = createInitialWorld({ seed: config.seed, width: 48, height: 36 });
  let state = applyPlaytestScenario(generateVictorianDistrict(baseWorld).state, config.scenario);
  const scenarioObjs = getScenarioObjectives(config.scenario);
  const startLedger = getInferenceLedgerSummary();

  const metrics: PlaytestMetrics = {
    turnsSurvived: 0, totalDecibels: 0, steamCloudsDeployed: 0, trapsTriggered: 0,
    hostilesAttacked: 0, attackHits: 0, attackMisses: 0, damageDealt: 0, damageTaken: 0,
    itemsAcquired: 0, itemsUsed: 0, transitionsCompleted: 0, finalBloodPct: 100,
    uniqueTilesVisited: 0, uiProjectionLeaks: 0,
    alertTransitions: { investigating: 0, combat: 0 },
    commandHistogram: {},
    stageDecisions: { stage1: 0, stage2: 0, stage3: 0 },
  };

  const prevAlerts = new Map<string, string>();
  const recentPositions: Array<{ x: number; y: number }> = [];
  const visitedTiles = new Set<string>();
  let lastSystemFeedback: string | undefined;
  let consecutiveFailures = 0;
  let lastTurnContext: LastTurnContextSummary | undefined;

  for (let turn = 0; turn < config.maxTurns; turn++) {
    const player = state.entities[playerId];
    if (!player || !player.anatomy) {
      metrics.causeOfDeath = 'PLAYER_NOT_FOUND';
      break;
    }
    if (player.position) visitedTiles.add(`${player.position.x},${player.position.y},${player.position.stratum}`);
    metrics.finalBloodPct = player.anatomy.bloodVolumePct;
    if (player.anatomy.bloodVolumePct <= 0) { metrics.causeOfDeath = 'EXSANGUINATION'; break; }
    if ((player.anatomy.limbs['TORSO']?.hp ?? 0) <= 0 || (player.anatomy.limbs['HEAD']?.hp ?? 0) <= 0) {
      metrics.causeOfDeath = 'VITAL_ORGAN_TRAUMA';
      break;
    }
    metrics.turnsSurvived = turn + 1;

    const projectionAudit = auditClientProjection(state, playerId);
    (state as { clientProjectionAudit?: ClientProjectionAudit }).clientProjectionAudit = projectionAudit;
    metrics.uiProjectionLeaks = (metrics.uiProjectionLeaks ?? 0) + projectionAudit.leakCount;

    // 3-Stage Decision Policy evaluation
    const policy = evaluateDecisionPolicy(state, playerId, {
      consecutiveFailures,
      recentPositions: recentPositions.slice(-3),
      targetStratumTransit: config.scenario === 'transit',
    });
    const stageKey = policy.stage === 1 ? 'stage1' : policy.stage === 2 ? 'stage2' : 'stage3';
    if (metrics.stageDecisions) metrics.stageDecisions[stageKey]++;

    let command: GameCommand;
    let rawAction = '';
    if (policy.stage === 1 && policy.command) {
      command = policy.command;
      rawAction = JSON.stringify({ action: command.type, reflex: policy.reason });
    } else if (config.mock) {
      if (turn === 0) {
        recordInferenceMetric({
          timestamp: new Date().toISOString(), task: 'llm-playtester', tier: policy.tier ?? 'tier3', model: config.model,
          prompt_tokens: 0, completion_tokens: 0, duration_ms: 0, retry_count: 0, success: true, cache_hit: true,
        });
      }
      rawAction = JSON.stringify(generateMockAction(state, playerId, recentPositions, config.scenario));
      command = parseLlmResponseToCommand(rawAction, state, playerId);
    } else {
      const activeModel = policy.model ?? config.model;
      const context = serializePlayerContext(state, playerId, {
        recentPositions: recentPositions.slice(-3),
        systemFeedback: lastSystemFeedback,
        primaryObjective: scenarioObjs.primary,
        secondaryDirective: scenarioObjs.secondary,
        lastTurnContext,
      });
      rawAction = await queryLocalLlm(config.endpoint, activeModel, context, policy.tier);
      if (!rawAction || rawAction === '{}') {
        console.error('FATAL: Local LLM connection failed. Aborting to prevent paid token burn.');
        process.exit(1);
      }
      command = parseLlmResponseToCommand(rawAction, state, playerId);
    }

    let invalidFeedback: string | undefined;
    if (command.type === 'WAIT_TURN' && !/\bwait\b/i.test(rawAction) && policy.stage !== 1) {
      invalidFeedback = 'Last action was unrecognized. Defaulted to WAIT_TURN.';
    }

    if (!config.mock && turn < 15) console.log(`[llm-playtester] Turn ${turn + 1} (S${policy.stage}): ${command.type}`);
    const stepRes = dispatchCommand(state, command);
    metrics.commandHistogram[command.type] = (metrics.commandHistogram[command.type] ?? 0) + 1;
    state = stepRes.state;

    const blockedEv = stepRes.events.find((e) => e.type === 'MOVEMENT_BLOCKED');
    const combatFailed = stepRes.events.find((e) => e.type === 'COMBAT_ACTION_FAILED');
    if (combatFailed && combatFailed.type === 'COMBAT_ACTION_FAILED' && combatFailed.attackerId === playerId) {
      lastSystemFeedback = `Attack failed (${combatFailed.reason}). Target must be adjacent (within 1 tile) to strike.`;
      consecutiveFailures++;
    } else if (blockedEv && blockedEv.type === 'MOVEMENT_BLOCKED') {
      const dirDesc = command.type === 'MOVE_STEP' ? (command.dx > 0 ? 'East' : command.dx < 0 ? 'West' : command.dy > 0 ? 'South' : 'North') : 'target';
      lastSystemFeedback = `Last action failed. Attempted to move ${dirDesc}, but path was obstructed by solid wall or obstacle.`;
      consecutiveFailures++;
    } else {
      lastSystemFeedback = invalidFeedback;
      if (invalidFeedback) consecutiveFailures++;
      else consecutiveFailures = 0;
    }

    if (player.position) {
      const last = recentPositions[recentPositions.length - 1];
      if (!last || last.x !== player.position.x || last.y !== player.position.y) {
        recentPositions.push({ x: player.position.x, y: player.position.y });
        if (recentPositions.length > 5) recentPositions.shift();
      }
      lastTurnContext = {
        stratum: player.position.stratum,
        blood: player.anatomy.bloodVolumePct,
        steam: player.anatomy.steamReserveKpa ?? 0,
        safehouses: Object.values(state.safehouses).map((s) => s.name).join(', ') || 'None',
        codexCount: Object.keys(state.codex).length,
      };
    }

    for (const ev of stepRes.events) {
      if (ev.type === 'SOUND_EMITTED') metrics.totalDecibels += ev.decibels;
      if (ev.type === 'TRAP_TRIGGERED') metrics.trapsTriggered++;
      if (ev.type === 'STEAM_VENTED') metrics.steamCloudsDeployed++;
      if (ev.type === 'COMBAT_ATTACK_RESOLVED') {
        if (ev.attackerId === playerId) {
          metrics.hostilesAttacked++;
          if (ev.hit) { metrics.attackHits++; metrics.damageDealt += ev.damageDealt; }
          else { metrics.attackMisses++; }
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

  const endLedger = getInferenceLedgerSummary();
  metrics.promptTokens = Math.max(0, endLedger.totalPromptTokens - startLedger.totalPromptTokens);
  metrics.completionTokens = Math.max(0, endLedger.totalCompletionTokens - startLedger.totalCompletionTokens);
  metrics.totalDurationMs = Math.max(0, endLedger.totalDurationMs - startLedger.totalDurationMs);
  const totTokens = metrics.promptTokens + metrics.completionTokens;
  metrics.averageLatencyMs = metrics.turnsSurvived > 0 ? Math.round(metrics.totalDurationMs / metrics.turnsSurvived) : 0;
  metrics.turnsSurvivedPerKiloToken = totTokens > 0
    ? Math.round((metrics.turnsSurvived / totTokens) * 1000 * 10) / 10
    : (config.mock ? 1000 : 0);
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
