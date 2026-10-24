import { describe, expect, it } from 'vitest';
import { projectWorldToVisualFrame } from '../../src/client/projection/frame-adapter.js';
import { EntityIdSchema } from '../../src/schemas/primitives.schema.js';
import { dispatchCommand } from '../../src/sim/core/engine.js';
import { SeededRNG } from '../../src/sim/core/rng.js';
import { assertWorldInvariants, createInitialWorld, deserializeWorld, serializeWorld } from '../../src/sim/core/world.js';

describe('Phase 1: Deterministic Simulation Kernel & Multi-Strata Portals', () => {
  const playerId = EntityIdSchema.parse('actor_player');

  it('produces identical PRNG sequences after state tuple serialization and restoration', () => {
    const rngA = new SeededRNG(0xcafebabe);
    for (let i = 0; i < 50; i++) {
      rngA.nextUint32();
    }

    const snapshot = rngA.getState();
    const rngRestored = new SeededRNG(snapshot);

    for (let i = 0; i < 100; i++) {
      expect(rngRestored.nextUint32()).toBe(rngA.nextUint32());
    }
  });

  it('produces byte-identical WorldState JSON after 100 turns and mid-run save/load', () => {
    const runSimulation = (withMidRunReload: boolean): string => {
      let world = createInitialWorld({ seed: 424242, width: 16, height: 16 });
      const dirs = [
        { dx: 1, dy: 0 },
        { dx: 0, dy: 1 },
        { dx: -1, dy: 0 },
        { dx: 0, dy: -1 },
      ] as const;

      for (let step = 0; step < 100; step++) {
        if (withMidRunReload && step === 50) {
          assertWorldInvariants(world);
          const rawJson = serializeWorld(world);
          world = deserializeWorld(rawJson);
          assertWorldInvariants(world);
        }
        const move = dirs[step % dirs.length]!;
        const res = dispatchCommand(world, {
          type: 'MOVE_STEP',
          actorId: playerId,
          dx: move.dx,
          dy: move.dy,
        });
        world = res.state;
      }
      assertWorldInvariants(world);
      return serializeWorld(world);
    };

    const continuousRun = runSimulation(false);
    const reloadedRun = runSimulation(true);
    expect(reloadedRun).toBe(continuousRun);

    const finalWorld = deserializeWorld(continuousRun);
    expect(finalWorld.turnCount).toBe(100);
    expect(finalWorld.macroTickCount).toBe(1);
    expect(finalWorld.eventLog).toContainEqual({
      type: 'MACRO_TICK_COMPLETED',
      turn: 100,
      macroTickIndex: 1,
    });
  });

  it('transitions actor across vertical strata via bidirectional portals and updates visual frame', () => {
    let world = createInitialWorld({ seed: 99, width: 16, height: 16 });

    const descendRes = dispatchCommand(world, {
      type: 'USE_PORTAL',
      actorId: playerId,
    });
    world = descendRes.state;
    assertWorldInvariants(world);

    expect(descendRes.events).toContainEqual(
      expect.objectContaining({
        type: 'STRATUM_CHANGED',
        actorId: playerId,
        fromStratum: 'STREET',
        toStratum: 'UNDERCROFT',
      }),
    );

    const undercroftFrame = projectWorldToVisualFrame(world, playerId);
    expect(undercroftFrame.activeStratum).toBe('UNDERCROFT');

    const ascendRes = dispatchCommand(world, {
      type: 'USE_PORTAL',
      actorId: playerId,
    });
    expect(ascendRes.events).toContainEqual(
      expect.objectContaining({
        type: 'STRATUM_CHANGED',
        actorId: playerId,
        fromStratum: 'UNDERCROFT',
        toStratum: 'STREET',
      }),
    );
  });

  it('scales movement AP cost when a leg is amputated or inventory is over-encumbered', () => {
    let world = createInitialWorld({ seed: 777, width: 16, height: 16 });
    const player = world.entities[playerId]!;

    // Amputate left leg without a prosthetic installed
    world = {
      ...world,
      entities: {
        ...world.entities,
        [playerId]: {
          ...player,
          anatomy: {
            ...player.anatomy!,
            limbs: {
              ...player.anatomy!.limbs,
              LEFT_LEG: {
                slot: 'LEFT_LEG',
                hp: 0,
                maxHp: 30,
                amputated: true,
              },
            },
          },
        },
      },
    };

    const moveRes = dispatchCommand(world, {
      type: 'MOVE_STEP',
      actorId: playerId,
      dx: 1,
      dy: 0,
    });

    expect(moveRes.events).toContainEqual(
      expect.objectContaining({
        type: 'ENTITY_MOVED',
        actorId: playerId,
        apSpent: 160,
      }),
    );
  });
});
