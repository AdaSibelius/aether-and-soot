import { Point2D, StratumId } from '../../schemas/primitives.schema.js';
import { createStratumGrid, isWithinBounds, setTileCell, StratumGrid, TileCell } from './grid.js';

export interface CarvedBuilding {
  readonly name: string;
  readonly interiorCenter: Point2D;
  readonly doorPosition: Point2D;
}

export function buildSolidStratumGrid(stratum: StratumId, width: number, height: number): StratumGrid {
  const base = createStratumGrid(stratum, width, height);
  const solidCells: TileCell[] = base.cells.map(() => ({
    terrainType: 'SOOT_BRICK_WALL',
    blocksMovement: true,
    blocksSight: true,
    steamPressureKpa: 0,
    coalDustDensity: 0,
  }));
  return { ...base, cells: solidCells };
}

export function carveRoom(
  grid: StratumGrid,
  cx: number,
  cy: number,
  halfW: number,
  halfH: number,
  terrainType: TileCell['terrainType'],
  coalDustDensity = 0,
): StratumGrid {
  let next = grid;
  for (let y = cy - halfH; y <= cy + halfH; y++) {
    for (let x = cx - halfW; x <= cx + halfW; x++) {
      if (x <= 0 || y <= 0 || x >= grid.width - 1 || y >= grid.height - 1) continue;
      next = setTileCell(next, x, y, () => ({
        terrainType,
        blocksMovement: false,
        blocksSight: false,
        steamPressureKpa: 0,
        coalDustDensity,
      }));
    }
  }
  return next;
}

export function carveCorridor(
  grid: StratumGrid,
  from: Point2D,
  to: Point2D,
  terrainType: TileCell['terrainType'],
): StratumGrid {
  let next = grid;
  let currX = from.x;
  let currY = from.y;

  while (currX !== to.x) {
    next = setTileCell(next, currX, currY, () => ({
      terrainType,
      blocksMovement: false,
      blocksSight: false,
      steamPressureKpa: 0,
      coalDustDensity: 0,
    }));
    currX += currX < to.x ? 1 : -1;
  }

  while (currY !== to.y) {
    next = setTileCell(next, currX, currY, () => ({
      terrainType,
      blocksMovement: false,
      blocksSight: false,
      steamPressureKpa: 0,
      coalDustDensity: 0,
    }));
    currY += currY < to.y ? 1 : -1;
  }

  next = setTileCell(next, to.x, to.y, () => ({
    terrainType,
    blocksMovement: false,
    blocksSight: false,
    steamPressureKpa: 0,
    coalDustDensity: 0,
  }));

  return next;
}

/**
 * Carves an enclosed building with soot-brick walls, hollow interior floor,
 * and an openable wooden door on the perimeter.
 */
export function carveBuildingWithDoor(
  grid: StratumGrid,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  floorTerrain: TileCell['terrainType'],
  doorPos: Point2D,
  doorInitialState: 'CLOSED' | 'OPEN' = 'CLOSED',
  coalDustDensity = 0,
): StratumGrid {
  let next = grid;
  const minX = Math.min(x1, x2);
  const maxX = Math.max(x1, x2);
  const minY = Math.min(y1, y2);
  const maxY = Math.max(y1, y2);

  // Carve interior room
  for (let y = minY + 1; y < maxY; y++) {
    for (let x = minX + 1; x < maxX; x++) {
      if (!isWithinBounds(next, x, y)) continue;
      next = setTileCell(next, x, y, () => ({
        terrainType: floorTerrain,
        blocksMovement: false,
        blocksSight: false,
        steamPressureKpa: 0,
        coalDustDensity,
      }));
    }
  }

  // Place door on perimeter
  if (isWithinBounds(next, doorPos.x, doorPos.y)) {
    const isClosed = doorInitialState === 'CLOSED';
    next = setTileCell(next, doorPos.x, doorPos.y, () => ({
      terrainType: isClosed ? 'WOODEN_DOOR_CLOSED' : 'WOODEN_DOOR_OPEN',
      blocksMovement: isClosed,
      blocksSight: isClosed,
      steamPressureKpa: 0,
      coalDustDensity: 0,
    }));
  }

  return next;
}
