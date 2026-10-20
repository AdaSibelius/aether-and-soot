import { EntityRecord } from '../../schemas/components.schema.js';
import { SimEvent } from '../../schemas/events.schema.js';
import { EntityId, LimbSlotId } from '../../schemas/primitives.schema.js';
import { STANDARD_ACTION_AP } from '../core/scheduler.js';
import { WorldState } from '../core/world.js';
import { resolveActorDefeatIfFatal } from './mortality.system.js';
import { computeProstheticFovBonus, hasSurgicalBonus } from './surgical-context.js';

export { computeProstheticFovBonus };

export interface SystemAnatomyResult {
  readonly state: WorldState;
  readonly events: SimEvent[];
  readonly apSpent: number;
}

type ProstheticFailReason = Extract<SimEvent, { type: 'PROSTHETIC_ACTION_FAILED' }>['reason'];

function failProsthetic(state: WorldState, actorId: EntityId, slot: LimbSlotId, reason: ProstheticFailReason): SystemAnatomyResult {
  return { state, apSpent: STANDARD_ACTION_AP, events: [{ type: 'PROSTHETIC_ACTION_FAILED', turn: state.turnCount + 1, actorId, slot, reason }] };
}

export function resolveDamageLimb(
  state: WorldState,
  targetId: EntityId,
  slot: LimbSlotId,
  damage: number,
): SystemAnatomyResult {
  const target = state.entities[targetId];
  const limb = target?.anatomy?.limbs[slot];
  if (!target || !target.anatomy || !limb) {
    return { state, events: [], apSpent: STANDARD_ACTION_AP };
  }

  const remainingHp = Math.max(0, limb.hp - damage);
  const newlyAmputated = remainingHp === 0 && !limb.amputated;
  const turn = state.turnCount + 1;

  const events: SimEvent[] = [
    { type: 'LIMB_DAMAGED', turn, targetId, slot, damage, remainingHp },
  ];

  if (newlyAmputated) {
    events.push({ type: 'LIMB_AMPUTATED', turn, targetId, slot });
  }

  const updatedLimb = {
    ...limb,
    hp: remainingHp,
    amputated: limb.amputated || remainingHp === 0,
  };

  const bloodLoss = newlyAmputated ? 15 : Math.min(10, Math.floor(damage / 4));
  const updatedTarget: EntityRecord = {
    ...target,
    anatomy: {
      ...target.anatomy,
      bloodVolumePct: Math.max(0, target.anatomy.bloodVolumePct - bloodLoss),
      limbs: {
        ...target.anatomy.limbs,
        [slot]: updatedLimb,
      },
    },
  };

  return {
    state: {
      ...state,
      entities: {
        ...state.entities,
        [targetId]: updatedTarget,
      },
    },
    events,
    apSpent: STANDARD_ACTION_AP,
  };
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

  const updatedActor: EntityRecord = {
    ...actor,
    anatomy: {
      ...actor.anatomy,
      bloodVolumePct: nextBlood,
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

  const { installedProstheticEntityId: _removed, ...restLimb } = targetLimb;
  const updatedActor: EntityRecord = {
    ...actor,
    anatomy: {
      ...actor.anatomy,
      bloodVolumePct: nextBlood,
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

export { resolveRefillSteam } from './boiler-stoking.system.js';

