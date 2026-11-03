import { EntityRecord, PositionComponent } from '../../schemas/components.schema.js';
import { SimEvent } from '../../schemas/events.schema.js';
import { BlueprintId, BlueprintIdSchema, EntityId, Point2D, Point3D, StratumId } from '../../schemas/primitives.schema.js';
import { SeededRNG } from '../core/rng.js';
import { SavedDistrictSnapshot, WorldState } from '../core/world.js';
import { CompassDir, resolveCompassAdjacency } from '../spatial/compass-gates.js';
import { METROPOLIS_DISTRICT_DOSSIERS } from '../spatial/overworld-matrix.js';
import { computeDistrictBoundarySeams, isEdgeSeamTraversable } from '../spatial/district-boundaries.js';
import { findBlockingEntityAtPoint, getTileCell, isWithinBounds, StratumGrid } from '../spatial/grid.js';
import { generateVictorianDistrict } from '../spatial/generator.js';
import { syncActorChunkWindow } from '../spatial/chunk-streamer.js';
import { spawnDistrictItems } from './item-spawner.js';
import { spawnDistrictNpcs } from './district-spawner.js';
import { catchUpDistrictState } from './district-catchup.system.js';
import { collectPartyPreservedEntities, placePreservedCompanions } from './transit-companions.js';
import { computeMovementMechanics } from './movement.system.js';

export interface ContinuousTransitResult {
  readonly state: WorldState;
  readonly events: SimEvent[];
  readonly apSpent: number;
  readonly traversed: boolean;
  readonly fromDistrictId?: BlueprintId;
  readonly toDistrictId?: BlueprintId;
  readonly newPosition?: Point3D;
  readonly reason?: string;
}

/** Detects whether targetCoord represents a border boundary traversal. */
export function detectBorderDirection(grid: StratumGrid, targetCoord: Point2D): CompassDir | undefined {
  if (targetCoord.x >= grid.width) return 'east';
  if (targetCoord.x < 0) return 'west';
  if (targetCoord.y < 0) return 'north';
  if (targetCoord.y >= grid.height) return 'south';
  return undefined;
}

/**
 * Computes translated arrival coordinates on the destination district grid,
 * scanning nearby boundary seam tiles if the primary arrival cell is blocked.
 */
export function translateBorderCoordinates(
  direction: CompassDir,
  origin: Point2D,
  fromGrid: StratumGrid,
  toGrid: StratumGrid,
  entities: Record<string, EntityRecord>,
  actorId: EntityId,
): Point2D {
  let baseX = 1;
  let baseY = 1;

  if (direction === 'east') {
    baseX = 1;
    baseY = Math.max(1, Math.min(toGrid.height - 2, Math.round(origin.y * (toGrid.height / fromGrid.height))));
  } else if (direction === 'west') {
    baseX = toGrid.width - 2;
    baseY = Math.max(1, Math.min(toGrid.height - 2, Math.round(origin.y * (toGrid.height / fromGrid.height))));
  } else if (direction === 'north') {
    baseX = Math.max(1, Math.min(toGrid.width - 2, Math.round(origin.x * (toGrid.width / fromGrid.width))));
    baseY = toGrid.height - 2;
  } else if (direction === 'south') {
    baseX = Math.max(1, Math.min(toGrid.width - 2, Math.round(origin.x * (toGrid.width / fromGrid.width))));
    baseY = 1;
  }

  const offsets = [0, 1, -1, 2, -2, 3, -3];
  for (const offset of offsets) {
    const cx = direction === 'north' || direction === 'south' ? baseX + offset : baseX;
    const cy = direction === 'east' || direction === 'west' ? baseY + offset : baseY;

    if (!isWithinBounds(toGrid, cx, cy)) continue;
    const cell = getTileCell(toGrid, cx, cy);
    if (!cell || cell.blocksMovement) continue;
    if (findBlockingEntityAtPoint(entities, { x: cx, y: cy, stratum: toGrid.stratum }, actorId)) continue;
    return { x: cx, y: cy };
  }

  return { x: baseX, y: baseY };
}

/** Seamlessly transitions an actor and party across district boundaries. */
export function continuousTransitSystem(
  state: WorldState,
  actorId: EntityId,
  targetCoord: Point2D,
  stratum: StratumId = 'STREET',
): ContinuousTransitResult {
  const actor = state.entities[actorId];
  if (!actor?.position) return { state, events: [], apSpent: 0, traversed: false, reason: 'NO_ACTOR_POSITION' };

  const origin = actor.position;
  const currentGrid = state.strata[stratum];
  if (!currentGrid) return { state, events: [], apSpent: 0, traversed: false, reason: 'MISSING_STRATUM_GRID' };
  if (!state.strata.UNDERCROFT || !state.strata.STREET || !state.strata.SPIRE) {
    return { state, events: [], apSpent: 0, traversed: false, reason: 'MISSING_STRATA' };
  }

  const direction = detectBorderDirection(currentGrid, targetCoord);
  if (!direction) return { state, events: [], apSpent: 0, traversed: false, reason: 'NOT_A_BORDER_TRAVERSAL' };

  const seams = computeDistrictBoundarySeams(state.currentDistrictId, currentGrid.width, currentGrid.height);
  const seamCoord = direction === 'east' || direction === 'west' ? origin.y : origin.x;
  if (!isEdgeSeamTraversable(seams, direction, seamCoord)) {
    return { state, events: [], apSpent: 0, traversed: false, reason: 'SEAM_NOT_TRAVERSABLE' };
  }

  const dCol = direction === 'east' ? 1 : direction === 'west' ? -1 : 0;
  const dRow = direction === 'south' ? 1 : direction === 'north' ? -1 : 0;
  const here = METROPOLIS_DISTRICT_DOSSIERS[state.currentDistrictId]?.macroCoords;
  let targetDistrictStr: string | undefined;

  if (here) {
    for (const [id, dossier] of Object.entries(METROPOLIS_DISTRICT_DOSSIERS)) {
      if (dossier.macroCoords.col === here.col + dCol && dossier.macroCoords.row === here.row + dRow) {
        targetDistrictStr = id;
        break;
      }
    }
  }
  if (!targetDistrictStr) {
    const adjacency = resolveCompassAdjacency(state.currentDistrictId);
    targetDistrictStr = adjacency[direction];
  }
  if (!targetDistrictStr) return { state, events: [], apSpent: 0, traversed: false, reason: 'NO_ADJACENT_DISTRICT' };

  const toDistrictId = BlueprintIdSchema.parse(targetDistrictStr);
  const fromDistrictId = state.currentDistrictId;
  const currentTurn = state.turnCount + 1;

  // 1. Collect party preserved entities (player, inventory, prosthetics, companions)
  const { preservedEntities, companions } = collectPartyPreservedEntities(state, actorId);

  // 2. Snapshot departing district
  const leavingEntities: Record<string, EntityRecord> = {};
  for (const [id, ent] of Object.entries(state.entities)) {
    if (!preservedEntities[id]) leavingEntities[id] = ent;
  }

  const updatedSavedDistricts: Record<string, SavedDistrictSnapshot> = {
    ...state.savedDistricts,
    [fromDistrictId]: {
      strata: {
        UNDERCROFT: state.strata.UNDERCROFT,
        STREET: state.strata.STREET,
        SPIRE: state.strata.SPIRE,
        ...(state.strata.CATACOMBS ? { CATACOMBS: state.strata.CATACOMBS } : {}),
      },
      entities: leavingEntities,
      lastSimulatedTurn: state.turnCount,
      ...(state.catacombDepths && Object.keys(state.catacombDepths).length > 0 ? { catacombDepths: state.catacombDepths } : {}),
    },
  };

  // 3. Hydrate or generate destination district
  const cachedTarget = updatedSavedDistricts[toDistrictId];
  let nextStrata: WorldState['strata'];
  let nextEntities: Record<string, EntityRecord>;

  if (cachedTarget) {
    const caughtUp = catchUpDistrictState(cachedTarget, state.turnCount);
    nextStrata = caughtUp.strata;
    nextEntities = { ...caughtUp.entities, ...preservedEntities };
  } else {
    const genResult = generateVictorianDistrict({ ...state, currentDistrictId: toDistrictId, entities: preservedEntities });
    const withItems = spawnDistrictItems(genResult.state);
    const withNpcs = spawnDistrictNpcs(withItems.state);
    nextStrata = withNpcs.state.strata;
    nextEntities = withNpcs.state.entities;
  }

  const destGrid = nextStrata[stratum];
  if (!destGrid) return { state, events: [], apSpent: 0, traversed: false, reason: 'DESTINATION_STRATUM_MISSING' };

  // 4. Translate coordinates and resolve landing tile
  const arrivalCoord = translateBorderCoordinates(direction, origin, currentGrid, destGrid, nextEntities, actorId);
  const arrivalPos: PositionComponent = {
    x: arrivalCoord.x, y: arrivalCoord.y, stratum, blocksMovement: true, blocksSight: false,
  };

  // 5. Place companions adjacent to the actor
  const companionPlacement = placePreservedCompanions(
    companions, arrivalPos, destGrid, nextEntities, currentTurn, actorId, fromDistrictId, toDistrictId,
  );
  nextEntities = companionPlacement.updatedEntities;
  const { apSpent } = computeMovementMechanics(state, actor);

  let nextState: WorldState = {
    ...state,
    currentDistrictId: toDistrictId,
    strata: nextStrata,
    savedDistricts: updatedSavedDistricts,
    catacombDepths: cachedTarget?.catacombDepths ?? {},
    entities: { ...nextEntities, [actorId]: { ...actor, position: arrivalPos } },
  };

  const transitEvents: SimEvent[] = [
    { type: 'DISTRICT_TRAVELED', turn: currentTurn, actorId, fromDistrictId, toDistrictId },
    ...companionPlacement.events,
    {
      type: 'ENTITY_MOVED', turn: currentTurn, actorId,
      from: { x: origin.x, y: origin.y, stratum: origin.stratum }, to: arrivalPos, apSpent,
    },
  ];

  // 6. Sync chunk streamer if player and ledger initialized
  if (actor.actor?.isPlayer && nextState.chunkLedger) {
    const rng = new SeededRNG(nextState.seed + nextState.turnCount);
    const streamRes = syncActorChunkWindow(nextState, actorId, rng);
    nextState = streamRes.state;
    transitEvents.push(...streamRes.events);
  }

  return {
    state: nextState, events: transitEvents, apSpent, traversed: true,
    fromDistrictId, toDistrictId, newPosition: arrivalPos,
  };
}
