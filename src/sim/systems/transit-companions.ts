import { EntityRecord, PositionComponent } from '../../schemas/components.schema.js';
import { SimEvent } from '../../schemas/events.schema.js';
import { BlueprintId, EntityId } from '../../schemas/primitives.schema.js';
import { WorldState } from '../core/world.js';
import { getTileCell, isWithinBounds, StratumGrid } from '../spatial/grid.js';

export interface PreservedPartyResult {
  readonly preservedEntities: Record<string, EntityRecord>;
  readonly companions: EntityRecord[];
}

/**
 * Collects companions, convoys, escort targets, and their inventories/prosthetics.
 */
export function collectPartyPreservedEntities(
  state: WorldState,
  actorId: EntityId,
): PreservedPartyResult {
  const actor = state.entities[actorId];
  const preservedEntities: Record<string, EntityRecord> = {};
  if (actor) preservedEntities[actorId] = actor;

  // Carried inventory and prosthetics for an entity
  const addEntityAndAttachments = (ent: EntityRecord): void => {
    preservedEntities[ent.id] = ent;
    for (const invId of ent.inventory?.containedEntityIds ?? []) {
      const item = state.entities[invId];
      if (item) preservedEntities[invId] = item;
    }
    for (const limb of Object.values(ent.anatomy?.limbs ?? {})) {
      if (limb.installedProstheticEntityId) {
        const p = state.entities[limb.installedProstheticEntityId];
        if (p) preservedEntities[limb.installedProstheticEntityId] = p;
      }
    }
  };

  if (actor) addEntityAndAttachments(actor);

  const companions: EntityRecord[] = [];
  const convoys = Object.values(state.convoys ?? {});

  for (const ent of Object.values(state.entities)) {
    if (ent.id === actorId) continue;

    const isCompanion = ent.aiController?.companionOfActorId === actorId;
    const isEscortEntity =
      (ent as { escortActorId?: EntityId }).escortActorId === actorId ||
      convoys.some((c) => c.escortCompanionIds.includes(ent.id) || c.cargoItemId === ent.id);

    if (isCompanion || isEscortEntity) {
      companions.push(ent);
      addEntityAndAttachments(ent);
    }
  }

  return { preservedEntities, companions };
}

/**
 * Places companions within 1 tile of arrivalPos on the destination stratum.
 */
export function placePreservedCompanions(
  companions: readonly EntityRecord[],
  arrivalPos: PositionComponent,
  grid: StratumGrid | undefined,
  currentEntities: Record<string, EntityRecord>,
  turn: number,
  actorId: EntityId,
  fromDistrictId: BlueprintId,
  toDistrictId: BlueprintId,
): { updatedEntities: Record<string, EntityRecord>; events: SimEvent[] } {
  const updatedEntities = { ...currentEntities };
  const events: SimEvent[] = [];
  const occupied = new Set<string>([`${arrivalPos.x},${arrivalPos.y}`]);

  for (const comp of companions) {
    let placedPos: PositionComponent = { ...arrivalPos, blocksMovement: true, blocksSight: false };

    if (grid) {
      let found = false;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (dx === 0 && dy === 0) continue;
          const cx = arrivalPos.x + dx;
          const cy = arrivalPos.y + dy;
          const key = `${cx},${cy}`;
          if (occupied.has(key) || !isWithinBounds(grid, cx, cy)) continue;

          const cell = getTileCell(grid, cx, cy);
          if (!cell || cell.blocksMovement) continue;

          const blockedByEnt = Object.values(updatedEntities).some(
            (e) => e.position && e.position.stratum === arrivalPos.stratum && e.position.x === cx && e.position.y === cy && e.position.blocksMovement,
          );
          if (blockedByEnt) continue;

          placedPos = { x: cx, y: cy, stratum: arrivalPos.stratum, blocksMovement: true, blocksSight: false };
          occupied.add(key);
          found = true;
          break;
        }
        if (found) break;
      }
    }

    updatedEntities[comp.id] = { ...comp, position: placedPos };
    events.push({
      type: 'COMPANION_TRANSIT_PRESERVED',
      turn,
      actorId,
      companionEntityId: comp.id,
      fromDistrictId,
      toDistrictId,
      arrivalPosition: placedPos,
    });
  }

  return { updatedEntities, events };
}
