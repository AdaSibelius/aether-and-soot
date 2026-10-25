import { EntityRecord } from '../../schemas/components.schema.js';
import { SeededRNG } from '../core/rng.js';

export interface PhysiologicalPenaltyResult {
  readonly accuracyPenaltyPct: number;
  readonly apPenalty: number;
  readonly damagePenalty: number;
}

export const PAIN_SHOCK_ACCURACY_THRESHOLD = 30;
export const PAIN_SHOCK_AP_THRESHOLD = 50;
export const PAIN_SHOCK_AP_PENALTY = 25;
export const STAMINA_DEPLETED_AP_PENALTY = 15;
export const STAMINA_DEPLETED_ACCURACY_PENALTY = 10;

/**
 * Computes combat accuracy, damage, and action point penalties caused by
 * elevated metabolic painShock and depleted stamina reserves.
 */
export function computePainShockPenalty(
  actor: EntityRecord,
  _rng?: SeededRNG,
): PhysiologicalPenaltyResult {
  const anatomy = actor.anatomy;
  if (!anatomy) {
    return { accuracyPenaltyPct: 0, apPenalty: 0, damagePenalty: 0 };
  }

  let accuracyPenaltyPct = 0;
  let apPenalty = 0;
  let damagePenalty = 0;

  if (anatomy.painShock > PAIN_SHOCK_ACCURACY_THRESHOLD) {
    accuracyPenaltyPct += Math.floor(anatomy.painShock * 0.25);
  }
  if (anatomy.painShock > PAIN_SHOCK_AP_THRESHOLD) {
    apPenalty += PAIN_SHOCK_AP_PENALTY;
  }
  if (anatomy.painShock >= 60) {
    damagePenalty += 2;
  }

  if (anatomy.stamina <= 0) {
    apPenalty += STAMINA_DEPLETED_AP_PENALTY;
    accuracyPenaltyPct += STAMINA_DEPLETED_ACCURACY_PENALTY;
  }

  return {
    accuracyPenaltyPct,
    apPenalty,
    damagePenalty,
  };
}

/**
 * Deducts physical stamina exertion cost from an actor's anatomy record,
 * clamping stamina to [0, 100].
 */
export function applyStaminaExertion(
  actor: EntityRecord,
  cost: number,
): EntityRecord {
  if (!actor.anatomy || cost <= 0) {
    return actor;
  }

  const nextStamina = Math.max(0, Math.min(100, actor.anatomy.stamina - cost));
  if (nextStamina === actor.anatomy.stamina) {
    return actor;
  }

  return {
    ...actor,
    anatomy: {
      ...actor.anatomy,
      stamina: nextStamina,
    },
  };
}
