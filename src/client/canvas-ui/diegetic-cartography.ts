import { CommodityId, FactionId } from '../../schemas/primitives.schema.js';
import { TurfSectorRecord } from '../../schemas/skirmish-records.schema.js';
import { WorldState } from '../../sim/core/world.js';
import { UiCellBuffer } from './cell-buffer.js';
import { VICTORIAN_PALETTE } from './material-palette.js';
import { UiRect } from './viewport-controls.js';

export interface FactionVisualSpec {
  readonly glyph: string;
  readonly secondaryGlyph: string;
  readonly fg: string;
  readonly name: string;
  readonly label: string;
}

export const FACTION_VISUALS: Readonly<Record<FactionId, FactionVisualSpec>> = {
  IRONMONGERS_CARTEL: {
    glyph: '▓',
    secondaryGlyph: '▒',
    fg: '#b9770e',
    name: 'IRON CARTEL',
    label: 'IRON',
  },
  UNDERCROFT_SYNDICATE: {
    glyph: '░',
    secondaryGlyph: '▒',
    fg: '#594928',
    name: 'SYNDICATE',
    label: 'SYND',
  },
  CLOCKWORK_GUILD: {
    glyph: '╬',
    secondaryGlyph: '⚙',
    fg: VICTORIAN_PALETTE.TARNISHED_BRASS,
    name: 'CLOCK GUILD',
    label: 'GUILD',
  },
  CROWN_CONSTABULARY: {
    glyph: '☼',
    secondaryGlyph: '█',
    fg: '#2980b9',
    name: 'CONSTABULARY',
    label: 'CROWN',
  },
};

const DEFAULT_METROPOLIS_SECTORS: readonly TurfSectorRecord[] = [
  {
    turfId: 'turf_soot_smelting',
    districtId: 'district_spitalfields_soot_works',
    name: 'Foundry Smelting Row',
    stratum: 'STREET',
    bounds: { xMin: 0, xMax: 20, yMin: 0, yMax: 20 },
    controllingFactionId: 'IRONMONGERS_CARTEL',
    contested: false,
    controlScores: { IRONMONGERS_CARTEL: 70, CLOCKWORK_GUILD: 30 },
  },
  {
    turfId: 'turf_limehouse_basin',
    districtId: 'district_limehouse_docks',
    name: 'Limehouse Canal Basin',
    stratum: 'STREET',
    bounds: { xMin: 21, xMax: 40, yMin: 0, yMax: 20 },
    controllingFactionId: 'UNDERCROFT_SYNDICATE',
    contested: true,
    controlScores: { UNDERCROFT_SYNDICATE: 55, CROWN_CONSTABULARY: 45 },
  },
  {
    turfId: 'turf_guild_catwalks',
    districtId: 'district_belgravia_spire',
    name: 'Guild Pneumatic Tower',
    stratum: 'SPIRE',
    bounds: { xMin: 0, xMax: 20, yMin: 21, yMax: 40 },
    controllingFactionId: 'CLOCKWORK_GUILD',
    contested: false,
    controlScores: { CLOCKWORK_GUILD: 80, IRONMONGERS_CARTEL: 20 },
  },
  {
    turfId: 'turf_crown_garrison',
    districtId: 'district_whitechapel_ward',
    name: 'Whitechapel Bastion',
    stratum: 'STREET',
    bounds: { xMin: 21, xMax: 40, yMin: 21, yMax: 40 },
    controllingFactionId: 'CROWN_CONSTABULARY',
    contested: false,
    controlScores: { CROWN_CONSTABULARY: 75, UNDERCROFT_SYNDICATE: 25 },
  },
];

export function renderFactionContaminationMap(
  buf: UiCellBuffer,
  rect: UiRect,
  state: Readonly<WorldState>,
  selectedSectorId?: string,
): void {
  const sectors = Object.values(state.turf ?? {}).length > 0
    ? Object.values(state.turf)
    : DEFAULT_METROPOLIS_SECTORS;

  const isWidescreen = rect.width >= 70;
  const mapWidth = isWidescreen ? 36 : Math.min(rect.width - 24, 28);
  const legendX = rect.x + mapWidth + 1;
  const colW = Math.floor(mapWidth / 2);
  const rowH = Math.floor(rect.height / 2);

  // 1. Draw 2x2 sector matrix in map area
  for (let idx = 0; idx < Math.min(4, sectors.length); idx++) {
    const sector = sectors[idx]!;
    const gridCol = idx % 2;
    const gridRow = Math.floor(idx / 2);
    const blockX = rect.x + gridCol * colW;
    const blockY = rect.y + gridRow * rowH;
    const isSelected = selectedSectorId === sector.turfId;

    const factionId = sector.controllingFactionId ?? 'IRONMONGERS_CARTEL';
    const visual = FACTION_VISUALS[factionId] ?? FACTION_VISUALS.IRONMONGERS_CARTEL;
    const borderFg = isSelected ? VICTORIAN_PALETTE.AETHER_BLUE : visual.fg;
    const blockBg = isSelected ? VICTORIAN_PALETTE.OXIDIZED_IRON : VICTORIAN_PALETTE.SOOT_IRON_BG;
    const hitKey = `select_turf:${sector.turfId}`;

    // Sector border
    for (let bx = 0; bx < colW; bx++) {
      buf.setCell(blockX + bx, blockY, bx === 0 ? '┌' : bx === colW - 1 ? '┐' : '─', borderFg, blockBg, undefined, hitKey);
      buf.setCell(blockX + bx, blockY + rowH - 1, bx === 0 ? '└' : bx === colW - 1 ? '┘' : '─', borderFg, blockBg, undefined, hitKey);
    }
    for (let by = 1; by < rowH - 1; by++) {
      buf.setCell(blockX, blockY + by, '│', borderFg, blockBg, undefined, hitKey);
      buf.setCell(blockX + colW - 1, blockY + by, '│', borderFg, blockBg, undefined, hitKey);
    }

    // Interior contamination texture
    for (let by = 1; by < rowH - 1; by++) {
      for (let bx = 1; bx < colW - 1; bx++) {
        const glyph = (bx + by + idx) % 2 === 0 ? visual.glyph : visual.secondaryGlyph;
        const shader = sector.contested ? ['GASLIGHT_BLOOM'] : undefined;
        buf.setCell(blockX + bx, blockY + by, glyph, visual.fg, blockBg, shader, hitKey);
      }
    }

    // Label inside block
    const label = `[ ${visual.label} ]`;
    const labelX = blockX + Math.max(1, Math.floor((colW - label.length) / 2));
    const labelY = blockY + Math.floor(rowH / 2);
    buf.writeString(labelX, labelY, label, VICTORIAN_PALETTE.SOOT_IRON_BG, visual.fg, undefined, hitKey);
  }

  // 2. Right Column (Compact Legend vs Widescreen Commodity Exchange)
  if (!isWidescreen) {
    buf.writeString(legendX, rect.y, '═[ FACTION CONTAMINATION ]═', VICTORIAN_PALETTE.TARNISHED_BRASS, VICTORIAN_PALETTE.SOOT_IRON_BG);

    const factionTally: Record<FactionId, number> = {
      IRONMONGERS_CARTEL: 0,
      UNDERCROFT_SYNDICATE: 0,
      CLOCKWORK_GUILD: 0,
      CROWN_CONSTABULARY: 0,
    };
    for (const s of sectors) {
      if (s.controllingFactionId && s.controllingFactionId in factionTally) {
        factionTally[s.controllingFactionId] += 1;
      }
    }

    const factionKeys: readonly FactionId[] = ['IRONMONGERS_CARTEL', 'UNDERCROFT_SYNDICATE', 'CLOCKWORK_GUILD', 'CROWN_CONSTABULARY'];
    let legendY = rect.y + 2;
    for (const fid of factionKeys) {
      const vis = FACTION_VISUALS[fid];
      const count = factionTally[fid];
      const pct = Math.round((count / Math.max(1, sectors.length)) * 100);
      buf.writeString(legendX, legendY, `[${vis.glyph}] ${vis.name.padEnd(14, ' ')}: ${pct.toString().padStart(2, ' ')}%`, vis.fg, VICTORIAN_PALETTE.SOOT_IRON_BG);
      legendY += 2;
    }
  } else {
    // Widescreen: Divider & Commodity Exchange Ticker
    const dividerX = rect.x + 39;
    const rightX = rect.x + 41;
    const rightWidth = Math.min(38, rect.width - 43);

    for (let dy = rect.y; dy < rect.y + rect.height; dy++) {
      buf.setCell(dividerX, dy, '│', VICTORIAN_PALETTE.MUTED_PIPE, VICTORIAN_PALETTE.SOOT_IRON_BG);
    }

    buf.writeString(rightX, rect.y, '═[ COMMODITY EXCHANGE & TREASURY ]═'.slice(0, rightWidth), VICTORIAN_PALETTE.TARNISHED_BRASS, VICTORIAN_PALETTE.SOOT_IRON_BG);

    const treasury = state.economy?.playerTreasuryPence ?? 240;
    buf.writeString(rightX, rect.y + 2, `Player Treasury: ${treasury}d (${Math.floor(treasury / 12)}s ${treasury % 12}d)`.slice(0, rightWidth), VICTORIAN_PALETTE.AMBER_GASLIGHT, VICTORIAN_PALETTE.SOOT_IRON_BG);

    buf.writeString(rightX, rect.y + 4, '─[ LIVE COMMODITY QUOTES ]──────────'.slice(0, rightWidth), VICTORIAN_PALETTE.TARNISHED_BRASS, VICTORIAN_PALETTE.SOOT_IRON_BG);
    buf.writeString(rightX, rect.y + 5, 'COMMODITY       PRICE   SUPPLY  TREND'.slice(0, rightWidth), VICTORIAN_PALETTE.MUTED_PIPE, VICTORIAN_PALETTE.SOOT_IRON_BG);

    const quotes = Object.values(state.economy?.marketQuotes ?? {});
    const quoteRows = quotes.length > 0 ? quotes : [
      { commodity: 'ANTHRACITE_COAL' as CommodityId, basePricePence: 24, currentPricePence: 26, supplyUnits: 120, demandUnits: 85 },
      { commodity: 'PHOSPHOR_BRONZE' as CommodityId, basePricePence: 110, currentPricePence: 108, supplyUnits: 40, demandUnits: 60 },
    ];

    let qY = rect.y + 6;
    for (const q of quoteRows.slice(0, 4)) {
      const diff = q.currentPricePence - q.basePricePence;
      const trend = diff > 0 ? `▲+${diff}d` : diff < 0 ? `▼${diff}d` : '▬ 0d';
      const trendFg = diff > 0 ? VICTORIAN_PALETTE.INCANDESCENT_RED : diff < 0 ? VICTORIAN_PALETTE.AETHER_BLUE : VICTORIAN_PALETTE.SEPIA_INK;
      const nameStr = (q.commodity as string).replace('_', ' ').slice(0, 14).padEnd(14, ' ');
      const priceStr = `${q.currentPricePence}d`.padStart(5, ' ');
      const supStr = `${q.supplyUnits}u`.padStart(7, ' ');
      buf.writeString(rightX, qY, `${nameStr} ${priceStr} ${supStr}  ${trend}`.slice(0, rightWidth), trendFg, VICTORIAN_PALETTE.SOOT_IRON_BG);
      qY++;
    }

    qY++;
    buf.writeString(rightX, qY, '─[ BROKER COUNTER & PEDESTALS ]─────'.slice(0, rightWidth), VICTORIAN_PALETTE.TARNISHED_BRASS, VICTORIAN_PALETTE.SOOT_IRON_BG);
    qY++;
    buf.writeString(rightX, qY, 'Stationed Broker: Spitalfields Guild Clerk'.slice(0, rightWidth), VICTORIAN_PALETTE.SEPIA_INK, VICTORIAN_PALETTE.SOOT_IRON_BG);
    qY++;
    buf.writeString(rightX, qY, 'Trade Rate: 100% Par Value (Tariff)'.slice(0, rightWidth), VICTORIAN_PALETTE.MUTED_PIPE, VICTORIAN_PALETTE.SOOT_IRON_BG);
    qY += 2;

    buf.writeString(rightX, qY, '─[ METROPOLITAN STANDING ]──────────'.slice(0, rightWidth), VICTORIAN_PALETTE.TARNISHED_BRASS, VICTORIAN_PALETTE.SOOT_IRON_BG);
    qY++;
    const reps = state.economy?.factionReputation ?? { IRONMONGERS_CARTEL: 10, CLOCKWORK_GUILD: 15, UNDERCROFT_SYNDICATE: 0, CROWN_CONSTABULARY: 5 };
    buf.writeString(rightX, qY, `Cartel: +${reps.IRONMONGERS_CARTEL ?? 0} | Guild: +${reps.CLOCKWORK_GUILD ?? 0}`.slice(0, rightWidth), VICTORIAN_PALETTE.SEPIA_INK, VICTORIAN_PALETTE.SOOT_IRON_BG);
    qY++;
    buf.writeString(rightX, qY, `Syndicate: ${reps.UNDERCROFT_SYNDICATE ?? 0} | Crown: +${reps.CROWN_CONSTABULARY ?? 0}`.slice(0, rightWidth), VICTORIAN_PALETTE.SEPIA_INK, VICTORIAN_PALETTE.SOOT_IRON_BG);
  }
}
