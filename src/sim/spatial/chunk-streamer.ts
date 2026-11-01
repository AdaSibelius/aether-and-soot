import { EntityId, EntityIdSchema } from '../../schemas/primitives.schema.js';
import { SimEvent } from '../../schemas/events.schema.js';
import { EntityRecord } from '../../schemas/components.schema.js';
import { ChunkCoordinate, DormantChunkRecord } from '../../schemas/chunk-streaming.schema.js';
import { SeededRNG } from '../core/rng.js';
import { WorldState } from '../core/world.js';
import { getTileCell, setTileCell, TileCell } from './grid.js';
import {
  computeActiveChunkWindow,
  formatChunkKey,
  getChunkBounds,
  parseChunkKey,
  worldPointToChunkCoord,
} from './chunk-coords.js';

function collectChildEntityIds(entity: EntityRecord): string[] {
  const ids: string[] = [];
  if (entity.inventory) {
    ids.push(...entity.inventory.containedEntityIds);
    if (entity.inventory.equippedSlots) ids.push(...Object.values(entity.inventory.equippedSlots));
  }
  if (entity.anatomy) {
    for (const limb of Object.values(entity.anatomy.limbs)) {
      if (limb?.installedProstheticEntityId) ids.push(limb.installedProstheticEntityId);
    }
  }
  if (entity.tradePedestal?.itemEntityId) ids.push(entity.tradePedestal.itemEntityId);
  return ids;
}

function collectAllDescendantIds(root: EntityRecord, entities: Record<string, EntityRecord>): string[] {
  const result: string[] = [];
  const queue: string[] = collectChildEntityIds(root);
  while (queue.length > 0) {
    const nextId = queue.pop()!;
    result.push(nextId);
    const child = entities[nextId];
    if (child) queue.push(...collectChildEntityIds(child));
  }
  return result;
}

function isPreservedEntity(entity: EntityRecord): boolean {
  return Boolean(entity.actor?.isPlayer || entity.aiController?.companionOfActorId);
}

export function hibernateChunk(state: WorldState, coord: ChunkCoordinate): WorldState {
  const grid = state.strata[coord.stratum];
  if (!grid) return state;

  const chunkKey = formatChunkKey(coord);
  const ledger = state.chunkLedger ?? { activeChunkKeys: [], dormantChunks: {}, dormantEntities: {} };
  const bounds = getChunkBounds(coord);
  const cells: TileCell[] = [];
  for (let y = bounds.minY; y <= bounds.maxY; y++) {
    for (let x = bounds.minX; x <= bounds.maxX; x++) {
      const cell = getTileCell(grid, x, y);
      if (cell) cells.push(cell);
    }
  }

  const idsToHibernate = new Set<string>();
  for (const [id, ent] of Object.entries(state.entities)) {
    if (isPreservedEntity(ent)) continue;
    if (ent.position && ent.position.stratum === coord.stratum &&
        ent.position.x >= bounds.minX && ent.position.x <= bounds.maxX &&
        ent.position.y >= bounds.minY && ent.position.y <= bounds.maxY) {
      idsToHibernate.add(id);
      for (const dId of collectAllDescendantIds(ent, state.entities)) idsToHibernate.add(dId);
    }
  }

  const nextEntities: Record<string, EntityRecord> = {};
  const nextDormantEntities: Record<string, EntityRecord> = { ...ledger.dormantEntities };
  for (const [id, ent] of Object.entries(state.entities)) {
    if (idsToHibernate.has(id)) nextDormantEntities[id] = ent;
    else nextEntities[id] = ent;
  }

  const residentEntityIds = Array.from(idsToHibernate).map((id) => EntityIdSchema.parse(id));
  const dormantChunk: DormantChunkRecord = {
    chunkKey, coord, lastSimulatedTurn: state.turnCount, appliedCausalTick: state.macroTickCount,
    cells, residentEntityIds,
  };

  return {
    ...state,
    entities: nextEntities,
    chunkLedger: {
      ...ledger,
      activeChunkKeys: ledger.activeChunkKeys.filter((k) => k !== chunkKey),
      dormantChunks: { ...ledger.dormantChunks, [chunkKey]: dormantChunk },
      dormantEntities: nextDormantEntities,
    },
  };
}

export function hydrateChunk(
  state: WorldState,
  coord: ChunkCoordinate,
  _rng: SeededRNG,
): { state: WorldState; events: SimEvent[] } {
  const chunkKey = formatChunkKey(coord);
  const ledger = state.chunkLedger;
  const dormant = ledger?.dormantChunks[chunkKey];
  if (!dormant || !ledger) return { state, events: [] };

  const grid = state.strata[coord.stratum];
  if (!grid) return { state, events: [] };

  const bounds = getChunkBounds(coord);
  let cellIdx = 0;
  const elapsedTurns = Math.max(0, state.turnCount - dormant.lastSimulatedTurn);
  const districtNode = state.cityGraph?.nodes[coord.districtId];
  const isSteamOutage = Boolean(districtNode?.flags.steamOutageActive);
  const isSluiceFlooded = Boolean(districtNode?.flags.sluiceFloodedActive);

  let currentGrid = grid;
  for (let y = bounds.minY; y <= bounds.maxY; y++) {
    for (let x = bounds.minX; x <= bounds.maxX; x++) {
      const origCell = dormant.cells[cellIdx++];
      if (!origCell) continue;

      const cell = { ...origCell };
      if (elapsedTurns > 0) {
        if (cell.smokePpm && cell.smokePpm > 0) cell.smokePpm = Math.max(0, cell.smokePpm - elapsedTurns * 2);
        if (cell.steamPressureKpa > 0) cell.steamPressureKpa = Math.max(0, cell.steamPressureKpa - elapsedTurns * 0.5);
      }
      if (isSteamOutage && cell.steamPressureKpa > 0) cell.steamPressureKpa = 0;
      if (isSluiceFlooded && !cell.blocksMovement) { cell.liquidType = 'SLUICE_SLUDGE'; cell.liquidVolumeMl = 500; }
      currentGrid = setTileCell(currentGrid, x, y, () => cell);
    }
  }

  const nextEntities: Record<string, EntityRecord> = { ...state.entities };
  const nextDormantEntities: Record<string, EntityRecord> = { ...ledger.dormantEntities };

  for (const id of dormant.residentEntityIds) {
    const ent = nextDormantEntities[id];
    if (ent) {
      delete nextDormantEntities[id];
      if (isSteamOutage && ent.utilityConduit?.conduitType === 'HIGH_PRESSURE_STEAM_MAIN') {
        nextEntities[id] = { ...ent, utilityConduit: { ...ent.utilityConduit, operatingPressureKpa: 0 } };
      } else {
        nextEntities[id] = ent;
      }
    }
  }

  const nextDormantChunks = { ...ledger.dormantChunks };
  delete nextDormantChunks[chunkKey];
  const nextActiveKeys = Array.from(new Set([...ledger.activeChunkKeys, chunkKey]));

  return {
    state: {
      ...state,
      strata: {
        ...state.strata,
        [coord.stratum]: currentGrid,
      },
      entities: nextEntities,
      chunkLedger: { ...ledger, activeChunkKeys: nextActiveKeys, dormantChunks: nextDormantChunks, dormantEntities: nextDormantEntities },
    },
    events: [],
  };
}

export function syncActorChunkWindow(
  state: WorldState,
  actorId: EntityId,
  rng: SeededRNG,
  radiusChebyshev = 1,
): { state: WorldState; events: SimEvent[] } {
  const actor = state.entities[actorId];
  if (!actor?.position) return { state, events: [] };

  const currentCoord = worldPointToChunkCoord(state.currentDistrictId, actor.position);
  const ledger = state.chunkLedger ?? { activeWindowCenter: currentCoord, activeChunkKeys: [], dormantChunks: {}, dormantEntities: {} };
  const prevCenter = ledger.activeWindowCenter;
  const grid = state.strata[currentCoord.stratum];
  const gridWidth = grid?.width ?? 48;
  const gridHeight = grid?.height ?? 36;

  const desiredWindowCoords = computeActiveChunkWindow(currentCoord, gridWidth, gridHeight, radiusChebyshev);
  const desiredKeys = new Set(desiredWindowCoords.map(formatChunkKey));
  let currentState: WorldState = { ...state, chunkLedger: { ...ledger, activeWindowCenter: currentCoord } };

  for (const activeKey of ledger.activeChunkKeys) {
    if (!desiredKeys.has(activeKey)) {
      const coord = parseChunkKey(activeKey);
      if (coord.districtId === state.currentDistrictId && coord.stratum === currentCoord.stratum) {
        currentState = hibernateChunk(currentState, coord);
      }
    }
  }

  const events: SimEvent[] = [];
  for (const coord of desiredWindowCoords) {
    const key = formatChunkKey(coord);
    if (currentState.chunkLedger?.dormantChunks[key]) {
      const hydRes = hydrateChunk(currentState, coord, rng);
      currentState = hydRes.state;
      events.push(...hydRes.events);
    }
  }

  if (currentState.chunkLedger) {
    currentState = {
      ...currentState,
      chunkLedger: { ...currentState.chunkLedger, activeChunkKeys: Array.from(desiredKeys) },
    };
  }

  events.push({
    type: 'CHUNK_WINDOW_SHIFTED', turn: state.turnCount, actorId,
    fromCenter: prevCenter, toCenter: currentCoord, activeChunkCount: desiredKeys.size,
  });

  return { state: currentState, events };
}
