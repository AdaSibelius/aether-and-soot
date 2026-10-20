import { EntityRecord, PositionComponent } from '../../schemas/components.schema.js';
import { SimEvent } from '../../schemas/events.schema.js';
import { BlueprintId, EntityId, Point3D } from '../../schemas/primitives.schema.js';
import { findBlockingEntityAtPoint, setTileCell } from '../spatial/grid.js';
import { WorldState } from '../core/world.js';
import { generateVictorianDistrict } from '../spatial/generator.js';
import { spawnDistrictItems } from './item-spawner.js';
import { spawnDistrictNpcs } from './district-spawner.js';
import { catchUpDistrictState } from './district-catchup.system.js';

export const VALID_DISTRICT_IDS: ReadonlySet<string> = new Set([
  'district_spitalfields_soot_works',
  'district_fleet_ditch_undercroft',
  'district_belgravia_brass_spires',
  'district_whitechapel_ward',
  'district_limehouse_docks',
]);

export interface TransitResolutionResult {
  readonly state: WorldState;
  readonly events: SimEvent[];
  readonly apSpent: number;
}

function failTransit(
  state: WorldState,
  turn: number,
  actorId: EntityId,
  action: 'TOGGLE_DOOR' | 'TRAVEL_DISTRICT',
  reason: 'NOT_A_DOOR' | 'OUT_OF_RANGE' | 'BLOCKED_BY_ENTITY' | 'UNKNOWN_DISTRICT' | 'ALREADY_IN_DISTRICT' | 'NO_GATE_AT_POSITION',
): TransitResolutionResult {
  return {
    state,
    events: [{ type: 'TRANSIT_ACTION_FAILED', turn, actorId, action, reason }],
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
): TransitResolutionResult {
  const actor = state.entities[actorId];
  const actorPos = actor?.position;
  const currentTurn = state.turnCount + 1;

  if (!actorPos || actorPos.stratum !== target.stratum) {
    return failTransit(state, currentTurn, actorId, 'TOGGLE_DOOR', 'OUT_OF_RANGE');
  }

  const dist = Math.max(Math.abs(actorPos.x - target.x), Math.abs(actorPos.y - target.y));
  if (dist > 1) {
    return failTransit(state, currentTurn, actorId, 'TOGGLE_DOOR', 'OUT_OF_RANGE');
  }

  const grid = state.strata[target.stratum];
  if (!grid) {
    return failTransit(state, currentTurn, actorId, 'TOGGLE_DOOR', 'NOT_A_DOOR');
  }

  const cell = grid.cells[target.y * grid.width + target.x];
  if (!cell || (cell.terrainType !== 'WOODEN_DOOR_CLOSED' && cell.terrainType !== 'WOODEN_DOOR_OPEN')) {
    return failTransit(state, currentTurn, actorId, 'TOGGLE_DOOR', 'NOT_A_DOOR');
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
    return failTransit(state, currentTurn, actorId, 'TOGGLE_DOOR', 'BLOCKED_BY_ENTITY');
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

/**
 * Traverses an adjacent District Gate to an external district, generating the new district map
 * while preserving the player actor, carried inventory items, and installed prosthetics.
 */
export function resolveTravelDistrict(
  state: WorldState,
  actorId: EntityId,
  targetDistrictId: BlueprintId,
): TransitResolutionResult {
  const actor = state.entities[actorId];
  const actorPos = actor?.position;
  const currentTurn = state.turnCount + 1;

  if (!actorPos) {
    return failTransit(state, currentTurn, actorId, 'TRAVEL_DISTRICT', 'NO_GATE_AT_POSITION');
  }
  if (targetDistrictId === state.currentDistrictId) {
    return failTransit(state, currentTurn, actorId, 'TRAVEL_DISTRICT', 'ALREADY_IN_DISTRICT');
  }
  if (!VALID_DISTRICT_IDS.has(targetDistrictId)) {
    return failTransit(state, currentTurn, actorId, 'TRAVEL_DISTRICT', 'UNKNOWN_DISTRICT');
  }

  const matchingGate = Object.values(state.entities).find((e) => {
    if (!e.districtGate || !e.position || e.position.stratum !== actorPos.stratum) return false;
    const dist = Math.max(Math.abs(e.position.x - actorPos.x), Math.abs(e.position.y - actorPos.y));
    return dist <= 1 && e.districtGate.targetDistrictId === targetDistrictId;
  });

  if (!matchingGate || !matchingGate.districtGate) {
    return failTransit(state, currentTurn, actorId, 'TRAVEL_DISTRICT', 'NO_GATE_AT_POSITION');
  }

  const fromDistrictId = state.currentDistrictId;

  // Preserve player, carried inventory items, and installed prosthetics
  const preservedEntities: Record<string, EntityRecord> = { [actorId]: actor };
  for (const invId of actor.inventory?.containedEntityIds ?? []) {
    const item = state.entities[invId];
    if (item) preservedEntities[invId] = item;
  }
  for (const limb of Object.values(actor.anatomy?.limbs ?? {})) {
    if (limb.installedProstheticEntityId) {
      const p = state.entities[limb.installedProstheticEntityId];
      if (p) preservedEntities[limb.installedProstheticEntityId] = p;
    }
  }

  if (!state.strata.UNDERCROFT || !state.strata.STREET || !state.strata.SPIRE) {
    return failTransit(state, currentTurn, actorId, 'TRAVEL_DISTRICT', 'NO_GATE_AT_POSITION');
  }

  // Snapshot departing district entities & strata
  const leavingEntities: Record<string, EntityRecord> = {};
  for (const [id, ent] of Object.entries(state.entities)) {
    if (!preservedEntities[id]) {
      leavingEntities[id] = ent;
    }
  }
  const updatedSavedDistricts = {
    ...state.savedDistricts,
    [fromDistrictId]: {
      strata: {
        UNDERCROFT: state.strata.UNDERCROFT,
        STREET: state.strata.STREET,
        SPIRE: state.strata.SPIRE,
      },
      entities: leavingEntities,
      lastSimulatedTurn: state.turnCount,
    },
  };

  const cachedTarget = updatedSavedDistricts[targetDistrictId];
  let nextStrata: WorldState['strata'];
  let nextEntities: Record<string, EntityRecord>;
  let arrivalPos: PositionComponent;

  if (cachedTarget) {
    const caughtUp = catchUpDistrictState(cachedTarget, state.turnCount);
    nextStrata = caughtUp.strata;
    nextEntities = {
      ...caughtUp.entities,
      ...preservedEntities,
    };
    const arrivalGate = Object.values(nextEntities).find(
      (e) => e.districtGate && e.districtGate.targetDistrictId === fromDistrictId && e.position,
    );
    const streetGrid = nextStrata.STREET;
    arrivalPos = arrivalGate?.position ?? {
      x: streetGrid ? Math.floor(streetGrid.width / 2) : 12,
      y: streetGrid ? Math.floor(streetGrid.height / 2) : 10,
      stratum: 'STREET',
      blocksMovement: true,
      blocksSight: false,
    };
  } else {
    const genResult = generateVictorianDistrict({
      ...state,
      currentDistrictId: targetDistrictId,
      entities: preservedEntities,
    });
    const withItems = spawnDistrictItems(genResult.state);
    const withNpcs = spawnDistrictNpcs(withItems.state);
    nextStrata = withNpcs.state.strata;
    nextEntities = withNpcs.state.entities;
    const arrivalGate = Object.values(nextEntities).find(
      (e) => e.districtGate && e.districtGate.targetDistrictId === fromDistrictId && e.position,
    );
    arrivalPos = arrivalGate?.position ?? {
      x: genResult.landmarks.streetManhole.x,
      y: genResult.landmarks.streetManhole.y,
      stratum: 'STREET',
      blocksMovement: true,
      blocksSight: false,
    };
  }

  const nextState: WorldState = {
    ...state,
    currentDistrictId: targetDistrictId,
    strata: nextStrata,
    savedDistricts: updatedSavedDistricts,
    entities: {
      ...nextEntities,
      [actorId]: {
        ...actor,
        position: { ...arrivalPos, blocksMovement: true, blocksSight: false },
      },
    },
  };

  return {
    state: nextState,
    events: [{ type: 'DISTRICT_TRAVELED', turn: currentTurn, actorId, fromDistrictId, toDistrictId: targetDistrictId }],
    apSpent: matchingGate.districtGate.apCost,
  };
}
