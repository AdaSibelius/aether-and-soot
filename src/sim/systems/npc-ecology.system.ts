import { EntityRecord } from '../../schemas/components.schema.js';
import { SimEvent } from '../../schemas/events.schema.js';
import { EntityId } from '../../schemas/primitives.schema.js';
import { STANDARD_ACTION_AP } from '../core/scheduler.js';
import { getShiftPhase, WorldState } from '../core/world.js';
import { resolveUseItem } from './inventory.system.js';
import { resolveMoveStep } from './movement.system.js';

export interface NpcEcologyResult {
  readonly state: WorldState;
  readonly events: SimEvent[];
  readonly apSpent: number;
  readonly handled: boolean;
}

function findNearestMedicalFixture(state: WorldState, actor: EntityRecord): EntityRecord | undefined {
  if (!actor.position) return undefined;
  let nearest: EntityRecord | undefined;
  let minDist = Infinity;
  for (const e of Object.values(state.entities)) {
    if (e.id === actor.id || !e.position || e.position.stratum !== actor.position.stratum) continue;
    const isMedical = e.aiController?.role === 'CHIRURGEON' || e.furniture?.kind === 'SURGICAL_TABLE';
    if (!isMedical) continue;
    const dist = Math.max(Math.abs(e.position.x - actor.position.x), Math.abs(e.position.y - actor.position.y));
    if (dist < minDist) {
      minDist = dist;
      nearest = e;
    }
  }
  return nearest;
}

function restockAdjacentPedestal(state: WorldState, merchant: EntityRecord): NpcEcologyResult | undefined {
  if (!merchant.position || !merchant.inventory || merchant.inventory.containedEntityIds.length === 0) return undefined;
  const merchantPos = merchant.position;

  for (const ent of Object.values(state.entities)) {
    if (!ent.position || ent.position.stratum !== merchantPos.stratum) continue;
    const dist = Math.max(Math.abs(ent.position.x - merchantPos.x), Math.abs(ent.position.y - merchantPos.y));
    if (dist > 1) continue;

    const isPedestal = ent.tradePedestal !== undefined || ent.id.includes('pedestal') || ent.name.toLowerCase().includes('pedestal');
    if (!isPedestal) continue;
    const isEmpty = !ent.tradePedestal || (!ent.tradePedestal.itemEntityId && !ent.tradePedestal.commodityId);
    if (!isEmpty) continue;

    const itemId = merchant.inventory.containedEntityIds[0];
    if (!itemId) continue;
    const itemEnt = state.entities[itemId];
    if (!itemEnt?.item) continue;

    const remainingQty = itemEnt.item.quantity - 1;
    const nextEntities = { ...state.entities };
    if (remainingQty > 0) {
      nextEntities[itemId] = { ...itemEnt, item: { ...itemEnt.item, quantity: remainingQty } };
    } else {
      delete nextEntities[itemId];
    }

    const nextContained = remainingQty > 0
      ? merchant.inventory.containedEntityIds
      : merchant.inventory.containedEntityIds.filter((id) => id !== itemId);

    nextEntities[merchant.id] = {
      ...merchant,
      inventory: {
        ...merchant.inventory,
        containedEntityIds: nextContained,
        currentMassGrams: Math.max(0, merchant.inventory.currentMassGrams - itemEnt.item.massGrams),
      },
    };

    nextEntities[ent.id] = {
      ...ent,
      tradePedestal: {
        itemEntityId: itemId,
        commodityId: itemEnt.item.commodityId,
        pricePence: itemEnt.item.penceValue ?? 10,
      },
    };

    return {
      state: { ...state, entities: nextEntities },
      events: [{
        type: 'PEDESTAL_STOCKED',
        turn: state.turnCount + 1,
        commodity: itemEnt.item.commodityId ?? 'ANTHRACITE_COAL',
        quantity: 1,
      }],
      apSpent: STANDARD_ACTION_AP,
      handled: true,
    };
  }
  return undefined;
}

/**
 * Executes autonomous diurnal ecology, self-medication, and shift-clock routines for an NPC.
 */
export function resolveNpcEcologyAction(state: WorldState, actorId: EntityId): NpcEcologyResult {
  const actor = state.entities[actorId];
  if (!actor?.actor || actor.actor.isPlayer || !actor.position) {
    return { state, events: [], apSpent: 0, handled: false };
  }

  // (a) Auto-medication: consume blood tonic if blood <= 60%
  if (actor.anatomy && actor.anatomy.bloodVolumePct <= 60 && actor.inventory) {
    const tonicId = actor.inventory.containedEntityIds.find((id) => {
      const it = state.entities[id];
      return it?.item?.useEffect?.kind === 'RESTORE_BLOOD';
    });
    if (tonicId) {
      const useRes = resolveUseItem(state, actor.id, tonicId);
      return { state: useRes.state, events: useRes.events, apSpent: useRes.apSpent, handled: true };
    }
  }

  // (b) Medical triage: if blood <= 50% without tonics, path toward nearest chirurgeon / surgical table
  if (actor.anatomy && actor.anatomy.bloodVolumePct <= 50) {
    const medTarget = findNearestMedicalFixture(state, actor);
    let workingState = state;
    if (actor.schedule && actor.schedule.currentGoal !== 'SEEK_MEDICAL') {
      workingState = {
        ...state,
        entities: {
          ...state.entities,
          [actor.id]: { ...actor, schedule: { ...actor.schedule, currentGoal: 'SEEK_MEDICAL' } },
        },
      };
    }
    if (medTarget?.position) {
      const dist = Math.max(Math.abs(medTarget.position.x - actor.position.x), Math.abs(medTarget.position.y - actor.position.y));
      if (dist > 1) {
        const dx = Math.sign(medTarget.position.x - actor.position.x);
        const dy = Math.sign(medTarget.position.y - actor.position.y);
        const moveRes = resolveMoveStep(workingState, actor.id, dx, dy);
        return { state: moveRes.state, events: moveRes.events, apSpent: moveRes.apSpent, handled: true };
      }
      return { state: workingState, events: [], apSpent: STANDARD_ACTION_AP, handled: true };
    }
  }

  // (c) Diurnal Shift Ecology: GRAVEYARD_WATCH vs FOUNDRY_SHIFT
  if (!actor.schedule) {
    return { state, events: [], apSpent: 0, handled: false };
  }

  const shift = getShiftPhase(state.turnCount);
  const isGuard = actor.aiController?.role === 'GUARD';

  if (shift === 'GRAVEYARD_WATCH' && !isGuard) {
    const restAnchor = actor.schedule.restAnchor;
    const workingState = actor.schedule.currentGoal !== 'REST'
      ? { ...state, entities: { ...state.entities, [actor.id]: { ...actor, schedule: { ...actor.schedule, currentGoal: 'REST' as const } } } }
      : state;

    if (actor.position.stratum === restAnchor.stratum) {
      if (actor.position.x !== restAnchor.x || actor.position.y !== restAnchor.y) {
        const dx = Math.sign(restAnchor.x - actor.position.x);
        const dy = Math.sign(restAnchor.y - actor.position.y);
        const moveRes = resolveMoveStep(workingState, actor.id, dx, dy);
        return { state: moveRes.state, events: moveRes.events, apSpent: moveRes.apSpent, handled: true };
      }
      return { state: workingState, events: [], apSpent: STANDARD_ACTION_AP, handled: true };
    }
  }

  if (shift === 'FOUNDRY_SHIFT') {
    // Merchants restock adjacent empty trade pedestals first
    if (actor.aiController?.role === 'MERCHANT') {
      const restockRes = restockAdjacentPedestal(state, actor);
      if (restockRes) return restockRes;
    }

    const workAnchor = actor.schedule.workAnchor;
    const workingState = actor.schedule.currentGoal !== 'WORK'
      ? { ...state, entities: { ...state.entities, [actor.id]: { ...actor, schedule: { ...actor.schedule, currentGoal: 'WORK' as const } } } }
      : state;

    if (actor.position.stratum === workAnchor.stratum) {
      if (actor.position.x !== workAnchor.x || actor.position.y !== workAnchor.y) {
        const dx = Math.sign(workAnchor.x - actor.position.x);
        const dy = Math.sign(workAnchor.y - actor.position.y);
        const moveRes = resolveMoveStep(workingState, actor.id, dx, dy);
        return { state: moveRes.state, events: moveRes.events, apSpent: moveRes.apSpent, handled: true };
      }
      return { state: workingState, events: [], apSpent: STANDARD_ACTION_AP, handled: true };
    }
  }

  return { state, events: [], apSpent: 0, handled: false };
}
