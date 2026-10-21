import { InventoryComponent } from '../../schemas/components.schema.js';
import { SimEvent } from '../../schemas/events.schema.js';
import { BlueprintId, EntityId } from '../../schemas/primitives.schema.js';
import { STANDARD_ACTION_AP } from '../core/scheduler.js';
import { WorldState } from '../core/world.js';
import { createEntityFromBlueprint, getRecipeBlueprint } from '../data/item-catalog.js';
import {
  computeCarriedVolumeMl,
  findMergeableStack,
  getCarryProfile,
  MAX_OVERLOAD_RATIO,
} from './inventory-utils.js';
import {
  allocateCraftedId,
  consumeIngredients,
  findAdjacentWorkbench,
  recomputeMassGrams,
} from './crafting-utils.js';
import { SystemInventoryResult } from './inventory.system.js';
import {
  REPAIR_HP_RESTORED,
  REPAIR_LIMB_AP,
  REPAIR_STEAM_COST_KPA,
  resolveRepairLimb,
  resolveSalvageItem,
  SALVAGE_AP,
} from './salvage-repair.system.js';

export {
  SALVAGE_AP,
  REPAIR_LIMB_AP,
  REPAIR_STEAM_COST_KPA,
  REPAIR_HP_RESTORED,
  resolveSalvageItem,
  resolveRepairLimb,
};

type CraftingFailureEvent = Extract<SimEvent, { type: 'CRAFTING_FAILED' }>;

export function failCrafting(
  state: WorldState, actorId: EntityId, action: CraftingFailureEvent['action'], reason: CraftingFailureEvent['reason'],
): SystemInventoryResult {
  return { state, apSpent: STANDARD_ACTION_AP, events: [{ type: 'CRAFTING_FAILED', turn: state.turnCount + 1, actorId, action, reason }] };
}

/** Crafts an item, prosthetic, or commodity from a blueprint recipe using materials and steam. */
export function resolveCraftRecipe(state: WorldState, actorId: EntityId, recipeId: BlueprintId): SystemInventoryResult {
  const recipe = getRecipeBlueprint(recipeId);
  if (!recipe) return failCrafting(state, actorId, 'CRAFT_RECIPE', 'UNKNOWN_RECIPE');

  const actor = state.entities[actorId];
  if (!actor?.inventory) return failCrafting(state, actorId, 'CRAFT_RECIPE', 'NO_INVENTORY');
  if (!actor.anatomy) return failCrafting(state, actorId, 'CRAFT_RECIPE', 'MISSING_ANATOMY');

  if (recipe.requiresManual && !actor.anatomy.unlockedRecipeIds.includes(recipeId)) {
    return failCrafting(state, actorId, 'CRAFT_RECIPE', 'RECIPE_LOCKED');
  }

  const bench = findAdjacentWorkbench(state, actor, recipe.stationType);
  if (recipe.requiresWorkbench && !bench) {
    return failCrafting(state, actorId, 'CRAFT_RECIPE', 'WORKBENCH_REQUIRED');
  }

  const traitDiscount = actor.traits?.includes('TINKER_SAVANT') ? 25 : 0;
  const discountPct = Math.min(90, (bench?.workbench?.bonusEfficiencyPct ?? 0) + traitDiscount);
  const steamCost = Math.max(0, Math.round((recipe.steamCostKpa * (100 - discountPct)) / 100));
  if (actor.anatomy.steamReserveKpa < steamCost) {
    return failCrafting(state, actorId, 'CRAFT_RECIPE', 'INSUFFICIENT_STEAM');
  }

  const consumed = consumeIngredients(state.entities, [...actor.inventory.containedEntityIds], recipe.ingredients);
  if (!consumed.ok) return failCrafting(state, actorId, 'CRAFT_RECIPE', 'MISSING_INGREDIENTS');

  const outputEntityId = allocateCraftedId(consumed.entities, state.turnCount, recipe.outputBlueprintId);
  const crafted = createEntityFromBlueprint(recipe.outputBlueprintId, outputEntityId, recipe.outputQuantity);
  if (!crafted) return failCrafting(state, actorId, 'CRAFT_RECIPE', 'UNKNOWN_RECIPE');
  const outProfile = getCarryProfile(crafted) ?? { massGrams: 0, volumeMl: 0 };

  const tempInv: InventoryComponent = {
    ...actor.inventory,
    containedEntityIds: consumed.containedIds,
    currentMassGrams: recomputeMassGrams(consumed.entities, consumed.containedIds),
  };
  const tempState: WorldState = { ...state, entities: consumed.entities };

  if (computeCarriedVolumeMl(tempState, tempInv) + outProfile.volumeMl > tempInv.maxVolumeMl) {
    return failCrafting(state, actorId, 'CRAFT_RECIPE', 'VOLUME_EXCEEDED');
  }
  const nextMass = tempInv.currentMassGrams + outProfile.massGrams;
  if (nextMass > tempInv.maxMassGrams * MAX_OVERLOAD_RATIO) {
    return failCrafting(state, actorId, 'CRAFT_RECIPE', 'MASS_EXCEEDED');
  }

  const stack = findMergeableStack(tempState, tempInv, crafted);
  const entities = { ...consumed.entities };
  let finalContained = consumed.containedIds;
  let finalOutputId = crafted.id;
  if (stack?.item && crafted.item) {
    entities[stack.id] = { ...stack, item: { ...stack.item, quantity: stack.item.quantity + crafted.item.quantity } };
    finalOutputId = stack.id;
  } else {
    entities[crafted.id] = crafted;
    finalContained = [...finalContained, crafted.id];
  }

  entities[actorId] = {
    ...actor,
    inventory: { ...tempInv, containedEntityIds: finalContained, currentMassGrams: nextMass },
    anatomy: { ...actor.anatomy, steamReserveKpa: actor.anatomy.steamReserveKpa - steamCost },
  };

  return {
    state: { ...state, entities },
    apSpent: recipe.apCost,
    events: [{
      type: 'ITEM_CRAFTED',
      turn: state.turnCount + 1,
      actorId,
      recipeId: recipe.id,
      outputEntityId: finalOutputId,
      outputName: crafted.name,
      quantity: recipe.outputQuantity,
      steamSpentKpa: steamCost,
    }],
  };
}
