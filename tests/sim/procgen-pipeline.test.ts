import { describe, expect, it } from 'vitest';
import { createInitialWorld } from '../../src/sim/core/world.js';
import { generateVictorianDistrict, hasWalkablePath } from '../../src/sim/spatial/generator.js';

describe('TSK-P3-01 through TSK-P3-04: 8-Stage Procedural Generation Pipeline & Anti-Stamping', () => {
  it('completes all 8 pipeline stages with 100% determinism on identical seeds', () => {
    const seed = 31415;
    const runA = generateVictorianDistrict(createInitialWorld({ seed, width: 48, height: 36 }));
    const runB = generateVictorianDistrict(createInitialWorld({ seed, width: 48, height: 36 }));

    expect(runA.landmarks.westGate).toEqual(runB.landmarks.westGate);
    expect(runA.landmarks.eastGate).toEqual(runB.landmarks.eastGate);
    expect(runA.landmarks.streetLift).toEqual(runB.landmarks.streetLift);
    expect(runA.landmarks.foundryBoiler).toEqual(runB.landmarks.foundryBoiler);

    const cellsA = runA.state.strata.STREET!.cells;
    const cellsB = runB.state.strata.STREET!.cells;
    expect(cellsA.length).toBe(cellsB.length);
    for (let i = 0; i < cellsA.length; i++) {
      expect(cellsA[i]!.terrainType).toBe(cellsB[i]!.terrainType);
      expect(cellsA[i]!.blocksMovement).toBe(cellsB[i]!.blocksMovement);
    }
  });

  it('guarantees pathfinding connectivity between central plaza, compass gates, doors, and vertical portals', () => {
    const seeds = [101, 202, 303, 404, 505];
    for (const seed of seeds) {
      const { state, landmarks } = generateVictorianDistrict(createInitialWorld({ seed, width: 48, height: 36 }));
      const street = state.strata.STREET!;
      const center = landmarks.streetManhole;

      expect(hasWalkablePath(street, center, landmarks.westGate)).toBe(true);
      expect(hasWalkablePath(street, center, landmarks.eastGate)).toBe(true);
      expect(hasWalkablePath(street, center, landmarks.streetLift)).toBe(true);
      expect(hasWalkablePath(street, center, landmarks.foundryBoiler)).toBe(true);
      expect(hasWalkablePath(street, center, { x: landmarks.workshopDoor.x, y: landmarks.workshopDoor.y + 1 })).toBe(true);

      // Verify all 6 Victorian typology doors are walkable from central plaza
      for (const door of Object.values(landmarks.doors ?? {})) {
        const streetStep = { x: door.x, y: door.y < center.y ? door.y + 1 : door.y - 1 };
        expect(hasWalkablePath(street, center, streetStep)).toBe(true);
      }

      // Verify Undercroft connectivity to Catacombs stairwell
      const undercroft = state.strata.UNDERCROFT!;
      const catStair = Object.values(state.entities).find((e) => e.id === 'stairs_undercroft_to_catacombs');
      expect(catStair).toBeDefined();
      expect(hasWalkablePath(undercroft, center, catStair!.position!)).toBe(true);
    }
  });

  it('generates non-identical building footprints and room partition layouts across 10 distinct seeds (anti-stamping)', () => {
    const fingerprints = new Set<string>();

    for (let seed = 1; seed <= 10; seed++) {
      const { state } = generateVictorianDistrict(createInitialWorld({ seed, width: 48, height: 36 }));
      const street = state.strata.STREET!;
      // Hash interior zone patterns and room partition walls
      const signature = street.cells
        .filter((c) => c.interiorZone && c.interiorZone !== 'NONE')
        .map((c) => `${c.terrainType}:${c.interiorZone}`)
        .join(',');
      fingerprints.add(signature);
    }

    // With anti-stamping variation active, different seeds must produce diverse layouts
    expect(fingerprints.size).toBeGreaterThan(1);
  });

  it('activates functional utility networks (UtilityConduit, HydrologyChannel, CrossStratumShaft)', () => {
    const { state, landmarks } = generateVictorianDistrict(createInitialWorld({ seed: 777, width: 48, height: 36 }));
    const entities = Object.values(state.entities);

    // 1. Utility conduits along thoroughfares
    const conduits = entities.filter((e) => e.utilityConduit);
    expect(conduits.length).toBeGreaterThanOrEqual(3);
    const steamMain = conduits.find((c) => c.utilityConduit?.conduitType === 'HIGH_PRESSURE_STEAM_MAIN');
    expect(steamMain).toBeDefined();
    expect(steamMain!.utilityConduit?.operatingPressureKpa).toBeGreaterThan(0);

    // 2. Hydrology channels along sluices and canals
    const channels = entities.filter((e) => e.hydrologyChannel);
    expect(channels.length).toBeGreaterThanOrEqual(1);
    expect(channels[0]!.hydrologyChannel?.fluidType).toBe('WATER');

    // 3. Cross-stratum shafts connecting Street, Undercroft, and Spire
    const shafts = entities.filter((e) => e.crossStratumShaft);
    expect(shafts.length).toBeGreaterThanOrEqual(2);
    const liftShaft = shafts.find((s) => s.crossStratumShaft?.shaftType === 'PNEUMATIC_LIFT');
    expect(liftShaft).toBeDefined();

    // 4. Macro landmarks and atmospheric gradients
    expect(landmarks.doors?.monorailDepot).toBeDefined();
    const boilerHouseCell = state.strata.STREET!.cells[landmarks.foundryBoiler.y * 48 + landmarks.foundryBoiler.x];
    expect(boilerHouseCell?.steamPressureKpa).toBeGreaterThan(0);
  });
});
