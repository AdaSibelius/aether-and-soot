import { EntityRecord } from '../../schemas/components.schema.js';
import { SimEvent } from '../../schemas/events.schema.js';
import { EntityId } from '../../schemas/primitives.schema.js';
import { WorldState } from './world.js';

export const STANDARD_ACTION_AP = 100;
export const MACRO_TICK_INTERVAL = 100;

/**
 * Deducts Action Points from the acting entity and advances the global turn and macro-tick counters.
 */
export function advanceTurnSchedule(
  state: WorldState,
  actorId: EntityId,
  apSpent: number,
  newEvents: readonly SimEvent[],
): { state: WorldState; allEvents: SimEvent[] } {
  const actorRecord = state.entities[actorId];
  const updatedEntities: Record<string, EntityRecord> = { ...state.entities };

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
  const combinedEvents: SimEvent[] = [...newEvents];

  if (nextTurn % MACRO_TICK_INTERVAL === 0) {
    nextMacroTick += 1;
    combinedEvents.push({
      type: 'MACRO_TICK_COMPLETED',
      turn: nextTurn,
      macroTickIndex: nextMacroTick,
    });
  }

  return {
    state: {
      ...state,
      turnCount: nextTurn,
      macroTickCount: nextMacroTick,
      entities: updatedEntities,
      eventLog: [...state.eventLog, ...combinedEvents],
    },
    allEvents: combinedEvents,
  };
}
