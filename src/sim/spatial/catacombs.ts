import { EntityRecord } from '../../schemas/components.schema.js';
import { SimEvent } from '../../schemas/events.schema.js';
import { EntityId } from '../../schemas/primitives.schema.js';
import { WorldState } from '../core/world.js';
import {
  CatacombsFloorResult,
  generateCatacombsFloor,
  getCatacombsTierName,
} from './catacombs-generation.js';
import {
  filterNonCatacombsEntities,
  snapshotFloor,
} from './catacombs-cache.js';

export { generateCatacombsFloor, getCatacombsTierName };
export type { CatacombsFloorResult };

export interface CatacombsTransitResult {
  readonly state: WorldState;
  readonly events: SimEvent[];
  readonly apSpent: number;
}

function failCatacombsTransit(
  state: WorldState,
  turn: number,
  actorId: EntityId,
  reason: 'NO_GATE_AT_POSITION' | 'OUT_OF_RANGE',
): CatacombsTransitResult {
  return {
    state,
    events: [{ type: 'TRANSIT_ACTION_FAILED', turn, actorId, action: 'TRAVEL_DISTRICT', reason }],
    apSpent: 0,
  };
}

export function resolveDescendCatacombs(
  state: WorldState,
  actorId: EntityId,
  stairEntityId: EntityId,
): CatacombsTransitResult {
  const actor = state.entities[actorId];
  const stair = state.entities[stairEntityId];
  const turn = state.turnCount + 1;

  if (!actor?.position || !stair?.position) {
    return failCatacombsTransit(state, turn, actorId, 'NO_GATE_AT_POSITION');
  }

  const dist = Math.max(Math.abs(actor.position.x - stair.position.x), Math.abs(actor.position.y - stair.position.y));
  if (dist > 1) {
    return failCatacombsTransit(state, turn, actorId, 'OUT_OF_RANGE');
  }

  const currentDepth = actor.position.depthLevel ?? 0;
  const targetDepth = currentDepth + 1;
  const nextCatacombDepths = actor.position.stratum === 'CATACOMBS'
    ? snapshotFloor(state, currentDepth, actorId)
    : { ...(state.catacombDepths ?? {}) };

  const cachedFloor = nextCatacombDepths[String(targetDepth)];
  const floor = cachedFloor ? null : generateCatacombsFloor(state.rngState, 24, 24, targetDepth);
  const targetGrid = cachedFloor ? cachedFloor.grid : floor!.grid;
  const floorEntities = cachedFloor ? cachedFloor.entities : floor!.entities;

  const upStair = Object.values(floorEntities).find(
    (e) => e.visual?.glyph === '<' && e.position?.stratum === 'CATACOMBS',
  );
  const arrivalX = cachedFloor ? (upStair?.position?.x ?? 4) : floor!.stairsUp.x;
  const arrivalY = cachedFloor ? (upStair?.position?.y ?? 4) : floor!.stairsUp.y;

  const nextEntities: Record<string, EntityRecord> = {
    ...filterNonCatacombsEntities(state.entities),
    ...floorEntities,
    [actorId]: {
      ...actor,
      position: {
        x: arrivalX,
        y: arrivalY,
        stratum: 'CATACOMBS',
        depthLevel: targetDepth,
        blocksMovement: true,
        blocksSight: false,
      },
    },
  };

  const event: SimEvent = {
    type: 'CATACOMBS_DEPTH_DESCENDED',
    turn,
    actorId,
    fromDepth: currentDepth,
    toDepth: targetDepth,
    tierName: getCatacombsTierName(targetDepth),
  };

  return {
    state: {
      ...state,
      turnCount: turn,
      strata: { ...state.strata, CATACOMBS: targetGrid },
      entities: nextEntities,
      catacombDepths: nextCatacombDepths,
    },
    events: [event],
    apSpent: 100,
  };
}

export function resolveAscendCatacombs(
  state: WorldState,
  actorId: EntityId,
  stairEntityId: EntityId,
): CatacombsTransitResult {
  const actor = state.entities[actorId];
  const stair = state.entities[stairEntityId];
  const turn = state.turnCount + 1;

  if (!actor?.position || !stair?.position) {
    return failCatacombsTransit(state, turn, actorId, 'NO_GATE_AT_POSITION');
  }

  const dist = Math.max(Math.abs(actor.position.x - stair.position.x), Math.abs(actor.position.y - stair.position.y));
  if (dist > 1) {
    return failCatacombsTransit(state, turn, actorId, 'OUT_OF_RANGE');
  }

  const currentDepth = actor.position.depthLevel ?? 1;
  if (actor.position.stratum !== 'CATACOMBS' || currentDepth < 1) {
    return failCatacombsTransit(state, turn, actorId, 'NO_GATE_AT_POSITION');
  }

  const nextCatacombDepths = snapshotFloor(state, currentDepth, actorId);
  const nextEntities = filterNonCatacombsEntities(state.entities);

  if (currentDepth === 1) {
    const underStair = Object.values(state.entities).find(
      (e) => e.id === 'stairs_undercroft_to_catacombs' || (e.portal && e.portal.target?.stratum === 'CATACOMBS'),
    );
    const arrivalPos = underStair?.position ?? { x: 12, y: 12, stratum: 'UNDERCROFT' };
    nextEntities[actorId] = {
      ...actor,
      position: { x: arrivalPos.x, y: arrivalPos.y, stratum: 'UNDERCROFT', blocksMovement: true, blocksSight: false },
    };

    return {
      state: { ...state, turnCount: turn, entities: nextEntities, catacombDepths: nextCatacombDepths },
      events: [{ type: 'CATACOMBS_DEPTH_ASCENDED', turn, actorId, fromDepth: 1, toDepth: 0, tierName: 'Undercroft' }],
      apSpent: 100,
    };
  }

  const targetDepth = currentDepth - 1;
  const cachedFloor = nextCatacombDepths[String(targetDepth)];
  const floor = cachedFloor ? null : generateCatacombsFloor(state.rngState, 24, 24, targetDepth);
  const targetGrid = cachedFloor ? cachedFloor.grid : floor!.grid;
  const floorEntities = cachedFloor ? cachedFloor.entities : floor!.entities;

  const downStair = Object.values(floorEntities).find(
    (e) => e.visual?.glyph === '>' && e.position?.stratum === 'CATACOMBS',
  );
  const arrivalX = cachedFloor ? (downStair?.position?.x ?? 4) : floor!.stairsDown.x;
  const arrivalY = cachedFloor ? (downStair?.position?.y ?? 4) : floor!.stairsDown.y;

  for (const [id, ent] of Object.entries(floorEntities)) {
    nextEntities[id] = ent;
  }
  nextEntities[actorId] = {
    ...actor,
    position: { x: arrivalX, y: arrivalY, stratum: 'CATACOMBS', depthLevel: targetDepth, blocksMovement: true, blocksSight: false },
  };

  return {
    state: {
      ...state,
      turnCount: turn,
      strata: { ...state.strata, CATACOMBS: targetGrid },
      entities: nextEntities,
      catacombDepths: nextCatacombDepths,
    },
    events: [{ type: 'CATACOMBS_DEPTH_ASCENDED', turn, actorId, fromDepth: currentDepth, toDepth: targetDepth, tierName: getCatacombsTierName(targetDepth) }],
    apSpent: 100,
  };
}
