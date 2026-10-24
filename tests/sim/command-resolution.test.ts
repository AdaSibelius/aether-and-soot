import { describe, expect, it } from 'vitest';
import { GameCommand } from '../../src/schemas/commands.schema.js';
import { EntityIdSchema, StratumId } from '../../src/schemas/primitives.schema.js';
import { CommandResolution } from '../../src/sim/core/command-resolution.js';
import { routeDomainCommand } from '../../src/sim/core/command-router.js';
import { dispatchCommand } from '../../src/sim/core/engine.js';
import { SeededRNG } from '../../src/sim/core/rng.js';
import { STANDARD_ACTION_AP } from '../../src/sim/core/scheduler.js';
import { createInitialWorld, WorldState } from '../../src/sim/core/world.js';

describe('Phase ARCH-1.1: Standardized CommandResolution Contract', () => {
  const playerId = EntityIdSchema.parse('actor_player');
  const streetStratum: StratumId = 'STREET';

  function createTestFixture(): { world: WorldState; initialTurn: number } {
    const world = createInitialWorld({ seed: 42, width: 16, height: 16 });
    return { world, initialTurn: world.turnCount };
  }

  it('resolves valid WAIT_TURN with applied status, AP spent, and advancesTime=true', () => {
    const { world, initialTurn } = createTestFixture();
    const result = dispatchCommand(world, {
      type: 'WAIT_TURN',
      actorId: playerId,
    });

    expect(result.resolution).toBeDefined();
    expect(result.resolution.status).toBe('applied');

    if (result.resolution.status === 'applied') {
      expect(result.resolution.apSpent).toBe(STANDARD_ACTION_AP);
      expect(result.resolution.advancesTime).toBe(true);
      expect(result.resolution.events.some((e) => e.type === 'ACTOR_WAITED')).toBe(true);
    }

    // World clock advances
    expect(result.state.turnCount).toBe(initialTurn + 1);
  });

  it('resolves invalid MOVE_STEP bump into wall with rejected status and failure reason', () => {
    const { world, initialTurn } = createTestFixture();

    // Player at walkable position moving into border wall at (1, 1) -> (0, 1)
    const borderWorld: WorldState = {
      ...world,
      entities: {
        ...world.entities,
        [playerId]: {
          ...world.entities[playerId]!,
          position: { x: 1, y: 1, stratum: streetStratum, blocksMovement: true, blocksSight: false },
        },
      },
    };

    const result = dispatchCommand(borderWorld, {
      type: 'MOVE_STEP',
      actorId: playerId,
      dx: -1,
      dy: 0,
    });

    expect(result.resolution).toBeDefined();
    expect(result.resolution.status).toBe('rejected');

    if (result.resolution.status === 'rejected') {
      expect(result.resolution.reason).toMatch(/OUT_OF_BOUNDS|SOLID_TILE/);
      expect(result.resolution.events.some((e) => e.type === 'MOVEMENT_BLOCKED')).toBe(true);
      // State is structurally unchanged
      expect(result.state.entities[playerId]?.position).toEqual({
        x: 1,
        y: 1,
        stratum: streetStratum,
        blocksMovement: true,
        blocksSight: false,
      });
    }

    // Simulation clock pauses on rejected command
    expect(result.state.turnCount).toBe(initialTurn);
  });

  it('resolves domain DROP_ITEM with missing item as rejected with NOT_IN_INVENTORY reason', () => {
    const { world, initialTurn } = createTestFixture();
    const missingItemId = EntityIdSchema.parse('item_ghost_wrench');

    const result = dispatchCommand(world, {
      type: 'DROP_ITEM',
      actorId: playerId,
      itemEntityId: missingItemId,
    });

    expect(result.resolution.status).toBe('rejected');
    if (result.resolution.status === 'rejected') {
      expect(result.resolution.reason).toBe('NOT_IN_INVENTORY');
      expect(result.resolution.events.some((e) => e.type === 'INVENTORY_ACTION_FAILED')).toBe(true);
    }

    expect(result.state.turnCount).toBe(initialTurn);
  });

  it('resolves unhandled command types directly through routeDomainCommand as rejected', () => {
    const { world } = createTestFixture();
    const rng = new SeededRNG(world.rngState);

    // Casting an unhandled mock command
    const unhandledCmd = {
      type: 'UNHANDLED_MOCK_COMMAND',
      actorId: playerId,
    } as unknown as GameCommand;

    const resolution: CommandResolution = routeDomainCommand(world, unhandledCmd, rng);

    expect(resolution.status).toBe('rejected');
    if (resolution.status === 'rejected') {
      expect(resolution.reason).toContain('Unhandled command type: UNHANDLED_MOCK_COMMAND');
      expect(resolution.events).toEqual([]);
      expect(resolution.state).toBe(world);
    }
  });

  it('preserves top-level backward compatibility of DispatchTurnResult properties', () => {
    const { world } = createTestFixture();
    const result = dispatchCommand(world, {
      type: 'WAIT_TURN',
      actorId: playerId,
    });

    // Verify top-level state and events properties remain intact
    expect(result.state).toBeDefined();
    expect(Array.isArray(result.events)).toBe(true);
    expect(result.events.length).toBeGreaterThan(0);
    expect(result.resolution).toBeDefined();
  });
});
