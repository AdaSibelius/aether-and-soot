import { z } from 'zod';
import materialsJson from '../../../data/items/materials.json' with { type: 'json' };
import { ItemBlueprint, ItemBlueprintSchema } from '../../schemas/blueprint.schema.js';
import { EntityRecord } from '../../schemas/components.schema.js';
import { EntityId, Point3D } from '../../schemas/primitives.schema.js';

/**
 * Runtime item catalog parsed from `data/items/materials.json`.
 * Parsed through Zod at module load so malformed data fails fast in both Node and the browser.
 */
export const ITEM_CATALOG: readonly ItemBlueprint[] = z
  .array(ItemBlueprintSchema)
  .parse(materialsJson);

export function getItemBlueprint(blueprintId: string): ItemBlueprint | undefined {
  return ITEM_CATALOG.find((bp) => bp.id === blueprintId);
}

/**
 * Builds a flat ECS item entity from a blueprint.
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
    },
  };
  if (!position) return base;
  return {
    ...base,
    position: { ...position, blocksMovement: false, blocksSight: false },
  };
}
