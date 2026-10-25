import { EntityRecord } from '../../schemas/components.schema.js';
import { SimEvent } from '../../schemas/events.schema.js';
import { EntityId, LimbSlotId, Point3D } from '../../schemas/primitives.schema.js';
import { STANDARD_ACTION_AP } from '../core/scheduler.js';
import { WorldState } from '../core/world.js';
import { findBlockingEntityAtPoint, getTileCell, isWithinBounds } from '../spatial/grid.js';
import { computeActorStepNoiseDb, emitAcousticPulse } from './stealth-acoustics.system.js';
import { resolveToggleDoor } from './transit.system.js';
import { resolveStepOnTraps } from './physics-traps.system.js';
import { resolveStepOnLiquids } from './liquids.system.js';
import { applyStaminaExertion, computePainShockPenalty } from './physiological-penalties.js';

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

    baseAp += computePainShockPenalty(entity).apPenalty;
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
    return { state, events: [], apSpent: 0 };
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
      apSpent: 0,
      events: [
        {
          type: 'MOVEMENT_BLOCKED',
          turn: state.turnCount,
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
      apSpent: 0,
      events: [
        {
          type: 'MOVEMENT_BLOCKED',
          turn: state.turnCount,
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
      apSpent: 0,
      events: [
        {
          type: 'MOVEMENT_BLOCKED',
          turn: state.turnCount,
          actorId,
          target: targetPoint,
          reason: 'OCCUPIED_BY_ENTITY',
          blockerEntityId: blocker.id,
        },
      ],
    };
  }

  const { apSpent, steamSpentKpa } = computeMovementMechanics(state, actor);
  const updatedActor: EntityRecord = applyStaminaExertion(
    {
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
    },
    2,
  );

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

  const liquidRes = resolveStepOnLiquids(nextState, actorId, origin, targetPoint, state.turnCount + 1);
  nextState = liquidRes.state;
  moveEvents.push(...liquidRes.events);

  return { state: nextState, apSpent, events: moveEvents };
}

export { resolveUsePortal } from './portal-transit.system.js';
