import { EntityRecord } from '../../schemas/components.schema.js';
import { SimEvent } from '../../schemas/events.schema.js';
import { EntityId } from '../../schemas/primitives.schema.js';
import { STANDARD_ACTION_AP } from '../core/scheduler.js';
import { WorldState } from '../core/world.js';
import { allocateSplitId, withoutPosition } from './inventory-utils.js';

export interface NpcEcologyResult {
  readonly state: WorldState;
  readonly events: SimEvent[];
  readonly apSpent: number;
  readonly handled: boolean;
}

export function restockAdjacentPedestal(state: WorldState, merchant: EntityRecord): NpcEcologyResult | undefined {
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
    let stockedItemId: EntityId;

    if (remainingQty > 0) {
      const splitId = allocateSplitId(state, itemId);
      nextEntities[itemId] = { ...itemEnt, item: { ...itemEnt.item, quantity: remainingQty } };
      nextEntities[splitId] = withoutPosition({
        ...itemEnt,
        id: splitId,
        item: { ...itemEnt.item, quantity: 1 },
      });
      stockedItemId = splitId;
    } else {
      nextEntities[itemId] = withoutPosition({
        ...itemEnt,
        item: { ...itemEnt.item, quantity: 1 },
      });
      stockedItemId = itemId;
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
        itemEntityId: stockedItemId,
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

export function simulateNpcSleepHealing(state: WorldState, actor: EntityRecord): WorldState {
  if (!actor.anatomy) return state;
  const currentBlood = actor.anatomy.bloodVolumePct;
  const newBlood = Math.min(100, currentBlood + 2);

  const newLimbs = { ...actor.anatomy.limbs };
  for (const [slot, limb] of Object.entries(newLimbs)) {
    if (limb && !limb.amputated && limb.hp < limb.maxHp) {
      newLimbs[slot as keyof typeof newLimbs] = {
        ...limb,
        hp: Math.min(limb.maxHp, limb.hp + 5),
      };
    }
  }

  return {
    ...state,
    entities: {
      ...state.entities,
      [actor.id]: {
        ...actor,
        anatomy: {
          ...actor.anatomy,
          bloodVolumePct: newBlood,
          limbs: newLimbs,
        },
      },
    },
  };
}

export function simulateNpcWorkProduction(state: WorldState, actor: EntityRecord): WorldState {
  if (!actor.position) return state;
  const actorPos = actor.position;

  let consumed = false;
  const nextEntities = { ...state.entities };

  for (const ent of Object.values(state.entities)) {
    if (!ent.position || ent.position.stratum !== actorPos.stratum || ent.id === actor.id) continue;
    const dist = Math.max(Math.abs(ent.position.x - actorPos.x), Math.abs(ent.position.y - actorPos.y));
    if (dist > 1) continue;

    const isWorkshopFixture = ent.workbench !== undefined || ent.furniture !== undefined || ent.inventory !== undefined;
    if (!isWorkshopFixture || !ent.inventory || ent.inventory.containedEntityIds.length === 0) continue;

    for (const itemId of ent.inventory.containedEntityIds) {
      const itemEnt = nextEntities[itemId];
      if (!itemEnt?.item) continue;
      const isMaterial = itemEnt.item.category === 'MATERIAL' || itemEnt.item.blueprintId.startsWith('mat_');
      if (!isMaterial) continue;

      const remQty = itemEnt.item.quantity - 1;
      if (remQty > 0) {
        nextEntities[itemId] = { ...itemEnt, item: { ...itemEnt.item, quantity: remQty } };
      } else {
        delete nextEntities[itemId];
      }

      const nextContained = remQty > 0
        ? ent.inventory.containedEntityIds
        : ent.inventory.containedEntityIds.filter((id) => id !== itemId);

      nextEntities[ent.id] = {
        ...ent,
        inventory: {
          ...ent.inventory,
          containedEntityIds: nextContained,
          currentMassGrams: Math.max(0, ent.inventory.currentMassGrams - itemEnt.item.massGrams),
        },
      };

      consumed = true;
      break;
    }
    if (consumed) break;
  }

  let nextSafehouses = state.safehouses;
  const targetAnchor = actor.schedule?.workAnchor ?? actorPos;
  for (const [deedId, deed] of Object.entries(state.safehouses)) {
    if (
      deed.stratum === targetAnchor.stratum &&
      targetAnchor.x >= deed.bounds.xMin && targetAnchor.x <= deed.bounds.xMax &&
      targetAnchor.y >= deed.bounds.yMin && targetAnchor.y <= deed.bounds.yMax
    ) {
      nextSafehouses = {
        ...nextSafehouses,
        [deedId]: {
          ...deed,
          productionProgress: (deed.productionProgress ?? 0) + 1,
        },
      };
      break;
    }
  }

  return { ...state, entities: nextEntities, safehouses: nextSafehouses };
}
