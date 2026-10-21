import { EntityRecord } from '../../schemas/components.schema.js';
import { SimEvent } from '../../schemas/events.schema.js';
import { EntityId, LiquidTypeId, Point3D } from '../../schemas/primitives.schema.js';
import { STANDARD_ACTION_AP } from '../core/scheduler.js';
import { WorldState } from '../core/world.js';
import { getTileCell, isWithinBounds, setTileCell } from '../spatial/grid.js';
import { resolveDamageLimb } from './anatomy.system.js';
import { resolveActorDefeatIfFatal } from './mortality.system.js';
import { emitAcousticPulse } from './stealth-acoustics.system.js';

export interface LiquidResult {
  readonly state: WorldState;
  readonly events: SimEvent[];
  readonly apSpent: number;
}

export function failLiquid(
  state: WorldState,
  actorId: EntityId,
  action: 'COAT_WEAPON' | 'THROW_FLASK' | 'CLEAN_SPILL',
  reason: string,
): LiquidResult {
  return {
    state,
    apSpent: STANDARD_ACTION_AP,
    events: [{ type: 'LIQUID_ACTION_FAILED', turn: state.turnCount + 1, actorId, action, reason }],
  };
}

export function resolveCoatWeapon(
  state: WorldState,
  actorId: EntityId,
  weaponEntityId: EntityId,
  liquidContainerId: EntityId,
): LiquidResult {
  const actor = state.entities[actorId];
  const weapon = state.entities[weaponEntityId];
  const container = state.entities[liquidContainerId];
  if (!actor || !weapon || !container) return failLiquid(state, actorId, 'COAT_WEAPON', 'Invalid entity references.');

  const hasWeapon = actor.inventory?.containedEntityIds.includes(weaponEntityId) || actor.inventory?.equippedSlots?.WIELD === weaponEntityId;
  const hasContainer = actor.inventory?.containedEntityIds.includes(liquidContainerId);
  if (!hasWeapon || !hasContainer) return failLiquid(state, actorId, 'COAT_WEAPON', 'Items must be carried.');

  const bp = container.item?.blueprintId.toLowerCase() ?? '';
  let liquidType: LiquidTypeId = 'NONE';
  if (bp.includes('acid') || bp.includes('nitric')) liquidType = 'NITRIC_ACID';
  else if (bp.includes('oil') || bp.includes('whale')) liquidType = 'WHALE_OIL';
  else if (bp.includes('sludge') || bp.includes('sluice')) liquidType = 'SLUICE_SLUDGE';
  else return failLiquid(state, actorId, 'COAT_WEAPON', 'Container does not hold coatable liquid.');

  const coatVolume = 100;
  const updatedSpec = weapon.equipmentSpec ? { ...weapon.equipmentSpec, coatedLiquid: { liquidType, volumeMl: coatVolume } } : undefined;
  const updatedItem = weapon.item ? { ...weapon.item, coatedLiquid: { liquidType, volumeMl: coatVolume }, equipmentSpec: updatedSpec } : undefined;
  const updatedWeapon: EntityRecord = { ...weapon, equipmentSpec: updatedSpec, item: updatedItem };

  const remainingContained = actor.inventory?.containedEntityIds.filter((id) => id !== liquidContainerId) ?? [];
  const updatedActor: EntityRecord = {
    ...actor,
    inventory: actor.inventory ? { ...actor.inventory, containedEntityIds: remainingContained } : undefined,
  };

  const nextEntities = { ...state.entities, [weaponEntityId]: updatedWeapon, [actorId]: updatedActor };
  delete nextEntities[liquidContainerId];

  const turn = state.turnCount + 1;
  const event: SimEvent = {
    type: 'ITEM_COATED',
    turn,
    actorId,
    itemEntityId: weaponEntityId,
    liquidType,
    volumeMl: coatVolume,
  };

  return { state: { ...state, entities: nextEntities }, events: [event], apSpent: 50 };
}

export function resolveThrowFlask(
  state: WorldState,
  actorId: EntityId,
  target: Point3D,
  flaskEntityId: EntityId,
): LiquidResult {
  const actor = state.entities[actorId];
  const flask = state.entities[flaskEntityId];
  if (!actor || !flask) return failLiquid(state, actorId, 'THROW_FLASK', 'Invalid actor or flask.');

  const hasFlask = actor.inventory?.containedEntityIds.includes(flaskEntityId);
  if (!hasFlask) return failLiquid(state, actorId, 'THROW_FLASK', 'Flask is not in inventory.');

  if (!actor.position || actor.position.stratum !== target.stratum) {
    return failLiquid(state, actorId, 'THROW_FLASK', 'Target is on a different stratum.');
  }

  const dist = Math.max(Math.abs(actor.position.x - target.x), Math.abs(actor.position.y - target.y));
  if (dist > 5) return failLiquid(state, actorId, 'THROW_FLASK', 'Target is out of throw range.');

  const grid = state.strata[target.stratum];
  if (!grid || !isWithinBounds(grid, target.x, target.y)) {
    return failLiquid(state, actorId, 'THROW_FLASK', 'Target is out of bounds.');
  }

  const bp = flask.item?.blueprintId.toLowerCase() ?? '';
  let liquidType: LiquidTypeId = 'WHALE_OIL';
  if (bp.includes('acid') || bp.includes('nitric')) liquidType = 'NITRIC_ACID';
  else if (bp.includes('blood')) liquidType = 'BLOOD';
  else if (bp.includes('sludge')) liquidType = 'SLUICE_SLUDGE';

  const cell = getTileCell(grid, target.x, target.y);
  const nextVol = (cell?.liquidType === liquidType ? (cell.liquidVolumeMl ?? 0) : 0) + 500;
  const nextGrid = setTileCell(grid, target.x, target.y, (c) => ({
    ...c,
    liquidType,
    liquidVolumeMl: nextVol,
  }));

  const remainingContained = actor.inventory?.containedEntityIds.filter((id) => id !== flaskEntityId) ?? [];
  const updatedActor: EntityRecord = {
    ...actor,
    inventory: actor.inventory ? { ...actor.inventory, containedEntityIds: remainingContained } : undefined,
  };

  let workingState: WorldState = {
    ...state,
    strata: { ...state.strata, [target.stratum]: nextGrid },
    entities: { ...state.entities, [actorId]: updatedActor },
  };
  delete workingState.entities[flaskEntityId];

  const turn = state.turnCount + 1;
  const events: SimEvent[] = [{
    type: 'LIQUID_SPILLED',
    turn,
    target,
    liquidType,
    volumeMl: 500,
    sourceActorId: actorId,
  }];

  if (liquidType === 'NITRIC_ACID') {
    for (const victim of Object.values(workingState.entities)) {
      if (victim.actor && victim.position && victim.position.stratum === target.stratum &&
          victim.position.x === target.x && victim.position.y === target.y) {
        const dmg = resolveDamageLimb(workingState, victim.id, 'TORSO', 12);
        workingState = dmg.state;
        events.push(...dmg.events);
        const def = resolveActorDefeatIfFatal(workingState, victim.id, actorId);
        workingState = def.state;
        events.push(...def.events);
        events.push({ type: 'ACID_CORROSION_TICK', turn, targetId: victim.id, damageInflicted: 12, at: target });
      }
    }
  }

  const pulse = emitAcousticPulse(workingState, target, 70, turn, actorId);
  return { state: pulse.state, events: [...events, ...pulse.events], apSpent: STANDARD_ACTION_AP };
}

export function resolveCleanSpill(
  state: WorldState,
  actorId: EntityId,
  target: Point3D,
  toolEntityId: EntityId,
): LiquidResult {
  const actor = state.entities[actorId];
  const tool = state.entities[toolEntityId];
  if (!actor || !tool) return failLiquid(state, actorId, 'CLEAN_SPILL', 'Invalid actor or tool.');

  const hasTool = actor.inventory?.containedEntityIds.includes(toolEntityId) || actor.inventory?.equippedSlots?.WIELD === toolEntityId;
  if (!hasTool) return failLiquid(state, actorId, 'CLEAN_SPILL', 'Cleaning tool not carried.');

  if (!actor.position || actor.position.stratum !== target.stratum) {
    return failLiquid(state, actorId, 'CLEAN_SPILL', 'Target is on a different stratum.');
  }

  const dist = Math.max(Math.abs(actor.position.x - target.x), Math.abs(actor.position.y - target.y));
  if (dist > 1) return failLiquid(state, actorId, 'CLEAN_SPILL', 'Target is too distant.');

  const grid = state.strata[target.stratum];
  if (!grid || !isWithinBounds(grid, target.x, target.y)) {
    return failLiquid(state, actorId, 'CLEAN_SPILL', 'Target is out of bounds.');
  }

  const cell = getTileCell(grid, target.x, target.y);
  if (!cell || cell.liquidType === 'NONE' || (cell.liquidVolumeMl ?? 0) <= 0) {
    return failLiquid(state, actorId, 'CLEAN_SPILL', 'No liquid pool present at target.');
  }

  const nextGrid = setTileCell(grid, target.x, target.y, (c) => ({
    ...c,
    liquidType: 'NONE',
    liquidVolumeMl: 0,
  }));

  const nextState: WorldState = { ...state, strata: { ...state.strata, [target.stratum]: nextGrid } };
  return { state: nextState, events: [], apSpent: STANDARD_ACTION_AP };
}
