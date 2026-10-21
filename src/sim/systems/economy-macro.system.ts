import { SimEvent } from '../../schemas/events.schema.js';
import { CommodityId } from '../../schemas/primitives.schema.js';
import { SeededRNG } from '../core/rng.js';
import { WorldState } from '../core/world.js';
import { CommodityQuote, PedestalListing, DistrictEconomyLedger, computeBoundedPricePence } from './economy.system.js';

export function advanceDistrictEconomyMacroTick(
  state: WorldState,
  rng: SeededRNG,
  turn: number,
): { economy: DistrictEconomyLedger; events: SimEvent[] } {
  const ledger = state.economy;
  const nextQuotes: Record<string, CommodityQuote> = { ...ledger.marketQuotes };
  const commodities: CommodityId[] = [
    'ANTHRACITE_COAL',
    'PHOSPHOR_BRONZE',
    'AETHER_VIAL',
    'CLOCKWORK_MAINSPRING',
  ];

  for (const cid of commodities) {
    const q = nextQuotes[cid];
    if (!q) continue;

    // Mean-revert supply toward demand + small deterministic jitter [-4, +4]
    const reversionStep = Math.round((q.demandUnits - q.supplyUnits) * 0.18);
    const jitter = rng.nextInt(-4, 4);
    const nextSupply = Math.max(15, Math.min(300, q.supplyUnits + reversionStep + jitter));
    const nextPrice = computeBoundedPricePence(q.basePricePence, nextSupply, q.demandUnits);

    nextQuotes[cid] = {
      ...q,
      supplyUnits: nextSupply,
      currentPricePence: nextPrice,
    };
  }

  // Evaluate player storefront display listings
  const avgRep =
    ((ledger.factionReputation.IRONMONGERS_CARTEL ?? 0) +
      (ledger.factionReputation.CLOCKWORK_GUILD ?? 0) +
      (ledger.factionReputation.CROWN_CONSTABULARY ?? 0)) /
    3;

  let nextTreasury = ledger.playerTreasuryPence;
  const remainingListings: PedestalListing[] = [];
  const saleEvents: SimEvent[] = [];

  for (const listing of ledger.storefrontListings) {
    const quote = nextQuotes[listing.commodity];
    if (!quote || listing.quantity <= 0) continue;

    // Customers buy if markup is reasonable relative to faction reputation
    const maxAcceptableMarkup = 25 + Math.floor(avgRep * 0.5);
    if (listing.askingPriceMarkupPct <= maxAcceptableMarkup) {
      const unitsSold = Math.min(listing.quantity, Math.max(1, rng.nextInt(1, 3)));
      const unitSalePrice = Math.max(
        1,
        Math.round(quote.currentPricePence * (1 + listing.askingPriceMarkupPct / 100)),
      );
      const revenuePence = unitsSold * unitSalePrice;
      nextTreasury += revenuePence;

      saleEvents.push({
        type: 'STOREFRONT_SALE_COMPLETED',
        turn,
        commodity: listing.commodity,
        unitsSold,
        revenuePence,
      });

      const leftOver = listing.quantity - unitsSold;
      if (leftOver > 0) {
        remainingListings.push({
          ...listing,
          quantity: leftOver,
        });
      }
    } else {
      remainingListings.push(listing);
    }
  }

  return {
    economy: {
      ...ledger,
      playerTreasuryPence: nextTreasury,
      marketQuotes: nextQuotes,
      storefrontListings: remainingListings,
    },
    events: saleEvents,
  };
}
