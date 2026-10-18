import { SimEvent } from '../../schemas/events.schema.js';
import { EntityId } from '../../schemas/primitives.schema.js';
import { STANDARD_ACTION_AP } from '../core/scheduler.js';
import { WorldState } from '../core/world.js';
import {
  allocateSplitId,
  computeCarriedVolumeMl,
  findMergeableStack,
  getCarryProfile,
  MAX_OVERLOAD_RATIO,
  withoutPosition,
} from './inventory-utils.js';
import { computeBuyUnitPrice, createTradeFailure, isAdjacent } from './trade-pricing.js';

export function resolveBuyFromMerchant(
  state: WorldState,
  actorId: EntityId,
  merchantId: EntityId,
  itemEntityId: EntityId,
  requestedQuantity?: number,
): { state: WorldState; events: SimEvent[]; apSpent: number } {
  const actor = state.entities[actorId];
  if (!actor?.inventory) return createTradeFailure(state, actorId, 'BUY', 'NO_INVENTORY', merchantId);

  const merchant = state.entities[merchantId];
  if (!merchant) return createTradeFailure(state, actorId, 'BUY', 'MERCHANT_NOT_FOUND', merchantId);
  if (merchant.aiController?.role !== 'MERCHANT') {
    return createTradeFailure(state, actorId, 'BUY', 'NOT_A_MERCHANT', merchantId);
  }

  const factionId = merchant.aiController?.factionId;
  const rep = factionId ? (state.economy.factionReputation[factionId] ?? 0) : 0;
  if (merchant.aiController?.hostile || rep <= -30) {
    return createTradeFailure(state, actorId, 'BUY', 'MERCHANT_HOSTILE', merchantId);
  }

  if (!isAdjacent(actor, merchant)) {
    return createTradeFailure(state, actorId, 'BUY', 'OUT_OF_RANGE', merchantId);
  }

  if (!merchant.inventory?.containedEntityIds.includes(itemEntityId)) {
    return createTradeFailure(state, actorId, 'BUY', 'ITEM_NOT_FOUND', merchantId);
  }

  const itemEntity = state.entities[itemEntityId];
  if (!itemEntity || (!itemEntity.item && !itemEntity.prostheticSpec)) {
    return createTradeFailure(state, actorId, 'BUY', 'ITEM_NOT_FOUND', merchantId);
  }

  const availableQuantity = itemEntity.item?.quantity ?? 1;
  const quantity = Math.min(requestedQuantity ?? 1, availableQuantity);
  const unitPrice = computeBuyUnitPrice(state, merchant, itemEntity);
  const totalCost = unitPrice * quantity;

  if (state.economy.playerTreasuryPence < totalCost) {
    return createTradeFailure(state, actorId, 'BUY', 'INSUFFICIENT_FUNDS', merchantId);
  }

  const profile = getCarryProfile(itemEntity);
  const unitMass = itemEntity.item ? itemEntity.item.massGrams : (profile?.massGrams ?? 0);
  const unitVol = itemEntity.item ? itemEntity.item.volumeMl : (profile?.volumeMl ?? 0);
  const addedMass = unitMass * quantity;
  const addedVol = unitVol * quantity;

  if (computeCarriedVolumeMl(state, actor.inventory) + addedVol > actor.inventory.maxVolumeMl) {
    return createTradeFailure(state, actorId, 'BUY', 'VOLUME_EXCEEDED', merchantId);
  }
  if (
    actor.inventory.currentMassGrams + addedMass >
    actor.inventory.maxMassGrams * MAX_OVERLOAD_RATIO
  ) {
    return createTradeFailure(state, actorId, 'BUY', 'MASS_EXCEEDED', merchantId);
  }

  const nextEntities = { ...state.entities };
  const nextMerchantInv = { ...merchant.inventory, containedEntityIds: [...merchant.inventory.containedEntityIds] };
  const nextActorInv = { ...actor.inventory, containedEntityIds: [...actor.inventory.containedEntityIds] };

  const isPartial = Boolean(itemEntity.item && itemEntity.item.quantity > quantity);
  if (isPartial && itemEntity.item) {
    nextEntities[itemEntityId] = {
      ...itemEntity,
      item: { ...itemEntity.item, quantity: itemEntity.item.quantity - quantity },
    };
    nextMerchantInv.currentMassGrams = Math.max(0, nextMerchantInv.currentMassGrams - addedMass);
  } else {
    nextMerchantInv.containedEntityIds = nextMerchantInv.containedEntityIds.filter(
      (id) => id !== itemEntityId,
    );
    nextMerchantInv.currentMassGrams = Math.max(0, nextMerchantInv.currentMassGrams - addedMass);
  }

  const mergeTarget = findMergeableStack(state, nextActorInv, itemEntity);
  if (mergeTarget?.item) {
    nextEntities[mergeTarget.id] = {
      ...mergeTarget,
      item: { ...mergeTarget.item, quantity: mergeTarget.item.quantity + quantity },
    };
    nextActorInv.currentMassGrams += addedMass;
    if (!isPartial) {
      delete nextEntities[itemEntityId];
    }
  } else if (isPartial && itemEntity.item) {
    const newId = allocateSplitId(state, itemEntityId);
    nextEntities[newId] = withoutPosition({
      ...itemEntity,
      id: newId,
      item: { ...itemEntity.item, quantity },
    });
    nextActorInv.containedEntityIds.push(newId);
    nextActorInv.currentMassGrams += addedMass;
  } else {
    nextEntities[itemEntityId] = withoutPosition(itemEntity);
    nextActorInv.containedEntityIds.push(itemEntityId);
    nextActorInv.currentMassGrams += addedMass;
  }

  nextEntities[actorId] = { ...actor, inventory: nextActorInv };
  nextEntities[merchantId] = { ...merchant, inventory: nextMerchantInv };

  const nextTreasury = state.economy.playerTreasuryPence - totalCost;

  return {
    state: {
      ...state,
      entities: nextEntities,
      economy: { ...state.economy, playerTreasuryPence: nextTreasury },
    },
    events: [
      {
        type: 'MERCHANT_TRADE_COMPLETED',
        turn: state.turnCount + 1,
        actorId,
        merchantId,
        tradeType: 'BUY',
        itemEntityId,
        itemName: itemEntity.name,
        quantity,
        totalPence: totalCost,
        playerTreasuryAfter: nextTreasury,
      },
    ],
    apSpent: STANDARD_ACTION_AP,
  };
}
