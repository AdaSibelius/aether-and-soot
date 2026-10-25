import { EntityId } from '../../schemas/primitives.schema.js';
import { WorldState } from '../../sim/core/world.js';
import { findEntitiesAtPoint, getTileCell } from '../../sim/spatial/grid.js';
import { calculateGaslightField } from '../../sim/systems/gaslight.system.js';
import { pointKey } from '../../sim/spatial/fov.js';
import { drawMachinedBezel } from './bezel-composer.js';
import { UiCellBuffer } from './cell-buffer.js';
import { VICTORIAN_PALETTE } from './material-palette.js';
import { UiRect } from './viewport-controls.js';

export function estimateTerrainAcousticDb(terrainType: string): number {
  switch (terrainType) {
    case 'IRON_GRATE':
    case 'CAST_IRON_GRATE':
    case 'SEWER_SLUICE_GATE':
      return 82; // Resonant metallic reverberation
    case 'COBBLESTONE_FLOOR':
    case 'BRITISH_STONE_PAVER':
    case 'FLAGSTONE_STREET':
      return 68; // Hard stone clatter
    case 'SLAG_RUBBLE':
      return 75;
    case 'WOODEN_DOOR_CLOSED':
    case 'WOODEN_DOOR_OPEN':
    case 'ROTTED_WOOD_FLOOR':
    case 'TIMBER_SCAFFOLD':
      return 52; // Muffled timber creak
    case 'FACTORY_FLOOR_DEBRIS':
      return 74; // Scrap metal crunch
    default:
      return 60;
  }
}

export function estimateTerrainHardness(terrainType: string): { rating: string; mohs: number } {
  switch (terrainType) {
    case 'REINFORCED_FACTORY_WALL':
    case 'IRON_GRATE':
    case 'CAST_IRON_GRATE':
      return { rating: 'STRUCTURAL_IRON', mohs: 6.5 };
    case 'BRICK_FOUNDATION_WALL':
    case 'BRICK_FOUNDRY_WALL':
      return { rating: 'VITRIFIED_BRICK', mohs: 7.0 };
    case 'COBBLESTONE_FLOOR':
    case 'BRITISH_STONE_PAVER':
      return { rating: 'VITRIFIED_STONE', mohs: 5.5 };
    case 'GLASS_WINDOW':
      return { rating: 'BRITTLE_SILICA', mohs: 4.0 };
    default:
      return { rating: 'COMMERCIAL_TIMBER', mohs: 3.0 };
  }
}

/**
 * High-density tactical optical vernier inspection panel, rendering tile physics,
 * atmospheric particulate PPM, acoustics reverberation dB, and mechanical structural metrics.
 */
export function renderTacticalVernierDossier(
  buf: UiCellBuffer,
  rect: UiRect,
  state: Readonly<WorldState>,
  hoverCoord: { x: number; y: number } | null,
  playerActorId?: EntityId,
): void {
  drawMachinedBezel(buf, rect, {
    title: 'OPTICAL VERNIER',
    subtitle: 'VERNIER MK. IV',
    rivetStyle: 'BRASS_BOLTS',
  });

  const { x, y, width } = rect;
  const innerX = x + 2;
  let currY = y + 1;

  if (!hoverCoord) {
    buf.writeString(innerX, currY, 'VERNIER: STANDBY', VICTORIAN_PALETTE.VERDIGRIS_PATINA);
    buf.writeString(innerX, currY + 1, 'Aim reticle or cursor [L]', VICTORIAN_PALETTE.SEPIA_INK);
    return;
  }

  const pid = playerActorId ?? ('actor_player' as EntityId);
  const player = state.entities[pid];
  const stratum = player?.position?.stratum ?? 'STREET';
  const grid = state.strata[stratum];
  if (!grid) return;

  const cell = getTileCell(grid, hoverCoord.x, hoverCoord.y);
  const entities = findEntitiesAtPoint(state.entities, { x: hoverCoord.x, y: hoverCoord.y, stratum });
  const gaslightField = calculateGaslightField(state, stratum);
  const isGaslit = (gaslightField.get(pointKey(hoverCoord.x, hoverCoord.y)) ?? 0) > 0.15;

  // 1. Coordinates and Terrain Identity
  const maxLen = Math.max(10, width - 4);
  const coordStr = `COORD:(${hoverCoord.x},${hoverCoord.y}) [${stratum}]`.slice(0, maxLen);
  buf.writeString(innerX, currY++, coordStr, VICTORIAN_PALETTE.POLISHED_BRASS);

  const tType = cell?.terrainType ?? 'EMPTY_ABYSS';
  const hardness = estimateTerrainHardness(tType);
  buf.writeString(innerX, currY++, `SURF: ${tType.replace(/_/g, ' ')}`.slice(0, maxLen), '#ecf0f1');
  buf.writeString(innerX, currY++, `HARD: ${hardness.mohs} Mohs [${hardness.rating.slice(0, 6)}]`.slice(0, maxLen), VICTORIAN_PALETTE.RIVET_STEEL);

  // 2. Atmospheric & Forensic Sensor Data
  const smokePpm = cell?.smokePpm ?? 0;
  const steamKpa = Math.round(cell?.steamPressureKpa ?? 0);
  const coalDust = Math.round((cell?.coalDustDensity ?? 0) * 100);
  const acousticsDb = estimateTerrainAcousticDb(tType);

  buf.writeString(innerX, currY++, `SOOT CONC: ${smokePpm} PPM${smokePpm > 100 ? ' ⚠' : ''}`.slice(0, maxLen), smokePpm > 100 ? VICTORIAN_PALETTE.WARN_RED : VICTORIAN_PALETTE.SEPIA_INK);
  buf.writeString(innerX, currY++, `THERMAL:   ${steamKpa} kPa Steam`.slice(0, maxLen), steamKpa > 50 ? VICTORIAN_PALETTE.COPPER_ACCENT : VICTORIAN_PALETTE.SEPIA_INK);
  buf.writeString(innerX, currY++, `COAL DUST: ${coalDust}% Density`.slice(0, maxLen), coalDust > 25 ? VICTORIAN_PALETTE.WARN_RED : VICTORIAN_PALETTE.SEPIA_INK);
  buf.writeString(innerX, currY++, `ACOUSTIC:  ${acousticsDb} dB Echo`.slice(0, maxLen), VICTORIAN_PALETTE.VERDIGRIS_PATINA);
  buf.writeString(innerX, currY++, `GASLIGHT:  ${isGaslit ? 'LUMINESCENT' : 'SHADOWED'}`.slice(0, maxLen), isGaslit ? '#f39c12' : '#7f8c8d');

  // 3. Occupying Entities
  if (entities.length > 0 && currY < y + rect.height - 1) {
    for (const ent of entities.slice(0, 2)) {
      if (currY >= y + rect.height - 1) break;
      const glyph = ent.visual.glyph;
      const name = ent.name.slice(0, maxLen - 3);
      const color = ent.actor ? (ent.aiController?.hostile ? VICTORIAN_PALETTE.WARN_RED : VICTORIAN_PALETTE.POLISHED_BRASS) : '#bdc3c7';
      buf.writeString(innerX, currY++, `${glyph} ${name}`, color);
    }
  }
}
