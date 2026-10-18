import { SimEvent } from '../../schemas/events.schema.js';
import { EntityId } from '../../schemas/primitives.schema.js';
import { STANDARD_ACTION_AP } from '../core/scheduler.js';
import { WorldState } from '../core/world.js';
import { withoutEntity } from './inventory-utils.js';

export const CHIRURGEON_FEE_PENCE = 35;
export const COMPANION_HIRE_FEE_PENCE = 60;

export interface DialogueResolutionResult {
  readonly state: WorldState;
  readonly events: SimEvent[];
  readonly apSpent: number;
}

function failDialogue(
  state: WorldState, actorId: EntityId,
  action: 'ACCEPT_CONTRACT' | 'COMPLETE_CONTRACT' | 'HIRE_COMPANION' | 'PAY_CHIRURGEON_HEAL',
  reason: string,
): DialogueResolutionResult {
  return {
    state,
    events: [{ type: 'DIALOGUE_ACTION_FAILED', turn: state.turnCount + 1, actorId, action, reason }],
    apSpent: 0,
  };
}

function areActorsAdjacent(state: WorldState, aId: EntityId, bId: EntityId): boolean {
  const a = state.entities[aId]?.position;
  const b = state.entities[bId]?.position;
  if (!a || !b || a.stratum !== b.stratum) return false;
  return Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y)) <= 1;
}

export function resolveAcceptContract(
  state: WorldState,
  actorId: EntityId,
  contractId: string,
): DialogueResolutionResult {
  const contract = state.contracts.find((c) => c.id === contractId);
  if (!contract) return failDialogue(state, actorId, 'ACCEPT_CONTRACT', 'CONTRACT_NOT_FOUND');
  if (contract.status !== 'AVAILABLE') return failDialogue(state, actorId, 'ACCEPT_CONTRACT', 'NOT_AVAILABLE');
  if (!areActorsAdjacent(state, actorId, contract.issuerNpcId)) {
    return failDialogue(state, actorId, 'ACCEPT_CONTRACT', 'ISSUER_NOT_ADJACENT');
  }

  const updatedContracts = state.contracts.map((c) =>
    c.id === contractId ? { ...c, status: 'ACTIVE' as const } : c,
  );

  return {
    state: { ...state, contracts: updatedContracts },
    events: [{ type: 'CONTRACT_ACCEPTED', turn: state.turnCount + 1, actorId, contractId, title: contract.title }],
    apSpent: STANDARD_ACTION_AP,
  };
}

export function resolveCompleteContract(
  state: WorldState,
  actorId: EntityId,
  contractId: string,
): DialogueResolutionResult {
  const contract = state.contracts.find((c) => c.id === contractId);
  if (!contract) return failDialogue(state, actorId, 'COMPLETE_CONTRACT', 'CONTRACT_NOT_FOUND');
  if (contract.status !== 'ACTIVE') return failDialogue(state, actorId, 'COMPLETE_CONTRACT', 'NOT_ACTIVE');
  if (!areActorsAdjacent(state, actorId, contract.issuerNpcId)) {
    return failDialogue(state, actorId, 'COMPLETE_CONTRACT', 'ISSUER_NOT_ADJACENT');
  }

  const actor = state.entities[actorId];
  if (!actor?.inventory) return failDialogue(state, actorId, 'COMPLETE_CONTRACT', 'MISSING_INVENTORY');

  let nextEntities = { ...state.entities };
  let nextContained = [...actor.inventory.containedEntityIds];

  if (contract.kind === 'DELIVER_ITEM') {
    const itemEntry = nextContained
      .map((id) => nextEntities[id])
      .find((e) => e?.item?.blueprintId === contract.targetBlueprintOrEntityId);

    if (!itemEntry?.item) {
      return failDialogue(state, actorId, 'COMPLETE_CONTRACT', 'ITEM_REQUIREMENT_UNMET');
    }

    if (itemEntry.item.quantity > 1) {
      nextEntities[itemEntry.id] = {
        ...itemEntry,
        item: { ...itemEntry.item, quantity: itemEntry.item.quantity - 1 },
      };
    } else {
      nextEntities = withoutEntity(nextEntities, itemEntry.id);
      nextContained = nextContained.filter((id) => id !== itemEntry.id);
    }

    nextEntities[actorId] = {
      ...actor,
      inventory: { ...actor.inventory, containedEntityIds: nextContained },
    };
  } else if (contract.kind === 'SLAY_HOSTILE') {
    const target = nextEntities[contract.targetBlueprintOrEntityId];
    if (target && target.actor && !target.anatomy?.limbs.TORSO?.amputated) {
      return failDialogue(state, actorId, 'COMPLETE_CONTRACT', 'TARGET_STILL_ALIVE');
    }
  }

  const currentRep = state.economy.factionReputation[contract.factionId] ?? 0;
  const nextRep = Math.max(-100, Math.min(100, currentRep + contract.rewardReputation));

  const updatedContracts = state.contracts.map((c) =>
    c.id === contractId ? { ...c, status: 'COMPLETED' as const } : c,
  );

  const nextState: WorldState = {
    ...state,
    entities: nextEntities,
    contracts: updatedContracts,
    economy: {
      ...state.economy,
      playerTreasuryPence: state.economy.playerTreasuryPence + contract.rewardPence,
      factionReputation: { ...state.economy.factionReputation, [contract.factionId]: nextRep },
    },
  };

  const event: SimEvent = {
    type: 'CONTRACT_COMPLETED', turn: state.turnCount + 1, actorId, contractId,
    title: contract.title, rewardPence: contract.rewardPence, rewardReputation: contract.rewardReputation,
    factionId: contract.factionId,
  };
  return { state: nextState, events: [event], apSpent: STANDARD_ACTION_AP };
}

export function resolveHireCompanion(
  state: WorldState,
  actorId: EntityId,
  npcId: EntityId,
): DialogueResolutionResult {
  if (!areActorsAdjacent(state, actorId, npcId)) {
    return failDialogue(state, actorId, 'HIRE_COMPANION', 'NPC_NOT_ADJACENT');
  }

  const npc = state.entities[npcId];
  if (!npc?.actor || !npc.aiController) return failDialogue(state, actorId, 'HIRE_COMPANION', 'INVALID_TARGET');
  if (npc.aiController.companionOfActorId === actorId) {
    return failDialogue(state, actorId, 'HIRE_COMPANION', 'ALREADY_COMPANION');
  }

  if (state.economy.playerTreasuryPence < COMPANION_HIRE_FEE_PENCE) {
    return failDialogue(state, actorId, 'HIRE_COMPANION', 'INSUFFICIENT_FUNDS');
  }

  const updatedNpc = {
    ...npc,
    aiController: {
      ...npc.aiController,
      companionOfActorId: actorId,
      hostile: false,
    },
  };

  const nextState: WorldState = {
    ...state,
    entities: { ...state.entities, [npcId]: updatedNpc },
    economy: {
      ...state.economy,
      playerTreasuryPence: state.economy.playerTreasuryPence - COMPANION_HIRE_FEE_PENCE,
    },
  };

  return {
    state: nextState,
    events: [{
      type: 'COMPANION_RECRUITED',
      turn: state.turnCount + 1,
      actorId,
      companionId: npcId,
      companionName: npc.name,
      feePence: COMPANION_HIRE_FEE_PENCE,
    }],
    apSpent: STANDARD_ACTION_AP,
  };
}

export function resolvePayChirurgeonHeal(
  state: WorldState,
  actorId: EntityId,
  chirurgeonId: EntityId,
): DialogueResolutionResult {
  if (!areActorsAdjacent(state, actorId, chirurgeonId)) {
    return failDialogue(state, actorId, 'PAY_CHIRURGEON_HEAL', 'CHIRURGEON_NOT_ADJACENT');
  }

  const doc = state.entities[chirurgeonId];
  if (doc?.aiController?.role !== 'CHIRURGEON') {
    return failDialogue(state, actorId, 'PAY_CHIRURGEON_HEAL', 'NOT_A_CHIRURGEON');
  }

  if (state.economy.playerTreasuryPence < CHIRURGEON_FEE_PENCE) {
    return failDialogue(state, actorId, 'PAY_CHIRURGEON_HEAL', 'INSUFFICIENT_FUNDS');
  }

  const actor = state.entities[actorId];
  if (!actor?.anatomy) return failDialogue(state, actorId, 'PAY_CHIRURGEON_HEAL', 'MISSING_ANATOMY');

  let totalHpRestored = 0;
  const nextLimbs = { ...actor.anatomy.limbs };
  for (const [slot, limb] of Object.entries(nextLimbs)) {
    if (limb.amputated) continue;
    const missing = limb.maxHp - limb.hp;
    if (missing > 0) {
      totalHpRestored += missing;
      nextLimbs[slot as keyof typeof nextLimbs] = { ...limb, hp: limb.maxHp };
    }
  }

  const bloodGain = 100 - actor.anatomy.bloodVolumePct;
  const updatedActor = {
    ...actor,
    anatomy: { ...actor.anatomy, limbs: nextLimbs, bloodVolumePct: 100 },
  };

  const nextState: WorldState = {
    ...state,
    entities: { ...state.entities, [actorId]: updatedActor },
    economy: {
      ...state.economy,
      playerTreasuryPence: state.economy.playerTreasuryPence - CHIRURGEON_FEE_PENCE,
    },
  };

  return {
    state: nextState,
    events: [{
      type: 'CHIRURGEON_HEAL_COMPLETED',
      turn: state.turnCount + 1,
      actorId,
      chirurgeonId,
      feePence: CHIRURGEON_FEE_PENCE,
      hpRestored: totalHpRestored,
      bloodRestoredPct: bloodGain,
    }],
    apSpent: STANDARD_ACTION_AP,
  };
}
