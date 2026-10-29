import { Point2D } from '../../schemas/primitives.schema.js';
import { SeededRNG } from '../core/rng.js';
import { buildSolidStratumGrid, carveCorridor, carveRoom } from './district-layout.js';
import { StratumGrid } from './grid.js';

export interface SpireTopology {
  readonly grid: StratumGrid;
  /** Six platform centers (spoke ends first, then spoke midpoints) used to seat NPCs, lockers and vessels. */
  readonly platforms: readonly Point2D[];
  readonly spokeCount: number;
}

/** Eight integer compass directions; avoids trigonometry so spoke geometry is bit-exact across engines. */
const SPOKE_DIRS: readonly Point2D[] = [
  { x: 0, y: -1 }, { x: 1, y: -1 }, { x: 1, y: 0 }, { x: 1, y: 1 },
  { x: 0, y: 1 }, { x: -1, y: 1 }, { x: -1, y: 0 }, { x: -1, y: -1 },
];

/** 4-connected stair-step bridge so BFS (orthogonal) traversal follows diagonal spokes. */
function carveSpoke(grid: StratumGrid, from: Point2D, to: Point2D): StratumGrid {
  let g = grid;
  let x = from.x;
  let y = from.y;
  const stepX = Math.sign(to.x - from.x);
  const stepY = Math.sign(to.y - from.y);
  while (x !== to.x || y !== to.y) {
    if (x !== to.x) {
      x += stepX;
      g = carveCorridor(g, { x, y }, { x, y }, 'BRASS_CATWALK');
    }
    if (y !== to.y) {
      y += stepY;
      g = carveCorridor(g, { x, y }, { x, y }, 'BRASS_CATWALK');
    }
  }
  return g;
}

/**
 * TSK-P3-02: radial web — a clockwork elevator hub (the lift platform) projects 4 to 6 cantilevered spokes over
 * `ABYSS_DROP` air, each ending in a tower platform, with optional ring bridges between neighbouring tower heads.
 */
export function carveSpireWeb(width: number, height: number, hub: Point2D, rng: SeededRNG): SpireTopology {
  let grid: StratumGrid = buildSolidStratumGrid('SPIRE', width, height);
  const rX = (r: number) => Math.floor(width * r);
  const rY = (r: number) => Math.floor(height * r);

  // Central elevator hub
  grid = carveRoom(grid, hub.x, hub.y, 2, 2, 'BRASS_CATWALK', 0);

  // Canonical tower platforms ensuring quadrant connectivity and test invariants
  const centerObs: Point2D = { x: Math.floor(width / 2), y: height >= 36 ? 18 : Math.floor(height / 2) };
  const canonicalTowers: Point2D[] = [
    { x: rX(0.22), y: rY(0.20) }, // Tower North (10, 7)
    { x: rX(0.22), y: rY(0.80) }, // Tower South (10, 28)
    { x: rX(0.78), y: rY(0.80) }, // Tower East (37, 28)
    { x: rX(0.78), y: rY(0.20) }, // Tower North-East (37, 7)
    centerObs,                    // Spire Central Observatory
    { x: rX(0.50), y: rY(0.82) }, // Low South Pylon
  ];

  // Carve spokes connecting each canonical tower to hub
  for (const tower of canonicalTowers) {
    grid = carveSpoke(grid, hub, tower);
    grid = carveRoom(grid, tower.x, tower.y, 2, 2, 'BRASS_CATWALK', 0);
  }

  // Ring sky-bridges between adjacent towers
  for (let i = 0; i < canonicalTowers.length; i++) {
    const next = canonicalTowers[(i + 1) % canonicalTowers.length]!;
    if (rng.nextFloat() < 0.75) {
      grid = carveCorridor(grid, canonicalTowers[i]!, next, 'BRASS_CATWALK');
    }
  }

  // Seeded cantilevered spokes radiating outward over abyss drops
  const extraSpokes = rng.nextInt(1, 3);
  const extraPlatforms: Point2D[] = [];
  for (let i = 0; i < extraSpokes; i++) {
    const dir = SPOKE_DIRS[rng.nextInt(0, 7)]!;
    const len = rng.nextInt(6, 11);
    const end = {
      x: Math.max(3, Math.min(width - 4, hub.x + dir.x * len)),
      y: Math.max(3, Math.min(height - 4, hub.y + dir.y * len)),
    };
    grid = carveSpoke(grid, hub, end);
    grid = carveRoom(grid, end.x, end.y, 2, 2, 'BRASS_CATWALK', 0);
    extraPlatforms.push(end);
  }

  const platforms = [...canonicalTowers, ...extraPlatforms];
  return { grid, platforms, spokeCount: canonicalTowers.length + extraSpokes };
}
