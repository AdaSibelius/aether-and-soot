import { describe, expect, it } from 'vitest';
import { EntityRecord } from '../../src/schemas/components.schema.js';
import { EntityIdSchema } from '../../src/schemas/primitives.schema.js';
import { dispatchCommand } from '../../src/sim/core/engine.js';
import { createInitialWorld, WorldState } from '../../src/sim/core/world.js';
import { createEntityFromBlueprint } from '../../src/sim/data/item-catalog.js';
import { computeActorFovRadius, computeVisibleTiles, isPointVisible } from '../../src/sim/spatial/fov.js';
import { setTileCell } from '../../src/sim/spatial/grid.js';
import { createDefaultNpcAnatomy } from '../../src/sim/systems/ai.system.js';
import { canActorSpotTarget } from '../../src/sim/systems/stealth-acoustics.system.js';

describe('Phase 29: Acoustic Propagation, Smog Sight Attenuation & Sensory AI', () => {
  const playerId = EntityIdSchema.parse('actor_player');
  const guardId = EntityIdSchema.parse('npc_guard_sentry');

  function setupStealthScenario(): WorldState {
    const base = createInitialWorld({ seed: 42, width: 20, height: 20 });
    const guard: EntityRecord = {
      id: guardId,
      name: 'Crown Sentry',
      visual: { glyph: 'G', fgPrimary: '#D4AF37', fgSecondary: '#8B4513', bgColor: '#0A0D0E', shaderFlags: [] },
      actor: { isPlayer: false, energy: 100, speed: 100 },
      anatomy: createDefaultNpcAnatomy(40, 20),
      aiController: { factionId: 'CROWN_CONSTABULARY', role: 'GUARD', hostile: true, alertState: 'IDLE' },
      position: { x: 10, y: 5, stratum: 'STREET', blocksMovement: true, blocksSight: false },
    };

    const player = base.entities[playerId]!;
    return {
      ...base,
      entities: {
        ...base.entities,
        [guardId]: guard,
        [playerId]: { ...player, position: { x: 2, y: 5, stratum: 'STREET', blocksMovement: true, blocksSight: false } },
      },
    };
  }

  it('(a) venting steam creates an opaque smog cloud that breaks NPC line-of-sight', () => {
    let world = setupStealthScenario();
    expect(canActorSpotTarget(world, guardId, playerId)).toBe(true);

    const ventRes = dispatchCommand(world, {
      type: 'VENT_STEAM',
      actorId: playerId,
      target: { x: 6, y: 5, stratum: 'STREET' },
      pressureReleasedKpa: 70,
      bypassReserveCheck: true,
    });
    world = ventRes.state;

    const street = world.strata.STREET!;
    const fov = computeVisibleTiles(street, 10, 5, 8);
    expect(isPointVisible(fov, { x: 2, y: 5 })).toBe(false);
    expect(canActorSpotTarget(world, guardId, playerId)).toBe(false);

    let clearWorld = setupStealthScenario();
    expect(canActorSpotTarget(clearWorld, guardId, playerId)).toBe(true);
    const dustGrid = setTileCell(clearWorld.strata.STREET!, 6, 5, (c) => ({ ...c, coalDustDensity: 0.35 }));
    clearWorld = { ...clearWorld, strata: { ...clearWorld.strata, STREET: dustGrid } };
    expect(canActorSpotTarget(clearWorld, guardId, playerId)).toBe(false);
  });

  it('(b) amputating an NPC ocular mount blinds them to a maximum FOV radius of 1', () => {
    let world = setupStealthScenario();
    const guard = world.entities[guardId]!;
    expect(computeActorFovRadius(guard, 8)).toBe(8);

    const prevOcular = guard.anatomy!.limbs.OCULAR_MOUNT!;
    world = {
      ...world,
      entities: {
        ...world.entities,
        [guardId]: {
          ...guard,
          anatomy: {
            ...guard.anatomy!,
            limbs: { ...guard.anatomy!.limbs, OCULAR_MOUNT: { ...prevOcular, hp: 0, amputated: true } },
          },
        },
      },
    };

    const blindedGuard = world.entities[guardId]!;
    expect(computeActorFovRadius(blindedGuard, 8)).toBe(1);

    // Guard at (10, 5) cannot spot player at (8, 5) (distance 2 > 1)
    world = {
      ...world,
      entities: {
        ...world.entities,
        [playerId]: { ...world.entities[playerId]!, position: { x: 8, y: 5, stratum: 'STREET', blocksMovement: true, blocksSight: false } },
      },
    };
    expect(canActorSpotTarget(world, guardId, playerId)).toBe(false);

    // Guard CAN spot adjacent player at (9, 5) (distance 1 <= 1)
    world = {
      ...world,
      entities: {
        ...world.entities,
        [playerId]: { ...world.entities[playerId]!, position: { x: 9, y: 5, stratum: 'STREET', blocksMovement: true, blocksSight: false } },
      },
    };
    expect(canActorSpotTarget(world, guardId, playerId)).toBe(true);
  });

  it('(c) smashing a window or walking with pneumatic prosthetics lures an out-of-sight guard', () => {
    let world = setupStealthScenario();
    // Position guard at (10, 10) around the corner so broken window doesn't give direct line-of-sight
    world = {
      ...world,
      entities: {
        ...world.entities,
        [guardId]: {
          ...world.entities[guardId]!,
          position: { x: 10, y: 10, stratum: 'STREET', blocksMovement: true, blocksSight: false },
        },
      },
    };

    let street = world.strata.STREET!;
    for (let y = 0; y < 20; y++) {
      street = setTileCell(street, 3, y, (c) => ({ ...c, blocksMovement: true, blocksSight: true }));
    }
    street = setTileCell(street, 3, 5, (c) => ({ ...c, terrainType: 'GLASS_WINDOW', blocksMovement: true, blocksSight: true }));
    world = { ...world, strata: { ...world.strata, STREET: street } };

    expect(canActorSpotTarget(world, guardId, playerId)).toBe(false);
    expect(world.entities[guardId]!.aiController!.alertState).toBe('IDLE');

    const smashRes = dispatchCommand(world, {
      type: 'SMASH_TERRAIN',
      actorId: playerId,
      target: { x: 3, y: 5, stratum: 'STREET' },
    });
    world = smashRes.state;

    expect(smashRes.events).toContainEqual(expect.objectContaining({ type: 'SOUND_EMITTED', decibels: 85 }));
    const alertedGuard = world.entities[guardId]!;
    expect(alertedGuard.aiController!.alertState).toBe('INVESTIGATING');
    expect(alertedGuard.aiController!.lastKnownTargetPos).toEqual({ x: 3, y: 5, stratum: 'STREET' });

    // Guard advances towards lastKnownTargetPos on NPC turn
    const waitRes = dispatchCommand(world, { type: 'WAIT_TURN', actorId: playerId });
    world = waitRes.state;
    const movedGuard = world.entities[guardId]!;
    expect(movedGuard.position!.x).toBeLessThan(10);

    // Walking with pneumatic leg emits sound and alerts distant guard
    let walkWorld = setupStealthScenario();
    const legEntity = createEntityFromBlueprint('prosthetic_pneumatic_leg_mk1', EntityIdSchema.parse('item_pneumatic_leg'))!;
    walkWorld = {
      ...walkWorld,
      entities: {
        ...walkWorld.entities,
        item_pneumatic_leg: legEntity,
      },
    };
    walkWorld = dispatchCommand(walkWorld, {
      type: 'INSTALL_PROSTHETIC',
      actorId: playerId,
      prostheticEntityId: EntityIdSchema.parse('item_pneumatic_leg'),
      slot: 'LEFT_LEG',
    }).state;

    const stepRes = dispatchCommand(walkWorld, { type: 'MOVE_STEP', actorId: playerId, dx: 0, dy: 1 });
    expect(stepRes.events).toContainEqual(expect.objectContaining({ type: 'SOUND_EMITTED', decibels: 30 }));
  });
});
