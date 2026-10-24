import { describe, expect, it } from 'vitest';
import {
  BlueprintIdSchema,
  EntityIdSchema,
  FactionIdSchema,
  LimbSlotIdSchema,
} from '../../src/schemas/primitives.schema.js';
import { createInitialWorld } from '../../src/sim/core/world.js';
import { dispatchCommand } from '../../src/sim/core/engine.js';
import { mapSimEventToAudioPresets } from '../../src/client/audio/synth-definitions.js';
import { projectWorldToVisualFrame } from '../../src/client/projection/frame-adapter.js';

describe('Deterministic Audio Synth Preset Triggers Test (synth-definitions.ts)', () => {
  const playerId = EntityIdSchema.parse('actor_player');

  it('triggers STEAM_VENT preset when VENT_STEAM command emits STEAM_VENTED event', () => {
    // Given (Seeded World)
    let world = createInitialWorld({ seed: 42 });
    const player = world.entities[playerId]!;
    const pos = player.position!;
    world = {
      ...world,
      entities: {
        ...world.entities,
        [playerId]: {
          ...player,
          anatomy: {
            ...player.anatomy!,
            steamReserveKpa: 80,
            maxSteamReserveKpa: 100,
          },
        },
      },
    };

    // When (Command Dispatched via command-router.ts)
    const result = dispatchCommand(world, {
      type: 'VENT_STEAM',
      actorId: playerId,
      target: { x: pos.x, y: pos.y, stratum: pos.stratum },
      pressureReleasedKpa: 30,
    });

    // Then (ECS Component Delta + Domain Event Emitted + Frame Projection Verified)
    // 1. ECS Component Delta: Steam reserve depleted
    const nextPlayer = result.state.entities[playerId]!;
    expect(nextPlayer.anatomy?.steamReserveKpa).toBe(50);

    // 2. Domain Event Emitted
    const ventEv = result.events.find((e) => e.type === 'STEAM_VENTED');
    expect(ventEv).toBeDefined();

    // 3. Audio Synth Preset Trigger Verified
    const audioPresets = mapSimEventToAudioPresets(ventEv!);
    expect(audioPresets.length).toBeGreaterThan(0);
    const steamFx = audioPresets.find((p) => p.id === 'STEAM_VENT');
    expect(steamFx).toBeDefined();
    expect(steamFx?.voices[0]?.waveform).toBe('noise');
    expect(steamFx?.totalDurationSec).toBeGreaterThan(0);

    // 4. Frame Projection Verified
    const frame = projectWorldToVisualFrame(result.state, playerId);
    expect(frame.activeStratum).toBe(pos.stratum);
  });

  it('triggers PROSTHETIC_INSTALL preset when INSTALL_PROSTHETIC command completes', () => {
    // Given (Seeded World)
    let world = createInitialWorld({ seed: 88 });
    const player = world.entities[playerId]!;
    const prostheticId = EntityIdSchema.parse('item_test_strider_leg');

    world = {
      ...world,
      entities: {
        ...world.entities,
        [prostheticId]: {
          id: prostheticId,
          name: 'Pneumatic Strider Leg Mk.I',
          visual: { glyph: 'L', fgPrimary: '#D4AF37', fgSecondary: '#8B4513', bgColor: '#0A0D0E', shaderFlags: [] },
          prostheticSpec: {
            blueprintId: BlueprintIdSchema.parse('prosthetic_pneumatic_leg_mk1'),
            targetLimbSlot: 'LEFT_LEG',
            socketType: 'ACTUATOR',
            massGrams: 4200,
            volumeMl: 3100,
            steamConsumptionPerTurn: 2,
            moveApModifier: -15,
            fovRadiusBonus: 0,
            pressureRatingKpa: 320,
            noiseDb: 25,
          },
        },
        [playerId]: {
          ...player,
          inventory: {
            containedEntityIds: [prostheticId],
            equippedSlots: {},
            maxMassGrams: 20000,
            maxVolumeMl: 10000,
            currentMassGrams: 4200,
          },
        },
      },
    };

    // When (Command Dispatched via command-router.ts)
    const result = dispatchCommand(world, {
      type: 'INSTALL_PROSTHETIC',
      actorId: playerId,
      prostheticEntityId: prostheticId,
      slot: LimbSlotIdSchema.parse('LEFT_LEG'),
    });

    // Then (ECS Component Delta + Domain Event Emitted + Frame Projection Verified)
    // 1. ECS Component Delta: Prosthetic installed on LEFT_LEG
    const nextPlayer = result.state.entities[playerId]!;
    expect(nextPlayer.anatomy?.limbs['LEFT_LEG']?.installedProstheticEntityId).toBe(prostheticId);

    // 2. Domain Event Emitted
    const installEv = result.events.find((e) => e.type === 'PROSTHETIC_INSTALLED');
    expect(installEv).toBeDefined();

    // 3. Audio Synth Preset Trigger Verified
    const audioPresets = mapSimEventToAudioPresets(installEv!);
    expect(audioPresets.length).toBeGreaterThan(0);
    const installFx = audioPresets.find((p) => p.id === 'PROSTHETIC_INSTALL');
    expect(installFx).toBeDefined();
    expect(installFx?.voices.some((v) => v.waveform === 'square')).toBe(true);

    // 4. Frame Projection Verified
    const frame = projectWorldToVisualFrame(result.state, playerId);
    expect(frame.activeStratum).toBeDefined();
  });

  it('maps combat, alarm, and explosive events to distinct synth presets', () => {
    // 1. Ruptured vessel -> EXPLOSION_BOOM
    const boomPresets = mapSimEventToAudioPresets({
      type: 'VESSEL_RUPTURED',
      turn: 1,
      vesselEntityId: playerId,
      origin: { x: 5, y: 5, stratum: 'STREET' },
      releasedPressureKpa: 350,
    });
    expect(boomPresets.some((p) => p.id === 'EXPLOSION_BOOM')).toBe(true);

    // 2. Squad witness callout -> SQUAD_CALLOUT_HORN
    const squadPresets = mapSimEventToAudioPresets({
      type: 'SQUAD_CALLOUT_EMITTED',
      turn: 1,
      callerId: playerId,
      targetId: playerId,
      squadId: 'squad_watch_patrol',
      noiseDb: 75,
      calloutMessage: 'REINFORCEMENTS_REQUESTED',
    });
    expect(squadPresets.some((p) => p.id === 'SQUAD_CALLOUT_HORN')).toBe(true);

    // 3. Turf contested -> ALARM_KLAXON
    const klaxonPresets = mapSimEventToAudioPresets({
      type: 'TURF_CONTESTED',
      turn: 1,
      districtId: 'whitechapel_ward',
      turfId: 'dock_loading_bay',
      contestingFactionId: FactionIdSchema.parse('UNDERCROFT_SYNDICATE'),
      position: { x: 10, y: 10, stratum: 'STREET' },
    });
    expect(klaxonPresets.some((p) => p.id === 'ALARM_KLAXON')).toBe(true);

    // 4. Coal dust ignited -> SPARK_CRACKLE
    const sparkPresets = mapSimEventToAudioPresets({
      type: 'COAL_DUST_IGNITED',
      turn: 1,
      epicenter: { x: 5, y: 5, stratum: 'STREET' },
      ignitedTileCount: 3,
    });
    expect(sparkPresets.some((p) => p.id === 'SPARK_CRACKLE')).toBe(true);
  });
});
