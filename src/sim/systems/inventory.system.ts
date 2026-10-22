import { EntityRecord, PositionComponent } from '../../schemas/components.schema.js';
import { SimEvent } from '../../schemas/events.schema.js';
import { EntityId, Point3D } from '../../schemas/primitives.schema.js';
import { STANDARD_ACTION_AP } from '../core/scheduler.js';
import { WorldState } from '../core/world.js';
import { findEntitiesAtPoint } from '../spatial/grid.js';
import { allocateSplitId, computeCarriedVolumeMl, createInventoryFailureResult, findMergeableStack, getCarryProfile, isInstalledOnActor, MAX_OVERLOAD_RATIO, sortEntitiesById, withoutEntity, withoutPosition,  } from './inventory-utils.js';
import { resolveUnequipItem } from './equipment.system.js';
import { EquipmentSlot } from './equipment.system.js';

export const PICKUP_AP = STANDARD_ACTION_AP;
export const DROP_AP = 50;
export const USE_ITEM_AP = STANDARD_ACTION_AP;

export interface SystemInventoryResult {
  readonly state: WorldState;
  readonly events: SimEvent[];
  readonly apSpent: number;
}

/** Picks up a carryable entity on the actor's tile, merging into an existing stack when possible. */
export function resolvePickupItem(
  state: WorldState,
  actorId: EntityId,
  itemEntityId?: EntityId,
): SystemInventoryResult {
  const actor = state.entities[actorId];
  if (!actor?.inventory || !actor.position) {
    return createInventoryFailureResult(state, actorId, 'PICK_UP', 'NO_INVENTORY', itemEntityId);
  }
  const here: Point3D = { x: actor.position.x, y: actor.position.y, stratum: actor.position.stratum };
  const candidates = findEntitiesAtPoint(state.entities, here)
    .filter((e) => e.id !== actorId && getCarryProfile(e) !== undefined)
    .sort(sortEntitiesById);

  const target = itemEntityId ? candidates.find((e) => e.id === itemEntityId) : candidates[0];
  if (!target) {
    if (!itemEntityId) return createInventoryFailureResult(state, actorId, 'PICK_UP', 'NO_ITEM_HERE');
    const existing = state.entities[itemEntityId];
    const reason = !existing ? 'ITEM_NOT_FOUND' : getCarryProfile(existing) ? 'NOT_ON_TILE' : 'NOT_CARRYABLE';
    return createInventoryFailureResult(state, actorId, 'PICK_UP', reason, itemEntityId);
  }

  const penceVal = target.item?.penceValue ?? 0;
  if (penceVal > 0) {
    const penceGained = penceVal * (target.item?.quantity ?? 1);
    const nextEntities = withoutEntity(state.entities, target.id);
    return {
      state: { ...state, entities: nextEntities, economy: { ...state.economy, playerTreasuryPence: state.economy.playerTreasuryPence + penceGained } },
      apSpent: PICKUP_AP,
      events: [{ type: 'ITEM_PICKED_UP', turn: state.turnCount + 1, actorId, itemEntityId: target.id, itemName: target.name, quantity: target.item?.quantity ?? 1 }],
    };
  }

  const profile = getCarryProfile(target);
  if (!profile) return createInventoryFailureResult(state, actorId, 'PICK_UP', 'NOT_CARRYABLE', target.id);
  const inv = actor.inventory;
  if (computeCarriedVolumeMl(state, inv) + profile.volumeMl > inv.maxVolumeMl) {
    return createInventoryFailureResult(state, actorId, 'PICK_UP', 'VOLUME_EXCEEDED', target.id);
  }
  const nextMass = inv.currentMassGrams + profile.massGrams;
  if (nextMass > inv.maxMassGrams * MAX_OVERLOAD_RATIO) {
    return createInventoryFailureResult(state, actorId, 'PICK_UP', 'MASS_EXCEEDED', target.id);
  }

  const quantity = target.item?.quantity ?? 1;
  const stack = findMergeableStack(state, inv, target);
  let entities: Record<string, EntityRecord>;
  let containedEntityIds = inv.containedEntityIds;
  if (stack?.item) {
    entities = withoutEntity(state.entities, target.id);
    entities[stack.id] = { ...stack, item: { ...stack.item, quantity: stack.item.quantity + quantity } };
  } else {
    entities = { ...state.entities, [target.id]: withoutPosition(target) };
    containedEntityIds = [...containedEntityIds, target.id];
  }
  entities[actorId] = {
    ...actor,
    inventory: { ...inv, containedEntityIds, currentMassGrams: nextMass },
  };

  return {
    state: { ...state, entities },
    apSpent: PICKUP_AP,
    events: [{ type: 'ITEM_PICKED_UP', turn: state.turnCount + 1, actorId, itemEntityId: target.id, itemName: target.name, quantity, stackedIntoEntityId: stack?.id }],
  };
}

/** Drops a held item (or part of a stack) onto the actor's current tile. */
export function resolveDropItem(
  state: WorldState,
  actorId: EntityId,
  itemEntityId: EntityId,
  quantity?: number,
): SystemInventoryResult {
  let workingState = state;
  const unequipEvents: SimEvent[] = [];
  let actor = workingState.entities[actorId];
  if (!actor?.inventory || !actor.position) {
    return createInventoryFailureResult(workingState, actorId, 'DROP', 'NO_INVENTORY', itemEntityId);
  }

  // If item is currently equipped, unequip it first to prevent ghost stat retention
  const equippedEntry = Object.entries(actor.inventory.equippedSlots ?? {}).find(([_, id]) => id === itemEntityId);
  if (equippedEntry) {
    const unequipRes = resolveUnequipItem(workingState, actorId, equippedEntry[0] as EquipmentSlot);
    workingState = unequipRes.state;
    unequipEvents.push(...unequipRes.events);
    actor = workingState.entities[actorId];
    if (!actor?.inventory || !actor.position) {
      return createInventoryFailureResult(workingState, actorId, 'DROP', 'NO_INVENTORY', itemEntityId);
    }
  }

  const inv = actor.inventory;
  if (!inv.containedEntityIds.includes(itemEntityId)) {
    return createInventoryFailureResult(workingState, actorId, 'DROP', 'NOT_IN_INVENTORY', itemEntityId);
  }
  const item = workingState.entities[itemEntityId];
  if (!item) return createInventoryFailureResult(workingState, actorId, 'DROP', 'ITEM_NOT_FOUND', itemEntityId);
  if (isInstalledOnActor(actor, itemEntityId)) {
    return createInventoryFailureResult(workingState, actorId, 'DROP', 'ITEM_INSTALLED', itemEntityId);
  }
  const profile = getCarryProfile(item);
  if (!profile) return createInventoryFailureResult(workingState, actorId, 'DROP', 'NOT_CARRYABLE', itemEntityId);

  const stackQty = item.item?.quantity ?? 1;
  const dropQty = quantity ?? stackQty;
  if (dropQty < 1 || dropQty > stackQty) {
    return createInventoryFailureResult(workingState, actorId, 'DROP', 'INVALID_QUANTITY', itemEntityId);
  }

  const at: Point3D = { x: actor.position.x, y: actor.position.y, stratum: actor.position.stratum };
  const groundPos: PositionComponent = { ...at, blocksMovement: false, blocksSight: false };
  const droppedMass = item.item ? item.item.massGrams * dropQty : profile.massGrams;
  const entities: Record<string, EntityRecord> = { ...workingState.entities };
  let droppedId = itemEntityId;
  let containedEntityIds = inv.containedEntityIds;

  if (item.item && dropQty < stackQty) {
    droppedId = allocateSplitId(workingState, itemEntityId);
    entities[itemEntityId] = { ...item, item: { ...item.item, quantity: stackQty - dropQty } };
    entities[droppedId] = {
      ...item,
      id: droppedId,
      position: groundPos,
      item: { ...item.item, quantity: dropQty },
    };
  } else {
    entities[itemEntityId] = { ...item, position: groundPos };
    containedEntityIds = containedEntityIds.filter((id) => id !== itemEntityId);
  }
  entities[actorId] = {
    ...actor,
    inventory: {
      ...inv,
      containedEntityIds,
      currentMassGrams: Math.max(0, inv.currentMassGrams - droppedMass),
    },
  };

  return {
    state: { ...workingState, entities },
    apSpent: DROP_AP,
    events: [
      ...unequipEvents,
      { type: 'ITEM_DROPPED', turn: workingState.turnCount + 1, actorId, itemEntityId: droppedId, itemName: item.name, quantity: dropQty, at },
    ],
  };
}

/** Consumes one unit of a held consumable and applies its declarative `useEffect`. */

export { resolveUseItem } from './inventory-use.system.js';
