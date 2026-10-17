import { Point2D } from '../../schemas/primitives.schema.js';
import { getTileCell, isWithinBounds, StratumGrid } from './grid.js';

export function pointKey(x: number, y: number): string {
  return `${x},${y}`;
}

/**
 * Deterministic 8-octant recursive shadowcasting Field of View (FOV).
 * Returns a Set of "x,y" coordinate keys visible from (originX, originY) within `radius`.
 */
export function computeVisibleTiles(
  grid: StratumGrid,
  originX: number,
  originY: number,
  radius: number,
): ReadonlySet<string> {
  const visible = new Set<string>();
  if (!isWithinBounds(grid, originX, originY)) {
    return visible;
  }

  visible.add(pointKey(originX, originY));

  const multipliers: ReadonlyArray< readonly [number, number, number, number]> = [
    [1, 0, 0, -1],
    [0, 1, -1, 0],
    [0, 1, 1, 0],
    [1, 0, 0, 1],
    [-1, 0, 0, 1],
    [0, -1, 1, 0],
    [0, -1, -1, 0],
    [-1, 0, 0, -1],
  ];

  const radiusSq = radius * radius;

  const castLight = (
    row: number,
    startSlope: number,
    endSlope: number,
    xx: number,
    xy: number,
    yx: number,
    yy: number,
  ): void => {
    if (startSlope < endSlope) {
      return;
    }

    let nextStartSlope = startSlope;

    for (let distance = row; distance <= radius; distance++) {
      let blocked = false;
      const dy = -distance;

      for (let dx = -distance; dx <= 0; dx++) {
        const leftSlope = (dx - 0.5) / (dy + 0.5);
        const rightSlope = (dx + 0.5) / (dy - 0.5);

        if (startSlope < rightSlope) {
          continue;
        }
        if (endSlope > leftSlope) {
          break;
        }

        const mapX = originX + dx * xx + dy * xy;
        const mapY = originY + dx * yx + dy * yy;

        if (!isWithinBounds(grid, mapX, mapY)) {
          continue;
        }

        if (dx * dx + dy * dy <= radiusSq) {
          visible.add(pointKey(mapX, mapY));
        }

        const cell = getTileCell(grid, mapX, mapY);
        const isOpaque = cell ? cell.blocksSight : true;

        if (blocked) {
          if (isOpaque) {
            nextStartSlope = rightSlope;
            continue;
          } else {
            blocked = false;
            startSlope = nextStartSlope;
          }
        } else if (isOpaque && distance < radius) {
          blocked = true;
          castLight(distance + 1, startSlope, leftSlope, xx, xy, yx, yy);
          nextStartSlope = rightSlope;
        }
      }

      if (blocked) {
        break;
      }
    }
  };

  for (const [xx, xy, yx, yy] of multipliers) {
    castLight(1, 1.0, 0.0, xx, xy, yx, yy);
  }

  return visible;
}

export function isPointVisible(
  visibleSet: ReadonlySet<string>,
  point: Point2D,
): boolean {
  return visibleSet.has(pointKey(point.x, point.y));
}
