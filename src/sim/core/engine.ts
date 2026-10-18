import { GameCommand, GameCommandSchema } from '../../schemas/commands.schema.js';
import { SimEvent } from '../../schemas/events.schema.js';
import { markExploredTiles, setTileCell } from '../spatial/grid.js';
import { computeVisibleTiles } from '../spatial/fov.js';
import { advanceNpcTurns } from '../systems/ai.system.js';
import {
  computeProstheticFovBonus,
  resolveDamageLimb,
  resolveInstallProsthetic,
  resolveRefillSteam,
  resolveRemoveProsthetic,
} from '../systems/anatomy.system.js';
import { resolveAttackActor } from '../systems/combat.system.js';
import {
  resolveCraftRecipe,
  resolveRepairLimb,
  resolveSalvageItem,
} from '../systems/crafting.system.js';
import { resolveTriggerSupplyShock } from '../systems/economy.system.js';
import { resolveDropItem, resolvePickupItem, resolveUseItem } from '../systems/inventory.system.js';
import { resolveMoveStep, resolveUsePortal } from '../systems/movement.system.js';
import { resolveEmitSpark, resolvePressurizeVessel } from '../systems/pressure.system.js';
import { resolveRestAtBed, resolveSmashTerrain } from '../systems/furniture.system.js';
import { advanceThermodynamicsTick } from '../systems/thermo.system.js';
import {
  resolveBuyFromMerchant,
  resolveSellToMerchant,
  resolveStockPedestal,
} from '../systems/trade.system.js';
import { resolveToggleDoor, resolveTravelDistrict } from '../systems/transit.system.js';
import { SeededRNG } from './rng.js';
import { advanceTurnSchedule, STANDARD_ACTION_AP } from './scheduler.js';
import { WorldState } from './world.js';

export interface DispatchTurnResult {
  readonly state: WorldState;
  readonly events: readonly SimEvent[];
}

/**
 * Pure simulation command dispatcher.
 * Validates incoming command, executes domain system, ticks autonomous NPCs and
 * environmental thermodynamics, updates RNG state, and advances the turn clock.
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

  const apply = (res: { state: WorldState; events: SimEvent[]; apSpent: number }): void => {
    nextState = res.state;
    systemEvents = res.events;
    apSpent = res.apSpent;
  };

  switch (command.type) {
    case 'MOVE_STEP':
      apply(resolveMoveStep(nextState, command.actorId, command.dx, command.dy));
      break;
    case 'USE_PORTAL':
      apply(resolveUsePortal(nextState, command.actorId));
      break;
    case 'WAIT_TURN':
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
    case 'DAMAGE_LIMB':
      apply(resolveDamageLimb(nextState, command.targetId, command.slot, command.damage));
      break;
    case 'INSTALL_PROSTHETIC':
      apply(
        resolveInstallProsthetic(
          nextState,
          command.actorId,
          command.prostheticEntityId,
          command.slot,
        ),
      );
      break;
    case 'REMOVE_PROSTHETIC':
      apply(resolveRemoveProsthetic(nextState, command.actorId, command.slot));
      break;
    case 'REFILL_STEAM':
      apply(resolveRefillSteam(nextState, command.actorId, command.pressureAddedKpa));
      break;
    case 'PRESSURIZE_VESSEL':
      apply(
        resolvePressurizeVessel(nextState, command.vesselEntityId, command.pressureAddedKpa),
      );
      break;
    case 'EMIT_SPARK':
      apply(resolveEmitSpark(nextState, command.target));
      break;
    case 'STOCK_PEDESTAL':
      apply(
        resolveStockPedestal(
          nextState,
          command.commodity,
          command.quantity,
          command.askingPriceMarkupPct,
          command.actorId,
        ),
      );
      break;
    case 'BUY_FROM_MERCHANT':
      apply(resolveBuyFromMerchant(nextState, command.actorId, command.merchantId, command.itemEntityId, command.quantity));
      break;
    case 'SELL_TO_MERCHANT':
      apply(resolveSellToMerchant(nextState, command.actorId, command.merchantId, command.itemEntityId, command.quantity));
      break;
    case 'TRIGGER_SUPPLY_SHOCK':
      apply(
        resolveTriggerSupplyShock(
          nextState,
          command.commodity,
          command.supplyDelta,
          command.factionAffected,
          command.reputationDelta,
        ),
      );
      break;
    case 'PICK_UP_ITEM':
      apply(resolvePickupItem(nextState, command.actorId, command.itemEntityId));
      break;
    case 'DROP_ITEM':
      apply(resolveDropItem(nextState, command.actorId, command.itemEntityId, command.quantity));
      break;
    case 'USE_ITEM':
      apply(resolveUseItem(nextState, command.actorId, command.itemEntityId));
      break;
    case 'TOGGLE_DOOR':
      apply(resolveToggleDoor(nextState, command.actorId, command.target));
      break;
    case 'TRAVEL_DISTRICT':
      apply(resolveTravelDistrict(nextState, command.actorId, command.targetDistrictId));
      break;
    case 'CRAFT_RECIPE':
      apply(resolveCraftRecipe(nextState, command.actorId, command.recipeId));
      break;
    case 'SALVAGE_ITEM':
      apply(resolveSalvageItem(nextState, command.actorId, command.itemEntityId));
      break;
    case 'REPAIR_LIMB':
      apply(resolveRepairLimb(nextState, command.actorId, command.slot));
      break;
    case 'ATTACK_ACTOR':
      apply(
        resolveAttackActor(
          nextState,
          command.attackerId,
          command.targetId,
          command.targetSlot,
          rng,
        ),
      );
      break;
    case 'SMASH_TERRAIN':
      apply(resolveSmashTerrain(nextState, command.actorId, command.target));
      break;
    case 'REST_AT_BED':
      apply(resolveRestAtBed(nextState, command.actorId));
      break;
  }

  const npcTick = advanceNpcTurns(nextState, rng);
  nextState = npcTick.state;
  systemEvents = [...systemEvents, ...npcTick.events];

  const thermoTick = advanceThermodynamicsTick(nextState);
  nextState = thermoTick.state;
  systemEvents = [...systemEvents, ...thermoTick.events];

  const actingActorId = command.type === 'ATTACK_ACTOR' ? command.attackerId : command.actorId;
  const scheduled = advanceTurnSchedule(nextState, actingActorId, apSpent, systemEvents, rng);

  let finalState = scheduled.state;
  const player = scheduled.state.entities['actor_player'];
  if (player?.position) {
    const pStratum = player.position.stratum;
    const grid = scheduled.state.strata[pStratum];
    if (grid) {
      const bonus = computeProstheticFovBonus(scheduled.state, player);
      const visible = computeVisibleTiles(grid, player.position.x, player.position.y, Math.max(2, 10 + bonus));
      const updatedGrid = markExploredTiles(grid, visible);
      finalState = {
        ...scheduled.state,
        strata: {
          ...scheduled.state.strata,
          [pStratum]: updatedGrid,
        },
      };
    }
  }

  return {
    state: finalState,
    events: scheduled.allEvents,
  };
}
