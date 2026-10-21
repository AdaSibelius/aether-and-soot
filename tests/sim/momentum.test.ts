import { describe, expect, it } from 'vitest';
import { EntityRecord } from '../../src/schemas/components.schema.js';
import { EntityIdSchema } from '../../src/schemas/primitives.schema.js';
import { dispatchCommand } from '../../src/sim/core/engine.js';
import { createInitialWorld } from '../../src/sim/core/world.js';
import { getTileCell, setTileCell } from '../../src/sim/spatial/grid.js';
import { canActorSpotTarget, computeActorStepNoiseDb } from '../../src/sim/systems/stealth-acoustics.system.js';

describe('Phase 39: Multi-Tile Momentum Physics, Collisions & Stealth Postures', () => {
  const playerId = EntityIdSchema.parse('actor_player');
  const npcId = EntityIdSchema.parse('actor_sentry_1');

  it('transitions posture and modifies footstep acoustics and cover visibility', () => {
    let world = createInitialWorld({ seed: 42, width: 20, height: 20 });
    const initialNoise = computeActorStepNoiseDb(world, playerId);

    // 1. Transition to CROUCHED stance
    const crouchRes = dispatchCommand(world, {
      type: 'SET_POSTURE',
      actorId: playerId,
      posture: 'CROUCHED',
    });
    world = crouchRes.state;

    expect(crouchRes.events).toContainEqual(
      expect.objectContaining({
        type: 'POSTURE_CHANGED',
        actorId: playerId,
        previousPosture: 'STANDING',
        newPosture: 'CROUCHED',
      }),
    );
    expect(world.entities[playerId]?.actor?.posture).toBe('CROUCHED');

    // Footstep noise is halved in crouch
    const crouchNoise = computeActorStepNoiseDb(world, playerId);
    expect(crouchNoise).toBe(Math.max(1, Math.floor(initialNoise / 2)));

    // 2. Crouch cover stealth check
    const playerPos = world.entities[playerId]!.position!;
    const sentryPos = { x: playerPos.x + 5, y: playerPos.y, stratum: playerPos.stratum, blocksMovement: true, blocksSight: false };
    const sentry: EntityRecord = {
      id: npcId,
      name: 'Clockwork Sentry',
      visual: { glyph: 'S', fgPrimary: '#E74C3C', fgSecondary: '#C0392B', bgColor: '#0A0D0E', shaderFlags: [] },
      position: sentryPos,
      actor: { energy: 100, speed: 100, isPlayer: false, posture: 'STANDING' },
    };
    world = { ...world, entities: { ...world.entities, [npcId]: sentry } };

    // Adjacent to rubble pile
    let grid = world.strata.STREET!;
    grid = setTileCell(grid, playerPos.x + 1, playerPos.y, (c) => ({ ...c, terrainType: 'RUBBLE_PILE', blocksMovement: false, blocksSight: false }));
    world = { ...world, strata: { ...world.strata, STREET: grid } };

    // Sentry cannot spot crouched player behind adjacent rubble from 5 tiles away
    expect(canActorSpotTarget(world, npcId, playerId)).toBe(false);
  });

  it('halves knockback distance when actor is in BRACED posture', () => {
    let world = createInitialWorld({ seed: 43, width: 20, height: 20 });
    const pPos = world.entities[playerId]!.position!;

    // Brace player
    world = dispatchCommand(world, { type: 'SET_POSTURE', actorId: playerId, posture: 'BRACED' }).state;
    expect(world.entities[playerId]?.actor?.posture).toBe('BRACED');

    // Apply 4-tile momentum vector east
    const pushRes = dispatchCommand(world, {
      type: 'APPLY_MOMENTUM_VECTOR',
      targetId: playerId,
      dx: 1,
      dy: 0,
      distanceTiles: 4,
    });

    // 4 tiles halved is 2 tiles
    expect(pushRes.events).toContainEqual(
      expect.objectContaining({
        type: 'ENTITY_KNOCKED_BACK',
        entityId: playerId,
        distanceTraveled: 2,
      }),
    );
    expect(pushRes.state.entities[playerId]?.position?.x).toBe(pPos.x + 2);
  });

  it('inflicts blunt collision trauma when thrown into a wall', () => {
    let world = createInitialWorld({ seed: 44, width: 20, height: 20 });
    const pPos = world.entities[playerId]!.position!;

    // Place soot brick wall 2 tiles east
    let grid = world.strata.STREET!;
    grid = setTileCell(grid, pPos.x + 2, pPos.y, (c) => ({ ...c, terrainType: 'SOOT_BRICK_WALL', blocksMovement: true, blocksSight: true }));
    world = { ...world, strata: { ...world.strata, STREET: grid } };

    const initialTorsoHp = world.entities[playerId]!.anatomy!.limbs.TORSO!.hp;

    // Apply 3-tile momentum vector east into wall
    const pushRes = dispatchCommand(world, {
      type: 'APPLY_MOMENTUM_VECTOR',
      targetId: playerId,
      dx: 1,
      dy: 0,
      distanceTiles: 3,
    });

    expect(pushRes.events).toContainEqual(
      expect.objectContaining({
        type: 'MOMENTUM_COLLISION_IMPACT',
        primaryEntityId: playerId,
        obstacleType: 'WALL',
      }),
    );
    // Entity stopped before wall at pPos.x + 1
    expect(pushRes.state.entities[playerId]?.position?.x).toBe(pPos.x + 1);
    expect(pushRes.state.entities[playerId]?.anatomy?.limbs.TORSO!.hp).toBeLessThan(initialTorsoHp);
  });

  it('smashes breakable GLASS_WINDOW and continues sliding with laceration trauma', () => {
    let world = createInitialWorld({ seed: 45, width: 20, height: 20 });
    const pPos = world.entities[playerId]!.position!;

    // Place GLASS_WINDOW 1 tile east
    let grid = world.strata.STREET!;
    grid = setTileCell(grid, pPos.x + 1, pPos.y, (c) => ({ ...c, terrainType: 'GLASS_WINDOW', blocksMovement: true, blocksSight: false }));
    world = { ...world, strata: { ...world.strata, STREET: grid } };

    // Apply 2-tile momentum vector east through window
    const pushRes = dispatchCommand(world, {
      type: 'APPLY_MOMENTUM_VECTOR',
      targetId: playerId,
      dx: 1,
      dy: 0,
      distanceTiles: 2,
    });

    expect(pushRes.events).toContainEqual(
      expect.objectContaining({
        type: 'TERRAIN_SMASHED',
        fromTerrain: 'GLASS_WINDOW',
        toTerrain: 'SMASHED_WINDOW_FRAME',
      }),
    );
    expect(pushRes.events).toContainEqual(
      expect.objectContaining({
        type: 'MOMENTUM_COLLISION_IMPACT',
        primaryEntityId: playerId,
        obstacleType: 'WINDOW',
      }),
    );
    // Window was shattered into passable frame
    const winCell = getTileCell(pushRes.state.strata.STREET!, pPos.x + 1, pPos.y)!;
    expect(winCell.terrainType).toBe('SMASHED_WINDOW_FRAME');
    expect(winCell.blocksMovement).toBe(false);

    // Actor passed through window to pPos.x + 2
    expect(pushRes.state.entities[playerId]?.position?.x).toBe(pPos.x + 2);
  });

  it('splits collision damage when sliding actor slams into another actor', () => {
    let world = createInitialWorld({ seed: 46, width: 20, height: 20 });
    const pPos = world.entities[playerId]!.position!;

    // Place sentry 1 tile east
    const sentry: EntityRecord = {
      id: npcId,
      name: 'Clockwork Sentry',
      visual: { glyph: 'S', fgPrimary: '#E74C3C', fgSecondary: '#C0392B', bgColor: '#0A0D0E', shaderFlags: [] },
      position: { x: pPos.x + 1, y: pPos.y, stratum: pPos.stratum, blocksMovement: true, blocksSight: false },
      actor: { energy: 100, speed: 100, isPlayer: false },
      anatomy: {
        ...world.entities[playerId]!.anatomy!,
        limbs: {
          TORSO: { slot: 'TORSO', hp: 30, maxHp: 30, amputated: false },
        },
      },
    };
    world = { ...world, entities: { ...world.entities, [npcId]: sentry } };

    const initialPlayerTorso = world.entities[playerId]!.anatomy!.limbs.TORSO!.hp;
    const initialNpcTorso = sentry.anatomy!.limbs.TORSO!.hp;

    // Push player into sentry
    const pushRes = dispatchCommand(world, {
      type: 'APPLY_MOMENTUM_VECTOR',
      targetId: playerId,
      dx: 1,
      dy: 0,
      distanceTiles: 2,
    });

    expect(pushRes.events).toContainEqual(
      expect.objectContaining({
        type: 'MOMENTUM_COLLISION_IMPACT',
        primaryEntityId: playerId,
        collidedWithEntityId: npcId,
        obstacleType: 'ENTITY',
      }),
    );
    // Both actors took torso damage
    expect(pushRes.state.entities[playerId]?.anatomy?.limbs.TORSO!.hp).toBeLessThan(initialPlayerTorso);
    expect(pushRes.state.entities[npcId]?.anatomy?.limbs.TORSO!.hp).toBeLessThan(initialNpcTorso);
    // Player stopped at pPos.x (did not occupy sentry tile)
    expect(pushRes.state.entities[playerId]?.position?.x).toBe(pPos.x);
  });
});
