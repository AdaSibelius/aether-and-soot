import { EntityRecord } from '../../schemas/components.schema.js';
import { SimEvent } from '../../schemas/events.schema.js';
import { EntityId } from '../../schemas/primitives.schema.js';
import { advanceDistrictEconomyMacroTick } from '../systems/economy.system.js';
import { advanceMetabolismTick } from '../systems/metabolism.system.js';
import { SeededRNG } from './rng.js';
import { WorldState } from './world.js';

export const STANDARD_ACTION_AP = 100;
export const MACRO_TICK_INTERVAL = 100;

/**
 * Deducts Action Points from the acting entity, advances the global turn counter,
 * and triggers the District Economy Macro-Tick every 100 turns.
 */
export function advanceTurnSchedule(
  state: WorldState,
  actorId: EntityId,
  apSpent: number,
  newEvents: readonly SimEvent[],
  rng: SeededRNG,
): { state: WorldState; allEvents: SimEvent[] } {
  const metaRes = advanceMetabolismTick(state);
  const updatedEntities: Record<string, EntityRecord> = { ...metaRes.state.entities };
  const actorRecord = updatedEntities[actorId];

  if (actorRecord?.actor) {
    updatedEntities[actorId] = {
      ...actorRecord,
      actor: {
        ...actorRecord.actor,
        energy: actorRecord.actor.energy - apSpent + actorRecord.actor.speed,
      },
    };
  }

  const nextTurn = state.turnCount + 1;
  let nextMacroTick = state.macroTickCount;
  let nextEconomy = state.economy;
  const combinedEvents: SimEvent[] = [...newEvents, ...metaRes.events];

  if (nextTurn % MACRO_TICK_INTERVAL === 0) {
    nextMacroTick += 1;
    const econRes = advanceDistrictEconomyMacroTick(state, rng, nextTurn);
    nextEconomy = econRes.economy;
    combinedEvents.push(...econRes.events);
    combinedEvents.push({
      type: 'MACRO_TICK_COMPLETED',
      turn: nextTurn,
      macroTickIndex: nextMacroTick,
    });
  }

  return {
    state: {
      ...state,
      rngState: rng.getState(),
      turnCount: nextTurn,
      macroTickCount: nextMacroTick,
      entities: updatedEntities,
      economy: nextEconomy,
      eventLog: [...state.eventLog, ...combinedEvents],
    },
    allEvents: combinedEvents,
  };
}
