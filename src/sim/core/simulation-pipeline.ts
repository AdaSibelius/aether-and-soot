import { SimEvent } from '../../schemas/events.schema.js';
import { EntityId } from '../../schemas/primitives.schema.js';
import { computeVisibleTiles } from '../spatial/fov.js';
import { markExploredTiles } from '../spatial/grid.js';
import { advanceNpcTurns } from '../systems/ai.system.js';
import { computeProstheticFovBonus } from '../systems/anatomy.system.js';
import { advanceEnvironmentalHazards } from '../systems/environmental-hazards.system.js';
import { decrementProstheticCooldowns } from '../systems/prosthetics.system.js';
import { advanceThermodynamicsTick } from '../systems/thermo.system.js';
import { CommandResolution } from './command-resolution.js';
import { SeededRNG } from './rng.js';
import { advanceTurnSchedule } from './scheduler.js';
import { WorldState } from './world.js';

export interface DispatchTurnResult {
  readonly state: WorldState;
  readonly events: readonly SimEvent[];
  readonly resolution: CommandResolution;
}

/**
 * Phase 1: Advances environmental double-buffered cellular automata (thermodynamics)
 * and autonomous NPC AI turns for designated simulation ticks.
 */
export function advanceWorldEnvironment(
  state: WorldState,
  rng: SeededRNG,
  ticks = 1,
): { state: WorldState; events: SimEvent[] } {
  let workingState = state;
  const events: SimEvent[] = [];

  for (let t = 0; t < ticks; t++) {
    const npcTick = advanceNpcTurns(workingState, rng);
    workingState = npcTick.state;
    events.push(...npcTick.events);

    const thermoTick = advanceThermodynamicsTick(workingState);
    workingState = thermoTick.state;
    events.push(...thermoTick.events);

    const activeStratum = workingState.entities['actor_player' as EntityId]?.position?.stratum ?? 'STREET';
    const hazardTick = advanceEnvironmentalHazards(workingState, activeStratum);
    workingState = hazardTick.state;
    events.push(...hazardTick.events);
  }

  return { state: workingState, events };
}

/**
 * Phase 2: Decrements active prosthetic cooldowns, deducts action points,
 * recovers initiative energy, advances the turn schedule and economy macro-tick.
 */
export function advanceTemporalState(
  state: WorldState,
  actorId: EntityId,
  apSpent: number,
  events: readonly SimEvent[],
  rng: SeededRNG,
  ticks = 1,
): { state: WorldState; events: SimEvent[] } {
  let workingState = state;
  if (ticks > 0) {
    workingState = decrementProstheticCooldowns(workingState, actorId);
  }
  const scheduled = advanceTurnSchedule(workingState, actorId, apSpent, events, rng, ticks);
  return { state: scheduled.state, events: scheduled.allEvents };
}

/**
 * Phase 3: Computes player sensory field-of-view (shadowcasting + cybernetic bonuses)
 * and marks visible tiles as explored on the current stratum.
 */
export function advancePerception(
  state: WorldState,
  focusActorId: EntityId = 'actor_player' as EntityId,
): WorldState {
  const player = state.entities[focusActorId];
  if (!player?.position) return state;

  const pStratum = player.position.stratum;
  const grid = state.strata[pStratum];
  if (!grid) return state;

  const bonus = computeProstheticFovBonus(state, player) + (player.traits?.includes('NIGHT_OPTICS') ? 2 : 0);
  const visible = computeVisibleTiles(grid, player.position.x, player.position.y, Math.max(2, 10 + bonus));
  const updatedGrid = markExploredTiles(grid, visible);

  return {
    ...state,
    strata: {
      ...state.strata,
      [pStratum]: updatedGrid,
    },
  };
}

/**
 * Master simulation phase orchestrator.
 * Sequences action resolution into Environmental, Temporal, and Perception phases.
 */
export function executeSimulationPhases(
  resolution: CommandResolution,
  actingActorId: EntityId,
  rng: SeededRNG,
): DispatchTurnResult {
  if (resolution.status === 'rejected') {
    return { state: resolution.state, events: resolution.events, resolution };
  }

  const apSpent = resolution.apSpent;
  let nextState = resolution.state;
  let systemEvents = [...resolution.events];

  // If action is non-advancing (e.g. zero-time inspection, swift stance, physics impulse)
  if (!resolution.advancesTime) {
    if (apSpent > 0) {
      const temporal = advanceTemporalState(nextState, actingActorId, apSpent, systemEvents, rng, 0);
      nextState = temporal.state;
      systemEvents = temporal.events;
    }
    const finalState = advancePerception(nextState);
    return { state: finalState, events: systemEvents, resolution };
  }

  const simulationTicks = resolution.simulationTicks ?? 1;

  // Phase 1: Environment & NPC AI Phase
  const env = advanceWorldEnvironment(nextState, rng, simulationTicks);
  nextState = env.state;
  systemEvents = [...systemEvents, ...env.events];

  // Phase 2: Temporal, Initiative & Schedule Phase
  const temporal = advanceTemporalState(nextState, actingActorId, apSpent, systemEvents, rng, simulationTicks);
  nextState = temporal.state;
  systemEvents = temporal.events;

  // Phase 3: Perception & Exploration Phase
  const finalState = advancePerception(nextState);

  return { state: finalState, events: systemEvents, resolution };
}
