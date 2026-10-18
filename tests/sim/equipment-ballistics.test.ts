import { describe, expect, it } from 'vitest';
import { dispatchCommand } from '../../src/sim/core/engine.js';
import { createInitialWorld } from '../../src/sim/core/world.js';
import { createEntityFromBlueprint } from '../../src/sim/data/item-catalog.js';
import { EntityId, EntityIdSchema, StratumId } from '../../src/schemas/primitives.schema.js';
import { setTileCell } from '../../src/sim/spatial/grid.js';

const SLOTS = ['TORSO', 'HEAD', 'LEFT_ARM', 'RIGHT_ARM', 'LEFT_LEG', 'RIGHT_LEG', 'OCULAR_MOUNT', 'CHASSIS_CORE'] as const;

function createDummyTarget(id: EntityId, x: number, y: number, stratum: StratumId) {
  const limbs = Object.fromEntries(SLOTS.map((s) => [s, { slot: s, hp: 50, maxHp: 50, amputated: false }]));
  return {
    id, name: 'Rogue Automaton',
    visual: { glyph: 'A', fgPrimary: '#e74c3c', fgSecondary: '#c0392b', bgColor: '#000000', shaderFlags: [] },
    position: { x, y, stratum, blocksMovement: true, blocksSight: false },
    actor: { energy: 0, speed: 100, isPlayer: false },
    anatomy: { bloodVolumePct: 100, steamReserveKpa: 50, maxSteamReserveKpa: 100, unlockedRecipeIds: [], limbs },
  };
}

describe('Phase 22: Equipment, Wearables, and Pneumatic Ballistics', () => {
  it('equips and unequips rucksack expanding inventory volume', () => {
    const baseWorld = createInitialWorld({ seed: 1001 });
    const rucksack = createEntityFromBlueprint('gear_canvas_rucksack', EntityIdSchema.parse('item_rucksack_1'))!;

    const world = {
      ...baseWorld,
      entities: {
        ...baseWorld.entities,
        [rucksack.id]: rucksack,
        actor_player: {
          ...baseWorld.entities['actor_player']!,
          inventory: {
            ...baseWorld.entities['actor_player']!.inventory!,
            containedEntityIds: [...baseWorld.entities['actor_player']!.inventory!.containedEntityIds, rucksack.id],
          },
        },
      },
    };

    expect(world.entities['actor_player']!.inventory!.maxVolumeMl).toBe(30000);

    const equipRes = dispatchCommand(world, {
      type: 'EQUIP_ITEM', actorId: EntityIdSchema.parse('actor_player'), itemEntityId: rucksack.id,
    });

    const playerAfterEquip = equipRes.state.entities['actor_player']!;
    expect(playerAfterEquip.inventory!.equippedSlots?.['BACK_WEAR']).toBe(rucksack.id);
    expect(playerAfterEquip.inventory!.maxVolumeMl).toBe(50000);
    expect(equipRes.events.some((e) => e.type === 'ITEM_EQUIPPED')).toBe(true);

    const unequipRes = dispatchCommand(equipRes.state, {
      type: 'UNEQUIP_ITEM', actorId: EntityIdSchema.parse('actor_player'), slot: 'BACK_WEAR',
    });

    const playerAfterUnequip = unequipRes.state.entities['actor_player']!;
    expect(playerAfterUnequip.inventory!.equippedSlots?.['BACK_WEAR']).toBeUndefined();
    expect(playerAfterUnequip.inventory!.maxVolumeMl).toBe(30000);
    expect(unequipRes.events.some((e) => e.type === 'ITEM_UNEQUIPPED')).toBe(true);
  });

  it('equips heavy pipe wrench and boosts melee damage bonus', () => {
    const baseWorld = createInitialWorld({ seed: 1002 });
    const wrench = createEntityFromBlueprint('gear_heavy_pipe_wrench', EntityIdSchema.parse('item_wrench_1'))!;

    const world = {
      ...baseWorld,
      entities: {
        ...baseWorld.entities,
        [wrench.id]: wrench,
        actor_player: {
          ...baseWorld.entities['actor_player']!,
          inventory: {
            ...baseWorld.entities['actor_player']!.inventory!,
            containedEntityIds: [...baseWorld.entities['actor_player']!.inventory!.containedEntityIds, wrench.id],
          },
        },
      },
    };

    const initialDmg = world.entities['actor_player']!.combatStats?.meleeDamage ?? 12;

    const equipRes = dispatchCommand(world, {
      type: 'EQUIP_ITEM', actorId: EntityIdSchema.parse('actor_player'), itemEntityId: wrench.id,
    });

    const playerEquipped = equipRes.state.entities['actor_player']!;
    expect(playerEquipped.inventory!.equippedSlots?.['WIELD']).toBe(wrench.id);
    expect(playerEquipped.combatStats!.meleeDamage).toBe(initialDmg + 8);

    const unequipRes = dispatchCommand(equipRes.state, {
      type: 'UNEQUIP_ITEM', actorId: EntityIdSchema.parse('actor_player'), slot: 'WIELD',
    });

    expect(unequipRes.state.entities['actor_player']!.combatStats!.meleeDamage).toBe(initialDmg);
  });

  it('asbestos foundry coat protects against thermal scald in steam cloud', () => {
    const baseWorld = createInitialWorld({ seed: 1003 });
    const coat = createEntityFromBlueprint('gear_asbestos_foundry_coat', EntityIdSchema.parse('item_coat_1'))!;
    const player = baseWorld.entities['actor_player']!;
    const pPos = player.position!;

    const stratum = baseWorld.strata[pPos.stratum]!;
    const chargedGrid = setTileCell(stratum, pPos.x, pPos.y, (cell) => ({ ...cell, steamPressureKpa: 45 }));

    const worldWithoutCoat = {
      ...baseWorld,
      strata: { ...baseWorld.strata, [pPos.stratum]: chargedGrid },
    };

    const waitNoCoat = dispatchCommand(worldWithoutCoat, {
      type: 'WAIT_TURN', actorId: EntityIdSchema.parse('actor_player'),
    });
    expect(waitNoCoat.events.some((e) => e.type === 'THERMAL_SCALD')).toBe(true);

    const worldWithCoat = {
      ...worldWithoutCoat,
      entities: {
        ...worldWithoutCoat.entities,
        [coat.id]: coat,
        actor_player: {
          ...player,
          inventory: {
            ...player.inventory!,
            containedEntityIds: [...player.inventory!.containedEntityIds, coat.id],
            equippedSlots: { TORSO_WEAR: coat.id },
          },
        },
      },
    };

    const waitWithCoat = dispatchCommand(worldWithCoat, {
      type: 'WAIT_TURN', actorId: EntityIdSchema.parse('actor_player'),
    });
    expect(waitWithCoat.events.some((e) => e.type === 'THERMAL_SCALD')).toBe(false);
  });

  it('fires pneumatic harpoon rifle at 4 tiles consuming steam and inflicting damage', () => {
    const baseWorld = createInitialWorld({ seed: 1004 });
    const rifle = createEntityFromBlueprint('gear_pneumatic_harpoon_rifle', EntityIdSchema.parse('item_rifle_1'))!;
    const player = baseWorld.entities['actor_player']!;
    const pPos = player.position!;
    const targetId = EntityIdSchema.parse('actor_target_dummy');
    const targetEntity = createDummyTarget(targetId, pPos.x + 4, pPos.y, pPos.stratum);

    let stratum = baseWorld.strata[pPos.stratum]!;
    for (let x = pPos.x + 1; x < pPos.x + 4; x++) {
      stratum = setTileCell(stratum, x, pPos.y, (c) => ({ ...c, blocksMovement: false, blocksSight: false }));
    }

    const world = {
      ...baseWorld,
      strata: { ...baseWorld.strata, [pPos.stratum]: stratum },
      entities: {
        ...baseWorld.entities,
        [rifle.id]: rifle,
        [targetId]: targetEntity,
        actor_player: {
          ...player,
          anatomy: { ...player.anatomy!, steamReserveKpa: 80 },
          inventory: {
            ...player.inventory!,
            containedEntityIds: [...player.inventory!.containedEntityIds, rifle.id],
            equippedSlots: { WIELD: rifle.id },
          },
        },
      },
    };

    const fireRes = dispatchCommand(world, {
      type: 'FIRE_RANGED_WEAPON', actorId: EntityIdSchema.parse('actor_player'), targetId, targetSlot: 'TORSO',
    });

    const fireEvent = fireRes.events.find((e) => e.type === 'RANGED_ATTACK_RESOLVED');
    expect(fireEvent).toBeDefined();
    if (fireEvent && fireEvent.type === 'RANGED_ATTACK_RESOLVED') {
      expect(fireEvent.weaponName).toBe(rifle.name);
      expect(fireEvent.steamSpentKpa).toBe(12);
    }

    const playerAfter = fireRes.state.entities['actor_player']!;
    expect(playerAfter.anatomy!.steamReserveKpa).toBe(80 - 12);
  });

  it('fails firing when steam is insufficient or LOS is blocked', () => {
    const baseWorld = createInitialWorld({ seed: 1005 });
    const rifle = createEntityFromBlueprint('gear_pneumatic_harpoon_rifle', EntityIdSchema.parse('item_rifle_2'))!;
    const player = baseWorld.entities['actor_player']!;
    const pPos = player.position!;
    const targetId = EntityIdSchema.parse('actor_target_dummy_2');
    const targetEntity = createDummyTarget(targetId, pPos.x + 3, pPos.y, pPos.stratum);

    const lowSteamWorld = {
      ...baseWorld,
      entities: {
        ...baseWorld.entities,
        [rifle.id]: rifle,
        [targetId]: targetEntity,
        actor_player: {
          ...player,
          anatomy: { ...player.anatomy!, steamReserveKpa: 5 },
          inventory: {
            ...player.inventory!,
            containedEntityIds: [...player.inventory!.containedEntityIds, rifle.id],
            equippedSlots: { WIELD: rifle.id },
          },
        },
      },
    };

    const failSteamRes = dispatchCommand(lowSteamWorld, {
      type: 'FIRE_RANGED_WEAPON', actorId: EntityIdSchema.parse('actor_player'), targetId, targetSlot: 'TORSO',
    });
    expect(failSteamRes.events.some((e) => e.type === 'EQUIPMENT_ACTION_FAILED')).toBe(true);

    let blockedStratum = baseWorld.strata[pPos.stratum]!;
    blockedStratum = setTileCell(blockedStratum, pPos.x + 1, pPos.y, (c) => ({ ...c, blocksSight: true }));

    const blockedWorld = {
      ...baseWorld,
      strata: { ...baseWorld.strata, [pPos.stratum]: blockedStratum },
      entities: {
        ...baseWorld.entities,
        [rifle.id]: rifle,
        [targetId]: targetEntity,
        actor_player: {
          ...player,
          anatomy: { ...player.anatomy!, steamReserveKpa: 50 },
          inventory: {
            ...player.inventory!,
            containedEntityIds: [...player.inventory!.containedEntityIds, rifle.id],
            equippedSlots: { WIELD: rifle.id },
          },
        },
      },
    };

    const failLosRes = dispatchCommand(blockedWorld, {
      type: 'FIRE_RANGED_WEAPON', actorId: EntityIdSchema.parse('actor_player'), targetId, targetSlot: 'TORSO',
    });
    expect(failLosRes.events.some((e) => e.type === 'EQUIPMENT_ACTION_FAILED')).toBe(true);
  });
});
