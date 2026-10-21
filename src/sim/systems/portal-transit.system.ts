import { EntityRecord } from '../../schemas/components.schema.js';
import { SimEvent } from '../../schemas/events.schema.js';
import { EntityId } from '../../schemas/primitives.schema.js';
import { STANDARD_ACTION_AP } from '../core/scheduler.js';
import { WorldState } from '../core/world.js';
import { findBlockingEntityAtPoint } from '../spatial/grid.js';
import { findPortalAtPoint } from '../spatial/portals.js';
import { resolveTravelDistrict } from './transit.system.js';

export interface SystemMovementResult {
  readonly state: WorldState;
  readonly events: SimEvent[];
  readonly apSpent: number;
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
      state,
      apSpent: STANDARD_ACTION_AP,
      events: [{ type: 'PORTAL_FAILED', turn: state.turnCount + 1, actorId, reason: 'NO_PORTAL_AT_POSITION' }],
    };
  }

  const dest = portalEntity.portal.target;
  const blocker = findBlockingEntityAtPoint(state.entities, dest, actorId);
  if (blocker) {
    return {
      state,
      apSpent: STANDARD_ACTION_AP,
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
