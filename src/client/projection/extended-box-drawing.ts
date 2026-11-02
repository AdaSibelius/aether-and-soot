import { TerrainType } from '../../schemas/primitives.schema.js';
import { StratumGrid } from '../../sim/spatial/grid.js';
import { getExplicitWallGlyph } from './wall-connections.js';

export enum WallStyle {
  NONE = 0,
  SINGLE = 1,
  DOUBLE = 2,
}

export const SINGLE_BOX_GLYPHS = {
  VERTICAL: '│', HORIZONTAL: '─', CORNER_NW: '┌', CORNER_NE: '┐',
  CORNER_SW: '└', CORNER_SE: '┘', TEE_NORTH: '┬', TEE_SOUTH: '┴',
  TEE_EAST: '├', TEE_WEST: '┤', CROSS: '┼',
} as const;

export const DOUBLE_BOX_GLYPHS = {
  VERTICAL: '║', HORIZONTAL: '═', CORNER_NW: '╔', CORNER_NE: '╗',
  CORNER_SW: '╚', CORNER_SE: '╝', TEE_NORTH: '╦', TEE_SOUTH: '╩',
  TEE_EAST: '╠', TEE_WEST: '╣', CROSS: '╬', SOLID_INTERIOR: '▓', DEFAULT: '#',
} as const;

export const MIXED_BOX_GLYPHS = {
  TEE_DOWN_DOUBLE_HORIZ: '╤', TEE_UP_DOUBLE_HORIZ: '╧', CROSS_DOUBLE_HORIZ: '╪',
  TEE_RIGHT_DOUBLE_VERT: '╞', TEE_LEFT_DOUBLE_VERT: '╡', CROSS_DOUBLE_VERT: '╫',
  TEE_DOWN_SINGLE_HORIZ: '╥', TEE_UP_SINGLE_HORIZ: '╨',
  TEE_RIGHT_SINGLE_VERT: '╟', TEE_LEFT_SINGLE_VERT: '╢',
  CORNER_NW_DOUBLE_V: '╓', CORNER_NW_DOUBLE_H: '╒',
  CORNER_NE_DOUBLE_V: '╖', CORNER_NE_DOUBLE_H: '╕',
  CORNER_SW_DOUBLE_V: '╙', CORNER_SW_DOUBLE_H: '╘',
  CORNER_SE_DOUBLE_V: '╜', CORNER_SE_DOUBLE_H: '╛',
} as const;

export const WALL_BOX_GLYPHS = DOUBLE_BOX_GLYPHS;

function isWallOrAperture(t: TerrainType): boolean {
  return t === 'SOOT_BRICK_WALL' || t === 'TIMBER_STRUT' || t === 'COUNTER_BARRIER' ||
    t === 'WOODEN_DOOR_CLOSED' || t === 'WOODEN_DOOR_OPEN' || t === 'GLASS_WINDOW' ||
    t === 'SMASHED_WINDOW_FRAME' || t === 'DISTRICT_GATE' || t.startsWith('WALL_');
}

function isInteriorCell(grid: StratumGrid, x: number, y: number): boolean {
  if (x < 0 || x >= grid.width || y < 0 || y >= grid.height) return false;
  const cell = grid.cells[y * grid.width + x];
  return Boolean(cell && cell.interiorZone && cell.interiorZone !== 'NONE');
}

export function isInteriorPartition(grid: StratumGrid, x: number, y: number): boolean {
  const cell = grid.cells[y * grid.width + x];
  if (!cell) return false;
  if (cell.terrainType === 'TIMBER_STRUT' || cell.terrainType === 'COUNTER_BARRIER') return true;
  if (cell.interiorZone && cell.interiorZone !== 'NONE') return true;
  const n = isInteriorCell(grid, x, y - 1);
  const s = isInteriorCell(grid, x, y + 1);
  const e = isInteriorCell(grid, x + 1, y);
  const w = isInteriorCell(grid, x - 1, y);
  if ((n && s) || (e && w)) return true;
  const touchesInterior = n || s || e || w;
  if (touchesInterior) {
    const bordersOutdoors = [
      { x, y: y - 1 }, { x, y: y + 1 }, { x: x + 1, y }, { x: x - 1, y },
    ].some((pt) => {
      if (pt.x < 0 || pt.x >= grid.width || pt.y < 0 || pt.y >= grid.height) return true;
      const c = grid.cells[pt.y * grid.width + pt.x];
      return !c || ((!c.interiorZone || c.interiorZone === 'NONE') && !isWallOrAperture(c.terrainType));
    });
    return !bordersOutdoors;
  }
  return false;
}

export function getWallStyleAt(grid: StratumGrid, x: number, y: number): WallStyle {
  if (x < 0 || x >= grid.width || y < 0 || y >= grid.height) return WallStyle.DOUBLE;
  const cell = grid.cells[y * grid.width + x];
  if (!cell || !isWallOrAperture(cell.terrainType)) return WallStyle.NONE;
  if (cell.terrainType === 'TIMBER_STRUT' || cell.terrainType === 'COUNTER_BARRIER') return WallStyle.SINGLE;
  if (cell.terrainType === 'DISTRICT_GATE') return WallStyle.DOUBLE;
  if (isInteriorPartition(grid, x, y)) return WallStyle.SINGLE;
  return WallStyle.DOUBLE;
}

export function resolveBoxDrawingGlyph(
  n: WallStyle, e: WallStyle, s: WallStyle, w: WallStyle,
  isSurroundedBySolidWalls = false,
): string {
  if (n && e && s && w) {
    if (n === WallStyle.DOUBLE && e === WallStyle.DOUBLE && s === WallStyle.DOUBLE && w === WallStyle.DOUBLE) {
      return isSurroundedBySolidWalls ? DOUBLE_BOX_GLYPHS.SOLID_INTERIOR : DOUBLE_BOX_GLYPHS.CROSS;
    }
    if (n === WallStyle.SINGLE && e === WallStyle.SINGLE && s === WallStyle.SINGLE && w === WallStyle.SINGLE) {
      return SINGLE_BOX_GLYPHS.CROSS;
    }
    if (n === WallStyle.DOUBLE && s === WallStyle.DOUBLE && e === WallStyle.SINGLE && w === WallStyle.SINGLE) {
      return MIXED_BOX_GLYPHS.CROSS_DOUBLE_VERT;
    }
    if (n === WallStyle.SINGLE && s === WallStyle.SINGLE && e === WallStyle.DOUBLE && w === WallStyle.DOUBLE) {
      return MIXED_BOX_GLYPHS.CROSS_DOUBLE_HORIZ;
    }
    return DOUBLE_BOX_GLYPHS.CROSS;
  }
  if (n && s && e && !w) {
    if (n === WallStyle.DOUBLE && s === WallStyle.DOUBLE) {
      return e === WallStyle.SINGLE ? MIXED_BOX_GLYPHS.TEE_RIGHT_DOUBLE_VERT : DOUBLE_BOX_GLYPHS.TEE_EAST;
    }
    if (n === WallStyle.SINGLE && s === WallStyle.SINGLE) {
      return e === WallStyle.DOUBLE ? MIXED_BOX_GLYPHS.TEE_RIGHT_SINGLE_VERT : SINGLE_BOX_GLYPHS.TEE_EAST;
    }
    return (n === WallStyle.DOUBLE || s === WallStyle.DOUBLE || e === WallStyle.DOUBLE) ? DOUBLE_BOX_GLYPHS.TEE_EAST : SINGLE_BOX_GLYPHS.TEE_EAST;
  }
  if (n && s && !e && w) {
    if (n === WallStyle.DOUBLE && s === WallStyle.DOUBLE) {
      return w === WallStyle.SINGLE ? MIXED_BOX_GLYPHS.TEE_LEFT_DOUBLE_VERT : DOUBLE_BOX_GLYPHS.TEE_WEST;
    }
    if (n === WallStyle.SINGLE && s === WallStyle.SINGLE) {
      return w === WallStyle.DOUBLE ? MIXED_BOX_GLYPHS.TEE_LEFT_SINGLE_VERT : SINGLE_BOX_GLYPHS.TEE_WEST;
    }
    return (n === WallStyle.DOUBLE || s === WallStyle.DOUBLE || w === WallStyle.DOUBLE) ? DOUBLE_BOX_GLYPHS.TEE_WEST : SINGLE_BOX_GLYPHS.TEE_WEST;
  }
  if (!n && s && e && w) {
    if (e === WallStyle.DOUBLE && w === WallStyle.DOUBLE) {
      return s === WallStyle.SINGLE ? MIXED_BOX_GLYPHS.TEE_DOWN_DOUBLE_HORIZ : DOUBLE_BOX_GLYPHS.TEE_NORTH;
    }
    if (e === WallStyle.SINGLE && w === WallStyle.SINGLE) {
      return s === WallStyle.DOUBLE ? MIXED_BOX_GLYPHS.TEE_DOWN_SINGLE_HORIZ : SINGLE_BOX_GLYPHS.TEE_NORTH;
    }
    return (e === WallStyle.DOUBLE || w === WallStyle.DOUBLE || s === WallStyle.DOUBLE) ? DOUBLE_BOX_GLYPHS.TEE_NORTH : SINGLE_BOX_GLYPHS.TEE_NORTH;
  }
  if (n && !s && e && w) {
    if (e === WallStyle.DOUBLE && w === WallStyle.DOUBLE) {
      return n === WallStyle.SINGLE ? MIXED_BOX_GLYPHS.TEE_UP_DOUBLE_HORIZ : DOUBLE_BOX_GLYPHS.TEE_SOUTH;
    }
    if (e === WallStyle.SINGLE && w === WallStyle.SINGLE) {
      return n === WallStyle.DOUBLE ? MIXED_BOX_GLYPHS.TEE_UP_SINGLE_HORIZ : SINGLE_BOX_GLYPHS.TEE_SOUTH;
    }
    return (e === WallStyle.DOUBLE || w === WallStyle.DOUBLE || n === WallStyle.DOUBLE) ? DOUBLE_BOX_GLYPHS.TEE_SOUTH : SINGLE_BOX_GLYPHS.TEE_SOUTH;
  }
  if (!n && s && e && !w) {
    if (s === WallStyle.DOUBLE && e === WallStyle.DOUBLE) return DOUBLE_BOX_GLYPHS.CORNER_NW;
    if (s === WallStyle.SINGLE && e === WallStyle.SINGLE) return SINGLE_BOX_GLYPHS.CORNER_NW;
    return s === WallStyle.DOUBLE ? MIXED_BOX_GLYPHS.CORNER_NW_DOUBLE_V : MIXED_BOX_GLYPHS.CORNER_NW_DOUBLE_H;
  }
  if (!n && s && !e && w) {
    if (s === WallStyle.DOUBLE && w === WallStyle.DOUBLE) return DOUBLE_BOX_GLYPHS.CORNER_NE;
    if (s === WallStyle.SINGLE && w === WallStyle.SINGLE) return SINGLE_BOX_GLYPHS.CORNER_NE;
    return s === WallStyle.DOUBLE ? MIXED_BOX_GLYPHS.CORNER_NE_DOUBLE_V : MIXED_BOX_GLYPHS.CORNER_NE_DOUBLE_H;
  }
  if (n && !s && e && !w) {
    if (n === WallStyle.DOUBLE && e === WallStyle.DOUBLE) return DOUBLE_BOX_GLYPHS.CORNER_SW;
    if (n === WallStyle.SINGLE && e === WallStyle.SINGLE) return SINGLE_BOX_GLYPHS.CORNER_SW;
    return n === WallStyle.DOUBLE ? MIXED_BOX_GLYPHS.CORNER_SW_DOUBLE_V : MIXED_BOX_GLYPHS.CORNER_SW_DOUBLE_H;
  }
  if (n && !s && !e && w) {
    if (n === WallStyle.DOUBLE && w === WallStyle.DOUBLE) return DOUBLE_BOX_GLYPHS.CORNER_SE;
    if (n === WallStyle.SINGLE && w === WallStyle.SINGLE) return SINGLE_BOX_GLYPHS.CORNER_SE;
    return n === WallStyle.DOUBLE ? MIXED_BOX_GLYPHS.CORNER_SE_DOUBLE_V : MIXED_BOX_GLYPHS.CORNER_SE_DOUBLE_H;
  }
  if (n || s) return (n === WallStyle.DOUBLE || s === WallStyle.DOUBLE) ? DOUBLE_BOX_GLYPHS.VERTICAL : SINGLE_BOX_GLYPHS.VERTICAL;
  if (e || w) return (e === WallStyle.DOUBLE || w === WallStyle.DOUBLE) ? DOUBLE_BOX_GLYPHS.HORIZONTAL : SINGLE_BOX_GLYPHS.HORIZONTAL;
  return DOUBLE_BOX_GLYPHS.DEFAULT;
}

export function resolveExtendedConnectingWallGlyph(grid: StratumGrid, x: number, y: number): string {
  const currentCell = grid.cells[y * grid.width + x];
  if (!currentCell) return DOUBLE_BOX_GLYPHS.DEFAULT;
  const explicit = getExplicitWallGlyph(currentCell.terrainType);
  if (explicit) return explicit;
  const n = getWallStyleAt(grid, x, y - 1);
  const s = getWallStyleAt(grid, x, y + 1);
  const e = getWallStyleAt(grid, x + 1, y);
  const w = getWallStyleAt(grid, x - 1, y);
  const isSurrounded = Boolean(
    n && s && e && w &&
    getWallStyleAt(grid, x - 1, y - 1) && getWallStyleAt(grid, x + 1, y - 1) &&
    getWallStyleAt(grid, x - 1, y + 1) && getWallStyleAt(grid, x + 1, y + 1),
  );
  return resolveBoxDrawingGlyph(n, e, s, w, isSurrounded);
}
