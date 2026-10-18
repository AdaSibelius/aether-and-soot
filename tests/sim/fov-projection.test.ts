import { describe, expect, it } from 'vitest';
import { projectWorldToVisualFrame } from '../../src/client/projection/frame-adapter.js';
import { EntityIdSchema } from '../../src/schemas/primitives.schema.js';
import { dispatchCommand } from '../../src/sim/core/engine.js';
import { createInitialWorld } from '../../src/sim/core/world.js';
import { computeVisibleTiles, isPointVisible } from '../../src/sim/spatial/fov.js';
import { createStratumGrid, setTileCell } from '../../src/sim/spatial/grid.js';

describe('Phase 2: Shadowcasting FOV & Caves of Qud Visual Projection', () => {
  it('maintains line-of-sight symmetry in open rooms and respects radius bounds', () => {
    const grid = createStratumGrid('STREET', 20, 20);
    const visibleFromA = computeVisibleTiles(grid, 5, 5, 6);
    const visibleFromB = computeVisibleTiles(grid, 9, 8, 6);

    expect(isPointVisible(visibleFromA, { x: 9, y: 8 })).toBe(true);
    expect(isPointVisible(visibleFromB, { x: 5, y: 5 })).toBe(true);
    expect(isPointVisible(visibleFromA, { x: 18, y: 18 })).toBe(false);
  });

  it('casts a shadow behind opaque soot-brick walls', () => {
    let grid = createStratumGrid('STREET', 16, 16);
    grid = setTileCell(grid, 6, 5, () => ({
      terrainType: 'SOOT_BRICK_WALL',
      blocksMovement: true,
      blocksSight: true,
      steamPressureKpa: 0,
      coalDustDensity: 0,
    }));

    const visible = computeVisibleTiles(grid, 4, 5, 8);
    // The wall itself is visible
    expect(isPointVisible(visible, { x: 6, y: 5 })).toBe(true);
    // Tiles directly behind the wall along the ray are occluded
    expect(isPointVisible(visible, { x: 7, y: 5 })).toBe(false);
    expect(isPointVisible(visible, { x: 8, y: 5 })).toBe(false);
  });

  it('projects steam pressure shader flags into the VisualGridFrame when steam is vented', () => {
    const playerId = EntityIdSchema.parse('actor_player');
    let world = createInitialWorld({ seed: 2026, width: 16, height: 16 });
    const playerPos = world.entities[playerId]!.position!;

    const targetX = playerPos.x + 1;
    const targetY = playerPos.y;

    const res = dispatchCommand(world, {
      type: 'VENT_STEAM',
      actorId: playerId,
      target: { x: targetX, y: targetY, stratum: 'STREET' },
      pressureReleasedKpa: 60,
    });
    world = res.state;

    const frame = projectWorldToVisualFrame(world, playerId, 8);
    const targetCell = frame.cells[targetY * frame.width + targetX];
    expect(targetCell).toBeDefined();
    expect(targetCell!.steamPressureKpa).toBe(60);
    expect(targetCell!.visual.shaderFlags).toContain('PULSE_STEAM');
    expect(targetCell!.visual.shaderFlags).toContain('HEAT_SHIMMER');
  });
});
