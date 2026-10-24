import { z } from 'zod';
import commoditiesJson from '../../../data/items/commodities.json' with { type: 'json' };
import materialsJson from '../../../data/items/materials.json' with { type: 'json' };
import prostheticsJson from '../../../data/items/prosthetics.json' with { type: 'json' };
import recipesJson from '../../../data/items/recipes.json' with { type: 'json' };
import {
  CommodityBlueprint,
  CommodityBlueprintSchema,
  CraftingRecipeBlueprint,
  CraftingRecipeBlueprintSchema,
  ItemBlueprint,
  ItemBlueprintSchema,
  ProstheticBlueprint,
  ProstheticBlueprintSchema,
} from '../../schemas/blueprint.schema.js';
import { EntityRecord } from '../../schemas/components.schema.js';
import { CommodityId, EntityId, Point3D } from '../../schemas/primitives.schema.js';

/**
 * Runtime catalogs parsed from `data/items/*.json`.
 * Validated through Zod at module load so malformed data fails fast in both Node and the browser.
 */
export const ITEM_CATALOG: readonly ItemBlueprint[] = z
  .array(ItemBlueprintSchema)
  .parse(materialsJson);

export const PROSTHETIC_CATALOG: readonly ProstheticBlueprint[] = z
  .array(ProstheticBlueprintSchema)
  .parse(prostheticsJson);

export const COMMODITY_CATALOG: readonly CommodityBlueprint[] = z
  .array(CommodityBlueprintSchema)
  .parse(commoditiesJson);

export const RECIPE_CATALOG: readonly CraftingRecipeBlueprint[] = z
  .array(CraftingRecipeBlueprintSchema)
  .parse(recipesJson);

export function getItemBlueprint(blueprintId: string): ItemBlueprint | undefined {
  return ITEM_CATALOG.find((bp) => bp.id === blueprintId);
}

export function getProstheticBlueprint(blueprintId: string): ProstheticBlueprint | undefined {
  return PROSTHETIC_CATALOG.find((bp) => bp.id === blueprintId);
}

export function getCommodityBlueprint(blueprintId: string): CommodityBlueprint | undefined {
  return COMMODITY_CATALOG.find((bp) => bp.id === blueprintId);
}

export function getRecipeBlueprint(recipeId: string): CraftingRecipeBlueprint | undefined {
  return RECIPE_CATALOG.find((bp) => bp.id === recipeId);
}

/**
 * Returns any blueprint matching the given ID across items, prosthetics, commodities, and recipes.
 */
export function getAnyBlueprint(
  blueprintId: string,
): ItemBlueprint | ProstheticBlueprint | CommodityBlueprint | CraftingRecipeBlueprint | undefined {
  return (
    getItemBlueprint(blueprintId) ??
    getProstheticBlueprint(blueprintId) ??
    getCommodityBlueprint(blueprintId) ??
    getRecipeBlueprint(blueprintId)
  );
}

const COMMON_PREFIX_RE = /^(item_|mat_|district_|landmark_|npc_|recipe_|prosthetic_|actor_|gate_|portal_)/i;

/**
 * Transforms snake_case, UPPER_CASE enums, or prefixed identifiers into clean Title Case text.
 */
export function humanizeIdentifier(raw: string): string {
  if (!raw) return '';
  const stripped = raw.replace(COMMON_PREFIX_RE, '');
  const target = stripped.length > 0 ? stripped : raw;
  return target
    .replace(/[_-]+/g, ' ')
    .trim()
    .split(/\s+/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

/**
 * Resolves a blueprint or entity ID into a player-facing display name, falling back to Title Case.
 */
export function resolveBlueprintDisplayName(blueprintId: string): string {
  const bp = getAnyBlueprint(blueprintId);
  if (bp?.name) return bp.name;
  return humanizeIdentifier(blueprintId);
}

/**
 * Returns a concise stat tooltip description for items and prosthetics.
 */
export function formatBlueprintTooltip(blueprintId: string): string | undefined {
  const item = getItemBlueprint(blueprintId);
  if (item) return `${item.description} (${item.massGrams}g, ${item.volumeMl}ml)`;
  const prosthetic = getProstheticBlueprint(blueprintId);
  if (prosthetic) return `${prosthetic.description} (${prosthetic.pressureRatingKpa} kPa)`;
  return undefined;
}

function resolveCommodityEnum(blueprintId: string): CommodityId | undefined {
  if (blueprintId === 'commodity_anthracite_briquette') return 'ANTHRACITE_COAL';
  if (blueprintId === 'commodity_phosphor_bronze_ingot') return 'PHOSPHOR_BRONZE';
  return undefined;
}

/**
 * Builds a flat ECS item entity from an `ItemBlueprint`.
 * Pass `position` to place it on the ground; omit it for an item held inside an inventory.
 */
export function createItemEntity(
  blueprint: ItemBlueprint,
  entityId: EntityId,
  quantity: number,
  position?: Point3D,
): EntityRecord {
  const base: EntityRecord = {
    id: entityId,
    name: blueprint.name,
    visual: blueprint.visual,
    item: {
      blueprintId: blueprint.id,
      category: blueprint.category,
      massGrams: blueprint.massGrams,
      volumeMl: blueprint.volumeMl,
      quantity: blueprint.stackable ? Math.max(1, quantity) : 1,
      stackable: blueprint.stackable,
      commodityId: blueprint.commodityId,
      useEffect: blueprint.useEffect,
      unlocksRecipeId: blueprint.unlocksRecipeId,
      penceValue: blueprint.penceValue,
      ...(blueprint.surgicalQuality !== undefined ? { surgicalQuality: blueprint.surgicalQuality } : {}),
      ...(blueprint.toolQualities ? { toolQualities: blueprint.toolQualities } : {}),
      ...(blueprint.equipment ? { equipmentSpec: blueprint.equipment } : {}),
    },
    ...(blueprint.equipment ? { equipmentSpec: blueprint.equipment } : {}),
  };
  if (!position) return base;
  return {
    ...base,
    position: { ...position, blocksMovement: false, blocksSight: false },
  };
}

/**
 * Builds an `EntityRecord` from any valid item, prosthetic, or commodity blueprint ID.
 */
export function createEntityFromBlueprint(
  blueprintId: string,
  entityId: EntityId,
  quantity = 1,
  position?: Point3D,
): EntityRecord | undefined {
  const itemBp = getItemBlueprint(blueprintId);
  if (itemBp) {
    return createItemEntity(itemBp, entityId, quantity, position);
  }

  const prostheticBp = getProstheticBlueprint(blueprintId);
  if (prostheticBp) {
    const base: EntityRecord = {
      id: entityId,
      name: prostheticBp.name,
      visual: prostheticBp.visual,
      prostheticSpec: {
        blueprintId: prostheticBp.id,
        targetLimbSlot: prostheticBp.targetLimbSlot,
        socketType: prostheticBp.socketType,
        massGrams: prostheticBp.massGrams,
        volumeMl: prostheticBp.volumeMl,
        steamConsumptionPerTurn: prostheticBp.steamConsumptionPerTurn,
        moveApModifier: prostheticBp.moveApModifier,
        fovRadiusBonus: prostheticBp.fovRadiusBonus,
        pressureRatingKpa: prostheticBp.pressureRatingKpa,
        noiseDb: prostheticBp.noiseDb,
        ...(prostheticBp.activeAbility ? { activeAbility: { ...prostheticBp.activeAbility, cooldownRemaining: 0 } } : {}),
      },
    };
    return position ? { ...base, position: { ...position, blocksMovement: false, blocksSight: false } } : base;
  }

  const commodityBp = getCommodityBlueprint(blueprintId);
  if (commodityBp) {
    const base: EntityRecord = {
      id: entityId,
      name: commodityBp.name,
      visual: commodityBp.visual,
      item: {
        blueprintId: commodityBp.id,
        category: 'COMMODITY',
        massGrams: commodityBp.massGrams,
        volumeMl: commodityBp.volumeMl,
        quantity: Math.max(1, quantity),
        stackable: true,
        commodityId: resolveCommodityEnum(commodityBp.id),
      },
    };
    return position ? { ...base, position: { ...position, blocksMovement: false, blocksSight: false } } : base;
  }

  return undefined;
}
