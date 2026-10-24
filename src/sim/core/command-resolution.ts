import { SimEvent } from '../../schemas/events.schema.js';
import { STANDARD_ACTION_AP } from './scheduler.js';
import { WorldState } from './world.js';

export type CommandResolution =
  | {
      readonly status: 'applied';
      readonly state: WorldState;
      readonly events: readonly SimEvent[];
      readonly apSpent: number;
      readonly advancesTime: boolean;
      readonly simulationTicks?: number;
    }
  | {
      readonly status: 'rejected';
      readonly state: WorldState;
      readonly events: readonly SimEvent[];
      readonly reason: string;
    };

export interface SystemOutcomeLike {
  readonly state: WorldState;
  readonly events: readonly SimEvent[];
  readonly apSpent?: number;
  readonly advancesTime?: boolean;
  readonly simulationTicks?: number;
}

/**
 * Checks whether an event represents a domain failure or blockage.
 */
export function isFailureEvent(event: SimEvent): boolean {
  return (
    event.type.endsWith('_FAILED') ||
    event.type.endsWith('_BLOCKED') ||
    event.type === 'MOVEMENT_BLOCKED' ||
    event.type === 'PORTAL_FAILED'
  );
}

/**
 * Extracts a human-readable failure reason from emitted events, if available.
 */
export function extractFailureReason(
  events: readonly SimEvent[],
  fallback = 'Action rejected or physically blocked',
): string {
  for (const ev of events) {
    if ('reason' in ev && typeof (ev as { reason?: unknown }).reason === 'string') {
      return (ev as { reason: string }).reason;
    }
  }
  return fallback;
}

/**
 * Creates an applied command resolution.
 */
export function createAppliedResolution(
  state: WorldState,
  events: readonly SimEvent[],
  apSpent: number,
  advancesTime = apSpent > 0,
  simulationTicks?: number,
): CommandResolution {
  return {
    status: 'applied',
    state,
    events,
    apSpent,
    advancesTime,
    simulationTicks: simulationTicks ?? (advancesTime ? 1 : 0),
  };
}

/**
 * Creates a rejected command resolution.
 */
export function createRejectedResolution(
  state: WorldState,
  reason: string,
  events: readonly SimEvent[] = [],
): CommandResolution {
  return {
    status: 'rejected',
    state,
    events,
    reason,
  };
}

/**
 * Adapts a system outcome into a standard CommandResolution.
 */
export function toCommandResolution(
  outcome: SystemOutcomeLike,
  defaultAp: number = STANDARD_ACTION_AP,
): CommandResolution {
  const ap = outcome.apSpent !== undefined ? outcome.apSpent : defaultAp;
  const hasFailure = outcome.events.some(isFailureEvent);

  if (ap === 0 && outcome.advancesTime !== false && (hasFailure || outcome.events.length === 0)) {
    return {
      status: 'rejected',
      state: outcome.state,
      events: outcome.events,
      reason: extractFailureReason(outcome.events, 'Action rejected or physically blocked'),
    };
  }

  const advancesTime = outcome.advancesTime !== undefined ? outcome.advancesTime : ap > 0;
  const simulationTicks =
    outcome.simulationTicks !== undefined
      ? outcome.simulationTicks
      : advancesTime
        ? 1
        : 0;

  return {
    status: 'applied',
    state: outcome.state,
    events: outcome.events,
    apSpent: ap,
    advancesTime,
    simulationTicks,
  };
}
