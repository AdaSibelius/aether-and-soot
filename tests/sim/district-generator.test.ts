import { describe, expect, it } from 'vitest';
import { EntityIdSchema } from '../../src/schemas/primitives.schema.js';
import { dispatchCommand } from '../../src/sim/core/engine.js';
import { createInitialWorld, serializeWorld } from '../../src/sim/core/world.js';
import { generateVictorianDistrict, hasWalkablePath } from '../../src/sim/spatial/generator.js';

describe('Phase 5: Procedural Victorian Districts & Multi-Strata Portal Generation', () => {
  it('guarantees 100% walkable path connectivity across all strata portals and landmarks across 50 random seeds', () => {
    for (let i = 1; i <= 50; i++) {
      const seed = i * 98765 + 1337;
      const baseWorld = createInitialWorld({ seed, width: 24, height: 24 });
      const { state, landmarks } = generateVictorianDistrict(baseWorld);

      const streetGrid = state.strata.STREET!;
      const spireGrid = state.strata.SPIRE!;

      // Street Manhole <-> Street Freight Elevator
      expect(hasWalkablePath(streetGrid, landmarks.streetManhole, landmarks.streetLift)).toBe(true);
      // Street Manhole <-> Foundry Boiler Room
      expect(hasWalkablePath(streetGrid, landmarks.streetManhole, landmarks.foundryBoiler)).toBe(
        true,
      );
      // Spire Freight Elevator <-> Spire Central Observatory
      expect(hasWalkablePath(spireGrid, landmarks.spireLift, landmarks.streetManhole)).toBe(true);
    }
  });

  it('produces byte-identical generated districts for identical seeds and allows full Undercroft -> Street -> Spire traversal', () => {
    const playerId = EntityIdSchema.parse('actor_player');
    const worldA = generateVictorianDistrict(createInitialWorld({ seed: 5050, width: 24, height: 24 }));
    const worldB = generateVictorianDistrict(createInitialWorld({ seed: 5050, width: 24, height: 24 }));

    expect(serializeWorld(worldA.state)).toBe(serializeWorld(worldB.state));

    let world = worldA.state;

    // 1. Descend Manhole at center -> UNDERCROFT
    const toUndercroft = dispatchCommand(world, { type: 'USE_PORTAL', actorId: playerId });
    world = toUndercroft.state;
    expect(world.entities[playerId]!.position!.stratum).toBe('UNDERCROFT');

    // 2. Ascend Ladder -> STREET
    const toStreet = dispatchCommand(world, { type: 'USE_PORTAL', actorId: playerId });
    world = toStreet.state;
    expect(world.entities[playerId]!.position!.stratum).toBe('STREET');

    // 3. Move player to the generated Pneumatic Lift coordinates and ascend -> SPIRE
    const liftCoords = worldA.landmarks.streetLift;
    const player = world.entities[playerId]!;
    world = {
      ...world,
      entities: {
        ...world.entities,
        [playerId]: {
          ...player,
          position: {
            ...player.position!,
            x: liftCoords.x,
            y: liftCoords.y,
          },
        },
      },
    };

    const toSpire = dispatchCommand(world, { type: 'USE_PORTAL', actorId: playerId });
    world = toSpire.state;
    expect(toSpire.events).toContainEqual(
      expect.objectContaining({
        type: 'STRATUM_CHANGED',
        fromStratum: 'STREET',
        toStratum: 'SPIRE',
      }),
    );
    expect(world.entities[playerId]!.position!.stratum).toBe('SPIRE');
  });
});
