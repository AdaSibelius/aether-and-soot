import { SimEvent } from '../../schemas/events.schema.js';
import { LimbSlotId } from '../../schemas/primitives.schema.js';
import { SeededRNG } from '../core/rng.js';
import { STANDARD_ACTION_AP } from '../core/scheduler.js';
import { WorldState } from '../core/world.js';
import { canActorSpotTarget } from './stealth-acoustics.system.js';
import { resolveNpcEcologyAction } from './npc-ecology.system.js';
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
    let apSpent = STANDARD_ACTION_AP;
    let nextAlertState = npc.aiController.alertState;
    let nextLastKnownTargetPos = npc.aiController.lastKnownTargetPos;

    if (npc.anatomy && npc.anatomy.bloodVolumePct <= 60 && npc.inventory) {
      const ecoRes = resolveNpcEcologyAction(workingState, npc.id);
      if (ecoRes.handled) {
        workingState = ecoRes.state;
        apSpent = ecoRes.apSpent;
        events.push(...ecoRes.events);
        const afterEcoNpc = workingState.entities[npc.id];
        if (afterEcoNpc?.actor && afterEcoNpc.aiController) {
          workingState = {
            ...workingState,
            entities: {
              ...workingState.entities,
              [npc.id]: {
                ...afterEcoNpc,
                actor: { ...afterEcoNpc.actor, energy: gainedEnergy - apSpent },
              },
            },
          };
        }
        continue;
      }
    }

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
    } else if (
      isHostile &&
      player?.position &&
      player.position.stratum === npc.position.stratum &&
      canActorSpotTarget(workingState, npc.id, player.id)
    ) {
      nextAlertState = 'COMBAT';
      nextLastKnownTargetPos = {
        x: player.position.x,
        y: player.position.y,
        stratum: player.position.stratum,
      };
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
    } else {
      if (nextAlertState === 'COMBAT') {
        nextAlertState = 'INVESTIGATING';
      }
      if (nextAlertState === 'INVESTIGATING' && nextLastKnownTargetPos) {
        if (nextLastKnownTargetPos.stratum === npc.position.stratum) {
          if (
            npc.position.x === nextLastKnownTargetPos.x &&
            npc.position.y === nextLastKnownTargetPos.y
          ) {
            nextAlertState = 'IDLE';
            nextLastKnownTargetPos = undefined;
          } else {
            const dx = Math.sign(nextLastKnownTargetPos.x - npc.position.x);
            const dy = Math.sign(nextLastKnownTargetPos.y - npc.position.y);
            const moveRes = resolveMoveStep(workingState, npc.id, dx, dy);
            workingState = moveRes.state;
            apSpent = moveRes.apSpent;
            events.push(...moveRes.events);

            const movedNpc = workingState.entities[npc.id];
            if (
              movedNpc?.position &&
              movedNpc.position.x === nextLastKnownTargetPos.x &&
              movedNpc.position.y === nextLastKnownTargetPos.y
            ) {
              nextAlertState = 'IDLE';
              nextLastKnownTargetPos = undefined;
            }
          }
        }
      } else {
        const ecoRes = resolveNpcEcologyAction(workingState, npc.id);
        if (ecoRes.handled) {
          workingState = ecoRes.state;
          apSpent = ecoRes.apSpent;
          events.push(...ecoRes.events);
        }
      }
    }

    const afterNpc = workingState.entities[npc.id];
    if (afterNpc?.actor && afterNpc.aiController) {
      const { lastKnownTargetPos: _prevTarget, ...restAi } = afterNpc.aiController;
      workingState = {
        ...workingState,
        entities: {
          ...workingState.entities,
          [npc.id]: {
            ...afterNpc,
            actor: { ...afterNpc.actor, energy: gainedEnergy - apSpent },
            aiController: {
              ...restAi,
              hostile: isHostile,
              alertState: nextAlertState,
              ...(nextLastKnownTargetPos ? { lastKnownTargetPos: nextLastKnownTargetPos } : {}),
            },
          },
        },
      };
    }
  }

  return { state: workingState, events };
}
