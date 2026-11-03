import { BlueprintId, Point2D } from '../../schemas/primitives.schema.js';
import {
  computeDistrictBoundarySeams,
  DistrictBoundarySeams,
  EdgeSeamSegment,
} from './district-boundaries.js';
import { getTileCell, setTileCell, StratumGrid } from './grid.js';
import { SpatialAnomaly } from './spatial-survey-types.js';

type Edge = 'north' | 'south' | 'east' | 'west';
const EDGES: readonly Edge[] = ['north', 'south', 'east', 'west'];
const OPPOSITE: Readonly<Record<Edge, Edge>> = { north: 'south', south: 'north', east: 'west', west: 'east' };

export function isDoorTerrain(t: string): boolean {
  return t === 'WOODEN_DOOR_CLOSED' || t === 'WOODEN_DOOR_OPEN';
}

function isPassable(grid: StratumGrid, x: number, y: number): boolean {
  const c = getTileCell(grid, x, y);
  return Boolean(c && !c.blocksMovement && !isDoorTerrain(c.terrainType));
}

function isSolid(grid: StratumGrid, x: number, y: number): boolean {
  const c = getTileCell(grid, x, y);
  return !c || (c.blocksMovement && !isDoorTerrain(c.terrainType));
}

/**
 * A door is a legal doorway only when it pierces a straight wall line: open on both sides along one axis and walled on
 * the perpendicular axis. Anything else is a door floating in open floor, or one that opens onto solid masonry.
 */
export function isDoorEmbeddedInWall(grid: StratumGrid, x: number, y: number): boolean {
  const ns = isPassable(grid, x, y - 1) && isPassable(grid, x, y + 1) && isSolid(grid, x - 1, y) && isSolid(grid, x + 1, y);
  const ew = isPassable(grid, x - 1, y) && isPassable(grid, x + 1, y) && isSolid(grid, x, y - 1) && isSolid(grid, x, y + 1);
  return ns || ew;
}

/** Door-aware flood fill from `start`; doors count as passable. */
export function floodReachable(grid: StratumGrid, start: { x: number; y: number }): Uint8Array {
  const seen = new Uint8Array(grid.width * grid.height);
  const stack: number[] = [];
  const open = (x: number, y: number): boolean => {
    const c = getTileCell(grid, x, y);
    return Boolean(c && (!c.blocksMovement || isDoorTerrain(c.terrainType)));
  };
  if (!open(start.x, start.y)) return seen;
  stack.push(start.y * grid.width + start.x);
  seen[start.y * grid.width + start.x] = 1;
  while (stack.length > 0) {
    const idx = stack.pop()!;
    const x = idx % grid.width;
    const y = Math.floor(idx / grid.width);
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      const nx = x + dx;
      const ny = y + dy;
      if (!open(nx, ny)) continue;
      const nIdx = ny * grid.width + nx;
      if (seen[nIdx]) continue;
      seen[nIdx] = 1;
      stack.push(nIdx);
    }
  }
  return seen;
}

function borderPoint(grid: { width: number; height: number }, edge: Edge, coord: number): { x: number; y: number } {
  return {
    x: edge === 'west' ? 0 : edge === 'east' ? grid.width - 1 : coord,
    y: edge === 'north' ? 0 : edge === 'south' ? grid.height - 1 : coord,
  };
}

function openSegments(seams: DistrictBoundarySeams, edge: Edge): readonly EdgeSeamSegment[] {
  return seams[edge].filter((s) => s.seamType !== 'SOLID_WALL');
}

/** Flags every door that opens into a wall or floats in open floor (the "random doors" failure mode). */
export function detectOrphanDoors(grid: StratumGrid): SpatialAnomaly[] {
  const out: SpatialAnomaly[] = [];
  for (let y = 0; y < grid.height; y++) {
    for (let x = 0; x < grid.width; x++) {
      const cell = grid.cells[y * grid.width + x];
      if (!cell || !isDoorTerrain(cell.terrainType) || isDoorEmbeddedInWall(grid, x, y)) continue;
      out.push({
        id: `orphan_door_${x}_${y}`,
        type: 'ORPHAN_DOOR',
        severity: 'ERROR',
        position: { x, y },
        description: `Door at (${x},${y}) is not set in a wall line (floating in open floor or opening onto masonry).`,
      });
    }
  }
  return out;
}

/** Every declared open seam must have a passable border cell that is reachable from the district hub. */
export function detectSealedDistrictEdges(
  grid: StratumGrid,
  seams: DistrictBoundarySeams,
  hub: { x: number; y: number },
): SpatialAnomaly[] {
  const reach = floodReachable(grid, hub);
  const out: SpatialAnomaly[] = [];
  for (const edge of EDGES) {
    for (const seg of openSegments(seams, edge)) {
      let ok = false;
      for (let c = seg.startCoord; c <= seg.endCoord && !ok; c++) {
        const p = borderPoint(grid, edge, c);
        ok = isPassable(grid, p.x, p.y) && reach[p.y * grid.width + p.x] === 1;
      }
      if (ok) continue;
      const mid = borderPoint(grid, edge, Math.floor((seg.startCoord + seg.endCoord) / 2));
      out.push({
        id: `sealed_edge_${edge}_${seg.startCoord}`,
        type: 'SEALED_DISTRICT_EDGE',
        severity: 'FATAL',
        position: mid,
        targetId: seg.neighborDistrictId,
        description: `${edge} edge declares an open ${seg.seamType} to ${seg.neighborDistrictId ?? 'neighbor'} but no reachable border cell is passable; the district is walled in.`,
      });
    }
  }
  return out;
}

/** An open seam must be mirrored by the neighbour's opposite edge, pointing back here at the same coordinates. */
export function detectUnreciprocatedSeams(seams: DistrictBoundarySeams): SpatialAnomaly[] {
  const out: SpatialAnomaly[] = [];
  const { width, height } = seams.dimensions;
  for (const edge of EDGES) {
    for (const seg of openSegments(seams, edge)) {
      const neighborId = seg.neighborDistrictId;
      if (!neighborId) continue;
      const back = computeDistrictBoundarySeams(neighborId as BlueprintId, width, height);
      const mirrored = openSegments(back, OPPOSITE[edge]).some(
        (s) => s.neighborDistrictId === seams.districtId && s.startCoord === seg.startCoord && s.endCoord === seg.endCoord,
      );
      if (mirrored) continue;
      out.push({
        id: `unreciprocated_${edge}_${seg.startCoord}`,
        type: 'UNRECIPROCATED_SEAM',
        severity: 'ERROR',
        position: borderPoint({ width, height }, edge, seg.startCoord),
        targetId: neighborId,
        description: `${edge} seam leads to ${neighborId}, whose ${OPPOSITE[edge]} edge does not lead back to ${seams.districtId}.`,
      });
    }
  }
  return out;
}

/**
 * Repairs flanking wall jambs on landmark doors if a corridor carved next to them, then replaces any remaining
 * door not embedded in a straight wall line with open cobblestone floor.
 */
export function sanitizeOrphanDoors(grid: StratumGrid, landmarkDoors: readonly Point2D[] = []): StratumGrid {
  let current = grid;
  for (const d of landmarkDoors) {
    const cell = getTileCell(current, d.x, d.y);
    if (!cell || !isDoorTerrain(cell.terrainType) || isDoorEmbeddedInWall(current, d.x, d.y)) continue;
    const nsOpen = isPassable(current, d.x, d.y - 1) && isPassable(current, d.x, d.y + 1);
    const ewOpen = isPassable(current, d.x - 1, d.y) && isPassable(current, d.x + 1, d.y);
    if (nsOpen) {
      for (const dx of [-1, 1] as const) {
        if (!isSolid(current, d.x + dx, d.y)) {
          current = setTileCell(current, d.x + dx, d.y, (c) => ({
            ...c,
            terrainType: 'SOOT_BRICK_WALL',
            blocksMovement: true,
            blocksSight: true,
          }));
        }
      }
    } else if (ewOpen) {
      for (const dy of [-1, 1] as const) {
        if (!isSolid(current, d.x, d.y + dy)) {
          current = setTileCell(current, d.x, d.y + dy, (c) => ({
            ...c,
            terrainType: 'SOOT_BRICK_WALL',
            blocksMovement: true,
            blocksSight: true,
          }));
        }
      }
    }
  }

  for (let pass = 0; pass < 3; pass++) {
    let changed = false;
    for (let y = 0; y < current.height; y++) {
      for (let x = 0; x < current.width; x++) {
        const cell = current.cells[y * current.width + x];
        if (!cell || !isDoorTerrain(cell.terrainType) || isDoorEmbeddedInWall(current, x, y)) continue;
        current = setTileCell(current, x, y, (c) => ({
          ...c,
          terrainType: 'COBBLESTONE_FLOOR',
          blocksMovement: false,
          blocksSight: false,
        }));
        changed = true;
      }
    }
    if (!changed) break;
  }
  return current;
}

/** District-level survey: the checks that a per-building audit cannot see. */
export function runDistrictSurveyAudit(
  grid: StratumGrid,
  districtId: BlueprintId,
  hub: { x: number; y: number },
): SpatialAnomaly[] {
  const seams = computeDistrictBoundarySeams(districtId, grid.width, grid.height);
  return [
    ...detectSealedDistrictEdges(grid, seams, hub),
    ...detectUnreciprocatedSeams(seams),
    ...detectOrphanDoors(grid),
  ];
}
