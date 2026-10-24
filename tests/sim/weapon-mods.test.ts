import { describe, expect, it } from 'vitest';
import { EntityRecord } from '../../src/schemas/components.schema.js';
import { EquipmentSpec } from '../../src/schemas/equipment.schema.js';
import { BlueprintIdSchema, EntityIdSchema, ToolQualityId } from '../../src/schemas/primitives.schema.js';
import { dispatchCommand } from '../../src/sim/core/engine.js';
import { createInitialWorld } from '../../src/sim/core/world.js';
import { createEntityFromBlueprint } from '../../src/sim/data/item-catalog.js';
import { setTileCell } from '../../src/sim/spatial/grid.js';

describe('Phase 40: CDDA Tool Qualities, Weapon Modifications & Loaded Chambers', () => {
  const playerId = EntityIdSchema.parse('actor_player');
  const weaponId = EntityIdSchema.parse('item_rifle_1');
  const barrelModId = EntityIdSchema.parse('item_barrel_mod');
  const silencerModId = EntityIdSchema.parse('item_silencer_mod');
  const ammoId = EntityIdSchema.parse('item_flechette_ammo');
  const crowbarId = EntityIdSchema.parse('item_forged_crowbar');
  const targetId = EntityIdSchema.parse('actor_sentry_target');

  function makeItem(
    id: typeof weaponId,
    bp: string,
    equipSpec?: Partial<EquipmentSpec>,
    toolQualities?: Partial<Record<ToolQualityId, number>>,
    qty = 1,
  ): EntityRecord {
    const fullSpec: EquipmentSpec | undefined = equipSpec
      ? {
        equipSlot: equipSpec.equipSlot ?? 'WIELD',
        meleeDamageBonus: equipSpec.meleeDamageBonus ?? 0,
        armorBonus: equipSpec.armorBonus ?? 0,
        storageVolumeBonusMl: equipSpec.storageVolumeBonusMl ?? 0,
        steamResistanceKpa: equipSpec.steamResistanceKpa ?? 0,
        rangedRange: equipSpec.rangedRange ?? 0,
        rangedDamage: equipSpec.rangedDamage ?? 0,
        rangedSteamCostKpa: equipSpec.rangedSteamCostKpa ?? 0,
        ...equipSpec,
      }
      : undefined;

    return {
      id,
      name: bp,
      visual: { glyph: '}', fgPrimary: '#E67E22', fgSecondary: '#D35400', bgColor: '#0A0D0E', shaderFlags: [] },
      item: {
        blueprintId: BlueprintIdSchema.parse(bp),
        category: 'EQUIPMENT',
        massGrams: 1000,
        volumeMl: 1000,
        quantity: qty,
        stackable: qty > 1,
        equipmentSpec: fullSpec,
        toolQualities,
      },
      equipmentSpec: fullSpec,
    };
  }

  function setupWorld() {
    let world = createInitialWorld({ seed: 42, width: 20, height: 20 });
    const rifle = makeItem(weaponId, 'gear_pneumatic_harpoon_rifle', {
      equipSlot: 'WIELD', rangedRange: 6, rangedDamage: 15, rangedSteamCostKpa: 10, modSlots: 2, installedModBlueprintIds: [],
    });
    const barrel = makeItem(barrelModId, 'mod_rifled_barrel', {
      equipSlot: 'WIELD', weaponModSpec: { modType: 'BARREL', rangeModifier: 3, damageModifier: 4, noiseDecibelModifier: 0, steamCostModifier: 2 },
    });
    const silencer = makeItem(silencerModId, 'mod_acoustic_baffler', {
      equipSlot: 'WIELD', weaponModSpec: { modType: 'SILENCER', rangeModifier: 0, damageModifier: 0, noiseDecibelModifier: -25, steamCostModifier: 0 },
    });
    const ammo = makeItem(ammoId, 'ammo_flechette_harpoon', undefined, undefined, 5);
    const p = world.entities[playerId]!;
    return {
      ...world,
      entities: {
        ...world.entities, [weaponId]: rifle, [barrelModId]: barrel, [silencerModId]: silencer, [ammoId]: ammo,
        [playerId]: { ...p, inventory: { ...p.inventory!, containedEntityIds: [...p.inventory!.containedEntityIds, weaponId, barrelModId, silencerModId, ammoId], equippedSlots: { WIELD: weaponId } } },
      },
    };
  }

  it('installs weapon modification, updates specs, and consumes mod item', () => {
    let world = setupWorld();
    const initRange = world.entities[weaponId]!.equipmentSpec!.rangedRange;
    const res = dispatchCommand(world, { type: 'INSTALL_WEAPON_MOD', actorId: playerId, weaponEntityId: weaponId, modEntityId: barrelModId });
    world = res.state;

    expect(res.events).toContainEqual(expect.objectContaining({ type: 'WEAPON_MOD_INSTALLED', modBlueprintId: 'mod_rifled_barrel', remainingModSlots: 1 }));
    expect(world.entities[weaponId]!.equipmentSpec?.rangedRange).toBe(initRange + 3);
    expect(world.entities[playerId]!.inventory!.containedEntityIds).not.toContain(barrelModId);

    const unRes = dispatchCommand(world, { type: 'UNINSTALL_WEAPON_MOD', actorId: playerId, weaponEntityId: weaponId, modBlueprintId: BlueprintIdSchema.parse('mod_rifled_barrel') });
    expect(unRes.events).toContainEqual(expect.objectContaining({ type: 'WEAPON_MOD_UNINSTALLED', modBlueprintId: 'mod_rifled_barrel' }));
    expect(unRes.state.entities[weaponId]!.equipmentSpec?.installedModBlueprintIds).toHaveLength(0);
  });

  it('loads ammunition and fires with silenced acoustic telemetry and extra damage', () => {
    let world = setupWorld();
    world = dispatchCommand(world, { type: 'INSTALL_WEAPON_MOD', actorId: playerId, weaponEntityId: weaponId, modEntityId: silencerModId }).state;
    const loadRes = dispatchCommand(world, { type: 'LOAD_AMMO', actorId: playerId, weaponEntityId: weaponId, ammoEntityId: ammoId });
    world = loadRes.state;

    expect(loadRes.events).toContainEqual(expect.objectContaining({ type: 'AMMO_LOADED', ammoCount: 5 }));
    expect(world.entities[weaponId]!.equipmentSpec?.loadedAmmo?.count).toBe(5);

    const pPos = world.entities[playerId]!.position!;
    const target: EntityRecord = {
      id: targetId, name: 'Target Sentry',
      visual: { glyph: 'T', fgPrimary: '#E74C3C', fgSecondary: '#C0392B', bgColor: '#0A0D0E', shaderFlags: [] },
      position: { x: pPos.x + 3, y: pPos.y, stratum: pPos.stratum, blocksMovement: true, blocksSight: false },
      actor: { energy: 0, speed: 100, isPlayer: false },
      anatomy: { ...world.entities[playerId]!.anatomy! },
    };
    world = { ...world, entities: { ...world.entities, [targetId]: target } };

    const fireRes = dispatchCommand(world, { type: 'FIRE_RANGED_WEAPON', actorId: playerId, targetId, targetSlot: 'TORSO' });
    expect(fireRes.events).toContainEqual(expect.objectContaining({ type: 'SOUND_EMITTED', decibels: 50 }));
    expect(fireRes.state.entities[weaponId]?.equipmentSpec?.loadedAmmo?.count).toBe(4);
  });

  it('pries open a locked door using a tool with PRYING tool quality', () => {
    let world = createInitialWorld({ seed: 44, width: 20, height: 20 });
    const pPos = world.entities[playerId]!.position!;
    let grid = setTileCell(world.strata.STREET!, pPos.x + 1, pPos.y, (c) => ({ ...c, terrainType: 'WOODEN_DOOR_CLOSED', blocksMovement: true, blocksSight: true }));
    world = { ...world, strata: { ...world.strata, STREET: grid } };

    const crowbar = makeItem(crowbarId, 'gear_crowbar', undefined, { PRYING: 2 });
    const p = world.entities[playerId]!;
    world = { ...world, entities: { ...world.entities, [crowbarId]: crowbar, [playerId]: { ...p, inventory: { ...p.inventory!, containedEntityIds: [...p.inventory!.containedEntityIds, crowbarId] } } } };

    const pryRes = dispatchCommand(world, { type: 'PRY_OBSTACLE', actorId: playerId, target: { x: pPos.x + 1, y: pPos.y, stratum: 'STREET' }, toolEntityId: crowbarId });
    expect(pryRes.events).toContainEqual(expect.objectContaining({ type: 'OBSTACLE_PRIED', toolQuality: 2, fromTerrain: 'WOODEN_DOOR_CLOSED', toTerrain: 'WOODEN_DOOR_OPEN' }));
    expect(pryRes.state.strata.STREET!.cells[pPos.y * 20 + (pPos.x + 1)]?.blocksMovement).toBe(false);
  });

  it('calculates surgical harvest trauma using SURGERY tool quality', () => {
    let world = createInitialWorld({ seed: 45, width: 20, height: 20 });
    const pPos = world.entities[playerId]!.position!;
    const corpseId = EntityIdSchema.parse('actor_corpse_1');
    const scalpelId = EntityIdSchema.parse('tool_scalpel_1');
    const prostheticId = EntityIdSchema.parse('item_prosthetic_arm_1');

    const scalpel = makeItem(scalpelId, 'gear_surgical_scalpel', undefined, { SURGERY: 2 });
    const corpse: EntityRecord = {
      id: corpseId, name: 'Defeated Enforcer Corpse',
      visual: { glyph: '%', fgPrimary: '#7F8C8D', fgSecondary: '#95A5A6', bgColor: '#0A0D0E', shaderFlags: [] },
      position: { x: pPos.x + 1, y: pPos.y, stratum: pPos.stratum, blocksMovement: false, blocksSight: false },
      anatomy: {
        ...world.entities[playerId]!.anatomy!,
        bloodVolumePct: 0,
        limbs: {
          ...world.entities[playerId]!.anatomy!.limbs,
          LEFT_ARM: { slot: 'LEFT_ARM', hp: 0, maxHp: 25, amputated: false, installedProstheticEntityId: prostheticId },
        },
      },
    };
    const prostheticItem = createEntityFromBlueprint('prosthetic_pneumatic_piledriver_arm', prostheticId)!;

    const p = world.entities[playerId]!;
    world = {
      ...world,
      entities: {
        ...world.entities, [corpseId]: corpse, [scalpelId]: scalpel, [prostheticId]: prostheticItem,
        [playerId]: { ...p, inventory: { ...p.inventory!, containedEntityIds: [...p.inventory!.containedEntityIds, scalpelId] } },
      },
    };

    const harvestRes = dispatchCommand(world, { type: 'HARVEST_CORPSE', actorId: playerId, corpseEntityId: corpseId, slot: 'LEFT_ARM', toolEntityId: scalpelId });
    expect(harvestRes.events).toContainEqual(expect.objectContaining({ type: 'CYBERNETIC_HARVESTED', toolQuality: 'FINE' }));
  });
});
