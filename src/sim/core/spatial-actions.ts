import { GameCommand } from '../../schemas/commands.schema.js';
import { SimEvent } from '../../schemas/events.schema.js';

export type MoveStepCommand = Extract<GameCommand, { type: 'MOVE_STEP' }>;
export type UsePortalCommand = Extract<GameCommand, { type: 'USE_PORTAL' }>;
export type WaitTurnCommand = Extract<GameCommand, { type: 'WAIT_TURN' }>;
import { resolveMoveStep, resolveUsePortal } from '../systems/movement.system.js';
import { processActorTurfMovement, recordTacticalCoverManeuver } from '../systems/skirmish-turf.system.js';
import {
  CommandResolution,
  createAppliedResolution,
  createRejectedResolution,
  extractFailureReason,
} from './command-resolution.js';
import { SeededRNG } from './rng.js';
import { STANDARD_ACTION_AP } from './scheduler.js';
import { WorldState } from './world.js';

/**
 * Resolves a directional movement step command, executing turf maneuvers
 * if movement was unobstructed.
 */
export function resolveMoveStepAction(
  state: WorldState,
  command: MoveStepCommand,
): CommandResolution {
  const oldActor = state.entities[command.actorId];
  const oldPos = oldActor?.position ? { ...oldActor.position } : undefined;
  const res = resolveMoveStep(state, command.actorId, command.dx, command.dy);
  let nextState = res.state;
  let systemEvents: SimEvent[] = [...res.events];
  const apSpent = res.apSpent;

  const newActor = nextState.entities[command.actorId];
  if (oldPos && newActor?.position && apSpent > 0) {
    const turfMove = processActorTurfMovement(nextState, command.actorId, oldPos, newActor.position);
    nextState = turfMove.state;
    systemEvents = [...systemEvents, ...turfMove.events];
  }

  return apSpent > 0
    ? createAppliedResolution(nextState, systemEvents, apSpent)
    : createRejectedResolution(
        state,
        extractFailureReason(systemEvents, 'Movement blocked or invalid'),
        systemEvents,
      );
}

/**
 * Resolves vertical stratum portal transit, logging tactical escape maneuvers
 * on successful transit.
 */
export function resolveUsePortalAction(
  state: WorldState,
  command: UsePortalCommand,
): CommandResolution {
  const pActor = state.entities[command.actorId];
  const fromStratum = pActor?.position?.stratum;
  const res = resolveUsePortal(state, command.actorId);
  let nextState = res.state;
  let systemEvents: SimEvent[] = [...res.events];
  const apSpent = res.apSpent;

  if (apSpent > 0) {
    const toStratum = nextState.entities[command.actorId]?.position?.stratum;
    const portalManeuver = recordTacticalCoverManeuver(
      nextState,
      command.actorId,
      'PORTAL_TACTICAL_ESCAPE',
      `${fromStratum} -> ${toStratum}`,
    );
    nextState = portalManeuver.state;
    systemEvents = [...systemEvents, ...portalManeuver.events];
  }

  return apSpent > 0
    ? createAppliedResolution(nextState, systemEvents, apSpent)
    : createRejectedResolution(
        state,
        extractFailureReason(systemEvents, 'Portal transition failed'),
        systemEvents,
      );
}

/**
 * Resolves waiting a turn in place, drawing a PRNG tick and applying
 * passive traits such as BOILER_HEART steam reserve regeneration.
 */
export function resolveWaitTurnAction(
  state: WorldState,
  command: WaitTurnCommand,
  rng: SeededRNG,
): CommandResolution {
  rng.nextUint32();
  let nextState = state;
  const wActor = state.entities[command.actorId];

  if (wActor?.anatomy && wActor.traits?.includes('BOILER_HEART')) {
    const nextSteam = Math.min(wActor.anatomy.maxSteamReserveKpa, wActor.anatomy.steamReserveKpa + 5);
    nextState = {
      ...nextState,
      entities: {
        ...nextState.entities,
        [command.actorId]: {
          ...wActor,
          anatomy: { ...wActor.anatomy, steamReserveKpa: nextSteam },
        },
      },
    };
  }

  const systemEvents: SimEvent[] = [
    {
      type: 'ACTOR_WAITED',
      turn: nextState.turnCount + 1,
      actorId: command.actorId,
      apSpent: STANDARD_ACTION_AP,
    },
  ];

  return createAppliedResolution(nextState, systemEvents, STANDARD_ACTION_AP);
}
