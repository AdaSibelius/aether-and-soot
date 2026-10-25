import { StratumId } from '../../schemas/primitives.schema.js';
import { WorldState } from '../core/world.js';
import { pointKey } from '../spatial/fov.js';
import { getTileCell, isWithinBounds } from '../spatial/grid.js';

export const CARDINAL_DELTAS = [
  { dx: 0, dy: -1 },
  { dx: 0, dy: 1 },
  { dx: -1, dy: 0 },
  { dx: 1, dy: 0 },
] as const;

export const GASLIGHT_EMISSION_RADIUS = 5;

/**
 * Calculates volumetric gaslight illumination radiance across a stratum.
 * Returns a map of tile keys to luminance values [0, 1].
 */
export function calculateGaslightField(state: WorldState, stratum: StratumId): Map<string, number> {
  const grid = state.strata[stratum];
  const field = new Map<string, number>();
  if (!grid) return field;

  const emitters: Array<{ x: number; y: number }> = [];

  for (let y = 0; y < grid.height; y++) {
    for (let x = 0; x < grid.width; x++) {
      const cell = grid.cells[y * grid.width + x];
      if (cell?.terrainType === 'GASLAMP_POST') emitters.push({ x, y });
    }
  }

  for (const ent of Object.values(state.entities)) {
    if (ent.position?.stratum === stratum && (ent.name.toLowerCase().includes('gaslamp') || ent.name.toLowerCase().includes('lamp_post'))) {
      emitters.push({ x: ent.position.x, y: ent.position.y });
    }
  }

  for (const emitter of emitters) {
    const queue: Array<{ x: number; y: number; dist: number }> = [{ x: emitter.x, y: emitter.y, dist: 0 }];
    const visited = new Set<string>();

    while (queue.length > 0) {
      const curr = queue.shift()!;
      const key = pointKey(curr.x, curr.y);
      if (visited.has(key)) continue;
      visited.add(key);

      const rad = Math.max(0, 1 - curr.dist / GASLIGHT_EMISSION_RADIUS);
      const prev = field.get(key) ?? 0;
      if (rad > prev) field.set(key, rad);

      if (curr.dist >= GASLIGHT_EMISSION_RADIUS) continue;

      for (const d of CARDINAL_DELTAS) {
        const nx = curr.x + d.dx, ny = curr.y + d.dy;
        if (!isWithinBounds(grid, nx, ny)) continue;
        const nCell = getTileCell(grid, nx, ny);
        if (nCell && !nCell.blocksSight && !visited.has(pointKey(nx, ny))) {
          queue.push({ x: nx, y: ny, dist: curr.dist + 1 });
        }
      }
    }
  }

  return field;
}
