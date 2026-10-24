import { EntityRecord } from '../../schemas/components.schema.js';
import { SimEvent } from '../../schemas/events.schema.js';
import { EntityId } from '../../schemas/primitives.schema.js';
import { advanceDistrictEconomyMacroTick } from '../systems/economy.system.js';
import { advanceMetabolismTick } from '../systems/metabolism.system.js';
import { SeededRNG } from './rng.js';
import { WorldState } from './world.js';

export const STANDARD_ACTION_AP = 100;
export const MACRO_TICK_INTERVAL = 100;
export const MAX_PERSISTENT_EVENT_LOG = 250;

/**
 * Deducts Action Points from the acting entity, advances the global turn counter
 * by the designated simulation ticks, and triggers the District Economy Macro-Tick
 * whenever a macro-tick interval (100 turns) is crossed.
 *
 * If ticks === 0 (e.g. zero-time swift action or instantaneous impulse),
 * deducts apSpent without advancing the world simulation turn clock.
 */
export function advanceTurnSchedule(
  state: WorldState,
  actorId: EntityId,
  apSpent: number,
  newEvents: readonly SimEvent[],
  rng: SeededRNG,
  ticks = 1,
): { state: WorldState; allEvents: SimEvent[] } {
  let metaState = state;
  const metaEvents: SimEvent[] = [];

  for (let t = 0; t < ticks; t++) {
    const metaRes = advanceMetabolismTick(metaState);
    metaState = metaRes.state;
    metaEvents.push(...metaRes.events);
  }

  const updatedEntities: Record<string, EntityRecord> = { ...metaState.entities };
  const actorRecord = updatedEntities[actorId];

  if (actorRecord?.actor) {
    const speedRecovery = ticks > 0 ? actorRecord.actor.speed * ticks : 0;
    updatedEntities[actorId] = {
      ...actorRecord,
      actor: {
        ...actorRecord.actor,
        energy: actorRecord.actor.energy - apSpent + speedRecovery,
      },
    };
  }

  const nextTurn = state.turnCount + ticks;
  let nextMacroTick = state.macroTickCount;
  let nextEconomy = state.economy;
  const combinedEvents: SimEvent[] = [...newEvents, ...metaEvents];

  if (ticks > 0) {
    const prevMacroIndex = Math.floor(state.turnCount / MACRO_TICK_INTERVAL);
    const nextMacroIndex = Math.floor(nextTurn / MACRO_TICK_INTERVAL);
    const macroTicksToAdvance = nextMacroIndex - prevMacroIndex;

    for (let m = 0; m < macroTicksToAdvance; m++) {
      nextMacroTick += 1;
      const econRes = advanceDistrictEconomyMacroTick(metaState, rng, nextTurn);
      nextEconomy = econRes.economy;
      combinedEvents.push(...econRes.events);
      combinedEvents.push({
        type: 'MACRO_TICK_COMPLETED',
        turn: nextTurn,
        macroTickIndex: nextMacroTick,
      });
    }
  }

  const fullLog = [...state.eventLog, ...combinedEvents];
  const eventLog =
    fullLog.length > MAX_PERSISTENT_EVENT_LOG
      ? fullLog.slice(fullLog.length - MAX_PERSISTENT_EVENT_LOG)
      : fullLog;

  return {
    state: {
      ...metaState,
      rngState: rng.getState(),
      turnCount: nextTurn,
      macroTickCount: nextMacroTick,
      entities: updatedEntities,
      economy: nextEconomy,
      eventLog,
    },
    allEvents: combinedEvents,
  };
}
