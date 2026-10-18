import { EntityId, Point3D } from '../../schemas/primitives.schema.js';
import { SimEvent } from '../../schemas/events.schema.js';
import { STANDARD_ACTION_AP } from '../core/scheduler.js';
import { WorldState } from '../core/world.js';
import { getTileCell, setTileCell } from '../spatial/grid.js';
import { withoutEntity } from './inventory-utils.js';

export interface FurnitureResolutionResult {
  readonly state: WorldState;
  readonly events: SimEvent[];
  readonly apSpent: number;
}

function failFurniture(
  state: WorldState,
  actorId: EntityId,
  action: 'SMASH_TERRAIN' | 'REST_AT_BED',
  reason: 'OUT_OF_RANGE' | 'NOT_SMASHABLE' | 'NO_BED_NEARBY' | 'ALREADY_RESTED',
): FurnitureResolutionResult {
  return {
    state,
    events: [{ type: 'FURNITURE_ACTION_FAILED', turn: state.turnCount + 1, actorId, action, reason }],
    apSpent: 0,
  };
}

/** Smashes adjacent breakable terrain (e.g. GLASS_WINDOW into SMASHED_WINDOW_FRAME). */
export function resolveSmashTerrain(
  state: WorldState,
  actorId: EntityId,
  target: Point3D,
): FurnitureResolutionResult {
  const actor = state.entities[actorId];
  if (!actor?.position) {
    return failFurniture(state, actorId, 'SMASH_TERRAIN', 'OUT_OF_RANGE');
  }

  if (actor.position.stratum !== target.stratum) {
    return failFurniture(state, actorId, 'SMASH_TERRAIN', 'OUT_OF_RANGE');
  }

  const dist = Math.max(Math.abs(actor.position.x - target.x), Math.abs(actor.position.y - target.y));
  if (dist > 1) {
    return failFurniture(state, actorId, 'SMASH_TERRAIN', 'OUT_OF_RANGE');
  }

  const grid = state.strata[target.stratum];
  if (!grid) {
    return failFurniture(state, actorId, 'SMASH_TERRAIN', 'NOT_SMASHABLE');
  }

  const cell = getTileCell(grid, target.x, target.y);
  if (cell?.terrainType !== 'GLASS_WINDOW') {
    return failFurniture(state, actorId, 'SMASH_TERRAIN', 'NOT_SMASHABLE');
  }

  const nextGrid = setTileCell(grid, target.x, target.y, (c) => ({
    ...c,
    terrainType: 'SMASHED_WINDOW_FRAME',
    blocksMovement: false,
    blocksSight: false,
  }));

  const nextState: WorldState = {
    ...state,
    strata: {
      ...state.strata,
      [target.stratum]: nextGrid,
    },
  };

  const smashEvent: SimEvent = {
    type: 'TERRAIN_SMASHED',
    turn: state.turnCount + 1,
    actorId,
    target,
    fromTerrain: 'GLASS_WINDOW',
    toTerrain: 'SMASHED_WINDOW_FRAME',
  };

  return {
    state: nextState,
    events: [smashEvent],
    apSpent: STANDARD_ACTION_AP,
  };
}

/** Rests at an adjacent or occupied BED / SURGICAL_TABLE to restore limb HP and blood volume. */
export function resolveRestAtBed(
  state: WorldState,
  actorId: EntityId,
): FurnitureResolutionResult {
  const actor = state.entities[actorId];
  if (!actor?.position || !actor.anatomy) {
    return failFurniture(state, actorId, 'REST_AT_BED', 'NO_BED_NEARBY');
  }

  const { x, y, stratum } = actor.position;
  const bedEntity = Object.values(state.entities).find((e) => {
    if (!e.furniture || !e.position || e.position.stratum !== stratum) return false;
    if (e.furniture.kind !== 'BED' && e.furniture.kind !== 'SURGICAL_TABLE') return false;
    return Math.max(Math.abs(e.position.x - x), Math.abs(e.position.y - y)) <= 1;
  });

  if (!bedEntity) {
    return failFurniture(state, actorId, 'REST_AT_BED', 'NO_BED_NEARBY');
  }

  const isSurgical = bedEntity.furniture?.kind === 'SURGICAL_TABLE';
  const healAmount = isSurgical ? 35 : 20;

  let totalHpRestored = 0;
  const nextLimbs = { ...actor.anatomy.limbs };
  for (const [slot, limb] of Object.entries(nextLimbs)) {
    if (limb.amputated) continue;
    const restored = Math.min(limb.maxHp - limb.hp, healAmount);
    if (restored > 0) {
      totalHpRestored += restored;
      nextLimbs[slot as keyof typeof nextLimbs] = {
        ...limb,
        hp: limb.hp + restored,
      };
    }
  }

  const oldBlood = actor.anatomy.bloodVolumePct;
  const newBlood = Math.min(100, oldBlood + (isSurgical ? 35 : 20));
  const bloodRestoredPct = newBlood - oldBlood;

  const nextState: WorldState = {
    ...state,
    entities: {
      ...state.entities,
      [actorId]: {
        ...actor,
        anatomy: {
          ...actor.anatomy,
          limbs: nextLimbs,
          bloodVolumePct: newBlood,
        },
      },
    },
  };

  const restEvent: SimEvent = {
    type: 'ACTOR_RESTED',
    turn: state.turnCount + 1,
    actorId,
    hpRestored: totalHpRestored,
    bloodRestoredPct,
  };

  return {
    state: nextState,
    events: [restEvent],
    apSpent: STANDARD_ACTION_AP * 2,
  };
}

/** Reads a schematic manual item to unlock advanced recipes for the actor. */
export function resolveUseManual(
  state: WorldState,
  actorId: EntityId,
  itemEntityId: EntityId,
): FurnitureResolutionResult {
  const actor = state.entities[actorId];
  if (!actor?.inventory || !actor.anatomy) {
    return { state, events: [], apSpent: 0 };
  }

  const itemEntity = state.entities[itemEntityId];
  const recipeId = itemEntity?.item?.unlocksRecipeId;
  if (!itemEntity?.item || !recipeId) {
    return { state, events: [], apSpent: 0 };
  }

  const currentUnlocked = actor.anatomy.unlockedRecipeIds ?? [];
  const alreadyUnlocked = currentUnlocked.includes(recipeId);
  const nextUnlocked = alreadyUnlocked ? currentUnlocked : [...currentUnlocked, recipeId];

  let nextEntities = { ...state.entities };
  let nextContained = [...actor.inventory.containedEntityIds];
  const remainingQty = itemEntity.item.quantity - 1;

  if (remainingQty <= 0) {
    nextEntities = withoutEntity(nextEntities, itemEntityId);
    nextContained = nextContained.filter((id) => id !== itemEntityId);
  } else {
    nextEntities[itemEntityId] = {
      ...itemEntity,
      item: { ...itemEntity.item, quantity: remainingQty },
    };
  }

  const updatedActor = {
    ...actor,
    anatomy: {
      ...actor.anatomy,
      unlockedRecipeIds: nextUnlocked,
    },
    inventory: {
      ...actor.inventory,
      containedEntityIds: nextContained,
    },
  };
  nextEntities[actorId] = updatedActor;

  const events: SimEvent[] = [];
  if (!alreadyUnlocked) {
    events.push({
      type: 'RECIPE_UNLOCKED',
      turn: state.turnCount + 1,
      actorId,
      recipeId,
      itemName: itemEntity.name,
    });
  }

  events.push({
    type: 'ITEM_USED',
    turn: state.turnCount + 1,
    actorId,
    itemEntityId,
    itemName: itemEntity.name,
    effect: 'RESTORE_STEAM',
    amountRestored: 0,
    remainingQuantity: Math.max(0, remainingQty),
  });

  return {
    state: { ...state, entities: nextEntities },
    events,
    apSpent: STANDARD_ACTION_AP,
  };
}
