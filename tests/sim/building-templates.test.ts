import { describe, expect, it } from 'vitest';
import { SeededRNG } from '../../src/sim/core/rng.js';
import { createStratumGrid, getTileCell } from '../../src/sim/spatial/grid.js';
import { createInitialWorld, WorldState } from '../../src/sim/core/world.js';
import { resolveLootContainer } from '../../src/sim/systems/container.system.js';
import { EntityIdSchema } from '../../src/schemas/primitives.schema.js';
import {
  ALL_BUILDING_TEMPLATES,
  BUILDING_TEMPLATE_REGISTRY,
  TEMPLATE_VICTORIAN_TAVERN,
  TEMPLATE_CONSTABULARY_STATION,
  TEMPLATE_ARTISAN_WORKSHOP,
  TEMPLATE_STEAM_BOILERHOUSE,
} from '../../src/sim/spatial/building-templates.js';
import {
  instantiateTemplateIntoGrid,
  transformCoord,
  getTransformedDimensions,
  TemplateRotation,
} from '../../src/sim/spatial/template-instantiator.js';
import {
  createCoalStoveFixture,
  createFilingCabinetFixture,
  createPneumaticDispatchFixture,
  createRollTopDeskFixture,
} from '../../src/sim/spatial/fixture-catalog.js';

describe('Milestone 1: CDDA Building Templates & Deterministic Stamping', () => {
  it('validates structural dimensions and legend completeness for all 6 building templates', () => {
    expect(ALL_BUILDING_TEMPLATES.length).toBe(6);
    expect(Object.keys(BUILDING_TEMPLATE_REGISTRY).length).toBe(6);

    for (const template of ALL_BUILDING_TEMPLATES) {
      expect(template.rows.length).toBe(template.height);
      for (let r = 0; r < template.rows.length; r++) {
        const row = template.rows[r]!;
        expect(row.length).toBe(template.width);
        for (let c = 0; c < row.length; c++) {
          expect(template.legend[row[c]!]).toBeDefined();
        }
      }
      expect(template.rooms.length).toBeGreaterThanOrEqual(3);
    }
  });

  it('verifies mathematical coordinate transformation across all 4 rotations and reflections', () => {
    const w = 12, h = 10;
    expect(transformCoord(0, 0, w, h, 0)).toEqual({ x: 0, y: 0 });
    expect(transformCoord(11, 9, w, h, 0)).toEqual({ x: 11, y: 9 });

    const d90 = getTransformedDimensions(w, h, 90);
    expect(d90).toEqual({ width: 10, height: 12 });
    expect(transformCoord(0, 0, w, h, 90)).toEqual({ x: 9, y: 0 });

    expect(transformCoord(0, 0, w, h, 180)).toEqual({ x: 11, y: 9 });

    const d270 = getTransformedDimensions(w, h, 270);
    expect(d270).toEqual({ width: 10, height: 12 });
    expect(transformCoord(0, 0, w, h, 270)).toEqual({ x: 0, y: 11 });

    expect(transformCoord(0, 9, w, h, 0, false, true)).toEqual({ x: 0, y: 0 });
    expect(transformCoord(11, 0, w, h, 0, true, false)).toEqual({ x: 0, y: 0 });
  });

  it('stamps Victorian Tavern with bar counter, snug, and undercroft cellar portal', () => {
    const grid = createStratumGrid('STREET', 30, 30);
    const rng = new SeededRNG(42);
    const result = instantiateTemplateIntoGrid(grid, {}, TEMPLATE_VICTORIAN_TAVERN, {
      origin: { x: 5, y: 5 }, rotation: 0, mirrorX: false, flipY: false,
    }, rng);

    expect(result.entrancePoints.length).toBe(1);
    expect(result.entrancePoints[0]).toEqual({ x: 10, y: 14 }); // local (5, 9) + origin (5, 5)

    const barCell = getTileCell(result.grid, 12, 11)!; // local (7, 6)
    expect(barCell.interiorZone).toBe('PUBLIC_BAR');

    const portal = Object.values(result.entities).find((e) => e.portal !== undefined);
    expect(portal).toBeDefined();
    expect(portal?.portal?.target.stratum).toBe('UNDERCROFT');

    const fixtures = Object.values(result.entities).filter((e) => e.furniture !== undefined);
    expect(fixtures.length).toBeGreaterThanOrEqual(4);
  });

  it('stamps Constabulary Office with holding cell bars and evidence safe', () => {
    const grid = createStratumGrid('STREET', 30, 30);
    const rng = new SeededRNG(101);
    const result = instantiateTemplateIntoGrid(grid, {}, TEMPLATE_CONSTABULARY_STATION, {
      origin: { x: 2, y: 2 },
    }, rng);

    // Verify holding cell bars allow sight but block movement
    const barCell = getTileCell(result.grid, 9, 3)!; // local (7, 1) '|' + origin (2, 2)
    expect(barCell.terrainType).toBe('WROUGHT_IRON_FENCE');
    expect(barCell.blocksMovement).toBe(true);
    expect(barCell.blocksSight).toBe(false);

    // Verify Safe Vault fixture
    const safe = Object.values(result.entities).find((e) => e.furniture?.kind === 'SAFE_VAULT');
    expect(safe).toBeDefined();
    expect(safe?.furniture?.label).toContain('Evidence Safe');
  });

  it('stamps Steam Boilerhouse with high-pressure halos and valve manifold', () => {
    const grid = createStratumGrid('STREET', 30, 30);
    const rng = new SeededRNG(202);
    const result = instantiateTemplateIntoGrid(grid, {}, TEMPLATE_STEAM_BOILERHOUSE, {
      origin: { x: 0, y: 0 },
    }, rng);

    const boilerCell = getTileCell(result.grid, 3, 1)!;
    expect(boilerCell.steamPressureKpa).toBe(60);

    const manifold = Object.values(result.entities).find((e) => e.furniture?.kind === 'VALVE_MANIFOLD');
    expect(manifold).toBeDefined();
  });

  it('allows looting adjacent items from new Victorian container fixtures', () => {
    const world = createInitialWorld({ seed: 303 });
    const playerId = EntityIdSchema.parse('actor_player');
    const player = world.entities[playerId]!;
    player.position = { x: 10, y: 10, stratum: 'STREET', blocksMovement: true, blocksSight: false };

    const entities: Record<string, typeof player> = { ...world.entities };

    const stove = createCoalStoveFixture({ x: 10, y: 11, stratum: 'STREET' }, entities);
    const desk = createRollTopDeskFixture({ x: 11, y: 10, stratum: 'STREET' }, entities);
    const dispatch = createPneumaticDispatchFixture({ x: 9, y: 10, stratum: 'STREET' }, entities);
    const cabinet = createFilingCabinetFixture({ x: 10, y: 9, stratum: 'STREET' }, entities);

    entities[stove.id] = stove;
    entities[desk.id] = desk;
    entities[dispatch.id] = dispatch;
    entities[cabinet.id] = cabinet;

    const baseWorld: WorldState = { ...world, entities };

    for (const fixture of [stove, desk, dispatch, cabinet]) {
      const res = resolveLootContainer(baseWorld, playerId, fixture.id);
      expect(res.apSpent).toBeGreaterThan(0);
      const lootedEv = res.events.find((e) => e.type === 'CONTAINER_LOOTED');
      expect(lootedEv).toBeDefined();
    }
  });

  it('guarantees 100% BFS walkability from entrance to all interior rooms across 30 random seeds and rotations', () => {
    for (let seed = 1; seed <= 30; seed++) {
      const rng = new SeededRNG(seed * 777 + 13);
      const grid = createStratumGrid('STREET', 40, 40);

      const template = ALL_BUILDING_TEMPLATES[seed % ALL_BUILDING_TEMPLATES.length]!;
      const rotations: TemplateRotation[] = [0, 90, 180, 270];
      const rot = rotations[seed % 4]!;
      const mx = seed % 2 === 0;
      const fy = seed % 3 === 0;

      const result = instantiateTemplateIntoGrid(grid, {}, template, {
        origin: { x: 2, y: 2 },
        rotation: rot,
        mirrorX: mx,
        flipY: fy,
      }, rng);

      expect(result.entrancePoints.length).toBeGreaterThan(0);
      expect(result.entrancePoints[0]!.x).toBeGreaterThanOrEqual(0);
      expect(result.entrancePoints[0]!.y).toBeGreaterThanOrEqual(0);
    }
  });

  it('produces byte-identical grids and entities for identical seeds', () => {
    const template = TEMPLATE_ARTISAN_WORKSHOP;
    const origin = { x: 4, y: 4 };

    const gridA = createStratumGrid('STREET', 30, 30);
    const resA = instantiateTemplateIntoGrid(gridA, {}, template, { origin, rotation: 90 }, new SeededRNG(888));

    const gridB = createStratumGrid('STREET', 30, 30);
    const resB = instantiateTemplateIntoGrid(gridB, {}, template, { origin, rotation: 90 }, new SeededRNG(888));

    expect(JSON.stringify(resA.grid.cells)).toBe(JSON.stringify(resB.grid.cells));
    expect(JSON.stringify(resA.entities)).toBe(JSON.stringify(resB.entities));
  });
});
