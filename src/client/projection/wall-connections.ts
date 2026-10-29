import { TerrainType } from '../../schemas/primitives.schema.js';
import { StratumGrid } from '../../sim/spatial/grid.js';

export const WALL_BOX_GLYPHS = {
  CROSS: '╬',
  VERTICAL: '║',
  HORIZONTAL: '═',
  CORNER_NW: '╔',
  CORNER_NE: '╗',
  CORNER_SW: '╚',
  CORNER_SE: '╝',
  TEE_NORTH: '╦',
  TEE_SOUTH: '╩',
  TEE_EAST: '╠',
  TEE_WEST: '╣',
  DEFAULT: '#',
} as const;

export function isWallTerrain(terrainType: TerrainType): boolean {
  switch (terrainType) {
    case 'SOOT_BRICK_WALL':
    case 'WALL_CROSS':
    case 'WALL_VERTICAL':
    case 'WALL_HORIZONTAL':
    case 'WALL_CORNER_NW':
    case 'WALL_CORNER_NE':
    case 'WALL_CORNER_SW':
    case 'WALL_CORNER_SE':
    case 'WALL_TEE_NORTH':
    case 'WALL_TEE_SOUTH':
    case 'WALL_TEE_EAST':
    case 'WALL_TEE_WEST':
      return true;
    default:
      return false;
  }
}

export function getExplicitWallGlyph(terrainType: TerrainType): string | undefined {
  switch (terrainType) {
    case 'WALL_CROSS':
      return WALL_BOX_GLYPHS.CROSS;
    case 'WALL_VERTICAL':
      return WALL_BOX_GLYPHS.VERTICAL;
    case 'WALL_HORIZONTAL':
      return WALL_BOX_GLYPHS.HORIZONTAL;
    case 'WALL_CORNER_NW':
      return WALL_BOX_GLYPHS.CORNER_NW;
    case 'WALL_CORNER_NE':
      return WALL_BOX_GLYPHS.CORNER_NE;
    case 'WALL_CORNER_SW':
      return WALL_BOX_GLYPHS.CORNER_SW;
    case 'WALL_CORNER_SE':
      return WALL_BOX_GLYPHS.CORNER_SE;
    case 'WALL_TEE_NORTH':
      return WALL_BOX_GLYPHS.TEE_NORTH;
    case 'WALL_TEE_SOUTH':
      return WALL_BOX_GLYPHS.TEE_SOUTH;
    case 'WALL_TEE_EAST':
      return WALL_BOX_GLYPHS.TEE_EAST;
    case 'WALL_TEE_WEST':
      return WALL_BOX_GLYPHS.TEE_WEST;
    default:
      return undefined;
  }
}

export function isWallJoinableTerrain(terrainType: TerrainType): boolean {
  if (isWallTerrain(terrainType)) return true;
  switch (terrainType) {
    case 'WOODEN_DOOR_CLOSED':
    case 'WOODEN_DOOR_OPEN':
    case 'GLASS_WINDOW':
    case 'SMASHED_WINDOW_FRAME':
    case 'DISTRICT_GATE':
      return true;
    default:
      return false;
  }
}

function hasWallAt(grid: StratumGrid, x: number, y: number): boolean {
  if (x < 0 || x >= grid.width || y < 0 || y >= grid.height) {
    return true; // Map borders connect visually
  }
  const cell = grid.cells[y * grid.width + x];
  if (!cell) return false;
  return isWallJoinableTerrain(cell.terrainType);
}

/**
 * Dynamically resolves CP437/Unicode connecting wall box-drawing glyphs
 * based on 4-way orthogonal wall connectivity (North, South, East, West).
 */
export function resolveConnectingWallGlyph(grid: StratumGrid, x: number, y: number): string {
  const currentCell = grid.cells[y * grid.width + x];
  if (!currentCell) return WALL_BOX_GLYPHS.DEFAULT;

  const explicit = getExplicitWallGlyph(currentCell.terrainType);
  if (explicit) return explicit;

  const n = hasWallAt(grid, x, y - 1);
  const s = hasWallAt(grid, x, y + 1);
  const e = hasWallAt(grid, x + 1, y);
  const w = hasWallAt(grid, x - 1, y);

  // 4-way intersection
  if (n && s && e && w) return WALL_BOX_GLYPHS.CROSS;

  // 3-way junctions (Tees)
  if (n && s && e && !w) return WALL_BOX_GLYPHS.TEE_EAST;
  if (n && s && !e && w) return WALL_BOX_GLYPHS.TEE_WEST;
  if (!n && s && e && w) return WALL_BOX_GLYPHS.TEE_NORTH;
  if (n && !s && e && w) return WALL_BOX_GLYPHS.TEE_SOUTH;

  // 2-way corners
  if (!n && s && e && !w) return WALL_BOX_GLYPHS.CORNER_NW; // down & right
  if (!n && s && !e && w) return WALL_BOX_GLYPHS.CORNER_NE; // down & left
  if (n && !s && e && !w) return WALL_BOX_GLYPHS.CORNER_SW; // up & right
  if (n && !s && !e && w) return WALL_BOX_GLYPHS.CORNER_SE; // up & left

  // Straights
  if (n || s) return WALL_BOX_GLYPHS.VERTICAL;
  if (e || w) return WALL_BOX_GLYPHS.HORIZONTAL;

  return WALL_BOX_GLYPHS.DEFAULT;
}
