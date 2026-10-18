import { EntityRecord, InventoryComponent } from '../../schemas/components.schema.js';
import { SimEvent } from '../../schemas/events.schema.js';
import { BlueprintId, BlueprintIdSchema, EntityId, EntityIdSchema, LimbSlotId } from '../../schemas/primitives.schema.js';
import { STANDARD_ACTION_AP } from '../core/scheduler.js';
import { WorldState } from '../core/world.js';
import { createEntityFromBlueprint, getRecipeBlueprint } from '../data/item-catalog.js';
import {
  computeCarriedVolumeMl,
  findMergeableStack,
  getCarryProfile,
  isInstalledOnActor,
  MAX_OVERLOAD_RATIO,
  withoutEntity,
} from './inventory-utils.js';
import { SystemInventoryResult } from './inventory.system.js';

export const SALVAGE_AP = STANDARD_ACTION_AP;
export const REPAIR_LIMB_AP = STANDARD_ACTION_AP;
export const REPAIR_STEAM_COST_KPA = 15;
export const REPAIR_HP_RESTORED = 15;

type CraftingFailureEvent = Extract<SimEvent, { type: 'CRAFTING_FAILED' }>;

function failCrafting(
  state: WorldState, actorId: EntityId, action: CraftingFailureEvent['action'], reason: CraftingFailureEvent['reason'],
): SystemInventoryResult {
  return { state, apSpent: STANDARD_ACTION_AP, events: [{ type: 'CRAFTING_FAILED', turn: state.turnCount + 1, actorId, action, reason }] };
}

function findAdjacentWorkbench(
  state: WorldState,
  actor: EntityRecord,
  stationType?: 'ARTIFICER_BENCH' | 'ALCHEMICAL_STILL',
): EntityRecord | undefined {
  if (!actor.position) return undefined;
  const { x, y, stratum } = actor.position;
  for (const entity of Object.values(state.entities)) {
    if (!entity.workbench || !entity.position || entity.position.stratum !== stratum) continue;
    if (stationType && entity.workbench.stationType !== stationType) continue;
    if (Math.max(Math.abs(entity.position.x - x), Math.abs(entity.position.y - y)) <= 1) return entity;
  }
  return undefined;
}

function allocateCraftedId(entities: Readonly<Record<string, EntityRecord>>, turnCount: number, blueprintId: BlueprintId): EntityId {
  for (let n = 0; ; n++) {
    const candidate = EntityIdSchema.parse(`crafted_${blueprintId}_t${turnCount}_${n}`);
    if (!entities[candidate]) return candidate;
  }
}

function recomputeMassGrams(entities: Readonly<Record<string, EntityRecord>>, containedIds: readonly EntityId[]): number {
  let mass = 0;
  for (const id of containedIds) {
    const e = entities[id];
    if (e) mass += getCarryProfile(e)?.massGrams ?? 0;
  }
  return mass;
}

function consumeIngredients(
  entities: Record<string, EntityRecord>,
  containedIds: EntityId[],
  ingredients: readonly { blueprintId: BlueprintId; count: number }[],
): { entities: Record<string, EntityRecord>; containedIds: EntityId[]; ok: boolean } {
  let nextEntities = { ...entities };
  let nextContained = [...containedIds];
  for (const req of ingredients) {
    let remaining = req.count;
    for (const id of [...nextContained]) {
      if (remaining <= 0) break;
      const held = nextEntities[id];
      if (!held?.item || held.item.blueprintId !== req.blueprintId) continue;
      const take = Math.min(remaining, held.item.quantity);
      remaining -= take;
      if (held.item.quantity === take) {
        nextEntities = withoutEntity(nextEntities, id);
        nextContained = nextContained.filter((cid) => cid !== id);
      } else {
        nextEntities[id] = { ...held, item: { ...held.item, quantity: held.item.quantity - take } };
      }
    }
    if (remaining > 0) return { entities, containedIds, ok: false };
  }
  return { entities: nextEntities, containedIds: nextContained, ok: true };
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

  const discountPct = bench?.workbench?.bonusEfficiencyPct ?? 0;
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

/** Disassembles an unequipped prosthetic, commodity, or consumable into raw crafting materials. */
export function resolveSalvageItem(state: WorldState, actorId: EntityId, itemEntityId: EntityId): SystemInventoryResult {
  const actor = state.entities[actorId];
  if (!actor?.inventory) return failCrafting(state, actorId, 'SALVAGE_ITEM', 'NO_INVENTORY');
  if (!actor.inventory.containedEntityIds.includes(itemEntityId)) {
    return failCrafting(state, actorId, 'SALVAGE_ITEM', 'ITEM_NOT_IN_INVENTORY');
  }
  if (isInstalledOnActor(actor, itemEntityId)) {
    return failCrafting(state, actorId, 'SALVAGE_ITEM', 'ITEM_INSTALLED');
  }

  const target = state.entities[itemEntityId];
  if (!target) return failCrafting(state, actorId, 'SALVAGE_ITEM', 'ITEM_NOT_IN_INVENTORY');

  const yieldSpec =
    target.prostheticSpec || target.item?.category === 'COMMODITY' || target.item?.blueprintId === 'mat_cast_iron_plate'
      ? { blueprintId: BlueprintIdSchema.parse('mat_brass_gears'), quantity: 2 }
      : target.item?.category === 'CONSUMABLE'
        ? { blueprintId: BlueprintIdSchema.parse('mat_vulcanized_rubber'), quantity: 1 }
        : undefined;
  if (!yieldSpec) return failCrafting(state, actorId, 'SALVAGE_ITEM', 'NOT_SALVAGEABLE');

  let entities = { ...state.entities };
  let contained = [...actor.inventory.containedEntityIds];
  if (target.item && target.item.quantity > 1) {
    entities[target.id] = { ...target, item: { ...target.item, quantity: target.item.quantity - 1 } };
  } else {
    entities = withoutEntity(entities, target.id);
    contained = contained.filter((id) => id !== target.id);
  }

  const salvageId = allocateCraftedId(entities, state.turnCount, yieldSpec.blueprintId);
  const salvaged = createEntityFromBlueprint(yieldSpec.blueprintId, salvageId, yieldSpec.quantity);
  if (!salvaged) return failCrafting(state, actorId, 'SALVAGE_ITEM', 'NOT_SALVAGEABLE');
  const stack = findMergeableStack({ ...state, entities }, { ...actor.inventory, containedEntityIds: contained }, salvaged);

  if (stack?.item && salvaged.item) {
    entities[stack.id] = { ...stack, item: { ...stack.item, quantity: stack.item.quantity + yieldSpec.quantity } };
  } else {
    entities[salvaged.id] = salvaged;
    contained = [...contained, salvaged.id];
  }

  entities[actorId] = {
    ...actor,
    inventory: { ...actor.inventory, containedEntityIds: contained, currentMassGrams: recomputeMassGrams(entities, contained) },
  };

  return {
    state: { ...state, entities },
    apSpent: SALVAGE_AP,
    events: [{
      type: 'ITEM_SALVAGED',
      turn: state.turnCount + 1,
      actorId,
      salvagedItemEntityId: target.id,
      salvagedItemName: target.name,
      recoveredMaterialBlueprintId: yieldSpec.blueprintId,
      recoveredQuantity: yieldSpec.quantity,
    }],
  };
}

/** Repairs a damaged limb or prosthetic using 1x Brass Clockwork Gears and 15 kPa steam. */
export function resolveRepairLimb(state: WorldState, actorId: EntityId, slot: LimbSlotId): SystemInventoryResult {
  const actor = state.entities[actorId];
  if (!actor?.inventory) return failCrafting(state, actorId, 'REPAIR_LIMB', 'NO_INVENTORY');
  if (!actor.anatomy) return failCrafting(state, actorId, 'REPAIR_LIMB', 'MISSING_ANATOMY');

  const limb = actor.anatomy.limbs[slot];
  if (!limb || limb.amputated) return failCrafting(state, actorId, 'REPAIR_LIMB', 'LIMB_AMPUTATED');
  if (limb.hp >= limb.maxHp) return failCrafting(state, actorId, 'REPAIR_LIMB', 'LIMB_AT_FULL_HP');
  if (actor.anatomy.steamReserveKpa < REPAIR_STEAM_COST_KPA) return failCrafting(state, actorId, 'REPAIR_LIMB', 'INSUFFICIENT_STEAM');

  const consumed = consumeIngredients(state.entities, [...actor.inventory.containedEntityIds], [
    { blueprintId: BlueprintIdSchema.parse('mat_brass_gears'), count: 1 },
  ]);
  if (!consumed.ok) return failCrafting(state, actorId, 'REPAIR_LIMB', 'MISSING_INGREDIENTS');

  const hpRestored = Math.min(REPAIR_HP_RESTORED, limb.maxHp - limb.hp);
  const newHp = limb.hp + hpRestored;
  const entities = { ...consumed.entities };
  entities[actorId] = {
    ...actor,
    inventory: {
      ...actor.inventory,
      containedEntityIds: consumed.containedIds,
      currentMassGrams: recomputeMassGrams(entities, consumed.containedIds),
    },
    anatomy: {
      ...actor.anatomy,
      steamReserveKpa: actor.anatomy.steamReserveKpa - REPAIR_STEAM_COST_KPA,
      limbs: { ...actor.anatomy.limbs, [slot]: { ...limb, hp: newHp } },
    },
  };

  return {
    state: { ...state, entities },
    apSpent: REPAIR_LIMB_AP,
    events: [{ type: 'LIMB_REPAIRED', turn: state.turnCount + 1, actorId, slot, hpRestored, newHp, steamSpentKpa: REPAIR_STEAM_COST_KPA }],
  };
}
