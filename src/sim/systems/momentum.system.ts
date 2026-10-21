import { EntityRecord, Posture } from '../../schemas/components.schema.js';
import { SimEvent } from '../../schemas/events.schema.js';
import { EntityId } from '../../schemas/primitives.schema.js';
import { WorldState } from '../core/world.js';
import { findBlockingEntityAtPoint, getTileCell, isWithinBounds } from '../spatial/grid.js';
import {
  handleAbyssGravityFall,
  handleEntityCollision,
  handleWallImpact,
  handleWindowShatter,
} from './momentum-trauma.js';

export interface MomentumResolutionResult {
  readonly state: WorldState;
  readonly events: SimEvent[];
  readonly apSpent: number;
}

/** Changes an actor's stance (STANDING, CROUCHED, or BRACED). */
export function resolveSetPosture(
  state: WorldState,
  actorId: EntityId,
  posture: Posture,
  turn: number,
): MomentumResolutionResult {
  const actor = state.entities[actorId];
  if (!actor?.actor) return { state, events: [], apSpent: 0 };

  const previousPosture = actor.actor.posture ?? 'STANDING';
  if (previousPosture === posture) return { state, events: [], apSpent: 0 };

  const updatedActor: EntityRecord = {
    ...actor,
    actor: { ...actor.actor, posture },
  };

  const nextState: WorldState = {
    ...state,
    entities: { ...state.entities, [actorId]: updatedActor },
  };

  const event: SimEvent = {
    type: 'POSTURE_CHANGED',
    turn,
    actorId,
    previousPosture,
    newPosture: posture,
  };

  return { state: nextState, events: [event], apSpent: 50 };
}

/** Resolves directional momentum vector, sliding, breakable windows, collisions, and falls. */
export function resolveApplyMomentumVector(
  state: WorldState,
  targetId: EntityId,
  dx: number,
  dy: number,
  distanceTiles: number,
  _massKg: number | undefined,
  turn: number,
  sourceEntityId?: EntityId,
): MomentumResolutionResult {
  const target = state.entities[targetId];
  if (!target?.position) return { state, events: [], apSpent: 0 };

  let workingState = state;
  const events: SimEvent[] = [];
  const startPosition = { ...target.position };
  const currentStratum = target.position.stratum;

  const isBraced = target.actor?.posture === 'BRACED';
  const effectiveDistance = isBraced ? Math.max(1, Math.floor(distanceTiles / 2)) : distanceTiles;

  let cx = target.position.x;
  let cy = target.position.y;
  let distanceTraveled = 0;

  for (let step = 1; step <= effectiveDistance; step++) {
    const nx = cx + dx;
    const ny = cy + dy;
    const grid = workingState.strata[currentStratum];

    if (!grid || !isWithinBounds(grid, nx, ny)) {
      const wallRes = handleWallImpact(workingState, targetId, { x: cx, y: cy, stratum: currentStratum }, effectiveDistance - step + 1, turn);
      workingState = wallRes.state;
      events.push(...wallRes.events);
      break;
    }

    const cell = getTileCell(grid, nx, ny);

    if (currentStratum === 'SPIRE' && cell?.terrainType === 'ABYSS_DROP') {
      const fallRes = handleAbyssGravityFall(workingState, targetId, nx, ny, turn);
      workingState = fallRes.state;
      events.push(...fallRes.events);
      distanceTraveled++;
      cx = nx;
      cy = ny;
      break;
    }

    if (cell?.terrainType === 'GLASS_WINDOW') {
      const winRes = handleWindowShatter(workingState, targetId, { x: nx, y: ny, stratum: currentStratum }, effectiveDistance - step + 1, turn);
      workingState = winRes.state;
      events.push(...winRes.events);
      cx = nx;
      cy = ny;
      distanceTraveled++;
      const currentActor = workingState.entities[targetId];
      if (currentActor?.position) {
        workingState = {
          ...workingState,
          entities: { ...workingState.entities, [targetId]: { ...currentActor, position: { ...currentActor.position, x: cx, y: cy } } },
        };
      }
      continue;
    }

    if (cell?.blocksMovement) {
      const wallRes = handleWallImpact(workingState, targetId, { x: nx, y: ny, stratum: currentStratum }, effectiveDistance - step + 1, turn);
      workingState = wallRes.state;
      events.push(...wallRes.events);
      break;
    }

    const blockingEntity = findBlockingEntityAtPoint(workingState.entities, { x: nx, y: ny, stratum: currentStratum }, targetId);
    if (blockingEntity) {
      const colRes = handleEntityCollision(workingState, targetId, blockingEntity.id, { x: nx, y: ny, stratum: currentStratum }, effectiveDistance - step + 1, turn);
      workingState = colRes.state;
      events.push(...colRes.events);
      break;
    }

    cx = nx;
    cy = ny;
    distanceTraveled++;
    const currentActor = workingState.entities[targetId];
    if (currentActor?.position) {
      workingState = {
        ...workingState,
        entities: { ...workingState.entities, [targetId]: { ...currentActor, position: { ...currentActor.position, x: cx, y: cy } } },
      };
    }
  }

  const finalActor = workingState.entities[targetId];
  const endPosition = finalActor?.position ?? { x: cx, y: cy, stratum: startPosition.stratum, blocksMovement: true, blocksSight: false };

  if (distanceTraveled > 0 || events.some((e) => e.type === 'MOMENTUM_COLLISION_IMPACT')) {
    events.unshift({
      type: 'ENTITY_KNOCKED_BACK',
      turn,
      entityId: targetId,
      startPosition,
      endPosition,
      distanceTraveled,
      ...(sourceEntityId ? { sourceEntityId } : {}),
    });
  }

  return { state: workingState, events, apSpent: 0 };
}
