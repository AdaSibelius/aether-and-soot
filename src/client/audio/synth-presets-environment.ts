import { StratumId } from '../../schemas/primitives.schema.js';
import {
  AcousticSoundEffect,
  AcousticSoundPresetId,
  StratumAmbientProfile,
} from '../../schemas/audio-synth.schema.js';

export const ENVIRONMENT_PRESETS: Partial<Record<AcousticSoundPresetId, AcousticSoundEffect>> = {
  STEAM_VENT: {
    id: 'STEAM_VENT',
    label: 'High-Pressure Steam Vent',
    totalDurationSec: 0.45,
    masterVolume: 0.8,
    voices: [
      {
        waveform: 'noise',
        noiseType: 'white',
        gain: 0.7,
        envelope: { attackSec: 0.02, decaySec: 0.2, sustainLevel: 0.3, releaseSec: 0.2 },
        pitch: { startFreqHz: 2400, endFreqHz: 800, sweepDurationSec: 0.45, curve: 'exponential' },
        filter: { filterType: 'bandpass', startCutoffHz: 3500, endCutoffHz: 1200, resonanceQ: 2.5, sweepDurationSec: 0.45 },
      },
      {
        waveform: 'triangle',
        gain: 0.3,
        envelope: { attackSec: 0.01, decaySec: 0.15, sustainLevel: 0.1, releaseSec: 0.15 },
        pitch: { startFreqHz: 180, endFreqHz: 90, sweepDurationSec: 0.3, curve: 'exponential' },
      },
    ],
  },
  STEAM_HISS: {
    id: 'STEAM_HISS',
    label: 'Residual Pipe Hiss',
    totalDurationSec: 0.35,
    masterVolume: 0.5,
    voices: [
      {
        waveform: 'noise',
        noiseType: 'pink',
        gain: 0.5,
        envelope: { attackSec: 0.05, decaySec: 0.15, sustainLevel: 0.2, releaseSec: 0.15 },
        pitch: { startFreqHz: 1800, endFreqHz: 1400, sweepDurationSec: 0.35, curve: 'linear' },
        filter: { filterType: 'highpass', startCutoffHz: 2000, endCutoffHz: 1800, resonanceQ: 1.0, sweepDurationSec: 0.35 },
      },
    ],
  },
  SQUAD_CALLOUT_HORN: {
    id: 'SQUAD_CALLOUT_HORN',
    label: 'Watchman Steam Horn',
    totalDurationSec: 0.65,
    masterVolume: 0.85,
    voices: [
      {
        waveform: 'sawtooth',
        gain: 0.7,
        envelope: { attackSec: 0.08, decaySec: 0.2, sustainLevel: 0.6, releaseSec: 0.3 },
        pitch: { startFreqHz: 293.66, endFreqHz: 293.66, sweepDurationSec: 0.65, curve: 'linear' },
        filter: { filterType: 'lowpass', startCutoffHz: 1200, endCutoffHz: 900, resonanceQ: 4.0, sweepDurationSec: 0.65 },
      },
      {
        waveform: 'square',
        gain: 0.3,
        detuneCents: 12,
        envelope: { attackSec: 0.06, decaySec: 0.2, sustainLevel: 0.4, releaseSec: 0.3 },
        pitch: { startFreqHz: 440.0, endFreqHz: 440.0, sweepDurationSec: 0.65, curve: 'linear' },
      },
    ],
  },
  ALARM_KLAXON: {
    id: 'ALARM_KLAXON',
    label: 'Foundry Curfew Klaxon',
    totalDurationSec: 0.55,
    masterVolume: 0.8,
    voices: [
      {
        waveform: 'sawtooth',
        gain: 0.6,
        envelope: { attackSec: 0.04, decaySec: 0.15, sustainLevel: 0.5, releaseSec: 0.25 },
        pitch: { startFreqHz: 350, endFreqHz: 700, sweepDurationSec: 0.5, curve: 'exponential' },
      },
    ],
  },
  FOOTSTEP_COBBLE: {
    id: 'FOOTSTEP_COBBLE',
    label: 'Cobblestone Boot Strike',
    totalDurationSec: 0.12,
    masterVolume: 0.45,
    voices: [
      {
        waveform: 'triangle',
        gain: 0.4,
        envelope: { attackSec: 0.003, decaySec: 0.04, sustainLevel: 0.0, releaseSec: 0.04 },
        pitch: { startFreqHz: 280, endFreqHz: 120, sweepDurationSec: 0.09, curve: 'exponential' },
      },
    ],
  },
  FOOTSTEP_SEWER: {
    id: 'FOOTSTEP_SEWER',
    label: 'Soot Sluice Splash',
    totalDurationSec: 0.18,
    masterVolume: 0.5,
    voices: [
      {
        waveform: 'noise',
        noiseType: 'pink',
        gain: 0.4,
        envelope: { attackSec: 0.01, decaySec: 0.07, sustainLevel: 0.05, releaseSec: 0.06 },
        pitch: { startFreqHz: 900, endFreqHz: 400, sweepDurationSec: 0.15, curve: 'linear' },
      },
    ],
  },
  FOOTSTEP_VENT: {
    id: 'FOOTSTEP_VENT',
    label: 'Catwalk Iron Grate Step',
    totalDurationSec: 0.15,
    masterVolume: 0.5,
    voices: [
      {
        waveform: 'square',
        gain: 0.35,
        envelope: { attackSec: 0.004, decaySec: 0.05, sustainLevel: 0.05, releaseSec: 0.06 },
        pitch: { startFreqHz: 750, endFreqHz: 480, sweepDurationSec: 0.12, curve: 'exponential' },
      },
    ],
  },
  TURF_SKIRMISH_ALERT: {
    id: 'TURF_SKIRMISH_ALERT',
    label: 'Contested Turf Rattle',
    totalDurationSec: 0.5,
    masterVolume: 0.8,
    voices: [
      {
        waveform: 'square',
        gain: 0.5,
        envelope: { attackSec: 0.02, decaySec: 0.15, sustainLevel: 0.3, releaseSec: 0.25 },
        pitch: { startFreqHz: 493.88, endFreqHz: 466.16, sweepDurationSec: 0.45, curve: 'linear' },
      },
    ],
  },
};

export const STRATUM_AMBIENCE_PROFILES: Record<StratumId, StratumAmbientProfile> = {
  STREET: {
    stratum: 'STREET',
    rootFreqHz: 65.41,
    harmonicRatios: [1.0, 1.5, 2.0],
    filterCutoffHz: 280,
    noiseRumbleGain: 0.08,
    droneGain: 0.12,
  },
  UNDERCROFT: {
    stratum: 'UNDERCROFT',
    rootFreqHz: 43.65,
    harmonicRatios: [1.0, 1.33, 2.0],
    filterCutoffHz: 160,
    noiseRumbleGain: 0.14,
    droneGain: 0.16,
  },
  SPIRE: {
    stratum: 'SPIRE',
    rootFreqHz: 110.0,
    harmonicRatios: [1.0, 2.0, 3.0],
    filterCutoffHz: 650,
    noiseRumbleGain: 0.05,
    droneGain: 0.09,
  },
  CATACOMBS: {
    stratum: 'CATACOMBS',
    rootFreqHz: 32.7,
    harmonicRatios: [1.0, 1.25, 1.5],
    filterCutoffHz: 120,
    noiseRumbleGain: 0.18,
    droneGain: 0.15,
  },
};
