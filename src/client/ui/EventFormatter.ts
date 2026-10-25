import { SimEvent } from '../../schemas/events.schema.js';
import { aggregateChronicleEvents } from './EventFormatterDomain.js';

/**
 * Pure formatter transforming simulation events into Victorian chronicle log messages.
 */
export function formatEventMessage(ev: SimEvent): string {
  switch (ev.type) {
    case 'ENTITY_MOVED':
      return `[T${ev.turn}] Stepped to (${ev.to.x}, ${ev.to.y}) on ${ev.to.stratum} [${ev.apSpent} AP]`;
    case 'MOVEMENT_BLOCKED':
      return `[T${ev.turn}] Movement blocked (${ev.reason}) at (${ev.target.x}, ${ev.target.y})`;
    case 'STRATUM_CHANGED':
      return `[T${ev.turn}] Traversed portal: ${ev.fromStratum} -> ${ev.toStratum}`;
    case 'PORTAL_FAILED':
      return `[T${ev.turn}] Portal traversal failed: ${ev.reason}`;
    case 'ACTOR_WAITED':
      return `[T${ev.turn}] Artificer holds position and checks pressure gauges.`;
    case 'STEAM_VENTED':
      return `[T${ev.turn}] Vented ${ev.pressureReleasedKpa} kPa superheated steam!`;
    case 'STEAM_VENT_FAILED':
      return `[T${ev.turn}] Steam venting failed: ${ev.reason}`;
    case 'LIMB_DAMAGED':
      return `[T${ev.turn}] ${ev.slot} took ${ev.damage} dmg (${ev.remainingHp} HP left)`;
    case 'LIMB_AMPUTATED':
      return `[T${ev.turn}] CRITICAL: ${ev.slot} severed!`;
    case 'PROSTHETIC_INSTALLED': return `[T${ev.turn}] Installed prosthetic into ${ev.slot} socket.`;
    case 'PROSTHETIC_REMOVED': return `[T${ev.turn}] Detached prosthetic from ${ev.slot} socket.`;
    case 'PROSTHETIC_ACTION_FAILED':
      return `[T${ev.turn}] Surgery failed on ${ev.slot}: ${ev.reason}`;
    case 'STEAM_REFILLED':
      return `[T${ev.turn}] Boiler re-pressurized to ${ev.newReserveKpa} kPa.`;
    case 'STEAM_REFILL_FAILED':
      return `[T${ev.turn}] Boiler stoking failed: ${ev.reason}`;
    case 'VESSEL_RUPTURED':
      return `[T${ev.turn}] BOILER RUPTURE! ${ev.releasedPressureKpa} kPa blasted at (${ev.origin.x}, ${ev.origin.y})!`;
    case 'COAL_DUST_IGNITED':
      return `[T${ev.turn}] FLASH FIRE! ${ev.ignitedTileCount} coal dust tiles ignited!`;
    case 'THERMAL_SCALD':
      return `[T${ev.turn}] SCALD! Superheated steam (${ev.steamPressureKpa} kPa) burns ${ev.slot}!`;
    case 'PEDESTAL_STOCKED':
      return `[T${ev.turn}] Stocked ${ev.quantity}x ${ev.commodity} on display pedestal.`;
    case 'SUPPLY_SHOCK_TRIGGERED':
      return `[T${ev.turn}] SUPPLY SHOCK! ${ev.commodity} -> ${ev.newPricePence}d (${ev.factionAffected} rep: ${ev.newReputation})`;
    case 'STOREFRONT_SALE_COMPLETED':
      return `[T${ev.turn}] SALE! Sold ${ev.unitsSold}x ${ev.commodity} for ${ev.revenuePence}d!`;
    case 'MACRO_TICK_COMPLETED':
      return `[T${ev.turn}] === District Macro-Tick #${ev.macroTickIndex} Processed ===`;
    case 'ITEM_PICKED_UP':
      return `[T${ev.turn}] Pocketed ${ev.quantity}x ${ev.itemName}${ev.stackedIntoEntityId ? ' (stacked)' : ''}.`;
    case 'ITEM_DROPPED':
      return `[T${ev.turn}] Dropped ${ev.quantity}x ${ev.itemName} at (${ev.at.x}, ${ev.at.y}).`;
    case 'ITEM_USED':
      return `[T${ev.turn}] Used ${ev.itemName}: +${Math.round(ev.amountRestored)} ${ev.effect === 'RESTORE_BLOOD' ? '% blood' : 'kPa steam'} (${ev.remainingQuantity} left).`;
    case 'INVENTORY_ACTION_FAILED':
      return `[T${ev.turn}] ${ev.action} failed: ${ev.reason}`;
    case 'DOOR_TOGGLED':
      return `[T${ev.turn}] ${ev.newState === 'OPEN' ? 'Opened' : 'Closed'} door at (${ev.at.x}, ${ev.at.y}).`;
    case 'DISTRICT_TRAVELED':
      return `[T${ev.turn}] Traveled to ${ev.toDistrictId}!`;
    case 'TRANSIT_ACTION_FAILED':
      return `[T${ev.turn}] Transit (${ev.action}) failed: ${ev.reason}`;
    case 'ITEM_CRAFTED':
      return `[T${ev.turn}] Crafted ${ev.quantity}x ${ev.outputName} (-${ev.steamSpentKpa} kPa steam).`;
    case 'ITEM_SALVAGED':
      return `[T${ev.turn}] Salvaged ${ev.salvagedItemName} -> ${ev.recoveredQuantity}x ${ev.recoveredMaterialBlueprintId}.`;
    case 'LIMB_REPAIRED':
      return `[T${ev.turn}] Repaired ${ev.slot} (+${ev.hpRestored} HP, now ${ev.newHp} HP).`;
    case 'CRAFTING_FAILED':
      return `[T${ev.turn}] Artificer ${ev.action} failed: ${ev.reason}`;
    case 'COMBAT_ATTACK_RESOLVED':
      return ev.hit
        ? `[T${ev.turn}] ${ev.attackerId} struck ${ev.targetId}'s ${ev.targetSlot} for ${ev.damageDealt} dmg!`
        : `[T${ev.turn}] ${ev.attackerId}'s strike at ${ev.targetId}'s ${ev.targetSlot} missed!`;
    case 'ACTOR_DEFEATED':
      return `[T${ev.turn}] DEFEATED! ${ev.actorName} collapsed (${ev.droppedEntityIds.length} items dropped)!`;
    case 'COMBAT_ACTION_FAILED':
      return `[T${ev.turn}] Attack failed: ${ev.reason}`;
    case 'MERCHANT_TRADE_COMPLETED':
      return `[T${ev.turn}] Trade (${ev.tradeType}): ${ev.quantity}x ${ev.itemName} for ${ev.totalPence}d (Treasury: ${ev.playerTreasuryAfter}d).`;
    case 'TRADE_ACTION_FAILED':
      return `[T${ev.turn}] Trade (${ev.action}) failed: ${ev.reason}`;
    case 'TERRAIN_SMASHED':
      return `[T${ev.turn}] Shattered window at (${ev.target.x}, ${ev.target.y})!`;
    case 'ACTOR_RESTED':
      return `[T${ev.turn}] Rested and recuperated: +${ev.hpRestored} HP, +${ev.bloodRestoredPct}% blood.`;
    case 'RECIPE_UNLOCKED':
      return `[T${ev.turn}] Studied schematic: unlocked recipe "${ev.recipeId}".`;
    case 'FURNITURE_ACTION_FAILED':
      return `[T${ev.turn}] Furniture action (${ev.action}) failed: ${ev.reason}`;
    case 'CONTRACT_ACCEPTED':
      return `[T${ev.turn}] Contract signed: "${ev.title}".`;
    case 'CONTRACT_COMPLETED':
      return `[T${ev.turn}] Contract completed: "${ev.title}" (+${ev.rewardPence}d, +${ev.rewardReputation} rep).`;
    case 'COMPANION_RECRUITED':
      return `[T${ev.turn}] Hired companion: ${ev.companionName} for ${ev.feePence}d.`;
    case 'CHIRURGEON_HEAL_COMPLETED':
      return `[T${ev.turn}] Chirurgeon treated wounds: +${ev.hpRestored} HP, +${ev.bloodRestoredPct}% blood (-${ev.feePence}d).`;
    case 'DIALOGUE_ACTION_FAILED':
      return `[T${ev.turn}] Dialogue action (${ev.action}) failed: ${ev.reason}`;
    case 'ITEM_EQUIPPED':
      return `[T${ev.turn}] Equipped ${ev.itemName} to ${ev.slot}.`;
    case 'ITEM_UNEQUIPPED':
      return `[T${ev.turn}] Unequipped ${ev.itemName} from ${ev.slot}.`;
    case 'RANGED_ATTACK_RESOLVED':
      return ev.hit
        ? `[T${ev.turn}] ${ev.attackerId} shot ${ev.targetId}'s ${ev.targetSlot} with ${ev.weaponName} for ${ev.damageDealt} dmg (-${ev.steamSpentKpa} kPa steam)!`
        : `[T${ev.turn}] ${ev.attackerId}'s shot with ${ev.weaponName} missed ${ev.targetId} (-${ev.steamSpentKpa} kPa steam)!`;
    case 'EQUIPMENT_ACTION_FAILED':
      return `[T${ev.turn}] Equipment action failed: ${ev.reason}`;
    case 'CONTAINER_LOOTED':
      return `[T${ev.turn}] Looted ${ev.containerName}: ${ev.itemIds.length} items${ev.penceGained > 0 ? `, +${ev.penceGained}d pence` : ''}!`;
    case 'SOUND_EMITTED':
      return `[T${ev.turn}] Noise echoes (${ev.decibels} dB) from (${ev.origin.x}, ${ev.origin.y})!`;
    case 'WALL_BREACHED':
      return `[T${ev.turn}] BREACH! Wall shattered into rubble at (${ev.target.x}, ${ev.target.y}) via ${ev.breachSource}!`;
    case 'ACTOR_FELL_STRATUM':
      return `[T${ev.turn}] PLUMMET! ${ev.actorId} fell from ${ev.fromStratum} to ${ev.toStratum} (${ev.impactDamage} impact damage)!`;
    case 'TRAP_TRIGGERED':
      return `[T${ev.turn}] TRAP TRIGGERED! ${ev.victimActorId} tripped a ${ev.trapKind} at (${ev.at.x}, ${ev.at.y})!`;

    case 'CYBERNETIC_HARVESTED':
      return `[T${ev.turn}] ${ev.actorId} surgically extracted ${ev.prostheticBlueprintId} from ${ev.corpseEntityId} (${ev.toolQuality} quality, ${ev.itemDamagePct}% item trauma)!`;
    case 'GOVERNOR_OVERLOADED':
      return `[T${ev.turn}] BOILER GOVERNOR OVERLOADED! ${ev.actorId}'s augments demand ${ev.strainLoadKw} kW against ${ev.governorCapacityKw} kW capacity!`;
    case 'HARVEST_ACTION_FAILED':
      return `[T${ev.turn}] Surgical excision failed on ${ev.corpseEntityId}: ${ev.reason}.`;
    case 'PROSTHETIC_ACTIVATED':
      return `[T${ev.turn}] ${ev.actorId} activated ${ev.abilityId} on ${ev.slot} (-${ev.steamCost} kPa steam)!`;

    case 'ALCHEMICAL_CONSUMED':
      return `[T${ev.turn}] ${ev.actorId} imbibed alchemical draught (Toxicity +${ev.toxicityDelta}%, Stamina ${ev.staminaDelta >= 0 ? '+' : ''}${ev.staminaDelta}, Pain -${ev.painRelief}).`;
    case 'STAMINA_DEPLETED':
      return `[T${ev.turn}] COLLAPSE! ${ev.actorId}'s stamina is entirely spent!`;
    case 'TOXICITY_OVERDOSE':
      return `[T${ev.turn}] OVERDOSE! ${ev.actorId}'s veins seethe with ${ev.toxicityPct}% toxicity (-${ev.bloodVolumeLost}% blood, -${ev.damageInflicted} HP)!`;
    case 'WITHDRAWAL_ONSET':
      return `[T${ev.turn}] WITHDRAWAL! ${ev.actorId} suffers tremors as ${ev.effectId} crashes (-${ev.penaltyAp} AP)!`;
    case 'POSTURE_CHANGED':
      return `[T${ev.turn}] ${ev.actorId} transitioned stance from ${ev.previousPosture} to ${ev.newPosture}.`;
    case 'ENTITY_KNOCKED_BACK':
      return `[T${ev.turn}] IMPACT! ${ev.entityId} was hurled ${ev.distanceTraveled} tiles backwards to (${ev.endPosition.x}, ${ev.endPosition.y})!`;
    case 'MOMENTUM_COLLISION_IMPACT':
      return `[T${ev.turn}] CRUSHING COLLISION! ${ev.primaryEntityId} slammed into ${ev.obstacleType === 'ENTITY' ? ev.collidedWithEntityId ?? 'another entity' : ev.obstacleType} at (${ev.impactPosition.x}, ${ev.impactPosition.y}) (${ev.damageInflicted} trauma)!`;
    case 'WEAPON_MOD_INSTALLED':
      return `[T${ev.turn}] UPGRADE! ${ev.actorId} attached ${ev.modBlueprintId} to ${ev.weaponEntityId} (${ev.remainingModSlots} slots remaining).`;
    case 'WEAPON_MOD_UNINSTALLED':
      return `[T${ev.turn}] ${ev.actorId} detached ${ev.modBlueprintId} from ${ev.weaponEntityId}.`;
    case 'AMMO_LOADED':
      return `[T${ev.turn}] ${ev.actorId} loaded ${ev.ammoCount}x ${ev.ammoBlueprintId} into ${ev.weaponEntityId}.`;
    case 'OBSTACLE_PRIED':
      return `[T${ev.turn}] FORCED! ${ev.actorId} pried open ${ev.fromTerrain} into ${ev.toTerrain} using ${ev.toolEntityId} (Quality ${ev.toolQuality}).`;
    case 'WEAPON_MOD_ACTION_FAILED':
      return `[T${ev.turn}] Weapon modification failed for ${ev.actorId}: ${ev.reason}.`;
    case 'LIQUID_SPILLED':
      return `[T${ev.turn}] SPLASH! ${ev.volumeMl} mL of ${ev.liquidType} spilled across (${ev.target.x}, ${ev.target.y}).`;
    case 'LIQUID_IGNITED':
      return `[T${ev.turn}] CONFLAGRATION! ${ev.liquidType} ignited into blazing fire at (${ev.target.x}, ${ev.target.y}) (${ev.thermalDamage} thermal damage, ${ev.burnedVolumeMl} mL combusted)!`;
    case 'ITEM_COATED':
      return `[T${ev.turn}] ${ev.actorId} treated ${ev.itemEntityId} with a slick coating of ${ev.liquidType} (${ev.volumeMl} mL).`;
    case 'ACID_CORROSION_TICK':
      return `[T${ev.turn}] SIZZLE! Nitric acid seethes against ${ev.targetId} at (${ev.at.x}, ${ev.at.y}) (-${ev.damageInflicted} HP)!`;
    case 'SURFACE_SLIPPED':
      return `[T${ev.turn}] SLIP! ${ev.actorId} lost their footing on slick ${ev.liquidType} at (${ev.at.x}, ${ev.at.y})!`;
    case 'LIQUID_ACTION_FAILED':
      return `[T${ev.turn}] Chemical action failed for ${ev.actorId}: ${ev.reason}.`;
    case 'WITNESS_CRIME_REPORTED':
      return `[T${ev.turn}] ALARM! ${ev.witnessId} witnessed ${ev.crime} by ${ev.perpetratorId} (Faction ${ev.factionId} ${ev.reputationPenalty} rep)!`;
    case 'SQUAD_CALLOUT_EMITTED':
      return `[T${ev.turn}] SHOUT! [${ev.squadId}] ${ev.callerId} barks: "${ev.calloutMessage}" (${ev.noiseDb} dB)!`;
    case 'SQUADMATE_RALLIED':
      return `[T${ev.turn}] RALLIED! Squadmate ${ev.squadmateId} heard the call from ${ev.callerId} and enters combat against ${ev.targetId}!`;
    case 'GRUDGE_ACQUIRED':
      return `[T${ev.turn}] GRUDGE! ${ev.holderId} marked ${ev.targetId} for retribution: ${ev.reason}.`;
    case 'MONORAIL_BOARDED':
      return `[T${ev.turn}] ${ev.actorId} boarded pneumatic monorail ${ev.monorailEntityId} (${ev.passengersCount} aboard).`;
    case 'MONORAIL_LAUNCHED':
      return `[T${ev.turn}] PNEUMATIC RUSH! Monorail ${ev.monorailEntityId} fired toward ${ev.destinationDistrictId} at ${ev.speedMph} mph (${ev.steamPressureKpa} kPa)!`;
    case 'MONORAIL_ARRIVED':
      return `[T${ev.turn}] Monorail ${ev.monorailEntityId} arrived at ${ev.destinationDistrictId} with ${ev.passengers.length} passengers.`;
    case 'CATACOMBS_DEPTH_DESCENDED':
      return `[T${ev.turn}] DELVE! ${ev.actorId} descended to Catacombs Depth ${ev.toDepth} (${ev.tierName}).`;
    case 'MONORAIL_ACTION_FAILED':
      return `[T${ev.turn}] Monorail operation failed for ${ev.actorId}: ${ev.reason}.`;

    case 'ACTOR_TURF_STATE_CHANGED': return `[T${ev.turn}] Victorian chronicle: Actor Turf State Changed.`;
    case 'CONVOY_DELIVERY_CONFIRMED': return `[T${ev.turn}] Victorian chronicle: Convoy Delivery Confirmed.`;
    case 'CONVOY_ESCORT_ASSIGNED': return `[T${ev.turn}] Victorian chronicle: Convoy Escort Assigned.`;
    case 'CONVOY_PREPARATION_STARTED': return `[T${ev.turn}] Victorian chronicle: Convoy Preparation Started.`;
    case 'NPC_GOAL_CHANGED': return `[T${ev.turn}] Victorian chronicle: Npc Goal Changed.`;
    case 'SAFEHOUSE_AUDIT_COMPLETED': return `[T${ev.turn}] Victorian chronicle: Safehouse Audit Completed.`;
    case 'TACTICAL_MANEUVER_RECORDED': return `[T${ev.turn}] Victorian chronicle: Tactical Maneuver Recorded.`;
    case 'TURF_CONTESTED': return `[T${ev.turn}] Victorian chronicle: Turf Contested.`;
    case 'TURF_CONTROL_CHANGED': return `[T${ev.turn}] Victorian chronicle: Turf Control Changed.`;
    case 'CODEX_CONSULTED': return `[T${ev.turn}] The ancient tome reveals its secrets, knowledge gained at a price.`;
    case 'CODEX_ENTRY_DISCOVERED': return `[T${ev.turn}] A lost tome of forbidden knowledge unearthed, secrets waiting to be unraveled.`;
    case 'NPC_CODEX_REACTION': return `[T${ev.turn}] The ancient gears of the Aether whirred in response to your query, its steam-powered mind pondering the depths of knowledge.`;
    case 'SAFEHOUSE_ACTION_FAILED': return `[T${ev.turn}] The gears of industry ground to a halt, as the delicate mechanisms of the safehouse failed, leaving the brave adventurers stranded in the thick of peril.`;
    case 'STRUCTURE_BUILT': return `[T${ev.turn}] A new edifice rises from the aether, its brass and coal-iron frame a testament to our unyielding industrial might.`;
    case 'STRUCTURE_STORAGE_UPDATED': return `[T${ev.turn}] The storage facility's inventory has been updated with new supplies.`;
    case 'WORKSHOP_DEED_CLAIMED': return `[T${ev.turn}] A deed to a workshop claimed by the industrious soul, ready to forge the future.`;
  }
}



export const formatChronicleLog = aggregateChronicleEvents;

export { aggregateChronicleEvents } from './EventFormatterDomain.js';
