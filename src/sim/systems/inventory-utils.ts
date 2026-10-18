import { EntityRecord, InventoryComponent } from '../../schemas/components.schema.js';
import { SimEvent } from '../../schemas/events.schema.js';
import { EntityId, EntityIdSchema } from '../../schemas/primitives.schema.js';
import { STANDARD_ACTION_AP } from '../core/scheduler.js';
import { WorldState } from '../core/world.js';

/** Hard mass ceiling as a multiple of `maxMassGrams`. Between 1.0x and this, movement is slowed. */
export const MAX_OVERLOAD_RATIO = 1.5;

export interface CarryProfile {
  readonly massGrams: number;
  readonly volumeMl: number;
}

/**
 * Total mass/volume of a carryable entity (items scale by quantity; prosthetics are single units).
 * Returns undefined for non-carryable entities (portals, actors, vessels).
 */
export function getCarryProfile(entity: EntityRecord): CarryProfile | undefined {
  if (entity.item) {
    return {
      massGrams: entity.item.massGrams * entity.item.quantity,
      volumeMl: entity.item.volumeMl * entity.item.quantity,
    };
  }
  if (entity.prostheticSpec) {
    return {
      massGrams: entity.prostheticSpec.massGrams,
      volumeMl: entity.prostheticSpec.volumeMl,
    };
  }
  return undefined;
}

/** Sums the volume of every entity referenced by an inventory. Derived, never stored. */
export function computeCarriedVolumeMl(
  state: Readonly<WorldState>,
  inventory: InventoryComponent,
): number {
  let total = 0;
  for (const id of inventory.containedEntityIds) {
    const entity = state.entities[id];
    if (!entity) continue;
    total += getCarryProfile(entity)?.volumeMl ?? 0;
  }
  return total;
}

/** True if the entity is currently socketed into any of the actor's limbs. */
export function isInstalledOnActor(actor: EntityRecord, entityId: EntityId): boolean {
  if (!actor.anatomy) return false;
  return Object.values(actor.anatomy.limbs).some(
    (limb) => limb?.installedProstheticEntityId === entityId,
  );
}

/** Returns a copy of the entity table with the given id removed. */
export function withoutEntity(
  entities: Readonly<Record<string, EntityRecord>>,
  entityId: EntityId,
): Record<string, EntityRecord> {
  const { [entityId]: _removed, ...rest } = entities;
  return rest;
}

/** Returns a copy of the entity with its position component stripped (item is now held). */
export function withoutPosition(entity: EntityRecord): EntityRecord {
  const { position: _position, ...rest } = entity;
  return rest;
}

/** Finds a held stackable item with the same blueprint that a new stack can merge into. */
export function findMergeableStack(
  state: Readonly<WorldState>,
  inventory: InventoryComponent,
  candidate: EntityRecord,
): EntityRecord | undefined {
  if (!candidate.item?.stackable) return undefined;
  for (const id of inventory.containedEntityIds) {
    const held = state.entities[id];
    if (
      held?.item?.stackable &&
      held.id !== candidate.id &&
      held.item.blueprintId === candidate.item.blueprintId
    ) {
      return held;
    }
  }
  return undefined;
}

export function sortEntitiesById(a: EntityRecord, b: EntityRecord): number {
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

export function allocateSplitId(state: Readonly<WorldState>, baseId: EntityId): EntityId {
  for (let n = 0; ; n++) {
    const candidate = EntityIdSchema.parse(`${baseId}_split_t${state.turnCount}_${n}`);
    if (!state.entities[candidate]) return candidate;
  }
}

type InventoryFailureEvent = Extract<SimEvent, { type: 'INVENTORY_ACTION_FAILED' }>;

export function createInventoryFailureResult(
  state: WorldState,
  actorId: EntityId,
  action: InventoryFailureEvent['action'],
  reason: InventoryFailureEvent['reason'],
  itemEntityId?: EntityId,
): { state: WorldState; events: SimEvent[]; apSpent: number } {
  return {
    state,
    apSpent: STANDARD_ACTION_AP,
    events: [
      {
        type: 'INVENTORY_ACTION_FAILED',
        turn: state.turnCount + 1,
        actorId,
        action,
        reason,
        itemEntityId,
      },
    ],
  };
}
