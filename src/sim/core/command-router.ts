import { GameCommand } from '../../schemas/commands.schema.js';
import { SimEvent } from '../../schemas/events.schema.js';
import { resolveDamageLimb, resolveInstallProsthetic, resolveRemoveProsthetic } from '../systems/anatomy.system.js';
import { resolveRefillSteam, resolveVentSteam } from '../systems/boiler-stoking.system.js';
import { resolveAttackActor } from '../systems/combat.system.js';
import { resolveCraftRecipe, resolveRepairLimb, resolveSalvageItem } from '../systems/crafting.system.js';
import { resolveTriggerSupplyShock } from '../systems/economy.system.js';
import { resolveDropItem, resolvePickupItem, resolveUseItem } from '../systems/inventory.system.js';
import { resolveEmitSpark, resolvePressurizeVessel } from '../systems/pressure.system.js';
import { resolveRestAtBed, resolveSmashTerrain } from '../systems/furniture.system.js';
import { resolveBuyFromMerchant, resolveSellToMerchant, resolveStockPedestal } from '../systems/trade.system.js';
import { resolveToggleDoor, resolveTravelDistrict } from '../systems/transit.system.js';
import { resolveAcceptContract, resolveCompleteContract, resolveHireCompanion, resolvePayChirurgeonHeal } from '../systems/dialogue-quest.system.js';
import { resolveEquipItem, resolveUnequipItem } from '../systems/equipment.system.js';
import { resolveFireRangedWeapon } from '../systems/ballistics.system.js';
import { resolveLootContainer } from '../systems/container.system.js';
import { resolveBreachCommand } from '../systems/physics-traps.system.js';
import { resolveActivateProsthetic } from '../systems/prosthetics.system.js';
import { resolveHarvestCorpse } from '../systems/surgery.system.js';
import { resolveApplyMomentumVector, resolveSetPosture } from '../systems/momentum.system.js';
import { resolveInstallWeaponMod, resolveLoadAmmo, resolvePryObstacle, resolveUninstallWeaponMod } from '../systems/weapon-mods.system.js';
import { resolveCleanSpill, resolveCoatWeapon, resolveThrowFlask } from '../systems/liquids.system.js';
import { resolveEmitSquadCallout, resolveReportCrime } from '../systems/squad-witness.system.js';
import { resolveBoardMonorail, resolveLaunchMonorail } from '../systems/monorail.system.js';
import { resolveDescendCatacombs } from '../spatial/catacombs.js';
import {
  resolveBuildStructure,
  resolveClaimWorkshopDeed,
  resolveRetrieveItemFromStructure,
  resolveStoreItemInStructure,
} from '../systems/safehouse.system.js';
import { resolveConsultCodex } from '../systems/codex.system.js';
import {
  processActorTurfCombat,
  recordTacticalCoverManeuver,
  resolveInitiateTurfSkirmish,
} from '../systems/skirmish-turf.system.js';
import {
  processCompanionEscortAssignment,
  processCraftSupplyConvoyPrep,
  processDropItemDelivery,
  resolvePrepareSupplyConvoy,
} from '../systems/supply-escort.system.js';
import { resolveAuditSafehouseDeed } from '../systems/politics-audit.system.js';
import { SeededRNG } from './rng.js';
import { WorldState } from './world.js';

export interface CommandRouteResult {
  readonly state: WorldState;
  readonly events: readonly SimEvent[];
  readonly apSpent?: number;
  readonly handled: boolean;
}

export function routeDomainCommand(
  state: WorldState,
  command: GameCommand,
  rng: SeededRNG,
): CommandRouteResult {
  switch (command.type) {
    case 'VENT_STEAM': {
      const ventRes = resolveVentSteam(state, command.actorId, command.target, command.pressureReleasedKpa, command.bypassReserveCheck);
      const coverRes = recordTacticalCoverManeuver(ventRes.state, command.actorId, 'VENT_STEAM_COVER', `${command.pressureReleasedKpa} kPa released`);
      return { ...coverRes, events: [...ventRes.events, ...coverRes.events], handled: true };
    }
    case 'DAMAGE_LIMB':
      return { ...resolveDamageLimb(state, command.targetId, command.slot, command.damage), handled: true };
    case 'INSTALL_PROSTHETIC':
      return { ...resolveInstallProsthetic(state, command.actorId, command.prostheticEntityId, command.slot), handled: true };
    case 'REMOVE_PROSTHETIC':
      return { ...resolveRemoveProsthetic(state, command.actorId, command.slot), handled: true };
    case 'REFILL_STEAM':
      return { ...resolveRefillSteam(state, command.actorId, command.pressureAddedKpa, command.bypassFuelRequirement), handled: true };
    case 'PRESSURIZE_VESSEL':
      return { ...resolvePressurizeVessel(state, command.vesselEntityId, command.pressureAddedKpa), handled: true };
    case 'EMIT_SPARK':
      return { ...resolveEmitSpark(state, command.target), handled: true };
    case 'STOCK_PEDESTAL':
      return { ...resolveStockPedestal(state, command.commodity, command.quantity, command.askingPriceMarkupPct, command.actorId), handled: true };
    case 'BUY_FROM_MERCHANT':
      return { ...resolveBuyFromMerchant(state, command.actorId, command.merchantId, command.itemEntityId, command.quantity), handled: true };
    case 'SELL_TO_MERCHANT':
      return { ...resolveSellToMerchant(state, command.actorId, command.merchantId, command.itemEntityId, command.quantity), handled: true };
    case 'TRIGGER_SUPPLY_SHOCK':
      return { ...resolveTriggerSupplyShock(state, command.commodity, command.supplyDelta, command.factionAffected, command.reputationDelta), handled: true };
    case 'PICK_UP_ITEM':
      return { ...resolvePickupItem(state, command.actorId, command.itemEntityId), handled: true };
    case 'DROP_ITEM': {
      const dropRes = resolveDropItem(state, command.actorId, command.itemEntityId, command.quantity);
      const actor = state.entities[command.actorId];
      if (actor?.position && dropRes.apSpent > 0) {
        const deliveryRes = processDropItemDelivery(dropRes.state, command.actorId, command.itemEntityId, actor.position);
        return { ...deliveryRes, events: [...dropRes.events, ...deliveryRes.events], apSpent: dropRes.apSpent, handled: true };
      }
      return { ...dropRes, handled: true };
    }
    case 'USE_ITEM':
      return { ...resolveUseItem(state, command.actorId, command.itemEntityId), handled: true };
    case 'TOGGLE_DOOR':
      return { ...resolveToggleDoor(state, command.actorId, command.target), handled: true };
    case 'TRAVEL_DISTRICT':
      return { ...resolveTravelDistrict(state, command.actorId, command.targetDistrictId), handled: true };
    case 'CRAFT_RECIPE': {
      const craftRes = resolveCraftRecipe(state, command.actorId, command.recipeId);
      const craftedItemEvent = craftRes.events.find((e) => e.type === 'ITEM_CRAFTED');
      if (craftedItemEvent && craftedItemEvent.type === 'ITEM_CRAFTED') {
        const prepRes = processCraftSupplyConvoyPrep(craftRes.state, command.actorId, command.recipeId, craftedItemEvent.outputEntityId);
        return { ...prepRes, events: [...craftRes.events, ...prepRes.events], handled: true };
      }
      return { ...craftRes, handled: true };
    }
    case 'SALVAGE_ITEM':
      return { ...resolveSalvageItem(state, command.actorId, command.itemEntityId), handled: true };
    case 'REPAIR_LIMB':
      return { ...resolveRepairLimb(state, command.actorId, command.slot), handled: true };
    case 'ATTACK_ACTOR': {
      const atkRes = resolveAttackActor(state, command.attackerId, command.targetId, command.targetSlot, rng);
      const turfRes = processActorTurfCombat(atkRes.state, command.attackerId, command.targetId);
      return { ...turfRes, events: [...atkRes.events, ...turfRes.events], handled: true };
    }
    case 'SMASH_TERRAIN':
      return { ...resolveSmashTerrain(state, command.actorId, command.target), handled: true };
    case 'REST_AT_BED':
      return { ...resolveRestAtBed(state, command.actorId), handled: true };
    case 'ACCEPT_CONTRACT':
      return { ...resolveAcceptContract(state, command.actorId, command.contractId), handled: true };
    case 'COMPLETE_CONTRACT':
      return { ...resolveCompleteContract(state, command.actorId, command.contractId), handled: true };
    case 'HIRE_COMPANION': {
      const hireRes = resolveHireCompanion(state, command.actorId, command.npcId);
      const escortRes = processCompanionEscortAssignment(hireRes.state, command.actorId, command.npcId);
      return { ...escortRes, events: [...hireRes.events, ...escortRes.events], handled: true };
    }
    case 'PAY_CHIRURGEON_HEAL':
      return { ...resolvePayChirurgeonHeal(state, command.actorId, command.chirurgeonId), handled: true };
    case 'EQUIP_ITEM':
      return { ...resolveEquipItem(state, command.actorId, command.itemEntityId), handled: true };
    case 'UNEQUIP_ITEM':
      return { ...resolveUnequipItem(state, command.actorId, command.slot), handled: true };
    case 'FIRE_RANGED_WEAPON':
      return { ...resolveFireRangedWeapon(state, command.actorId, command.targetId, command.targetSlot, rng), handled: true };
    case 'LOOT_CONTAINER':
      return { ...resolveLootContainer(state, command.actorId, command.containerId, command.itemId), handled: true };
    case 'BREACH_TILE':
      return { ...resolveBreachCommand(state, command.actorId, command.target), handled: true };
    case 'ACTIVATE_PROSTHETIC':
      return { ...resolveActivateProsthetic(state, command.actorId, command.slot, command.direction, command.target, command.targetEntityId), handled: true };
    case 'HARVEST_CORPSE':
      return { ...resolveHarvestCorpse(state, command.actorId, command.corpseEntityId, command.toolEntityId, command.slot), handled: true };
    case 'SET_POSTURE':
      return { ...resolveSetPosture(state, command.actorId, command.posture, state.turnCount + 1), handled: true };
    case 'APPLY_MOMENTUM_VECTOR':
      return { ...resolveApplyMomentumVector(state, command.targetId, command.dx, command.dy, command.distanceTiles, command.massKg, state.turnCount + 1, command.sourceEntityId), handled: true };
    case 'INSTALL_WEAPON_MOD':
      return { ...resolveInstallWeaponMod(state, command.actorId, command.weaponEntityId, command.modEntityId), handled: true };
    case 'UNINSTALL_WEAPON_MOD':
      return { ...resolveUninstallWeaponMod(state, command.actorId, command.weaponEntityId, command.modBlueprintId), handled: true };
    case 'LOAD_AMMO':
      return { ...resolveLoadAmmo(state, command.actorId, command.weaponEntityId, command.ammoEntityId), handled: true };
    case 'PRY_OBSTACLE':
      return { ...resolvePryObstacle(state, command.actorId, command.target, command.toolEntityId), handled: true };
    case 'COAT_WEAPON':
      return { ...resolveCoatWeapon(state, command.actorId, command.weaponEntityId, command.liquidContainerId), handled: true };
    case 'THROW_FLASK':
      return { ...resolveThrowFlask(state, command.actorId, command.target, command.flaskEntityId), handled: true };
    case 'CLEAN_SPILL':
      return { ...resolveCleanSpill(state, command.actorId, command.target, command.toolEntityId), handled: true };
    case 'EMIT_SQUAD_CALLOUT':
      return { ...resolveEmitSquadCallout(state, command.actorId, command.targetId, command.alertMessage), handled: true };
    case 'REPORT_CRIME':
      return { ...resolveReportCrime(state, command.witnessId, command.perpetratorId, command.crime), handled: true };
    case 'BOARD_MONORAIL':
      return { ...resolveBoardMonorail(state, command.actorId, command.monorailEntityId), handled: true };
    case 'LAUNCH_MONORAIL':
      return { ...resolveLaunchMonorail(state, command.actorId, command.monorailEntityId, command.destinationDistrictId), handled: true };
    case 'DESCEND_CATACOMBS':
      return { ...resolveDescendCatacombs(state, command.actorId, command.stairEntityId), handled: true };
    case 'CLAIM_WORKSHOP_DEED':
      return { ...resolveClaimWorkshopDeed(state, command), handled: true };
    case 'BUILD_STRUCTURE':
      return { ...resolveBuildStructure(state, command), handled: true };
    case 'STORE_ITEM_IN_STRUCTURE':
      return { ...resolveStoreItemInStructure(state, command), handled: true };
    case 'RETRIEVE_ITEM_FROM_STRUCTURE':
      return { ...resolveRetrieveItemFromStructure(state, command), handled: true };
    case 'CONSULT_CODEX':
      return { ...resolveConsultCodex(state, command), handled: true };
    case 'INITIATE_TURF_SKIRMISH':
      return { ...resolveInitiateTurfSkirmish(state, command), handled: true };
    case 'PREPARE_SUPPLY_CONVOY':
      return { ...resolvePrepareSupplyConvoy(state, command), handled: true };
    case 'AUDIT_SAFEHOUSE_DEED':
      return { ...resolveAuditSafehouseDeed(state, command), handled: true };
    default:
      return { state, events: [], handled: false };
  }
}
