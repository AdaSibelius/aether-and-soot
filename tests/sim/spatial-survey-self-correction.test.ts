import { describe, expect, it } from 'vitest';
import { createStratumGrid, getTileCell, setTileCell } from '../../src/sim/spatial/grid.js';
import { EntityRecord } from '../../src/schemas/components.schema.js';
import { EntityIdSchema } from '../../src/schemas/primitives.schema.js';
import { SeededRNG } from '../../src/sim/core/rng.js';
import { Box } from '../../src/sim/spatial/block-geometry.js';
import { generateUrbanDistrict, getUrbanStreetSpec } from '../../src/sim/spatial/urban-district.js';
import {
  PlacedBuildingSurvey,
  SpatialAnomaly,
} from '../../src/sim/spatial/spatial-survey-types.js';
import {
  detectBlockedDoorways,
  detectBuildingOverlaps,
  detectBuildingRoadCollisions,
  detectDisconnectedPathways,
  detectWallCollisions,
  runSpatialAnomalyAudit,
} from '../../src/sim/spatial/spatial-anomaly-detector.js';
import {
  applySpatialSelfCorrection,
  clearDoorwayObstacles,
  flipOrRelocateDoorway,
  restoreRoadCorridors,
  stitchDisconnectedPathways,
} from '../../src/sim/spatial/spatial-self-corrector.js';
import {
  formatSurveySheetMarkdown,
  generateSpatialSurveySheet,
} from '../../src/sim/spatial/spatial-survey-sheet.js';

describe('Feature 10: Headless Spatial Survey & Self-Correction Test Suite', () => {
  it('detects all 5 spatial anomaly types on synthetically corrupted grids', () => {
    let grid = createStratumGrid('STREET', 48, 36);
    const entities: Record<string, EntityRecord> = {};

    // 1. Synthetic BUILDING_OVERLAP
    const buildings: PlacedBuildingSurvey[] = [
      { id: 'bld_1', templateId: 'tpl_1', archetypeId: 'VICTORIAN_TAVERN', bounds: { x1: 5, y1: 5, x2: 12, y2: 12 }, entrancePoints: [{ x: 8, y: 12 }], outwardPoints: [{ x: 8, y: 13 }], doors: { d1: { x: 8, y: 12 } } },
      { id: 'bld_2', templateId: 'tpl_2', archetypeId: 'TENEMENT_HOUSE', bounds: { x1: 10, y1: 10, x2: 18, y2: 18 }, entrancePoints: [{ x: 14, y: 18 }], outwardPoints: [{ x: 14, y: 19 }], doors: { d2: { x: 14, y: 18 } } },
    ];
    const overlaps = detectBuildingOverlaps(buildings);
    expect(overlaps.length).toBeGreaterThanOrEqual(1);
    expect(overlaps[0]?.type).toBe('BUILDING_OVERLAP');

    // 2. Synthetic BLOCKED_DOORWAY (fence in front of door)
    grid = setTileCell(grid, 8, 12, (c) => ({ ...c, terrainType: 'WOODEN_DOOR_CLOSED', blocksMovement: true }));
    grid = setTileCell(grid, 8, 13, (c) => ({ ...c, terrainType: 'WROUGHT_IRON_FENCE', blocksMovement: true }));
    const blocked = detectBlockedDoorways(grid, entities, [buildings[0]!]);
    expect(blocked.length).toBeGreaterThanOrEqual(1);
    expect(blocked[0]?.type).toBe('BLOCKED_DOORWAY');

    // 3. Synthetic WALL_COLLISION (portal surrounded by walls with 0 clearance)
    const portalPos = { x: 3, y: 3 };
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      grid = setTileCell(grid, portalPos.x + dx, portalPos.y + dy, (c) => ({ ...c, terrainType: 'SOOT_BRICK_WALL', blocksMovement: true }));
    }
    const pId = EntityIdSchema.parse('test_portal_1');
    entities[pId] = { id: pId, name: 'Sewer Ladder', visual: { glyph: 'H', fgPrimary: '#D4AF37', fgSecondary: '#fff', bgColor: '#000', shaderFlags: [] }, position: { x: 3, y: 3, stratum: 'STREET', blocksMovement: false, blocksSight: false }, portal: { target: { x: 3, y: 3, stratum: 'UNDERCROFT' }, bidirectional: true, conductsGas: true, portalLabel: 'Sewer Ladder', apCost: 100 } };
    const collisions = detectWallCollisions(grid, [portalPos], []);
    expect(collisions.length).toBeGreaterThanOrEqual(1);
    expect(collisions[0]?.type).toBe('WALL_COLLISION');

    // 4. Synthetic DISCONNECTED_PATHWAY (room completely walled off from hub)
    const hub = { x: 24, y: 18 };
    const disconnectedTarget = { x: 40, y: 5 };
    for (let x = 39; x <= 41; x++) {
      for (let y = 4; y <= 6; y++) {
        if (x === 40 && y === 5) continue;
        grid = setTileCell(grid, x, y, (c) => ({ ...c, terrainType: 'SOOT_BRICK_WALL', blocksMovement: true }));
      }
    }
    grid = setTileCell(grid, 40, 5, (c) => ({ ...c, terrainType: 'COBBLESTONE_FLOOR', blocksMovement: false }));
    const disconnected = detectDisconnectedPathways(grid, hub, [disconnectedTarget]);
    expect(disconnected.length).toBeGreaterThanOrEqual(1);
    expect(disconnected[0]?.type).toBe('DISCONNECTED_PATHWAY');

    // 5. Synthetic BUILDING_ROAD_COLLISION (building encroaches into arterial avenue)
    const avenueCorridor: Box = { x1: 1, y1: 17, x2: 46, y2: 19 };
    const encroachingBld: PlacedBuildingSurvey = { id: 'bld_encroach', templateId: 'tpl_e', archetypeId: 'VICTORIAN_TAVERN', bounds: { x1: 20, y1: 16, x2: 28, y2: 22 }, entrancePoints: [], outwardPoints: [], doors: {} };
    const roadCollisions = detectBuildingRoadCollisions([encroachingBld], [avenueCorridor]);
    expect(roadCollisions.length).toBeGreaterThanOrEqual(1);
    expect(roadCollisions[0]?.type).toBe('BUILDING_ROAD_COLLISION');
  });

  it('executes individual self-correction passes (clearance, door flipping, road restoration, and A* stitching)', () => {
    let grid = createStratumGrid('STREET', 48, 36);
    const entities: Record<string, EntityRecord> = {};

    // 1. Test clearDoorwayObstacles
    grid = setTileCell(grid, 8, 12, (c) => ({ ...c, terrainType: 'WOODEN_DOOR_CLOSED', blocksMovement: true }));
    grid = setTileCell(grid, 8, 13, (c) => ({ ...c, terrainType: 'WROUGHT_IRON_FENCE', blocksMovement: true }));
    const anomaly: SpatialAnomaly = { id: 'anom_1', type: 'BLOCKED_DOORWAY', severity: 'ERROR', position: { x: 8, y: 13 }, description: 'Fence blocks door' };
    const clearRes = clearDoorwayObstacles(grid, entities, [anomaly]);
    expect(getTileCell(clearRes.grid, 8, 13)?.terrainType).toBe('COBBLESTONE_FLOOR');
    expect(getTileCell(clearRes.grid, 8, 13)?.blocksMovement).toBe(false);
    expect(clearRes.logs.some((l) => l.action === 'CLEAR_DOORWAY')).toBe(true);

    // 2. Test flipOrRelocateDoorway
    const bld: PlacedBuildingSurvey = { id: 'bld_flip', templateId: 'tpl_f', archetypeId: 'VICTORIAN_TAVERN', bounds: { x1: 5, y1: 5, x2: 10, y2: 10 }, entrancePoints: [{ x: 7, y: 5 }], outwardPoints: [{ x: 7, y: 4 }], doors: { d: { x: 7, y: 5 } } };
    grid = setTileCell(grid, 7, 4, (c) => ({ ...c, terrainType: 'SOOT_BRICK_WALL', blocksMovement: true }));
    const flipRes = flipOrRelocateDoorway(grid, bld, { id: 'anom_f', type: 'BLOCKED_DOORWAY', severity: 'FATAL', position: { x: 7, y: 4 }, description: 'Exterior wall collision' });
    expect(flipRes.log?.action).toBe('FLIP_DOORWAY');
    expect(flipRes.building.doors).toBeDefined();

    // 3. Test restoreRoadCorridors
    const avenue: Box = { x1: 1, y1: 17, x2: 46, y2: 19 };
    grid = setTileCell(grid, 25, 18, (c) => ({ ...c, terrainType: 'SOOT_BRICK_WALL', blocksMovement: true }));
    const roadRes = restoreRoadCorridors(grid, [avenue]);
    expect(getTileCell(roadRes.grid, 25, 18)?.terrainType).toBe('COBBLESTONE_FLOOR');
    expect(roadRes.logs.some((l) => l.action === 'RESTORE_ROAD')).toBe(true);

    // 4. Test stitchDisconnectedPathways routing around private interior rooms
    const hub = { x: 24, y: 18 };
    const isolated = { x: 10, y: 18 };
    for (let y = 1; y < 35; y++) {
      if (y >= 16 && y <= 20) {
        grid = setTileCell(grid, 15, y, (c) => ({ ...c, terrainType: 'SOOT_BRICK_WALL', interiorZone: 'SURGICAL_BAY', blocksMovement: true }));
      } else {
        grid = setTileCell(grid, 15, y, (c) => ({ ...c, terrainType: 'WROUGHT_IRON_FENCE', interiorZone: 'NONE', blocksMovement: true }));
      }
    }
    const stitchRes = stitchDisconnectedPathways(grid, hub, [isolated]);
    expect(stitchRes.logs.some((l) => l.action === 'STITCH_PATHWAY')).toBe(true);
    for (let y = 16; y <= 20; y++) {
      expect(getTileCell(stitchRes.grid, 15, y)?.interiorZone).toBe('SURGICAL_BAY');
    }
  });

  it('resolves combined spatial anomalies down to zero via applySpatialSelfCorrection', () => {
    let grid = createStratumGrid('STREET', 48, 36);
    const hub = { x: 24, y: 18 };
    const corridors: Box[] = [{ x1: 1, y1: 17, x2: 46, y2: 19 }];
    grid = setTileCell(grid, hub.x, hub.y, (c) => ({ ...c, terrainType: 'COBBLESTONE_FLOOR', blocksMovement: false }));
    grid = setTileCell(grid, 10, 18, (c) => ({ ...c, terrainType: 'SOOT_BRICK_WALL', blocksMovement: true }));

    const buildings: PlacedBuildingSurvey[] = [{
      id: 'bld_combo', templateId: 'tpl_c', archetypeId: 'VICTORIAN_TAVERN',
      bounds: { x1: 5, y1: 5, x2: 12, y2: 12 },
      entrancePoints: [{ x: 8, y: 12 }], outwardPoints: [{ x: 8, y: 13 }], doors: { d: { x: 8, y: 12 } },
    }];
    grid = setTileCell(grid, 8, 12, (c) => ({ ...c, terrainType: 'WOODEN_DOOR_CLOSED', blocksMovement: true }));
    grid = setTileCell(grid, 8, 13, (c) => ({ ...c, terrainType: 'RUBBLE_PILE', blocksMovement: true }));

    const preAudit = runSpatialAnomalyAudit(grid, {}, buildings, hub, [{ x: 8, y: 13 }], corridors);
    expect(preAudit.length).toBeGreaterThan(0);

    const result = applySpatialSelfCorrection(grid, {}, buildings, hub, [{ x: 8, y: 13 }], corridors);
    expect(result.corrections.length).toBeGreaterThan(0);

    const postAudit = runSpatialAnomalyAudit(result.grid, result.entities, result.buildings, hub, [{ x: 8, y: 13 }], corridors);
    expect(postAudit).toHaveLength(0);
  });

  it('guarantees 100% zero spatial anomalies across 25 generated urban district seeds', () => {
    const hub = { x: 24, y: 18 };
    for (let seed = 2000; seed < 2025; seed++) {
      const rng = new SeededRNG(seed);
      const emptyGrid = createStratumGrid('STREET', 48, 36);
      const urban = generateUrbanDistrict(emptyGrid, {}, 48, 36, hub, rng);
      const spec = getUrbanStreetSpec(48, 36, hub);
      const corridors: Box[] = [
        { x1: 1, y1: spec.avenueY.min, x2: 46, y2: spec.avenueY.max },
        spec.plaza,
      ];
      const buildings: PlacedBuildingSurvey[] = urban.parcels.map((p, idx) => ({
        id: p.id,
        templateId: p.templateId ?? `template_${idx}`,
        archetypeId: 'VICTORIAN_TAVERN',
        bounds: p.bounds,
        entrancePoints: urban.entrancePoints.filter((pt) => pt.x >= p.bounds.x1 && pt.x <= p.bounds.x2 && pt.y >= p.bounds.y1 && pt.y <= p.bounds.y2),
        outwardPoints: urban.outwardPoints.filter((pt) => pt.x >= p.bounds.x1 - 1 && pt.x <= p.bounds.x2 + 1 && pt.y >= p.bounds.y1 - 1 && pt.y <= p.bounds.y2 + 1),
        doors: urban.doors,
      }));

      const targets = [...urban.outwardPoints, { x: 1, y: hub.y }, { x: 46, y: hub.y }];
      const corrected = applySpatialSelfCorrection(urban.grid, urban.entities, buildings, hub, targets, corridors);
      const postAudit = runSpatialAnomalyAudit(corrected.grid, corrected.entities, corrected.buildings, hub, targets, corridors);
      expect(postAudit, `Seed ${seed} had remaining anomalies: ${JSON.stringify(postAudit)}`).toHaveLength(0);
    }
  });

  it('exports 6-layer survey sheet and formats clean Markdown snapshot dossier', () => {
    const rng = new SeededRNG(42);
    const hub = { x: 24, y: 18 };
    const emptyGrid = createStratumGrid('STREET', 48, 36);
    const urban = generateUrbanDistrict(emptyGrid, {}, 48, 36, hub, rng);
    const spec = getUrbanStreetSpec(48, 36, hub);
    const corridors: Box[] = [{ x1: 1, y1: spec.avenueY.min, x2: 46, y2: spec.avenueY.max }, spec.plaza];
    const buildings: PlacedBuildingSurvey[] = urban.parcels.map((p, idx) => ({
      id: p.id, templateId: p.templateId ?? `template_${idx}`, archetypeId: 'VICTORIAN_TAVERN', bounds: p.bounds,
      entrancePoints: urban.entrancePoints.slice(0, 1), outwardPoints: urban.outwardPoints.slice(0, 1), doors: urban.doors,
    }));

    const sheet = generateSpatialSurveySheet({
      districtId: 'whitechapel_ward', stratum: 'STREET', seed: 42,
      grid: urban.grid, entities: urban.entities, buildings, streetCorridors: corridors, anomalies: [], corrections: [], hub,
    });

    expect(sheet.dimensions).toEqual({ width: 48, height: 36 });
    expect(sheet.layers.terrain).toHaveLength(36);
    expect(sheet.layers.architecture).toHaveLength(36);
    expect(sheet.layers.fixtures).toHaveLength(36);
    expect(sheet.layers.zoning).toHaveLength(36);
    expect(sheet.layers.circulation).toHaveLength(36);
    expect(sheet.layers.anomalyHeatmap).toHaveLength(36);
    expect(sheet.layers.terrain[0]?.length).toBe(48);

    const md = formatSurveySheetMarkdown(sheet);
    expect(md).toContain('# Spatial Survey Dossier: whitechapel_ward (STREET)');
    expect(md).toContain('## Layer 0: Ground & Terrain');
    expect(md).toContain('## Layer 1: Architecture & Autotiling Box-Drawing Shell');
    expect(md).toContain('## Layer 2: Interactive Fixtures & Portals');
    expect(md).toContain('## Layer 3: Cadastral Zoning & Room Semantics');
    expect(md).toContain('## Layer 4: Circulation & Movement Vectors');
    expect(md).toContain('## Layer 5: Diagnostic Anomaly Heatmap');
    expect(md).toContain('## Diagnostic Anomaly Audit Log');
    expect(md).toContain('## Spatial Self-Correction Execution Log');
  });
});
