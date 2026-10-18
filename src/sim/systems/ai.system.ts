import { SimEvent } from '../../schemas/events.schema.js';
import { LimbSlotId } from '../../schemas/primitives.schema.js';
import { SeededRNG } from '../core/rng.js';
import { STANDARD_ACTION_AP } from '../core/scheduler.js';
import { WorldState } from '../core/world.js';
import { computeVisibleTiles, isPointVisible } from '../spatial/fov.js';
import { resolveAttackActor } from './combat.system.js';
import { sortEntitiesById } from './inventory-utils.js';
import { resolveMoveStep } from './movement.system.js';

export { createDefaultNpcAnatomy, createProceduralDistrictContracts, spawnDistrictNpcs } from './district-spawner.js';

export const NPC_VISION_RADIUS = 8;
export const HOSTILE_REPUTATION_THRESHOLD = -30;

const TARGETABLE_SLOTS: readonly LimbSlotId[] = [
  'TORSO', 'LEFT_ARM', 'RIGHT_ARM', 'LEFT_LEG', 'RIGHT_LEG', 'HEAD',
];


/**
 * Advances energy and executes deterministic AI turns for all autonomous NPCs.
 */
export function advanceNpcTurns(
  state: WorldState,
  rng: SeededRNG,
): { readonly state: WorldState; readonly events: SimEvent[] } {
  const npcs = Object.values(state.entities)
    .filter((e) => e.aiController && e.actor && !e.actor.isPlayer && e.position)
    .sort(sortEntitiesById);

  if (npcs.length === 0) return { state, events: [] };

  let workingState = state;
  const events: SimEvent[] = [];

  for (const initialNpc of npcs) {
    const npc = workingState.entities[initialNpc.id];
    if (!npc?.actor || !npc.aiController || !npc.position) continue;

    const gainedEnergy = npc.actor.energy + npc.actor.speed;
    const rep = workingState.economy.factionReputation[npc.aiController.factionId] ?? 0;
    const isCompanion = Boolean(npc.aiController.companionOfActorId);
    const isHostile = !isCompanion && (npc.aiController.hostile || rep <= HOSTILE_REPUTATION_THRESHOLD);

    if (gainedEnergy < STANDARD_ACTION_AP) {
      workingState = {
        ...workingState,
        entities: {
          ...workingState.entities,
          [npc.id]: {
            ...npc,
            actor: { ...npc.actor, energy: gainedEnergy },
            aiController: { ...npc.aiController, hostile: isHostile },
          },
        },
      };
      continue;
    }

    const player = Object.values(workingState.entities).find((e) => e.actor?.isPlayer);
    const grid = workingState.strata[npc.position.stratum];
    let apSpent = STANDARD_ACTION_AP;

    if (isCompanion && player?.position && player.position.stratum === npc.position.stratum) {
      const adjacentHostile = Object.values(workingState.entities).find(
        (e) => e.actor && !e.actor.isPlayer && e.aiController?.hostile && e.position?.stratum === npc.position!.stratum
          && Math.max(Math.abs(e.position.x - npc.position!.x), Math.abs(e.position.y - npc.position!.y)) <= 1,
      );
      if (adjacentHostile) {
        const targetSlot = TARGETABLE_SLOTS[rng.nextInt(0, TARGETABLE_SLOTS.length - 1)] ?? 'TORSO';
        const atkRes = resolveAttackActor(workingState, npc.id, adjacentHostile.id, targetSlot, rng);
        workingState = atkRes.state;
        apSpent = atkRes.apSpent;
        events.push(...atkRes.events);
      } else if (Math.max(Math.abs(player.position.x - npc.position.x), Math.abs(player.position.y - npc.position.y)) > 1) {
        const moveRes = resolveMoveStep(
          workingState, npc.id,
          Math.sign(player.position.x - npc.position.x), Math.sign(player.position.y - npc.position.y),
        );
        workingState = moveRes.state;
        apSpent = moveRes.apSpent;
        events.push(...moveRes.events);
      }
    } else if (isHostile && player?.position && player.position.stratum === npc.position.stratum && grid) {
      const visible = computeVisibleTiles(grid, npc.position.x, npc.position.y, NPC_VISION_RADIUS);
      if (isPointVisible(visible, player.position)) {
        const dist = Math.max(
          Math.abs(player.position.x - npc.position.x),
          Math.abs(player.position.y - npc.position.y),
        );
        if (dist <= 1) {
          const targetSlot = TARGETABLE_SLOTS[rng.nextInt(0, TARGETABLE_SLOTS.length - 1)] ?? 'TORSO';
          const atkRes = resolveAttackActor(workingState, npc.id, player.id, targetSlot, rng);
          workingState = atkRes.state;
          apSpent = atkRes.apSpent;
          events.push(...atkRes.events);
        } else {
          const dx = Math.sign(player.position.x - npc.position.x);
          const dy = Math.sign(player.position.y - npc.position.y);
          const moveRes = resolveMoveStep(workingState, npc.id, dx, dy);
          workingState = moveRes.state;
          apSpent = moveRes.apSpent;
          events.push(...moveRes.events);
        }
      }
    }

    const afterNpc = workingState.entities[npc.id];
    if (afterNpc?.actor && afterNpc.aiController) {
      workingState = {
        ...workingState,
        entities: {
          ...workingState.entities,
          [npc.id]: {
            ...afterNpc,
            actor: { ...afterNpc.actor, energy: gainedEnergy - apSpent },
            aiController: { ...afterNpc.aiController, hostile: isHostile },
          },
        },
      };
    }
  }

  return { state: workingState, events };
}
