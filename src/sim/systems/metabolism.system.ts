import { AnatomyComponent, EntityRecord } from '../../schemas/components.schema.js';
import { SimEvent } from '../../schemas/events.schema.js';
import { BlueprintId, EntityId, ItemUseEffect, LimbSlotId } from '../../schemas/primitives.schema.js';
import { WorldState } from '../core/world.js';

export const TOXICITY_OVERDOSE_THRESHOLD = 80;
export const TOXICITY_DECAY_PER_TURN = 1;
export const STAMINA_RECOVERY_PER_TURN = 2;
export const PAIN_SHOCK_DECAY_PER_TURN = 1;
export const OVERDOSE_BLOOD_LOSS = 3;
export const OVERDOSE_DAMAGE = 4;
export const WITHDRAWAL_AP_PENALTY = 25;

function isStimulantEffect(effectId: string): boolean {
  const lower = effectId.toLowerCase();
  return lower.includes('stim') || lower.includes('haste') || lower.includes('rush');
}

function applyLimbOverdoseDamage(limbs: AnatomyComponent['limbs']): AnatomyComponent['limbs'] {
  const torso = limbs['TORSO'];
  if (torso && !torso.amputated && torso.hp > 0) {
    return { ...limbs, TORSO: { ...torso, hp: Math.max(0, torso.hp - OVERDOSE_DAMAGE) } };
  }
  const activeSlot = (Object.keys(limbs) as LimbSlotId[]).find((s) => {
    const l = limbs[s];
    return l && !l.amputated && l.hp > 0;
  });
  if (!activeSlot) return limbs;
  const current = limbs[activeSlot];
  if (!current) return limbs;
  return { ...limbs, [activeSlot]: { ...current, hp: Math.max(0, current.hp - OVERDOSE_DAMAGE) } };
}

/**
 * Evaluates metabolic decay, active effect expiration, withdrawal onset,
 * and toxicity overdose consequences across all living entities with anatomy.
 */
export function advanceMetabolismTick(state: WorldState): {
  state: WorldState;
  events: SimEvent[];
} {
  const nextTurn = state.turnCount + 1;
  const events: SimEvent[] = [];
  const updatedEntities: Record<string, EntityRecord> = { ...state.entities };

  for (const entityId of Object.keys(state.entities)) {
    const entity = state.entities[entityId];
    if (!entity || !entity.anatomy) continue;

    const anatomy = entity.anatomy;
    let nextToxicity = Math.max(0, anatomy.toxicityPct - TOXICITY_DECAY_PER_TURN);
    let nextStamina = Math.min(100, anatomy.stamina + STAMINA_RECOVERY_PER_TURN);
    let nextPainShock = Math.max(0, anatomy.painShock - PAIN_SHOCK_DECAY_PER_TURN);
    let nextBlood = anatomy.bloodVolumePct;
    let nextLimbs = anatomy.limbs;
    let actorEnergy = entity.actor?.energy ?? 0;

    const remainingEffects: typeof anatomy.activeEffects = [];
    for (const eff of anatomy.activeEffects) {
      const remainingTurns = eff.durationTurns - 1;
      if (remainingTurns <= 0) {
        if (isStimulantEffect(eff.effectId)) {
          events.push({
            type: 'WITHDRAWAL_ONSET',
            turn: nextTurn,
            actorId: entity.id,
            effectId: eff.effectId,
            penaltyAp: WITHDRAWAL_AP_PENALTY,
          });
          actorEnergy -= WITHDRAWAL_AP_PENALTY;
          nextPainShock = Math.min(100, nextPainShock + 15);
        }
      } else {
        remainingEffects.push({ ...eff, durationTurns: remainingTurns });
      }
    }

    if (anatomy.toxicityPct >= TOXICITY_OVERDOSE_THRESHOLD) {
      events.push({
        type: 'TOXICITY_OVERDOSE',
        turn: nextTurn,
        actorId: entity.id,
        toxicityPct: anatomy.toxicityPct,
        bloodVolumeLost: OVERDOSE_BLOOD_LOSS,
        damageInflicted: OVERDOSE_DAMAGE,
      });
      nextBlood = Math.max(0, nextBlood - OVERDOSE_BLOOD_LOSS);
      nextLimbs = applyLimbOverdoseDamage(nextLimbs);
      actorEnergy -= 20;
    }

    if (anatomy.stamina <= 0) {
      events.push({
        type: 'STAMINA_DEPLETED',
        turn: nextTurn,
        actorId: entity.id,
      });
    }

    const nextActor = entity.actor ? { ...entity.actor, energy: actorEnergy } : undefined;
    updatedEntities[entityId] = {
      ...entity,
      actor: nextActor,
      anatomy: {
        ...anatomy,
        toxicityPct: nextToxicity,
        stamina: nextStamina,
        painShock: nextPainShock,
        bloodVolumePct: nextBlood,
        limbs: nextLimbs,
        activeEffects: remainingEffects,
      },
    };
  }

  return {
    state: { ...state, entities: updatedEntities },
    events,
  };
}

/**
 * Applies declarative consumable metabolic properties (blood, steam, toxicity, stamina, pain relief, and status effects).
 */
export function applyItemUseEffect(
  anatomy: AnatomyComponent,
  effect: ItemUseEffect,
  actorId: EntityId,
  turn: number,
  itemEntityId?: EntityId,
  _itemName?: string,
  blueprintId?: BlueprintId,
): {
  nextAnatomy: AnatomyComponent;
  amountRestored: number;
  alchemicalEvents: SimEvent[];
} {
  let nextBlood = anatomy.bloodVolumePct;
  let nextSteam = anatomy.steamReserveKpa;
  let amountRestored = 0;

  if (effect.kind === 'RESTORE_BLOOD') {
    nextBlood = Math.min(100, anatomy.bloodVolumePct + effect.magnitude);
    amountRestored = nextBlood - anatomy.bloodVolumePct;
  } else if (effect.kind === 'RESTORE_STEAM') {
    nextSteam = Math.min(anatomy.maxSteamReserveKpa, anatomy.steamReserveKpa + effect.magnitude);
    amountRestored = nextSteam - anatomy.steamReserveKpa;
  }

  let nextToxicity = anatomy.toxicityPct;
  let nextStamina = anatomy.stamina;
  let nextPainShock = anatomy.painShock;
  let nextLimbs = anatomy.limbs;
  const nextActiveEffects = [...anatomy.activeEffects];
  const alchemicalEvents: SimEvent[] = [];

  const toxDelta = effect.toxicityDelta ?? 0;
  const stamRestore = effect.staminaRestore ?? 0;
  const painRelief = effect.painRelief ?? 0;
  const appliedEffectId = effect.appliedEffectId;

  if (toxDelta !== 0) {
    nextToxicity = Math.min(100, Math.max(0, nextToxicity + toxDelta));
  }
  if (stamRestore !== 0) {
    nextStamina = Math.min(100, Math.max(0, nextStamina + stamRestore));
  }
  if (painRelief !== 0) {
    nextPainShock = Math.min(100, Math.max(0, nextPainShock - painRelief));
  }
  if (appliedEffectId) {
    nextActiveEffects.push({
      effectId: appliedEffectId,
      durationTurns: 10,
      magnitude: effect.magnitude > 0 ? effect.magnitude : 1,
    });
  }

  const isAlchemical =
    effect.kind === 'ALCHEMICAL' || toxDelta !== 0 || stamRestore !== 0 || painRelief !== 0 || !!appliedEffectId;

  if (isAlchemical) {
    alchemicalEvents.push({
      type: 'ALCHEMICAL_CONSUMED',
      turn,
      actorId,
      itemEntityId,
      blueprintId,
      toxicityDelta: toxDelta,
      staminaDelta: stamRestore,
      painRelief,
      appliedEffectId,
    });
  }

  if (nextToxicity >= TOXICITY_OVERDOSE_THRESHOLD) {
    alchemicalEvents.push({
      type: 'TOXICITY_OVERDOSE',
      turn,
      actorId,
      toxicityPct: nextToxicity,
      bloodVolumeLost: OVERDOSE_BLOOD_LOSS,
      damageInflicted: OVERDOSE_DAMAGE,
    });
    nextBlood = Math.max(0, nextBlood - OVERDOSE_BLOOD_LOSS);
    nextLimbs = applyLimbOverdoseDamage(nextLimbs);
  }

  if (nextStamina <= 0) {
    alchemicalEvents.push({
      type: 'STAMINA_DEPLETED',
      turn,
      actorId,
    });
  }

  return {
    nextAnatomy: {
      ...anatomy,
      bloodVolumePct: nextBlood,
      steamReserveKpa: nextSteam,
      toxicityPct: nextToxicity,
      stamina: nextStamina,
      painShock: nextPainShock,
      limbs: nextLimbs,
      activeEffects: nextActiveEffects,
    },
    amountRestored,
    alchemicalEvents,
  };
}
