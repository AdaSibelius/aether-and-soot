import { EntityRecord } from '../../schemas/components.schema.js';
import { SimEvent } from '../../schemas/events.schema.js';
import { EntityId, Point3D } from '../../schemas/primitives.schema.js';
import { STANDARD_ACTION_AP } from '../core/scheduler.js';
import { WorldState } from '../core/world.js';
import { getTileCell, isWithinBounds, setTileCell } from '../spatial/grid.js';
import { resolveTriggerSupplyShock } from './economy.system.js';

export const COAL_DUST_IGNITION_THRESHOLD = 0.25;

const CARDINAL_DELTAS: ReadonlyArray<{ dx: number; dy: number }> = [
  { dx: 1, dy: 0 },
  { dx: -1, dy: 0 },
  { dx: 0, dy: 1 },
  { dx: 0, dy: -1 },
];

export interface SystemPressureResult {
  readonly state: WorldState;
  readonly events: SimEvent[];
  readonly apSpent: number;
}

export function resolvePressurizeVessel(
  state: WorldState,
  vesselEntityId: EntityId,
  pressureAddedKpa: number,
): SystemPressureResult {
  const vessel = state.entities[vesselEntityId];
  if (!vessel || !vessel.pressureVessel || !vessel.position) {
    return { state, events: [], apSpent: STANDARD_ACTION_AP };
  }

  const nextPressure = vessel.pressureVessel.currentPressureKpa + pressureAddedKpa;
  const turn = state.turnCount + 1;

  if (nextPressure <= vessel.pressureVessel.maxPressureKpa && !vessel.pressureVessel.ruptured) {
    const updatedVessel: EntityRecord = {
      ...vessel,
      pressureVessel: {
        ...vessel.pressureVessel,
        currentPressureKpa: nextPressure,
      },
    };
    return {
      state: {
        ...state,
        entities: { ...state.entities, [vesselEntityId]: updatedVessel },
      },
      events: [],
      apSpent: STANDARD_ACTION_AP,
    };
  }

  // Rupture! Vent all pressure into origin and cardinal neighbor tiles
  const origin = vessel.position;
  const grid = state.strata[origin.stratum];
  let updatedGrid = grid;

  if (updatedGrid) {
    const points = [
      { x: origin.x, y: origin.y, share: 0.4 },
      { x: origin.x + 1, y: origin.y, share: 0.15 },
      { x: origin.x - 1, y: origin.y, share: 0.15 },
      { x: origin.x, y: origin.y + 1, share: 0.15 },
      { x: origin.x, y: origin.y - 1, share: 0.15 },
    ];
    for (const pt of points) {
      const cell = getTileCell(updatedGrid, pt.x, pt.y);
      if (cell && !cell.blocksMovement) {
        updatedGrid = setTileCell(updatedGrid, pt.x, pt.y, (c) => ({
          ...c,
          steamPressureKpa: c.steamPressureKpa + Math.round(nextPressure * pt.share),
        }));
      }
    }
  }

  const rupturedVessel: EntityRecord = {
    ...vessel,
    position: {
      ...origin,
      blocksMovement: false,
    },
    pressureVessel: {
      ...vessel.pressureVessel,
      currentPressureKpa: 0,
      ruptured: true,
    },
  };

  const rupturedState: WorldState = {
    ...state,
    strata: updatedGrid ? { ...state.strata, [origin.stratum]: updatedGrid } : state.strata,
    entities: { ...state.entities, [vesselEntityId]: rupturedVessel },
  };

  const shockRes = resolveTriggerSupplyShock(
    rupturedState,
    'ANTHRACITE_COAL',
    -60,
    'IRONMONGERS_CARTEL',
    -15,
  );

  return {
    state: shockRes.state,
    apSpent: STANDARD_ACTION_AP,
    events: [
      {
        type: 'VESSEL_RUPTURED',
        turn,
        vesselEntityId,
        origin: { x: origin.x, y: origin.y, stratum: origin.stratum },
        releasedPressureKpa: nextPressure,
      },
      ...shockRes.events,
    ],
  };
}

export function resolveEmitSpark(state: WorldState, target: Point3D): SystemPressureResult {
  const grid = state.strata[target.stratum];
  if (!grid || !isWithinBounds(grid, target.x, target.y)) {
    return { state, events: [], apSpent: STANDARD_ACTION_AP };
  }

  const startCell = getTileCell(grid, target.x, target.y);
  if (!startCell || startCell.coalDustDensity < COAL_DUST_IGNITION_THRESHOLD) {
    return { state, events: [], apSpent: STANDARD_ACTION_AP };
  }

  // Flood-fill contiguous coal dust cloud above ignition threshold
  const visited = new Set<string>();
  const queue: Array<{ x: number; y: number }> = [{ x: target.x, y: target.y }];
  const ignitedCoords: Array<{ x: number; y: number }> = [];

  while (queue.length > 0) {
    const curr = queue.shift()!;
    const key = `${curr.x},${curr.y}`;
    if (visited.has(key)) continue;
    visited.add(key);

    const cell = getTileCell(grid, curr.x, curr.y);
    if (!cell || cell.blocksMovement || cell.coalDustDensity < COAL_DUST_IGNITION_THRESHOLD) {
      continue;
    }

    ignitedCoords.push(curr);
    for (const { dx, dy } of CARDINAL_DELTAS) {
      const nx = curr.x + dx;
      const ny = curr.y + dy;
      if (isWithinBounds(grid, nx, ny)) {
        queue.push({ x: nx, y: ny });
      }
    }
  }

  let updatedGrid = grid;
  for (const pt of ignitedCoords) {
    updatedGrid = setTileCell(updatedGrid, pt.x, pt.y, (c) => ({
      ...c,
      coalDustDensity: 0,
      steamPressureKpa: c.steamPressureKpa + 55,
    }));
  }

  return {
    state: {
      ...state,
      strata: {
        ...state.strata,
        [target.stratum]: updatedGrid,
      },
    },
    apSpent: STANDARD_ACTION_AP,
    events: [
      {
        type: 'COAL_DUST_IGNITED',
        turn: state.turnCount + 1,
        epicenter: target,
        ignitedTileCount: ignitedCoords.length,
      },
    ],
  };
}
