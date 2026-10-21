import { SimEvent } from '../../schemas/events.schema.js';
import { Point3D } from '../../schemas/primitives.schema.js';
import { STANDARD_ACTION_AP } from '../core/scheduler.js';
import { WorldState } from '../core/world.js';
import { getTileCell, isWithinBounds, setTileCell } from '../spatial/grid.js';
import { resolveDamageLimb } from './anatomy.system.js';
import { resolveActorDefeatIfFatal } from './mortality.system.js';
import { emitAcousticPulse } from './stealth-acoustics.system.js';

export const COAL_DUST_IGNITION_THRESHOLD = 0.2;
const CARDINAL_DELTAS = [
  { dx: 0, dy: -1 },
  { dx: 0, dy: 1 },
  { dx: -1, dy: 0 },
  { dx: 1, dy: 0 },
] as const;

export interface SystemPyrotechnicResult {
  readonly state: WorldState;
  readonly events: SimEvent[];
  readonly apSpent: number;
}

/**
 * Emits an electrostatic or flint spark at the target tile.
 * Ignites contiguous coal dust clouds and volatile WHALE_OIL pools into thermal fires.
 */
export function resolveEmitSpark(state: WorldState, target: Point3D): SystemPyrotechnicResult {
  const grid = state.strata[target.stratum];
  if (!grid || !isWithinBounds(grid, target.x, target.y)) {
    return { state, events: [], apSpent: STANDARD_ACTION_AP };
  }

  const startCell = getTileCell(grid, target.x, target.y);
  const events: SimEvent[] = [];
  let workingState = state;
  let updatedGrid = grid;
  const turn = state.turnCount + 1;

  // 1. Whale Oil Pool Ignition
  if (startCell && startCell.liquidType === 'WHALE_OIL' && (startCell.liquidVolumeMl ?? 0) > 0) {
    const burnedVolume = startCell.liquidVolumeMl ?? 200;
    updatedGrid = setTileCell(updatedGrid, target.x, target.y, (c) => ({
      ...c,
      liquidType: 'NONE',
      liquidVolumeMl: 0,
      steamPressureKpa: c.steamPressureKpa + 40,
    }));

    events.push({
      type: 'LIQUID_IGNITED',
      turn,
      target,
      liquidType: 'WHALE_OIL',
      burnedVolumeMl: burnedVolume,
      thermalDamage: 25,
    });

    // Inflict thermal scald trauma on occupants
    for (const actor of Object.values(workingState.entities)) {
      if (actor.actor && actor.position && actor.position.stratum === target.stratum &&
          actor.position.x === target.x && actor.position.y === target.y) {
        const dmg = resolveDamageLimb(workingState, actor.id, 'TORSO', 20);
        workingState = dmg.state;
        events.push(...dmg.events);
        const def = resolveActorDefeatIfFatal(workingState, actor.id);
        workingState = def.state;
        events.push(...def.events);
      }
    }
  }

  // 2. Coal Dust Cloud Flood-Fill Ignition
  const visited = new Set<string>();
  const queue: Array<{ x: number; y: number }> = [{ x: target.x, y: target.y }];
  const ignitedCoords: Array<{ x: number; y: number }> = [];

  while (queue.length > 0) {
    const curr = queue.shift()!;
    const key = `${curr.x},${curr.y}`;
    if (visited.has(key)) continue;
    visited.add(key);

    const cell = getTileCell(updatedGrid, curr.x, curr.y);
    if (!cell || cell.blocksMovement || cell.coalDustDensity < COAL_DUST_IGNITION_THRESHOLD) {
      continue;
    }

    ignitedCoords.push(curr);
    for (const { dx, dy } of CARDINAL_DELTAS) {
      const nx = curr.x + dx;
      const ny = curr.y + dy;
      if (isWithinBounds(updatedGrid, nx, ny)) {
        queue.push({ x: nx, y: ny });
      }
    }
  }

  if (ignitedCoords.length > 0) {
    for (const pt of ignitedCoords) {
      updatedGrid = setTileCell(updatedGrid, pt.x, pt.y, (c) => ({
        ...c,
        coalDustDensity: 0,
        steamPressureKpa: c.steamPressureKpa + 55,
      }));
    }
    events.push({
      type: 'COAL_DUST_IGNITED',
      turn,
      epicenter: target,
      ignitedTileCount: ignitedCoords.length,
    });
  }

  if (events.length === 0) {
    return { state, events: [], apSpent: STANDARD_ACTION_AP };
  }

  workingState = {
    ...workingState,
    strata: {
      ...workingState.strata,
      [target.stratum]: updatedGrid,
    },
  };

  const ignitionNoise = emitAcousticPulse(workingState, target, 100, turn);
  return {
    state: ignitionNoise.state,
    apSpent: STANDARD_ACTION_AP,
    events: [...events, ...ignitionNoise.events],
  };
}
