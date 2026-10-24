import { GameCommand } from '../../schemas/commands.schema.js';
import { EntityId } from '../../schemas/primitives.schema.js';
import { CommandResolution } from './command-resolution.js';
import { routeDomainCommand } from './command-router.js';
import { SeededRNG } from './rng.js';
import {
  resolveMoveStepAction,
  resolveUsePortalAction,
  resolveWaitTurnAction,
} from './spatial-actions.js';
import { WorldState } from './world.js';

/**
 * Extracts the primary acting entity ID responsible for initiative deduction
 * and cooldown progression.
 */
export function getActingActorId(command: GameCommand): EntityId {
  if (command.type === 'ATTACK_ACTOR') return command.attackerId;
  if (command.type === 'APPLY_MOMENTUM_VECTOR') return command.sourceEntityId ?? command.targetId;
  if (command.type === 'REPORT_CRIME') return command.witnessId;
  return command.actorId;
}

/**
 * Unified action resolution entry point.
 * Dispatches spatial commands (MOVE_STEP, USE_PORTAL, WAIT_TURN) and domain commands
 * through an identical CommandResolution contract without engine-level inline branching.
 */
export function resolveAction(
  state: WorldState,
  command: GameCommand,
  rng: SeededRNG,
): CommandResolution {
  switch (command.type) {
    case 'MOVE_STEP':
      return resolveMoveStepAction(state, command);
    case 'USE_PORTAL':
      return resolveUsePortalAction(state, command);
    case 'WAIT_TURN':
      return resolveWaitTurnAction(state, command, rng);
    default:
      return routeDomainCommand(state, command, rng);
  }
}

export { routeDomainCommand };
