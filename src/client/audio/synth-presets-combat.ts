import {
  AcousticSoundEffect,
  AcousticSoundPresetId,
} from '../../schemas/audio-synth.schema.js';

export const COMBAT_PRESETS: Partial<Record<AcousticSoundPresetId, AcousticSoundEffect>> = {
  WEAPON_FIRE_BALLISTIC: {
    id: 'WEAPON_FIRE_BALLISTIC',
    label: 'Blackpowder Harpoon Discharge',
    totalDurationSec: 0.4,
    masterVolume: 0.85,
    voices: [
      {
        waveform: 'noise',
        noiseType: 'white',
        gain: 0.8,
        envelope: { attackSec: 0.004, decaySec: 0.12, sustainLevel: 0.1, releaseSec: 0.2 },
        pitch: { startFreqHz: 1200, endFreqHz: 300, sweepDurationSec: 0.35, curve: 'exponential' },
        filter: { filterType: 'lowpass', startCutoffHz: 2500, endCutoffHz: 600, resonanceQ: 2.0, sweepDurationSec: 0.35 },
      },
      {
        waveform: 'sine',
        gain: 0.5,
        envelope: { attackSec: 0.005, decaySec: 0.18, sustainLevel: 0.0, releaseSec: 0.18 },
        pitch: { startFreqHz: 160, endFreqHz: 45, sweepDurationSec: 0.35, curve: 'exponential' },
      },
    ],
  },
  WEAPON_FIRE_PNEUMATIC: {
    id: 'WEAPON_FIRE_PNEUMATIC',
    label: 'Pneumatic Needle Plink',
    totalDurationSec: 0.25,
    masterVolume: 0.7,
    voices: [
      {
        waveform: 'triangle',
        gain: 0.6,
        envelope: { attackSec: 0.006, decaySec: 0.08, sustainLevel: 0.1, releaseSec: 0.1 },
        pitch: { startFreqHz: 1100, endFreqHz: 220, sweepDurationSec: 0.2, curve: 'exponential' },
      },
    ],
  },
  MELEE_HIT_FLESH: {
    id: 'MELEE_HIT_FLESH',
    label: 'Cudgel Impact Flesh',
    totalDurationSec: 0.22,
    masterVolume: 0.7,
    voices: [
      {
        waveform: 'triangle',
        gain: 0.6,
        envelope: { attackSec: 0.008, decaySec: 0.09, sustainLevel: 0.0, releaseSec: 0.09 },
        pitch: { startFreqHz: 140, endFreqHz: 55, sweepDurationSec: 0.18, curve: 'exponential' },
      },
    ],
  },
  MELEE_HIT_ARMOR: {
    id: 'MELEE_HIT_ARMOR',
    label: 'Brass Breastplate Deflection',
    totalDurationSec: 0.3,
    masterVolume: 0.75,
    voices: [
      {
        waveform: 'square',
        gain: 0.5,
        envelope: { attackSec: 0.005, decaySec: 0.08, sustainLevel: 0.1, releaseSec: 0.15 },
        pitch: { startFreqHz: 1250, endFreqHz: 820, sweepDurationSec: 0.25, curve: 'exponential' },
      },
      {
        waveform: 'sawtooth',
        gain: 0.3,
        envelope: { attackSec: 0.005, decaySec: 0.06, sustainLevel: 0.05, releaseSec: 0.1 },
        pitch: { startFreqHz: 1800, endFreqHz: 1200, sweepDurationSec: 0.2, curve: 'linear' },
      },
    ],
  },
  EXPLOSION_BOOM: {
    id: 'EXPLOSION_BOOM',
    label: 'Concussive Detonation',
    totalDurationSec: 0.75,
    masterVolume: 0.9,
    voices: [
      {
        waveform: 'noise',
        noiseType: 'brown',
        gain: 0.8,
        envelope: { attackSec: 0.01, decaySec: 0.35, sustainLevel: 0.2, releaseSec: 0.35 },
        pitch: { startFreqHz: 400, endFreqHz: 80, sweepDurationSec: 0.7, curve: 'exponential' },
        filter: { filterType: 'lowpass', startCutoffHz: 800, endCutoffHz: 150, resonanceQ: 3.0, sweepDurationSec: 0.7 },
      },
      {
        waveform: 'sine',
        gain: 0.7,
        envelope: { attackSec: 0.008, decaySec: 0.4, sustainLevel: 0.1, releaseSec: 0.3 },
        pitch: { startFreqHz: 95, endFreqHz: 30, sweepDurationSec: 0.7, curve: 'exponential' },
      },
    ],
  },
  ACID_SIZZLE: {
    id: 'ACID_SIZZLE',
    label: 'Vitriol Acid Reaction',
    totalDurationSec: 0.42,
    masterVolume: 0.65,
    voices: [
      {
        waveform: 'noise',
        noiseType: 'pink',
        gain: 0.6,
        envelope: { attackSec: 0.04, decaySec: 0.16, sustainLevel: 0.3, releaseSec: 0.18 },
        pitch: { startFreqHz: 3600, endFreqHz: 2800, sweepDurationSec: 0.4, curve: 'linear' },
        filter: { filterType: 'bandpass', startCutoffHz: 3200, endCutoffHz: 2400, resonanceQ: 4.5, sweepDurationSec: 0.4 },
      },
    ],
  },
};
