import { EntityId } from '../../schemas/primitives.schema.js';
import { WorldState } from '../../sim/core/world.js';
import { findEntitiesAtPoint, getTileCell } from '../../sim/spatial/grid.js';
import { calculateGaslightField } from '../../sim/systems/gaslight.system.js';
import { pointKey } from '../../sim/spatial/fov.js';
import { drawMachinedBezel } from './bezel-composer.js';
import { UiCellBuffer } from './cell-buffer.js';
import { VICTORIAN_PALETTE } from './material-palette.js';
import { UiRect } from './viewport-controls.js';

const METALLIC_TERRAINS = new Set([
  'IRON_GRATE', 'BRASS_CATWALK', 'BRASS_STEAM_PIPE', 'WROUGHT_IRON_FENCE',
  'CANAL_SLUICE', 'CAST_IRON_GRATE', 'SEWER_SLUICE_GATE', 'RAIL_TRACK',
  'CONVEYOR_TRACK', 'COUNTER_BARRIER',
]);
const STONE_TERRAINS = new Set([
  'COBBLESTONE_FLOOR', 'SOOT_BRICK_WALL', 'GOTHIC_COLONNADE', 'DISTRICT_GATE',
  'BRITISH_STONE_PAVER', 'FLAGSTONE_STREET', 'BOARDING_PLATFORM',
]);
const RUBBLE_TERRAINS = new Set([
  'RUBBLE_PILE', 'SLAG_MOUND', 'SLAG_PIT', 'SMASHED_WINDOW_FRAME',
  'SLAG_RUBBLE', 'FACTORY_FLOOR_DEBRIS',
]);
const TIMBER_TERRAINS = new Set([
  'WOODEN_DOOR_CLOSED', 'WOODEN_DOOR_OPEN', 'TIMBER_PIER',
  'ROTTED_WOOD_FLOOR', 'TIMBER_SCAFFOLD',
]);

export function estimateTerrainAcousticDb(terrainType: string): number {
  if (METALLIC_TERRAINS.has(terrainType)) return 82;
  if (STONE_TERRAINS.has(terrainType)) return 68;
  if (RUBBLE_TERRAINS.has(terrainType)) return 75;
  if (TIMBER_TERRAINS.has(terrainType)) return 52;
  return 60;
}

const STRUCTURAL_IRON = new Set([
  'IRON_GRATE', 'BRASS_CATWALK', 'BRASS_STEAM_PIPE', 'WROUGHT_IRON_FENCE',
  'GASLAMP_POST', 'CANAL_SLUICE', 'REINFORCED_FACTORY_WALL', 'CAST_IRON_GRATE',
  'COUNTER_BARRIER', 'CONVEYOR_TRACK', 'RAIL_TRACK',
]);
const VITRIFIED_BRICK = new Set([
  'SOOT_BRICK_WALL', 'GOTHIC_COLONNADE', 'WALL_CROSS', 'WALL_VERTICAL',
  'WALL_HORIZONTAL', 'WALL_CORNER_NW', 'WALL_CORNER_NE', 'WALL_CORNER_SW',
  'WALL_CORNER_SE', 'WALL_TEE_NORTH', 'WALL_TEE_SOUTH', 'WALL_TEE_EAST',
  'WALL_TEE_WEST', 'BRICK_FOUNDATION_WALL', 'BRICK_FOUNDRY_WALL',
]);
const VITRIFIED_STONE = new Set([
  'COBBLESTONE_FLOOR', 'SLAG_MOUND', 'SLAG_PIT', 'BOARDING_PLATFORM',
  'RUBBLE_PILE', 'DISTRICT_GATE', 'BRITISH_STONE_PAVER',
]);
const BRITTLE_SILICA = new Set(['GLASS_WINDOW', 'SMASHED_WINDOW_FRAME']);

export function estimateTerrainHardness(terrainType: string): { rating: string; mohs: number } {
  if (STRUCTURAL_IRON.has(terrainType)) return { rating: 'STRUCTURAL_IRON', mohs: 6.5 };
  if (VITRIFIED_BRICK.has(terrainType)) return { rating: 'VITRIFIED_BRICK', mohs: 7.0 };
  if (VITRIFIED_STONE.has(terrainType)) return { rating: 'VITRIFIED_STONE', mohs: 5.5 };
  if (BRITTLE_SILICA.has(terrainType)) return { rating: 'BRITTLE_SILICA', mohs: 4.0 };
  return { rating: 'COMMERCIAL_TIMBER', mohs: 3.0 };
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
  const maxLen = Math.max(10, width - 3);
  const coordStr = `COORD:(${hoverCoord.x},${hoverCoord.y}) [${stratum}]`.slice(0, maxLen);
  buf.writeString(innerX, currY++, coordStr, VICTORIAN_PALETTE.POLISHED_BRASS);

  const tType = cell?.terrainType ?? 'EMPTY_ABYSS';
  const hardness = estimateTerrainHardness(tType);
  buf.writeString(innerX, currY++, `TERR: ${tType.replace(/_/g, ' ')}`.slice(0, maxLen), '#ecf0f1');
  buf.writeString(innerX, currY++, `MOHS: ${hardness.mohs} Mohs [${hardness.rating.slice(0, 6)}]`.slice(0, maxLen), VICTORIAN_PALETTE.RIVET_STEEL);

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

/**
 * Renders a compact 4-row tactical optical vernier for the sidebar console:
 * Row 0: Coordinates & Stratum
 * Row 1: Terrain name & Mohs hardness
 * Row 2: Soot PPM, Acoustic echo dB, Gaslight status
 * Row 3: Occupying entity summary or Standby prompt
 */
export function renderCompactVernier(
  buf: UiCellBuffer,
  x: number,
  y: number,
  width: number,
  state: Readonly<WorldState>,
  hoverCoord: { x: number; y: number } | null,
  playerId?: EntityId,
): void {
  const maxLen = Math.max(10, width);
  if (!hoverCoord) {
    buf.writeString(x, y, 'VERNIER: STANDBY', VICTORIAN_PALETTE.VERDIGRIS_PATINA);
    buf.writeString(x, y + 1, 'Aim reticle or cursor [L]', VICTORIAN_PALETTE.SEPIA_INK);
    buf.writeString(x, y + 2, 'Caves of Qud Scanner Mk.IV', VICTORIAN_PALETTE.MUTED_PIPE);
    return;
  }

  const pid = playerId ?? ('actor_player' as EntityId);
  const player = state.entities[pid];
  const stratum = player?.position?.stratum ?? 'STREET';
  const grid = state.strata[stratum];
  if (!grid) return;

  const cell = getTileCell(grid, hoverCoord.x, hoverCoord.y);
  const entities = findEntitiesAtPoint(state.entities, { x: hoverCoord.x, y: hoverCoord.y, stratum });
  const gaslightField = calculateGaslightField(state, stratum);
  const isGaslit = (gaslightField.get(pointKey(hoverCoord.x, hoverCoord.y)) ?? 0) > 0.15;

  // Row 0: Coordinates & Stratum
  const coordStr = `COORD:(${hoverCoord.x},${hoverCoord.y}) [${stratum}]`.slice(0, maxLen);
  buf.writeString(x, y, coordStr, VICTORIAN_PALETTE.POLISHED_BRASS);

  // Row 1: Terrain Identity & Hardness
  const tType = cell?.terrainType ?? 'EMPTY';
  const hardness = estimateTerrainHardness(tType);
  const terrStr = `TERR: ${tType.replace(/_/g, ' ').slice(0, 11)} ${hardness.mohs}M`.slice(0, maxLen);
  buf.writeString(x, y + 1, terrStr, '#ecf0f1');

  // Row 2: Atmospheric & Forensic Sensors
  const smokePpm = cell?.smokePpm ?? 0;
  const acousticsDb = estimateTerrainAcousticDb(tType);
  const gasStr = isGaslit ? 'LUM' : 'SHAD';
  const sensorStr = `${smokePpm}PPM · ${acousticsDb}dB · [${gasStr}]`.slice(0, maxLen);
  buf.writeString(x, y + 2, sensorStr, smokePpm > 100 ? VICTORIAN_PALETTE.WARN_RED : VICTORIAN_PALETTE.VERDIGRIS_PATINA);

  // Row 3: Occupying entity
  if (entities.length > 0) {
    const ent = entities[0]!;
    const glyph = ent.visual.glyph;
    const name = ent.name.slice(0, maxLen - 4);
    const color = ent.actor ? (ent.aiController?.hostile ? VICTORIAN_PALETTE.WARN_RED : VICTORIAN_PALETTE.POLISHED_BRASS) : '#bdc3c7';
    buf.writeString(x, y + 3, `${glyph} ${name}`.slice(0, maxLen), color);
  } else {
    buf.writeString(x, y + 3, '<No Occupant on Tile>', VICTORIAN_PALETTE.MUTED_PIPE);
  }
}
