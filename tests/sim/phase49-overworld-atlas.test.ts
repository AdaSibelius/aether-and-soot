import { describe, expect, it } from 'vitest';
import {
  createInitialWorld,
  deserializeWorld,
  serializeWorld,
} from '../../src/sim/core/world.js';
import { generateVictorianDistrict, hasWalkablePath } from '../../src/sim/spatial/generator.js';
import {
  FACTION_INFLUENCE_HEATMAP,
  generateMacroTopographyGrid,
  getAllDistrictDossiers,
  getDistrictDossier,
  getOverworldBarriersForDistrict,
  NATURAL_OVERWORLD_BARRIERS,
  TRANSIT_MONORAIL_ROUTES,
} from '../../src/sim/spatial/overworld-matrix.js';

describe('Phase 49: Large-Scale Overworld Expansion, District Sizing & Multi-Stratum City Atlas', () => {
  it('generates large-scale 64x48 district grids with expanded strata and valid cell counts', () => {
    const baseWorld = createInitialWorld({ seed: 4901, width: 64, height: 48 });
    const { state: world, landmarks } = generateVictorianDistrict(baseWorld);

    expect(world.strata.STREET?.width).toBe(64);
    expect(world.strata.STREET?.height).toBe(48);
    expect(world.strata.STREET?.cells.length).toBe(64 * 48);

    expect(world.strata.UNDERCROFT?.width).toBe(64);
    expect(world.strata.UNDERCROFT?.height).toBe(48);
    expect(world.strata.SPIRE?.width).toBe(64);
    expect(world.strata.SPIRE?.height).toBe(48);

    // Landmarks stay within 64x48 bounds
    expect(landmarks.westGate.x).toBe(1);
    expect(landmarks.eastGate.x).toBe(62);
    expect(landmarks.streetManhole.x).toBe(32);
    expect(landmarks.streetManhole.y).toBe(18);
  });

  it('enriches 64x48 districts with natural barriers and multi-point sewer drops', () => {
    const baseWorld = createInitialWorld({ seed: 4902, width: 64, height: 48 });
    const { state: world, landmarks } = generateVictorianDistrict(baseWorld);

    // Barriers placed in expanded district
    expect(landmarks.barriersPlaced).toBeDefined();
    expect(landmarks.barriersPlaced).toContain('SEWER_DROP');
    expect(landmarks.barriersPlaced).toContain('VIADUCT');
    expect(landmarks.barriersPlaced).toContain('THAMES_CANAL');

    // Multi-point sewer drops registered in landmarks and entity graph
    expect(landmarks.sewerDrops).toBeDefined();
    expect(landmarks.sewerDrops?.length).toBeGreaterThanOrEqual(2);

    const sewer1 = world.entities['portal_sewer_drop_1'];
    const undercroft1 = world.entities['portal_undercroft_ascent_1'];
    expect(sewer1).toBeDefined();
    expect(undercroft1).toBeDefined();

    // Verify bidirectional portal linkage
    expect(sewer1?.portal?.target.stratum).toBe('UNDERCROFT');
    expect(undercroft1?.portal?.target.stratum).toBe('STREET');
    expect(sewer1?.portal?.target.x).toBe(undercroft1?.position?.x);
    expect(sewer1?.portal?.target.y).toBe(undercroft1?.position?.y);
  });

  it('guarantees BFS walkability between all transit gates, sewer drops, and landmarks on 64x48 grids', () => {
    const baseWorld = createInitialWorld({ seed: 4903, width: 64, height: 48 });
    const { state: world, landmarks } = generateVictorianDistrict(baseWorld);
    const street = world.strata.STREET!;
    const center = landmarks.streetManhole;

    // Critical connectivity checks
    expect(hasWalkablePath(street, center, landmarks.westGate)).toBe(true);
    expect(hasWalkablePath(street, center, landmarks.eastGate)).toBe(true);
    expect(hasWalkablePath(street, center, landmarks.streetLift)).toBe(true);
    expect(hasWalkablePath(street, center, landmarks.foundryBoiler)).toBe(true);

    // Multi-point sewer drop walkability
    expect(landmarks.sewerDrops?.length).toBeGreaterThanOrEqual(2);
    for (const drop of landmarks.sewerDrops ?? []) {
      expect(hasWalkablePath(street, center, drop)).toBe(true);
    }
    for (const drop of landmarks.sewerDrops ?? []) {
      expect(hasWalkablePath(street, center, drop)).toBe(true);
    }
  });

  it('provides comprehensive metropolis dossiers, barriers, and faction heatmaps in headless overworld matrix', () => {
    const dossiers = getAllDistrictDossiers();
    expect(dossiers.length).toBe(5);

    const spitalfields = getDistrictDossier('district_spitalfields_soot_works');
    expect(spitalfields).toBeDefined();
    expect(spitalfields?.cartel).toBe('Ironmongers Cartel');
    expect(spitalfields?.landmarks.length).toBeGreaterThanOrEqual(3);

    // Verify natural barriers query
    expect(NATURAL_OVERWORLD_BARRIERS.length).toBeGreaterThanOrEqual(4);
    const barriers = getOverworldBarriersForDistrict('district_spitalfields_soot_works');
    expect(barriers.length).toBeGreaterThanOrEqual(2);

    // Verify total faction control summation
    const totalInfluence = FACTION_INFLUENCE_HEATMAP.reduce((acc, f) => acc + f.influencePct, 0);
    expect(totalInfluence).toBe(100);

    // Verify pneumatic monorail routes
    expect(TRANSIT_MONORAIL_ROUTES.length).toBeGreaterThanOrEqual(3);
    for (const route of TRANSIT_MONORAIL_ROUTES) {
      expect(route.pressureOperatingKpa).toBeGreaterThanOrEqual(200);
      expect(route.status).toBe('ACTIVE');
    }
  });

  it('generates a 20x8 macro-topography grid featuring Thames canal waterways, viaducts, and district hubs', () => {
    const topo = generateMacroTopographyGrid();
    expect(topo.length).toBe(8);
    expect(topo[0]?.length).toBe(20);

    // Flatten and check feature presence
    const allCells = topo.flat();
    const waterCells = allCells.filter((c) => c.feature === 'WATER');
    const viaductCells = allCells.filter((c) => c.feature === 'VIADUCT');
    const wallCells = allCells.filter((c) => c.feature === 'WALL');
    const districtHubs = allCells.filter((c) => c.feature === 'DISTRICT_CORE');

    expect(waterCells.length).toBeGreaterThanOrEqual(10);
    expect(viaductCells.length).toBeGreaterThanOrEqual(3);
    expect(wallCells.length).toBeGreaterThanOrEqual(2);
    expect(districtHubs.length).toBe(5);

    // Verify hub labels
    const hubDistricts = districtHubs.map((h) => h.districtId);
    expect(hubDistricts).toContain('district_spitalfields_soot_works');
    expect(hubDistricts).toContain('district_fleet_ditch_undercroft');
    expect(hubDistricts).toContain('district_belgravia_brass_spires');
    expect(hubDistricts).toContain('district_whitechapel_ward');
    expect(hubDistricts).toContain('district_limehouse_docks');
  });

  it('serializes and deserializes a 64x48 multi-district world state with 100% round-trip fidelity', () => {
    const baseWorld = createInitialWorld({ seed: 4905, width: 64, height: 48 });
    const { state: world } = generateVictorianDistrict(baseWorld);

    const serialized = serializeWorld(world);
    const deserialized = deserializeWorld(serialized);

    expect(deserialized.strata.STREET?.width).toBe(64);
    expect(deserialized.strata.STREET?.height).toBe(48);
    expect(deserialized.strata.STREET?.cells.length).toBe(64 * 48);

    // Verify multi-point sewer drops retained
    expect(deserialized.entities['portal_sewer_drop_1']).toBeDefined();
    expect(deserialized.entities['portal_sewer_drop_2']).toBeDefined();
    expect(deserialized.entities['portal_sewer_drop_1']?.portal?.target.stratum).toBe('UNDERCROFT');
  });
});
