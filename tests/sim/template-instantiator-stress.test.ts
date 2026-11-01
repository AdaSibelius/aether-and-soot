import { describe, expect, it } from 'vitest';
import { SeededRNG } from '../../src/sim/core/rng.js';
import { createStratumGrid, getTileCell } from '../../src/sim/spatial/grid.js';
import {
  ALL_BUILDING_TEMPLATES,
  TEMPLATE_VICTORIAN_TAVERN,
  TEMPLATE_CONSTABULARY_STATION,
} from '../../src/sim/spatial/building-templates.js';
import {
  instantiateTemplateIntoGrid,
  getTransformedDimensions,
  hasTemplateWalkablePath,
  transformRoomBox,
  TemplateRotation,
} from '../../src/sim/spatial/template-instantiator.js';

describe('Empirical Stress Challenger: CDDA Building Template Instantiator', () => {
  const ROTATIONS: readonly TemplateRotation[] = [0, 90, 180, 270];
  const BOOLEANS: readonly boolean[] = [false, true];

  it('stress-tests all 6 templates across all 16 transform permutations (96 combinations)', () => {
    let testedCombos = 0;
    for (const template of ALL_BUILDING_TEMPLATES) {
      for (const rot of ROTATIONS) {
        for (const mx of BOOLEANS) {
          for (const fy of BOOLEANS) {
            testedCombos++;
            const dims = getTransformedDimensions(template.width, template.height, rot);
            const grid = createStratumGrid('STREET', dims.width + 4, dims.height + 4);
            const rng = new SeededRNG(testedCombos * 1009);

            const result = instantiateTemplateIntoGrid(grid, {}, template, {
              origin: { x: 2, y: 2 },
              rotation: rot,
              mirrorX: mx,
              flipY: fy,
            }, rng);

            expect(result.entrancePoints.length).toBe(1);
            const door = result.entrancePoints[0]!;
            expect(door.x).toBeGreaterThanOrEqual(2);
            expect(door.x).toBeLessThan(2 + dims.width);
            expect(door.y).toBeGreaterThanOrEqual(2);
            expect(door.y).toBeLessThan(2 + dims.height);

            // Verify 100% room walkability to all walkable cells in every room
            for (const room of template.rooms) {
              const box = transformRoomBox(room, template.width, template.height, rot, mx, fy, { x: 2, y: 2 });
              let walkableCount = 0;
              for (let y = box.y1; y <= box.y2; y++) {
                for (let x = box.x1; x <= box.x2; x++) {
                  const cell = getTileCell(result.grid, x, y)!;
                  if (!cell.blocksMovement) {
                    walkableCount++;
                    expect(hasTemplateWalkablePath(result.grid, door, { x, y })).toBe(true);
                  }
                }
              }
              expect(walkableCount).toBeGreaterThan(0);
            }
          }
        }
      }
    }
    expect(testedCombos).toBe(96);
  });

  it('runs randomized 120-seed fuzzing harness with random origins, rotations, and reflections', () => {
    for (let seed = 1; seed <= 120; seed++) {
      const rng = new SeededRNG(seed * 65537 + 7919);
      const template = ALL_BUILDING_TEMPLATES[rng.nextInt(0, ALL_BUILDING_TEMPLATES.length - 1)]!;
      const rot = ROTATIONS[rng.nextInt(0, 3)]!;
      const mx = rng.nextInt(0, 1) === 1;
      const fy = rng.nextInt(0, 1) === 1;

      const dims = getTransformedDimensions(template.width, template.height, rot);
      const gridW = dims.width + rng.nextInt(4, 15);
      const gridH = dims.height + rng.nextInt(4, 15);
      const grid = createStratumGrid('STREET', gridW, gridH);

      const origin = {
        x: rng.nextInt(0, gridW - dims.width),
        y: rng.nextInt(0, gridH - dims.height),
      };

      const result = instantiateTemplateIntoGrid(grid, {}, template, {
        origin,
        rotation: rot,
        mirrorX: mx,
        flipY: fy,
      }, rng);

      // Verify no NaNs, undefined, or corrupted state across grid
      for (let idx = 0; idx < result.grid.cells.length; idx++) {
        const cell = result.grid.cells[idx]!;
        expect(cell).toBeDefined();
        expect(typeof cell.terrainType).toBe('string');
        expect(typeof cell.blocksMovement).toBe('boolean');
        expect(typeof cell.blocksSight).toBe('boolean');
        expect(typeof cell.interiorZone).toBe('string');
        expect(Number.isNaN(cell.steamPressureKpa)).toBe(false);
        expect(Number.isNaN(cell.smokePpm)).toBe(false);
        expect(cell.steamPressureKpa).toBeGreaterThanOrEqual(0);
        expect(cell.smokePpm).toBeGreaterThanOrEqual(0);
      }

      expect(result.entrancePoints.length).toBe(1);
      const door = result.entrancePoints[0]!;
      expect(door.x).toBeGreaterThanOrEqual(origin.x);
      expect(door.x).toBeLessThan(origin.x + dims.width);
      expect(door.y).toBeGreaterThanOrEqual(origin.y);
      expect(door.y).toBeLessThan(origin.y + dims.height);
    }
  });

  it('validates extreme boundaries: top-left (0,0), bottom-right edges, and clean out-of-bounds rejection', () => {
    for (const template of ALL_BUILDING_TEMPLATES) {
      for (const rot of ROTATIONS) {
        const dims = getTransformedDimensions(template.width, template.height, rot);
        const gridW = dims.width + 10;
        const gridH = dims.height + 10;

        // Top-left boundary (0, 0)
        const gridTL = createStratumGrid('STREET', gridW, gridH);
        const resTL = instantiateTemplateIntoGrid(gridTL, {}, template, {
          origin: { x: 0, y: 0 },
          rotation: rot,
        }, new SeededRNG(42));
        expect(resTL.entrancePoints.length).toBe(1);
        expect(resTL.grid.cells[0]!.terrainType).toBeDefined();

        // Bottom-right boundary
        const originBR = { x: gridW - dims.width, y: gridH - dims.height };
        const gridBR = createStratumGrid('STREET', gridW, gridH);
        const resBR = instantiateTemplateIntoGrid(gridBR, {}, template, {
          origin: originBR,
          rotation: rot,
        }, new SeededRNG(42));
        expect(resBR.entrancePoints.length).toBe(1);
        const lastIdx = (gridH - 1) * gridW + (gridW - 1);
        expect(resBR.grid.cells[lastIdx]!.terrainType).toBeDefined();

        // Out-of-bounds test matrix
        const invalidOrigins = [
          { x: -1, y: 0 },
          { x: 0, y: -1 },
          { x: -10, y: -10 },
          { x: gridW - dims.width + 1, y: 0 },
          { x: 0, y: gridH - dims.height + 1 },
          { x: gridW, y: gridH },
          { x: 500, y: 500 },
        ];

        for (const badOrigin of invalidOrigins) {
          expect(() => {
            instantiateTemplateIntoGrid(createStratumGrid('STREET', gridW, gridH), {}, template, {
              origin: badOrigin,
              rotation: rot,
            }, new SeededRNG(99));
          }).toThrowError(/out of bounds/);
        }
      }
    }
  });

  it('validates fixture entity relational consistency and inventory container bindings', () => {
    for (const template of ALL_BUILDING_TEMPLATES) {
      const grid = createStratumGrid('STREET', 30, 30);
      const res = instantiateTemplateIntoGrid(grid, {}, template, {
        origin: { x: 3, y: 3 },
      }, new SeededRNG(1337));

      expect(res.fixturesPlaced.length).toBeGreaterThan(0);
      const fixtureIdSet = new Set<string>();

      for (const fId of res.fixturesPlaced) {
        expect(fixtureIdSet.has(fId)).toBe(false);
        fixtureIdSet.add(fId);

        const entity = res.entities[fId];
        expect(entity).toBeDefined();
        expect(entity!.id).toBe(fId);
        expect(entity!.position).toBeDefined();
        expect(entity!.position!.stratum).toBe('STREET');
        expect(entity!.position!.x).toBeGreaterThanOrEqual(3);
        expect(entity!.position!.y).toBeGreaterThanOrEqual(3);

        if (entity!.inventory) {
          for (const itemEntityId of entity!.inventory.containedEntityIds) {
            const item = res.entities[itemEntityId];
            expect(item).toBeDefined();
            expect(item!.id).toBe(itemEntityId);
          }
        }
      }
    }
  });

  it('validates stratum override, rotationDeg alias, and multi-building composition without collision', () => {
    const grid = createStratumGrid('STREET', 60, 60);
    const rng = new SeededRNG(404);

    // Stamping building 1 with rotationDeg alias and targetStratum override
    const res1 = instantiateTemplateIntoGrid(grid, {}, TEMPLATE_VICTORIAN_TAVERN, {
      origin: { x: 2, y: 2 },
      rotationDeg: 90,
      targetStratum: 'UNDERCROFT',
    }, rng);

    for (const fid of res1.fixturesPlaced) {
      expect(res1.entities[fid]!.position!.stratum).toBe('UNDERCROFT');
    }

    // Stamping building 2 onto the same grid passing res1.entities
    const res2 = instantiateTemplateIntoGrid(res1.grid, res1.entities, TEMPLATE_CONSTABULARY_STATION, {
      origin: { x: 30, y: 30 },
      rotation: 180,
      mirrorX: true,
    }, rng);

    expect(res2.entrancePoints.length).toBe(1);
    expect(res2.fixturesPlaced.length).toBeGreaterThan(0);

    // Verify all fixtures from building 1 were preserved in building 2 world
    for (const fid of res1.fixturesPlaced) {
      expect(res2.entities[fid]).toBeDefined();
      expect(res2.entities[fid]!.position!.stratum).toBe('UNDERCROFT');
    }
  });
});
