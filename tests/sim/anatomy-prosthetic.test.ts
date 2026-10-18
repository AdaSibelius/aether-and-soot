import { describe, expect, it } from 'vitest';
import { projectWorldToVisualFrame } from '../../src/client/projection/frame-adapter.js';
import { EntityIdSchema } from '../../src/schemas/primitives.schema.js';
import { dispatchCommand } from '../../src/sim/core/engine.js';
import { createInitialWorld } from '../../src/sim/core/world.js';

describe('Phase 3: Anatomy, Encumbrance & Socketed Pneumatic Prosthetics', () => {
  const playerId = EntityIdSchema.parse('actor_player');
  const striderLegId = EntityIdSchema.parse('item_pneumatic_strider_leg');
  const monocleId = EntityIdSchema.parse('item_aetheric_monocle');

  it('severs a limb when HP drops to 0, penalizes movement AP, and restores speed when a pressurized prosthetic is installed', () => {
    let world = createInitialWorld({ seed: 3030, width: 20, height: 20 });

    // Sever LEFT_LEG (30 maxHp)
    const dmgRes = dispatchCommand(world, {
      type: 'DAMAGE_LIMB',
      actorId: playerId,
      targetId: playerId,
      slot: 'LEFT_LEG',
      damage: 35,
    });
    world = dmgRes.state;

    expect(dmgRes.events).toContainEqual(
      expect.objectContaining({
        type: 'LIMB_AMPUTATED',
        targetId: playerId,
        slot: 'LEFT_LEG',
      }),
    );

    // Step with severed leg -> 160 AP
    const hobbledStep = dispatchCommand(world, {
      type: 'MOVE_STEP',
      actorId: playerId,
      dx: 1,
      dy: 0,
    });
    world = hobbledStep.state;
    expect(hobbledStep.events).toContainEqual(
      expect.objectContaining({
        type: 'ENTITY_MOVED',
        apSpent: 160,
      }),
    );

    // Socket Pneumatic Strider Leg Mk.I into LEFT_LEG
    const installRes = dispatchCommand(world, {
      type: 'INSTALL_PROSTHETIC',
      actorId: playerId,
      prostheticEntityId: striderLegId,
      slot: 'LEFT_LEG',
    });
    world = installRes.state;
    expect(installRes.events).toContainEqual(
      expect.objectContaining({
        type: 'PROSTHETIC_INSTALLED',
        prostheticEntityId: striderLegId,
        slot: 'LEFT_LEG',
      }),
    );

    // Step with pressurized pneumatic leg -> base 100 - 15 modifier = 85 AP, and consumes 2 kPa steam
    const augmentedStep = dispatchCommand(world, {
      type: 'MOVE_STEP',
      actorId: playerId,
      dx: 1,
      dy: 0,
    });
    world = augmentedStep.state;
    expect(augmentedStep.events).toContainEqual(
      expect.objectContaining({
        type: 'ENTITY_MOVED',
        apSpent: 85,
      }),
    );
    expect(world.entities[playerId]!.anatomy!.steamReserveKpa).toBe(98);
  });

  it('penalizes movement when steam reserve is depleted and recovers when boiler is refilled', () => {
    let world = createInitialWorld({ seed: 3031, width: 20, height: 20 });

    // Sever leg and install prosthetic
    world = dispatchCommand(world, {
      type: 'DAMAGE_LIMB',
      actorId: playerId,
      targetId: playerId,
      slot: 'LEFT_LEG',
      damage: 30,
    }).state;
    world = dispatchCommand(world, {
      type: 'INSTALL_PROSTHETIC',
      actorId: playerId,
      prostheticEntityId: striderLegId,
      slot: 'LEFT_LEG',
    }).state;

    // Drain player's steam reserve to 0
    const player = world.entities[playerId]!;
    world = {
      ...world,
      entities: {
        ...world.entities,
        [playerId]: {
          ...player,
          anatomy: {
            ...player.anatomy!,
            steamReserveKpa: 0,
          },
        },
      },
    };

    // Moving with unpressurized prosthetic on severed leg incurs dead-weight + uncompensated leg penalty (100 + 45 + 60 = 205 AP)
    const dryStep = dispatchCommand(world, {
      type: 'MOVE_STEP',
      actorId: playerId,
      dx: 0,
      dy: 1,
    });
    world = dryStep.state;
    expect(dryStep.events).toContainEqual(
      expect.objectContaining({
        type: 'ENTITY_MOVED',
        apSpent: 205,
      }),
    );

    // Refill boiler steam
    const refillRes = dispatchCommand(world, {
      type: 'REFILL_STEAM',
      actorId: playerId,
      pressureAddedKpa: 40,
    });
    world = refillRes.state;
    expect(world.entities[playerId]!.anatomy!.steamReserveKpa).toBe(40);

    // Next step is back to 85 AP
    const repressurizedStep = dispatchCommand(world, {
      type: 'MOVE_STEP',
      actorId: playerId,
      dx: 0,
      dy: 1,
    });
    expect(repressurizedStep.events).toContainEqual(
      expect.objectContaining({
        type: 'ENTITY_MOVED',
        apSpent: 85,
      }),
    );
  });

  it('rejects mismatched socket installations and expands FOV radius when Aetheric Monocle is installed', () => {
    let world = createInitialWorld({ seed: 3032, width: 24, height: 24 });

    // Attempt to install Ocular Monocle into RIGHT_ARM -> SLOT_MISMATCH
    const mismatchRes = dispatchCommand(world, {
      type: 'INSTALL_PROSTHETIC',
      actorId: playerId,
      prostheticEntityId: monocleId,
      slot: 'RIGHT_ARM',
    });
    expect(mismatchRes.events).toContainEqual(
      expect.objectContaining({
        type: 'PROSTHETIC_ACTION_FAILED',
        reason: 'SLOT_MISMATCH',
      }),
    );

    const baseFrame = projectWorldToVisualFrame(world, playerId, 8);
    expect(baseFrame.effectiveFovRadius).toBe(8);

    // Install Ocular Monocle into OCULAR_MOUNT
    const validInstall = dispatchCommand(world, {
      type: 'INSTALL_PROSTHETIC',
      actorId: playerId,
      prostheticEntityId: monocleId,
      slot: 'OCULAR_MOUNT',
    });
    world = validInstall.state;

    const augmentedFrame = projectWorldToVisualFrame(world, playerId, 8);
    expect(augmentedFrame.effectiveFovRadius).toBe(12);
  });
});
