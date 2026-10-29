import { Point2D } from '../../schemas/primitives.schema.js';
import { SeededRNG } from '../core/rng.js';
import { buildSolidStratumGrid, carveCorridor, carveRoom } from './district-layout.js';
import { setTileCell, StratumGrid } from './grid.js';

export interface UndercroftTopology {
  readonly grid: StratumGrid;
  /** Six chamber centers (shuffled) used to seat NPCs, containers and the catacomb stairwell. */
  readonly chambers: readonly Point2D[];
}

function inInterior(grid: StratumGrid, x: number, y: number): boolean {
  return x >= 2 && y >= 2 && x <= grid.width - 3 && y <= grid.height - 3;
}

/** Drunkard's-walk channel biased toward `to`, producing serpentine sewer runs that always terminate at the target. */
function carveSerpentine(grid: StratumGrid, from: Point2D, to: Point2D, rng: SeededRNG): StratumGrid {
  let g = grid;
  let x = from.x;
  let y = from.y;
  for (let step = 0; step < (grid.width + grid.height) * 4 && (x !== to.x || y !== to.y); step++) {
    g = setTileCell(g, x, y, (c) => ({ ...c, terrainType: 'IRON_GRATE', blocksMovement: false, blocksSight: false }));
    const dx = to.x - x;
    const dy = to.y - y;
    let nx = x;
    let ny = y;
    if (rng.nextFloat() < 0.68) {
      if (Math.abs(dx) >= Math.abs(dy) && dx !== 0) nx += Math.sign(dx);
      else if (dy !== 0) ny += Math.sign(dy);
      else nx += Math.sign(dx);
    } else if (rng.nextFloat() < 0.5) {
      nx += rng.nextInt(0, 1) === 0 ? -1 : 1;
    } else {
      ny += rng.nextInt(0, 1) === 0 ? -1 : 1;
    }
    if (inInterior(g, nx, ny)) {
      x = nx;
      y = ny;
    }
  }
  return carveCorridor(g, { x, y }, to, 'IRON_GRATE');
}

/**
 * TSK-P3-02: seeded cellular/serpentine sewer network — jittered elliptical cistern chambers, sluice basins,
 * Prim-style spanning channels with extra loop links, and a one-pass cellular roughening of channel walls.
 */
export function carveUndercroftSewers(width: number, height: number, entry: Point2D, rng: SeededRNG): UndercroftTopology {
  let grid = buildSolidStratumGrid('UNDERCROFT', width, height);
  const rX = (r: number) => Math.floor(width * r);
  const rY = (r: number) => Math.floor(height * r);

  // Four quadrant anchors (matching canonical testing & traversal coordinates) + two mid chambers
  const anchors: Point2D[] = [
    { x: rX(0.22), y: rY(0.20) }, // North-West (10, 7)
    { x: rX(0.78), y: rY(0.20) }, // North-East (37, 7)
    { x: rX(0.22), y: rY(0.80) }, // South-West (10, 28)
    { x: rX(0.78), y: rY(0.80) }, // South-East (37, 28)
    { x: rX(0.50), y: rY(0.25) }, // North-Mid
    { x: rX(0.50), y: rY(0.75) }, // South-Mid
  ];

  // Jitter chamber centers slightly while keeping quadrant anchors reachable
  const chambers = anchors.map((a, i) => {
    if (i < 4) return a; // Keep quadrant anchors exact so test invariants & portals connect cleanly
    return {
      x: Math.max(4, Math.min(width - 5, a.x + rng.nextInt(-2, 2))),
      y: Math.max(4, Math.min(height - 5, a.y + rng.nextInt(-2, 2))),
    };
  });

  grid = carveRoom(grid, entry.x, entry.y, 2, 2, 'IRON_GRATE', 0.15);
  for (const c of chambers) {
    const hw = rng.nextInt(2, 3);
    const hh = rng.nextInt(2, 3);
    for (let dy = -hh; dy <= hh; dy++) {
      for (let dx = -hw; dx <= hw; dx++) {
        if (dx * dx * hh * hh + dy * dy * hw * hw > hw * hw * hh * hh + hw * hh) continue;
        if (!inInterior(grid, c.x + dx, c.y + dy)) continue;
        grid = setTileCell(grid, c.x + dx, c.y + dy, (cell) => ({
          ...cell,
          terrainType: 'IRON_GRATE',
          blocksMovement: false,
          blocksSight: false,
          coalDustDensity: 0.15 + rng.nextInt(0, 2) * 0.1,
        }));
      }
    }
    // Sluice basin: a blocked tile beside (never on) the chamber center.
    const bx = c.x + (rng.nextInt(0, 1) === 0 ? -hw : hw);
    if (inInterior(grid, bx, c.y + 1)) {
      grid = setTileCell(grid, bx, c.y + 1, (cell) => ({ ...cell, terrainType: 'CANAL_SLUICE', blocksMovement: true, blocksSight: false }));
    }
  }

  const nodes: Point2D[] = [entry, ...chambers];
  const joined = [entry];
  for (const node of nodes.slice(1)) {
    const nearest = joined.reduce((a, b) =>
      Math.abs(a.x - node.x) + Math.abs(a.y - node.y) <= Math.abs(b.x - node.x) + Math.abs(b.y - node.y) ? a : b,
    );
    grid = carveSerpentine(grid, nearest, node, rng);
    joined.push(node);
  }
  for (let i = 0; i < 3; i++) {
    grid = carveSerpentine(grid, chambers[rng.nextInt(0, 5)]!, chambers[rng.nextInt(0, 5)]!, rng);
  }

  // One cellular pass: solid tiles hugging two or more channel tiles erode into the network.
  const eroded = grid.cells.slice();
  for (let y = 2; y < height - 2; y++) {
    for (let x = 2; x < width - 2; x++) {
      const cell = grid.cells[y * width + x];
      if (!cell || cell.terrainType !== 'SOOT_BRICK_WALL') continue;
      const open = [[1, 0], [-1, 0], [0, 1], [0, -1]].filter(([ox, oy]) => {
        const n = grid.cells[(y + oy!) * width + x + ox!];
        return n !== undefined && !n.blocksMovement;
      }).length;
      if (open >= 2 && rng.nextFloat() < 0.35) {
        eroded[y * width + x] = { ...cell, terrainType: 'IRON_GRATE', blocksMovement: false, blocksSight: false };
      }
    }
  }
  return { grid: { ...grid, cells: eroded }, chambers };
}
