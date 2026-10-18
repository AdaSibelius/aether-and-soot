import { describe, expect, it } from 'vitest';
import { EntityIdSchema } from '../../src/schemas/primitives.schema.js';
import { dispatchCommand } from '../../src/sim/core/engine.js';
import { createInitialWorld, WorldState } from '../../src/sim/core/world.js';
import { generateVictorianDistrict } from '../../src/sim/spatial/generator.js';
import { spawnDistrictNpcs } from '../../src/sim/systems/ai.system.js';

describe('Phase 10: Autonomous NPCs, Enemies, Faction AI & Targeted Limb Combat', () => {
  const playerId = EntityIdSchema.parse('actor_player');
  const wardenId = EntityIdSchema.parse('npc_clockwork_warden');
  const scavengerId = EntityIdSchema.parse('npc_sump_scavenger');

  function setupDistrictWithNpcs(seed: number): WorldState {
    const base = createInitialWorld({ seed, width: 24, height: 24 });
    const generated = generateVictorianDistrict(base).state;
    const withNpcs = spawnDistrictNpcs(generated).state;
    const player = withNpcs.entities[playerId]!;
    return {
      ...withNpcs,
      entities: {
        ...withNpcs.entities,
        [playerId]: {
          ...player,
          combatStats: { meleeDamage: 18, accuracyPct: 100, armorReduction: 2 },
        },
      },
    };
  }

  it('applies targeted limb debuffs (leg speed penalty & arm accuracy/damage reduction) and faction reputation penalties', () => {
    let world = setupDistrictWithNpcs(1001);
    const warden = world.entities[wardenId]!;
    const player = world.entities[playerId]!;

    // Place player adjacent to the Clockwork Warden at (10, 11) -> player at (11, 11)
    world = {
      ...world,
      entities: {
        ...world.entities,
        [playerId]: {
          ...player,
          position: { ...player.position!, x: warden.position!.x + 1, y: warden.position!.y, stratum: 'STREET' },
        },
      },
    };

    const initialRep = world.economy.factionReputation.CROWN_CONSTABULARY ?? 0;
    const initialSpeed = warden.actor!.speed;

    // 1. Strike LEFT_LEG -> slows warden speed, provokes hostility, and penalizes CROWN_CONSTABULARY reputation
    const legHit = dispatchCommand(world, {
      type: 'ATTACK_ACTOR',
      attackerId: playerId,
      targetId: wardenId,
      targetSlot: 'LEFT_LEG',
    });
    world = legHit.state;

    expect(legHit.events).toContainEqual(
      expect.objectContaining({
        type: 'COMBAT_ATTACK_RESOLVED',
        attackerId: playerId,
        targetId: wardenId,
        targetSlot: 'LEFT_LEG',
        hit: true,
      }),
    );

    const wardenAfterLeg = world.entities[wardenId]!;
    expect(wardenAfterLeg.actor!.speed).toBeLessThan(initialSpeed);
    expect(wardenAfterLeg.aiController!.hostile).toBe(true);
    expect(world.economy.factionReputation.CROWN_CONSTABULARY).toBe(initialRep - 15);

    // 2. Strike RIGHT_ARM -> reduces warden meleeDamage and accuracyPct
    const armHit = dispatchCommand(world, {
      type: 'ATTACK_ACTOR',
      attackerId: playerId,
      targetId: wardenId,
      targetSlot: 'RIGHT_ARM',
    });
    world = armHit.state;

    const wardenAfterArm = world.entities[wardenId]!;
    expect(wardenAfterArm.combatStats!.meleeDamage).toBeLessThan(warden.combatStats!.meleeDamage);
    expect(wardenAfterArm.combatStats!.accuracyPct).toBeLessThan(warden.combatStats!.accuracyPct);
  });

  it('defeats an actor when TORSO or HEAD drops to 0 HP and drops carried loot onto the tile', () => {
    let world = setupDistrictWithNpcs(1002);
    const scavenger = world.entities[scavengerId]!;
    const player = world.entities[playerId]!;

    // Place player on UNDERCROFT adjacent to the Sump Scavenger (at 11, 11 -> player at 12, 11) with high meleeDamage
    world = {
      ...world,
      entities: {
        ...world.entities,
        [playerId]: {
          ...player,
          position: { ...player.position!, x: scavenger.position!.x + 1, y: scavenger.position!.y, stratum: 'UNDERCROFT' },
          combatStats: { meleeDamage: 40, accuracyPct: 100, armorReduction: 5 },
        },
      },
    };

    const res = dispatchCommand(world, {
      type: 'ATTACK_ACTOR',
      attackerId: playerId,
      targetId: scavengerId,
      targetSlot: 'TORSO',
    });

    expect(res.events).toContainEqual(
      expect.objectContaining({
        type: 'ACTOR_DEFEATED',
        actorId: scavengerId,
        defeatedById: playerId,
      }),
    );

    // Scavenger entity is removed and its carried loot (loot_scavenger_salt) is dropped at (11, 11) on UNDERCROFT
    expect(res.state.entities[scavengerId]).toBeUndefined();
    const droppedLoot = res.state.entities[EntityIdSchema.parse('loot_scavenger_salt')];
    expect(droppedLoot?.position).toEqual({
      x: scavenger.position!.x,
      y: scavenger.position!.y,
      stratum: 'UNDERCROFT',
      blocksMovement: false,
      blocksSight: false,
    });
  });

  it('schedules autonomous hostile NPCs to pursue and attack the player in FOV', () => {
    let world = setupDistrictWithNpcs(1003);
    const scavenger = world.entities[scavengerId]!;
    const player = world.entities[playerId]!;

    // Place player 2 tiles away from Sump Scavenger in UNDERCROFT (scavenger at 11,11 -> player at 13,11)
    world = {
      ...world,
      entities: {
        ...world.entities,
        [playerId]: {
          ...player,
          position: { ...player.position!, x: scavenger.position!.x + 2, y: scavenger.position!.y, stratum: 'UNDERCROFT' },
        },
      },
    };

    // Turn 1: Player waits -> hostile scavenger steps from (11, 11) to (12, 11)
    const turn1 = dispatchCommand(world, { type: 'WAIT_TURN', actorId: playerId });
    world = turn1.state;
    expect(world.entities[scavengerId]?.position?.x).toBe(12);
    expect(world.entities[scavengerId]?.position?.y).toBe(11);

    // Turn 2: Player waits -> scavenger is now adjacent at (12, 11) and attacks player!
    const turn2 = dispatchCommand(world, { type: 'WAIT_TURN', actorId: playerId });
    expect(turn2.events).toContainEqual(
      expect.objectContaining({
        type: 'COMBAT_ATTACK_RESOLVED',
        attackerId: scavengerId,
        targetId: playerId,
      }),
    );
  });
});
