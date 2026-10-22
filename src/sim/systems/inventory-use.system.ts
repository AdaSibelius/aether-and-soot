import { EntityRecord } from '../../schemas/components.schema.js';
import { EntityId } from '../../schemas/primitives.schema.js';
import { WorldState } from '../core/world.js';
import { createInventoryFailureResult, withoutEntity,  } from './inventory-utils.js';
import { resolveUseManual } from './furniture.system.js';
import { applyItemUseEffect } from './metabolism.system.js';
import { USE_ITEM_AP, SystemInventoryResult } from './inventory.system.js';

export function resolveUseItem(
  state: WorldState,
  actorId: EntityId,
  itemEntityId: EntityId,
): SystemInventoryResult {
  const actor = state.entities[actorId];
  if (!actor?.inventory) return createInventoryFailureResult(state, actorId, 'USE', 'NO_INVENTORY', itemEntityId);
  if (!actor.anatomy) return createInventoryFailureResult(state, actorId, 'USE', 'MISSING_ANATOMY', itemEntityId);
  const inv = actor.inventory;
  if (!inv.containedEntityIds.includes(itemEntityId)) {
    return createInventoryFailureResult(state, actorId, 'USE', 'NOT_IN_INVENTORY', itemEntityId);
  }
  const item = state.entities[itemEntityId];
  if (!item) return createInventoryFailureResult(state, actorId, 'USE', 'ITEM_NOT_FOUND', itemEntityId);
  const itemComp = item.item;
  if (!itemComp) return createInventoryFailureResult(state, actorId, 'USE', 'NOT_CONSUMABLE', itemEntityId);
  if (itemComp.unlocksRecipeId) return resolveUseManual(state, actorId, itemEntityId);
  const effect = itemComp.useEffect;
  if (!effect) return createInventoryFailureResult(state, actorId, 'USE', 'NOT_CONSUMABLE', itemEntityId);

  const { nextAnatomy, amountRestored, alchemicalEvents } = applyItemUseEffect(
    actor.anatomy,
    effect,
    actorId,
    state.turnCount + 1,
    itemEntityId,
    item.name,
    itemComp.blueprintId,
  );

  const remainingQuantity = itemComp.quantity - 1;
  const entities: Record<string, EntityRecord> =
    remainingQuantity > 0
      ? { ...state.entities, [itemEntityId]: { ...item, item: { ...itemComp, quantity: remainingQuantity } } }
      : withoutEntity(state.entities, itemEntityId);
  const containedEntityIds =
    remainingQuantity > 0
      ? inv.containedEntityIds
      : inv.containedEntityIds.filter((id) => id !== itemEntityId);
  entities[actorId] = {
    ...actor,
    anatomy: nextAnatomy,
    inventory: {
      ...inv,
      containedEntityIds,
      currentMassGrams: Math.max(0, inv.currentMassGrams - itemComp.massGrams),
    },
  };

  return {
    state: { ...state, entities },
    apSpent: USE_ITEM_AP,
    events: [
      { type: 'ITEM_USED', turn: state.turnCount + 1, actorId, itemEntityId, itemName: item.name, effect: effect.kind, amountRestored, remainingQuantity },
      ...alchemicalEvents,
    ],
  };
}
