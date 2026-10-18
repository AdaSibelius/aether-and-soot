import { GameCommand, GameCommandSchema } from '../../schemas/commands.schema.js';
import { SimEvent } from '../../schemas/events.schema.js';
import { setTileCell } from '../spatial/grid.js';
import {
  resolveDamageLimb,
  resolveInstallProsthetic,
  resolveRefillSteam,
  resolveRemoveProsthetic,
} from '../systems/anatomy.system.js';
import { resolveStockPedestal, resolveTriggerSupplyShock } from '../systems/economy.system.js';
import { resolveMoveStep, resolveUsePortal } from '../systems/movement.system.js';
import { resolveEmitSpark, resolvePressurizeVessel } from '../systems/pressure.system.js';
import { advanceThermodynamicsTick } from '../systems/thermo.system.js';
import { SeededRNG } from './rng.js';
import { advanceTurnSchedule, STANDARD_ACTION_AP } from './scheduler.js';
import { WorldState } from './world.js';

export interface DispatchTurnResult {
  readonly state: WorldState;
  readonly events: readonly SimEvent[];
}

/**
 * Pure simulation command dispatcher.
 * Validates incoming command, executes domain system, ticks environmental thermodynamics,
 * updates RNG state, and advances the turn clock (including 100-turn Macro-Ticks).
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
    case 'DAMAGE_LIMB': {
      const res = resolveDamageLimb(nextState, command.targetId, command.slot, command.damage);
      nextState = res.state;
      systemEvents = res.events;
      apSpent = res.apSpent;
      break;
    }
    case 'INSTALL_PROSTHETIC': {
      const res = resolveInstallProsthetic(
        nextState,
        command.actorId,
        command.prostheticEntityId,
        command.slot,
      );
      nextState = res.state;
      systemEvents = res.events;
      apSpent = res.apSpent;
      break;
    }
    case 'REMOVE_PROSTHETIC': {
      const res = resolveRemoveProsthetic(nextState, command.actorId, command.slot);
      nextState = res.state;
      systemEvents = res.events;
      apSpent = res.apSpent;
      break;
    }
    case 'REFILL_STEAM': {
      const res = resolveRefillSteam(nextState, command.actorId, command.pressureAddedKpa);
      nextState = res.state;
      systemEvents = res.events;
      apSpent = res.apSpent;
      break;
    }
    case 'PRESSURIZE_VESSEL': {
      const res = resolvePressurizeVessel(
        nextState,
        command.vesselEntityId,
        command.pressureAddedKpa,
      );
      nextState = res.state;
      systemEvents = res.events;
      apSpent = res.apSpent;
      break;
    }
    case 'EMIT_SPARK': {
      const res = resolveEmitSpark(nextState, command.target);
      nextState = res.state;
      systemEvents = res.events;
      apSpent = res.apSpent;
      break;
    }
    case 'STOCK_PEDESTAL': {
      const res = resolveStockPedestal(
        nextState,
        command.commodity,
        command.quantity,
        command.askingPriceMarkupPct,
      );
      nextState = res.state;
      systemEvents = res.events;
      apSpent = res.apSpent;
      break;
    }
    case 'TRIGGER_SUPPLY_SHOCK': {
      const res = resolveTriggerSupplyShock(
        nextState,
        command.commodity,
        command.supplyDelta,
        command.factionAffected,
        command.reputationDelta,
      );
      nextState = res.state;
      systemEvents = res.events;
      apSpent = res.apSpent;
      break;
    }
  }

  const thermoTick = advanceThermodynamicsTick(nextState);
  nextState = thermoTick.state;
  systemEvents = [...systemEvents, ...thermoTick.events];

  const scheduled = advanceTurnSchedule(nextState, command.actorId, apSpent, systemEvents, rng);
  return {
    state: scheduled.state,
    events: scheduled.allEvents,
  };
}
