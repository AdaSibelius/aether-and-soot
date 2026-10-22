import {
  AcousticSoundEffect,
  AcousticSoundPresetId,
} from '../../schemas/audio-synth.schema.js';

export const MECHANICAL_PRESETS: Partial<Record<AcousticSoundPresetId, AcousticSoundEffect>> = {
  SPARK_CRACKLE: {
    id: 'SPARK_CRACKLE',
    label: 'Aetheric Spark Snap',
    totalDurationSec: 0.15,
    masterVolume: 0.75,
    voices: [
      {
        waveform: 'sawtooth',
        gain: 0.6,
        detuneCents: 15,
        envelope: { attackSec: 0.005, decaySec: 0.06, sustainLevel: 0.05, releaseSec: 0.08 },
        pitch: { startFreqHz: 3200, endFreqHz: 440, sweepDurationSec: 0.12, curve: 'exponential' },
      },
      {
        waveform: 'noise',
        noiseType: 'white',
        gain: 0.4,
        envelope: { attackSec: 0.002, decaySec: 0.04, sustainLevel: 0.0, releaseSec: 0.04 },
        pitch: { startFreqHz: 5000, endFreqHz: 2000, sweepDurationSec: 0.08, curve: 'exponential' },
      },
    ],
  },
  PROSTHETIC_INSTALL: {
    id: 'PROSTHETIC_INSTALL',
    label: 'Clockwork Graft Latch',
    totalDurationSec: 0.38,
    masterVolume: 0.75,
    voices: [
      {
        waveform: 'square',
        gain: 0.5,
        envelope: { attackSec: 0.01, decaySec: 0.1, sustainLevel: 0.2, releaseSec: 0.15 },
        pitch: { startFreqHz: 520, endFreqHz: 780, sweepDurationSec: 0.2, curve: 'exponential' },
      },
      {
        waveform: 'sine',
        gain: 0.4,
        envelope: { attackSec: 0.02, decaySec: 0.12, sustainLevel: 0.1, releaseSec: 0.2 },
        pitch: { startFreqHz: 220, endFreqHz: 330, sweepDurationSec: 0.35, curve: 'linear' },
      },
    ],
  },
  WEAPON_MOD_INSTALL: {
    id: 'WEAPON_MOD_INSTALL',
    label: 'Machined Bayonet Clamp',
    totalDurationSec: 0.28,
    masterVolume: 0.7,
    voices: [
      {
        waveform: 'triangle',
        gain: 0.6,
        envelope: { attackSec: 0.008, decaySec: 0.08, sustainLevel: 0.15, releaseSec: 0.12 },
        pitch: { startFreqHz: 660, endFreqHz: 880, sweepDurationSec: 0.25, curve: 'exponential' },
      },
    ],
  },
  AMMO_LOAD: {
    id: 'AMMO_LOAD',
    label: 'Breech Chamber Click',
    totalDurationSec: 0.2,
    masterVolume: 0.65,
    voices: [
      {
        waveform: 'square',
        gain: 0.5,
        envelope: { attackSec: 0.005, decaySec: 0.05, sustainLevel: 0.0, releaseSec: 0.05 },
        pitch: { startFreqHz: 980, endFreqHz: 440, sweepDurationSec: 0.1, curve: 'exponential' },
      },
    ],
  },
  STRUCTURE_BUILD: {
    id: 'STRUCTURE_BUILD',
    label: 'Artificer Pneumatic Hammer',
    totalDurationSec: 0.35,
    masterVolume: 0.7,
    voices: [
      {
        waveform: 'square',
        gain: 0.5,
        envelope: { attackSec: 0.01, decaySec: 0.1, sustainLevel: 0.2, releaseSec: 0.15 },
        pitch: { startFreqHz: 340, endFreqHz: 170, sweepDurationSec: 0.3, curve: 'exponential' },
      },
    ],
  },
  DOOR_CREAK: {
    id: 'DOOR_CREAK',
    label: 'Iron Hasp & Timber Swing',
    totalDurationSec: 0.32,
    masterVolume: 0.6,
    voices: [
      {
        waveform: 'sawtooth',
        gain: 0.45,
        envelope: { attackSec: 0.03, decaySec: 0.15, sustainLevel: 0.2, releaseSec: 0.12 },
        pitch: { startFreqHz: 180, endFreqHz: 240, sweepDurationSec: 0.3, curve: 'linear' },
      },
    ],
  },
  SAFEHOUSE_CLAIM: {
    id: 'SAFEHOUSE_CLAIM',
    label: 'Freehold Brass Bell Chime',
    totalDurationSec: 0.6,
    masterVolume: 0.75,
    voices: [
      {
        waveform: 'sine',
        gain: 0.6,
        envelope: { attackSec: 0.01, decaySec: 0.25, sustainLevel: 0.3, releaseSec: 0.3 },
        pitch: { startFreqHz: 659.25, endFreqHz: 659.25, sweepDurationSec: 0.6, curve: 'linear' },
      },
      {
        waveform: 'sine',
        gain: 0.4,
        detuneCents: 8,
        envelope: { attackSec: 0.02, decaySec: 0.25, sustainLevel: 0.2, releaseSec: 0.3 },
        pitch: { startFreqHz: 987.77, endFreqHz: 987.77, sweepDurationSec: 0.6, curve: 'linear' },
      },
    ],
  },
};
