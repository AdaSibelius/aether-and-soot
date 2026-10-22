import { SimEvent } from '../../schemas/events.schema.js';
import {
  AcousticSoundEffect,
  AcousticSoundPresetId,
} from '../../schemas/audio-synth.schema.js';
import { MECHANICAL_PRESETS } from './synth-presets-mechanical.js';
import { COMBAT_PRESETS } from './synth-presets-combat.js';
import {
  ENVIRONMENT_PRESETS,
  STRATUM_AMBIENCE_PROFILES,
} from './synth-presets-environment.js';

export { STRATUM_AMBIENCE_PROFILES };

export const ACOUSTIC_SOUND_PRESETS: Record<AcousticSoundPresetId, AcousticSoundEffect> = {
  ...ENVIRONMENT_PRESETS,
  ...MECHANICAL_PRESETS,
  ...COMBAT_PRESETS,
} as Record<AcousticSoundPresetId, AcousticSoundEffect>;

export function mapSimEventToAudioPresets(event: SimEvent): AcousticSoundEffect[] {
  const effects: AcousticSoundEffect[] = [];
  const add = (id: AcousticSoundPresetId): void => {
    const fx = ACOUSTIC_SOUND_PRESETS[id];
    if (fx) effects.push(fx);
  };

  switch (event.type) {
    case 'STEAM_VENTED':
      add('STEAM_VENT');
      break;
    case 'COAL_DUST_IGNITED':
    case 'LIQUID_IGNITED':
      add('SPARK_CRACKLE');
      break;
    case 'VESSEL_RUPTURED':
    case 'WALL_BREACHED':
    case 'TERRAIN_SMASHED':
      add('EXPLOSION_BOOM');
      break;
    case 'PROSTHETIC_INSTALLED':
      add('PROSTHETIC_INSTALL');
      break;
    case 'WEAPON_MOD_INSTALLED':
      add('WEAPON_MOD_INSTALL');
      break;
    case 'AMMO_LOADED':
      add('AMMO_LOAD');
      break;
    case 'SQUAD_CALLOUT_EMITTED':
      add('SQUAD_CALLOUT_HORN');
      break;
    case 'WITNESS_CRIME_REPORTED':
    case 'TURF_CONTESTED':
      add('ALARM_KLAXON');
      break;
    case 'TURF_CONTROL_CHANGED':
      add('TURF_SKIRMISH_ALERT');
      break;
    case 'COMBAT_ATTACK_RESOLVED':
      if (event.damageDealt > 0) {
        add(event.targetSlot === 'CHASSIS_CORE' ? 'MELEE_HIT_ARMOR' : 'MELEE_HIT_FLESH');
      }
      break;
    case 'ITEM_COATED':
    case 'ACID_CORROSION_TICK':
      add('ACID_SIZZLE');
      break;
    case 'DOOR_TOGGLED':
      add('DOOR_CREAK');
      break;
    case 'STRUCTURE_BUILT':
      add('STRUCTURE_BUILD');
      break;
    case 'WORKSHOP_DEED_CLAIMED':
      add('SAFEHOUSE_CLAIM');
      break;
    case 'SOUND_EMITTED':
      if (event.decibels >= 85) add('ALARM_KLAXON');
      else if (event.decibels >= 45) add('STEAM_HISS');
      break;
    default:
      break;
  }

  return effects;
}
