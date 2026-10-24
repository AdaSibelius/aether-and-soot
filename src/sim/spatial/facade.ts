import { EntityRecord } from '../../schemas/components.schema.js';
import { EntityId, Point2D, StratumId } from '../../schemas/primitives.schema.js';
import { WorldState } from '../core/world.js';
import { hasWalkablePath } from './district-layout.js';
import { computeVisibleTiles, isPointVisible } from './fov.js';
import {
  findBlockingEntityAtPoint,
  findEntitiesAtPoint,
  getTileCell,
  isWithinBounds,
  TileCell,
} from './grid.js';

export interface SpatialView {
  readonly stratum: StratumId;
  readonly width: number;
  readonly height: number;
  getTile(x: number, y: number): TileCell | undefined;
  isWithinBounds(x: number, y: number): boolean;
  isTileWalkable(x: number, y: number, ignoreEntityId?: EntityId): boolean;
  findEntitiesAt(x: number, y: number): EntityRecord[];
  findEntitiesInRadius(origin: Point2D, radius: number): EntityRecord[];
  getLineOfSight(origin: Point2D, target: Point2D, maxRadius?: number): boolean;
  computeFov(origin: Point2D, radius: number): ReadonlySet<string>;
  getChebyshevDistance(a: Point2D, b: Point2D): number;
  getDirectionToward(from: Point2D, to: Point2D): { dx: number; dy: number };
  hasPathToTarget(from: Point2D, to: Point2D): boolean;
  findNearestCover(origin: Point2D, maxRadius?: number): Point2D | undefined;
}

/**
 * Creates a pure, read-only SpatialView facade for a specific stratum in the world state.
 * Encapsulates coordinate geometry, FOV casting, pathfinding, and entity queries without
 * exposing raw mutable grid buffers or requiring callers to write ad-hoc math loops.
 */
export function createSpatialView(state: WorldState, stratum: StratumId): SpatialView {
  const grid = state.strata[stratum];
  const width = grid?.width ?? 0;
  const height = grid?.height ?? 0;

  return {
    stratum,
    width,
    height,

    getTile(x: number, y: number): TileCell | undefined {
      if (!grid) return undefined;
      return getTileCell(grid, x, y);
    },

    isWithinBounds(x: number, y: number): boolean {
      if (!grid) return false;
      return isWithinBounds(grid, x, y);
    },

    isTileWalkable(x: number, y: number, ignoreEntityId?: EntityId): boolean {
      if (!grid || !isWithinBounds(grid, x, y)) return false;
      const cell = getTileCell(grid, x, y);
      if (!cell || cell.blocksMovement) return false;
      const blocker = findBlockingEntityAtPoint(state.entities, { x, y, stratum }, ignoreEntityId);
      return !blocker;
    },

    findEntitiesAt(x: number, y: number): EntityRecord[] {
      return findEntitiesAtPoint(state.entities, { x, y, stratum });
    },

    findEntitiesInRadius(origin: Point2D, radius: number): EntityRecord[] {
      const results: EntityRecord[] = [];
      for (const entity of Object.values(state.entities)) {
        const pos = entity.position;
        if (pos && pos.stratum === stratum) {
          const dist = Math.max(Math.abs(pos.x - origin.x), Math.abs(pos.y - origin.y));
          if (dist <= radius) {
            results.push(entity);
          }
        }
      }
      return results;
    },

    getLineOfSight(origin: Point2D, target: Point2D, maxRadius = 12): boolean {
      if (!grid) return false;
      const visible = computeVisibleTiles(grid, origin.x, origin.y, maxRadius);
      return isPointVisible(visible, target);
    },

    computeFov(origin: Point2D, radius: number): ReadonlySet<string> {
      if (!grid) return new Set();
      return computeVisibleTiles(grid, origin.x, origin.y, radius);
    },

    getChebyshevDistance(a: Point2D, b: Point2D): number {
      return Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));
    },

    getDirectionToward(from: Point2D, to: Point2D): { dx: number; dy: number } {
      const rawDx = to.x - from.x;
      const rawDy = to.y - from.y;
      return {
        dx: rawDx === 0 ? 0 : rawDx > 0 ? 1 : -1,
        dy: rawDy === 0 ? 0 : rawDy > 0 ? 1 : -1,
      };
    },

    hasPathToTarget(from: Point2D, to: Point2D): boolean {
      if (!grid) return false;
      return hasWalkablePath(grid, from, to);
    },

    findNearestCover(origin: Point2D, maxRadius = 4): Point2D | undefined {
      if (!grid) return undefined;
      for (let r = 1; r <= maxRadius; r++) {
        for (let dy = -r; dy <= r; dy++) {
          for (let dx = -r; dx <= r; dx++) {
            if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
            const nx = origin.x + dx;
            const ny = origin.y + dy;
            if (!isWithinBounds(grid, nx, ny)) continue;
            const cell = getTileCell(grid, nx, ny);
            if (!cell || cell.blocksMovement) continue;

            let hasAdjacentWall = false;
            for (const [adjX, adjY] of [[0, 1], [0, -1], [1, 0], [-1, 0]] as const) {
              const ax = nx + adjX;
              const ay = ny + adjY;
              if (isWithinBounds(grid, ax, ay)) {
                const adjCell = getTileCell(grid, ax, ay);
                if (adjCell?.blocksMovement || adjCell?.blocksSight) {
                  hasAdjacentWall = true;
                  break;
                }
              }
            }
            if (hasAdjacentWall) {
              return { x: nx, y: ny };
            }
          }
        }
      }
      return undefined;
    },
  };
}
