import { EntityRecord } from '../../schemas/components.schema.js';
import { BlueprintId, EntityId, EntityIdSchema } from '../../schemas/primitives.schema.js';
import { WorldState } from '../core/world.js';
import { getCarryProfile, withoutEntity } from './inventory-utils.js';

export function findAdjacentWorkbench(
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

export function allocateCraftedId(
  entities: Readonly<Record<string, EntityRecord>>,
  turnCount: number,
  blueprintId: BlueprintId,
): EntityId {
  for (let n = 0; ; n++) {
    const candidate = EntityIdSchema.parse(`crafted_${blueprintId}_t${turnCount}_${n}`);
    if (!entities[candidate]) return candidate;
  }
}

export function recomputeMassGrams(
  entities: Readonly<Record<string, EntityRecord>>,
  containedIds: readonly EntityId[],
): number {
  let mass = 0;
  for (const id of containedIds) {
    const e = entities[id];
    if (e) mass += getCarryProfile(e)?.massGrams ?? 0;
  }
  return mass;
}

export function consumeIngredients(
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
