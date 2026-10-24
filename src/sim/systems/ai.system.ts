import { GameCommand } from '../../schemas/commands.schema.js';
import { EntityRecord } from '../../schemas/components.schema.js';
import { SimEvent } from '../../schemas/events.schema.js';
import { LimbSlotId, Point3D } from '../../schemas/primitives.schema.js';
import { SeededRNG } from '../core/rng.js';
import { STANDARD_ACTION_AP } from '../core/scheduler.js';
import { WorldState } from '../core/world.js';
import { createSpatialView, SpatialView } from '../spatial/facade.js';
import { resolveAttackActor } from './combat.system.js';
import { sortEntitiesById } from './inventory-utils.js';
import { resolveMoveStep } from './movement.system.js';
import { resolveNpcEcologyAction } from './npc-ecology.system.js';
import { resolveEmitSquadCallout } from './squad-witness.system.js';
import { canActorSpotTarget } from './stealth-acoustics.system.js';

export { createDefaultNpcAnatomy, createProceduralDistrictContracts, spawnDistrictNpcs } from './district-spawner.js';

export const NPC_VISION_RADIUS = 8;
export const HOSTILE_REPUTATION_THRESHOLD = -30;

const TARGETABLE_SLOTS: readonly LimbSlotId[] = [
  'TORSO', 'LEFT_ARM', 'RIGHT_ARM', 'LEFT_LEG', 'RIGHT_LEG', 'HEAD',
];

export interface NpcIntentDecision {
  readonly command?: GameCommand | undefined;
  readonly nextAlertState: 'IDLE' | 'INVESTIGATING' | 'COMBAT';
  readonly nextLastKnownTargetPos?: Point3D | undefined;
  readonly shouldEmitSquadCallout?: boolean | undefined;
}

/**
 * Pure decision function: evaluates spatial queries and social relationships to formulate
 * a declarative GameCommand intent without mutating simulation state.
 */
export function decideNpcIntent(
  npc: EntityRecord,
  state: WorldState,
  spatial: SpatialView,
  rng: SeededRNG,
): NpcIntentDecision {
  if (!npc.actor || !npc.aiController || !npc.position) return { nextAlertState: 'IDLE' };

  const player = Object.values(state.entities).find((e) => e.actor?.isPlayer);
  const rep = state.economy.factionReputation[npc.aiController.factionId] ?? 0;
  const isCompanion = Boolean(npc.aiController.companionOfActorId);
  const hasGrudge = Boolean(player && npc.aiController.grudgeTargetId === player.id);
  const isHostile = !isCompanion && (npc.aiController.hostile || rep <= HOSTILE_REPUTATION_THRESHOLD || hasGrudge);

  let nextAlertState = npc.aiController.alertState;
  let nextLastKnownTargetPos = npc.aiController.lastKnownTargetPos;

  if (isCompanion && player?.position && player.position.stratum === npc.position.stratum) {
    const nearby = spatial.findEntitiesInRadius(npc.position, 1);
    const adjacentHostile = nearby.find((e) => e.actor && !e.actor.isPlayer && e.aiController?.hostile && e.id !== npc.id);
    if (adjacentHostile) {
      const targetSlot = TARGETABLE_SLOTS[rng.nextInt(0, TARGETABLE_SLOTS.length - 1)] ?? 'TORSO';
      return { command: { type: 'ATTACK_ACTOR', attackerId: npc.id, targetId: adjacentHostile.id, targetSlot }, nextAlertState, nextLastKnownTargetPos };
    }
    if (spatial.getChebyshevDistance(player.position, npc.position) > 1) {
      const dir = spatial.getDirectionToward(npc.position, player.position);
      return { command: { type: 'MOVE_STEP', actorId: npc.id, dx: dir.dx, dy: dir.dy }, nextAlertState, nextLastKnownTargetPos };
    }
    return { nextAlertState, nextLastKnownTargetPos };
  }

  if (isHostile && player?.position && player.position.stratum === npc.position.stratum && canActorSpotTarget(state, npc.id, player.id)) {
    const shouldEmitSquadCallout = npc.aiController.alertState !== 'COMBAT' && Boolean(npc.aiController.squadId);
    nextAlertState = 'COMBAT';
    nextLastKnownTargetPos = { x: player.position.x, y: player.position.y, stratum: player.position.stratum };
    const dist = spatial.getChebyshevDistance(npc.position, player.position);
    if (dist <= 1) {
      const targetSlot = TARGETABLE_SLOTS[rng.nextInt(0, TARGETABLE_SLOTS.length - 1)] ?? 'TORSO';
      return { command: { type: 'ATTACK_ACTOR', attackerId: npc.id, targetId: player.id, targetSlot }, nextAlertState, nextLastKnownTargetPos, shouldEmitSquadCallout };
    }
    const dir = spatial.getDirectionToward(npc.position, player.position);
    return { command: { type: 'MOVE_STEP', actorId: npc.id, dx: dir.dx, dy: dir.dy }, nextAlertState, nextLastKnownTargetPos, shouldEmitSquadCallout };
  }

  if (nextAlertState === 'COMBAT') nextAlertState = 'INVESTIGATING';

  if (nextAlertState === 'INVESTIGATING' && nextLastKnownTargetPos && nextLastKnownTargetPos.stratum === npc.position.stratum) {
    if (npc.position.x === nextLastKnownTargetPos.x && npc.position.y === nextLastKnownTargetPos.y) {
      return { nextAlertState: 'IDLE', nextLastKnownTargetPos: undefined };
    }
    const dir = spatial.getDirectionToward(npc.position, nextLastKnownTargetPos);
    return { command: { type: 'MOVE_STEP', actorId: npc.id, dx: dir.dx, dy: dir.dy }, nextAlertState, nextLastKnownTargetPos };
  }

  return { nextAlertState, nextLastKnownTargetPos };
}

/**
 * Advances energy and executes deterministic AI turns for all autonomous NPCs.
 * Queries spatial environment through SpatialView and formulates actions as typed GameCommands.
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
    const player = Object.values(workingState.entities).find((e) => e.actor?.isPlayer);
    const hasGrudge = Boolean(player && npc.aiController.grudgeTargetId === player.id);
    const isHostile = !isCompanion && (npc.aiController.hostile || rep <= HOSTILE_REPUTATION_THRESHOLD || hasGrudge);

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

    let apSpent = STANDARD_ACTION_AP;

    if (npc.anatomy && npc.anatomy.bloodVolumePct <= 60 && npc.inventory) {
      const ecoRes = resolveNpcEcologyAction(workingState, npc.id);
      if (ecoRes.handled) {
        workingState = ecoRes.state;
        events.push(...ecoRes.events);
        const afterEcoNpc = workingState.entities[npc.id];
        if (afterEcoNpc?.actor && afterEcoNpc.aiController) {
          workingState = {
            ...workingState,
            entities: {
              ...workingState.entities,
              [npc.id]: { ...afterEcoNpc, actor: { ...afterEcoNpc.actor, energy: gainedEnergy - ecoRes.apSpent } },
            },
          };
        }
        continue;
      }
    }

    const spatial = createSpatialView(workingState, npc.position.stratum);
    const decision = decideNpcIntent(npc, workingState, spatial, rng);

    if (decision.shouldEmitSquadCallout && player) {
      const callout = resolveEmitSquadCallout(workingState, npc.id, player.id, 'Target sighted! Rally to me!');
      workingState = callout.state;
      events.push(...callout.events);
    }

    let nextAlertState = decision.nextAlertState;
    let nextLastKnownTargetPos = decision.nextLastKnownTargetPos;

    if (decision.command?.type === 'ATTACK_ACTOR') {
      const c = decision.command;
      const atkRes = resolveAttackActor(workingState, c.attackerId, c.targetId, c.targetSlot, rng);
      workingState = atkRes.state; apSpent = atkRes.apSpent; events.push(...atkRes.events);
    } else if (decision.command?.type === 'MOVE_STEP') {
      const c = decision.command;
      const moveRes = resolveMoveStep(workingState, c.actorId, c.dx, c.dy);
      workingState = moveRes.state; apSpent = moveRes.apSpent; events.push(...moveRes.events);
      const movedNpc = workingState.entities[npc.id];
      if (movedNpc?.position && nextLastKnownTargetPos && movedNpc.position.x === nextLastKnownTargetPos.x && movedNpc.position.y === nextLastKnownTargetPos.y) {
        nextAlertState = 'IDLE'; nextLastKnownTargetPos = undefined;
      }
    } else {
      const ecoRes = resolveNpcEcologyAction(workingState, npc.id);
      if (ecoRes.handled) {
        workingState = ecoRes.state; apSpent = ecoRes.apSpent; events.push(...ecoRes.events);
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
