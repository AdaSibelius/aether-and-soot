import { describe, expect, it } from 'vitest';
import { EntityIdSchema } from '../../src/schemas/primitives.schema.js';
import { createInitialWorld } from '../../src/sim/core/world.js';
import { dispatchCommand } from '../../src/sim/core/engine.js';
import { computeVisibleTiles } from '../../src/sim/spatial/fov.js';
import {
  getArchitecturalTerrainProperties,
  placeArchitecturalFeature,
} from '../../src/sim/spatial/architectural-features.js';
import { projectWorldToVisualFrame } from '../../src/client/projection/frame-adapter.js';

describe('Deterministic Architectural Features Test: FOV & Collision (architectural-features.ts)', () => {
  const playerId = EntityIdSchema.parse('actor_player');

  it('verifies intrinsic movement and sight properties across architectural typologies', () => {
    // Glass window blocks physical movement but permits light/sight
    const windowProps = getArchitecturalTerrainProperties('GLASS_WINDOW');
    expect(windowProps.blocksMovement).toBe(true);
    expect(windowProps.blocksSight).toBe(false);

    // Soot brick wall blocks both physical movement and sight
    const wallProps = getArchitecturalTerrainProperties('SOOT_BRICK_WALL');
    expect(wallProps.blocksMovement).toBe(true);
    expect(wallProps.blocksSight).toBe(true);

    // Gaslamp post and wrought iron fence block movement but not sight
    const lampProps = getArchitecturalTerrainProperties('GASLAMP_POST');
    expect(lampProps.blocksMovement).toBe(true);
    expect(lampProps.blocksSight).toBe(false);

    const fenceProps = getArchitecturalTerrainProperties('WROUGHT_IRON_FENCE');
    expect(fenceProps.blocksMovement).toBe(true);
    expect(fenceProps.blocksSight).toBe(false);

    // Cobblestone and timber pier allow both movement and sight
    const floorProps = getArchitecturalTerrainProperties('COBBLESTONE_FLOOR');
    expect(floorProps.blocksMovement).toBe(false);
    expect(floorProps.blocksSight).toBe(false);
  });

  it('enforces collision on GLASS_WINDOW while allowing FOV line-of-sight propagation', () => {
    // Given (Seeded World)
    let world = createInitialWorld({ seed: 42 });
    const player = world.entities[playerId]!;
    const pos = player.position!;
    const grid = world.strata[pos.stratum]!;

    // Place a glass window directly to the east of player
    const windowPos = { x: pos.x + 1, y: pos.y };
    const beyondWindowPos = { x: pos.x + 2, y: pos.y };
    // Place a soot brick wall directly to the south of player
    const wallPos = { x: pos.x, y: pos.y + 1 };
    const beyondWallPos = { x: pos.x, y: pos.y + 2 };

    let updatedGrid = placeArchitecturalFeature(grid, windowPos.x, windowPos.y, 'GLASS_WINDOW');
    updatedGrid = placeArchitecturalFeature(updatedGrid, beyondWindowPos.x, beyondWindowPos.y, 'COBBLESTONE_FLOOR');
    updatedGrid = placeArchitecturalFeature(updatedGrid, wallPos.x, wallPos.y, 'SOOT_BRICK_WALL');
    updatedGrid = placeArchitecturalFeature(updatedGrid, beyondWallPos.x, beyondWallPos.y, 'COBBLESTONE_FLOOR');

    world = {
      ...world,
      strata: {
        ...world.strata,
        [pos.stratum]: updatedGrid,
      },
    };

    // When (Command Dispatched via command-router.ts): Attempt to walk into GLASS_WINDOW
    const moveRes = dispatchCommand(world, {
      type: 'MOVE_STEP',
      actorId: playerId,
      dx: 1,
      dy: 0,
    });

    // Then (ECS Component Delta + Domain Event Emitted + Frame Projection Verified)
    // 1. ECS Component Delta: Player movement blocked by window
    expect(moveRes.state.entities[playerId]?.position?.x).toBe(pos.x);
    expect(moveRes.state.entities[playerId]?.position?.y).toBe(pos.y);

    // 2. Domain Events
    expect(moveRes.events).toBeDefined();

    // 3. FOV Calculation: Light passes through GLASS_WINDOW to reveal tile beyond, but is occluded by SOOT_BRICK_WALL
    const visibleTiles = computeVisibleTiles(
      moveRes.state.strata[pos.stratum]!,
      pos.x,
      pos.y,
      6,
    );
    // Window tile is visible
    expect(visibleTiles.has(`${windowPos.x},${windowPos.y}`)).toBe(true);
    // Tile BEYOND window is visible (sight not blocked)
    expect(visibleTiles.has(`${beyondWindowPos.x},${beyondWindowPos.y}`)).toBe(true);
    // Wall tile is visible
    expect(visibleTiles.has(`${wallPos.x},${wallPos.y}`)).toBe(true);
    // Tile BEYOND soot brick wall is occluded (sight blocked)
    expect(visibleTiles.has(`${beyondWallPos.x},${beyondWallPos.y}`)).toBe(false);

    // 4. Frame Projection Verified
    const frame = projectWorldToVisualFrame(moveRes.state, playerId);
    expect(frame.activeStratum).toBe(pos.stratum);
    expect(frame.cells.some((c) => c.worldX === windowPos.x && c.worldY === windowPos.y)).toBe(true);
  });

  it('toggles WOODEN_DOOR between open and closed, updating collision and sight obstruction', () => {
    // Given (Seeded World)
    let world = createInitialWorld({ seed: 789 });
    const player = world.entities[playerId]!;
    const pos = player.position!;
    const doorPos = { x: pos.x + 1, y: pos.y, stratum: pos.stratum };

    const gridWithDoor = placeArchitecturalFeature(
      world.strata[pos.stratum]!,
      doorPos.x,
      doorPos.y,
      'WOODEN_DOOR_CLOSED',
    );

    world = {
      ...world,
      strata: { ...world.strata, [pos.stratum]: gridWithDoor },
    };

    // When (Command Dispatched via command-router.ts): Toggle closed door open
    const toggleRes = dispatchCommand(world, {
      type: 'TOGGLE_DOOR',
      actorId: playerId,
      target: doorPos,
    });

    // Then (ECS Component Delta + Domain Event Emitted + Frame Projection Verified)
    // 1. ECS Component Delta: Door terrain changed to WOODEN_DOOR_OPEN
    const doorCell = toggleRes.state.strata[pos.stratum]?.cells[doorPos.y * gridWithDoor.width + doorPos.x];
    expect(doorCell?.terrainType).toBe('WOODEN_DOOR_OPEN');
    expect(doorCell?.blocksMovement).toBe(false);
    expect(doorCell?.blocksSight).toBe(false);

    // 2. Domain Event Emitted
    const doorEv = toggleRes.events.find((e) => e.type === 'DOOR_TOGGLED');
    expect(doorEv).toBeDefined();
    if (doorEv && doorEv.type === 'DOOR_TOGGLED') {
      expect(doorEv.newState).toBe('OPEN');
    }

    // 3. Frame Projection Verified
    const frame = projectWorldToVisualFrame(toggleRes.state, playerId);
    expect(frame.activeStratum).toBe(pos.stratum);
  });
});
