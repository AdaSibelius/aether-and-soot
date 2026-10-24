import { describe, expect, it } from 'vitest';
import { EntityRecord } from '../../src/schemas/components.schema.js';
import { EntityIdSchema } from '../../src/schemas/primitives.schema.js';
import { createInitialWorld } from '../../src/sim/core/world.js';
import { createSpatialView } from '../../src/sim/spatial/facade.js';

describe('Phase ARCH-4.2: Pure Spatial Query Facade & Intent Interface', () => {
  it('correctly queries boundary bounds, tile types, and walkability', () => {
    const world = createInitialWorld({ seed: 501, width: 20, height: 20 });
    const spatial = createSpatialView(world, 'STREET');

    expect(spatial.width).toBe(20);
    expect(spatial.height).toBe(20);

    // Border is wall (not walkable)
    expect(spatial.isWithinBounds(0, 0)).toBe(true);
    expect(spatial.isTileWalkable(0, 0)).toBe(false);
    expect(spatial.getTile(0, 0)?.terrainType).toBe('SOOT_BRICK_WALL');

    // Out of bounds
    expect(spatial.isWithinBounds(-1, 0)).toBe(false);
    expect(spatial.isWithinBounds(20, 20)).toBe(false);
    expect(spatial.isTileWalkable(-1, 0)).toBe(false);

    // Interior floor is walkable
    expect(spatial.isWithinBounds(5, 5)).toBe(true);
    expect(spatial.isTileWalkable(5, 5)).toBe(true);
  });

  it('detects blocking entities and respects ignoreEntityId in walkability checks', () => {
    let world = createInitialWorld({ seed: 502, width: 20, height: 20 });
    const blockerId = EntityIdSchema.parse('npc_blocker');

    const blocker: EntityRecord = {
      id: blockerId,
      name: 'Heavy Sentry',
      visual: { glyph: 'S', fgPrimary: '#E74C3C', fgSecondary: '#922B21', bgColor: '#0A0D0E', shaderFlags: [] },
      position: { x: 5, y: 5, stratum: 'STREET', blocksMovement: true, blocksSight: false },
      actor: { energy: 0, speed: 100, isPlayer: false },
    };

    world = { ...world, entities: { ...world.entities, [blockerId]: blocker } };
    const spatial = createSpatialView(world, 'STREET');

    // (5, 5) is blocked by entity
    expect(spatial.isTileWalkable(5, 5)).toBe(false);

    // (5, 5) is walkable if ignoring the blocker entity itself
    expect(spatial.isTileWalkable(5, 5, blockerId)).toBe(true);

    // Entity query finds the blocker
    const atPoint = spatial.findEntitiesAt(5, 5);
    expect(atPoint.some((e) => e.id === blockerId)).toBe(true);
  });

  it('queries entities within a Chebyshev radius accurately', () => {
    let world = createInitialWorld({ seed: 503, width: 24, height: 24 });
    const e1Id = EntityIdSchema.parse('item_near');
    const e2Id = EntityIdSchema.parse('item_far');

    const e1: EntityRecord = {
      id: e1Id,
      name: 'Nearby Scrap',
      visual: { glyph: '*', fgPrimary: '#E67E22', fgSecondary: '#D35400', bgColor: '#0A0D0E', shaderFlags: [] },
      position: { x: 10, y: 11, stratum: 'STREET', blocksMovement: false, blocksSight: false },
    };
    const e2: EntityRecord = {
      id: e2Id,
      name: 'Distant Scrap',
      visual: { glyph: '*', fgPrimary: '#E67E22', fgSecondary: '#D35400', bgColor: '#0A0D0E', shaderFlags: [] },
      position: { x: 10, y: 18, stratum: 'STREET', blocksMovement: false, blocksSight: false },
    };

    world = { ...world, entities: { ...world.entities, [e1Id]: e1, [e2Id]: e2 } };
    const spatial = createSpatialView(world, 'STREET');

    const inRadius2 = spatial.findEntitiesInRadius({ x: 10, y: 10 }, 2);
    expect(inRadius2.some((e) => e.id === e1Id)).toBe(true);
    expect(inRadius2.some((e) => e.id === e2Id)).toBe(false);

    const inRadius10 = spatial.findEntitiesInRadius({ x: 10, y: 10 }, 10);
    expect(inRadius10.some((e) => e.id === e2Id)).toBe(true);
  });

  it('computes distance and cardinal unit direction vectors correctly', () => {
    const world = createInitialWorld({ seed: 504, width: 20, height: 20 });
    const spatial = createSpatialView(world, 'STREET');

    expect(spatial.getChebyshevDistance({ x: 2, y: 2 }, { x: 5, y: 6 })).toBe(4);
    expect(spatial.getDirectionToward({ x: 2, y: 2 }, { x: 5, y: 6 })).toEqual({ dx: 1, dy: 1 });
    expect(spatial.getDirectionToward({ x: 5, y: 5 }, { x: 2, y: 5 })).toEqual({ dx: -1, dy: 0 });
    expect(spatial.getDirectionToward({ x: 5, y: 5 }, { x: 5, y: 5 })).toEqual({ dx: 0, dy: 0 });
  });

  it('computes line-of-sight and FOV sets through the headless facade', () => {
    const world = createInitialWorld({ seed: 505, width: 20, height: 20 });
    const spatial = createSpatialView(world, 'STREET');

    const fov = spatial.computeFov({ x: 10, y: 10 }, 6);
    expect(fov.has('10,10')).toBe(true);
    expect(fov.has('10,12')).toBe(true);

    // Open floor has direct LOS
    expect(spatial.getLineOfSight({ x: 10, y: 10 }, { x: 10, y: 13 })).toBe(true);

    // Wall at border blocks LOS to outside
    expect(spatial.getLineOfSight({ x: 10, y: 10 }, { x: 0, y: 0 })).toBe(false);
  });

  it('determines walkable path connectivity between points', () => {
    const world = createInitialWorld({ seed: 506, width: 20, height: 20 });
    const spatial = createSpatialView(world, 'STREET');

    // Two interior open cobblestone points have a walkable path
    expect(spatial.hasPathToTarget({ x: 5, y: 5 }, { x: 8, y: 8 })).toBe(true);

    // Path into a border wall tile fails
    expect(spatial.hasPathToTarget({ x: 5, y: 5 }, { x: 0, y: 0 })).toBe(false);
  });

  it('locates nearest tactical cover adjacent to walls and architectural barriers', () => {
    const world = createInitialWorld({ seed: 507, width: 20, height: 20 });
    const spatial = createSpatialView(world, 'STREET');

    // From (2, 2) which is near border (x=0, y=0), nearest cover is found at tile adjacent to wall
    const cover = spatial.findNearestCover({ x: 2, y: 2 }, 3);
    expect(cover).toBeDefined();
    if (cover) {
      expect(spatial.isTileWalkable(cover.x, cover.y)).toBe(true);
      // The cover tile is adjacent to at least one wall
      const isNearWall =
        !spatial.isTileWalkable(cover.x + 1, cover.y) ||
        !spatial.isTileWalkable(cover.x - 1, cover.y) ||
        !spatial.isTileWalkable(cover.x, cover.y + 1) ||
        !spatial.isTileWalkable(cover.x, cover.y - 1);
      expect(isNearWall).toBe(true);
    }
  });
});
