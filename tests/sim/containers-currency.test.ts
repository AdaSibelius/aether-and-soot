import { describe, expect, it } from 'vitest';
import { EntityIdSchema } from '../../src/schemas/primitives.schema.js';
import { dispatchCommand } from '../../src/sim/core/engine.js';
import { createInitialWorld } from '../../src/sim/core/world.js';
import { generateVictorianDistrict } from '../../src/sim/spatial/generator.js';
import { createEntityFromBlueprint } from '../../src/sim/data/item-catalog.js';

describe('Phase 23: Interactive Containers & Tangible Currency', () => {
  const playerId = EntityIdSchema.parse('actor_player');

  it('generates Victorian district with seeded inventories in LOCKER, CRATE, and BOOKSHELF', () => {
    const base = createInitialWorld({ seed: 1337 });
    const world = generateVictorianDistrict(base).state;

    const medLocker = world.entities['furniture_medicine_locker'];
    expect(medLocker).toBeDefined();
    expect(medLocker?.furniture?.kind).toBe('LOCKER');
    expect(medLocker?.inventory?.containedEntityIds.length).toBeGreaterThan(0);

    const gearCrate = world.entities['furniture_gear_crate'];
    expect(gearCrate).toBeDefined();
    expect(gearCrate?.furniture?.kind).toBe('CRATE');
    expect(gearCrate?.inventory?.containedEntityIds.length).toBeGreaterThan(0);

    const bookshelf = world.entities['furniture_bookshelf'];
    expect(bookshelf).toBeDefined();
    expect(bookshelf?.furniture?.kind).toBe('BOOKSHELF');
    expect(bookshelf?.inventory?.containedEntityIds.length).toBeGreaterThan(0);
  });

  it('loots items and auto-credits pence from an adjacent CRATE via LOOT_CONTAINER', () => {
    let state = createInitialWorld({ seed: 42 });
    const pPos = state.entities[playerId]!.position!;

    // Create a crate adjacent to the player with 1 material and 1 crown pence pouch
    const crateId = EntityIdSchema.parse('test_crate');
    const pouchId = EntityIdSchema.parse('test_pouch');
    const gearsId = EntityIdSchema.parse('test_gears');

    const pouch = createEntityFromBlueprint('item_crown_pence_pouch', pouchId, 1)!;
    const gears = createEntityFromBlueprint('mat_brass_gears', gearsId, 2)!;

    state = {
      ...state,
      entities: {
        ...state.entities,
        [pouchId]: pouch,
        [gearsId]: gears,
        [crateId]: {
          id: crateId,
          name: 'Storage Crate',
          visual: { glyph: '⌸', fgPrimary: '#D4AF37', fgSecondary: '#8B6914', bgColor: '#0A0D0E', shaderFlags: [] },
          position: { x: pPos.x + 1, y: pPos.y, stratum: pPos.stratum, blocksMovement: true, blocksSight: false },
          furniture: { kind: 'CRATE', label: 'Storage Crate' },
          inventory: {
            containedEntityIds: [pouchId, gearsId],
            currentMassGrams: 500,
            maxMassGrams: 50000,
            maxVolumeMl: 50000,
          },
        },
      },
    };

    const initialTreasury = state.economy.playerTreasuryPence;

    // Loot all items from crate
    const res = dispatchCommand(state, {
      type: 'LOOT_CONTAINER',
      actorId: playerId,
      containerId: crateId,
    });

    expect(res.events.some((e) => e.type === 'CONTAINER_LOOTED')).toBe(true);

    // Player should have gained 18 pence from the pouch
    expect(res.state.economy.playerTreasuryPence).toBe(initialTreasury + 18);

    // Gears should now be in player inventory
    const playerInv = res.state.entities[playerId]?.inventory;
    expect(playerInv?.containedEntityIds.includes(gearsId)).toBe(true);

    // Crate inventory should now be empty
    const updatedCrate = res.state.entities[crateId];
    expect(updatedCrate?.inventory?.containedEntityIds.length).toBe(0);

    // Pouch entity should be absorbed into treasury, not in player or container inventory
    expect(playerInv?.containedEntityIds.includes(pouchId)).toBe(false);
    expect(res.state.entities[pouchId]).toBeUndefined();
  });

  it('rejects LOOT_CONTAINER when out of range or when container is empty', () => {
    let state = createInitialWorld({ seed: 42 });
    const pPos = state.entities[playerId]!.position!;

    const farLockerId = EntityIdSchema.parse('far_locker');
    state = {
      ...state,
      entities: {
        ...state.entities,
        [farLockerId]: {
          id: farLockerId,
          name: 'Distant Locker',
          visual: { glyph: '⌸', fgPrimary: '#5DADE2', fgSecondary: '#2E86C1', bgColor: '#0A0D0E', shaderFlags: [] },
          position: { x: pPos.x + 5, y: pPos.y + 5, stratum: pPos.stratum, blocksMovement: true, blocksSight: false },
          furniture: { kind: 'LOCKER', label: 'Distant Locker' },
          inventory: { containedEntityIds: [], currentMassGrams: 0, maxMassGrams: 50000, maxVolumeMl: 50000 },
        },
      },
    };

    // Out of range check
    const outOfRangeRes = dispatchCommand(state, {
      type: 'LOOT_CONTAINER',
      actorId: playerId,
      containerId: farLockerId,
    });
    expect(outOfRangeRes.events.some((e) => e.type === 'FURNITURE_ACTION_FAILED' && e.reason === 'OUT_OF_RANGE')).toBe(true);

    // Move adjacent but container is empty
    state = {
      ...state,
      entities: {
        ...state.entities,
        [farLockerId]: {
          ...state.entities[farLockerId]!,
          position: { x: pPos.x + 1, y: pPos.y, stratum: pPos.stratum, blocksMovement: true, blocksSight: false },
        },
      },
    };

    const emptyRes = dispatchCommand(state, {
      type: 'LOOT_CONTAINER',
      actorId: playerId,
      containerId: farLockerId,
    });
    expect(emptyRes.events.some((e) => e.type === 'FURNITURE_ACTION_FAILED' && e.reason === 'CONTAINER_EMPTY')).toBe(true);
  });

  it('auto-credits playerTreasuryPence when picking up item_crown_pence_pouch from ground', () => {
    let state = createInitialWorld({ seed: 42 });
    const pPos = state.entities[playerId]!.position!;

    const pouchId = EntityIdSchema.parse('ground_pence_pouch');
    const pouch = createEntityFromBlueprint('item_crown_pence_pouch', pouchId, 1, {
      x: pPos.x,
      y: pPos.y,
      stratum: pPos.stratum,
    })!;

    state = {
      ...state,
      entities: {
        ...state.entities,
        [pouchId]: pouch,
      },
    };

    const initialTreasury = state.economy.playerTreasuryPence;

    const res = dispatchCommand(state, {
      type: 'PICK_UP_ITEM',
      actorId: playerId,
      itemEntityId: pouchId,
    });

    expect(res.events.some((e) => e.type === 'ITEM_PICKED_UP')).toBe(true);
    expect(res.state.economy.playerTreasuryPence).toBe(initialTreasury + 18);
    // Entity absorbed into treasury
    expect(res.state.entities[pouchId]).toBeUndefined();
  });

  it('defeating an NPC drops an item_crown_pence_pouch onto the tile', () => {
    let state = createInitialWorld({ seed: 42 });
    const pPos = state.entities[playerId]!.position!;
    const npcId = EntityIdSchema.parse('npc_enemy_target');

    // Create a low-HP enemy adjacent to player
    state = {
      ...state,
      entities: {
        ...state.entities,
        [npcId]: {
          id: npcId,
          name: 'Syndicate Footpad',
          visual: { glyph: 's', fgPrimary: '#E74C3C', fgSecondary: '#922B21', bgColor: '#0A0D0E', shaderFlags: [] },
          position: { x: pPos.x + 1, y: pPos.y, stratum: pPos.stratum, blocksMovement: true, blocksSight: false },
          actor: { energy: 0, speed: 100, isPlayer: false },
          aiController: { factionId: 'UNDERCROFT_SYNDICATE', role: 'SCAVENGER', hostile: true },
          combatStats: { meleeDamage: 8, accuracyPct: 75, armorReduction: 0 },
          anatomy: {
            bloodVolumePct: 100,
            steamReserveKpa: 0,
            maxSteamReserveKpa: 100,
            limbs: {
              HEAD: { slot: 'HEAD', hp: 1, maxHp: 20, amputated: false },
              TORSO: { slot: 'TORSO', hp: 1, maxHp: 40, amputated: false },
              LEFT_ARM: { slot: 'LEFT_ARM', hp: 20, maxHp: 20, amputated: false },
              RIGHT_ARM: { slot: 'RIGHT_ARM', hp: 20, maxHp: 20, amputated: false },
              LEFT_LEG: { slot: 'LEFT_LEG', hp: 20, maxHp: 20, amputated: false },
              RIGHT_LEG: { slot: 'RIGHT_LEG', hp: 20, maxHp: 20, amputated: false },
            },
            unlockedRecipeIds: [],
          },
          inventory: { containedEntityIds: [], maxMassGrams: 20000, maxVolumeMl: 20000, currentMassGrams: 0 },
        },
      },
    };

    // Attack torso to defeat
    const res = dispatchCommand(state, {
      type: 'ATTACK_ACTOR',
      attackerId: playerId,
      targetId: npcId,
      targetSlot: 'TORSO',
    });

    const defeatEvent = res.events.find((e) => e.type === 'ACTOR_DEFEATED');
    expect(defeatEvent).toBeDefined();

    // Check that dropped items include a crown pence pouch
    if (defeatEvent && defeatEvent.type === 'ACTOR_DEFEATED') {
      const droppedPouch = defeatEvent.droppedEntityIds
        .map((id) => res.state.entities[id])
        .find((e) => e?.item?.blueprintId === 'item_crown_pence_pouch');
      expect(droppedPouch).toBeDefined();
      expect(droppedPouch?.item?.penceValue).toBe(18);
    }
  });
});
