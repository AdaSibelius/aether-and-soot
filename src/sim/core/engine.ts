import { GameCommand, GameCommandSchema } from '../../schemas/commands.schema.js';
import { SimEvent } from '../../schemas/events.schema.js';
import { markExploredTiles } from '../spatial/grid.js';
import { computeVisibleTiles } from '../spatial/fov.js';
import { advanceNpcTurns } from '../systems/ai.system.js';
import {
  computeProstheticFovBonus, resolveDamageLimb, resolveInstallProsthetic, resolveRemoveProsthetic,
} from '../systems/anatomy.system.js';
import { resolveRefillSteam, resolveVentSteam } from '../systems/boiler-stoking.system.js';
import { resolveAttackActor } from '../systems/combat.system.js';
import { resolveCraftRecipe, resolveRepairLimb, resolveSalvageItem } from '../systems/crafting.system.js';
import { resolveTriggerSupplyShock } from '../systems/economy.system.js';
import { resolveDropItem, resolvePickupItem, resolveUseItem } from '../systems/inventory.system.js';
import { resolveMoveStep, resolveUsePortal } from '../systems/movement.system.js';
import { resolveEmitSpark, resolvePressurizeVessel } from '../systems/pressure.system.js';
import { resolveRestAtBed, resolveSmashTerrain } from '../systems/furniture.system.js';
import { advanceThermodynamicsTick } from '../systems/thermo.system.js';
import { resolveBuyFromMerchant, resolveSellToMerchant, resolveStockPedestal } from '../systems/trade.system.js';
import { resolveToggleDoor, resolveTravelDistrict } from '../systems/transit.system.js';
import {
  resolveAcceptContract, resolveCompleteContract, resolveHireCompanion, resolvePayChirurgeonHeal,
} from '../systems/dialogue-quest.system.js';
import { resolveEquipItem, resolveUnequipItem } from '../systems/equipment.system.js';
import { resolveFireRangedWeapon } from '../systems/ballistics.system.js';
import { resolveLootContainer } from '../systems/container.system.js';
import { resolveBreachCommand } from '../systems/physics-traps.system.js';
import { decrementProstheticCooldowns, resolveActivateProsthetic } from '../systems/prosthetics.system.js';
import { resolveHarvestCorpse } from '../systems/surgery.system.js';
import { resolveApplyMomentumVector, resolveSetPosture } from '../systems/momentum.system.js';
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
    case 'WAIT_TURN': {
      rng.nextUint32();
      const wActor = nextState.entities[command.actorId];
      if (wActor?.anatomy && wActor.traits?.includes('BOILER_HEART')) {
        const nextSteam = Math.min(wActor.anatomy.maxSteamReserveKpa, wActor.anatomy.steamReserveKpa + 5);
        nextState = { ...nextState, entities: { ...nextState.entities, [command.actorId]: { ...wActor, anatomy: { ...wActor.anatomy, steamReserveKpa: nextSteam } } } };
      }
      systemEvents = [{ type: 'ACTOR_WAITED', turn: nextState.turnCount + 1, actorId: command.actorId, apSpent: STANDARD_ACTION_AP }];
      break;
    }
    case 'VENT_STEAM':
      apply(resolveVentSteam(nextState, command.actorId, command.target, command.pressureReleasedKpa, command.bypassReserveCheck));
      break;
    case 'DAMAGE_LIMB':
      apply(resolveDamageLimb(nextState, command.targetId, command.slot, command.damage));
      break;
    case 'INSTALL_PROSTHETIC':
      apply(resolveInstallProsthetic(nextState, command.actorId, command.prostheticEntityId, command.slot));
      break;
    case 'REMOVE_PROSTHETIC':
      apply(resolveRemoveProsthetic(nextState, command.actorId, command.slot));
      break;
    case 'REFILL_STEAM':
      apply(resolveRefillSteam(nextState, command.actorId, command.pressureAddedKpa, command.bypassFuelRequirement));
      break;
    case 'PRESSURIZE_VESSEL':
      apply(resolvePressurizeVessel(nextState, command.vesselEntityId, command.pressureAddedKpa));
      break;
    case 'EMIT_SPARK':
      apply(resolveEmitSpark(nextState, command.target));
      break;
    case 'STOCK_PEDESTAL':
      apply(resolveStockPedestal(nextState, command.commodity, command.quantity, command.askingPriceMarkupPct, command.actorId));
      break;
    case 'BUY_FROM_MERCHANT':
      apply(resolveBuyFromMerchant(nextState, command.actorId, command.merchantId, command.itemEntityId, command.quantity));
      break;
    case 'SELL_TO_MERCHANT':
      apply(resolveSellToMerchant(nextState, command.actorId, command.merchantId, command.itemEntityId, command.quantity));
      break;
    case 'TRIGGER_SUPPLY_SHOCK':
      apply(resolveTriggerSupplyShock(nextState, command.commodity, command.supplyDelta, command.factionAffected, command.reputationDelta));
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
      apply(resolveAttackActor(nextState, command.attackerId, command.targetId, command.targetSlot, rng));
      break;
    case 'SMASH_TERRAIN':
      apply(resolveSmashTerrain(nextState, command.actorId, command.target));
      break;
    case 'REST_AT_BED':
      apply(resolveRestAtBed(nextState, command.actorId));
      break;
    case 'ACCEPT_CONTRACT':
      apply(resolveAcceptContract(nextState, command.actorId, command.contractId));
      break;
    case 'COMPLETE_CONTRACT':
      apply(resolveCompleteContract(nextState, command.actorId, command.contractId));
      break;
    case 'HIRE_COMPANION':
      apply(resolveHireCompanion(nextState, command.actorId, command.npcId));
      break;
    case 'PAY_CHIRURGEON_HEAL':
      apply(resolvePayChirurgeonHeal(nextState, command.actorId, command.chirurgeonId));
      break;
    case 'EQUIP_ITEM':
      apply(resolveEquipItem(nextState, command.actorId, command.itemEntityId));
      break;
    case 'UNEQUIP_ITEM':
      apply(resolveUnequipItem(nextState, command.actorId, command.slot));
      break;
    case 'FIRE_RANGED_WEAPON':
      apply(resolveFireRangedWeapon(nextState, command.actorId, command.targetId, command.targetSlot, rng));
      break;
    case 'LOOT_CONTAINER':
      apply(resolveLootContainer(nextState, command.actorId, command.containerId, command.itemId));
      break;
    case 'BREACH_TILE':
      apply(resolveBreachCommand(nextState, command.actorId, command.target));
      break;
    case 'ACTIVATE_PROSTHETIC':
      apply(resolveActivateProsthetic(nextState, command.actorId, command.slot, command.direction, command.target, command.targetEntityId));
      break;
    case 'HARVEST_CORPSE':
      apply(resolveHarvestCorpse(nextState, command.actorId, command.corpseEntityId, command.toolEntityId, command.slot));
      break;
    case 'SET_POSTURE':
      apply(resolveSetPosture(nextState, command.actorId, command.posture, nextState.turnCount + 1));
      break;
    case 'APPLY_MOMENTUM_VECTOR':
      apply(resolveApplyMomentumVector(nextState, command.targetId, command.dx, command.dy, command.distanceTiles, command.massKg, nextState.turnCount + 1, command.sourceEntityId));
      break;
  }

  const npcTick = advanceNpcTurns(nextState, rng);
  nextState = npcTick.state;
  systemEvents = [...systemEvents, ...npcTick.events];

  const thermoTick = advanceThermodynamicsTick(nextState);
  nextState = thermoTick.state;
  systemEvents = [...systemEvents, ...thermoTick.events];

  const actingActorId =
    command.type === 'ATTACK_ACTOR'
      ? command.attackerId
      : command.type === 'APPLY_MOMENTUM_VECTOR'
        ? (command.sourceEntityId ?? command.targetId)
        : command.actorId;
  nextState = decrementProstheticCooldowns(nextState, actingActorId);
  const scheduled = advanceTurnSchedule(nextState, actingActorId, apSpent, systemEvents, rng);

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

  return { state: finalState, events: scheduled.allEvents };
}
