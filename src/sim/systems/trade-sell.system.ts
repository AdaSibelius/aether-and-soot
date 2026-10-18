import { SimEvent } from '../../schemas/events.schema.js';
import { EntityId } from '../../schemas/primitives.schema.js';
import { STANDARD_ACTION_AP } from '../core/scheduler.js';
import { WorldState } from '../core/world.js';
import {
  allocateSplitId,
  getCarryProfile,
  isInstalledOnActor,
  withoutPosition,
} from './inventory-utils.js';
import { computeSellUnitPrice, createTradeFailure, isAdjacent } from './trade-pricing.js';

export function resolveSellToMerchant(
  state: WorldState,
  actorId: EntityId,
  merchantId: EntityId,
  itemEntityId: EntityId,
  requestedQuantity?: number,
): { state: WorldState; events: SimEvent[]; apSpent: number } {
  const actor = state.entities[actorId];
  if (!actor?.inventory) return createTradeFailure(state, actorId, 'SELL', 'NO_INVENTORY', merchantId);

  const merchant = state.entities[merchantId];
  if (!merchant) return createTradeFailure(state, actorId, 'SELL', 'MERCHANT_NOT_FOUND', merchantId);
  if (merchant.aiController?.role !== 'MERCHANT') {
    return createTradeFailure(state, actorId, 'SELL', 'NOT_A_MERCHANT', merchantId);
  }

  const factionId = merchant.aiController?.factionId;
  const rep = factionId ? (state.economy.factionReputation[factionId] ?? 0) : 0;
  if (merchant.aiController?.hostile || rep <= -30) {
    return createTradeFailure(state, actorId, 'SELL', 'MERCHANT_HOSTILE', merchantId);
  }

  if (!isAdjacent(actor, merchant)) {
    return createTradeFailure(state, actorId, 'SELL', 'OUT_OF_RANGE', merchantId);
  }

  if (!actor.inventory.containedEntityIds.includes(itemEntityId)) {
    return createTradeFailure(state, actorId, 'SELL', 'ITEM_NOT_FOUND', merchantId);
  }

  if (isInstalledOnActor(actor, itemEntityId)) {
    return createTradeFailure(state, actorId, 'SELL', 'ITEM_INSTALLED', merchantId);
  }

  const itemEntity = state.entities[itemEntityId];
  if (!itemEntity || (!itemEntity.item && !itemEntity.prostheticSpec)) {
    return createTradeFailure(state, actorId, 'SELL', 'ITEM_NOT_FOUND', merchantId);
  }

  const availableQuantity = itemEntity.item?.quantity ?? 1;
  const quantity = Math.min(requestedQuantity ?? 1, availableQuantity);
  const unitPayout = computeSellUnitPrice(state, merchant, itemEntity);
  const totalPayout = unitPayout * quantity;

  const profile = getCarryProfile(itemEntity);
  const unitMass = itemEntity.item ? itemEntity.item.massGrams : (profile?.massGrams ?? 0);
  const removedMass = unitMass * quantity;

  const nextEntities = { ...state.entities };
  const nextActorInv = { ...actor.inventory, containedEntityIds: [...actor.inventory.containedEntityIds] };
  const nextMerchantInv = merchant.inventory
    ? { ...merchant.inventory, containedEntityIds: [...merchant.inventory.containedEntityIds] }
    : undefined;

  const isPartial = Boolean(itemEntity.item && itemEntity.item.quantity > quantity);
  if (isPartial && itemEntity.item) {
    nextEntities[itemEntityId] = {
      ...itemEntity,
      item: { ...itemEntity.item, quantity: itemEntity.item.quantity - quantity },
    };
    nextActorInv.currentMassGrams = Math.max(0, nextActorInv.currentMassGrams - removedMass);
    if (nextMerchantInv) {
      const splitId = allocateSplitId(state, itemEntityId);
      nextEntities[splitId] = withoutPosition({
        ...itemEntity,
        id: splitId,
        item: { ...itemEntity.item, quantity },
      });
      nextMerchantInv.containedEntityIds.push(splitId);
      nextMerchantInv.currentMassGrams += removedMass;
    }
  } else {
    nextActorInv.containedEntityIds = nextActorInv.containedEntityIds.filter((id) => id !== itemEntityId);
    nextActorInv.currentMassGrams = Math.max(0, nextActorInv.currentMassGrams - removedMass);
    if (nextMerchantInv) {
      nextMerchantInv.containedEntityIds.push(itemEntityId);
      nextMerchantInv.currentMassGrams += removedMass;
    } else {
      delete nextEntities[itemEntityId];
    }
  }

  nextEntities[actorId] = { ...actor, inventory: nextActorInv };
  if (nextMerchantInv) {
    nextEntities[merchantId] = { ...merchant, inventory: nextMerchantInv };
  }

  const nextTreasury = state.economy.playerTreasuryPence + totalPayout;

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
        tradeType: 'SELL',
        itemEntityId,
        itemName: itemEntity.name,
        quantity,
        totalPence: totalPayout,
        playerTreasuryAfter: nextTreasury,
      },
    ],
    apSpent: STANDARD_ACTION_AP,
  };
}
