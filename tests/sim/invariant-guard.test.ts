import { describe, expect, it } from 'vitest';
import { BlueprintIdSchema, EntityIdSchema } from '../../src/schemas/primitives.schema.js';
import {
  dispatchCommand,
  isInvariantAssertionsEnabled,
  setInvariantAssertionsEnabled,
} from '../../src/sim/core/engine.js';
import { createInitialWorld, WorldState } from '../../src/sim/core/world.js';

describe('Phase ARCH-3.1: Development & Test Invariant Guard Hook', () => {
  const playerId = EntityIdSchema.parse('actor_player');

  it('reports invariant assertions enabled by default in non-production environments', () => {
    expect(isInvariantAssertionsEnabled()).toBe(true);
  });

  it('runs assertWorldInvariants after applied commands and throws on violation', () => {
    const world = createInitialWorld({ seed: 301, width: 16, height: 16 });
    const carriedItemId = EntityIdSchema.parse('item_corrupted_gear');

    // Create a corrupted world where an item in inventory has a ground position
    const corruptedWorld: WorldState = {
      ...world,
      entities: {
        ...world.entities,
        [carriedItemId]: {
          id: carriedItemId,
          name: 'Illegal Carried Gear',
          visual: { glyph: '?', fgPrimary: '#fff', fgSecondary: '#888', bgColor: '#000', shaderFlags: [] },
          position: { x: 5, y: 5, stratum: 'STREET', blocksMovement: false, blocksSight: false },
          item: {
            blueprintId: BlueprintIdSchema.parse('item_pneumatic_strider_leg'),
            category: 'EQUIPMENT',
            massGrams: 500,
            volumeMl: 500,
            quantity: 1,
            stackable: false,
          },
        },
        [playerId]: {
          ...world.entities[playerId]!,
          inventory: {
            ...world.entities[playerId]!.inventory!,
            containedEntityIds: [...world.entities[playerId]!.inventory!.containedEntityIds, carriedItemId],
          },
        },
      },
    };

    // When an applied command executes on the corrupted state, invariant guard catches it
    expect(() => {
      dispatchCommand(corruptedWorld, {
        type: 'WAIT_TURN',
        actorId: playerId,
      });
    }).toThrow(/\[assertWorldInvariants\]/);
  });

  it('allows overriding invariant assertions via dispatch options', () => {
    const world = createInitialWorld({ seed: 302, width: 16, height: 16 });
    const carriedItemId = EntityIdSchema.parse('item_bypassed_gear');

    const corruptedWorld: WorldState = {
      ...world,
      entities: {
        ...world.entities,
        [carriedItemId]: {
          id: carriedItemId,
          name: 'Bypassed Gear',
          visual: { glyph: '?', fgPrimary: '#fff', fgSecondary: '#888', bgColor: '#000', shaderFlags: [] },
          position: { x: 5, y: 5, stratum: 'STREET', blocksMovement: false, blocksSight: false },
          item: {
            blueprintId: BlueprintIdSchema.parse('item_pneumatic_strider_leg'),
            category: 'EQUIPMENT',
            massGrams: 500,
            volumeMl: 500,
            quantity: 1,
            stackable: false,
          },
        },
        [playerId]: {
          ...world.entities[playerId]!,
          inventory: {
            ...world.entities[playerId]!.inventory!,
            containedEntityIds: [...world.entities[playerId]!.inventory!.containedEntityIds, carriedItemId],
          },
        },
      },
    };

    // When explicitly disabled via options, dispatchCommand does not throw
    const res = dispatchCommand(
      corruptedWorld,
      {
        type: 'WAIT_TURN',
        actorId: playerId,
      },
      { enableInvariantAssertions: false },
    );

    expect(res.resolution.status).toBe('applied');
  });

  it('allows globally toggling invariant assertions via setInvariantAssertionsEnabled', () => {
    const originalSetting = isInvariantAssertionsEnabled();
    try {
      setInvariantAssertionsEnabled(false);
      expect(isInvariantAssertionsEnabled()).toBe(false);

      setInvariantAssertionsEnabled(true);
      expect(isInvariantAssertionsEnabled()).toBe(true);
    } finally {
      setInvariantAssertionsEnabled(originalSetting);
    }
  });

  it('does not throw invariant assertion errors on rejected commands', () => {
    const world = createInitialWorld({ seed: 303, width: 16, height: 16 });

    // Moving into border wall at (0, 1) from (1, 1) is rejected
    const testWorld: WorldState = {
      ...world,
      entities: {
        ...world.entities,
        [playerId]: {
          ...world.entities[playerId]!,
          position: { x: 1, y: 1, stratum: 'STREET', blocksMovement: true, blocksSight: false },
        },
      },
    };

    const res = dispatchCommand(testWorld, {
      type: 'MOVE_STEP',
      actorId: playerId,
      dx: -1,
      dy: 0,
    });

    expect(res.resolution.status).toBe('rejected');
  });
});
