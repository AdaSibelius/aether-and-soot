import { EntityRecord } from '../../schemas/components.schema.js';
import { BlueprintId, BlueprintIdSchema, StratumId } from '../../schemas/primitives.schema.js';
import { WorldState } from '../../sim/core/world.js';
import { getTileCell, isWithinBounds, StratumGrid } from '../../sim/spatial/grid.js';
import { METROPOLIS_DISTRICT_DOSSIERS } from '../../sim/spatial/overworld-matrix.js';
import { generateVictorianDistrict } from '../../sim/spatial/generator.js';
import { resolveDistrictBiome, resolveBiomeTerrainVisual } from './biome-palette.js';
import { resolveExtendedConnectingWallGlyph } from './extended-box-drawing.js';
import { buildCellLayers, composeLayersToVisualSpec, RenderCellLayers } from './layer-projection.js';
import type { RenderCellFrame } from './frame-adapter.js';

export interface NeighborCoordinateMapping {
  readonly neighborDistrictId: BlueprintId;
  readonly neighborX: number;
  readonly neighborY: number;
}

const RING_FALLBACK: Readonly<Record<string, { west: string; east: string }>> = {
  district_spitalfields_soot_works: { west: 'district_fleet_ditch_undercroft', east: 'district_belgravia_brass_spires' },
  district_fleet_ditch_undercroft: { west: 'district_whitechapel_ward', east: 'district_spitalfields_soot_works' },
  district_whitechapel_ward: { west: 'district_fleet_ditch_undercroft', east: 'district_limehouse_docks' },
  district_limehouse_docks: { west: 'district_whitechapel_ward', east: 'district_belgravia_brass_spires' },
  district_belgravia_brass_spires: { west: 'district_limehouse_docks', east: 'district_spitalfields_soot_works' },
};

const LOOKAHEAD_CACHE = new Map<string, { grid: StratumGrid; entities?: Record<string, EntityRecord> }>();

function findPlanarNeighbor(districtId: string, dCol: number, dRow: number): BlueprintId | undefined {
  const here = METROPOLIS_DISTRICT_DOSSIERS[districtId]?.macroCoords;
  if (!here) return undefined;
  for (const [id, dossier] of Object.entries(METROPOLIS_DISTRICT_DOSSIERS)) {
    if (dossier.macroCoords.col === here.col + dCol && dossier.macroCoords.row === here.row + dRow) {
      return BlueprintIdSchema.parse(id);
    }
  }
  return undefined;
}

/** Resolves planar neighbor and translates world coordinates beyond current district boundaries. */
export function mapCoordinateToNeighbor(
  currentDistrictId: BlueprintId,
  worldX: number,
  worldY: number,
  currentWidth: number,
  currentHeight: number,
): NeighborCoordinateMapping | undefined {
  let dCol = 0;
  let dRow = 0;

  if (worldX < 0) dCol = -1;
  else if (worldX >= currentWidth) dCol = 1;

  if (worldY < 0) dRow = -1;
  else if (worldY >= currentHeight) dRow = 1;

  if (dCol === 0 && dRow === 0) return undefined;

  let neighborIdStr: string | undefined = findPlanarNeighbor(currentDistrictId, dCol, dRow);
  if (!neighborIdStr && dRow === 0) {
    neighborIdStr = dCol < 0 ? RING_FALLBACK[currentDistrictId]?.west : RING_FALLBACK[currentDistrictId]?.east;
  }
  if (!neighborIdStr) return undefined;

  const neighborDistrictId = BlueprintIdSchema.parse(neighborIdStr);
  const neighborX = dCol < 0 ? currentWidth + worldX : dCol > 0 ? worldX - currentWidth : worldX;
  const neighborY = dRow < 0 ? currentHeight + worldY : dRow > 0 ? worldY - currentHeight : worldY;

  return { neighborDistrictId, neighborX, neighborY };
}

/** Retrieves the stratum grid for a neighboring district (from savedDistricts or memoized lookahead cache). */
export function getNeighborDistrictStratumGrid(
  state: Readonly<WorldState>,
  neighborDistrictId: BlueprintId,
  stratum: StratumId,
): { grid: StratumGrid; entities?: Record<string, EntityRecord> } | undefined {
  const savedDistrict = state.savedDistricts[neighborDistrictId];
  if (savedDistrict) {
    const grid = savedDistrict.strata[stratum];
    if (grid) return { grid, entities: savedDistrict.entities };
  }

  const cacheKey = `${state.seed}:${neighborDistrictId}:${stratum}`;
  const cached = LOOKAHEAD_CACHE.get(cacheKey);
  if (cached) return cached;

  const gen = generateVictorianDistrict({ ...state, currentDistrictId: neighborDistrictId });
  const grid = gen.state.strata[stratum];
  if (!grid) return undefined;

  const entry = { grid, entities: gen.state.entities };
  if (LOOKAHEAD_CACHE.size >= 16) {
    const firstKey = LOOKAHEAD_CACHE.keys().next().value;
    if (firstKey) LOOKAHEAD_CACHE.delete(firstKey);
  }
  LOOKAHEAD_CACHE.set(cacheKey, entry);
  return entry;
}

/** Resolves an out-of-bounds cell into a continuous cityscape RenderCellFrame with atmospheric fogging. */
export function resolveContinuousLookaheadCell(
  state: Readonly<WorldState>,
  activeStratum: StratumId,
  worldX: number,
  worldY: number,
  currentWidth: number,
  currentHeight: number,
  vx: number,
  vy: number,
): RenderCellFrame | undefined {
  const mapping = mapCoordinateToNeighbor(state.currentDistrictId, worldX, worldY, currentWidth, currentHeight);
  if (!mapping) return undefined;

  const neighborData = getNeighborDistrictStratumGrid(state, mapping.neighborDistrictId, activeStratum);
  if (!neighborData) return undefined;

  const { grid: neighborGrid } = neighborData;
  if (!isWithinBounds(neighborGrid, mapping.neighborX, mapping.neighborY)) return undefined;

  const tile = getTileCell(neighborGrid, mapping.neighborX, mapping.neighborY);
  if (!tile) return undefined;

  const biome = resolveDistrictBiome(mapping.neighborDistrictId, activeStratum);
  const connectingWall = resolveExtendedConnectingWallGlyph(neighborGrid, mapping.neighborX, mapping.neighborY);
  const baseVisual = resolveBiomeTerrainVisual(tile.terrainType, false, true, biome, connectingWall, tile.steamPressureKpa ?? 0);

  const baseLayers = buildCellLayers(baseVisual, tile.terrainType);
  const layers: RenderCellLayers = {
    floor: { ...baseLayers.floor, alpha: 0.65 },
    ...(baseLayers.fixture ? { fixture: { ...baseLayers.fixture, alpha: 0.65 } } : {}),
  };
  const visual = composeLayersToVisualSpec(layers);

  return {
    x: vx,
    y: vy,
    worldX,
    worldY,
    visual,
    layers,
    visible: false,
    explored: true,
    steamPressureKpa: tile.steamPressureKpa ?? 0,
    coalDustDensity: tile.coalDustDensity ?? 0,
  };
}

/** Resets the lookahead grid cache (for test cleanup). */
export function clearContinuousLookaheadCache(): void {
  LOOKAHEAD_CACHE.clear();
}
