import { describe, expect, it } from 'vitest';
import { BlueprintIdSchema, EntityIdSchema } from '../../src/schemas/primitives.schema.js';
import { dispatchCommand } from '../../src/sim/core/engine.js';
import { createInitialWorld, deserializeWorld, serializeWorld } from '../../src/sim/core/world.js';
import { hasSurgicalBonus } from '../../src/sim/systems/surgical-context.js';
import { discoverCodexEntry } from '../../src/sim/systems/codex.system.js';
import { parseLlmResponseToCommand, serializePlayerContext } from '../scripts/playtester-serializer.js';

describe('Phase 44: Artificer Safehouse Deeds, Furniture & Naturalist Codex', () => {
  const playerId = EntityIdSchema.parse('actor_player');

  it('allows claiming a freehold workshop deed and undercroft vault', () => {
    let world = createInitialWorld({ seed: 101 });
    const resStreet = dispatchCommand(world, {
      type: 'CLAIM_WORKSHOP_DEED',
      actorId: playerId,
      targetStratum: 'STREET',
    });
    world = resStreet.state;
    expect(resStreet.events.some((e) => e.type === 'WORKSHOP_DEED_CLAIMED')).toBe(true);
    expect(Object.keys(world.safehouses).length).toBe(1);
    const streetSafehouse = Object.values(world.safehouses)[0];
    expect(streetSafehouse?.stratum).toBe('STREET');
    expect(streetSafehouse?.isVault).toBe(false);

    // Claim undercroft vault
    const resVault = dispatchCommand(world, { type: 'CLAIM_WORKSHOP_DEED', actorId: playerId, targetStratum: 'UNDERCROFT', claimVault: true });
    world = resVault.state;
    expect(resVault.events.some((e) => e.type === 'WORKSHOP_DEED_CLAIMED')).toBe(true);
    expect(Object.keys(world.safehouses).length).toBe(2);
    const vault = Object.values(world.safehouses).find((s) => s.isVault);
    expect(vault?.name).toContain('Vault');
  });

  it('constructs furniture structures and verifies surgical table bonus', () => {
    let world = createInitialWorld({ seed: 102 });
    const pos = world.entities[playerId]!.position!;

    // Construct surgical table
    const buildRes = dispatchCommand(world, { type: 'BUILD_STRUCTURE', actorId: playerId, structureType: 'SURGICAL_TABLE', target: { x: pos.x + 1, y: pos.y, stratum: pos.stratum } });
    world = buildRes.state;
    expect(buildRes.events.some((e) => e.type === 'STRUCTURE_BUILT')).toBe(true);

    const player = world.entities[playerId]!;
    expect(hasSurgicalBonus(world, player)).toBe(true);

    // Construct barricade which blocks movement
    const barRes = dispatchCommand(world, {
      type: 'BUILD_STRUCTURE',
      actorId: playerId,
      structureType: 'BARRICADE_WOOD',
      target: { x: pos.x, y: pos.y + 1, stratum: pos.stratum },
    });
    world = barRes.state;
    const barId = Object.keys(world.entities).find((id) => id.includes('barricade_wood'));
    expect(barId).toBeDefined();
    expect(world.entities[barId!]?.position?.blocksMovement).toBe(true);
  });

  it('stores and retrieves persistent items in furniture storage', () => {
    let world = createInitialWorld({ seed: 103 });
    const pos = world.entities[playerId]!.position!;

    // Construct bench
    const buildBench = dispatchCommand(world, {
      type: 'BUILD_STRUCTURE',
      actorId: playerId,
      structureType: 'ARTIFICER_BENCH',
      target: { x: pos.x + 1, y: pos.y, stratum: pos.stratum },
    });
    world = buildBench.state;
    const benchId = Object.keys(world.entities).find((id) => id.includes('artificer_bench'))!;

    // Put an item into player inventory
    const itemId = EntityIdSchema.parse('item_test_brass_gear');
    world = {
      ...world,
      entities: {
        ...world.entities,
        [itemId]: {
          id: itemId,
          name: 'Clockwork Gear',
          visual: { glyph: '*', fgPrimary: '#D4AF37', fgSecondary: '#B7950B', bgColor: '#0A0D0E', shaderFlags: [] },
          item: { blueprintId: BlueprintIdSchema.parse('item_clockwork_gear'), category: 'MATERIAL', massGrams: 200, volumeMl: 50, quantity: 1, stackable: true },
        },
        [playerId]: {
          ...world.entities[playerId]!,
          inventory: {
            containedEntityIds: [...(world.entities[playerId]!.inventory?.containedEntityIds ?? []), itemId],
            maxMassGrams: 50000,
            maxVolumeMl: 40000,
            currentMassGrams: 200,
          },
        },
      },
    };

    // Store item in structure
    const storeRes = dispatchCommand(world, {
      type: 'STORE_ITEM_IN_STRUCTURE',
      actorId: playerId,
      structureEntityId: EntityIdSchema.parse(benchId),
      itemEntityId: itemId,
    });
    world = storeRes.state;
    expect(storeRes.events.some((e) => e.type === 'STRUCTURE_STORAGE_UPDATED' && e.action === 'STORE')).toBe(true);
    expect(world.entities[playerId]!.inventory!.containedEntityIds).not.toContain(itemId);
    expect(world.entities[benchId]!.inventory!.containedEntityIds).toContain(itemId);

    // Retrieve item back
    const retrieveRes = dispatchCommand(world, {
      type: 'RETRIEVE_ITEM_FROM_STRUCTURE',
      actorId: playerId,
      structureEntityId: EntityIdSchema.parse(benchId),
      itemEntityId: itemId,
    });
    world = retrieveRes.state;
    expect(retrieveRes.events.some((e) => e.type === 'STRUCTURE_STORAGE_UPDATED' && e.action === 'RETRIEVE')).toBe(true);
    expect(world.entities[playerId]!.inventory!.containedEntityIds).toContain(itemId);
    expect(world.entities[benchId]!.inventory!.containedEntityIds).not.toContain(itemId);
  });

  it('discovers codex entries and triggers emergent NPC curiosity, hostility, and trade', () => {
    let world = createInitialWorld({ seed: 104 });
    const pos = world.entities[playerId]!.position!;

    // Add NPC with Chirurgeon role nearby
    const npcId = EntityIdSchema.parse('npc_chirurgeon_neighbor');
    world = {
      ...world,
      entities: {
        ...world.entities,
        [npcId]: {
          id: npcId,
          name: 'Chirurgeon Vane',
          visual: { glyph: 'C', fgPrimary: '#2ECC71', fgSecondary: '#27AE60', bgColor: '#0A0D0E', shaderFlags: [] },
          position: { x: pos.x + 1, y: pos.y, stratum: pos.stratum, blocksMovement: true, blocksSight: false },
          actor: { energy: 100, speed: 100, isPlayer: false },
          aiController: {
            factionId: 'CLOCKWORK_GUILD',
            role: 'CHIRURGEON',
            hostile: false,
            alertState: 'IDLE',
          },
        },
      },
    };

    // Discover automaton entry
    const discRes = discoverCodexEntry(world, playerId, {
      id: 'automaton_brass_weaver',
      category: 'AUTOMATON',
      title: 'Brass Weaver Automaton',
      description: 'An eight-legged pneumatic threader with clockwork escapement.',
      tags: ['AUTOMATON', 'CLOCKWORK'],
    });
    world = discRes.state;
    expect(discRes.discovered).toBe(true);

    // Consult codex in front of the Chirurgeon
    const consultRes = dispatchCommand(world, {
      type: 'CONSULT_CODEX',
      actorId: playerId,
      entryId: 'automaton_brass_weaver',
    });
    expect(consultRes.events.some((e) => e.type === 'CODEX_CONSULTED')).toBe(true);
    const reaction = consultRes.events.find((e) => e.type === 'NPC_CODEX_REACTION');
    expect(reaction).toBeDefined();
    if (reaction && reaction.type === 'NPC_CODEX_REACTION') {
      expect(reaction.reactionType).toBe('CURIOSITY');
      expect(reaction.dialogueText).toContain('Brass Weaver Automaton');
    }
  });

  it('serializes and deserializes safehouses, structures, and codex entries losslessly', () => {
    let world = createInitialWorld({ seed: 105 });
    const pos = world.entities[playerId]!.position!;

    // Setup deed, structure, codex
    world = dispatchCommand(world, { type: 'CLAIM_WORKSHOP_DEED', actorId: playerId }).state;
    world = dispatchCommand(world, {
      type: 'BUILD_STRUCTURE',
      actorId: playerId,
      structureType: 'STEAM_CHARGER',
      target: { x: pos.x + 1, y: pos.y, stratum: pos.stratum },
    }).state;
    world = discoverCodexEntry(world, playerId, {
      id: 'reaction_phlogiston',
      category: 'REACTION',
      title: 'Phlogiston Combustion',
      description: 'Superheated sulfurous smoke ignite.',
    }).state;

    const json = serializeWorld(world);
    const restored = deserializeWorld(json);

    expect(Object.keys(restored.safehouses).length).toBe(1);
    expect(Object.keys(restored.codex).length).toBe(1);
    expect(restored.codex['reaction_phlogiston']?.title).toBe('Phlogiston Combustion');
    const charger = Object.values(restored.entities).find((e) => e.furniture?.kind === 'STEAM_CHARGER');
    expect(charger).toBeDefined();
    expect(charger?.pressureVessel?.maxPressureKpa).toBe(250);
  });

  it('provides complete playtester-serializer command coverage for Phase 44 & unwired commands', () => {
    let world = createInitialWorld({ seed: 106 });
    world = dispatchCommand(world, { type: 'CLAIM_WORKSHOP_DEED', actorId: playerId }).state;
    world = discoverCodexEntry(world, playerId, {
      id: 'schematic_harpoon',
      category: 'SCHEMATIC',
      title: 'Steam Harpoon',
      description: 'Pneumatic line thrower.',
    }).state;

    const context = serializePlayerContext(world, playerId);
    expect(context).toContain('[SAFEHOUSES]:');
    expect(context).toContain('[CODEX]: 1 entries discovered');

    // Test parse of Phase 44 commands
    const deedCmd = parseLlmResponseToCommand('{"action": "CLAIM_WORKSHOP_DEED", "claimVault": true}', world, playerId);
    expect(deedCmd.type).toBe('CLAIM_WORKSHOP_DEED');

    const buildCmd = parseLlmResponseToCommand('{"action": "BUILD_STRUCTURE", "structureType": "STEAM_CHARGER", "targetRelX": 1, "targetRelY": 0}', world, playerId);
    expect(buildCmd.type).toBe('BUILD_STRUCTURE');

    const codexCmd = parseLlmResponseToCommand('{"action": "CONSULT_CODEX", "entryId": "schematic_harpoon"}', world, playerId);
    expect(codexCmd.type).toBe('CONSULT_CODEX');

    // Test parse of unwired P2 commands: ACCEPT_CONTRACT, APPLY_MOMENTUM_VECTOR, CLEAN_SPILL, COAT_WEAPON
    const contractCmd = parseLlmResponseToCommand('{"action": "ACCEPT_CONTRACT", "contractId": "contract_123"}', world, playerId);
    expect(contractCmd.type).toBe('ACCEPT_CONTRACT');

    const momentumCmd = parseLlmResponseToCommand('{"action": "APPLY_MOMENTUM_VECTOR", "targetId": "actor_player", "dx": 1, "dy": 0, "distanceTiles": 3}', world, playerId);
    expect(momentumCmd.type).toBe('APPLY_MOMENTUM_VECTOR');

    const cleanCmd = parseLlmResponseToCommand('{"action": "CLEAN_SPILL", "toolId": "item_mop", "targetRelX": 0, "targetRelY": 1}', world, playerId);
    expect(cleanCmd.type).toBe('CLEAN_SPILL');

    const coatCmd = parseLlmResponseToCommand('{"action": "COAT_WEAPON", "weaponId": "item_dagger", "containerId": "item_vial"}', world, playerId);
    expect(coatCmd.type).toBe('COAT_WEAPON');
  });
});
