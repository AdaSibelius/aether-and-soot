import { SimEvent } from '../../schemas/events.schema.js';
import { EntityId, Point3D } from '../../schemas/primitives.schema.js';
import { STANDARD_ACTION_AP } from '../core/scheduler.js';
import { WorldState } from '../core/world.js';
import { getTileCell, isWithinBounds, setTileCell } from '../spatial/grid.js';
import { emitAcousticPulse } from './stealth-acoustics.system.js';

export interface PryObstacleResult {
  readonly state: WorldState;
  readonly events: SimEvent[];
  readonly apSpent: number;
}

function failPry(state: WorldState, actorId: EntityId, reason: string): PryObstacleResult {
  return {
    state,
    apSpent: STANDARD_ACTION_AP,
    events: [{ type: 'WEAPON_MOD_ACTION_FAILED', turn: state.turnCount + 1, actorId, action: 'PRY_OBSTACLE', reason }],
  };
}

/** Uses a prying tool (e.g. crowbar or heavy wrench) to force open doors or barriers. */
export function resolvePryObstacle(
  state: WorldState,
  actorId: EntityId,
  target: Point3D,
  toolEntityId: EntityId,
): PryObstacleResult {
  const actor = state.entities[actorId];
  const tool = state.entities[toolEntityId];
  if (!actor || !tool) return failPry(state, actorId, 'Invalid actor or tool.');

  const toolCarried = actor.inventory?.containedEntityIds.includes(toolEntityId) || actor.inventory?.equippedSlots?.WIELD === toolEntityId;
  if (!toolCarried) return failPry(state, actorId, 'Prying tool is not carried.');

  const pryQuality = tool.item?.toolQualities?.PRYING ?? (
    tool.name.toLowerCase().includes('crowbar') ? 2 :
    tool.name.toLowerCase().includes('wrench') ? 1 : 0
  );
  if (pryQuality < 1) return failPry(state, actorId, 'Tool possesses insufficient prying quality.');

  if (!actor.position || actor.position.stratum !== target.stratum) {
    return failPry(state, actorId, 'Target is on a different stratum.');
  }

  const dist = Math.max(Math.abs(actor.position.x - target.x), Math.abs(actor.position.y - target.y));
  if (dist > 1) return failPry(state, actorId, 'Target is too distant.');

  const grid = state.strata[target.stratum];
  if (!grid || !isWithinBounds(grid, target.x, target.y)) {
    return failPry(state, actorId, 'Target is out of stratum bounds.');
  }

  const cell = getTileCell(grid, target.x, target.y);
  if (!cell) return failPry(state, actorId, 'Target cell does not exist.');

  let toTerrain: string;
  if (cell.terrainType === 'WOODEN_DOOR_CLOSED') {
    toTerrain = 'WOODEN_DOOR_OPEN';
  } else if (cell.terrainType === 'DISTRICT_GATE' && pryQuality >= 2) {
    toTerrain = 'COBBLESTONE_FLOOR';
  } else {
    return failPry(state, actorId, 'Obstacle cannot be pried open with this tool quality.');
  }

  const nextGrid = setTileCell(grid, target.x, target.y, (c) => ({
    ...c,
    terrainType: toTerrain as typeof c.terrainType,
    blocksMovement: false,
    blocksSight: false,
  }));

  const nextState: WorldState = { ...state, strata: { ...state.strata, [target.stratum]: nextGrid } };
  const turn = state.turnCount + 1;
  const pryEvent: SimEvent = {
    type: 'OBSTACLE_PRIED',
    turn,
    actorId,
    target,
    toolEntityId,
    toolQuality: pryQuality,
    fromTerrain: cell.terrainType,
    toTerrain,
  };

  const pulse = emitAcousticPulse(nextState, target, 65, turn, actorId);
  return { state: pulse.state, events: [pryEvent, ...pulse.events], apSpent: STANDARD_ACTION_AP };
}
