import { EntityRecord } from '../../schemas/components.schema.js';
import { EquipmentSlot, EquipmentSpec } from '../../schemas/equipment.schema.js';
import { SimEvent } from '../../schemas/events.schema.js';
import { EntityId } from '../../schemas/primitives.schema.js';
import { STANDARD_ACTION_AP } from '../core/scheduler.js';
import { WorldState } from '../core/world.js';

export interface EquipmentBonuses {
  readonly meleeDamageBonus: number;
  readonly armorBonus: number;
  readonly storageVolumeBonusMl: number;
  readonly steamResistanceKpa: number;
  readonly rangedRange: number;
  readonly rangedDamage: number;
  readonly rangedSteamCostKpa: number;
}

export const ZERO_EQUIPMENT_BONUSES: EquipmentBonuses = {
  meleeDamageBonus: 0,
  armorBonus: 0,
  storageVolumeBonusMl: 0,
  steamResistanceKpa: 0,
  rangedRange: 0,
  rangedDamage: 0,
  rangedSteamCostKpa: 0,
};

export function getEquipmentSpec(itemEntity?: EntityRecord): EquipmentSpec | undefined {
  if (!itemEntity) return undefined;
  return itemEntity.item?.equipmentSpec ?? itemEntity.equipmentSpec;
}

function failEquipmentAction(state: WorldState, actorId: EntityId, reason: string) {
  return {
    state,
    apSpent: STANDARD_ACTION_AP,
    events: [{
      type: 'EQUIPMENT_ACTION_FAILED' as const,
      turn: state.turnCount + 1,
      actorId,
      reason,
    }],
  };
}

/** Calculates aggregated stat bonuses from all gear currently equipped on the actor. */
export function computeEquippedBonuses(
  state: Readonly<WorldState>,
  actor: EntityRecord,
): EquipmentBonuses {
  const equippedSlots = actor.inventory?.equippedSlots;
  if (!equippedSlots) return ZERO_EQUIPMENT_BONUSES;

  let meleeDamageBonus = 0;
  let armorBonus = 0;
  let storageVolumeBonusMl = 0;
  let steamResistanceKpa = 0;
  let rangedRange = 0;
  let rangedDamage = 0;
  let rangedSteamCostKpa = 0;

  for (const [slot, entityId] of Object.entries(equippedSlots)) {
    if (!entityId) continue;
    const item = state.entities[entityId];
    const spec = getEquipmentSpec(item);
    if (!spec) continue;

    meleeDamageBonus += spec.meleeDamageBonus ?? 0;
    armorBonus += spec.armorBonus ?? 0;
    storageVolumeBonusMl += spec.storageVolumeBonusMl ?? 0;
    steamResistanceKpa += spec.steamResistanceKpa ?? 0;

    if (slot === 'WIELD' && spec.rangedRange > 0) {
      rangedRange = spec.rangedRange;
      rangedDamage = spec.rangedDamage;
      rangedSteamCostKpa = spec.rangedSteamCostKpa;
    }
  }

  return {
    meleeDamageBonus, armorBonus, storageVolumeBonusMl, steamResistanceKpa,
    rangedRange, rangedDamage, rangedSteamCostKpa,
  };
}

export function resolveEquipItem(
  state: WorldState,
  actorId: EntityId,
  itemEntityId: EntityId,
): { state: WorldState; events: SimEvent[]; apSpent: number } {
  const actor = state.entities[actorId];
  if (!actor?.inventory) return failEquipmentAction(state, actorId, 'Actor has no inventory.');
  if (!actor.inventory.containedEntityIds.includes(itemEntityId)) {
    return failEquipmentAction(state, actorId, 'Item is not in your inventory.');
  }

  const itemEntity = state.entities[itemEntityId];
  const spec = getEquipmentSpec(itemEntity);
  if (!spec) return failEquipmentAction(state, actorId, 'Item is not equippable.');

  const slot = spec.equipSlot;
  const currentOccupant = actor.inventory.equippedSlots?.[slot];
  if (currentOccupant && currentOccupant !== itemEntityId) {
    return failEquipmentAction(state, actorId, `Slot ${slot} is already occupied. Unequip current item first.`);
  }

  const nextEquippedSlots = { ...(actor.inventory.equippedSlots ?? {}), [slot]: itemEntityId };
  const nextMaxVolume = actor.inventory.maxVolumeMl + (spec.storageVolumeBonusMl ?? 0);
  const nextMeleeDamage = (actor.combatStats?.meleeDamage ?? 12) + (spec.meleeDamageBonus ?? 0);
  const nextArmor = (actor.combatStats?.armorReduction ?? 0) + (spec.armorBonus ?? 0);

  const updatedActor: EntityRecord = {
    ...actor,
    inventory: { ...actor.inventory, equippedSlots: nextEquippedSlots, maxVolumeMl: nextMaxVolume },
    combatStats: { meleeDamage: nextMeleeDamage, accuracyPct: actor.combatStats?.accuracyPct ?? 85, armorReduction: nextArmor },
  };

  return {
    state: { ...state, entities: { ...state.entities, [actorId]: updatedActor } },
    apSpent: STANDARD_ACTION_AP,
    events: [{
      type: 'ITEM_EQUIPPED',
      turn: state.turnCount + 1,
      actorId,
      itemEntityId,
      slot,
      itemName: itemEntity?.name ?? 'Unknown Item',
    }],
  };
}

export function resolveUnequipItem(
  state: WorldState,
  actorId: EntityId,
  slot: EquipmentSlot,
): { state: WorldState; events: SimEvent[]; apSpent: number } {
  const actor = state.entities[actorId];
  if (!actor?.inventory) return failEquipmentAction(state, actorId, 'Actor has no inventory.');

  const itemEntityId = actor.inventory.equippedSlots?.[slot];
  if (!itemEntityId) return failEquipmentAction(state, actorId, `No item equipped in slot ${slot}.`);

  const itemEntity = state.entities[itemEntityId];
  const spec = getEquipmentSpec(itemEntity);

  const remainingSlots = { ...(actor.inventory.equippedSlots ?? {}) };
  delete remainingSlots[slot];
  const nextMaxVolume = Math.max(1000, actor.inventory.maxVolumeMl - (spec?.storageVolumeBonusMl ?? 0));
  const nextMeleeDamage = Math.max(1, (actor.combatStats?.meleeDamage ?? 12) - (spec?.meleeDamageBonus ?? 0));
  const nextArmor = Math.max(0, (actor.combatStats?.armorReduction ?? 0) - (spec?.armorBonus ?? 0));

  const updatedActor: EntityRecord = {
    ...actor,
    inventory: { ...actor.inventory, equippedSlots: remainingSlots, maxVolumeMl: nextMaxVolume },
    combatStats: { meleeDamage: nextMeleeDamage, accuracyPct: actor.combatStats?.accuracyPct ?? 85, armorReduction: nextArmor },
  };

  return {
    state: { ...state, entities: { ...state.entities, [actorId]: updatedActor } },
    apSpent: STANDARD_ACTION_AP,
    events: [{
      type: 'ITEM_UNEQUIPPED',
      turn: state.turnCount + 1,
      actorId,
      itemEntityId,
      slot,
      itemName: itemEntity?.name ?? 'Unknown Item',
    }],
  };
}
