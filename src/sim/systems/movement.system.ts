import { EntityRecord } from '../../schemas/components.schema.js';
import { SimEvent } from '../../schemas/events.schema.js';
import { EntityId, LimbSlotId, Point3D } from '../../schemas/primitives.schema.js';
import { STANDARD_ACTION_AP } from '../core/scheduler.js';
import { WorldState } from '../core/world.js';
import { findBlockingEntityAtPoint, getTileCell, isWithinBounds } from '../spatial/grid.js';
import { findPortalAtPoint } from '../spatial/portals.js';
import { computeActorStepNoiseDb, emitAcousticPulse } from './stealth-acoustics.system.js';
import { resolveToggleDoor, resolveTravelDistrict } from './transit.system.js';
import { resolveStepOnTraps } from './physics-traps.system.js';

export interface SystemMovementResult {
  state: WorldState;
  events: SimEvent[];
  apSpent: number;
}

const LEG_SLOTS: readonly LimbSlotId[] = ['LEFT_LEG', 'RIGHT_LEG'];

/**
 * Calculates movement AP cost and steam reserve consumption factoring in
 * leg amputations, pressurized pneumatic prosthetics, and inventory encumbrance.
 */
export function computeMovementMechanics(
  state: Readonly<WorldState>,
  entity: EntityRecord,
): { apSpent: number; steamSpentKpa: number } {
  let baseAp = STANDARD_ACTION_AP;
  let steamSpentKpa = 0;

  if (entity.anatomy) {
    let uncompensatedMissingLegs = 0;
    let availableSteam = entity.anatomy.steamReserveKpa;

    for (const slot of LEG_SLOTS) {
      const limb = entity.anatomy.limbs[slot];
      if (!limb) continue;

      const prostheticId = limb.installedProstheticEntityId;
      const prosthetic = prostheticId ? state.entities[prostheticId]?.prostheticSpec : undefined;

      if (prosthetic) {
        if (availableSteam >= prosthetic.steamConsumptionPerTurn) {
          availableSteam -= prosthetic.steamConsumptionPerTurn;
          steamSpentKpa += prosthetic.steamConsumptionPerTurn;
          baseAp += prosthetic.moveApModifier;
        } else {
          // Depressurized pneumatic prosthetic acts as dead weight
          baseAp += 45;
          if (limb.amputated) {
            uncompensatedMissingLegs += 1;
          }
        }
      } else if (limb.amputated) {
        uncompensatedMissingLegs += 1;
      }
    }

    if (uncompensatedMissingLegs >= 2) {
      baseAp += 150;
    } else if (uncompensatedMissingLegs === 1) {
      baseAp += 60;
    }
  }

  if (entity.inventory && entity.inventory.currentMassGrams > entity.inventory.maxMassGrams) {
    const overRatio =
      (entity.inventory.currentMassGrams - entity.inventory.maxMassGrams) /
      entity.inventory.maxMassGrams;
    baseAp += Math.ceil(overRatio * 100);
  }

  return {
    apSpent: Math.max(25, baseAp),
    steamSpentKpa,
  };
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
  if (targetTile?.terrainType === 'WOODEN_DOOR_CLOSED') {
    return resolveToggleDoor(state, actorId, targetPoint);
  }
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

  const { apSpent, steamSpentKpa } = computeMovementMechanics(state, actor);
  const updatedActor: EntityRecord = {
    ...actor,
    position: {
      ...origin,
      x: targetPoint.x,
      y: targetPoint.y,
    },
    anatomy: actor.anatomy
      ? {
          ...actor.anatomy,
          steamReserveKpa: Math.max(0, actor.anatomy.steamReserveKpa - steamSpentKpa),
        }
      : undefined,
  };

  const moveEvents: SimEvent[] = [
    {
      type: 'ENTITY_MOVED',
      turn: state.turnCount + 1,
      actorId,
      from: { x: origin.x, y: origin.y, stratum: origin.stratum },
      to: targetPoint,
      apSpent,
    },
  ];

  let nextState: WorldState = {
    ...state,
    entities: { ...state.entities, [actorId]: updatedActor },
  };

  const stepNoise = computeActorStepNoiseDb(nextState, actorId);
  if (stepNoise >= 15) {
    const pulse = emitAcousticPulse(nextState, targetPoint, stepNoise, state.turnCount + 1, actorId);
    nextState = pulse.state;
    moveEvents.push(...pulse.events);
  }

  const trapRes = resolveStepOnTraps(nextState, actorId, targetPoint, state.turnCount + 1);
  nextState = trapRes.state;
  moveEvents.push(...trapRes.events);

  return { state: nextState, apSpent, events: moveEvents };
}

export function resolveUsePortal(state: WorldState, actorId: EntityId): SystemMovementResult {
  const actor = state.entities[actorId];
  if (!actor || !actor.position) return { state, events: [], apSpent: STANDARD_ACTION_AP };

  const origin = actor.position;
  const portalEntity = findPortalAtPoint(state.entities, origin);
  if (!portalEntity || !portalEntity.portal) {
    const gateEntity = Object.values(state.entities).find(
      (e) => e.districtGate && e.position?.x === origin.x && e.position?.y === origin.y && e.position?.stratum === origin.stratum,
    );
    if (gateEntity?.districtGate) {
      const transitRes = resolveTravelDistrict(state, actorId, gateEntity.districtGate.targetDistrictId);
      return { state: transitRes.state, events: transitRes.events, apSpent: transitRes.apSpent };
    }
    return {
      state, apSpent: STANDARD_ACTION_AP,
      events: [{ type: 'PORTAL_FAILED', turn: state.turnCount + 1, actorId, reason: 'NO_PORTAL_AT_POSITION' }],
    };
  }

  const dest = portalEntity.portal.target;
  const blocker = findBlockingEntityAtPoint(state.entities, dest, actorId);
  if (blocker) {
    return {
      state, apSpent: STANDARD_ACTION_AP,
      events: [{ type: 'PORTAL_FAILED', turn: state.turnCount + 1, actorId, reason: 'DESTINATION_BLOCKED' }],
    };
  }

  const apSpent = portalEntity.portal.apCost;
  const updatedActor: EntityRecord = {
    ...actor,
    position: { ...origin, x: dest.x, y: dest.y, stratum: dest.stratum },
  };

  return {
    state: { ...state, entities: { ...state.entities, [actorId]: updatedActor } },
    apSpent,
    events: [
      {
        type: 'STRATUM_CHANGED', turn: state.turnCount + 1, actorId,
        portalEntityId: portalEntity.id, fromStratum: origin.stratum, toStratum: dest.stratum, destination: dest,
      },
    ],
  };
}
