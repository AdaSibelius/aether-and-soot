import { EntityRecord } from '../../schemas/components.schema.js';
import { SimEvent } from '../../schemas/events.schema.js';
import { EntityId, EntityIdSchema } from '../../schemas/primitives.schema.js';
import {
  BuildStructureCommand,
  ClaimWorkshopDeedCommand,
  RetrieveItemFromStructureCommand,
  StoreItemInStructureCommand,
  StructureType,
} from '../../schemas/safehouse-commands.schema.js';
import { SafehouseDeedRecord } from '../../schemas/safehouse-records.schema.js';
import { STANDARD_ACTION_AP } from '../core/scheduler.js';
import { WorldState } from '../core/world.js';
import { isWithinBounds } from '../spatial/grid.js';

function failSafehouse(
  state: WorldState,
  actorId: EntityId,
  action: 'CLAIM_DEED' | 'BUILD_STRUCTURE' | 'STORE_ITEM' | 'RETRIEVE_ITEM' | 'CONSULT_CODEX',
  reason: string,
): { state: WorldState; apSpent: number; events: SimEvent[] } {
  return {
    state,
    apSpent: STANDARD_ACTION_AP,
    events: [{ type: 'SAFEHOUSE_ACTION_FAILED', turn: state.turnCount + 1, actorId, action, reason }],
  };
}

export function resolveClaimWorkshopDeed(
  state: WorldState,
  cmd: ClaimWorkshopDeedCommand,
): { state: WorldState; apSpent: number; events: SimEvent[] } {
  const actor = state.entities[cmd.actorId];
  const turn = state.turnCount + 1;
  if (!actor || !actor.position) return failSafehouse(state, cmd.actorId, 'CLAIM_DEED', 'Actor has no spatial position');

  const stratum = cmd.targetStratum ?? actor.position.stratum;
  const isVault = cmd.claimVault ?? (stratum === 'UNDERCROFT');
  const deedKey = `deed_${stratum.toLowerCase()}_${isVault ? 'vault' : 'workshop'}_${cmd.actorId}`;

  if (state.safehouses[deedKey]) {
    return failSafehouse(state, cmd.actorId, 'CLAIM_DEED', 'Deed already registered for this location');
  }

  const radius = isVault ? 8 : 10;
  const bounds = {
    xMin: Math.max(0, actor.position.x - radius),
    xMax: actor.position.x + radius,
    yMin: Math.max(0, actor.position.y - radius),
    yMax: actor.position.y + radius,
  };

  const name = isVault ? 'Undercroft Vault Workshop' : 'Freehold Artificer Workshop';
  const record: SafehouseDeedRecord = {
    deedId: deedKey,
    name,
    ownerId: cmd.actorId,
    stratum,
    bounds,
    isVault,
    claimedTurn: turn,
  };

  const updatedSafehouses = { ...state.safehouses, [deedKey]: record };
  return {
    state: { ...state, safehouses: updatedSafehouses },
    apSpent: STANDARD_ACTION_AP,
    events: [{
      type: 'WORKSHOP_DEED_CLAIMED',
      turn,
      actorId: cmd.actorId,
      deedId: deedKey,
      stratum,
      vaultClaimed: isVault,
      safehouseName: name,
    }],
  };
}

const STRUCTURE_DEFS: Record<StructureType, {
  name: string; glyph: string; fgPrimary: string; fgSecondary: string; blocksMovement: boolean;
  stationType?: 'ARTIFICER_BENCH'; hasVessel?: boolean;
}> = {
  SURGICAL_TABLE: { name: 'Surgical Operating Table', glyph: 'T', fgPrimary: '#E74C3C', fgSecondary: '#C0392B', blocksMovement: false },
  ARTIFICER_BENCH: { name: 'Master Artificer Workbench', glyph: 'W', fgPrimary: '#F39C12', fgSecondary: '#D68910', blocksMovement: false, stationType: 'ARTIFICER_BENCH' },
  STEAM_CHARGER: { name: 'High-Pressure Steam Charger', glyph: 'C', fgPrimary: '#3498DB', fgSecondary: '#2980B9', blocksMovement: false, hasVessel: true },
  BARRICADE_WOOD: { name: 'Reinforced Timber Barricade', glyph: '#', fgPrimary: '#8D6E63', fgSecondary: '#5D4037', blocksMovement: true },
  BARRICADE_IRON: { name: 'Iron-Plated Barricade', glyph: '#', fgPrimary: '#95A5A6', fgSecondary: '#7F8C8D', blocksMovement: true },
};

export function resolveBuildStructure(
  state: WorldState,
  cmd: BuildStructureCommand,
): { state: WorldState; apSpent: number; events: SimEvent[] } {
  const actor = state.entities[cmd.actorId];
  const turn = state.turnCount + 1;
  if (!actor || !actor.position) return failSafehouse(state, cmd.actorId, 'BUILD_STRUCTURE', 'Actor has no position');

  const grid = state.strata[cmd.target.stratum];
  if (!grid || !isWithinBounds(grid, cmd.target.x, cmd.target.y)) {
    return failSafehouse(state, cmd.actorId, 'BUILD_STRUCTURE', 'Target tile is outside district bounds');
  }

  const dist = Math.max(Math.abs(actor.position.x - cmd.target.x), Math.abs(actor.position.y - cmd.target.y));
  if (dist > 1) {
    return failSafehouse(state, cmd.actorId, 'BUILD_STRUCTURE', 'Target tile is too distant to construct');
  }

  const details = STRUCTURE_DEFS[cmd.structureType];
  const structureId = EntityIdSchema.parse(`structure_${cmd.structureType.toLowerCase()}_${turn}_${cmd.target.x}_${cmd.target.y}`);

  const structureEntity: EntityRecord = {
    id: structureId,
    name: details.name,
    visual: { glyph: details.glyph, fgPrimary: details.fgPrimary, fgSecondary: details.fgSecondary, bgColor: '#0A0D0E', shaderFlags: [] },
    position: { x: cmd.target.x, y: cmd.target.y, stratum: cmd.target.stratum, blocksMovement: details.blocksMovement, blocksSight: false },
    furniture: { kind: cmd.structureType, label: details.name, durabilityHp: details.blocksMovement ? 100 : undefined },
    inventory: ['SURGICAL_TABLE', 'ARTIFICER_BENCH', 'STEAM_CHARGER'].includes(cmd.structureType)
      ? { maxMassGrams: 80000, maxVolumeMl: 60000, currentMassGrams: 0, containedEntityIds: [] }
      : undefined,
    workbench: details.stationType ? { stationType: details.stationType, bonusEfficiencyPct: 35 } : undefined,
    pressureVessel: details.hasVessel ? { maxPressureKpa: 250, currentPressureKpa: 200, ruptured: false } : undefined,
  };

  const updatedEntities = { ...state.entities, [structureId]: structureEntity };
  return {
    state: { ...state, entities: updatedEntities },
    apSpent: STANDARD_ACTION_AP,
    events: [{
      type: 'STRUCTURE_BUILT',
      turn,
      actorId: cmd.actorId,
      structureType: cmd.structureType,
      structureEntityId: structureId,
      position: cmd.target,
    }],
  };
}

export function resolveStoreItemInStructure(
  state: WorldState,
  cmd: StoreItemInStructureCommand,
): { state: WorldState; apSpent: number; events: SimEvent[] } {
  const actor = state.entities[cmd.actorId];
  const structure = state.entities[cmd.structureEntityId];
  const item = state.entities[cmd.itemEntityId];
  const turn = state.turnCount + 1;

  if (!actor || !actor.inventory) return failSafehouse(state, cmd.actorId, 'STORE_ITEM', 'Actor has no inventory');
  if (!structure || !structure.inventory) return failSafehouse(state, cmd.actorId, 'STORE_ITEM', 'Structure has no persistent storage capacity');
  if (!item) return failSafehouse(state, cmd.actorId, 'STORE_ITEM', 'Item entity not found');
  if (!actor.inventory.containedEntityIds.includes(cmd.itemEntityId)) {
    return failSafehouse(state, cmd.actorId, 'STORE_ITEM', 'Item is not in actor inventory');
  }

  const updatedActorInv = {
    ...actor.inventory,
    containedEntityIds: actor.inventory.containedEntityIds.filter((id) => id !== cmd.itemEntityId),
    currentMassGrams: Math.max(0, actor.inventory.currentMassGrams - (item.item?.massGrams ?? 0)),
  };
  const updatedStructureInv = {
    ...structure.inventory,
    containedEntityIds: [...structure.inventory.containedEntityIds, cmd.itemEntityId],
    currentMassGrams: structure.inventory.currentMassGrams + (item.item?.massGrams ?? 0),
  };

  const updatedEntities = {
    ...state.entities,
    [cmd.actorId]: { ...actor, inventory: updatedActorInv },
    [cmd.structureEntityId]: { ...structure, inventory: updatedStructureInv },
  };

  return {
    state: { ...state, entities: updatedEntities },
    apSpent: STANDARD_ACTION_AP,
    events: [{
      type: 'STRUCTURE_STORAGE_UPDATED',
      turn,
      actorId: cmd.actorId,
      structureEntityId: cmd.structureEntityId,
      itemEntityId: cmd.itemEntityId,
      action: 'STORE',
      itemCount: updatedStructureInv.containedEntityIds.length,
    }],
  };
}

export function resolveRetrieveItemFromStructure(
  state: WorldState,
  cmd: RetrieveItemFromStructureCommand,
): { state: WorldState; apSpent: number; events: SimEvent[] } {
  const actor = state.entities[cmd.actorId];
  const structure = state.entities[cmd.structureEntityId];
  const item = state.entities[cmd.itemEntityId];
  const turn = state.turnCount + 1;

  if (!actor || !actor.inventory) return failSafehouse(state, cmd.actorId, 'RETRIEVE_ITEM', 'Actor has no inventory');
  if (!structure || !structure.inventory) return failSafehouse(state, cmd.actorId, 'RETRIEVE_ITEM', 'Structure has no inventory');
  if (!item) return failSafehouse(state, cmd.actorId, 'RETRIEVE_ITEM', 'Item entity not found');
  if (!structure.inventory.containedEntityIds.includes(cmd.itemEntityId)) {
    return failSafehouse(state, cmd.actorId, 'RETRIEVE_ITEM', 'Item is not in structure storage');
  }

  const updatedStructureInv = {
    ...structure.inventory,
    containedEntityIds: structure.inventory.containedEntityIds.filter((id) => id !== cmd.itemEntityId),
    currentMassGrams: Math.max(0, structure.inventory.currentMassGrams - (item.item?.massGrams ?? 0)),
  };
  const updatedActorInv = {
    ...actor.inventory,
    containedEntityIds: [...actor.inventory.containedEntityIds, cmd.itemEntityId],
    currentMassGrams: actor.inventory.currentMassGrams + (item.item?.massGrams ?? 0),
  };

  const updatedEntities = {
    ...state.entities,
    [cmd.actorId]: { ...actor, inventory: updatedActorInv },
    [cmd.structureEntityId]: { ...structure, inventory: updatedStructureInv },
  };

  return {
    state: { ...state, entities: updatedEntities },
    apSpent: STANDARD_ACTION_AP,
    events: [{
      type: 'STRUCTURE_STORAGE_UPDATED',
      turn,
      actorId: cmd.actorId,
      structureEntityId: cmd.structureEntityId,
      itemEntityId: cmd.itemEntityId,
      action: 'RETRIEVE',
      itemCount: updatedStructureInv.containedEntityIds.length,
    }],
  };
}
