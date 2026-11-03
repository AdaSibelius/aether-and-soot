import { describe, expect, it } from 'vitest';
import { EntityRecord } from '../../src/schemas/components.schema.js';
import { EntityIdSchema, Point2D } from '../../src/schemas/primitives.schema.js';
import { Box } from '../../src/sim/spatial/block-geometry.js';
import { createStratumGrid, setTileCell } from '../../src/sim/spatial/grid.js';
import {
  detectBlockedDoorways,
  detectBuildingOverlaps,
  detectBuildingRoadCollisions,
  detectDisconnectedPathways,
  detectWallCollisions,
  runSpatialAnomalyAudit,
} from '../../src/sim/spatial/spatial-anomaly-detector.js';
import { PlacedBuildingSurvey, SpatialAnomalySchema } from '../../src/sim/spatial/spatial-survey-types.js';

function deepFreeze<T>(obj: T): Readonly<T> {
  if (obj === null || typeof obj !== 'object') return obj;
  Object.freeze(obj);
  for (const key of Object.keys(obj)) {
    const val = (obj as Record<string, unknown>)[key];
    if (val !== null && typeof val === 'object' && !Object.isFrozen(val)) {
      deepFreeze(val);
    }
  }
  return obj;
}

describe('Adversarial Stress Harness: Spatial Anomaly Detector', () => {
  it('1. handles identical bounding boxes and multi-way building collisions', () => {
    // 1A. Exactly identical bounding boxes for 2 buildings
    const bld1: PlacedBuildingSurvey = { id: 'b1', templateId: 't1', archetypeId: 'TAVERN', bounds: { x1: 5, y1: 5, x2: 15, y2: 15 }, entrancePoints: [], outwardPoints: [], doors: {} };
    const bld2: PlacedBuildingSurvey = { id: 'b2', templateId: 't2', archetypeId: 'TENEMENT', bounds: { x1: 5, y1: 5, x2: 15, y2: 15 }, entrancePoints: [], outwardPoints: [], doors: {} };
    const overlaps2 = detectBuildingOverlaps([bld1, bld2]);
    expect(overlaps2).toHaveLength(1);
    expect(overlaps2[0]).toMatchObject({ type: 'BUILDING_OVERLAP', severity: 'FATAL', position: { x: 5, y: 5 }, targetId: 'b1' });

    // 1B. 4 buildings all mutually overlapping on the identical footprint (N*(N-1)/2 = 6 overlaps)
    const bld3: PlacedBuildingSurvey = { id: 'b3', templateId: 't3', archetypeId: 'SALON', bounds: { x1: 5, y1: 5, x2: 15, y2: 15 }, entrancePoints: [], outwardPoints: [], doors: {} };
    const bld4: PlacedBuildingSurvey = { id: 'b4', templateId: 't4', archetypeId: 'FOUNDRY', bounds: { x1: 5, y1: 5, x2: 15, y2: 15 }, entrancePoints: [], outwardPoints: [], doors: {} };
    const overlaps4 = detectBuildingOverlaps([bld1, bld2, bld3, bld4]);
    expect(overlaps4).toHaveLength(6);
    expect(overlaps4.every((a) => a.type === 'BUILDING_OVERLAP' && a.severity === 'FATAL')).toBe(true);

    // 1C. Multi-way chain overlap: bA-bB, bB-bC, bC-bD (bA and bD do not overlap)
    const chainA: PlacedBuildingSurvey = { id: 'cA', templateId: 't1', archetypeId: 'TAVERN', bounds: { x1: 2, y1: 2, x2: 6, y2: 6 }, entrancePoints: [], outwardPoints: [], doors: {} };
    const chainB: PlacedBuildingSurvey = { id: 'cB', templateId: 't2', archetypeId: 'TAVERN', bounds: { x1: 5, y1: 5, x2: 9, y2: 9 }, entrancePoints: [], outwardPoints: [], doors: {} };
    const chainC: PlacedBuildingSurvey = { id: 'cC', templateId: 't3', archetypeId: 'TAVERN', bounds: { x1: 8, y1: 8, x2: 12, y2: 12 }, entrancePoints: [], outwardPoints: [], doors: {} };
    const chainD: PlacedBuildingSurvey = { id: 'cD', templateId: 't4', archetypeId: 'TAVERN', bounds: { x1: 15, y1: 15, x2: 20, y2: 20 }, entrancePoints: [], outwardPoints: [], doors: {} };
    const chainOverlaps = detectBuildingOverlaps([chainA, chainB, chainC, chainD]);
    expect(chainOverlaps).toHaveLength(2); // cA-cB and cB-cC

    // 1D. Multi-way road collisions: 3 buildings encroaching into same street corridor
    const corridor: Box = { x1: 1, y1: 16, x2: 46, y2: 18 };
    const roadB1: PlacedBuildingSurvey = { id: 'rb1', templateId: 't1', archetypeId: 'TAVERN', bounds: { x1: 5, y1: 15, x2: 10, y2: 20 }, entrancePoints: [], outwardPoints: [], doors: {} };
    const roadB2: PlacedBuildingSurvey = { id: 'rb2', templateId: 't2', archetypeId: 'TAVERN', bounds: { x1: 12, y1: 17, x2: 18, y2: 22 }, entrancePoints: [], outwardPoints: [], doors: {} };
    const roadB3: PlacedBuildingSurvey = { id: 'rb3', templateId: 't3', archetypeId: 'TAVERN', bounds: { x1: 25, y1: 14, x2: 30, y2: 19 }, entrancePoints: [], outwardPoints: [], doors: {} };
    const roadColls = detectBuildingRoadCollisions([roadB1, roadB2, roadB3], [corridor]);
    expect(roadColls).toHaveLength(3);
    expect(roadColls.every((a) => a.type === 'BUILDING_ROAD_COLLISION' && a.severity === 'FATAL')).toBe(true);
  });

  it('2. handles degenerate and out-of-bounds coordinates for portals, hubs, targets, and doorways', () => {
    const grid = createStratumGrid('STREET', 48, 36);

    // 2A. Degenerate & OOB hubs
    expect(detectDisconnectedPathways(grid, { x: -10, y: 5 }, [])).toMatchObject([{ id: 'anom_hub_oob', severity: 'FATAL' }]);
    expect(detectDisconnectedPathways(grid, { x: 500, y: 100 }, [])).toMatchObject([{ id: 'anom_hub_oob', severity: 'FATAL' }]);
    expect(detectDisconnectedPathways(grid, { x: 0, y: 0 }, [])).toMatchObject([{ id: 'anom_hub_blk', severity: 'FATAL' }]);

    // 2B. Degenerate & OOB portals
    const oobPortals: Point2D[] = [{ x: -5, y: 10 }, { x: 99, y: 99 }, { x: 10, y: -2 }];
    const portalAnoms = detectWallCollisions(grid, oobPortals, []);
    expect(portalAnoms).toHaveLength(3);
    expect(portalAnoms.every((a) => a.type === 'WALL_COLLISION' && a.severity === 'FATAL')).toBe(true);

    // 2C. Trapped portal with 0 walkable neighbors & portal placed on wall
    let wallGrid = setTileCell(grid, 5, 5, (c) => ({ ...c, terrainType: 'SOOT_BRICK_WALL', blocksMovement: true }));
    expect(detectWallCollisions(wallGrid, [{ x: 5, y: 5 }], [])).toMatchObject([{ id: 'anom_ptl_wall_5_5', severity: 'FATAL' }]);
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      wallGrid = setTileCell(wallGrid, 12 + dx, 12 + dy, (c) => ({ ...c, terrainType: 'SOOT_BRICK_WALL', blocksMovement: true }));
    }
    expect(detectWallCollisions(wallGrid, [{ x: 12, y: 12 }], [])).toMatchObject([{ id: 'anom_ptl_trp_12_12', severity: 'ERROR' }]);

    // 2D. Degenerate & OOB targets: empirical test of Zod schema boundary condition
    const hub = { x: 24, y: 18 };
    const degTargets: Point2D[] = [{ x: -1, y: 5 }, { x: 100, y: 20 }, { x: 30, y: -4 }];
    const tgtAnoms = detectDisconnectedPathways(grid, hub, degTargets);
    expect(tgtAnoms).toHaveLength(3);
    expect(tgtAnoms.every((a) => a.type === 'DISCONNECTED_PATHWAY' && a.severity === 'FATAL')).toBe(true);
    // Positive OOB target passes SpatialAnomalySchema validation cleanly
    expect(SpatialAnomalySchema.safeParse(tgtAnoms[1]).success).toBe(true);
    // Negative OOB target fails SpatialAnomalySchema because Point2DSchema requires nonnegative
    expect(SpatialAnomalySchema.safeParse(tgtAnoms[0]).success).toBe(false);

    // 2E. Degenerate doorways (door OOB, door opening OOB, missing outward fallback)
    const degBld: PlacedBuildingSurvey = {
      id: 'deg_bld', templateId: 't1', archetypeId: 'TAVERN', bounds: { x1: 0, y1: 5, x2: 6, y2: 10 },
      entrancePoints: [{ x: 0, y: 7 }, { x: 3, y: 5 }],
      outwardPoints: [],
      doors: { d1: { x: 0, y: 7 }, d2: { x: 3, y: 5 } },
    };
    const doorAnoms = detectBlockedDoorways(grid, {}, [degBld]);
    expect(doorAnoms.length).toBeGreaterThanOrEqual(1);
    expect(doorAnoms.some((a) => a.severity === 'FATAL')).toBe(true);
  });

  it('3. detects massive corridor intrusions with 10+ wall tiles across street corridors', () => {
    let grid = createStratumGrid('STREET', 48, 36);
    const streetCorridor: Box = { x1: 5, y1: 15, x2: 40, y2: 17 };
    const intrudingCoords: Point2D[] = [];

    // Intrude 16 solid wall tiles inside the street corridor
    for (let x = 10; x <= 25; x++) {
      grid = setTileCell(grid, x, 16, (c) => ({ ...c, terrainType: 'SOOT_BRICK_WALL', blocksMovement: true }));
      intrudingCoords.push({ x, y: 16 });
    }

    const collisions = detectWallCollisions(grid, [], [streetCorridor]);
    expect(collisions).toHaveLength(16);
    expect(collisions.every((a) => a.type === 'WALL_COLLISION' && a.severity === 'ERROR')).toBe(true);

    const collisionCoords = collisions.map((a) => `${a.position.x},${a.position.y}`);
    for (const pt of intrudingCoords) {
      expect(collisionCoords).toContain(`${pt.x},${pt.y}`);
    }

    // Partially out-of-bounds corridor should not throw and should detect in-bounds breaches
    const oobCorridor: Box = { x1: -10, y1: 15, x2: 12, y2: 17 };
    const oobCollisions = detectWallCollisions(grid, [], [oobCorridor]);
    expect(oobCollisions.length).toBeGreaterThanOrEqual(3); // x = 10, 11, 12
  });

  it('4. efficiently handles multi-target disconnected pathway floods with 60 isolated targets', () => {
    let grid = createStratumGrid('STREET', 48, 36);
    const hub = { x: 24, y: 18 };

    // Wall off quadrant x: 30..45, y: 5..20
    for (let x = 30; x <= 45; x++) {
      for (let y = 5; y <= 20; y++) {
        if (x === 30 || x === 45 || y === 5 || y === 20) {
          grid = setTileCell(grid, x, y, (c) => ({ ...c, terrainType: 'SOOT_BRICK_WALL', blocksMovement: true }));
        }
      }
    }

    // Flood with 60 targets: 40 in isolated pocket, 10 on solid walls, 10 out of bounds
    const targets: Point2D[] = [];
    for (let x = 32; x <= 39; x++) {
      for (let y = 7; y <= 11; y++) targets.push({ x, y }); // 8 * 5 = 40 targets
    }
    for (let i = 0; i < 10; i++) targets.push({ x: 0, y: i + 1 }); // 10 on border walls
    for (let i = 0; i < 10; i++) targets.push({ x: 100 + i, y: 100 + i }); // 10 out of bounds
    expect(targets).toHaveLength(60);

    const startTime = performance.now();
    const anomalies = detectDisconnectedPathways(grid, hub, targets);
    const elapsedMs = performance.now() - startTime;

    expect(anomalies).toHaveLength(60);
    expect(elapsedMs).toBeLessThan(100);

    const oobCount = anomalies.filter((a) => a.severity === 'FATAL').length;
    const discCount = anomalies.filter((a) => a.severity === 'ERROR').length;
    expect(oobCount).toBe(10);
    expect(discCount).toBe(50);
  });

  it('5. strictly verifies immutability: detector functions and audit never mutate inputs', () => {
    let grid = createStratumGrid('STREET', 48, 36);
    grid = setTileCell(grid, 10, 10, (c) => ({ ...c, terrainType: 'WOODEN_DOOR_CLOSED', blocksMovement: true }));
    grid = setTileCell(grid, 10, 11, (c) => ({ ...c, terrainType: 'WROUGHT_IRON_FENCE', blocksMovement: true }));
    grid = setTileCell(grid, 20, 18, (c) => ({ ...c, terrainType: 'SOOT_BRICK_WALL', blocksMovement: true })); // Corridor breach

    // Wall off target at (40, 30)
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      grid = setTileCell(grid, 40 + dx, 30 + dy, (c) => ({ ...c, terrainType: 'SOOT_BRICK_WALL', blocksMovement: true }));
    }

    const pId = EntityIdSchema.parse('audit_portal_1');
    const bId = EntityIdSchema.parse('audit_blocker_1');
    const entities: Record<string, EntityRecord> = {
      [pId]: {
        id: pId, name: 'Catacomb Shaft', visual: { glyph: 'Ω', fgPrimary: '#D4AF37', fgSecondary: '#fff', bgColor: '#000', shaderFlags: [] },
        position: { x: 4, y: 4, stratum: 'STREET', blocksMovement: false, blocksSight: false },
        portal: { target: { x: 4, y: 4, stratum: 'CATACOMBS' }, bidirectional: true, conductsGas: true, portalLabel: 'Catacomb Shaft', apCost: 100 },
      },
      [bId]: {
        id: bId, name: 'Iron Crate', visual: { glyph: 'B', fgPrimary: '#888', fgSecondary: '#fff', bgColor: '#000', shaderFlags: [] },
        position: { x: 10, y: 11, stratum: 'STREET', blocksMovement: true, blocksSight: false },
      },
    };
    const buildings: PlacedBuildingSurvey[] = [
      { id: 'b_imm_1', templateId: 't1', archetypeId: 'TAVERN', bounds: { x1: 8, y1: 8, x2: 14, y2: 14 }, entrancePoints: [{ x: 10, y: 10 }], outwardPoints: [{ x: 10, y: 11 }], doors: { d: { x: 10, y: 10 } } },
      { id: 'b_imm_2', templateId: 't2', archetypeId: 'FOUNDRY', bounds: { x1: 12, y1: 12, x2: 18, y2: 18 }, entrancePoints: [{ x: 15, y: 18 }], outwardPoints: [{ x: 15, y: 19 }], doors: { d: { x: 15, y: 18 } } },
    ];
    const hub = { x: 24, y: 18 }, targets: Point2D[] = [{ x: 10, y: 11 }, { x: 40, y: 30 }], corridors: Box[] = [{ x1: 1, y1: 17, x2: 46, y2: 19 }], portals: Point2D[] = [{ x: 4, y: 4 }];

    // Snapshot pre-execution state
    const snapshotBefore = JSON.stringify({ grid, entities, buildings, hub, targets, corridors, portals });

    // Deep-freeze all input data structures to trigger immediate runtime TypeError on any attempted mutation
    deepFreeze(grid);
    deepFreeze(entities);
    deepFreeze(buildings);
    deepFreeze(hub);
    deepFreeze(targets);
    deepFreeze(corridors);
    deepFreeze(portals);

    // Execute all 5 detectors and full audit
    const anomOverlaps = detectBuildingOverlaps(buildings);
    const anomDoors = detectBlockedDoorways(grid, entities, buildings);
    const anomWalls = detectWallCollisions(grid, portals, corridors);
    const anomPaths = detectDisconnectedPathways(grid, hub, targets);
    const anomRoads = detectBuildingRoadCollisions(buildings, corridors);
    const auditWithPortals = runSpatialAnomalyAudit(grid, entities, buildings, hub, targets, corridors, portals);
    const auditWithoutPortals = runSpatialAnomalyAudit(grid, entities, buildings, hub, targets, corridors);
    const emptyAudit = runSpatialAnomalyAudit(grid, {}, [], hub, [], []);

    // Verify non-empty results and clean empty execution
    expect(anomOverlaps.length).toBeGreaterThan(0);
    expect(anomDoors.length).toBeGreaterThan(0);
    expect(anomWalls.length).toBeGreaterThan(0);
    expect(anomPaths.length).toBeGreaterThan(0);
    expect(anomRoads.length).toBeGreaterThan(0);
    expect(auditWithPortals.length).toBeGreaterThan(0);
    expect(auditWithoutPortals.length).toBeGreaterThan(0);
    expect(emptyAudit).toHaveLength(0);

    // Snapshot post-execution state and verify 100% byte-for-byte immutability
    const snapshotAfter = JSON.stringify({ grid, entities, buildings, hub, targets, corridors, portals });
    expect(snapshotAfter).toBe(snapshotBefore);
  });
});
