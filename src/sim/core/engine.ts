import { GameCommand, GameCommandSchema } from '../../schemas/commands.schema.js';
import { SimEvent } from '../../schemas/events.schema.js';
import { markExploredTiles } from '../spatial/grid.js';
import { computeVisibleTiles } from '../spatial/fov.js';
import { advanceNpcTurns } from '../systems/ai.system.js';
import { computeProstheticFovBonus } from '../systems/anatomy.system.js';
import { advanceThermodynamicsTick } from '../systems/thermo.system.js';
import { decrementProstheticCooldowns } from '../systems/prosthetics.system.js';
import { getActingActorId, resolveAction } from './action-resolver.js';
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
 * Pure simulation command dispatcher.
 * Validates incoming command, executes action resolver, ticks autonomous NPCs and
 * environmental thermodynamics, updates RNG state, and advances the turn clock.
 */
export function dispatchCommand(
  currentState: WorldState,
  rawCommand: GameCommand,
): DispatchTurnResult {
  const command = GameCommandSchema.parse(rawCommand);
  const rng = new SeededRNG(currentState.rngState);

  const resolution = resolveAction(currentState, command, rng);

  // If command was rejected or physically impossible,
  // bypass NPC turns, thermodynamics, and turn scheduling so the world clock pauses.
  if (resolution.status === 'rejected') {
    return { state: resolution.state, events: resolution.events, resolution };
  }

  const actingActorId = getActingActorId(command);
  const apSpent = resolution.apSpent;
  let nextState = resolution.state;
  let systemEvents: SimEvent[] = [...resolution.events];

  // If command was applied but does not advance world time (e.g. zero-time inspection, swift action, impulse),
  // bypass NPC turns, thermodynamics, and world clock advancement.
  if (!resolution.advancesTime) {
    if (apSpent > 0) {
      const scheduled = advanceTurnSchedule(nextState, actingActorId, apSpent, systemEvents, rng, 0);
      nextState = scheduled.state;
      systemEvents = [...scheduled.allEvents];
    }
    let finalState = nextState;
    const player = nextState.entities['actor_player'];
    if (player?.position) {
      const pStratum = player.position.stratum;
      const grid = nextState.strata[pStratum];
      if (grid) {
        const bonus = computeProstheticFovBonus(nextState, player) + (player.traits?.includes('NIGHT_OPTICS') ? 2 : 0);
        const visible = computeVisibleTiles(grid, player.position.x, player.position.y, Math.max(2, 10 + bonus));
        const updatedGrid = markExploredTiles(grid, visible);
        finalState = { ...nextState, strata: { ...nextState.strata, [pStratum]: updatedGrid } };
      }
    }
    return { state: finalState, events: systemEvents, resolution };
  }

  const simulationTicks = resolution.simulationTicks ?? 1;

  for (let t = 0; t < simulationTicks; t++) {
    const npcTick = advanceNpcTurns(nextState, rng);
    nextState = npcTick.state;
    systemEvents = [...systemEvents, ...npcTick.events];

    const thermoTick = advanceThermodynamicsTick(nextState);
    nextState = thermoTick.state;
    systemEvents = [...systemEvents, ...thermoTick.events];
  }

  nextState = decrementProstheticCooldowns(nextState, actingActorId);
  const scheduled = advanceTurnSchedule(nextState, actingActorId, apSpent, systemEvents, rng, simulationTicks);

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

  return { state: finalState, events: scheduled.allEvents, resolution };
}
