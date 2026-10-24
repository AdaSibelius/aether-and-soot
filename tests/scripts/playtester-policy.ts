import { GameCommand } from '../../src/schemas/commands.schema.js';
import { EntityId } from '../../src/schemas/primitives.schema.js';
import { WorldState } from '../../src/sim/core/world.js';
import { findEntitiesAtPoint, getTileCell } from '../../src/sim/spatial/grid.js';
import { ModelTier, resolveModel } from './local-llm-config.js';

export interface DecisionPolicyResult {
  readonly stage: 1 | 2 | 3;
  readonly reason: string;
  readonly command?: GameCommand | undefined;
  readonly tier?: ModelTier | undefined;
  readonly model?: string | undefined;
}

export interface DecisionPolicyOptions {
  readonly consecutiveFailures: number;
  readonly recentPositions?: ReadonlyArray<{ x: number; y: number }> | undefined;
  readonly targetStratumTransit?: boolean | undefined;
}

export function evaluateDecisionPolicy(
  state: WorldState,
  playerId: EntityId,
  opts: DecisionPolicyOptions,
): DecisionPolicyResult {
  const player = state.entities[playerId];
  if (!player?.position || !player.anatomy) {
    return {
      stage: 1,
      reason: 'PLAYER_UNAVAILABLE_FALLBACK',
      command: { type: 'WAIT_TURN', actorId: playerId },
    };
  }

  const pos = player.position;
  const grid = state.strata[pos.stratum];

  // Stage 1.1: Immediate Critical Haemostatic Reflex (Blood <= 35%)
  if (player.anatomy.bloodVolumePct <= 35 && player.inventory) {
    const medicine = player.inventory.containedEntityIds.find((id) => {
      const ent = state.entities[id];
      const bp = ent?.item?.blueprintId ?? '';
      const name = ent?.name?.toLowerCase() ?? '';
      return bp.includes('tonic') || bp.includes('laudanum') || name.includes('tonic') || name.includes('salve');
    });
    if (medicine) {
      return {
        stage: 1,
        reason: 'CRITICAL_HAEMOSTATIC_REFLEX',
        command: { type: 'USE_ITEM', actorId: playerId, itemEntityId: medicine },
      };
    }
  }

  // Stage 1.2: Immediate Adjacent Hostile Combat Strike
  for (const ent of Object.values(state.entities)) {
    if (!ent.position || ent.position.stratum !== pos.stratum || !ent.actor || ent.actor.isPlayer) continue;
    if (!ent.aiController?.hostile) continue;
    const dx = ent.position.x - pos.x;
    const dy = ent.position.y - pos.y;
    if (Math.abs(dx) <= 1 && Math.abs(dy) <= 1 && (dx !== 0 || dy !== 0)) {
      const hp = (ent.anatomy?.limbs['TORSO']?.hp ?? 0) + (ent.anatomy?.limbs['HEAD']?.hp ?? 0);
      if (hp > 0 && (ent.anatomy?.bloodVolumePct ?? 100) > 0) {
        return {
          stage: 1,
          reason: 'ADJACENT_THREAT_COMBAT_REFLEX',
          command: {
            type: 'ATTACK_ACTOR',
            attackerId: playerId,
            targetId: ent.id,
            targetSlot: 'TORSO',
          },
        };
      }
    }
  }

  // Stage 1.3: Straight Corridor Repeat Step Reflex
  if (opts.recentPositions && opts.recentPositions.length >= 3 && grid) {
    const p1 = opts.recentPositions[opts.recentPositions.length - 2];
    const p2 = opts.recentPositions[opts.recentPositions.length - 1];
    if (p1 && p2) {
      const dx = p2.x - p1.x;
      const dy = p2.y - p1.y;
      if ((Math.abs(dx) === 1 && dy === 0) || (Math.abs(dy) === 1 && dx === 0)) {
        const nextX = pos.x + dx;
        const nextY = pos.y + dy;
        const cell = getTileCell(grid, nextX, nextY);
        const blockers = findEntitiesAtPoint(state.entities, { x: nextX, y: nextY, stratum: pos.stratum });
        const isWalkable = cell && cell.terrainType !== 'SOOT_BRICK_WALL' && cell.terrainType !== 'WOODEN_DOOR_CLOSED';
        const hasNoBlockers = !blockers.some((b) => b.actor || b.trap?.armed || b.furniture);
        if (isWalkable && hasNoBlockers && opts.consecutiveFailures === 0) {
          return {
            stage: 1,
            reason: 'CORRIDOR_NAVIGATION_REFLEX',
            command: { type: 'MOVE_STEP', actorId: playerId, dx, dy },
          };
        }
      }
    }
  }

  // Stage 3: Reasoning Model Escalation (Stuck >= 3 turns or Stratum Transit)
  if (opts.consecutiveFailures >= 3 || opts.targetStratumTransit) {
    return {
      stage: 3,
      reason: opts.targetStratumTransit ? 'STRATUM_TRANSIT_EVALUATION' : 'STUCK_ACTION_ESCALATION',
      tier: 'tier1',
      model: resolveModel('tier1'),
    };
  }

  // Stage 2: Fast Model Default (Tactical Exploration & Interactions)
  return {
    stage: 2,
    reason: 'FAST_MODEL_TACTICAL_EXPLORATION',
    tier: 'tier3',
    model: resolveModel('tier3'),
  };
}
