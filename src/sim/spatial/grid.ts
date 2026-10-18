import { z } from 'zod';
import { EntityRecord } from '../../schemas/components.schema.js';
import { EntityId, Point3D, StratumId, StratumIdSchema } from '../../schemas/primitives.schema.js';

export const TileCellSchema = z.object({
  terrainType: z.enum([
    'COBBLESTONE_FLOOR',
    'SOOT_BRICK_WALL',
    'IRON_GRATE',
    'BRASS_CATWALK',
    'WOODEN_DOOR_CLOSED',
    'WOODEN_DOOR_OPEN',
    'DISTRICT_GATE',
  ]),
  blocksMovement: z.boolean(),
  blocksSight: z.boolean(),
  steamPressureKpa: z.number().nonnegative().default(0),
  coalDustDensity: z.number().min(0).max(1).default(0),
  explored: z.boolean().default(false),
});
export type TileCell = z.infer<typeof TileCellSchema>;

export const StratumGridSchema = z.object({
  stratum: StratumIdSchema,
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  cells: z.array(TileCellSchema),
});
export type StratumGrid = z.infer<typeof StratumGridSchema>;

export function createStratumGrid(
  stratum: StratumId,
  width: number,
  height: number,
): StratumGrid {
  const cells: TileCell[] = [];
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const isBorder = x === 0 || y === 0 || x === width - 1 || y === height - 1;
      cells.push({
        terrainType: isBorder ? 'SOOT_BRICK_WALL' : 'COBBLESTONE_FLOOR',
        blocksMovement: isBorder,
        blocksSight: isBorder,
        steamPressureKpa: 0,
        coalDustDensity: 0,
        explored: false,
      });
    }
  }
  return { stratum, width, height, cells };
}

export function isWithinBounds(grid: StratumGrid, x: number, y: number): boolean {
  return x >= 0 && y >= 0 && x < grid.width && y < grid.height;
}

export function getTileCell(grid: StratumGrid, x: number, y: number): TileCell | undefined {
  if (!isWithinBounds(grid, x, y)) {
    return undefined;
  }
  return grid.cells[y * grid.width + x];
}

export function setTileCell(
  grid: StratumGrid,
  x: number,
  y: number,
  updater: (prev: TileCell) => Partial<TileCell> | TileCell,
): StratumGrid {
  if (!isWithinBounds(grid, x, y)) {
    return grid;
  }
  const idx = y * grid.width + x;
  const current = grid.cells[idx];
  if (!current) {
    return grid;
  }
  const nextCells = [...grid.cells];
  const updated = updater(current);
  nextCells[idx] = { ...current, ...updated };
  return { ...grid, cells: nextCells };
}

export function findEntitiesAtPoint(
  entities: Readonly<Record<string, EntityRecord>>,
  point: Point3D,
): EntityRecord[] {
  const matches: EntityRecord[] = [];
  for (const entity of Object.values(entities)) {
    const pos = entity.position;
    if (pos && pos.stratum === point.stratum && pos.x === point.x && pos.y === point.y) {
      matches.push(entity);
    }
  }
  return matches;
}

export function findBlockingEntityAtPoint(
  entities: Readonly<Record<string, EntityRecord>>,
  point: Point3D,
  ignoreEntityId?: EntityId,
): EntityRecord | undefined {
  for (const entity of findEntitiesAtPoint(entities, point)) {
    if (entity.id !== ignoreEntityId && entity.position?.blocksMovement) {
      return entity;
    }
  }
  return undefined;
}

export function markExploredTiles(
  grid: StratumGrid,
  visibleKeys: ReadonlySet<string>,
): StratumGrid {
  let changed = false;
  const nextCells = [...grid.cells];
  for (const key of visibleKeys) {
    const comma = key.indexOf(',');
    if (comma === -1) continue;
    const x = Number(key.slice(0, comma));
    const y = Number(key.slice(comma + 1));
    const idx = y * grid.width + x;
    const current = nextCells[idx];
    if (current && !current.explored) {
      nextCells[idx] = { ...current, explored: true };
      changed = true;
    }
  }
  return changed ? { ...grid, cells: nextCells } : grid;
}
