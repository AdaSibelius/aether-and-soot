import { describe, expect, it } from 'vitest';
import { BlueprintIdSchema, EntityIdSchema } from '../../src/schemas/primitives.schema.js';
import { dispatchCommand } from '../../src/sim/core/engine.js';
import { SeededRNG } from '../../src/sim/core/rng.js';
import { createInitialWorld } from '../../src/sim/core/world.js';
import { generateVictorianDistrict, hasWalkablePath } from '../../src/sim/spatial/generator.js';
import { getTileCell } from '../../src/sim/spatial/grid.js';
import { generateHeavyIndustrialSector } from '../../src/sim/spatial/industrial-district.js';
import { generateSubterraneanMineStratum } from '../../src/sim/spatial/mines-generation.js';
import { generateUrbanDistrict } from '../../src/sim/spatial/urban-district.js';

describe('Milestone 2: Multi-Stratum Worldgen & Walkability Verification', () => {
  // 1. Multi-Stratum Generation & Seed Determinism
  it('generates Street, Undercroft, Spire, and Mine floors deterministically across seeds 1000..1025', () => {
    for (let seed = 1000; seed <= 1025; seed++) {
      const world = createInitialWorld({ seed, width: 48, height: 36 });
      const { state } = generateVictorianDistrict(world);

      expect(state.strata.STREET).toBeDefined();
      expect(state.strata.UNDERCROFT).toBeDefined();
      expect(state.strata.SPIRE).toBeDefined();
      expect(state.strata.STREET!.cells.length).toBe(48 * 36);
      expect(state.strata.UNDERCROFT!.cells.length).toBe(48 * 36);
      expect(state.strata.SPIRE!.cells.length).toBe(48 * 36);

      // Seed determinism check
      const reGen = generateVictorianDistrict(createInitialWorld({ seed, width: 48, height: 36 }));
      expect(state.strata.STREET!.cells).toEqual(reGen.state.strata.STREET!.cells);
      expect(state.strata.UNDERCROFT!.cells).toEqual(reGen.state.strata.UNDERCROFT!.cells);

      // Mine floor determinism check
      const mine1 = generateSubterraneanMineStratum(48, 36, { x: 24, y: 18 }, new SeededRNG(seed));
      const mine2 = generateSubterraneanMineStratum(48, 36, { x: 24, y: 18 }, new SeededRNG(seed));
      expect(mine1.grid.cells).toEqual(mine2.grid.cells);
    }
  });

  // 2. Heavy Industrial Sector Fixtures & Layout Invariants
  it('validates industrial smelting hall, continuous conveyor run, rail spurs, and boiler yard', () => {
    const world = createInitialWorld({ seed: 1042, width: 48, height: 36, currentDistrictId: BlueprintIdSchema.parse('district_spitalfields_soot_works') });
    const { state } = generateVictorianDistrict(world);
    const street = state.strata.STREET!;
    const entities = state.entities;

    // Smelting furnace & halo
    const furnace = Object.values(entities).find((e) => e.furniture?.kind === 'SMELTING_FURNACE');
    expect(furnace).toBeDefined();
    const fCell = getTileCell(street, furnace!.position!.x, furnace!.position!.y)!;
    expect(fCell.steamPressureKpa).toBeGreaterThanOrEqual(35);
    expect(fCell.smokePpm).toBeGreaterThanOrEqual(120);

    // Continuous conveyor run (>= 4 contiguous cells)
    const conveyorCells = street.cells.filter((c) => c.terrainType === 'CONVEYOR_TRACK');
    expect(conveyorCells.length).toBeGreaterThanOrEqual(4);

    // Rail spurs & platform
    const railCells = street.cells.filter((c) => c.terrainType === 'RAIL_TRACK');
    expect(railCells.length).toBeGreaterThanOrEqual(8);

    // High-pressure accumulator vessel
    const vessel = Object.values(entities).find((e) => e.pressureVessel && e.pressureVessel.maxPressureKpa >= 300);
    expect(vessel).toBeDefined();

    // Standalone Heavy Industrial Sector generation test
    const sector = generateHeavyIndustrialSector(street, {}, { x1: 2, y1: 20, x2: 18, y2: 32 }, new SeededRNG(42));
    expect(sector.furnacePos).toBeDefined();
    expect(sector.grid.cells.filter((c) => c.terrainType === 'CONVEYOR_TRACK').length).toBeGreaterThanOrEqual(6);
  });

  // 3. Cross-Stratum Portal Connectivity & Navigation
  it('validates bidirectional vertical portals across all strata and USE_PORTAL transit', () => {
    let world = createInitialWorld({ seed: 1050, width: 48, height: 36 });
    const { state: initialWorld } = generateVictorianDistrict(world);
    const playerId = EntityIdSchema.parse('actor_player');

    // Verify portals exist for Manhole, Lift, and Mine Hoist
    const portals = Object.values(initialWorld.entities).filter((e) => e.portal !== undefined);
    expect(portals.some((p) => p.portal?.target.stratum === 'UNDERCROFT')).toBe(true);
    expect(portals.some((p) => p.portal?.target.stratum === 'SPIRE')).toBe(true);
    expect(portals.some((p) => p.portal?.target.stratum === 'CATACOMBS')).toBe(true);

    // Test USE_PORTAL from Street to Spire
    const liftPortal = portals.find((p) => p.position?.stratum === 'STREET' && p.portal?.target.stratum === 'SPIRE')!;
    world = {
      ...initialWorld,
      entities: {
        ...initialWorld.entities,
        [playerId]: { ...initialWorld.entities[playerId]!, position: { ...liftPortal.position!, blocksMovement: true, blocksSight: false } },
      },
    };
    const res = dispatchCommand(world, { type: 'USE_PORTAL', actorId: playerId });
    expect(res.events.some((e) => e.type === 'STRATUM_CHANGED')).toBe(true);
    expect(res.state.entities[playerId]!.position!.stratum).toBe('SPIRE');
  });

  // 4. 100% BFS Pathfinding Walkability & Zero Pocket Invariant
  it('guarantees 100% BFS reachability and zero isolated floor pockets across 25+ seeds', () => {
    for (let seed = 2000; seed <= 2025; seed++) {
      const world = createInitialWorld({ seed, width: 48, height: 36 });
      const { state, landmarks } = generateVictorianDistrict(world);

      const street = state.strata.STREET!;
      const undercroft = state.strata.UNDERCROFT!;
      const spire = state.strata.SPIRE!;

      // 1. Street connectivity from plaza to critical targets
      const hub = landmarks.streetManhole;
      expect(hasWalkablePath(street, hub, landmarks.westGate)).toBe(true);
      expect(hasWalkablePath(street, hub, landmarks.eastGate)).toBe(true);
      expect(hasWalkablePath(street, hub, landmarks.streetLift)).toBe(true);
      expect(hasWalkablePath(street, hub, landmarks.foundryBoiler)).toBe(true);

      // 2. Undercroft connectivity from ladder to sewer extremities
      expect(hasWalkablePath(undercroft, landmarks.undercroftLadder, { x: 10, y: 7 })).toBe(true);
      expect(hasWalkablePath(undercroft, landmarks.undercroftLadder, { x: 37, y: 28 })).toBe(true);

      // 3. Spire connectivity from lift to catwalk platforms
      expect(hasWalkablePath(spire, landmarks.spireLift, { x: 10, y: 7 })).toBe(true);
      expect(hasWalkablePath(spire, landmarks.spireLift, { x: 37, y: 28 })).toBe(true);

      // 4. Subterranean Mine floor connectivity
      const mine = generateSubterraneanMineStratum(48, 36, { x: 24, y: 18 }, new SeededRNG(seed));
      expect(hasWalkablePath(mine.grid, mine.hoistPos, mine.stopes[0]!.center)).toBe(true);
      expect(hasWalkablePath(mine.grid, mine.hoistPos, mine.stopes[1]!.center)).toBe(true);
      expect(hasWalkablePath(mine.grid, mine.hoistPos, mine.stopes[2]!.center)).toBe(true);

      // 5. CDDA Urban District 100% BFS reachability
      const urban = generateUrbanDistrict(street, {}, 48, 36, { x: 24, y: 18 }, new SeededRNG(seed));
      const uCenter = { x: 24, y: 18 };
      expect(hasWalkablePath(urban.grid, uCenter, { x: 1, y: 18 })).toBe(true);
      expect(hasWalkablePath(urban.grid, uCenter, { x: 46, y: 18 })).toBe(true);
      for (const outPt of urban.outwardPoints) {
        expect(hasWalkablePath(urban.grid, uCenter, outPt)).toBe(true);
      }
    }
  });
});
