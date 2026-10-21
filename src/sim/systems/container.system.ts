import { EntityRecord, InventoryComponent } from '../../schemas/components.schema.js';
import { SimEvent } from '../../schemas/events.schema.js';
import { EntityId } from '../../schemas/primitives.schema.js';
import { STANDARD_ACTION_AP } from '../core/scheduler.js';
import { WorldState } from '../core/world.js';
import { processCrimeWitnesses } from './squad-witness.system.js';
import {
  computeCarriedVolumeMl,
  findMergeableStack,
  getCarryProfile,
  MAX_OVERLOAD_RATIO,
  withoutEntity,
} from './inventory-utils.js';

export interface ContainerResolutionResult {
  readonly state: WorldState;
  readonly events: SimEvent[];
  readonly apSpent: number;
}

const VALID_CONTAINER_KINDS = new Set(['LOCKER', 'CRATE', 'BOOKSHELF']);

function failContainer(
  state: WorldState,
  actorId: EntityId,
  reason: 'OUT_OF_RANGE' | 'NOT_A_CONTAINER' | 'CONTAINER_EMPTY' | 'VOLUME_EXCEEDED' | 'MASS_EXCEEDED',
): ContainerResolutionResult {
  return {
    state,
    events: [{
      type: 'FURNITURE_ACTION_FAILED',
      turn: state.turnCount + 1,
      actorId,
      action: 'LOOT_CONTAINER',
      reason,
    }],
    apSpent: 0,
  };
}

/**
 * Loots items and pence from an adjacent furniture container (LOCKER, CRATE, BOOKSHELF).
 * Currency items with penceValue are automatically credited to the player's treasury.
 */
export function resolveLootContainer(
  state: WorldState,
  actorId: EntityId,
  containerId: EntityId,
  itemId?: EntityId,
): ContainerResolutionResult {
  const actor = state.entities[actorId];
  if (!actor?.position || !actor.inventory) {
    return failContainer(state, actorId, 'OUT_OF_RANGE');
  }

  const container = state.entities[containerId];
  if (!container?.position || container.position.stratum !== actor.position.stratum) {
    return failContainer(state, actorId, 'OUT_OF_RANGE');
  }

  const dist = Math.max(
    Math.abs(actor.position.x - container.position.x),
    Math.abs(actor.position.y - container.position.y),
  );
  if (dist > 1) {
    return failContainer(state, actorId, 'OUT_OF_RANGE');
  }

  if (!container.furniture || !VALID_CONTAINER_KINDS.has(container.furniture.kind)) {
    return failContainer(state, actorId, 'NOT_A_CONTAINER');
  }

  const containerInv = container.inventory;
  if (!containerInv || containerInv.containedEntityIds.length === 0) {
    return failContainer(state, actorId, 'CONTAINER_EMPTY');
  }

  const targetIds = itemId
    ? (containerInv.containedEntityIds.includes(itemId) ? [itemId] : [])
    : [...containerInv.containedEntityIds];

  if (targetIds.length === 0) {
    return failContainer(state, actorId, 'CONTAINER_EMPTY');
  }

  let nextEntities: Record<string, EntityRecord> = { ...state.entities };
  let currentContained = [...actor.inventory.containedEntityIds];
  let currentMass = actor.inventory.currentMassGrams;
  let remainingContainerIds = [...containerInv.containedEntityIds];
  const lootedItemIds: EntityId[] = [];
  let penceGained = 0;

  for (const tid of targetIds) {
    const itemEntity = nextEntities[tid];
    if (!itemEntity?.item) continue;

    const itemPence = itemEntity.item.penceValue ?? 0;
    if (itemPence > 0) {
      // Auto-credit currency items directly into the treasury
      penceGained += itemPence * (itemEntity.item.quantity ?? 1);
      nextEntities = withoutEntity(nextEntities, tid);
      remainingContainerIds = remainingContainerIds.filter((id) => id !== tid);
      lootedItemIds.push(tid);
      continue;
    }

    const profile = getCarryProfile(itemEntity);
    if (!profile) continue;

    const workingInv: InventoryComponent = {
      ...actor.inventory,
      containedEntityIds: currentContained,
      currentMassGrams: currentMass,
    };
    const workingState: WorldState = { ...state, entities: nextEntities };

    if (computeCarriedVolumeMl(workingState, workingInv) + profile.volumeMl > actor.inventory.maxVolumeMl) {
      if (lootedItemIds.length === 0 && penceGained === 0) {
        return failContainer(state, actorId, 'VOLUME_EXCEEDED');
      }
      break;
    }

    if (currentMass + profile.massGrams > actor.inventory.maxMassGrams * MAX_OVERLOAD_RATIO) {
      if (lootedItemIds.length === 0 && penceGained === 0) {
        return failContainer(state, actorId, 'MASS_EXCEEDED');
      }
      break;
    }

    remainingContainerIds = remainingContainerIds.filter((id) => id !== tid);
    const stack = findMergeableStack(workingState, workingInv, itemEntity);
    if (stack?.item) {
      nextEntities = withoutEntity(nextEntities, tid);
      nextEntities[stack.id] = {
        ...stack,
        item: { ...stack.item, quantity: stack.item.quantity + itemEntity.item.quantity },
      };
      currentMass += profile.massGrams;
    } else {
      currentContained.push(tid);
      currentMass += profile.massGrams;
    }
    lootedItemIds.push(tid);
  }

  if (lootedItemIds.length === 0 && penceGained === 0) {
    return failContainer(state, actorId, 'CONTAINER_EMPTY');
  }

  const updatedActor: EntityRecord = {
    ...actor,
    inventory: {
      ...actor.inventory,
      containedEntityIds: currentContained,
      currentMassGrams: currentMass,
    },
  };
  nextEntities[actorId] = updatedActor;

  let containerMass = 0;
  for (const cid of remainingContainerIds) {
    const e = nextEntities[cid];
    if (e) containerMass += getCarryProfile(e)?.massGrams ?? 0;
  }

  const updatedContainer: EntityRecord = {
    ...container,
    inventory: {
      ...containerInv,
      containedEntityIds: remainingContainerIds,
      currentMassGrams: containerMass,
    },
  };
  nextEntities[containerId] = updatedContainer;

  let nextState: WorldState = {
    ...state,
    entities: nextEntities,
    economy: {
      ...state.economy,
      playerTreasuryPence: state.economy.playerTreasuryPence + penceGained,
    },
  };

  const witnessEvents: SimEvent[] = [];
  if (container.aiController?.factionId) {
    const witnessRes = processCrimeWitnesses(nextState, actorId, container.aiController.factionId, 'THEFT');
    nextState = witnessRes.state;
    witnessEvents.push(...witnessRes.events);
  }

  const lootedEvent: SimEvent = {
    type: 'CONTAINER_LOOTED',
    turn: state.turnCount + 1,
    actorId,
    containerId,
    containerName: container.name,
    itemIds: lootedItemIds,
    penceGained,
  };

  return {
    state: nextState,
    events: [lootedEvent, ...witnessEvents],
    apSpent: STANDARD_ACTION_AP,
  };
}
