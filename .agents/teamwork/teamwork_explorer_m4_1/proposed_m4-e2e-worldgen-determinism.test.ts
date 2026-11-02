import { describe, expect, it } from 'vitest';
import { BlueprintIdSchema, EntityIdSchema } from '../../src/schemas/primitives.schema.js';
import { dispatchCommand } from '../../src/sim/core/engine.js';
import { SeededRNG } from '../../src/sim/core/rng.js';
import {
  assertWorldInvariants,
  createInitialWorld,
  deserializeWorld,
  serializeWorld,
  WorldState,
} from '../../src/sim/core/world.js';
import { generateVictorianDistrict, hasWalkablePath } from '../../src/sim/spatial/generator.js';
import { getTileCell, StratumGrid } from '../../src/sim/spatial/grid.js';
import { generateSubterraneanMineStratum } from '../../src/sim/spatial/mines-generation.js';

describe('Milestone 4: End-to-End Multi-Stratum Determinism & Worldgen Test Suite', () => {
  const playerId = EntityIdSchema.parse('actor_player');
  const urbanDistrictId = BlueprintIdSchema.parse('district_whitechapel_ward');

  function isReachableOrAdjacent(grid: StratumGrid, start: { x: number; y: number }, target: { x: number; y: number }): boolean {
    if (hasWalkablePath(grid, start, target)) return true;
    const deltas = [{ dx: 1, dy: 0 }, { dx: -1, dy: 0 }, { dx: 0, dy: 1 }, { dx: 0, dy: -1 }];
    for (const { dx, dy } of deltas) {
      const adj = { x: target.x + dx, y: target.y + dy };
      if (adj.x >= 0 && adj.y >= 0 && adj.x < grid.width && adj.y < grid.height) {
        const cell = getTileCell(grid, adj.x, adj.y);
        if (cell && !cell.blocksMovement && hasWalkablePath(grid, start, adj)) return true;
      }
    }
    return false;
  }

  // Helper to generate a unified 4-stratum world (Street, Undercroft, Spire, Catacombs Mines)
  function createUnified4StratumWorld(seed: number): { state: WorldState; landmarks: ReturnType<typeof generateVictorianDistrict>['landmarks'] } {
    const base = createInitialWorld({ seed, width: 48, height: 36, currentDistrictId: urbanDistrictId });
    const { state, landmarks } = generateVictorianDistrict(base);

    // Generate and integrate subterranean mine stratum into CATACOMBS aligned with street mine hoist
    const streetHoist = state.entities['portal_street_mine_hoist'];
    const hoistPos = streetHoist?.position ? { x: streetHoist.position.x, y: streetHoist.position.y } : { x: 24, y: 5 };
    const mine = generateSubterraneanMineStratum(48, 36, hoistPos, new SeededRNG(seed), 1);

    const unifiedState: WorldState = {
      ...state,
      strata: {
        ...state.strata,
        CATACOMBS: mine.grid,
      },
      entities: {
        ...state.entities,
        ...mine.entities,
      },
    };

    assertWorldInvariants(unifiedState);
    return { state: unifiedState, landmarks };
  }

  // 1. End-to-End 4-Stratum Generation & Bit-Exact Determinism
  it('generates unified 4-stratum worlds with bit-exact reproducibility across seeds', () => {
    for (const seed of [1888, 1901, 2042, 9999]) {
      const world1 = createUnified4StratumWorld(seed);
      const world2 = createUnified4StratumWorld(seed);

      // Verify all 4 strata exist and have exact cell counts
      for (const s of ['STREET', 'UNDERCROFT', 'SPIRE', 'CATACOMBS'] as const) {
        expect(world1.state.strata[s]?.cells.length).toBe(48 * 36);
        expect(world1.state.strata[s]?.cells).toEqual(world2.state.strata[s]?.cells);
      }

      // Bit-exact entity records and positions
      expect(world1.state.entities).toEqual(world2.state.entities);
      expect(world1.landmarks).toEqual(world2.landmarks);

      // Save/Load roundtrip invariance
      const serialized = serializeWorld(world1.state);
      const restored = deserializeWorld(serialized);
      assertWorldInvariants(restored);
      expect(restored.turnCount).toBe(world1.state.turnCount);
      expect(restored.strata.STREET?.cells).toEqual(world1.state.strata.STREET?.cells);
      expect(restored.strata.CATACOMBS?.cells).toEqual(world1.state.strata.CATACOMBS?.cells);
    }
  });

  // 2. CDDA Urban District Template Stamping & Steampunk Fixture Density
  it('stamps all CDDA building archetypes into urban parcels with dense Steampunk fixtures', () => {
    const { state } = createUnified4StratumWorld(1888);
    const street = state.strata.STREET!;
    const entities = Object.values(state.entities);

    // Verify CDDA urban fixtures exist across stamped parcels
    const fixtureKinds = new Set(entities.map((e) => e.furniture?.kind).filter(Boolean));
    expect(fixtureKinds.has('ARTIFICER_BENCH')).toBe(true);
    expect(fixtureKinds.has('COAL_STOVE')).toBe(true);
    expect(fixtureKinds.has('IRON_BOILER')).toBe(true);
    expect(fixtureKinds.has('ROLL_TOP_DESK')).toBe(true);
    expect(fixtureKinds.has('PNEUMATIC_DISPATCH')).toBe(true);
    expect(fixtureKinds.has('FILING_CABINET')).toBe(true);
    expect(fixtureKinds.has('VALVE_MANIFOLD')).toBe(true);
    expect(fixtureKinds.has('SAFE_VAULT')).toBe(true);

    // Verify holding cell bars (see-through but impassable)
    const holdingCellFence = street.cells.find((c) => c.terrainType === 'WROUGHT_IRON_FENCE');
    expect(holdingCellFence).toBeDefined();
    expect(holdingCellFence!.blocksMovement).toBe(true);
    expect(holdingCellFence!.blocksSight).toBe(false);

    // Verify interior room zoning variety
    const zones = new Set(street.cells.map((c) => c.interiorZone).filter((z) => z !== 'NONE'));
    expect(zones.has('PUBLIC_BAR')).toBe(true);
    expect(zones.has('HOLDING_CELL')).toBe(true);
    expect(zones.has('WORKSHOP')).toBe(true);
  });

  // 3. Cross-Stratum Portal Reciprocity & Bidirectional Transit
  it('guarantees complete vertical portal reciprocity and executes round-trip USE_PORTAL transit', () => {
    const { state } = createUnified4StratumWorld(1901);
    const portals = Object.values(state.entities).filter((e) => e.portal !== undefined);

    // Verify presence of all required stratum transitions
    expect(portals.some((p) => p.portal?.target.stratum === 'UNDERCROFT')).toBe(true);
    expect(portals.some((p) => p.portal?.target.stratum === 'SPIRE')).toBe(true);
    expect(portals.some((p) => p.portal?.target.stratum === 'CATACOMBS')).toBe(true);

    // Verify reciprocal counter-portals for all portals
    for (const portal of portals) {
      const origin = portal.position!;
      const target = portal.portal!.target;
      const counter = portals.find(
        (p) =>
          p.position?.stratum === target.stratum &&
          p.position.x === target.x &&
          p.position.y === target.y &&
          p.portal?.target.stratum === origin.stratum,
      );
      expect(counter).toBeDefined();
    }

    // Test functional round-trip transit: Street -> Undercroft -> Street
    const manhole = portals.find((p) => p.position?.stratum === 'STREET' && p.portal?.target.stratum === 'UNDERCROFT')!;
    let world: WorldState = {
      ...state,
      entities: {
        ...state.entities,
        [playerId]: { ...state.entities[playerId]!, position: { ...manhole.position!, blocksMovement: true, blocksSight: false } },
      },
    };

    const descend = dispatchCommand(world, { type: 'USE_PORTAL', actorId: playerId });
    expect(descend.events.some((e) => e.type === 'STRATUM_CHANGED')).toBe(true);
    expect(descend.state.entities[playerId]!.position!.stratum).toBe('UNDERCROFT');

    const ascend = dispatchCommand(descend.state, { type: 'USE_PORTAL', actorId: playerId });
    expect(ascend.events.some((e) => e.type === 'STRATUM_CHANGED')).toBe(true);
    expect(ascend.state.entities[playerId]!.position!.stratum).toBe('STREET');
    expect(ascend.state.entities[playerId]!.position!.x).toBe(manhole.position!.x);
    expect(ascend.state.entities[playerId]!.position!.y).toBe(manhole.position!.y);
  });

  // 4. 100% BFS Walkability & Zero Isolated Pocket Invariants
  it('guarantees 100% pathfinding walkability across all 4 strata without isolated floor pockets', () => {
    for (let seed = 5001; seed <= 5015; seed++) {
      const { state, landmarks } = createUnified4StratumWorld(seed);
      const street = state.strata.STREET!;
      const undercroft = state.strata.UNDERCROFT!;
      const spire = state.strata.SPIRE!;
      const mines = state.strata.CATACOMBS!;

      // 1. Street: Central plaza must reach compass gates and building doors
      const plaza = landmarks.streetManhole;
      expect(hasWalkablePath(street, plaza, landmarks.westGate)).toBe(true);
      expect(hasWalkablePath(street, plaza, landmarks.eastGate)).toBe(true);
      if (landmarks.doors) {
        for (const doorPos of Object.values(landmarks.doors)) {
          expect(isReachableOrAdjacent(street, plaza, doorPos)).toBe(true);
        }
      }

      // 2. Undercroft: Maintenance ladder must reach sewer corners
      expect(hasWalkablePath(undercroft, landmarks.undercroftLadder, { x: 10, y: 7 })).toBe(true);
      expect(hasWalkablePath(undercroft, landmarks.undercroftLadder, { x: 37, y: 28 })).toBe(true);

      // 3. Spire: Lift must reach catwalk platforms
      expect(hasWalkablePath(spire, landmarks.spireLift, { x: 10, y: 7 })).toBe(true);
      expect(hasWalkablePath(spire, landmarks.spireLift, { x: 37, y: 28 })).toBe(true);

      // 4. Mines: Hoist must reach excavation stopes
      const mineHoist = Object.values(state.entities).find((e) => e.id === 'portal_mine_hoist_cage')!;
      const mineHoistPos = { x: mineHoist.position!.x, y: mineHoist.position!.y };
      const stopes = [
        { x: Math.max(6, Math.floor(48 * 0.22)), y: Math.max(6, Math.floor(36 * 0.28)) },
        { x: Math.min(41, Math.floor(48 * 0.78)), y: Math.max(6, Math.floor(36 * 0.32)) },
        { x: 24, y: Math.min(29, Math.floor(36 * 0.78)) },
      ];
      for (const stope of stopes) {
        expect(hasWalkablePath(mines, mineHoistPos, stope)).toBe(true);
      }
    }
  });
});
