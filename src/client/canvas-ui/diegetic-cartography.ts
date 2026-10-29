import { FactionId } from '../../schemas/primitives.schema.js';
import { TurfSectorRecord } from '../../schemas/skirmish-records.schema.js';
import { WorldState } from '../../sim/core/world.js';
import { UiCellBuffer } from './cell-buffer.js';
import { renderCommodityTickerTable } from './commodity-ticker-table.js';
import { drawIndustrialFrame } from './industrial-primitives.js';
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

  const shouldWrapFrame = rect.width >= 60 || rect.x > 0;
  if (shouldWrapFrame) {
    drawIndustrialFrame(buf, rect, {
      tier: 'PRIMARY_IRON',
      title: '═[ COMMODITY EXCHANGE & TREASURY ]═',
    });
  }

  const innerRect = shouldWrapFrame
    ? { x: rect.x + 2, y: rect.y + 2, width: rect.width - 4, height: rect.height - 4 }
    : rect;

  const isWidescreen = innerRect.width >= 66;
  const mapWidth = isWidescreen ? 36 : Math.min(innerRect.width - 24, 28);
  const legendX = innerRect.x + mapWidth + 1;
  const colW = Math.floor(mapWidth / 2);
  const rowH = Math.floor(innerRect.height / 2);

  // 1. Draw 2x2 sector matrix in map area
  for (let idx = 0; idx < Math.min(4, sectors.length); idx++) {
    const sector = sectors[idx]!;
    const gridCol = idx % 2;
    const gridRow = Math.floor(idx / 2);
    const blockX = innerRect.x + gridCol * colW;
    const blockY = innerRect.y + gridRow * rowH;
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
    buf.writeString(legendX, innerRect.y, '═[ FACTION CONTAMINATION ]═', VICTORIAN_PALETTE.TARNISHED_BRASS, VICTORIAN_PALETTE.SOOT_IRON_BG);

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
    let legendY = innerRect.y + 2;
    for (const fid of factionKeys) {
      const vis = FACTION_VISUALS[fid];
      const count = factionTally[fid];
      const pct = Math.round((count / Math.max(1, sectors.length)) * 100);
      buf.writeString(legendX, legendY, `[${vis.glyph}] ${vis.name.padEnd(14, ' ')}: ${pct.toString().padStart(2, ' ')}%`, vis.fg, VICTORIAN_PALETTE.SOOT_IRON_BG);
      legendY += 2;
    }
  } else {
    // Widescreen: Divider & Commodity Exchange Ticker
    const dividerX = innerRect.x + 39;
    const rightX = innerRect.x + 41;
    const rightWidth = Math.min(38, innerRect.width - 43);

    for (let dy = innerRect.y; dy < innerRect.y + innerRect.height; dy++) {
      buf.setCell(dividerX, dy, '│', VICTORIAN_PALETTE.MUTED_PIPE, VICTORIAN_PALETTE.SOOT_IRON_BG);
    }

    renderCommodityTickerTable(
      buf,
      { x: rightX, y: innerRect.y, width: rightWidth, height: innerRect.height },
      state,
    );
  }
}
