import { EntityRecord } from '../../schemas/components.schema.js';
import { SimEvent } from '../../schemas/events.schema.js';
import { EntityId, EntityIdSchema } from '../../schemas/primitives.schema.js';
import { WorldState } from '../core/world.js';
import { createEntityFromBlueprint } from '../data/item-catalog.js';
import { withoutEntity } from './inventory-utils.js';

export interface SystemMortalityResult {
  readonly state: WorldState;
  readonly events: SimEvent[];
  readonly defeated: boolean;
}

/** Determines if an actor has suffered fatal trauma (headless, torso destroyed, or ex-sanguinated). */
export function isActorFatal(actor?: EntityRecord): boolean {
  if (!actor?.anatomy) return false;
  const torsoHp = actor.anatomy.limbs.TORSO?.hp ?? 1;
  const headHp = actor.anatomy.limbs.HEAD?.hp ?? 1;
  return torsoHp <= 0 || headHp <= 0 || actor.anatomy.bloodVolumePct <= 0;
}

/**
 * Checks an actor for fatal trauma. If fatal, drops carried inventory and installed prosthetics onto
 * the actor's tile, awards Crown Pence pouch for NPCs, removes defeated NPCs from entities,
 * and preserves player entity in state for the Victorian Morgue screen.
 */
export function resolveActorDefeatIfFatal(
  state: WorldState,
  targetId: EntityId,
  attackerId?: EntityId,
): SystemMortalityResult {
  const target = state.entities[targetId];
  if (!target || !target.actor || !isActorFatal(target)) {
    return { state, events: [], defeated: false };
  }

  const turn = state.turnCount + 1;
  const dropSet = new Set<EntityId>(target.inventory?.containedEntityIds ?? []);

  if (target.anatomy) {
    for (const limb of Object.values(target.anatomy.limbs)) {
      if (limb?.installedProstheticEntityId) {
        dropSet.add(limb.installedProstheticEntityId);
      }
    }
  }

  const droppedEntityIds = [...dropSet];
  let nextEntities: Record<string, EntityRecord> = { ...state.entities };

  // Defeated NPCs drop a Crown Pence Pouch and are excised from the world
  if (!target.actor.isPlayer) {
    const penceDropId = EntityIdSchema.parse(`loot_pence_${targetId}_t${turn}`);
    const pencePouch = createEntityFromBlueprint('item_crown_pence_pouch', penceDropId, 1);
    if (pencePouch) {
      nextEntities[penceDropId] = pencePouch;
      droppedEntityIds.push(penceDropId);
    }
    nextEntities = withoutEntity(nextEntities, targetId);
  }

  // Reposition all dropped loot onto the defeat coordinate
  if (target.position) {
    const pos = target.position;
    for (const dropId of droppedEntityIds) {
      const item = nextEntities[dropId];
      if (!item) continue;
      nextEntities[dropId] = {
        ...item,
        position: {
          x: pos.x,
          y: pos.y,
          stratum: pos.stratum,
          blocksMovement: false,
          blocksSight: false,
        },
      };
    }
  }

  const defeatEvent: SimEvent = {
    type: 'ACTOR_DEFEATED',
    turn,
    actorId: targetId,
    actorName: target.name,
    defeatedById: attackerId ?? targetId,
    droppedEntityIds,
  };

  return {
    state: { ...state, entities: nextEntities },
    events: [defeatEvent],
    defeated: true,
  };
}
