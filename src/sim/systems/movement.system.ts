import { EntityRecord } from '../../schemas/components.schema.js';
import { SimEvent } from '../../schemas/events.schema.js';
import { EntityId, Point3D } from '../../schemas/primitives.schema.js';
import { STANDARD_ACTION_AP } from '../core/scheduler.js';
import { WorldState } from '../core/world.js';
import { findBlockingEntityAtPoint, getTileCell, isWithinBounds } from '../spatial/grid.js';
import { findPortalAtPoint } from '../spatial/portals.js';

export interface SystemMovementResult {
  state: WorldState;
  events: SimEvent[];
  apSpent: number;
}

/**
 * Calculates movement AP cost factoring in leg amputations and encumbrance.
 */
export function computeMovementApCost(entity: EntityRecord): number {
  let baseAp = STANDARD_ACTION_AP;

  if (entity.anatomy) {
    const leftLeg = entity.anatomy.limbs.LEFT_LEG;
    const rightLeg = entity.anatomy.limbs.RIGHT_LEG;
    const missingLeft = leftLeg?.amputated && !leftLeg.installedProstheticEntityId;
    const missingRight = rightLeg?.amputated && !rightLeg.installedProstheticEntityId;

    if (missingLeft && missingRight) {
      baseAp += 150;
    } else if (missingLeft || missingRight) {
      baseAp += 60;
    }
  }

  if (entity.inventory && entity.inventory.currentMassGrams > entity.inventory.maxMassGrams) {
    const overRatio =
      (entity.inventory.currentMassGrams - entity.inventory.maxMassGrams) /
      entity.inventory.maxMassGrams;
    baseAp += Math.ceil(overRatio * 100);
  }

  return baseAp;
}

export function resolveMoveStep(
  state: WorldState,
  actorId: EntityId,
  dx: number,
  dy: number,
): SystemMovementResult {
  const actor = state.entities[actorId];
  if (!actor || !actor.position) {
    return { state, events: [], apSpent: STANDARD_ACTION_AP };
  }

  const origin = actor.position;
  const grid = state.strata[origin.stratum];
  const targetPoint: Point3D = {
    x: origin.x + dx,
    y: origin.y + dy,
    stratum: origin.stratum,
  };

  if (!grid || !isWithinBounds(grid, targetPoint.x, targetPoint.y)) {
    return {
      state,
      apSpent: STANDARD_ACTION_AP,
      events: [
        {
          type: 'MOVEMENT_BLOCKED',
          turn: state.turnCount + 1,
          actorId,
          target: targetPoint,
          reason: 'OUT_OF_BOUNDS',
        },
      ],
    };
  }

  const targetTile = getTileCell(grid, targetPoint.x, targetPoint.y);
  if (!targetTile || targetTile.blocksMovement) {
    return {
      state,
      apSpent: STANDARD_ACTION_AP,
      events: [
        {
          type: 'MOVEMENT_BLOCKED',
          turn: state.turnCount + 1,
          actorId,
          target: targetPoint,
          reason: 'SOLID_TILE',
        },
      ],
    };
  }

  const blocker = findBlockingEntityAtPoint(state.entities, targetPoint, actorId);
  if (blocker) {
    return {
      state,
      apSpent: STANDARD_ACTION_AP,
      events: [
        {
          type: 'MOVEMENT_BLOCKED',
          turn: state.turnCount + 1,
          actorId,
          target: targetPoint,
          reason: 'OCCUPIED_BY_ENTITY',
          blockerEntityId: blocker.id,
        },
      ],
    };
  }

  const apSpent = computeMovementApCost(actor);
  const updatedActor: EntityRecord = {
    ...actor,
    position: {
      ...origin,
      x: targetPoint.x,
      y: targetPoint.y,
    },
  };

  return {
    state: {
      ...state,
      entities: {
        ...state.entities,
        [actorId]: updatedActor,
      },
    },
    apSpent,
    events: [
      {
        type: 'ENTITY_MOVED',
        turn: state.turnCount + 1,
        actorId,
        from: { x: origin.x, y: origin.y, stratum: origin.stratum },
        to: targetPoint,
        apSpent,
      },
    ],
  };
}

export function resolveUsePortal(state: WorldState, actorId: EntityId): SystemMovementResult {
  const actor = state.entities[actorId];
  if (!actor || !actor.position) {
    return { state, events: [], apSpent: STANDARD_ACTION_AP };
  }

  const origin = actor.position;
  const portalEntity = findPortalAtPoint(state.entities, origin);
  if (!portalEntity || !portalEntity.portal) {
    return {
      state,
      apSpent: STANDARD_ACTION_AP,
      events: [
        {
          type: 'PORTAL_FAILED',
          turn: state.turnCount + 1,
          actorId,
          reason: 'NO_PORTAL_AT_POSITION',
        },
      ],
    };
  }

  const dest = portalEntity.portal.target;
  const blocker = findBlockingEntityAtPoint(state.entities, dest, actorId);
  if (blocker) {
    return {
      state,
      apSpent: STANDARD_ACTION_AP,
      events: [
        {
          type: 'PORTAL_FAILED',
          turn: state.turnCount + 1,
          actorId,
          reason: 'DESTINATION_BLOCKED',
        },
      ],
    };
  }

  const apSpent = portalEntity.portal.apCost;
  const updatedActor: EntityRecord = {
    ...actor,
    position: {
      ...origin,
      x: dest.x,
      y: dest.y,
      stratum: dest.stratum,
    },
  };

  return {
    state: {
      ...state,
      entities: {
        ...state.entities,
        [actorId]: updatedActor,
      },
    },
    apSpent,
    events: [
      {
        type: 'STRATUM_CHANGED',
        turn: state.turnCount + 1,
        actorId,
        portalEntityId: portalEntity.id,
        fromStratum: origin.stratum,
        toStratum: dest.stratum,
        destination: dest,
      },
    ],
  };
}
