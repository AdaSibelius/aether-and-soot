import { EntityRecord } from '../../schemas/components.schema.js';
import { SimEvent } from '../../schemas/events.schema.js';
import { EntityId, EntityIdSchema, LimbSlotId } from '../../schemas/primitives.schema.js';
import { SeededRNG } from '../core/rng.js';
import { STANDARD_ACTION_AP } from '../core/scheduler.js';
import { WorldState } from '../core/world.js';
import { createEntityFromBlueprint } from '../data/item-catalog.js';
import { resolveDamageLimb, SystemAnatomyResult } from './anatomy.system.js';
import { withoutEntity } from './inventory-utils.js';

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

  return {
    meleeDamage: Math.max(2, baseDamage - impairedCount * 4),
    accuracyPct: Math.max(15, baseAccuracy - impairedCount * 15),
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

  const turn = state.turnCount + 1;
  let workingState = state;

  // Provoke faction NPCs and apply reputation penalty when player attacks a faction member
  if (target.aiController) {
    const factionId = target.aiController.factionId;
    const isPlayerAttack = Boolean(attacker.actor?.isPlayer);
    const currentRep = workingState.economy.factionReputation[factionId] ?? 0;
    const nextRep = isPlayerAttack
      ? Math.max(-100, Math.min(100, currentRep + FACTION_ATTACK_REPUTATION_PENALTY))
      : currentRep;

    workingState = {
      ...workingState,
      economy: {
        ...workingState.economy,
        factionReputation: { ...workingState.economy.factionReputation, [factionId]: nextRep },
      },
      entities: {
        ...workingState.entities,
        [targetId]: { ...target, aiController: { ...target.aiController, hostile: true } },
      },
    };
  }

  const hit = rng.nextInt(1, 100) <= eff.accuracyPct;
  if (!hit) {
    return {
      state: workingState,
      apSpent: MELEE_ATTACK_AP,
      events: [{ type: 'COMBAT_ATTACK_RESOLVED', turn, attackerId, targetId, targetSlot, hit: false, damageDealt: 0 }],
    };
  }

  const armor = target.combatStats?.armorReduction ?? 0;
  const damageDealt = Math.max(1, eff.meleeDamage - armor);
  const dmgRes = resolveDamageLimb(workingState, targetId, targetSlot, damageDealt);
  workingState = dmgRes.state;

  const events: SimEvent[] = [
    { type: 'COMBAT_ATTACK_RESOLVED', turn, attackerId, targetId, targetSlot, hit: true, damageDealt },
    ...dmgRes.events,
  ];

  const afterTarget = workingState.entities[targetId];
  const anatomy = afterTarget?.anatomy;
  if (!afterTarget || !anatomy) return { state: workingState, apSpent: MELEE_ATTACK_AP, events };

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

  const torsoHp = anatomy.limbs.TORSO?.hp ?? 1;
  const headHp = anatomy.limbs.HEAD?.hp ?? 1;
  const isDefeated = torsoHp <= 0 || headHp <= 0 || anatomy.bloodVolumePct <= 0;

  if (!isDefeated) {
    return {
      state: { ...workingState, entities: { ...workingState.entities, [targetId]: debuffedTarget } },
      apSpent: MELEE_ATTACK_AP,
      events,
    };
  }

  // Target defeated: drop all carried inventory items and installed prosthetics onto tile
  const dropSet = new Set<EntityId>(debuffedTarget.inventory?.containedEntityIds ?? []);
  for (const limb of Object.values(anatomy.limbs)) {
    if (limb?.installedProstheticEntityId) dropSet.add(limb.installedProstheticEntityId);
  }

  const droppedEntityIds = [...dropSet];
  const nextEntities = withoutEntity(workingState.entities, targetId);

  // Defeated NPCs drop a Crown Pence Pouch
  if (!target.actor?.isPlayer) {
    const penceDropId = EntityIdSchema.parse(`loot_pence_${targetId}_t${turn}`);
    const pencePouch = createEntityFromBlueprint('item_crown_pence_pouch', penceDropId, 1);
    if (pencePouch) {
      nextEntities[penceDropId] = pencePouch;
      droppedEntityIds.push(penceDropId);
    }
  }

  for (const dropId of droppedEntityIds) {
    const item = nextEntities[dropId];
    if (!item) continue;
    nextEntities[dropId] = {
      ...item,
      position: {
        x: target.position.x,
        y: target.position.y,
        stratum: target.position.stratum,
        blocksMovement: false,
        blocksSight: false,
      },
    };
  }

  events.push({
    type: 'ACTOR_DEFEATED',
    turn,
    actorId: targetId,
    actorName: target.name,
    defeatedById: attackerId,
    droppedEntityIds,
  });

  return {
    state: { ...workingState, entities: nextEntities },
    apSpent: MELEE_ATTACK_AP,
    events,
  };
}
