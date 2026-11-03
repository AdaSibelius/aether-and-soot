import { BlueprintId, BlueprintIdSchema } from '../../schemas/primitives.schema.js';
import { METROPOLIS_DISTRICT_DOSSIERS, getOverworldBarriersForDistrict } from './overworld-matrix.js';
import { setTileCell, StratumGrid } from './grid.js';

export type SeamType = 'OPEN_STREET' | 'TOLL_ARCH' | 'CANAL_BRIDGE' | 'VIADUCT_ARCH' | 'SOLID_WALL';

export interface EdgeSeamSegment {
  readonly startCoord: number; // Y for West/East edges, X for North/South edges
  readonly endCoord: number;   // Y for West/East edges, X for North/South edges
  readonly seamType: SeamType;
  readonly neighborDistrictId?: BlueprintId;
  readonly description: string;
}

export interface DistrictBoundarySeams {
  readonly districtId: BlueprintId;
  readonly dimensions: { width: number; height: number };
  readonly north: readonly EdgeSeamSegment[];
  readonly south: readonly EdgeSeamSegment[];
  readonly east: readonly EdgeSeamSegment[];
  readonly west: readonly EdgeSeamSegment[];
}

const RING_FALLBACK: Readonly<Record<string, { west?: string; east?: string }>> = {
  district_fleet_ditch_undercroft: { west: 'district_limehouse_docks' },
  district_limehouse_docks: { east: 'district_fleet_ditch_undercroft' },
};

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

function resolveNeighborForDirection(
  districtId: BlueprintId,
  direction: 'north' | 'south' | 'east' | 'west',
): BlueprintId | undefined {
  if (direction === 'north') return findPlanarNeighbor(districtId, 0, -1);
  if (direction === 'south') return findPlanarNeighbor(districtId, 0, 1);
  if (direction === 'west') {
    return findPlanarNeighbor(districtId, -1, 0) ??
      (RING_FALLBACK[districtId]?.west ? BlueprintIdSchema.parse(RING_FALLBACK[districtId]!.west) : undefined);
  }
  if (direction === 'east') {
    return findPlanarNeighbor(districtId, 1, 0) ??
      (RING_FALLBACK[districtId]?.east ? BlueprintIdSchema.parse(RING_FALLBACK[districtId]!.east) : undefined);
  }
  return undefined;
}

function resolveEdgeSeamType(
  districtId: BlueprintId,
  neighborId: BlueprintId,
): { seamType: SeamType; description: string } {
  const barriers = getOverworldBarriersForDistrict(districtId);
  const barrier = barriers.find(
    (b) =>
      (b.fromDistrictId === districtId && b.toDistrictId === neighborId) ||
      (b.fromDistrictId === neighborId && b.toDistrictId === districtId),
  );
  if (!barrier) {
    return { seamType: 'OPEN_STREET', description: 'Open Cobblestone Thoroughfare' };
  }
  switch (barrier.barrierType) {
    case 'THAMES_CANAL':
      return { seamType: 'CANAL_BRIDGE', description: 'Thames Canal Pier Bridge' };
    case 'TOLL_PERIMETER_WALL':
      return { seamType: 'TOLL_ARCH', description: 'Crown Toll Perimeter Gatehouse' };
    case 'VIADUCT':
      return { seamType: 'VIADUCT_ARCH', description: 'Colonnade Viaduct Arch' };
    default:
      return { seamType: 'OPEN_STREET', description: 'Open Thoroughfare' };
  }
}

function buildEdgeSegments(
  districtId: BlueprintId,
  direction: 'north' | 'south' | 'east' | 'west',
  spanLength: number,
): readonly EdgeSeamSegment[] {
  const neighborId = resolveNeighborForDirection(districtId, direction);
  if (!neighborId) {
    return [{ startCoord: 0, endCoord: spanLength - 1, seamType: 'SOLID_WALL', description: 'Solid Border Perimeter' }];
  }

  const centerCoord = Math.floor(spanLength / 2);
  const startCoord = centerCoord - 1;
  const endCoord = centerCoord + 1;
  const { seamType, description } = resolveEdgeSeamType(districtId, neighborId);

  const segments: EdgeSeamSegment[] = [];
  if (startCoord > 0) {
    segments.push({ startCoord: 0, endCoord: startCoord - 1, seamType: 'SOLID_WALL', description: 'Perimeter Wall' });
  }
  segments.push({ startCoord, endCoord, seamType, neighborDistrictId: neighborId, description });
  if (endCoord < spanLength - 1) {
    segments.push({ startCoord: endCoord + 1, endCoord: spanLength - 1, seamType: 'SOLID_WALL', description: 'Perimeter Wall' });
  }
  return segments;
}

/**
 * Computes boundary seam segments for all 4 edges of a district based on 2D overworld planar topology.
 */
export function computeDistrictBoundarySeams(
  districtId: BlueprintId,
  width: number,
  height: number,
): DistrictBoundarySeams {
  return {
    districtId,
    dimensions: { width, height },
    north: buildEdgeSegments(districtId, 'north', width),
    south: buildEdgeSegments(districtId, 'south', width),
    east: buildEdgeSegments(districtId, 'east', height),
    west: buildEdgeSegments(districtId, 'west', height),
  };
}

/**
 * Applies boundary seam segments directly to perimeter cells of a stratum grid.
 */
export function applyBoundarySeamsToGrid(
  grid: StratumGrid,
  seams: DistrictBoundarySeams,
): StratumGrid {
  const { width, height } = grid;
  let currentGrid = grid;

  function applySegment(edge: 'north' | 'south' | 'east' | 'west', seg: EdgeSeamSegment) {
    const isSolid = seg.seamType === 'SOLID_WALL';
    for (let c = seg.startCoord; c <= seg.endCoord; c++) {
      const x = edge === 'west' ? 0 : edge === 'east' ? width - 1 : c;
      const y = edge === 'north' ? 0 : edge === 'south' ? height - 1 : c;

      if (isSolid) {
        currentGrid = setTileCell(currentGrid, x, y, () => ({
          terrainType: 'SOOT_BRICK_WALL',
          blocksMovement: true,
          blocksSight: true,
        }));
      } else {
        const terrain = seg.seamType === 'CANAL_BRIDGE' ? 'TIMBER_PIER'
          : seg.seamType === 'TOLL_ARCH' ? 'IRON_GRATE'
          : 'COBBLESTONE_FLOOR';
        currentGrid = setTileCell(currentGrid, x, y, () => ({
          terrainType: terrain,
          blocksMovement: false,
          blocksSight: false,
        }));
      }
    }
  }

  for (const seg of seams.north) applySegment('north', seg);
  for (const seg of seams.south) applySegment('south', seg);
  for (const seg of seams.east) applySegment('east', seg);
  for (const seg of seams.west) applySegment('west', seg);

  return currentGrid;
}

/**
 * Checks whether an edge coordinate corresponds to an open traversable seam segment.
 */
export function isEdgeSeamTraversable(
  seams: DistrictBoundarySeams,
  edge: 'north' | 'south' | 'east' | 'west',
  coord: number,
): boolean {
  const seg = seams[edge].find((s) => coord >= s.startCoord && coord <= s.endCoord);
  return Boolean(seg && seg.seamType !== 'SOLID_WALL');
}

/**
 * Resolves the destination district blueprint ID for a traversable edge coordinate.
 */
export function getEdgeNeighbor(
  seams: DistrictBoundarySeams,
  edge: 'north' | 'south' | 'east' | 'west',
  coord: number,
): BlueprintId | undefined {
  const seg = seams[edge].find((s) => coord >= s.startCoord && coord <= s.endCoord);
  return seg?.neighborDistrictId;
}
