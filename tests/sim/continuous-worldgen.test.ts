import { describe, expect, it } from 'vitest';
import { BlueprintIdSchema, EntityIdSchema, Point2D } from '../../src/schemas/primitives.schema.js';
import { BuildingTemplateSchema } from '../../src/schemas/building-template.schema.js';
import { SeededRNG } from '../../src/sim/core/rng.js';
import { createInitialWorld, WorldState } from '../../src/sim/core/world.js';
import { createStratumGrid, getTileCell, isWithinBounds, StratumGrid } from '../../src/sim/spatial/grid.js';
import { generateVictorianDistrict, hasWalkablePath } from '../../src/sim/spatial/generator.js';
import { subdivideProceduralParcels, UrbanGridSpec } from '../../src/sim/spatial/urban-parcels.js';
import {
  applyBoundarySeamsToGrid,
  computeDistrictBoundarySeams,
} from '../../src/sim/spatial/district-boundaries.js';
import { continuousTransitSystem } from '../../src/sim/systems/continuous-transit.system.js';
import { EXPANDED_BUILDING_TEMPLATES, getDistrictTailoredTemplate } from '../../src/sim/spatial/building-templates-expanded.js';

function isReachable(grid: StratumGrid, start: Point2D, target: Point2D): boolean {
  if (start.x === target.x && start.y === target.y) return true;
  const visited = new Set<string>();
  const queue: Point2D[] = [start];
  const deltas = [{ dx: 1, dy: 0 }, { dx: -1, dy: 0 }, { dx: 0, dy: 1 }, { dx: 0, dy: -1 }];

  while (queue.length > 0) {
    const curr = queue.shift()!;
    if (Math.abs(curr.x - target.x) + Math.abs(curr.y - target.y) <= 1) return true;
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
  return false;
}

describe('Feature 16: Continuous Multi-Seed Walkability & Seam Traversal Suite', () => {
  describe('1. Multi-Block Parcel Subdivider Determinism & Geometric Validity', () => {
    it('subdivides arbitrary dimensions deterministically with non-overlapping parcels and corridor clearance', () => {
      const dimensions = [
        { width: 48, height: 36, minParcels: 6 },
        { width: 64, height: 48, minParcels: 8 },
        { width: 96, height: 72, minParcels: 12 },
      ];

      for (const dim of dimensions) {
        const rngA = new SeededRNG(4242);
        const rngB = new SeededRNG(4242);
        const spec: UrbanGridSpec = { width: dim.width, height: dim.height };
        const resA = subdivideProceduralParcels(spec, rngA);
        const resB = subdivideProceduralParcels(spec, rngB);

        expect(resA.parcels.length).toBe(resB.parcels.length);
        expect(resA.parcels.length).toBeGreaterThanOrEqual(dim.minParcels);
        expect(JSON.stringify(resA.parcels)).toBe(JSON.stringify(resB.parcels));

        for (let i = 0; i < resA.parcels.length; i++) {
          const p1 = resA.parcels[i]!;
          expect(p1.bounds.x1).toBeLessThan(p1.bounds.x2);
          expect(p1.bounds.y1).toBeLessThan(p1.bounds.y2);
          expect(p1.bounds.x1).toBeGreaterThanOrEqual(1);
          expect(p1.bounds.x2).toBeLessThanOrEqual(dim.width - 2);
          expect(p1.bounds.y1).toBeGreaterThanOrEqual(1);
          expect(p1.bounds.y2).toBeLessThanOrEqual(dim.height - 2);

          expect(p1.bounds.y1 > resA.avenueCorridor.y2 || p1.bounds.y2 < resA.avenueCorridor.y1).toBe(true);

          for (let j = i + 1; j < resA.parcels.length; j++) {
            const p2 = resA.parcels[j]!;
            const overlaps = !(
              p1.bounds.x2 < p2.bounds.x1 ||
              p1.bounds.x1 > p2.bounds.x2 ||
              p1.bounds.y2 < p2.bounds.y1 ||
              p1.bounds.y1 > p2.bounds.y2
            );
            expect(overlaps).toBe(false);
          }
        }
      }
    });
  });

  describe('2. Edge Seam Alignment & Open Thoroughfare Continuity Across Neighbors', () => {
    it('verifies thoroughfare opening reciprocity and movement traversability across planar neighbors', () => {
      const spitalfieldsId = BlueprintIdSchema.parse('district_spitalfields_soot_works');
      const limehouseId = BlueprintIdSchema.parse('district_limehouse_docks');
      const whitechapelId = BlueprintIdSchema.parse('district_whitechapel_ward');
      const belgraviaId = BlueprintIdSchema.parse('district_belgravia_brass_spires');

      const W = 48;
      const H = 36;
      const seamsSpital = computeDistrictBoundarySeams(spitalfieldsId, W, H);
      const seamsLime = computeDistrictBoundarySeams(limehouseId, W, H);
      const seamsWhite = computeDistrictBoundarySeams(whitechapelId, W, H);
      const seamsBelg = computeDistrictBoundarySeams(belgraviaId, W, H);

      // East of Spitalfields <-> West of Limehouse (Canal Bridge)
      const spitEast = seamsSpital.east.find((s) => s.seamType === 'CANAL_BRIDGE');
      const limeWest = seamsLime.west.find((s) => s.seamType === 'CANAL_BRIDGE');
      expect(spitEast).toBeDefined();
      expect(limeWest).toBeDefined();
      expect(spitEast!.startCoord).toBe(limeWest!.startCoord);
      expect(spitEast!.endCoord).toBe(limeWest!.endCoord);

      // West of Spitalfields <-> East of Whitechapel (Open Street)
      const spitWest = seamsSpital.west.find((s) => s.seamType === 'OPEN_STREET');
      const whiteEast = seamsWhite.east.find((s) => s.seamType === 'OPEN_STREET');
      expect(spitWest).toBeDefined();
      expect(whiteEast).toBeDefined();
      expect(spitWest!.startCoord).toBe(whiteEast!.startCoord);
      expect(spitWest!.endCoord).toBe(whiteEast!.endCoord);

      // North of Spitalfields <-> South of Belgravia (Viaduct Arch)
      const spitNorth = seamsSpital.north.find((s) => s.seamType === 'VIADUCT_ARCH');
      const belgSouth = seamsBelg.south.find((s) => s.seamType === 'VIADUCT_ARCH');
      expect(spitNorth).toBeDefined();
      expect(belgSouth).toBeDefined();
      expect(spitNorth!.startCoord).toBe(belgSouth!.startCoord);
      expect(spitNorth!.endCoord).toBe(belgSouth!.endCoord);

      // Traversability verification on applied grid
      let grid = createStratumGrid('STREET', W, H);
      grid = applyBoundarySeamsToGrid(grid, seamsSpital);
      for (let y = spitEast!.startCoord; y <= spitEast!.endCoord; y++) {
        const cell = getTileCell(grid, W - 1, y);
        expect(cell?.blocksMovement).toBe(false);
      }
    });
  });

  describe('3. Seamless Continuous Transit Coordinate Translation & Companion Preservation', () => {
    it('translates coordinates across border seams without gates and preserves companions', () => {
      const world = createInitialWorld({ seed: 777, width: 48, height: 36 });
      const playerId = EntityIdSchema.parse('actor_player');
      const compId = EntityIdSchema.parse('npc_companion_test');

      const stateWithComp: WorldState = {
        ...world,
        currentDistrictId: BlueprintIdSchema.parse('district_spitalfields_soot_works'),
        entities: {
          ...world.entities,
          [compId]: {
            id: compId,
            name: 'Pneumatic Automaton Hound',
            visual: { glyph: 'd', fgPrimary: '#D4AF37', fgSecondary: '#A68019', bgColor: '#0A0D0E', shaderFlags: [] },
            position: { x: 46, y: 18, stratum: 'STREET', blocksMovement: true, blocksSight: false },
            aiController: { factionId: 'IRONMONGERS_CARTEL', role: 'CITIZEN', hostile: false, alertState: 'IDLE', companionOfActorId: playerId },
          },
          [playerId]: {
            ...world.entities[playerId]!,
            position: { x: 47, y: 18, stratum: 'STREET', blocksMovement: true, blocksSight: false },
          },
        },
      };

      const result = continuousTransitSystem(stateWithComp, playerId, { x: 48, y: 18 });
      expect(result.traversed).toBe(true);
      expect(result.state.currentDistrictId).toBe('district_limehouse_docks');

      const newPlayer = result.state.entities[playerId];
      expect(newPlayer?.position?.x).toBe(1);
      expect(newPlayer?.position?.y).toBe(18);

      const newComp = result.state.entities[compId];
      expect(newComp).toBeDefined();
      expect(newComp?.position?.stratum).toBe('STREET');
      const dist = Math.max(Math.abs(newComp!.position!.x - 1), Math.abs(newComp!.position!.y - 18));
      expect(dist).toBeLessThanOrEqual(2);

      expect(result.events.some((e) => e.type === 'DISTRICT_TRAVELED')).toBe(true);
      expect(result.events.some((e) => e.type === 'COMPANION_TRANSIT_PRESERVED')).toBe(true);
    });
  });

  describe('4. Architectural Template Hydration Across 25 Unseen Seeds', () => {
    it('guarantees unbroken walkability between central plaza and all doorways & compass seams', () => {
      const SEED_START = 8001;
      const SEED_COUNT = 25;

      for (let i = 0; i < SEED_COUNT; i++) {
        const seed = SEED_START + i;
        const baseWorld = createInitialWorld({ seed, width: 48, height: 36 });
        const { state, landmarks } = generateVictorianDistrict(baseWorld);
        const streetGrid = state.strata.STREET!;

        const hub = landmarks.streetManhole;
        expect(hasWalkablePath(streetGrid, hub, landmarks.westGate)).toBe(true);
        expect(hasWalkablePath(streetGrid, hub, landmarks.eastGate)).toBe(true);
        if (landmarks.northGate) expect(hasWalkablePath(streetGrid, hub, landmarks.northGate)).toBe(true);
        if (landmarks.southGate) expect(hasWalkablePath(streetGrid, hub, landmarks.southGate)).toBe(true);

        expect(isReachable(streetGrid, hub, landmarks.foundryBoiler)).toBe(true);
        expect(isReachable(streetGrid, hub, landmarks.artificerWorkbench)).toBe(true);
        expect(isReachable(streetGrid, hub, landmarks.workshopDoor)).toBe(true);

        for (let y = 0; y < streetGrid.height; y++) {
          for (let x = 0; x < streetGrid.width; x++) {
            const cell = getTileCell(streetGrid, x, y);
            expect(cell).toBeDefined();
            expect(cell!.steamPressureKpa).not.toBeNaN();
            expect(cell!.coalDustDensity).not.toBeNaN();
          }
        }
      }
    });
  });

  describe('5. Expanded District Architectural Templates Validation', () => {
    it('validates Bessemer Foundry, Dockside Warehouse, and Clockwork Salon templates', () => {
      expect(EXPANDED_BUILDING_TEMPLATES.length).toBe(3);
      for (const t of EXPANDED_BUILDING_TEMPLATES) {
        expect(BuildingTemplateSchema.safeParse(t).success).toBe(true);
        expect(t.rows.length).toBe(t.height);
        expect(t.rows.every((r) => r.length === t.width)).toBe(true);
      }
      expect(getDistrictTailoredTemplate('district_spitalfields_soot_works').id).toBe('building_bessemer_foundry');
      expect(getDistrictTailoredTemplate('district_limehouse_docks').id).toBe('building_dockside_warehouse');
      expect(getDistrictTailoredTemplate('district_belgravia_brass_spires').id).toBe('building_clockwork_salon');
    });
  });
});
