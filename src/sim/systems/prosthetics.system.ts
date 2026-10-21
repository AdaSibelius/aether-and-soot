import { EntityRecord } from '../../schemas/components.schema.js';
import { SimEvent } from '../../schemas/events.schema.js';
import { EntityId, LimbSlotId, Point3D } from '../../schemas/primitives.schema.js';
import { STANDARD_ACTION_AP } from '../core/scheduler.js';
import { WorldState } from '../core/world.js';
import { SystemAnatomyResult } from './anatomy.system.js';
import { resolveActorDefeatIfFatal } from './mortality.system.js';
import { executeProstheticAbility } from './prosthetic-abilities.system.js';
import { hasSurgicalBonus } from './surgical-context.js';

type ProstheticFailReason = Extract<SimEvent, { type: 'PROSTHETIC_ACTION_FAILED' }>['reason'];

function failProsthetic(state: WorldState, actorId: EntityId, slot: LimbSlotId, reason: ProstheticFailReason): SystemAnatomyResult {
  return { state, apSpent: STANDARD_ACTION_AP, events: [{ type: 'PROSTHETIC_ACTION_FAILED', turn: state.turnCount + 1, actorId, slot, reason }] };
}

export function resolveInstallProsthetic(
  state: WorldState,
  actorId: EntityId,
  prostheticEntityId: EntityId,
  slot: LimbSlotId,
): SystemAnatomyResult {
  const actor = state.entities[actorId];
  const turn = state.turnCount + 1;
  if (!actor || !actor.anatomy) return failProsthetic(state, actorId, slot, 'MISSING_ANATOMY');

  const prosthetic = state.entities[prostheticEntityId];
  if (!prosthetic || !prosthetic.prostheticSpec) return failProsthetic(state, actorId, slot, 'PROSTHETIC_NOT_FOUND');
  if (prosthetic.prostheticSpec.targetLimbSlot !== slot) return failProsthetic(state, actorId, slot, 'SLOT_MISMATCH');

  const targetLimb = actor.anatomy.limbs[slot];
  if (!targetLimb || targetLimb.installedProstheticEntityId) return failProsthetic(state, actorId, slot, 'SLOT_ALREADY_OCCUPIED');

  const surgicalSafe = hasSurgicalBonus(state, actor);
  const bloodLoss = surgicalSafe ? 0 : 20;
  const nextBlood = Math.max(0, actor.anatomy.bloodVolumePct - bloodLoss);
  const addedStrain = prosthetic.prostheticSpec.activeAbility ? 35 : 20;

  const updatedActor: EntityRecord = {
    ...actor,
    anatomy: {
      ...actor.anatomy,
      bloodVolumePct: nextBlood,
      strainLoadKw: (actor.anatomy.strainLoadKw ?? 0) + addedStrain,
      limbs: {
        ...actor.anatomy.limbs,
        [slot]: {
          ...targetLimb,
          installedProstheticEntityId: prostheticEntityId,
        },
      },
    },
    inventory: actor.inventory
      ? {
          ...actor.inventory,
          currentMassGrams: actor.inventory.currentMassGrams + prosthetic.prostheticSpec.massGrams,
        }
      : undefined,
  };

  let nextState: WorldState = {
    ...state,
    entities: { ...state.entities, [actorId]: updatedActor },
  };

  const events: SimEvent[] = [
    {
      type: 'PROSTHETIC_INSTALLED',
      turn,
      actorId,
      prostheticEntityId,
      slot,
    },
  ];

  const defeatRes = resolveActorDefeatIfFatal(nextState, actorId);
  if (defeatRes.defeated) {
    nextState = defeatRes.state;
    events.push(...defeatRes.events);
  }

  return {
    state: nextState,
    apSpent: 150,
    events,
  };
}

export function resolveRemoveProsthetic(
  state: WorldState,
  actorId: EntityId,
  slot: LimbSlotId,
): SystemAnatomyResult {
  const actor = state.entities[actorId];
  const turn = state.turnCount + 1;
  const targetLimb = actor?.anatomy?.limbs[slot];
  const installedId = targetLimb?.installedProstheticEntityId;

  if (!actor || !actor.anatomy || !targetLimb || !installedId) {
    return failProsthetic(state, actorId, slot, 'NO_PROSTHETIC_INSTALLED');
  }

  const prosthetic = state.entities[installedId];
  const massRemoved = prosthetic?.prostheticSpec?.massGrams ?? 0;

  const surgicalSafe = hasSurgicalBonus(state, actor);
  const bloodLoss = surgicalSafe ? 0 : 15;
  const nextBlood = Math.max(0, actor.anatomy.bloodVolumePct - bloodLoss);
  const removedStrain = prosthetic?.prostheticSpec?.activeAbility ? 35 : 20;

  const { installedProstheticEntityId: _removed, ...restLimb } = targetLimb;
  const updatedActor: EntityRecord = {
    ...actor,
    anatomy: {
      ...actor.anatomy,
      bloodVolumePct: nextBlood,
      strainLoadKw: Math.max(0, (actor.anatomy.strainLoadKw ?? 0) - removedStrain),
      limbs: {
        ...actor.anatomy.limbs,
        [slot]: restLimb,
      },
    },
    inventory: actor.inventory
      ? {
          ...actor.inventory,
          currentMassGrams: Math.max(0, actor.inventory.currentMassGrams - massRemoved),
        }
      : undefined,
  };

  let nextState: WorldState = {
    ...state,
    entities: { ...state.entities, [actorId]: updatedActor },
  };

  const events: SimEvent[] = [
    {
      type: 'PROSTHETIC_REMOVED',
      turn,
      actorId,
      prostheticEntityId: installedId,
      slot,
    },
  ];

  const defeatRes = resolveActorDefeatIfFatal(nextState, actorId);
  if (defeatRes.defeated) {
    nextState = defeatRes.state;
    events.push(...defeatRes.events);
  }

  return {
    state: nextState,
    apSpent: 120,
    events,
  };
}

export function decrementProstheticCooldowns(state: WorldState, actorId: EntityId): WorldState {
  const actor = state.entities[actorId];
  if (!actor?.anatomy) return state;
  let updatedEntities: Record<string, EntityRecord> | undefined;
  for (const limb of Object.values(actor.anatomy.limbs)) {
    const pId = limb?.installedProstheticEntityId;
    if (!pId) continue;
    const p = (updatedEntities ?? state.entities)[pId];
    if (p?.prostheticSpec?.activeAbility && p.prostheticSpec.activeAbility.cooldownRemaining > 0) {
      if (!updatedEntities) updatedEntities = { ...state.entities };
      updatedEntities[pId] = {
        ...p,
        prostheticSpec: {
          ...p.prostheticSpec,
          activeAbility: {
            ...p.prostheticSpec.activeAbility,
            cooldownRemaining: Math.max(0, p.prostheticSpec.activeAbility.cooldownRemaining - 1),
          },
        },
      };
    }
  }
  return updatedEntities ? { ...state, entities: updatedEntities } : state;
}

export function resolveActivateProsthetic(
  state: WorldState,
  actorId: EntityId,
  slot: LimbSlotId,
  direction?: { dx: number; dy: number },
  target?: Point3D,
  targetEntityId?: EntityId,
): SystemAnatomyResult {
  const actor = state.entities[actorId];
  const turn = state.turnCount + 1;
  if (!actor || !actor.anatomy) return failProsthetic(state, actorId, slot, 'MISSING_ANATOMY');

  const limb = actor.anatomy.limbs[slot];
  const pId = limb?.installedProstheticEntityId;
  if (!limb || !pId) return failProsthetic(state, actorId, slot, 'NO_PROSTHETIC_INSTALLED');

  const prosthetic = state.entities[pId];
  if (!prosthetic?.prostheticSpec) return failProsthetic(state, actorId, slot, 'PROSTHETIC_NOT_FOUND');

  const ability = prosthetic.prostheticSpec.activeAbility;
  if (!ability) return failProsthetic(state, actorId, slot, 'NO_ACTIVE_ABILITY');

  const capacity = actor.anatomy.governorCapacityKw ?? 100;
  const strain = actor.anatomy.strainLoadKw ?? 0;
  if (strain > capacity) {
    return {
      state,
      apSpent: STANDARD_ACTION_AP,
      events: [{ type: 'GOVERNOR_OVERLOADED', turn, actorId, governorCapacityKw: capacity, strainLoadKw: strain }],
    };
  }

  if (ability.cooldownRemaining > 0) return failProsthetic(state, actorId, slot, 'ABILITY_ON_COOLDOWN');
  if (actor.anatomy.steamReserveKpa < ability.steamCost) return failProsthetic(state, actorId, slot, 'INSUFFICIENT_STEAM');

  const updatedProsthetic: EntityRecord = {
    ...prosthetic,
    prostheticSpec: {
      ...prosthetic.prostheticSpec,
      activeAbility: { ...ability, cooldownRemaining: ability.cooldownTurns },
    },
  };
  const updatedActor: EntityRecord = {
    ...actor,
    anatomy: { ...actor.anatomy, steamReserveKpa: Math.max(0, actor.anatomy.steamReserveKpa - ability.steamCost) },
  };

  let workingState: WorldState = {
    ...state,
    entities: { ...state.entities, [pId]: updatedProsthetic, [actorId]: updatedActor },
  };
  const events: SimEvent[] = [{
    type: 'PROSTHETIC_ACTIVATED',
    turn,
    actorId,
    slot,
    abilityId: ability.id,
    steamCost: ability.steamCost,
  }];

  const dir = direction ?? { dx: 1, dy: 0 };
  const effect = executeProstheticAbility(workingState, updatedActor, ability.id, turn, dir, target, targetEntityId);
  workingState = effect.state;
  events.push(...effect.events);
  return { state: workingState, apSpent: STANDARD_ACTION_AP, events };
}
