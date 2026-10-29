import { SimEvent } from '../../schemas/events.schema.js';
import { EntityId, Point3D } from '../../schemas/primitives.schema.js';
import { findBlockingEntityAtPoint, setTileCell } from '../spatial/grid.js';
import { WorldState } from '../core/world.js';

export interface DoorResolutionResult {
  readonly state: WorldState;
  readonly events: SimEvent[];
  readonly apSpent: number;
}

function failDoorToggle(
  state: WorldState,
  turn: number,
  actorId: EntityId,
  reason: 'NOT_A_DOOR' | 'OUT_OF_RANGE' | 'BLOCKED_BY_ENTITY',
): DoorResolutionResult {
  return {
    state,
    events: [{ type: 'TRANSIT_ACTION_FAILED', turn, actorId, action: 'TOGGLE_DOOR', reason }],
    apSpent: 0,
  };
}

/**
 * Opens or closes a wooden door at adjacent target point.
 * Closed doors block movement, sight (FOV), and steam diffusion; open doors allow all three.
 */
export function resolveToggleDoor(
  state: WorldState,
  actorId: EntityId,
  target: Point3D,
): DoorResolutionResult {
  const actor = state.entities[actorId];
  const actorPos = actor?.position;
  const currentTurn = state.turnCount + 1;

  if (!actorPos || actorPos.stratum !== target.stratum) {
    return failDoorToggle(state, currentTurn, actorId, 'OUT_OF_RANGE');
  }

  const dist = Math.max(Math.abs(actorPos.x - target.x), Math.abs(actorPos.y - target.y));
  if (dist > 1) {
    return failDoorToggle(state, currentTurn, actorId, 'OUT_OF_RANGE');
  }

  const grid = state.strata[target.stratum];
  if (!grid) {
    return failDoorToggle(state, currentTurn, actorId, 'NOT_A_DOOR');
  }

  const cell = grid.cells[target.y * grid.width + target.x];
  if (!cell || (cell.terrainType !== 'WOODEN_DOOR_CLOSED' && cell.terrainType !== 'WOODEN_DOOR_OPEN')) {
    return failDoorToggle(state, currentTurn, actorId, 'NOT_A_DOOR');
  }

  if (cell.terrainType === 'WOODEN_DOOR_CLOSED') {
    const updatedGrid = setTileCell(grid, target.x, target.y, (prev) => ({
      ...prev,
      terrainType: 'WOODEN_DOOR_OPEN',
      blocksMovement: false,
      blocksSight: false,
    }));
    return {
      state: { ...state, strata: { ...state.strata, [target.stratum]: updatedGrid } },
      events: [{ type: 'DOOR_TOGGLED', turn: currentTurn, actorId, at: target, newState: 'OPEN' }],
      apSpent: 100,
    };
  }

  if (findBlockingEntityAtPoint(state.entities, target)) {
    return failDoorToggle(state, currentTurn, actorId, 'BLOCKED_BY_ENTITY');
  }

  const updatedGrid = setTileCell(grid, target.x, target.y, (prev) => ({
    ...prev,
    terrainType: 'WOODEN_DOOR_CLOSED',
    blocksMovement: true,
    blocksSight: true,
  }));
  return {
    state: { ...state, strata: { ...state.strata, [target.stratum]: updatedGrid } },
    events: [{ type: 'DOOR_TOGGLED', turn: currentTurn, actorId, at: target, newState: 'CLOSED' }],
    apSpent: 100,
  };
}
