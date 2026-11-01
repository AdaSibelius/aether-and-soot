import { EntityRecord } from '../../schemas/components.schema.js';
import { EntityId } from '../../schemas/primitives.schema.js';
import { STANDARD_ACTION_AP } from '../core/scheduler.js';
import { getShiftPhase, WorldState } from '../core/world.js';
import { resolveUseItem } from './inventory.system.js';
import { resolveMoveStep } from './movement.system.js';
import {
  NpcEcologyResult,
  restockAdjacentPedestal,
  simulateNpcSleepHealing,
  simulateNpcWorkProduction,
} from './npc-ecology-actions.js';
import { findEcologyNextStep } from './npc-pathfinding.js';

export type { NpcEcologyResult };
export { restockAdjacentPedestal, simulateNpcSleepHealing, simulateNpcWorkProduction };

function findNearestMedicalFixture(state: WorldState, actor: EntityRecord): EntityRecord | undefined {
  if (!actor.position) return undefined;
  let nearest: EntityRecord | undefined;
  let minDist = Infinity;
  for (const e of Object.values(state.entities)) {
    if (e.id === actor.id || !e.position || e.position.stratum !== actor.position.stratum) continue;
    const isMedical = e.aiController?.role === 'CHIRURGEON' || e.furniture?.kind === 'SURGICAL_TABLE';
    if (!isMedical) continue;
    const dist = Math.max(Math.abs(e.position.x - actor.position.x), Math.abs(e.position.y - actor.position.y));
    if (dist < minDist) {
      minDist = dist;
      nearest = e;
    }
  }
  return nearest;
}

export function resolveNpcEcologyAction(state: WorldState, actorId: EntityId): NpcEcologyResult {
  const actor = state.entities[actorId];
  if (!actor?.actor || actor.actor.isPlayer || !actor.position) {
    return { state, events: [], apSpent: 0, handled: false };
  }

  if (actor.anatomy && actor.anatomy.bloodVolumePct <= 60 && actor.inventory) {
    const tonicId = actor.inventory.containedEntityIds.find((id) => {
      const it = state.entities[id];
      return it?.item?.useEffect?.kind === 'RESTORE_BLOOD';
    });
    if (tonicId) {
      const useRes = resolveUseItem(state, actor.id, tonicId);
      return { state: useRes.state, events: useRes.events, apSpent: useRes.apSpent, handled: true };
    }
  }

  if (actor.anatomy && actor.anatomy.bloodVolumePct <= 50) {
    const medTarget = findNearestMedicalFixture(state, actor);
    let workingState = state;
    if (actor.schedule && actor.schedule.currentGoal !== 'SEEK_MEDICAL') {
      workingState = {
        ...state,
        entities: {
          ...state.entities,
          [actor.id]: { ...actor, schedule: { ...actor.schedule, currentGoal: 'SEEK_MEDICAL' } },
        },
      };
    }
    if (medTarget?.position) {
      const dist = Math.max(Math.abs(medTarget.position.x - actor.position.x), Math.abs(medTarget.position.y - actor.position.y));
      if (dist > 1) {
        const step = findEcologyNextStep(workingState, actor, medTarget.position);
        if (step) {
          const moveRes = resolveMoveStep(workingState, actor.id, step.dx, step.dy);
          return { state: moveRes.state, events: moveRes.events, apSpent: moveRes.apSpent, handled: true };
        }
      }
      return { state: workingState, events: [], apSpent: STANDARD_ACTION_AP, handled: true };
    }
  }

  if (!actor.schedule) {
    return { state, events: [], apSpent: 0, handled: false };
  }

  const shift = getShiftPhase(state.turnCount);
  const isGuard = actor.aiController?.role === 'GUARD';

  // 1. DAWN_WHISTLE (0–24): Commute to workAnchor; merchants open storefronts
  if (shift === 'DAWN_WHISTLE') {
    if (actor.aiController?.role === 'MERCHANT') {
      const restockRes = restockAdjacentPedestal(state, actor);
      if (restockRes) return restockRes;
    }

    const workAnchor = actor.schedule.workAnchor;
    const workingState = actor.schedule.currentGoal !== 'WORK'
      ? { ...state, entities: { ...state.entities, [actor.id]: { ...actor, schedule: { ...actor.schedule, currentGoal: 'WORK' as const } } } }
      : state;

    if (actor.position.stratum === workAnchor.stratum) {
      if (actor.position.x !== workAnchor.x || actor.position.y !== workAnchor.y) {
        const step = findEcologyNextStep(workingState, actor, workAnchor);
        if (step) {
          const moveRes = resolveMoveStep(workingState, actor.id, step.dx, step.dy);
          return { state: moveRes.state, events: moveRes.events, apSpent: moveRes.apSpent, handled: true };
        }
      }
      return { state: workingState, events: [], apSpent: STANDARD_ACTION_AP, handled: true };
    }
  }

  // 2. FOUNDRY_SHIFT (25–49): Active work simulation and pedestal restocking
  if (shift === 'FOUNDRY_SHIFT') {
    if (actor.aiController?.role === 'MERCHANT') {
      const restockRes = restockAdjacentPedestal(state, actor);
      if (restockRes) return restockRes;
    }

    const workAnchor = actor.schedule.workAnchor;
    const workingState = actor.schedule.currentGoal !== 'WORK'
      ? { ...state, entities: { ...state.entities, [actor.id]: { ...actor, schedule: { ...actor.schedule, currentGoal: 'WORK' as const } } } }
      : state;

    if (actor.position.stratum === workAnchor.stratum) {
      if (actor.position.x !== workAnchor.x || actor.position.y !== workAnchor.y) {
        const step = findEcologyNextStep(workingState, actor, workAnchor);
        if (step) {
          const moveRes = resolveMoveStep(workingState, actor.id, step.dx, step.dy);
          return { state: moveRes.state, events: moveRes.events, apSpent: moveRes.apSpent, handled: true };
        }
      } else {
        const prodState = simulateNpcWorkProduction(workingState, actor);
        return { state: prodState, events: [], apSpent: STANDARD_ACTION_AP, handled: true };
      }
      return { state: workingState, events: [], apSpent: STANDARD_ACTION_AP, handled: true };
    }
  }

  // 3. GASLIGHT_CURFEW (50–74): Non-guards return home; guards initiate curfew patrols
  if (shift === 'GASLIGHT_CURFEW') {
    if (isGuard) {
      const workingState = actor.schedule.currentGoal !== 'PATROL'
        ? { ...state, entities: { ...state.entities, [actor.id]: { ...actor, schedule: { ...actor.schedule, currentGoal: 'PATROL' as const } } } }
        : state;

      const waypoints = actor.schedule.patrolWaypoints;
      const targetPos = (waypoints && waypoints.length > 0) ? waypoints[0]! : actor.schedule.workAnchor;

      if (actor.position.stratum === targetPos.stratum) {
        if (actor.position.x !== targetPos.x || actor.position.y !== targetPos.y) {
          const step = findEcologyNextStep(workingState, actor, targetPos);
          if (step) {
            const moveRes = resolveMoveStep(workingState, actor.id, step.dx, step.dy);
            return { state: moveRes.state, events: moveRes.events, apSpent: moveRes.apSpent, handled: true };
          }
        }
        return { state: workingState, events: [], apSpent: STANDARD_ACTION_AP, handled: true };
      }
    } else {
      const restAnchor = actor.schedule.restAnchor;
      const workingState = actor.schedule.currentGoal !== 'REST'
        ? { ...state, entities: { ...state.entities, [actor.id]: { ...actor, schedule: { ...actor.schedule, currentGoal: 'REST' as const } } } }
        : state;

      if (actor.position.stratum === restAnchor.stratum) {
        if (actor.position.x !== restAnchor.x || actor.position.y !== restAnchor.y) {
          const step = findEcologyNextStep(workingState, actor, restAnchor);
          if (step) {
            const moveRes = resolveMoveStep(workingState, actor.id, step.dx, step.dy);
            return { state: moveRes.state, events: moveRes.events, apSpent: moveRes.apSpent, handled: true };
          }
        }
        return { state: workingState, events: [], apSpent: STANDARD_ACTION_AP, handled: true };
      }
    }
  }

  // 4. GRAVEYARD_WATCH (75–99): Non-guards sleep & heal at restAnchor; guards patrol
  if (shift === 'GRAVEYARD_WATCH') {
    if (!isGuard) {
      const restAnchor = actor.schedule.restAnchor;
      const workingState = actor.schedule.currentGoal !== 'REST'
        ? { ...state, entities: { ...state.entities, [actor.id]: { ...actor, schedule: { ...actor.schedule, currentGoal: 'REST' as const } } } }
        : state;

      if (actor.position.stratum === restAnchor.stratum) {
        if (actor.position.x !== restAnchor.x || actor.position.y !== restAnchor.y) {
          const step = findEcologyNextStep(workingState, actor, restAnchor);
          if (step) {
            const moveRes = resolveMoveStep(workingState, actor.id, step.dx, step.dy);
            return { state: moveRes.state, events: moveRes.events, apSpent: moveRes.apSpent, handled: true };
          }
        } else {
          const healedState = simulateNpcSleepHealing(workingState, actor);
          return { state: healedState, events: [], apSpent: STANDARD_ACTION_AP, handled: true };
        }
        return { state: workingState, events: [], apSpent: STANDARD_ACTION_AP, handled: true };
      }
    } else {
      const workAnchor = actor.schedule.workAnchor;
      const workingState = actor.schedule.currentGoal !== 'PATROL'
        ? { ...state, entities: { ...state.entities, [actor.id]: { ...actor, schedule: { ...actor.schedule, currentGoal: 'PATROL' as const } } } }
        : state;

      if (actor.position.stratum === workAnchor.stratum) {
        if (actor.position.x !== workAnchor.x || actor.position.y !== workAnchor.y) {
          const step = findEcologyNextStep(workingState, actor, workAnchor);
          if (step) {
            const moveRes = resolveMoveStep(workingState, actor.id, step.dx, step.dy);
            return { state: moveRes.state, events: moveRes.events, apSpent: moveRes.apSpent, handled: true };
          }
        }
        return { state: workingState, events: [], apSpent: STANDARD_ACTION_AP, handled: true };
      }
    }
  }

  return { state, events: [], apSpent: 0, handled: false };
}
