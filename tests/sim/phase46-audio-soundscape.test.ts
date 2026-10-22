import { describe, expect, it } from 'vitest';
import { EntityIdSchema } from '../../src/schemas/primitives.schema.js';
import {
  AcousticSoundEffectSchema,
  StratumAmbientProfileSchema,
} from '../../src/schemas/audio-synth.schema.js';
import {
  ACOUSTIC_SOUND_PRESETS,
  STRATUM_AMBIENCE_PROFILES,
} from '../../src/client/audio/synth-definitions.js';
import { SoundscapeManager } from '../../src/client/audio/soundscape-manager.js';

describe('Phase 46: Procedural WebAudio Soundscape & Acoustic Synth Shell', () => {
  it('validates all acoustic sound presets adhere strictly to AcousticSoundEffectSchema', () => {
    const presetKeys = Object.keys(ACOUSTIC_SOUND_PRESETS);
    expect(presetKeys.length).toBeGreaterThanOrEqual(15);

    for (const [id, preset] of Object.entries(ACOUSTIC_SOUND_PRESETS)) {
      expect(preset.id).toBe(id);
      expect(() => AcousticSoundEffectSchema.parse(preset)).not.toThrow();
      expect(preset.voices.length).toBeGreaterThanOrEqual(1);
      expect(preset.totalDurationSec).toBeGreaterThan(0);
      expect(preset.masterVolume).toBeGreaterThan(0);
      for (const voice of preset.voices) {
        expect(['sine', 'square', 'sawtooth', 'triangle', 'noise']).toContain(voice.waveform);
        expect(voice.envelope.attackSec).toBeGreaterThanOrEqual(0);
        expect(voice.envelope.decaySec).toBeGreaterThanOrEqual(0);
        expect(voice.envelope.sustainLevel).toBeGreaterThanOrEqual(0);
        expect(voice.envelope.sustainLevel).toBeLessThanOrEqual(1);
        expect(voice.envelope.releaseSec).toBeGreaterThanOrEqual(0);
        expect(voice.pitch.startFreqHz).toBeGreaterThan(0);
        expect(voice.pitch.endFreqHz).toBeGreaterThan(0);
      }
    }
  });

  it('validates all stratum ambient profiles adhere strictly to StratumAmbientProfileSchema', () => {
    const strata = ['STREET', 'UNDERCROFT', 'SPIRE', 'CATACOMBS'] as const;
    for (const s of strata) {
      const profile = STRATUM_AMBIENCE_PROFILES[s];
      expect(profile).toBeDefined();
      expect(() => StratumAmbientProfileSchema.parse(profile)).not.toThrow();
      expect(profile.harmonicRatios.length).toBeGreaterThanOrEqual(2);
      expect(profile.rootFreqHz).toBeGreaterThan(0);
      expect(profile.filterCutoffHz).toBeGreaterThan(0);
    }
  });

  it('runs SoundscapeManager safely in headless mode with mute toggles and batch events', () => {
    const manager = new SoundscapeManager();
    expect(manager.isMuted()).toBe(false);
    expect(manager.toggleMute()).toBe(true);
    expect(manager.isMuted()).toBe(true);
    expect(manager.toggleMute()).toBe(false);

    expect(() => manager.updateStratum('UNDERCROFT')).not.toThrow();
    expect(() =>
      manager.processSimEvents([
        {
          type: 'STRATUM_CHANGED',
          actorId: EntityIdSchema.parse('actor_player'),
          turn: 1,
          fromStratum: 'STREET',
          toStratum: 'UNDERCROFT',
          portalEntityId: EntityIdSchema.parse('portal_manhole_down'),
          destination: { x: 24, y: 18, stratum: 'UNDERCROFT' },
        },
        {
          type: 'DOOR_TOGGLED',
          actorId: EntityIdSchema.parse('actor_player'),
          turn: 2,
          at: { x: 24, y: 19, stratum: 'UNDERCROFT' },
          newState: 'OPEN',
        },
      ]),
    ).not.toThrow();
  });
});
