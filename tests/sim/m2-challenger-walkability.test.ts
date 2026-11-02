import { describe, expect, it } from 'vitest';
import { Point2D } from '../../src/schemas/primitives.schema.js';
import { createInitialWorld } from '../../src/sim/core/world.js';
import { generateVictorianDistrict, hasWalkablePath } from '../../src/sim/spatial/generator.js';
import { getTileCell, isWithinBounds, StratumGrid } from '../../src/sim/spatial/grid.js';

function isReachableOrAdjacentReachable(grid: StratumGrid, start: Point2D, target: Point2D): boolean {
  if (hasWalkablePath(grid, start, target)) return true;
  const deltas = [{ dx: 1, dy: 0 }, { dx: -1, dy: 0 }, { dx: 0, dy: 1 }, { dx: 0, dy: -1 }];
  for (const { dx, dy } of deltas) {
    const adj = { x: target.x + dx, y: target.y + dy };
    if (isWithinBounds(grid, adj.x, adj.y)) {
      const cell = getTileCell(grid, adj.x, adj.y);
      if (cell && !cell.blocksMovement && hasWalkablePath(grid, start, adj)) return true;
    }
  }
  return false;
}

function findOrphanedWalkableTiles(grid: StratumGrid, hub: Point2D): Point2D[] {
  const visited = new Set<string>();
  const queue: Point2D[] = [hub];
  const deltas = [{ dx: 1, dy: 0 }, { dx: -1, dy: 0 }, { dx: 0, dy: 1 }, { dx: 0, dy: -1 }];
  while (queue.length > 0) {
    const curr = queue.shift()!;
    const key = `${curr.x},${curr.y}`;
    if (visited.has(key)) continue;
    visited.add(key);
    for (const { dx, dy } of deltas) {
      const nx = curr.x + dx;
      const ny = curr.y + dy;
      if (!isWithinBounds(grid, nx, ny)) continue;
      const cell = getTileCell(grid, nx, ny);
      if (cell && (!cell.blocksMovement || cell.terrainType === 'WOODEN_DOOR_CLOSED' || cell.terrainType === 'WOODEN_DOOR_OPEN')) {
        queue.push({ x: nx, y: ny });
      }
    }
  }

  const orphaned: Point2D[] = [];
  for (let y = 0; y < grid.height; y++) {
    for (let x = 0; x < grid.width; x++) {
      const cell = getTileCell(grid, x, y);
      if (cell && (!cell.blocksMovement || cell.terrainType === 'WOODEN_DOOR_CLOSED' || cell.terrainType === 'WOODEN_DOOR_OPEN')) {
        if (!visited.has(`${x},${y}`)) {
          orphaned.push({ x, y });
        }
      }
    }
  }
  return orphaned;
}

describe('Milestone 2 Adversarial Walkability & Determinism Challenge (Seeds 3000..3100)', () => {
  const SEED_START = 3000;
  const SEED_END = 3100;
  const SEWER_EXTREMITIES: readonly Point2D[] = [
    { x: 10, y: 7 },
    { x: 37, y: 7 },
    { x: 10, y: 28 },
    { x: 37, y: 28 },
  ];
  const SPIRE_PLATFORMS: readonly Point2D[] = [
    { x: 10, y: 7 },
    { x: 37, y: 7 },
    { x: 10, y: 28 },
    { x: 37, y: 28 },
  ];

  it('verifies bit-exact multi-seed regeneration across seeds 3000..3100', () => {
    for (let seed = SEED_START; seed <= SEED_END; seed++) {
      const worldA = createInitialWorld({ seed, width: 48, height: 36 });
      const { state: stateA } = generateVictorianDistrict(worldA);
      const worldB = createInitialWorld({ seed, width: 48, height: 36 });
      const { state: stateB } = generateVictorianDistrict(worldB);

      expect(stateA.strata.STREET!.cells).toEqual(stateB.strata.STREET!.cells);
      expect(stateA.strata.UNDERCROFT!.cells).toEqual(stateB.strata.UNDERCROFT!.cells);
      expect(stateA.strata.SPIRE!.cells).toEqual(stateB.strata.SPIRE!.cells);
      expect(stateA.entities).toEqual(stateB.entities);
    }
  });

  it('verifies 100% BFS reachability from plaza manhole to building entrance doors', () => {
    const failures: string[] = [];
    for (let seed = SEED_START; seed <= SEED_END; seed++) {
      const world = createInitialWorld({ seed, width: 48, height: 36 });
      const { state, landmarks } = generateVictorianDistrict(world);
      const street = state.strata.STREET!;

      for (const [doorKey, doorPos] of Object.entries(landmarks.doors ?? {})) {
        if (!isReachableOrAdjacentReachable(street, landmarks.streetManhole, doorPos)) {
          failures.push(`Seed ${seed}: door ${doorKey} at (${doorPos.x},${doorPos.y}) unreachable from manhole`);
        }
      }
    }
    expect(failures).toEqual([]);
  });

  it('verifies 100% BFS reachability from Undercroft ladder to sewer quadrant extremities and siphons', () => {
    const failures: string[] = [];
    for (let seed = SEED_START; seed <= SEED_END; seed++) {
      const world = createInitialWorld({ seed, width: 48, height: 36 });
      const { state, landmarks } = generateVictorianDistrict(world);
      const under = state.strata.UNDERCROFT!;

      for (const extremity of SEWER_EXTREMITIES) {
        if (!hasWalkablePath(under, landmarks.undercroftLadder, extremity)) {
          failures.push(`Seed ${seed}: sewer extremity (${extremity.x},${extremity.y}) unreachable`);
        }
      }

      for (const siphon of landmarks.sewerDrops ?? []) {
        if (!hasWalkablePath(under, landmarks.undercroftLadder, siphon)) {
          failures.push(`Seed ${seed}: sewer siphon (${siphon.x},${siphon.y}) unreachable`);
        }
      }
    }
    expect(failures).toEqual([]);
  });

  it('verifies 100% BFS reachability from Spire lift landing to all catwalk platforms', () => {
    const failures: string[] = [];
    for (let seed = SEED_START; seed <= SEED_END; seed++) {
      const world = createInitialWorld({ seed, width: 48, height: 36 });
      const { state, landmarks } = generateVictorianDistrict(world);
      const spire = state.strata.SPIRE!;

      for (const platform of SPIRE_PLATFORMS) {
        if (!hasWalkablePath(spire, landmarks.spireLift, platform)) {
          failures.push(`Seed ${seed}: Spire platform (${platform.x},${platform.y}) unreachable from lift (${landmarks.spireLift.x},${landmarks.spireLift.y})`);
        }
      }
    }
    expect(failures).toEqual([]);
  });

  it('verifies zero orphaned or unreachable walkable floor pockets across all strata', () => {
    const failures: string[] = [];
    for (let seed = SEED_START; seed <= SEED_END; seed++) {
      const world = createInitialWorld({ seed, width: 48, height: 36 });
      const { state, landmarks } = generateVictorianDistrict(world);

      const streetOrphans = findOrphanedWalkableTiles(state.strata.STREET!, landmarks.streetManhole);
      if (streetOrphans.length > 0) {
        failures.push(`Seed ${seed}: STREET has ${streetOrphans.length} orphaned tiles (e.g. (${streetOrphans[0]!.x},${streetOrphans[0]!.y}))`);
      }

      const underOrphans = findOrphanedWalkableTiles(state.strata.UNDERCROFT!, landmarks.undercroftLadder);
      if (underOrphans.length > 0) {
        failures.push(`Seed ${seed}: UNDERCROFT has ${underOrphans.length} orphaned tiles`);
      }

      const spireOrphans = findOrphanedWalkableTiles(state.strata.SPIRE!, landmarks.spireLift);
      if (spireOrphans.length > 0) {
        failures.push(`Seed ${seed}: SPIRE has ${spireOrphans.length} orphaned tiles (e.g. (${spireOrphans[0]!.x},${spireOrphans[0]!.y}))`);
      }
    }
    expect(failures).toEqual([]);
  });

  it('verifies 100% BFS reachability from central plaza manhole to all four compass gates (West, East, North, South)', () => {
    const failures: string[] = [];
    for (let seed = SEED_START; seed <= SEED_END; seed++) {
      const world = createInitialWorld({ seed, width: 48, height: 36 });
      const { state, landmarks } = generateVictorianDistrict(world);
      const street = state.strata.STREET!;
      const manhole = landmarks.streetManhole;

      if (!hasWalkablePath(street, manhole, landmarks.westGate)) {
        failures.push(`Seed ${seed}: West gate (${landmarks.westGate.x},${landmarks.westGate.y}) unreachable`);
      }
      if (!hasWalkablePath(street, manhole, landmarks.eastGate)) {
        failures.push(`Seed ${seed}: East gate (${landmarks.eastGate.x},${landmarks.eastGate.y}) unreachable`);
      }
      if (landmarks.northGate && !hasWalkablePath(street, manhole, landmarks.northGate)) {
        failures.push(`Seed ${seed}: North gate (${landmarks.northGate.x},${landmarks.northGate.y}) unreachable`);
      }
      if (landmarks.southGate && !hasWalkablePath(street, manhole, landmarks.southGate)) {
        failures.push(`Seed ${seed}: South gate (${landmarks.southGate.x},${landmarks.southGate.y}) unreachable`);
      }
    }
    expect(failures).toEqual([]);
  });
});
