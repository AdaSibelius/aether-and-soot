import { z } from 'zod';
import { StratumIdSchema } from './primitives.schema.js';

export const OscillatorWaveformSchema = z.enum([
  'sine',
  'square',
  'sawtooth',
  'triangle',
  'noise',
]);
export type OscillatorWaveform = z.infer<typeof OscillatorWaveformSchema>;

export const FilterTypeSchema = z.enum([
  'lowpass',
  'highpass',
  'bandpass',
  'notch',
  'allpass',
]);
export type FilterType = z.infer<typeof FilterTypeSchema>;

export const EnvelopeParamsSchema = z.object({
  attackSec: z.number().nonnegative(),
  decaySec: z.number().nonnegative(),
  sustainLevel: z.number().min(0).max(1),
  releaseSec: z.number().nonnegative(),
});
export type EnvelopeParams = z.infer<typeof EnvelopeParamsSchema>;

export const PitchEnvelopeSchema = z.object({
  startFreqHz: z.number().positive(),
  endFreqHz: z.number().positive(),
  sweepDurationSec: z.number().positive(),
  curve: z.enum(['linear', 'exponential']).default('exponential'),
});
export type PitchEnvelope = z.infer<typeof PitchEnvelopeSchema>;

export const FilterEnvelopeSchema = z.object({
  filterType: FilterTypeSchema,
  startCutoffHz: z.number().positive(),
  endCutoffHz: z.number().positive(),
  resonanceQ: z.number().nonnegative().default(1),
  sweepDurationSec: z.number().positive(),
});
export type FilterEnvelope = z.infer<typeof FilterEnvelopeSchema>;

export const SynthVoiceSpecSchema = z.object({
  waveform: OscillatorWaveformSchema,
  envelope: EnvelopeParamsSchema,
  pitch: PitchEnvelopeSchema,
  filter: FilterEnvelopeSchema.optional(),
  gain: z.number().min(0).max(1).default(0.5),
  detuneCents: z.number().optional(),
  noiseType: z.enum(['white', 'pink', 'brown']).optional(),
});
export type SynthVoiceSpec = z.infer<typeof SynthVoiceSpecSchema>;

export const AcousticSoundPresetIdSchema = z.enum([
  'STEAM_VENT',
  'STEAM_HISS',
  'SPARK_CRACKLE',
  'PROSTHETIC_INSTALL',
  'WEAPON_MOD_INSTALL',
  'AMMO_LOAD',
  'SQUAD_CALLOUT_HORN',
  'ALARM_KLAXON',
  'WEAPON_FIRE_BALLISTIC',
  'WEAPON_FIRE_PNEUMATIC',
  'MELEE_HIT_FLESH',
  'MELEE_HIT_ARMOR',
  'EXPLOSION_BOOM',
  'ACID_SIZZLE',
  'FOOTSTEP_COBBLE',
  'FOOTSTEP_SEWER',
  'FOOTSTEP_VENT',
  'DOOR_CREAK',
  'STRUCTURE_BUILD',
  'SAFEHOUSE_CLAIM',
  'TURF_SKIRMISH_ALERT',
]);
export type AcousticSoundPresetId = z.infer<typeof AcousticSoundPresetIdSchema>;

export const AcousticSoundEffectSchema = z.object({
  id: AcousticSoundPresetIdSchema,
  label: z.string(),
  voices: z.array(SynthVoiceSpecSchema).min(1),
  totalDurationSec: z.number().positive(),
  masterVolume: z.number().min(0).max(1).default(0.7),
});
export type AcousticSoundEffect = z.infer<typeof AcousticSoundEffectSchema>;

export const StratumAmbientProfileSchema = z.object({
  stratum: StratumIdSchema,
  rootFreqHz: z.number().positive(),
  harmonicRatios: z.array(z.number().positive()),
  filterCutoffHz: z.number().positive(),
  noiseRumbleGain: z.number().min(0).max(1),
  droneGain: z.number().min(0).max(1),
});
export type StratumAmbientProfile = z.infer<typeof StratumAmbientProfileSchema>;
