import { describe, expect, it } from 'vitest';
import { createStratumGrid, getTileCell, setTileCell } from '../../src/sim/spatial/grid.js';
import { Point2D } from '../../src/schemas/primitives.schema.js';
import { SeededRNG } from '../../src/sim/core/rng.js';
import { Box } from '../../src/sim/spatial/block-geometry.js';
import { generateUrbanDistrict, getUrbanStreetSpec } from '../../src/sim/spatial/urban-district.js';
import { PlacedBuildingSurvey } from '../../src/sim/spatial/spatial-survey-types.js';
import { runSpatialAnomalyAudit } from '../../src/sim/spatial/spatial-anomaly-detector.js';
import { applySpatialSelfCorrection, stitchDisconnectedPathways } from '../../src/sim/spatial/spatial-self-corrector.js';

describe('M2 Adversarial Challenge: Deterministic Self-Correction & Room Protection', () => {
  it('Challenge 1: verifies zero private room tiles are mutated when stitching pathways around SURGICAL_BAY, VAULT, and WORKSHOP', () => {
    let grid = createStratumGrid('STREET', 48, 36);
    const hub: Point2D = { x: 24, y: 18 };
    const isolatedTarget: Point2D = { x: 6, y: 18 };

    grid = setTileCell(grid, hub.x, hub.y, (c) => ({ ...c, terrainType: 'COBBLESTONE_FLOOR', blocksMovement: false }));
    grid = setTileCell(grid, isolatedTarget.x, isolatedTarget.y, (c) => ({ ...c, terrainType: 'COBBLESTONE_FLOOR', blocksMovement: false }));

    // Construct barrier at x=15 with SURGICAL_BAY, VAULT, and WORKSHOP private zones, flanked by yard fences
    const privateRoomTiles: { x: number; y: number; zone: 'SURGICAL_BAY' | 'VAULT' | 'WORKSHOP' }[] = [];

    for (let y = 1; y <= 34; y++) {
      if (y >= 1 && y <= 7) {
        grid = setTileCell(grid, 15, y, (c) => ({ ...c, terrainType: 'WROUGHT_IRON_FENCE', blocksMovement: true, interiorZone: 'NONE' }));
      } else if (y >= 8 && y <= 13) {
        for (let x = 13; x <= 16; x++) {
          grid = setTileCell(grid, x, y, (c) => ({ ...c, terrainType: 'SOOT_BRICK_WALL', blocksMovement: true, interiorZone: 'SURGICAL_BAY' }));
          privateRoomTiles.push({ x, y, zone: 'SURGICAL_BAY' });
        }
      } else if (y >= 14 && y <= 19) {
        for (let x = 13; x <= 16; x++) {
          grid = setTileCell(grid, x, y, (c) => ({ ...c, terrainType: 'SOOT_BRICK_WALL', blocksMovement: true, interiorZone: 'VAULT' }));
          privateRoomTiles.push({ x, y, zone: 'VAULT' });
        }
      } else if (y >= 20 && y <= 25) {
        for (let x = 13; x <= 16; x++) {
          grid = setTileCell(grid, x, y, (c) => ({ ...c, terrainType: 'SOOT_BRICK_WALL', blocksMovement: true, interiorZone: 'WORKSHOP' }));
          privateRoomTiles.push({ x, y, zone: 'WORKSHOP' });
        }
      } else {
        grid = setTileCell(grid, 15, y, (c) => ({ ...c, terrainType: 'WROUGHT_IRON_FENCE', blocksMovement: true, interiorZone: 'NONE' }));
      }
    }

    const initialStitch = stitchDisconnectedPathways(grid, hub, []);
    expect(initialStitch.logs).toHaveLength(0);

    const result = stitchDisconnectedPathways(grid, hub, [isolatedTarget]);
    expect(result.logs.some((l) => l.action === 'STITCH_PATHWAY')).toBe(true);

    // Verify 100% of private room tiles remain intact
    let mutatedPrivateRoomTiles = 0;
    for (const pt of privateRoomTiles) {
      const cell = getTileCell(result.grid, pt.x, pt.y);
      if (!cell) throw new Error(`Cell missing at (${pt.x},${pt.y})`);
      if (cell.interiorZone !== pt.zone || cell.terrainType === 'COBBLESTONE_FLOOR' || !cell.blocksMovement) {
        mutatedPrivateRoomTiles++;
      }
      expect(cell.interiorZone).toBe(pt.zone);
      expect(cell.terrainType).toBe('SOOT_BRICK_WALL');
      expect(cell.blocksMovement).toBe(true);
    }
    expect(mutatedPrivateRoomTiles).toBe(0);

    // Verify bypass routed through the exterior yard fence
    const northFenceBreach = getTileCell(result.grid, 15, 7);
    const southFenceBreach = getTileCell(result.grid, 15, 26);
    const exteriorFenceBreached =
      (northFenceBreach?.terrainType === 'COBBLESTONE_FLOOR' && !northFenceBreach.blocksMovement) ||
      (southFenceBreach?.terrainType === 'COBBLESTONE_FLOOR' && !southFenceBreach.blocksMovement);
    expect(exteriorFenceBreached).toBe(true);
  });

  it('Challenge 2: guarantees 100% zero fatal/error anomalies across 25 unseen seeds (3000..3024)', () => {
    const hub: Point2D = { x: 24, y: 18 };
    let totalPreAnomalies = 0;
    let totalCorrections = 0;

    for (let seed = 3000; seed < 3025; seed++) {
      const rng = new SeededRNG(seed);
      const emptyGrid = createStratumGrid('STREET', 48, 36);
      let urban = generateUrbanDistrict(emptyGrid, {}, 48, 36, hub, rng);
      const spec = getUrbanStreetSpec(48, 36, hub);
      const corridors: Box[] = [
        { x1: 1, y1: spec.avenueY.min, x2: 46, y2: spec.avenueY.max },
        spec.plaza,
      ];

      // Inject adversarial corruption: block first outward point with fence & breach avenue with wall
      if (urban.outwardPoints.length > 0) {
        const outPt = urban.outwardPoints[0]!;
        urban = { ...urban, grid: setTileCell(urban.grid, outPt.x, outPt.y, (c) => ({ ...c, terrainType: 'WROUGHT_IRON_FENCE', blocksMovement: true })) };
      }
      urban = { ...urban, grid: setTileCell(urban.grid, 20, spec.avenueY.min, (c) => ({ ...c, terrainType: 'SOOT_BRICK_WALL', blocksMovement: true })) };

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
      const preAudit = runSpatialAnomalyAudit(urban.grid, urban.entities, buildings, hub, targets, corridors);
      totalPreAnomalies += preAudit.length;
      expect(preAudit.length, `Seed ${seed} must detect injected anomalies`).toBeGreaterThan(0);

      const corrected = applySpatialSelfCorrection(urban.grid, urban.entities, buildings, hub, targets, corridors);
      totalCorrections += corrected.corrections.length;

      const postAudit = runSpatialAnomalyAudit(corrected.grid, corrected.entities, corrected.buildings, hub, targets, corridors);
      const remainingCritical = postAudit.filter((a) => a.severity === 'FATAL' || a.severity === 'ERROR');

      expect(remainingCritical, `Seed ${seed} retained critical anomalies: ${JSON.stringify(remainingCritical)}`).toHaveLength(0);
      expect(postAudit, `Seed ${seed} retained anomalies: ${JSON.stringify(postAudit)}`).toHaveLength(0);
    }

    expect(totalPreAnomalies).toBeGreaterThanOrEqual(50);
    expect(totalCorrections).toBeGreaterThanOrEqual(50);
  });

  it('Challenge 3: verifies clean grids with 0 anomalies terminate early in pass 1 with 0 modifications', () => {
    const hub: Point2D = { x: 24, y: 18 };
    const rng = new SeededRNG(3000);
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

    const firstPass = applySpatialSelfCorrection(urban.grid, urban.entities, buildings, hub, targets, corridors);
    const auditClean = runSpatialAnomalyAudit(firstPass.grid, firstPass.entities, firstPass.buildings, hub, targets, corridors);
    expect(auditClean).toHaveLength(0);

    const secondPass = applySpatialSelfCorrection(firstPass.grid, firstPass.entities, firstPass.buildings, hub, targets, corridors, 5);

    expect(secondPass.corrections).toHaveLength(0);
    expect(secondPass.grid.cells).toEqual(firstPass.grid.cells);
    expect(secondPass.entities).toEqual(firstPass.entities);
    expect(secondPass.buildings).toEqual(firstPass.buildings);
  });
});
