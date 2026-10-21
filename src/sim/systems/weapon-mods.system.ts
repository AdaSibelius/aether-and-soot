import { EntityRecord } from '../../schemas/components.schema.js';
import { EquipmentSpec } from '../../schemas/equipment.schema.js';
import { SimEvent } from '../../schemas/events.schema.js';
import { BlueprintId, EntityId } from '../../schemas/primitives.schema.js';
import { STANDARD_ACTION_AP } from '../core/scheduler.js';
import { WorldState } from '../core/world.js';
import { createEntityFromBlueprint } from '../data/item-catalog.js';
import { getEquipmentSpec } from './equipment.system.js';

export { resolvePryObstacle } from './prying.system.js';

export interface WeaponModResult {
  readonly state: WorldState;
  readonly events: SimEvent[];
  readonly apSpent: number;
}

function failModAction(
  state: WorldState,
  actorId: EntityId,
  action: 'INSTALL_MOD' | 'UNINSTALL_MOD' | 'LOAD_AMMO' | 'PRY_OBSTACLE',
  reason: string,
): WeaponModResult {
  return {
    state,
    apSpent: STANDARD_ACTION_AP,
    events: [{ type: 'WEAPON_MOD_ACTION_FAILED', turn: state.turnCount + 1, actorId, action, reason }],
  };
}

/** Attaches a Victorian weapon modification to an equipped or carried weapon. */
export function resolveInstallWeaponMod(
  state: WorldState,
  actorId: EntityId,
  weaponEntityId: EntityId,
  modEntityId: EntityId,
): WeaponModResult {
  const actor = state.entities[actorId];
  const weapon = state.entities[weaponEntityId];
  const mod = state.entities[modEntityId];
  if (!actor || !weapon || !mod) return failModAction(state, actorId, 'INSTALL_MOD', 'Invalid entity references.');

  const hasWeapon = actor.inventory?.containedEntityIds.includes(weaponEntityId) || actor.inventory?.equippedSlots?.WIELD === weaponEntityId;
  const hasMod = actor.inventory?.containedEntityIds.includes(modEntityId);
  if (!hasWeapon || !hasMod) return failModAction(state, actorId, 'INSTALL_MOD', 'Weapon or mod not carried in inventory.');

  const weaponSpec = getEquipmentSpec(weapon);
  if (!weaponSpec || (weaponSpec.modSlots ?? 0) <= 0) {
    return failModAction(state, actorId, 'INSTALL_MOD', 'Weapon possesses no modification slots.');
  }

  const installed = weapon.equipmentSpec?.installedModBlueprintIds ?? [];
  const maxSlots = weaponSpec.modSlots ?? 0;
  if (installed.length >= maxSlots) {
    return failModAction(state, actorId, 'INSTALL_MOD', 'All modification slots are occupied.');
  }

  const modBlueprintId = mod.item?.blueprintId;
  if (!modBlueprintId) return failModAction(state, actorId, 'INSTALL_MOD', 'Item is not a valid weapon mod.');
  if (installed.includes(modBlueprintId)) {
    return failModAction(state, actorId, 'INSTALL_MOD', 'This modification is already attached.');
  }

  const modSpec = mod.equipmentSpec?.weaponModSpec ?? mod.item?.equipmentSpec?.weaponModSpec;
  const updatedSpec: EquipmentSpec = {
    ...weaponSpec,
    rangedRange: Math.max(1, (weaponSpec.rangedRange ?? 0) + (modSpec?.rangeModifier ?? 0)),
    rangedDamage: Math.max(1, (weaponSpec.rangedDamage ?? 0) + (modSpec?.damageModifier ?? 0)),
    rangedSteamCostKpa: Math.max(0, (weaponSpec.rangedSteamCostKpa ?? 0) + (modSpec?.steamCostModifier ?? 0)),
    installedModBlueprintIds: [...installed, modBlueprintId],
  };

  const updatedWeapon: EntityRecord = {
    ...weapon,
    equipmentSpec: updatedSpec,
    item: weapon.item ? { ...weapon.item, equipmentSpec: updatedSpec } : undefined,
  };

  const remainingContained = actor.inventory?.containedEntityIds.filter((id) => id !== modEntityId) ?? [];
  const updatedActor: EntityRecord = {
    ...actor,
    inventory: actor.inventory ? { ...actor.inventory, containedEntityIds: remainingContained } : undefined,
  };

  const nextEntities = { ...state.entities, [weaponEntityId]: updatedWeapon, [actorId]: updatedActor };
  delete nextEntities[modEntityId];

  const turn = state.turnCount + 1;
  const installEvent: SimEvent = {
    type: 'WEAPON_MOD_INSTALLED',
    turn,
    actorId,
    weaponEntityId,
    modBlueprintId,
    remainingModSlots: maxSlots - (installed.length + 1),
  };

  return { state: { ...state, entities: nextEntities }, events: [installEvent], apSpent: STANDARD_ACTION_AP };
}

/** Detaches an installed modification and returns it to the actor's inventory. */
export function resolveUninstallWeaponMod(
  state: WorldState,
  actorId: EntityId,
  weaponEntityId: EntityId,
  modBlueprintId: BlueprintId,
): WeaponModResult {
  const actor = state.entities[actorId];
  const weapon = state.entities[weaponEntityId];
  if (!actor || !weapon) return failModAction(state, actorId, 'UNINSTALL_MOD', 'Invalid entity references.');

  const installed = weapon.equipmentSpec?.installedModBlueprintIds ?? [];
  if (!installed.includes(modBlueprintId)) {
    return failModAction(state, actorId, 'UNINSTALL_MOD', 'Specified mod is not attached to this weapon.');
  }

  const weaponSpec = getEquipmentSpec(weapon)!;
  const updatedSpec: EquipmentSpec = {
    ...weaponSpec,
    installedModBlueprintIds: installed.filter((id) => id !== modBlueprintId),
  };

  const restoredModId = `${modBlueprintId}_${state.turnCount + 1}` as EntityId;
  const restoredMod: EntityRecord = createEntityFromBlueprint(modBlueprintId, restoredModId) ?? {
    id: restoredModId,
    name: String(modBlueprintId),
    visual: { glyph: '*', fgPrimary: '#D4AF37', fgSecondary: '#BA4A00', bgColor: '#0A0D0E', shaderFlags: [] },
    item: {
      blueprintId: modBlueprintId,
      category: 'MATERIAL',
      massGrams: 500,
      volumeMl: 500,
      quantity: 1,
      stackable: false,
    },
  };

  const updatedWeapon: EntityRecord = {
    ...weapon,
    equipmentSpec: updatedSpec,
    item: weapon.item ? { ...weapon.item, equipmentSpec: updatedSpec } : undefined,
  };

  const updatedActor: EntityRecord = {
    ...actor,
    inventory: actor.inventory
      ? { ...actor.inventory, containedEntityIds: [...actor.inventory.containedEntityIds, restoredModId] }
      : undefined,
  };

  const nextEntities = {
    ...state.entities,
    [weaponEntityId]: updatedWeapon,
    [actorId]: updatedActor,
    [restoredModId]: restoredMod,
  };

  const turn = state.turnCount + 1;
  const uninstallEvent: SimEvent = {
    type: 'WEAPON_MOD_UNINSTALLED',
    turn,
    actorId,
    weaponEntityId,
    modBlueprintId,
    restoredEntityId: restoredModId,
  };

  return { state: { ...state, entities: nextEntities }, events: [uninstallEvent], apSpent: STANDARD_ACTION_AP };
}

/** Loads specialized ammunition into the weapon's firing chamber. */
export function resolveLoadAmmo(
  state: WorldState,
  actorId: EntityId,
  weaponEntityId: EntityId,
  ammoEntityId: EntityId,
): WeaponModResult {
  const actor = state.entities[actorId];
  const weapon = state.entities[weaponEntityId];
  const ammo = state.entities[ammoEntityId];
  if (!actor || !weapon || !ammo) return failModAction(state, actorId, 'LOAD_AMMO', 'Invalid entity references.');

  const weaponSpec = getEquipmentSpec(weapon);
  if (!weaponSpec || weaponSpec.rangedRange <= 0) {
    return failModAction(state, actorId, 'LOAD_AMMO', 'Item is not a ranged weapon.');
  }

  const ammoBlueprintId = ammo.item?.blueprintId;
  if (!ammoBlueprintId) return failModAction(state, actorId, 'LOAD_AMMO', 'Invalid ammunition.');

  const qty = ammo.item?.quantity ?? 1;
  const currentLoaded = weapon.equipmentSpec?.loadedAmmo;
  const newCount = (currentLoaded && currentLoaded.blueprintId === ammoBlueprintId ? currentLoaded.count : 0) + qty;

  const updatedSpec: EquipmentSpec = {
    ...weaponSpec,
    loadedAmmo: { blueprintId: ammoBlueprintId, count: newCount },
  };

  const updatedWeapon: EntityRecord = {
    ...weapon,
    equipmentSpec: updatedSpec,
    item: weapon.item ? { ...weapon.item, equipmentSpec: updatedSpec } : undefined,
  };

  const remainingContained = actor.inventory?.containedEntityIds.filter((id) => id !== ammoEntityId) ?? [];
  const updatedActor: EntityRecord = {
    ...actor,
    inventory: actor.inventory ? { ...actor.inventory, containedEntityIds: remainingContained } : undefined,
  };

  const nextEntities = { ...state.entities, [weaponEntityId]: updatedWeapon, [actorId]: updatedActor };
  delete nextEntities[ammoEntityId];

  const turn = state.turnCount + 1;
  const loadEvent: SimEvent = {
    type: 'AMMO_LOADED',
    turn,
    actorId,
    weaponEntityId,
    ammoBlueprintId,
    ammoCount: newCount,
  };

  return { state: { ...state, entities: nextEntities }, events: [loadEvent], apSpent: 50 };
}
