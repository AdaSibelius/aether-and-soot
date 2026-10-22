import { describe, expect, it } from 'vitest';
import {
  BlueprintIdSchema,
  EntityIdSchema,
  FactionIdSchema,
} from '../../src/schemas/primitives.schema.js';
import { mapSimEventToAudioPresets } from '../../src/client/audio/synth-definitions.js';
import { createInitialWorld } from '../../src/sim/core/world.js';
import {
  parseLlmResponseToCommand,
  serializePlayerContext,
} from '../scripts/playtester-serializer.js';

describe('Phase 46: SimEvent Acoustic Triggers & Command Serialization (P2/P3)', () => {
  it('deterministically maps SimEvent variants across Phases 37-45 into acoustic synth presets', () => {
    const actorId = EntityIdSchema.parse('actor_player');
    const targetId = EntityIdSchema.parse('actor_watchman');
    const itemId = EntityIdSchema.parse('item_prosthetic_arm');

    // Steam vent (Phase 37)
    const steamFx = mapSimEventToAudioPresets({
      type: 'STEAM_VENTED',
      actorId,
      turn: 1,
      pressureReleasedKpa: 40,
      origin: { x: 10, y: 10, stratum: 'STREET' },
    });
    expect(steamFx.some((f) => f.id === 'STEAM_VENT')).toBe(true);

    // Explosions / Breaches (Phase 39 / Phase 31)
    const boomFx = mapSimEventToAudioPresets({
      type: 'WALL_BREACHED',
      turn: 2,
      target: { x: 11, y: 10, stratum: 'STREET' },
      breachSource: 'EXPLOSION',
    });
    expect(boomFx.some((f) => f.id === 'EXPLOSION_BOOM')).toBe(true);

    // Prosthetic installation (Phase 37 / P2)
    const prosthFx = mapSimEventToAudioPresets({
      type: 'PROSTHETIC_INSTALLED',
      actorId,
      turn: 3,
      slot: 'LEFT_ARM',
      prostheticEntityId: itemId,
    });
    expect(prosthFx.some((f) => f.id === 'PROSTHETIC_INSTALL')).toBe(true);

    // Weapon mod installation (Phase 40 / P2)
    const modFx = mapSimEventToAudioPresets({
      type: 'WEAPON_MOD_INSTALLED',
      actorId,
      turn: 4,
      weaponEntityId: EntityIdSchema.parse('item_weapon_carbine'),
      modBlueprintId: BlueprintIdSchema.parse('mod_rifled_barrel'),
      remainingModSlots: 1,
    });
    expect(modFx.some((f) => f.id === 'WEAPON_MOD_INSTALL')).toBe(true);

    // Ammo loading (Phase 40 / P2)
    const ammoFx = mapSimEventToAudioPresets({
      type: 'AMMO_LOADED',
      actorId,
      turn: 5,
      weaponEntityId: EntityIdSchema.parse('item_weapon_carbine'),
      ammoBlueprintId: BlueprintIdSchema.parse('item_ammo_flechette'),
      ammoCount: 6,
    });
    expect(ammoFx.some((f) => f.id === 'AMMO_LOAD')).toBe(true);

    // Squad callout (Phase 42)
    const hornFx = mapSimEventToAudioPresets({
      type: 'SQUAD_CALLOUT_EMITTED',
      callerId: actorId,
      turn: 6,
      targetId,
      squadId: 'squad_watch_alpha',
      noiseDb: 90,
      calloutMessage: 'Artificer spotted!',
    });
    expect(hornFx.some((f) => f.id === 'SQUAD_CALLOUT_HORN')).toBe(true);

    // Acid coating / sizzle (Phase 41)
    const acidFx = mapSimEventToAudioPresets({
      type: 'ITEM_COATED',
      actorId,
      turn: 7,
      itemEntityId: itemId,
      liquidType: 'NITRIC_ACID',
      volumeMl: 50,
    });
    expect(acidFx.some((f) => f.id === 'ACID_SIZZLE')).toBe(true);

    // Combat impact: armor vs flesh (Phase 37)
    const armorImpact = mapSimEventToAudioPresets({
      type: 'COMBAT_ATTACK_RESOLVED',
      attackerId: actorId,
      targetId,
      targetSlot: 'CHASSIS_CORE',
      hit: true,
      damageDealt: 15,
      turn: 7,
    });
    expect(armorImpact.some((f) => f.id === 'MELEE_HIT_ARMOR')).toBe(true);

    const fleshImpact = mapSimEventToAudioPresets({
      type: 'COMBAT_ATTACK_RESOLVED',
      attackerId: actorId,
      targetId,
      targetSlot: 'LEFT_ARM',
      hit: true,
      damageDealt: 10,
      turn: 7,
    });
    expect(fleshImpact.some((f) => f.id === 'MELEE_HIT_FLESH')).toBe(true);

    // Freehold Safehouse & Construction (Phase 44)
    const buildFx = mapSimEventToAudioPresets({
      type: 'STRUCTURE_BUILT',
      actorId,
      turn: 8,
      structureEntityId: EntityIdSchema.parse('furniture_bench'),
      structureType: 'ARTIFICER_BENCH',
      position: { x: 12, y: 12, stratum: 'STREET' },
    });
    expect(buildFx.some((f) => f.id === 'STRUCTURE_BUILD')).toBe(true);

    const claimFx = mapSimEventToAudioPresets({
      type: 'WORKSHOP_DEED_CLAIMED',
      actorId,
      turn: 9,
      deedId: 'deed_foundry_1',
      safehouseName: 'Workshop Alpha',
      vaultClaimed: false,
      stratum: 'STREET',
    });
    expect(claimFx.some((f) => f.id === 'SAFEHOUSE_CLAIM')).toBe(true);

    // Turf skirmish alert (Phase 45)
    const turfFx = mapSimEventToAudioPresets({
      type: 'TURF_CONTROL_CHANGED',
      turn: 10,
      turfId: 'turf_soot_dock',
      districtId: 'district_limehouse_docks',
      newFactionId: FactionIdSchema.parse('CLOCKWORK_GUILD'),
      previousFactionId: FactionIdSchema.parse('IRONMONGERS_CARTEL'),
    });
    expect(turfFx.some((f) => f.id === 'TURF_SKIRMISH_ALERT')).toBe(true);
  });

  it('verifies P2/P3 serialization and command parsing for EMIT_SPARK, INSTALL_PROSTHETIC, INSTALL_WEAPON_MOD, LOAD_AMMO', () => {
    const world = createInitialWorld({ seed: 42 });
    const playerId = EntityIdSchema.parse('actor_player');

    // 1. EMIT_SPARK
    const sparkCmd = parseLlmResponseToCommand(
      '{"action": "EMIT_SPARK", "targetRelX": 1, "targetRelY": 0}',
      world,
      playerId,
    );
    expect(sparkCmd.type).toBe('EMIT_SPARK');
    if (sparkCmd.type === 'EMIT_SPARK') {
      expect(sparkCmd.target.x).toBe(world.entities[playerId]!.position!.x + 1);
    }

    // 2. INSTALL_PROSTHETIC
    const prosthCmd = parseLlmResponseToCommand(
      '{"action": "INSTALL_PROSTHETIC", "prostheticId": "item_leg", "slot": "LEFT_LEG"}',
      world,
      playerId,
    );
    expect(prosthCmd.type).toBe('INSTALL_PROSTHETIC');
    if (prosthCmd.type === 'INSTALL_PROSTHETIC') {
      expect(prosthCmd.slot).toBe('LEFT_LEG');
      expect(prosthCmd.prostheticEntityId).toBe('item_leg');
    }

    // 3. INSTALL_WEAPON_MOD
    const modCmd = parseLlmResponseToCommand(
      '{"action": "INSTALL_WEAPON_MOD", "weaponId": "item_gun", "modId": "item_barrel"}',
      world,
      playerId,
    );
    expect(modCmd.type).toBe('INSTALL_WEAPON_MOD');
    if (modCmd.type === 'INSTALL_WEAPON_MOD') {
      expect(modCmd.weaponEntityId).toBe('item_gun');
      expect(modCmd.modEntityId).toBe('item_barrel');
    }

    // 4. LOAD_AMMO
    const ammoCmd = parseLlmResponseToCommand(
      '{"action": "LOAD_AMMO", "weaponId": "item_gun", "ammoId": "item_box_ammo"}',
      world,
      playerId,
    );
    expect(ammoCmd.type).toBe('LOAD_AMMO');
    if (ammoCmd.type === 'LOAD_AMMO') {
      expect(ammoCmd.weaponEntityId).toBe('item_gun');
      expect(ammoCmd.ammoEntityId).toBe('item_box_ammo');
    }

    // Contextual serialization surfaces INSTALL_PROSTHETIC when player has prosthetic in inventory
    const context = serializePlayerContext(world, playerId);
    expect(context).toContain('INSTALL_PROSTHETIC');
  });
});
