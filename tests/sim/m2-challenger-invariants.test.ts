import { describe, expect, it } from 'vitest';
import { SeededRNG } from '../../src/sim/core/rng.js';
import { hasWalkablePath } from '../../src/sim/spatial/generator.js';
import { createStratumGrid, getTileCell } from '../../src/sim/spatial/grid.js';
import { generateHeavyIndustrialSector } from '../../src/sim/spatial/industrial-district.js';
import { generateSubterraneanMineStratum } from '../../src/sim/spatial/mines-generation.js';
import { carveVictorianSewerTopology } from '../../src/sim/spatial/sewer-topology.js';

describe('Milestone 2 Invariants Adversarial Challenge', () => {
  // 1. Sewer Topology Stress-Test across 50 seeds
  describe('Sewer Topology across 50 seeds (seeds 3001..3050)', () => {
    it('preserves 100% BFS connectivity between north and south inspection walkways across weir crossovers', () => {
      for (let seed = 3001; seed <= 3050; seed++) {
        const rng = new SeededRNG(seed);
        const sewer = carveVictorianSewerTopology(48, 36, { x: 24, y: 18 }, rng);
        const { grid } = sewer;

        // Find all weir crossover tiles: IRON_GRATE with SLUICE_SLUDGE
        let weirsTested = 0;
        for (let y = 1; y < grid.height - 1; y++) {
          for (let x = 1; x < grid.width - 1; x++) {
            const cell = getTileCell(grid, x, y)!;
            if (cell.terrainType === 'IRON_GRATE' && cell.liquidType === 'SLUICE_SLUDGE') {
              expect(cell.blocksMovement).toBe(false);
              expect(cell.liquidVolumeMl).toBe(500);

              const northWalkway = getTileCell(grid, x, y - 1);
              const southWalkway = getTileCell(grid, x, y + 1);

              if (northWalkway && southWalkway && !northWalkway.blocksMovement && !southWalkway.blocksMovement) {
                const reachable = hasWalkablePath(grid, { x, y: y - 1 }, { x, y: y + 1 });
                expect(reachable).toBe(true);
                weirsTested++;
              }
            }
          }
        }
        expect(weirsTested).toBeGreaterThan(0);
      }
    });

    it('validates 5x5 octagonal junction chambers contain valid catch basin sumps without trapping the player', () => {
      for (let seed = 3001; seed <= 3050; seed++) {
        const rng = new SeededRNG(seed);
        const sewer = carveVictorianSewerTopology(48, 36, { x: 24, y: 18 }, rng);
        const { grid, junctionChambers, catchBasinPos } = sewer;

        // Catch basin sump must exist and be CANAL_SLUICE with SLUICE_SLUDGE
        const sumpCell = getTileCell(grid, catchBasinPos.x - 1, catchBasinPos.y);
        expect(sumpCell).toBeDefined();
        expect(sumpCell!.terrainType).toBe('CANAL_SLUICE');
        expect(sumpCell!.liquidType).toBe('SLUICE_SLUDGE');
        expect(sumpCell!.liquidVolumeMl).toBe(2500);
        expect(sumpCell!.blocksMovement).toBe(true);

        // Every junction chamber center must be reachable from entry without being trapped
        for (const jc of junctionChambers) {
          expect(hasWalkablePath(grid, { x: 24, y: 18 }, jc.center)).toBe(true);
        }
      }
    });

    it('verifies miasma steam pressure and smoke ppm are seeded within specified ranges', () => {
      for (let seed = 3001; seed <= 3050; seed++) {
        const rng = new SeededRNG(seed);
        const sewer = carveVictorianSewerTopology(48, 36, { x: 24, y: 18 }, rng);
        const { grid } = sewer;

        for (const cell of grid.cells) {
          if (cell.terrainType === 'CANAL_SLUICE' && cell.liquidType === 'SLUICE_SLUDGE') {
            if (cell.liquidVolumeMl === 2500) {
              expect(cell.smokePpm).toBeGreaterThanOrEqual(180);
              expect(cell.smokePpm).toBeLessThanOrEqual(260);
              expect(cell.steamPressureKpa).toBeGreaterThanOrEqual(25);
              expect(cell.steamPressureKpa).toBeLessThanOrEqual(45);
            } else {
              expect(cell.smokePpm).toBeGreaterThanOrEqual(120);
              expect(cell.smokePpm).toBeLessThanOrEqual(220);
              expect(cell.steamPressureKpa).toBeGreaterThanOrEqual(15);
              expect(cell.steamPressureKpa).toBeLessThanOrEqual(35);
            }
          } else if (cell.terrainType === 'IRON_GRATE') {
            expect(cell.smokePpm).toBeGreaterThanOrEqual(15);
            expect(cell.smokePpm).toBeLessThanOrEqual(100);
            expect(cell.steamPressureKpa).toBeLessThanOrEqual(25);
          }
        }
      }
    });
  });

  // 2. Mine Generation Stress-Test across 50 seeds
  describe('Mine Generation across 50 seeds (seeds 4001..4050)', () => {
    it('verifies unexcavated stone support pillars at (cx ± 2, cy ± 2) in stopes have complete perimeter walkable rings', () => {
      for (let seed = 4001; seed <= 4050; seed++) {
        const rng = new SeededRNG(seed);
        const mine = generateSubterraneanMineStratum(48, 36, { x: 24, y: 18 }, rng);
        const { grid, stopes } = mine;

        expect(stopes.length).toBe(3);
        for (const stope of stopes) {
          expect(stope.pillars.length).toBe(4);
          for (const pillar of stope.pillars) {
            const pCell = getTileCell(grid, pillar.x, pillar.y);
            expect(pCell).toBeDefined();
            expect(pCell!.terrainType).toBe('SOOT_BRICK_WALL');
            expect(pCell!.blocksMovement).toBe(true);

            // Check that all 8 perimeter neighbor cells around the pillar are walkable
            const offsets = [
              { dx: -1, dy: -1 }, { dx: 0, dy: -1 }, { dx: 1, dy: -1 },
              { dx: -1, dy: 0 },                     { dx: 1, dy: 0 },
              { dx: -1, dy: 1 },  { dx: 0, dy: 1 },  { dx: 1, dy: 1 },
            ];

            for (const off of offsets) {
              const neighbor = getTileCell(grid, pillar.x + off.dx, pillar.y + off.dy);
              expect(neighbor).toBeDefined();
              expect(neighbor!.blocksMovement).toBe(false);
            }
          }
        }
      }
    });

    it('verifies all TIMBER_STRUT placements are non-severing (100% reachability from hoist cage to all stopes)', () => {
      for (let seed = 4001; seed <= 4050; seed++) {
        const rng = new SeededRNG(seed);
        const mine = generateSubterraneanMineStratum(48, 36, { x: 24, y: 18 }, rng);
        const { grid, hoistPos, stopes } = mine;

        const struts = grid.cells.filter((c) => c.terrainType === 'TIMBER_STRUT');
        expect(struts.length).toBeGreaterThan(0);
        for (const strut of struts) {
          expect(strut.blocksMovement).toBe(true);
        }

        // All stopes must remain 100% reachable from hoist station
        for (const stope of stopes) {
          expect(hasWalkablePath(grid, hoistPos, stope.center)).toBe(true);
        }
      }
    });

    it('verifies narrow-gauge rail corridors reach active stopes', () => {
      for (let seed = 4001; seed <= 4050; seed++) {
        const rng = new SeededRNG(seed);
        const mine = generateSubterraneanMineStratum(48, 36, { x: 24, y: 18 }, rng);
        const { grid, hoistPos, stopes, railTracks } = mine;

        expect(railTracks.length).toBeGreaterThanOrEqual(15);
        for (const stope of stopes) {
          const stopeRail = railTracks.find((r) => r.x === stope.center.x && r.y === stope.center.y);
          expect(stopeRail).toBeDefined();
          const cell = getTileCell(grid, stope.center.x, stope.center.y);
          expect(cell!.terrainType).toBe('RAIL_TRACK');
          expect(cell!.blocksMovement).toBe(false);
          expect(hasWalkablePath(grid, hoistPos, stope.center)).toBe(true);
        }
      }
    });
  });

  // 3. Heavy Industrial Sector Stress-Test across 50 seeds
  describe('Heavy Industrial Sector across 50 seeds (seeds 5001..5050)', () => {
    it('verifies smelting furnace thermal halo exists, furnace is unobstructed, and conveyor run is unbroken', () => {
      for (let seed = 5001; seed <= 5050; seed++) {
        const rng = new SeededRNG(seed);
        const initialGrid = createStratumGrid('STREET', 48, 36);
        const sector = generateHeavyIndustrialSector(
          initialGrid,
          {},
          { x1: 2, y1: 20, x2: 18, y2: 32 },
          rng,
        );

        const { grid, entities, furnacePos, conveyorStart, conveyorEnd, doors } = sector;

        // Furnace entity and thermal halo
        const furnace = Object.values(entities).find((e) => e.furniture?.kind === 'SMELTING_FURNACE');
        expect(furnace).toBeDefined();
        for (let dy = -2; dy <= 2; dy++) {
          for (let dx = -2; dx <= 2; dx++) {
            const hCell = getTileCell(grid, furnacePos.x + dx, furnacePos.y + dy);
            expect(hCell).toBeDefined();
            expect(hCell!.steamPressureKpa).toBeGreaterThanOrEqual(45);
            expect(hCell!.smokePpm).toBeGreaterThanOrEqual(140);
            expect(hCell!.coalDustDensity).toBeGreaterThanOrEqual(0.35);
          }
        }

        // Smelting hall door can reach furnace approach tile
        const approachPos = { x: furnacePos.x, y: furnacePos.y + 1 };
        expect(hasWalkablePath(grid, doors.smeltingHall!, approachPos)).toBe(true);

        // Continuous conveyor run unbroken (>= 4 contiguous cells)
        const conveyorLength = conveyorEnd.y - conveyorStart.y + 1;
        expect(conveyorLength).toBeGreaterThanOrEqual(4);
        for (let y = conveyorStart.y; y <= conveyorEnd.y; y++) {
          const cCell = getTileCell(grid, conveyorStart.x, y);
          expect(cCell).toBeDefined();
          expect(cCell!.terrainType).toBe('CONVEYOR_TRACK');
          expect(cCell!.blocksMovement).toBe(false);
        }

        // Boiler yard accumulator vessels have valid pressure specifications (maxPressureKpa >= 300)
        const vessels = Object.values(entities).filter((e) => e.pressureVessel !== undefined);
        expect(vessels.length).toBeGreaterThanOrEqual(2);
        for (const v of vessels) {
          expect(v.pressureVessel!.maxPressureKpa).toBeGreaterThanOrEqual(300);
          expect(v.pressureVessel!.currentPressureKpa).toBeGreaterThan(0);
        }
      }
    });
  });
});
