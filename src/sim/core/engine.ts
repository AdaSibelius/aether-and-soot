import { GameCommand, GameCommandSchema } from '../../schemas/commands.schema.js';
import { getActingActorId, resolveAction } from './action-resolver.js';
import { assertWorldInvariants } from './invariants.js';
import { SeededRNG } from './rng.js';
import { DispatchTurnResult, executeSimulationPhases } from './simulation-pipeline.js';
import { WorldState } from './world.js';

export type { DispatchTurnResult };

export interface DispatchCommandOptions {
  /**
   * Explicitly toggle relational invariant assertions.
   * If omitted, defaults to true in non-production environments (process.env.NODE_ENV !== 'production').
   */
  readonly enableInvariantAssertions?: boolean;
}

let invariantAssertionsEnabled =
  typeof process !== 'undefined' && process.env?.NODE_ENV !== 'production';

/**
 * Configure global invariant assertion behavior in development/test runs.
 */
export function setInvariantAssertionsEnabled(enabled: boolean): void {
  invariantAssertionsEnabled = enabled;
}

/**
 * Inspect whether invariant assertions are globally active.
 */
export function isInvariantAssertionsEnabled(): boolean {
  return invariantAssertionsEnabled;
}

/**
 * Pure simulation command dispatcher.
 * Validates incoming command, resolves action semantics, and executes simulation phases.
 * In development/test environments, asserts world relational invariants on resulting state.
 */
export function dispatchCommand(
  currentState: WorldState,
  rawCommand: GameCommand,
  options?: DispatchCommandOptions,
): DispatchTurnResult {
  const command = GameCommandSchema.parse(rawCommand);
  const rng = new SeededRNG(currentState.rngState);
  const resolution = resolveAction(currentState, command, rng);
  const actingActorId = getActingActorId(command);

  const result = executeSimulationPhases(resolution, actingActorId, rng);

  const shouldAssert = options?.enableInvariantAssertions ?? invariantAssertionsEnabled;
  if (shouldAssert && resolution.status === 'applied') {
    assertWorldInvariants(result.state);
  }

  return result;
}
