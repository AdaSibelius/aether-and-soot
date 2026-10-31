import { Point2D, TerrainType } from '../../schemas/primitives.schema.js';
import { SeededRNG } from '../core/rng.js';
import { getArchitecturalTerrainProperties } from './architectural-features.js';
import { Box } from './district-blocks.js';
import { hasWalkablePath } from './district-layout.js';
import { StratumGrid, TileCell } from './grid.js';

const YARD_PALETTE: readonly { terrain: TerrainType; weight: number }[] = [
  { terrain: 'SOOT_BRICK_WALL', weight: 3 },
  { terrain: 'COBBLESTONE_FLOOR', weight: 3 },
  { terrain: 'RUBBLE_PILE', weight: 2 },
  { terrain: 'SLAG_MOUND', weight: 1 },
  { terrain: 'WROUGHT_IRON_FENCE', weight: 1 },
  { terrain: 'IRON_GRATE', weight: 1 },
  { terrain: 'GASLAMP_POST', weight: 1 },
  { terrain: 'BRASS_STEAM_PIPE', weight: 1 },
];
const TOTAL_WEIGHT = YARD_PALETTE.reduce((sum, p) => sum + p.weight, 0);

function drawTerrain(rng: SeededRNG): TerrainType {
  let roll = rng.nextInt(0, TOTAL_WEIGHT - 1);
  for (const entry of YARD_PALETTE) {
    if (roll < entry.weight) return entry.terrain;
    roll -= entry.weight;
  }
  return 'SOOT_BRICK_WALL';
}

function applyTerrain(cell: TileCell, terrain: TerrainType): TileCell {
  const props = getArchitecturalTerrainProperties(terrain);
  return { ...cell, terrainType: terrain, blocksMovement: props.blocksMovement, blocksSight: props.blocksSight };
}

/**
 * Stage 4/5 plot fill: every pristine solid tile outside a building footprint becomes part of a seeded Voronoi
 * patchwork of yards (cobbled courts, rubble, slag, fencing, gaslamps, pipework) so unbuilt plots differ per seed.
 * AUD-02: Restricts GASLAMP_POST, WROUGHT_IRON_FENCE, and BRASS_STEAM_PIPE to point/linear placements rather than
 * solid blobs, and ensures all walkable yard cells connect to the main street network.
 */
export function fillUnbuiltYards(grid: StratumGrid, footprints: readonly Box[], rng: SeededRNG): StratumGrid {
  const { width, height } = grid;
  const siteCount = Math.max(12, Math.floor((width * height) / 36));
  const sites = Array.from({ length: siteCount }, () => ({
    x: rng.nextInt(1, width - 2),
    y: rng.nextInt(1, height - 2),
    terrain: drawTerrain(rng),
  }));
  const cells = grid.cells.slice();
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const idx = y * width + x;
      const cell = cells[idx];
      if (!cell || cell.terrainType !== 'SOOT_BRICK_WALL' || (cell.interiorZone ?? 'NONE') !== 'NONE') continue;
      if (footprints.some((b) => x >= b.x1 && x <= b.x2 && y >= b.y1 && y <= b.y2)) continue;
      let best = sites[0]!;
      let bestDist = Number.POSITIVE_INFINITY;
      for (const s of sites) {
        const d = (s.x - x) ** 2 + (s.y - y) ** 2;
        if (d < bestDist) {
          bestDist = d;
          best = s;
        }
      }
      let chosen = best.terrain;
      if (chosen === 'GASLAMP_POST') {
        chosen = x === best.x && y === best.y ? 'GASLAMP_POST' : 'COBBLESTONE_FLOOR';
      } else if (chosen === 'WROUGHT_IRON_FENCE') {
        chosen = y === best.y && x === best.x ? 'WROUGHT_IRON_FENCE' : 'COBBLESTONE_FLOOR';
      } else if (chosen === 'BRASS_STEAM_PIPE') {
        chosen = x === best.x && y === best.y ? 'BRASS_STEAM_PIPE' : 'COBBLESTONE_FLOOR';
      }
      cells[idx] = applyTerrain(cell, chosen);
    }
  }

  // Seal isolated walkable yard pockets that cannot reach the central plaza so 0 unreachable floor pockets exist
  const centerX = Math.floor(width / 2);
  const centerY = height >= 36 ? 18 : Math.floor(height / 2);
  const reachable = new Set<number>();
  const startIdx = centerY * width + centerX;
  if (cells[startIdx] && !cells[startIdx]!.blocksMovement) {
    const queue: number[] = [startIdx];
    reachable.add(startIdx);
    while (queue.length > 0) {
      const curr = queue.shift()!;
      const cx = curr % width;
      const cy = Math.floor(curr / width);
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
        const nx = cx + dx;
        const ny = cy + dy;
        if (nx <= 0 || ny <= 0 || nx >= width - 1 || ny >= height - 1) continue;
        const nIdx = ny * width + nx;
        if (reachable.has(nIdx)) continue;
        const nCell = cells[nIdx];
        if (nCell && !nCell.blocksMovement) {
          reachable.add(nIdx);
          queue.push(nIdx);
        }
      }
    }
    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        const idx = y * width + x;
        const cell = cells[idx];
        if (!cell || cell.blocksMovement || (cell.interiorZone ?? 'NONE') !== 'NONE') continue;
        if (footprints.some((b) => x >= b.x1 && x <= b.x2 && y >= b.y1 && y <= b.y2)) continue;
        if (!reachable.has(idx)) {
          cells[idx] = applyTerrain(cell, 'SOOT_BRICK_WALL');
        }
      }
    }
  }

  return { ...grid, cells };
}

/** Cuts an L-shaped passage from `from` toward `to`, converting only blocking tiles outside VAULT zones (AUD-06). */
function punchPath(grid: StratumGrid, from: Point2D, to: Point2D): StratumGrid {
  const cells = grid.cells.slice();
  const open = (x: number, y: number): void => {
    const idx = y * grid.width + x;
    const cell = cells[idx];
    if (!cell || !cell.blocksMovement) return;
    if (cell.interiorZone === 'VAULT') return;
    if (cell.terrainType === 'WOODEN_DOOR_CLOSED') {
      cells[idx] = { ...cell, terrainType: 'WOODEN_DOOR_OPEN', blocksMovement: false, blocksSight: false };
    } else if (cell.terrainType === 'CANAL_SLUICE') {
      cells[idx] = { ...cell, terrainType: 'TIMBER_PIER', blocksMovement: false, blocksSight: false };
    } else {
      cells[idx] = { ...cell, terrainType: 'COBBLESTONE_FLOOR', blocksMovement: false, blocksSight: false };
    }
  };
  let x = from.x;
  let y = from.y;
  open(x, y);
  while (y !== to.y) {
    y += y < to.y ? 1 : -1;
    open(x, y);
  }
  while (x !== to.x) {
    x += x < to.x ? 1 : -1;
    open(x, y);
  }
  return { ...grid, cells };
}

/**
 * TSK-P3-04 invariant gate: BFS from the central plaza to every critical target; any unreachable target gets a
 * punched corridor to the plaza. Returns the repaired grid and the number of corridors punched.
 */
export function ensureDistrictConnectivity(
  grid: StratumGrid,
  start: Point2D,
  targets: readonly Point2D[],
): { grid: StratumGrid; punched: number } {
  let current = grid;
  let punched = 0;
  for (const target of targets) {
    if (hasWalkablePath(current, start, target)) continue;
    current = punchPath(current, target, start);
    punched++;
  }
  return { grid: current, punched };
}
