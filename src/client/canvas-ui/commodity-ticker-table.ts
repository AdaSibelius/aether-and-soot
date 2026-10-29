import { CommodityId } from '../../schemas/primitives.schema.js';
import { WorldState } from '../../sim/core/world.js';
import { UiCellBuffer } from './cell-buffer.js';
import { VICTORIAN_PALETTE } from './material-palette.js';
import { UiRect } from './viewport-controls.js';

export const COMMODITY_SHORT_NAMES: Record<string, string> = {
  ANTHRACITE_COAL: 'Anthracite',
  PHOSPHOR_BRONZE: 'Phosphor Brz',
  AETHER_SALT: 'Aether Salt',
  VULCANIZED_RUBBER: 'Rubber Resin',
  BRASS_GEAR_STOCK: 'Brass Gears',
  AETHER_VIAL: 'Aether Vial',
  CLOCKWORK_MAINSPRING: 'Clockwork Spr',
};

/**
 * Renders live commodity market quotes, player treasury ledger, broker counter,
 * and metropolitan faction standing for widescreen exchange screens.
 */
export function renderCommodityTickerTable(
  buf: UiCellBuffer,
  rect: UiRect,
  state: Readonly<WorldState>,
): void {
  const { x, y, width } = rect;

  buf.writeString(x, y, '═[ COMMODITY EXCHANGE & TREASURY ]═'.slice(0, width), VICTORIAN_PALETTE.TARNISHED_BRASS, VICTORIAN_PALETTE.SOOT_IRON_BG);

  const treasury = state.economy?.playerTreasuryPence ?? 240;
  buf.writeString(x, y + 2, `Player Treasury: ${treasury}d (${Math.floor(treasury / 12)}s ${treasury % 12}d)`.slice(0, width), VICTORIAN_PALETTE.AMBER_GASLIGHT, VICTORIAN_PALETTE.SOOT_IRON_BG);

  buf.writeString(x, y + 4, '─[ LIVE COMMODITY QUOTES ]──────────'.slice(0, width), VICTORIAN_PALETTE.TARNISHED_BRASS, VICTORIAN_PALETTE.SOOT_IRON_BG);
  buf.writeString(x, y + 5, 'COMMODITY       PRICE   SUPPLY  TREND'.slice(0, width), VICTORIAN_PALETTE.MUTED_PIPE, VICTORIAN_PALETTE.SOOT_IRON_BG);

  const quotes = Object.values(state.economy?.marketQuotes ?? {});
  const quoteRows = quotes.length > 0 ? quotes : [
    { commodity: 'ANTHRACITE_COAL' as CommodityId, basePricePence: 24, currentPricePence: 26, supplyUnits: 120, demandUnits: 85 },
    { commodity: 'PHOSPHOR_BRONZE' as CommodityId, basePricePence: 110, currentPricePence: 108, supplyUnits: 40, demandUnits: 60 },
  ];

  let qY = y + 6;
  for (const q of quoteRows.slice(0, 4)) {
    const diff = q.currentPricePence - q.basePricePence;
    const trend = diff > 0 ? `▲+${diff}d` : diff < 0 ? `▼${diff}d` : '▬ 0d';
    const trendFg = diff > 0 ? VICTORIAN_PALETTE.INCANDESCENT_RED : diff < 0 ? VICTORIAN_PALETTE.AETHER_BLUE : VICTORIAN_PALETTE.SEPIA_INK;
    const comKey = q.commodity as string;
    const rawName = COMMODITY_SHORT_NAMES[comKey] ?? comKey.replace(/_/g, ' ');
    const nameStr = rawName.slice(0, 13).padEnd(13, ' ');
    const priceStr = `${q.currentPricePence}d`.padStart(5, ' ');
    const supStr = `${q.supplyUnits}u`.padStart(7, ' ');
    buf.writeString(x, qY, `${nameStr} ${priceStr} ${supStr}  ${trend}`.slice(0, width), trendFg, VICTORIAN_PALETTE.SOOT_IRON_BG);
    qY++;
  }

  qY++;
  buf.writeString(x, qY, '─[ BROKER COUNTER & PEDESTALS ]─────'.slice(0, width), VICTORIAN_PALETTE.TARNISHED_BRASS, VICTORIAN_PALETTE.SOOT_IRON_BG);
  qY++;
  buf.writeString(x, qY, 'Broker: Spitalfields Guild Clerk'.slice(0, width), VICTORIAN_PALETTE.SEPIA_INK, VICTORIAN_PALETTE.SOOT_IRON_BG);
  qY++;
  buf.writeString(x, qY, 'Trade Rate: 100% Par Value (Tariff)'.slice(0, width), VICTORIAN_PALETTE.MUTED_PIPE, VICTORIAN_PALETTE.SOOT_IRON_BG);
  qY += 2;

  buf.writeString(x, qY, '─[ METROPOLITAN STANDING ]──────────'.slice(0, width), VICTORIAN_PALETTE.TARNISHED_BRASS, VICTORIAN_PALETTE.SOOT_IRON_BG);
  qY++;
  const reps = state.economy?.factionReputation ?? { IRONMONGERS_CARTEL: 10, CLOCKWORK_GUILD: 15, UNDERCROFT_SYNDICATE: 0, CROWN_CONSTABULARY: 5 };
  buf.writeString(x, qY, `Cartel: +${reps.IRONMONGERS_CARTEL ?? 0} | Guild: +${reps.CLOCKWORK_GUILD ?? 0}`.slice(0, width), VICTORIAN_PALETTE.SEPIA_INK, VICTORIAN_PALETTE.SOOT_IRON_BG);
  qY++;
  buf.writeString(x, qY, `Syndicate: ${reps.UNDERCROFT_SYNDICATE ?? 0} | Crown: +${reps.CROWN_CONSTABULARY ?? 0}`.slice(0, width), VICTORIAN_PALETTE.SEPIA_INK, VICTORIAN_PALETTE.SOOT_IRON_BG);
}
