import { GameCommand, GameCommandSchema } from '../../schemas/commands.schema.js';
import { getActingActorId, resolveAction } from './action-resolver.js';
import { SeededRNG } from './rng.js';
import { DispatchTurnResult, executeSimulationPhases } from './simulation-pipeline.js';
import { WorldState } from './world.js';

export type { DispatchTurnResult };

/**
 * Pure simulation command dispatcher.
 * Validates incoming command, resolves action semantics, and executes simulation phases.
 */
export function dispatchCommand(
  currentState: WorldState,
  rawCommand: GameCommand,
): DispatchTurnResult {
  const command = GameCommandSchema.parse(rawCommand);
  const rng = new SeededRNG(currentState.rngState);
  const resolution = resolveAction(currentState, command, rng);
  const actingActorId = getActingActorId(command);

  return executeSimulationPhases(resolution, actingActorId, rng);
}
