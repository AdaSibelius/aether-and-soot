import { GameCommand, GameCommandSchema } from '../../schemas/commands.schema.js';
import { SimEvent } from '../../schemas/events.schema.js';
import { markExploredTiles } from '../spatial/grid.js';
import { computeVisibleTiles } from '../spatial/fov.js';
import { advanceNpcTurns } from '../systems/ai.system.js';
import { computeProstheticFovBonus } from '../systems/anatomy.system.js';
import { resolveMoveStep, resolveUsePortal } from '../systems/movement.system.js';
import { advanceThermodynamicsTick } from '../systems/thermo.system.js';
import { decrementProstheticCooldowns } from '../systems/prosthetics.system.js';
import { processActorTurfMovement, recordTacticalCoverManeuver } from '../systems/skirmish-turf.system.js';
import { routeDomainCommand } from './command-router.js';
import { SeededRNG } from './rng.js';
import { advanceTurnSchedule, STANDARD_ACTION_AP } from './scheduler.js';
import { WorldState } from './world.js';

export interface DispatchTurnResult {
  readonly state: WorldState;
  readonly events: readonly SimEvent[];
}

/**
 * Pure simulation command dispatcher.
 * Validates incoming command, executes domain system, ticks autonomous NPCs and
 * environmental thermodynamics, updates RNG state, and advances the turn clock.
 */
export function dispatchCommand(
  currentState: WorldState,
  rawCommand: GameCommand,
): DispatchTurnResult {
  const command = GameCommandSchema.parse(rawCommand);
  const rng = new SeededRNG(currentState.rngState);

  let nextState = currentState;
  let systemEvents: SimEvent[] = [];
  let apSpent = STANDARD_ACTION_AP;

  switch (command.type) {
    case 'MOVE_STEP': {
      const oldActor = nextState.entities[command.actorId];
      const oldPos = oldActor?.position ? { ...oldActor.position } : undefined;
      const res = resolveMoveStep(nextState, command.actorId, command.dx, command.dy);
      nextState = res.state;
      systemEvents = res.events;
      apSpent = res.apSpent;
      const newActor = nextState.entities[command.actorId];
      if (oldPos && newActor?.position) {
        const turfMove = processActorTurfMovement(nextState, command.actorId, oldPos, newActor.position);
        nextState = turfMove.state;
        systemEvents = [...systemEvents, ...turfMove.events];
      }
      break;
    }
    case 'USE_PORTAL': {
      const pActor = nextState.entities[command.actorId];
      const fromStratum = pActor?.position?.stratum;
      const res = resolveUsePortal(nextState, command.actorId);
      nextState = res.state;
      systemEvents = res.events;
      apSpent = res.apSpent;
      const toStratum = nextState.entities[command.actorId]?.position?.stratum;
      const portalManeuver = recordTacticalCoverManeuver(nextState, command.actorId, 'PORTAL_TACTICAL_ESCAPE', `${fromStratum} -> ${toStratum}`);
      nextState = portalManeuver.state;
      systemEvents = [...systemEvents, ...portalManeuver.events];
      break;
    }
    case 'WAIT_TURN': {
      rng.nextUint32();
      const wActor = nextState.entities[command.actorId];
      if (wActor?.anatomy && wActor.traits?.includes('BOILER_HEART')) {
        const nextSteam = Math.min(wActor.anatomy.maxSteamReserveKpa, wActor.anatomy.steamReserveKpa + 5);
        nextState = { ...nextState, entities: { ...nextState.entities, [command.actorId]: { ...wActor, anatomy: { ...wActor.anatomy, steamReserveKpa: nextSteam } } } };
      }
      systemEvents = [{ type: 'ACTOR_WAITED', turn: nextState.turnCount + 1, actorId: command.actorId, apSpent: STANDARD_ACTION_AP }];
      break;
    }
    default: {
      const domainRes = routeDomainCommand(nextState, command, rng);
      if (domainRes.handled) {
        nextState = domainRes.state;
        systemEvents = [...domainRes.events];
        if (domainRes.apSpent !== undefined) apSpent = domainRes.apSpent;
      }
      break;
    }
  }

  const npcTick = advanceNpcTurns(nextState, rng);
  nextState = npcTick.state;
  systemEvents = [...systemEvents, ...npcTick.events];

  const thermoTick = advanceThermodynamicsTick(nextState);
  nextState = thermoTick.state;
  systemEvents = [...systemEvents, ...thermoTick.events];

  const actingActorId =
    command.type === 'ATTACK_ACTOR'
      ? command.attackerId
      : command.type === 'APPLY_MOMENTUM_VECTOR'
        ? (command.sourceEntityId ?? command.targetId)
        : command.type === 'REPORT_CRIME'
          ? command.witnessId
          : command.actorId;
  nextState = decrementProstheticCooldowns(nextState, actingActorId);
  const scheduled = advanceTurnSchedule(nextState, actingActorId, apSpent, systemEvents, rng);

  let finalState = scheduled.state;
  const player = scheduled.state.entities['actor_player'];
  if (player?.position) {
    const pStratum = player.position.stratum;
    const grid = scheduled.state.strata[pStratum];
    if (grid) {
      const bonus = computeProstheticFovBonus(scheduled.state, player) + (player.traits?.includes('NIGHT_OPTICS') ? 2 : 0);
      const visible = computeVisibleTiles(grid, player.position.x, player.position.y, Math.max(2, 10 + bonus));
      const updatedGrid = markExploredTiles(grid, visible);
      finalState = { ...scheduled.state, strata: { ...scheduled.state.strata, [pStratum]: updatedGrid } };
    }
  }

  return { state: finalState, events: scheduled.allEvents };
}
