import { EntityRecord } from '../../schemas/components.schema.js';
import { SimEvent } from '../../schemas/events.schema.js';
import { CommodityId, EntityId } from '../../schemas/primitives.schema.js';
import { STANDARD_ACTION_AP } from '../core/scheduler.js';
import { WorldState } from '../core/world.js';

const DEFAULT_ITEM_PRICE_PENCE = 25;

const BASE_ITEM_PRICES_PENCE: Record<string, number> = {
  mat_brass_gears: 15,
  mat_vulcanized_rubber: 12,
  mat_aether_salt: 20,
  mat_cast_iron_plate: 18,
  item_coagulant_tonic: 35,
  item_pressurized_steam_canister: 40,
  prosthetic_pneumatic_leg_mk1: 120,
  prosthetic_clockwork_ocular_lens: 90,
  commodity_anthracite_briquette: 24,
  commodity_phosphor_bronze_ingot: 110,
};

export function getItemBasePricePence(state: Readonly<WorldState>, entity: EntityRecord): number {
  if (entity.item?.commodityId && state.economy.marketQuotes[entity.item.commodityId]) {
    return state.economy.marketQuotes[entity.item.commodityId]!.currentPricePence;
  }
  const bpId = entity.item?.blueprintId ?? entity.prostheticSpec?.blueprintId;
  if (bpId && BASE_ITEM_PRICES_PENCE[bpId]) {
    return BASE_ITEM_PRICES_PENCE[bpId]!;
  }
  return DEFAULT_ITEM_PRICE_PENCE;
}

export function isAdjacent(a: EntityRecord, b: EntityRecord): boolean {
  if (!a.position || !b.position) return false;
  if (a.position.stratum !== b.position.stratum) return false;
  return Math.max(Math.abs(a.position.x - b.position.x), Math.abs(a.position.y - b.position.y)) <= 1;
}

export function createTradeFailure(
  state: WorldState,
  actorId: EntityId,
  action: 'BUY' | 'SELL' | 'STOCK_PEDESTAL',
  reason: Extract<SimEvent, { type: 'TRADE_ACTION_FAILED' }>['reason'],
  merchantId?: EntityId,
) {
  return {
    state,
    events: [
      {
        type: 'TRADE_ACTION_FAILED' as const,
        turn: state.turnCount + 1,
        actorId,
        merchantId,
        action,
        reason,
      },
    ],
    apSpent: STANDARD_ACTION_AP,
  };
}

export function computeBuyUnitPrice(
  state: Readonly<WorldState>,
  merchant: EntityRecord,
  entity: EntityRecord,
): number {
  const basePrice = getItemBasePricePence(state, entity);
  const factionId = merchant.aiController?.factionId;
  const rep = factionId ? (state.economy.factionReputation[factionId] ?? 0) : 0;
  let multiplier = 1;
  if (rep > 0) {
    multiplier = 1 - Math.min(0.25, (rep / 100) * 0.25);
  } else if (rep < 0) {
    multiplier = 1 + Math.min(0.5, (-rep / 100) * 0.5);
  }
  return Math.max(1, Math.round(basePrice * multiplier));
}

export function computeSellUnitPrice(
  state: Readonly<WorldState>,
  merchant: EntityRecord,
  entity: EntityRecord,
): number {
  const basePrice = getItemBasePricePence(state, entity);
  const factionId = merchant.aiController?.factionId;
  const rep = factionId ? (state.economy.factionReputation[factionId] ?? 0) : 0;
  let bonus = 0;
  let penalty = 0;
  if (rep > 0) {
    bonus = (rep / 100) * 0.25;
  } else if (rep < 0) {
    penalty = (-rep / 100) * 0.4;
  }
  const multiplier = 0.6 * (1 + bonus - penalty);
  return Math.max(1, Math.round(basePrice * multiplier));
}

export function matchesCommodity(entity: EntityRecord, commodity: CommodityId): boolean {
  if (entity.item?.commodityId === commodity) return true;
  const bp = (entity.item?.blueprintId ?? '').toLowerCase();
  const cid = commodity.toLowerCase();
  if (cid === 'anthracite_coal' && bp.includes('anthracite')) return true;
  if (cid === 'phosphor_bronze' && bp.includes('phosphor_bronze')) return true;
  if (cid === 'aether_vial' && bp.includes('aether')) return true;
  if (cid === 'clockwork_mainspring' && bp.includes('mainspring')) return true;
  return false;
}
