import { EntityRecord } from '../../schemas/components.schema.js';
import { SimEvent } from '../../schemas/events.schema.js';
import { EntityId, LimbSlotId, Point3D } from '../../schemas/primitives.schema.js';
import { STANDARD_ACTION_AP } from '../core/scheduler.js';
import { WorldState } from '../core/world.js';
import { SystemAnatomyResult } from './anatomy.system.js';
import { executeProstheticAbility } from './prosthetic-abilities.system.js';
import { failProsthetic } from './prosthetics.system.js';

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
