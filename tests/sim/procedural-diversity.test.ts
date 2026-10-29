import { describe, expect, it } from 'vitest';
import { BlueprintIdSchema, EntityIdSchema, Point2D } from '../../src/schemas/primitives.schema.js';
import { dispatchCommand } from '../../src/sim/core/engine.js';
import { createInitialWorld } from '../../src/sim/core/world.js';
import { generateVictorianDistrict, hasWalkablePath } from '../../src/sim/spatial/generator.js';
import { StratumGrid } from '../../src/sim/spatial/grid.js';

function computeJaccardDissimilarity(gridA: StratumGrid, gridB: StratumGrid): number {
  let intersection = 0;
  let union = 0;
  for (let i = 0; i < gridA.cells.length; i++) {
    const walkA = !gridA.cells[i]!.blocksMovement;
    const walkB = !gridB.cells[i]!.blocksMovement;
    if (walkA && walkB) intersection++;
    if (walkA || walkB) union++;
  }
  return union === 0 ? 0 : 1 - intersection / union;
}

function computeVariance(points: readonly Point2D[]): { varX: number; varY: number } {
  const n = points.length;
  if (n === 0) return { varX: 0, varY: 0 };
  const meanX = points.reduce((acc, p) => acc + p.x, 0) / n;
  const meanY = points.reduce((acc, p) => acc + p.y, 0) / n;
  const varX = points.reduce((acc, p) => acc + (p.x - meanX) ** 2, 0) / n;
  const varY = points.reduce((acc, p) => acc + (p.y - meanY) ** 2, 0) / n;
  return { varX, varY };
}

describe('Section 7.2 & TSK-P3-01..03: Quantitative Procedural Diversity, Stratum Topologies & 2D Compass Gates', () => {
  it('satisfies Section 7.2 diversity targets across 50 seeds [1000..1049]: D_J >= 0.45, H_bar >= 1.35, sigma^2_x >= 16, sigma^2_y >= 12', () => {
    const width = 48;
    const height = 36;
    const seeds = Array.from({ length: 50 }, (_, i) => 1000 + i);

    const streetGrids: StratumGrid[] = [];
    const liftPositions: Point2D[] = [];
    const boilerPositions: Point2D[] = [];
    const doorPositionsByKey: Record<string, Point2D[]> = {
      apothecary: [],
      pawnshop: [],
      boilerhouse: [],
      rookeries: [],
      monorailDepot: [],
      artisanWorkshop: [],
    };

    for (const seed of seeds) {
      const world = createInitialWorld({ seed, width, height });
      const { state, landmarks } = generateVictorianDistrict(world);
      streetGrids.push(state.strata.STREET!);
      liftPositions.push(landmarks.streetLift);
      boilerPositions.push(landmarks.foundryBoiler);

      for (const key of Object.keys(doorPositionsByKey)) {
        const pt = landmarks.doors?.[key];
        if (pt) doorPositionsByKey[key]!.push(pt);
      }
    }

    // 1. Walkable Grid Jaccard Dissimilarity (Mean D_J >= 0.45 across all pairs)
    let pairSum = 0;
    let pairCount = 0;
    for (let i = 0; i < streetGrids.length; i++) {
      for (let j = i + 1; j < streetGrids.length; j++) {
        pairSum += computeJaccardDissimilarity(streetGrids[i]!, streetGrids[j]!);
        pairCount++;
      }
    }
    const meanDj = pairSum / pairCount;
    expect(meanDj).toBeGreaterThanOrEqual(0.45);

    // 2. Per-Tile Shannon Entropy (Mean H_bar >= 1.35 bits/tile across non-perimeter coordinates)
    let entropySum = 0;
    let interiorTileCount = 0;
    const nSeeds = streetGrids.length;
    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        const counts = new Map<string, number>();
        const idx = y * width + x;
        for (const grid of streetGrids) {
          const t = grid.cells[idx]!.terrainType;
          counts.set(t, (counts.get(t) ?? 0) + 1);
        }
        let h = 0;
        for (const c of counts.values()) {
          const p = c / nSeeds;
          if (p > 0) h -= p * Math.log2(p);
        }
        entropySum += h;
        interiorTileCount++;
      }
    }
    const meanEntropy = entropySum / interiorTileCount;
    expect(meanEntropy).toBeGreaterThanOrEqual(1.35);

    // 3. Spatial Variance (sigma^2_x >= 16.0, sigma^2_y >= 12.0 for key hubs and building doors)
    const boilerVar = computeVariance(boilerPositions);
    expect(boilerVar.varX).toBeGreaterThanOrEqual(16.0);
    expect(boilerVar.varY).toBeGreaterThanOrEqual(12.0);

    const liftVar = computeVariance(liftPositions);
    expect(liftVar.varX).toBeGreaterThanOrEqual(16.0);

    for (const [key, pts] of Object.entries(doorPositionsByKey)) {
      const v = computeVariance(pts);
      expect(v.varX, `Door ${key} varX (${v.varX}) < 16`).toBeGreaterThanOrEqual(16.0);
      expect(v.varY, `Door ${key} varY (${v.varY}) < 12`).toBeGreaterThanOrEqual(12.0);
    }
  });

  it('generates distinct cellular Undercroft sewer channels and radial Spire sky-bridges over ABYSS_DROP', () => {
    const runA = generateVictorianDistrict(createInitialWorld({ seed: 1001, width: 48, height: 36 }));
    const runB = generateVictorianDistrict(createInitialWorld({ seed: 1002, width: 48, height: 36 }));

    const underA = runA.state.strata.UNDERCROFT!;
    const underB = runB.state.strata.UNDERCROFT!;
    const spireA = runA.state.strata.SPIRE!;
    const spireB = runB.state.strata.SPIRE!;

    // Undercroft vs Spire within the same district must not share identical 6-room topology
    expect(computeJaccardDissimilarity(underA, spireA)).toBeGreaterThanOrEqual(0.25);

    // Undercroft and Spire vary across seeds (rng is wired)
    expect(computeJaccardDissimilarity(underA, underB)).toBeGreaterThan(0.15);
    expect(computeJaccardDissimilarity(spireA, spireB)).toBeGreaterThan(0.05);

    // Spire features ABYSS_DROP open air around BRASS_CATWALK spokes
    const abyssCount = spireA.cells.filter((c) => c.terrainType === 'ABYSS_DROP').length;
    const catwalkCount = spireA.cells.filter((c) => c.terrainType === 'BRASS_CATWALK').length;
    expect(abyssCount).toBeGreaterThan(500);
    expect(catwalkCount).toBeGreaterThanOrEqual(250);
  });

  it('carves 2D planar North/South compass gates and resolves opposite arrival gates on transit', () => {
    const playerId = EntityIdSchema.parse('actor_player');
    const world = createInitialWorld({
      seed: 1010,
      currentDistrictId: BlueprintIdSchema.parse('district_spitalfields_soot_works'),
      width: 48,
      height: 36,
    });
    const { state, landmarks } = generateVictorianDistrict(world);
    const street = state.strata.STREET!;

    // Spitalfields (col 2, row 1) has Belgravia (col 2, row 0) to the North
    expect(landmarks.northGate).toBeDefined();
    expect(hasWalkablePath(street, landmarks.streetManhole, landmarks.northGate!)).toBe(true);

    const northGateEntity = state.entities['gate_transit_north'];
    expect(northGateEntity?.districtGate?.targetDistrictId).toBe('district_belgravia_brass_spires');

    // Position player on North Gate and travel to Belgravia
    const atNorthGate = {
      ...state,
      entities: {
        ...state.entities,
        [playerId]: {
          ...state.entities[playerId]!,
          position: { ...northGateEntity!.position!, blocksMovement: true },
        },
      },
    };
    const transitRes = dispatchCommand(atNorthGate, {
      type: 'TRAVEL_DISTRICT',
      actorId: playerId,
      targetDistrictId: BlueprintIdSchema.parse('district_belgravia_brass_spires'),
    });

    expect(transitRes.state.currentDistrictId).toBe('district_belgravia_brass_spires');
    const southGateInBelgravia = transitRes.state.entities['gate_transit_south'];
    expect(southGateInBelgravia?.districtGate?.targetDistrictId).toBe('district_spitalfields_soot_works');

    // Player arrives at Belgravia's South Gate (opposite of departed North Gate)
    const playerPos = transitRes.state.entities[playerId]!.position!;
    expect({ x: playerPos.x, y: playerPos.y }).toEqual({
      x: southGateInBelgravia!.position!.x,
      y: southGateInBelgravia!.position!.y,
    });
  });
});
