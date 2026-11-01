import { SimEvent } from '../../schemas/events.schema.js';
import { CommodityId, EntityId, EntityIdSchema } from '../../schemas/primitives.schema.js';
import { STANDARD_ACTION_AP } from '../core/scheduler.js';
import { WorldState } from '../core/world.js';
import { allocateSplitId, withoutPosition } from './inventory-utils.js';
import { createTradeFailure, matchesCommodity } from './trade-pricing.js';

export function resolveStockPedestal(
  state: WorldState,
  commodity: CommodityId,
  quantity: number,
  askingPriceMarkupPct: number,
  actorId: EntityId = EntityIdSchema.parse('actor_player'),
  strict = true,
): { state: WorldState; events: SimEvent[]; apSpent: number } {
  const actor = state.entities[actorId];
  if (strict && (!actor?.inventory || quantity <= 0)) {
    return createTradeFailure(state, actorId, 'STOCK_PEDESTAL', 'INSUFFICIENT_COMMODITY');
  }

  const nextEntities = { ...state.entities };
  let consumedUnits = 0;
  let stockedItemEntityId: EntityId | undefined;

  const nearbyPedestal = actor?.position
    ? Object.values(state.entities).find((e) => {
        if (!e.position || e.position.stratum !== actor.position!.stratum) return false;
        const d = Math.max(Math.abs(e.position.x - actor.position!.x), Math.abs(e.position.y - actor.position!.y));
        return d <= 1 && (e.tradePedestal !== undefined || e.id.includes('pedestal') || e.name.toLowerCase().includes('pedestal'));
      })
    : undefined;

  if (actor?.inventory) {
    const matchingIds = actor.inventory.containedEntityIds.filter((id) => {
      const e = nextEntities[id];
      return e && matchesCommodity(e, commodity);
    });

    const totalAvailable = matchingIds.reduce((sum, id) => {
      const e = nextEntities[id];
      return sum + (e?.item?.quantity ?? 0);
    }, 0);

    if (strict && totalAvailable < quantity) {
      return createTradeFailure(state, actorId, 'STOCK_PEDESTAL', 'INSUFFICIENT_COMMODITY');
    }

    let remainingNeeded = quantity;
    let nextContained = [...actor.inventory.containedEntityIds];
    let massRemoved = 0;

    for (const id of matchingIds) {
      if (remainingNeeded <= 0) break;
      const entity = nextEntities[id];
      if (!entity?.item) continue;

      const take = Math.min(remainingNeeded, entity.item.quantity);
      consumedUnits += take;
      remainingNeeded -= take;
      massRemoved += entity.item.massGrams * take;

      if (entity.item.quantity === take) {
        nextContained = nextContained.filter((cid) => cid !== id);
        if (nearbyPedestal && !stockedItemEntityId) {
          stockedItemEntityId = id;
          nextEntities[id] = withoutPosition({ ...entity, item: { ...entity.item, quantity: take } });
        } else {
          delete nextEntities[id];
        }
      } else {
        nextEntities[id] = {
          ...entity,
          item: { ...entity.item, quantity: entity.item.quantity - take },
        };
        if (nearbyPedestal && !stockedItemEntityId) {
          const splitId = allocateSplitId(state, id);
          stockedItemEntityId = splitId;
          nextEntities[splitId] = withoutPosition({ ...entity, id: splitId, item: { ...entity.item, quantity: take } });
        }
      }
    }

    if (consumedUnits > 0) {
      nextEntities[actorId] = {
        ...actor,
        inventory: {
          ...actor.inventory,
          containedEntityIds: nextContained,
          currentMassGrams: Math.max(0, actor.inventory.currentMassGrams - massRemoved),
        },
      };
    }
  }

  if (strict && consumedUnits === 0) {
    return createTradeFailure(state, actorId, 'STOCK_PEDESTAL', 'INSUFFICIENT_COMMODITY');
  }

  const finalStockQty = consumedUnits > 0 ? consumedUnits : quantity;
  const ledger = state.economy;
  const quote = ledger.marketQuotes[commodity];
  const basePrice = quote?.currentPricePence ?? 20;
  const askingPricePence = Math.max(1, Math.round(basePrice * (1 + askingPriceMarkupPct / 100)));

  if (nearbyPedestal) {
    nextEntities[nearbyPedestal.id] = {
      ...nearbyPedestal,
      tradePedestal: {
        ...nearbyPedestal.tradePedestal,
        ...(stockedItemEntityId ? { itemEntityId: stockedItemEntityId } : {}),
        commodityId: commodity,
        pricePence: askingPricePence,
      },
    };
  }

  const existingIdx = ledger.storefrontListings.findIndex((l) => l.commodity === commodity);
  const nextListings = [...ledger.storefrontListings];

  if (existingIdx >= 0) {
    const prev = nextListings[existingIdx]!;
    nextListings[existingIdx] = {
      commodity,
      quantity: prev.quantity + finalStockQty,
      askingPriceMarkupPct,
    };
  } else {
    nextListings.push({
      commodity,
      quantity: finalStockQty,
      askingPriceMarkupPct,
    });
  }

  return {
    state: {
      ...state,
      entities: nextEntities,
      economy: {
        ...ledger,
        storefrontListings: nextListings,
      },
    },
    events: [
      {
        type: 'PEDESTAL_STOCKED',
        turn: state.turnCount + 1,
        commodity,
        quantity: finalStockQty,
      },
    ],
    apSpent: STANDARD_ACTION_AP,
  };
}
