import { EntityRecord } from '../../schemas/components.schema.js';
import { SimEvent } from '../../schemas/events.schema.js';
import { EntityId, LimbSlotId } from '../../schemas/primitives.schema.js';
import { SeededRNG } from '../core/rng.js';
import { STANDARD_ACTION_AP } from '../core/scheduler.js';
import { WorldState } from '../core/world.js';
import { resolveDamageLimb, SystemAnatomyResult } from './anatomy.system.js';
import { resolveActorDefeatIfFatal } from './mortality.system.js';
import { applyStaminaExertion, computePainShockPenalty } from './physiological-penalties.js';
import { processCrimeWitnesses } from './squad-witness.system.js';

export const MELEE_ATTACK_AP = STANDARD_ACTION_AP;
export const FACTION_ATTACK_REPUTATION_PENALTY = -15;

type CombatFailureReason = Extract<SimEvent, { type: 'COMBAT_ACTION_FAILED' }>['reason'];

function failCombat(
  state: WorldState,
  attackerId: EntityId,
  reason: CombatFailureReason,
  targetId?: EntityId,
): SystemAnatomyResult {
  return {
    state,
    apSpent: STANDARD_ACTION_AP,
    events: [{ type: 'COMBAT_ACTION_FAILED', turn: state.turnCount + 1, attackerId, targetId, reason }],
  };
}

/** Computes effective melee damage and accuracy after accounting for arm injuries or amputations. */
export function computeEffectiveCombatStats(actor: EntityRecord): {
  readonly meleeDamage: number;
  readonly accuracyPct: number;
  readonly bothArmsDisabled: boolean;
} {
  const baseDamage = actor.combatStats?.meleeDamage ?? 12;
  const baseAccuracy = actor.combatStats?.accuracyPct ?? 85;
  if (!actor.anatomy) return { meleeDamage: baseDamage, accuracyPct: baseAccuracy, bothArmsDisabled: false };

  const armSlots: readonly LimbSlotId[] = ['LEFT_ARM', 'RIGHT_ARM'];
  let disabledCount = 0;
  let impairedCount = 0;

  for (const slot of armSlots) {
    const limb = actor.anatomy.limbs[slot];
    if (!limb) continue;
    const disabled = limb.amputated && !limb.installedProstheticEntityId;
    if (disabled) {
      disabledCount += 1;
      impairedCount += 1;
    } else if (limb.hp < limb.maxHp) {
      impairedCount += 1;
    }
  }

  const physio = computePainShockPenalty(actor);

  return {
    meleeDamage: Math.max(2, baseDamage - impairedCount * 4 - physio.damagePenalty),
    accuracyPct: Math.max(15, baseAccuracy - impairedCount * 15 - physio.accuracyPenaltyPct),
    bothArmsDisabled: disabledCount >= 2,
  };
}

/** Resolves a targeted melee limb attack between two adjacent actors on the same stratum. */
export function resolveAttackActor(
  state: WorldState,
  attackerId: EntityId,
  targetId: EntityId,
  targetSlot: LimbSlotId,
  rng: SeededRNG,
): SystemAnatomyResult {
  const attacker = state.entities[attackerId];
  if (!attacker?.position) return failCombat(state, attackerId, 'ATTACKER_NOT_FOUND', targetId);
  const target = state.entities[targetId];
  if (!target?.position) return failCombat(state, attackerId, 'TARGET_NOT_FOUND', targetId);

  if (
    attacker.position.stratum !== target.position.stratum ||
    Math.max(Math.abs(attacker.position.x - target.position.x), Math.abs(attacker.position.y - target.position.y)) > 1
  ) {
    return failCombat(state, attackerId, 'OUT_OF_RANGE', targetId);
  }

  if (!target.anatomy?.limbs[targetSlot]) {
    return failCombat(state, attackerId, 'INVALID_TARGET_SLOT', targetId);
  }

  const eff = computeEffectiveCombatStats(attacker);
  if (eff.bothArmsDisabled) return failCombat(state, attackerId, 'BOTH_ARMS_AMPUTATED', targetId);

  const physio = computePainShockPenalty(attacker, rng);
  const attackAp = MELEE_ATTACK_AP + physio.apPenalty;
  const turn = state.turnCount + 1;
  const exertedAttacker = applyStaminaExertion(attacker, 5);
  let workingState: WorldState =
    exertedAttacker === attacker
      ? state
      : { ...state, entities: { ...state.entities, [attackerId]: exertedAttacker } };

  // Provoke faction NPCs and apply reputation penalty when player attacks a faction member
  const witnessEvents: SimEvent[] = [];
  if (target.aiController) {
    const factionId = target.aiController.factionId;
    const isPlayerAttack = Boolean(attacker.actor?.isPlayer);

    workingState = {
      ...workingState,
      entities: {
        ...workingState.entities,
        [targetId]: {
          ...target,
          aiController: {
            ...target.aiController,
            hostile: true,
            grudgeTargetId: attackerId,
            lastKnownTargetPos: attacker.position ? { ...attacker.position } : target.aiController.lastKnownTargetPos,
          },
        },
      },
    };

    if (isPlayerAttack) {
      const witnessRes = processCrimeWitnesses(workingState, attackerId, factionId, 'ASSAULT');
      workingState = witnessRes.state;
      witnessEvents.push(...witnessRes.events);
    }
  }

  const hit = rng.nextInt(1, 100) <= eff.accuracyPct;
  if (!hit) {
    return {
      state: workingState,
      apSpent: attackAp,
      events: [...witnessEvents, { type: 'COMBAT_ATTACK_RESOLVED', turn, attackerId, targetId, targetSlot, hit: false, damageDealt: 0 }],
    };
  }

  const armor = target.combatStats?.armorReduction ?? 0;
  let coatedBonusDmg = 0;
  const wieldedId = attacker.inventory?.equippedSlots?.WIELD;
  const wieldedItem = wieldedId ? workingState.entities[wieldedId] : undefined;
  if (wieldedItem?.equipmentSpec?.coatedLiquid) {
    const liquid = wieldedItem.equipmentSpec.coatedLiquid;
    if (liquid.liquidType === 'NITRIC_ACID') coatedBonusDmg = 8;
    else if (liquid.liquidType === 'WHALE_OIL') coatedBonusDmg = 4;
    const cleanSpec = { ...wieldedItem.equipmentSpec, coatedLiquid: undefined };
    const updatedWep: EntityRecord = {
      ...wieldedItem,
      equipmentSpec: cleanSpec,
      item: wieldedItem.item ? { ...wieldedItem.item, equipmentSpec: cleanSpec, coatedLiquid: undefined } : undefined,
    };
    workingState = { ...workingState, entities: { ...workingState.entities, [wieldedId!]: updatedWep } };
  }

  const damageDealt = Math.max(1, eff.meleeDamage + coatedBonusDmg - armor);
  const dmgRes = resolveDamageLimb(workingState, targetId, targetSlot, damageDealt);
  workingState = dmgRes.state;

  const events: SimEvent[] = [
    ...witnessEvents,
    { type: 'COMBAT_ATTACK_RESOLVED', turn, attackerId, targetId, targetSlot, hit: true, damageDealt },
    ...dmgRes.events,
  ];

  const afterTarget = workingState.entities[targetId];
  const anatomy = afterTarget?.anatomy;
  if (!afterTarget || !anatomy) return { state: workingState, apSpent: attackAp, events };

  // Apply leg speed penalty or arm combat debuff on hit
  let debuffedTarget: EntityRecord = afterTarget;
  if ((targetSlot === 'LEFT_LEG' || targetSlot === 'RIGHT_LEG') && debuffedTarget.actor) {
    debuffedTarget = {
      ...debuffedTarget,
      actor: { ...debuffedTarget.actor, speed: Math.max(40, debuffedTarget.actor.speed - 20) },
    };
  } else if (targetSlot === 'LEFT_ARM' || targetSlot === 'RIGHT_ARM') {
    const prevStats = debuffedTarget.combatStats ?? { meleeDamage: 12, accuracyPct: 85, armorReduction: 0 };
    debuffedTarget = {
      ...debuffedTarget,
      combatStats: {
        ...prevStats,
        meleeDamage: Math.max(2, prevStats.meleeDamage - 4),
        accuracyPct: Math.max(20, prevStats.accuracyPct - 15),
      },
    };
  }

  workingState = {
    ...workingState,
    entities: { ...workingState.entities, [targetId]: debuffedTarget },
  };

  const defeatRes = resolveActorDefeatIfFatal(workingState, targetId, attackerId);
  if (defeatRes.defeated) {
    return {
      state: defeatRes.state,
      apSpent: attackAp,
      events: [...events, ...defeatRes.events],
    };
  }

  return {
    state: workingState,
    apSpent: attackAp,
    events,
  };
}
