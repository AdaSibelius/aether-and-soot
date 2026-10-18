import { GameCommand, GameCommandSchema } from '../../schemas/commands.schema.js';
import { SimEvent } from '../../schemas/events.schema.js';
import { setTileCell } from '../spatial/grid.js';
import { resolveMoveStep, resolveUsePortal } from '../systems/movement.system.js';
import { SeededRNG } from './rng.js';
import { advanceTurnSchedule, STANDARD_ACTION_AP } from './scheduler.js';
import { WorldState } from './world.js';

export interface DispatchTurnResult {
  readonly state: WorldState;
  readonly events: readonly SimEvent[];
}

/**
 * Pure simulation command dispatcher.
 * Validates incoming command, executes domain system, updates RNG state, and advances turn clock.
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
      const res = resolveMoveStep(nextState, command.actorId, command.dx, command.dy);
      nextState = res.state;
      systemEvents = res.events;
      apSpent = res.apSpent;
      break;
    }
    case 'USE_PORTAL': {
      const res = resolveUsePortal(nextState, command.actorId);
      nextState = res.state;
      systemEvents = res.events;
      apSpent = res.apSpent;
      break;
    }
    case 'WAIT_TURN': {
      // Advance PRNG once on wait to maintain deterministic entropy progression
      rng.nextUint32();
      systemEvents = [
        {
          type: 'ACTOR_WAITED',
          turn: nextState.turnCount + 1,
          actorId: command.actorId,
          apSpent: STANDARD_ACTION_AP,
        },
      ];
      break;
    }
    case 'VENT_STEAM': {
      const targetStratum = nextState.strata[command.target.stratum];
      if (targetStratum) {
        const updatedGrid = setTileCell(
          targetStratum,
          command.target.x,
          command.target.y,
          (cell) => ({
            ...cell,
            steamPressureKpa: cell.steamPressureKpa + command.pressureReleasedKpa,
          }),
        );
        nextState = {
          ...nextState,
          strata: {
            ...nextState.strata,
            [command.target.stratum]: updatedGrid,
          },
        };
      }
      systemEvents = [
        {
          type: 'STEAM_VENTED',
          turn: nextState.turnCount + 1,
          actorId: command.actorId,
          origin: command.target,
          pressureReleasedKpa: command.pressureReleasedKpa,
        },
      ];
      break;
    }
  }

  const stateWithRng: WorldState = {
    ...nextState,
    rngState: rng.getState(),
  };

  const scheduled = advanceTurnSchedule(stateWithRng, command.actorId, apSpent, systemEvents);
  return {
    state: scheduled.state,
    events: scheduled.allEvents,
  };
}
