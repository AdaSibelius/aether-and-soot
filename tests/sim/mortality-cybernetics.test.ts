import { describe, expect, it } from 'vitest';
import { EntityIdSchema } from '../../src/schemas/primitives.schema.js';
import { dispatchCommand } from '../../src/sim/core/engine.js';
import { createInitialWorld } from '../../src/sim/core/world.js';
import { createEntityFromBlueprint } from '../../src/sim/data/item-catalog.js';
import { isActorFatal } from '../../src/sim/systems/mortality.system.js';

describe('Phase 28: Unified Mortality, Equipped-Gear Drop/Salvage Reversal & Cybernetics', () => {
  const playerId = EntityIdSchema.parse('actor_player');
  const enemyId = EntityIdSchema.parse('actor_cultist_target');

  it('drops loot, Crown Pence pouch, and fulfills slay contracts on lethal ranged ballistics kill', () => {
    let world = createInitialWorld({ seed: 2801, width: 20, height: 20 });
    const pPos = world.entities[playerId]!.position!;
    const ePos = { x: pPos.x + 2, y: pPos.y, stratum: pPos.stratum, blocksMovement: true, blocksSight: false };

    // Spawn an enemy cultist with 10 HP torso and a contract targeting them
    const enemy = {
      id: enemyId,
      name: 'Rogue Scribe',
      visual: { glyph: 'c', fgPrimary: '#E74C3C', fgSecondary: '#922B21', bgColor: '#0A0D0E', shaderFlags: [] },
      position: ePos,
      actor: { factionId: 'INDEPENDENT', isPlayer: false, energy: 0, speed: 100 },
      anatomy: {
        bloodVolumePct: 100, steamReserveKpa: 0, maxSteamReserveKpa: 100, unlockedRecipeIds: [],
        limbs: {
          TORSO: { name: 'Torso', maxHp: 30, hp: 10, amputated: false },
          HEAD: { name: 'Head', maxHp: 20, hp: 20, amputated: false },
        },
      },
      inventory: { containedEntityIds: [], equippedSlots: {}, currentMassGrams: 0, maxMassGrams: 20000, maxVolumeMl: 20000 },
    };

    // Equip pneumatic harpoon rifle on player
    const rifleId = EntityIdSchema.parse('item_harpoon_rifle_01');
    const rifle = createEntityFromBlueprint('gear_pneumatic_harpoon_rifle', rifleId, 1)!;

    const issuerId = EntityIdSchema.parse('actor_fixer_issuer');
    const issuer = {
      id: issuerId,
      name: 'Cog Fixer',
      visual: { glyph: 'F', fgPrimary: '#D4AF37', fgSecondary: '#555', bgColor: '#000', shaderFlags: [] },
      position: { x: pPos.x, y: pPos.y + 1, stratum: pPos.stratum, blocksMovement: true, blocksSight: false },
      actor: { factionId: 'CLOCKWORK_GUILD', isPlayer: false, energy: 0, speed: 100 },
    };

    world = {
      ...world,
      entities: {
        ...world.entities,
        [issuerId]: issuer,
        [enemyId]: enemy,
        [rifleId]: rifle,
        [playerId]: {
          ...world.entities[playerId]!,
          inventory: {
            ...world.entities[playerId]!.inventory!,
            containedEntityIds: [...world.entities[playerId]!.inventory!.containedEntityIds, rifleId],
            equippedSlots: { WIELD: rifleId },
          },
          anatomy: { ...world.entities[playerId]!.anatomy!, steamReserveKpa: 100 },
        },
      },
      contracts: [{
        id: 'contract_hunt_scribe',
        issuerNpcId: issuerId,
        factionId: 'CLOCKWORK_GUILD',
        title: 'Purge Rogue Scribe',
        description: 'Eliminate rogue scribe in Whitechapel',
        kind: 'SLAY_HOSTILE',
        targetBlueprintOrEntityId: enemyId,
        rewardPence: 75,
        rewardReputation: 15,
        status: 'ACTIVE',
      }],
    };

    // Fire ranged weapon at enemy TORSO (lethal blow)
    const fireRes = dispatchCommand(world, { type: 'FIRE_RANGED_WEAPON', actorId: playerId, targetId: enemyId, targetSlot: 'TORSO' });
    world = fireRes.state;

    // Enemy defeated and removed from entities
    expect(world.entities[enemyId]).toBeUndefined();

    // ACTOR_DEFEATED event emitted
    const defeatEv = fireRes.events.find((e) => e.type === 'ACTOR_DEFEATED');
    expect(defeatEv).toBeDefined();

    // Defeated NPC dropped a Crown Pence Pouch at death coordinate
    const penceDrop = Object.values(world.entities).find(
      (e) => e.item?.blueprintId === 'item_crown_pence_pouch' && e.position?.x === ePos.x && e.position?.y === ePos.y,
    );
    expect(penceDrop).toBeDefined();

    // Contract can now be completed
    const completeRes = dispatchCommand(world, {
      type: 'COMPLETE_CONTRACT',
      actorId: playerId,
      contractId: 'contract_hunt_scribe',
    });
    expect(completeRes.events).toContainEqual(expect.objectContaining({ type: 'CONTRACT_COMPLETED' }));
  });

  it('automatically unequips dropped items and reverses stat bonuses without ghost leaks', () => {
    let world = createInitialWorld({ seed: 2802, width: 12, height: 12 });
    const coatId = EntityIdSchema.parse('item_test_coat');
    const coat = createEntityFromBlueprint('gear_asbestos_foundry_coat', coatId, 1)!;

    world = {
      ...world,
      entities: {
        ...world.entities,
        [coatId]: coat,
        [playerId]: {
          ...world.entities[playerId]!,
          inventory: {
            ...world.entities[playerId]!.inventory!,
            containedEntityIds: [...world.entities[playerId]!.inventory!.containedEntityIds, coatId],
          },
        },
      },
    };

    // Equip coat -> +3 armor reduction
    world = dispatchCommand(world, { type: 'EQUIP_ITEM', actorId: playerId, itemEntityId: coatId }).state;
    expect(world.entities[playerId]!.inventory!.equippedSlots?.TORSO_WEAR).toBe(coatId);
    expect(world.entities[playerId]!.combatStats!.armorReduction).toBe(3);

    // Drop coat without explicitly unequipping it
    const dropRes = dispatchCommand(world, { type: 'DROP_ITEM', actorId: playerId, itemEntityId: coatId });
    world = dropRes.state;

    // Equipped slot was cleared and armor reduction bonus reverted to 0
    expect(world.entities[playerId]!.inventory!.equippedSlots?.TORSO_WEAR).toBeUndefined();
    expect(world.entities[playerId]!.combatStats!.armorReduction).toBe(0);
    expect(world.entities[coatId]!.position).toBeDefined();
    expect(dropRes.events.some((e) => e.type === 'ITEM_UNEQUIPPED')).toBe(true);
    expect(dropRes.events.some((e) => e.type === 'ITEM_DROPPED')).toBe(true);
  });

  it('automatically unequips salvaged items and recovers brass materials without stat leaks', () => {
    let world = createInitialWorld({ seed: 2803, width: 12, height: 12 });
    const wrenchId = EntityIdSchema.parse('item_test_wrench');
    const wrench = createEntityFromBlueprint('gear_heavy_pipe_wrench', wrenchId, 1)!;

    world = {
      ...world,
      entities: {
        ...world.entities,
        [wrenchId]: wrench,
        [playerId]: {
          ...world.entities[playerId]!,
          inventory: {
            ...world.entities[playerId]!.inventory!,
            containedEntityIds: [...world.entities[playerId]!.inventory!.containedEntityIds, wrenchId],
          },
        },
      },
    };

    // Equip wrench -> +8 melee damage (12 + 8 = 20)
    world = dispatchCommand(world, { type: 'EQUIP_ITEM', actorId: playerId, itemEntityId: wrenchId }).state;
    expect(world.entities[playerId]!.inventory!.equippedSlots?.WIELD).toBe(wrenchId);
    expect(world.entities[playerId]!.combatStats!.meleeDamage).toBe(20);

    // Salvage weapon directly from inventory while still wielded
    const salvageRes = dispatchCommand(world, { type: 'SALVAGE_ITEM', actorId: playerId, itemEntityId: wrenchId });
    world = salvageRes.state;

    // Slot unequipped, stats reverted, item consumed, scrap awarded
    expect(world.entities[playerId]!.inventory!.equippedSlots?.WIELD).toBeUndefined();
    expect(world.entities[playerId]!.combatStats!.meleeDamage).toBe(12); // base melee damage
    expect(salvageRes.events.some((e) => e.type === 'ITEM_UNEQUIPPED')).toBe(true);
    expect(salvageRes.events.some((e) => e.type === 'ITEM_SALVAGED')).toBe(true);
  });

  it('preserves actor_player in state.entities on fatal trauma for the Victorian Morgue inquest', () => {
    let world = createInitialWorld({ seed: 2804, width: 12, height: 12 });

    expect(isActorFatal(world.entities[playerId])).toBe(false);

    // Fatal damage to player TORSO
    const fatalRes = dispatchCommand(world, {
      type: 'DAMAGE_LIMB',
      actorId: playerId,
      targetId: playerId,
      slot: 'TORSO',
      damage: 100,
    });
    world = fatalRes.state;

    // Player entity is preserved in state so Coroner's Inquest modal can inspect final stats
    const deceasedPlayer = world.entities[playerId];
    expect(deceasedPlayer).toBeDefined();
    expect(isActorFatal(deceasedPlayer)).toBe(true);
    expect(deceasedPlayer!.anatomy!.limbs.TORSO!.hp).toBe(0);
  });

  it('prevents blood-loss shock during surgery when adjacent to a SURGICAL_TABLE fixture', () => {
    let world = createInitialWorld({ seed: 2805, width: 14, height: 14 });
    const pPos = world.entities[playerId]!.position!;
    const tableId = EntityIdSchema.parse('fixture_surgical_table_01');
    const legId = EntityIdSchema.parse('item_gyro_leg_01');
    const gyroLeg = createEntityFromBlueprint('prosthetic_clockwork_gyrostabilizer_leg', legId, 1)!;

    // Amputate player RIGHT_LEG
    world = dispatchCommand(world, {
      type: 'DAMAGE_LIMB',
      actorId: playerId,
      targetId: playerId,
      slot: 'RIGHT_LEG',
      damage: 40,
    }).state;

    // Reset blood to 80%
    world = {
      ...world,
      entities: {
        ...world.entities,
        [legId]: gyroLeg,
        [playerId]: { ...world.entities[playerId]!, anatomy: { ...world.entities[playerId]!.anatomy!, bloodVolumePct: 80 } },
      },
    };

    // Install without table -> loses 20% blood (drops to 60%)
    world = dispatchCommand(world, { type: 'INSTALL_PROSTHETIC', actorId: playerId, prostheticEntityId: legId, slot: 'RIGHT_LEG' }).state;
    expect(world.entities[playerId]!.anatomy!.bloodVolumePct).toBe(60);

    // Place a SURGICAL_TABLE adjacent to player
    world = {
      ...world,
      entities: {
        ...world.entities,
        [tableId]: {
          id: tableId, name: 'Operating Table', visual: { glyph: 'T', fgPrimary: '#FFF', fgSecondary: '#888', bgColor: '#000', shaderFlags: [] },
          position: { x: pPos.x + 1, y: pPos.y, stratum: pPos.stratum, blocksMovement: true, blocksSight: false },
          furniture: { kind: 'SURGICAL_TABLE', label: 'Cast-Iron Operating Table' },
        },
      },
    };

    // Remove prosthetic while adjacent to SURGICAL_TABLE -> 0 blood loss (remains 60%)
    world = dispatchCommand(world, { type: 'REMOVE_PROSTHETIC', actorId: playerId, slot: 'RIGHT_LEG' }).state;
    expect(world.entities[playerId]!.anatomy!.bloodVolumePct).toBe(60);
  });
});
