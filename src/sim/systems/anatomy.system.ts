import { EntityRecord } from '../../schemas/components.schema.js';
import { SimEvent } from '../../schemas/events.schema.js';
import { EntityId, LimbSlotId } from '../../schemas/primitives.schema.js';
import { STANDARD_ACTION_AP } from '../core/scheduler.js';
import { WorldState } from '../core/world.js';
import { computeProstheticFovBonus } from './surgical-context.js';

export { computeProstheticFovBonus };

export interface SystemAnatomyResult {
  readonly state: WorldState;
  readonly events: SimEvent[];
  readonly apSpent: number;
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



export { resolveRefillSteam } from './boiler-stoking.system.js';

export { resolveInstallProsthetic, resolveRemoveProsthetic } from './prosthetics.system.js';
