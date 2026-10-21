import { z } from 'zod';
import { CommodityIdSchema, FactionIdSchema } from '../../schemas/primitives.schema.js';
import { SimEvent } from '../../schemas/events.schema.js';
import { CommodityId, FactionId } from '../../schemas/primitives.schema.js';
import { STANDARD_ACTION_AP } from '../core/scheduler.js';
import { WorldState } from '../core/world.js';

export const CommodityQuoteSchema = z.object({
  commodity: CommodityIdSchema,
  basePricePence: z.number().int().positive(),
  currentPricePence: z.number().int().positive(),
  supplyUnits: z.number().int().nonnegative(),
  demandUnits: z.number().int().positive(),
});
export type CommodityQuote = z.infer<typeof CommodityQuoteSchema>;

export const PedestalListingSchema = z.object({
  commodity: CommodityIdSchema,
  quantity: z.number().int().positive(),
  askingPriceMarkupPct: z.number().min(-50).max(100),
});
export type PedestalListing = z.infer<typeof PedestalListingSchema>;

export const DistrictEconomyLedgerSchema = z.object({
  playerTreasuryPence: z.number().int().nonnegative(),
  factionReputation: z.record(FactionIdSchema, z.number().int().min(-100).max(100)),
  marketQuotes: z.record(CommodityIdSchema, CommodityQuoteSchema),
  storefrontListings: z.array(PedestalListingSchema),
});
export type DistrictEconomyLedger = z.infer<typeof DistrictEconomyLedgerSchema>;

export function createInitialEconomyLedger(): DistrictEconomyLedger {
  return {
    playerTreasuryPence: 240,
    factionReputation: {
      IRONMONGERS_CARTEL: 10,
      CLOCKWORK_GUILD: 15,
      UNDERCROFT_SYNDICATE: 0,
      CROWN_CONSTABULARY: 5,
    },
    marketQuotes: {
      ANTHRACITE_COAL: {
        commodity: 'ANTHRACITE_COAL',
        basePricePence: 24,
        currentPricePence: 24,
        supplyUnits: 100,
        demandUnits: 100,
      },
      PHOSPHOR_BRONZE: {
        commodity: 'PHOSPHOR_BRONZE',
        basePricePence: 110,
        currentPricePence: 110,
        supplyUnits: 60,
        demandUnits: 60,
      },
      AETHER_VIAL: {
        commodity: 'AETHER_VIAL',
        basePricePence: 180,
        currentPricePence: 180,
        supplyUnits: 40,
        demandUnits: 40,
      },
      CLOCKWORK_MAINSPRING: {
        commodity: 'CLOCKWORK_MAINSPRING',
        basePricePence: 85,
        currentPricePence: 85,
        supplyUnits: 75,
        demandUnits: 75,
      },
    },
    storefrontListings: [],
  };
}

/**
 * Computes bounded equilibrium price in pence from supply/demand ratio.
 * Clamped to [0.35x, 3.5x] of basePricePence to prevent runaway hyperinflation or 0-price bugs.
 */
export function computeBoundedPricePence(
  basePricePence: number,
  supplyUnits: number,
  demandUnits: number,
): number {
  const safeSupply = Math.max(10, supplyUnits);
  const ratio = demandUnits / safeSupply;
  const clampedMultiplier = Math.max(0.35, Math.min(3.5, ratio));
  return Math.max(1, Math.round(basePricePence * clampedMultiplier));
}

export function resolveStockPedestal(
  state: WorldState,
  commodity: CommodityId,
  quantity: number,
  askingPriceMarkupPct: number,
): { state: WorldState; events: SimEvent[]; apSpent: number } {
  const ledger = state.economy;
  const existingIdx = ledger.storefrontListings.findIndex((l) => l.commodity === commodity);
  const nextListings = [...ledger.storefrontListings];

  if (existingIdx >= 0) {
    const prev = nextListings[existingIdx]!;
    nextListings[existingIdx] = {
      commodity,
      quantity: prev.quantity + quantity,
      askingPriceMarkupPct,
    };
  } else {
    nextListings.push({
      commodity,
      quantity,
      askingPriceMarkupPct,
    });
  }

  return {
    state: {
      ...state,
      economy: {
        ...ledger,
        storefrontListings: nextListings,
      },
    },
    apSpent: STANDARD_ACTION_AP,
    events: [
      {
        type: 'PEDESTAL_STOCKED',
        turn: state.turnCount + 1,
        commodity,
        quantity,
      },
    ],
  };
}

export function resolveTriggerSupplyShock(
  state: WorldState,
  commodity: CommodityId,
  supplyDelta: number,
  factionAffected: FactionId,
  reputationDelta: number,
): { state: WorldState; events: SimEvent[]; apSpent: number } {
  const ledger = state.economy;
  const quote = ledger.marketQuotes[commodity];
  if (!quote) {
    return { state, events: [], apSpent: STANDARD_ACTION_AP };
  }

  const nextSupply = Math.max(10, Math.min(400, quote.supplyUnits + supplyDelta));
  const newPricePence = computeBoundedPricePence(
    quote.basePricePence,
    nextSupply,
    quote.demandUnits,
  );

  const prevRep = ledger.factionReputation[factionAffected] ?? 0;
  const newReputation = Math.max(-100, Math.min(100, prevRep + reputationDelta));

  return {
    state: {
      ...state,
      economy: {
        ...ledger,
        factionReputation: {
          ...ledger.factionReputation,
          [factionAffected]: newReputation,
        },
        marketQuotes: {
          ...ledger.marketQuotes,
          [commodity]: {
            ...quote,
            supplyUnits: nextSupply,
            currentPricePence: newPricePence,
          },
        },
      },
    },
    apSpent: STANDARD_ACTION_AP,
    events: [
      {
        type: 'SUPPLY_SHOCK_TRIGGERED',
        turn: state.turnCount + 1,
        commodity,
        newPricePence,
        factionAffected,
        newReputation,
      },
    ],
  };
}

/**
 * Executed on every District Macro-Tick (100 turns).
 * Mean-reverts commodity supply/demand with bounded random fluctuation and resolves
 * player storefront display pedestal sales based on faction reputation and markup.
 */

export { advanceDistrictEconomyMacroTick } from './economy-macro.system.js';
