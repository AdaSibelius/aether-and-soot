import { EntityRecord } from '../../schemas/components.schema.js';
import { SimEvent } from '../../schemas/events.schema.js';
import { EntityId, LimbSlotId } from '../../schemas/primitives.schema.js';
import { STANDARD_ACTION_AP } from '../core/scheduler.js';
import { WorldState } from '../core/world.js';

export interface SystemAnatomyResult {
  readonly state: WorldState;
  readonly events: SimEvent[];
  readonly apSpent: number;
}

/**
 * Computes effective FOV bonus granted by installed optic prosthetics.
 */
export function computeProstheticFovBonus(state: Readonly<WorldState>, actor: EntityRecord): number {
  if (!actor.anatomy) return 0;
  let bonus = 0;
  for (const limb of Object.values(actor.anatomy.limbs)) {
    if (!limb?.installedProstheticEntityId) continue;
    const item = state.entities[limb.installedProstheticEntityId];
    if (item?.prostheticSpec) {
      bonus += item.prostheticSpec.fovRadiusBonus;
    }
  }
  return bonus;
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
  if (!actor || !actor.anatomy) {
    return {
      state,
      apSpent: STANDARD_ACTION_AP,
      events: [{ type: 'PROSTHETIC_ACTION_FAILED', turn, actorId, slot, reason: 'MISSING_ANATOMY' }],
    };
  }

  const prosthetic = state.entities[prostheticEntityId];
  if (!prosthetic || !prosthetic.prostheticSpec) {
    return {
      state,
      apSpent: STANDARD_ACTION_AP,
      events: [
        { type: 'PROSTHETIC_ACTION_FAILED', turn, actorId, slot, reason: 'PROSTHETIC_NOT_FOUND' },
      ],
    };
  }

  if (prosthetic.prostheticSpec.targetLimbSlot !== slot) {
    return {
      state,
      apSpent: STANDARD_ACTION_AP,
      events: [{ type: 'PROSTHETIC_ACTION_FAILED', turn, actorId, slot, reason: 'SLOT_MISMATCH' }],
    };
  }

  const targetLimb = actor.anatomy.limbs[slot];
  if (!targetLimb || targetLimb.installedProstheticEntityId) {
    return {
      state,
      apSpent: STANDARD_ACTION_AP,
      events: [
        { type: 'PROSTHETIC_ACTION_FAILED', turn, actorId, slot, reason: 'SLOT_ALREADY_OCCUPIED' },
      ],
    };
  }

  const updatedActor: EntityRecord = {
    ...actor,
    anatomy: {
      ...actor.anatomy,
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

  return {
    state: {
      ...state,
      entities: {
        ...state.entities,
        [actorId]: updatedActor,
      },
    },
    apSpent: 150,
    events: [
      {
        type: 'PROSTHETIC_INSTALLED',
        turn,
        actorId,
        prostheticEntityId,
        slot,
      },
    ],
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
    return {
      state,
      apSpent: STANDARD_ACTION_AP,
      events: [
        {
          type: 'PROSTHETIC_ACTION_FAILED',
          turn,
          actorId,
          slot,
          reason: 'NO_PROSTHETIC_INSTALLED',
        },
      ],
    };
  }

  const prosthetic = state.entities[installedId];
  const massRemoved = prosthetic?.prostheticSpec?.massGrams ?? 0;

  const { installedProstheticEntityId: _removed, ...restLimb } = targetLimb;
  const updatedActor: EntityRecord = {
    ...actor,
    anatomy: {
      ...actor.anatomy,
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

  return {
    state: {
      ...state,
      entities: {
        ...state.entities,
        [actorId]: updatedActor,
      },
    },
    apSpent: 120,
    events: [
      {
        type: 'PROSTHETIC_REMOVED',
        turn,
        actorId,
        prostheticEntityId: installedId,
        slot,
      },
    ],
  };
}

export { resolveRefillSteam } from './boiler-stoking.system.js';

