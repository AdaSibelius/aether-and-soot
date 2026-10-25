import { SimEvent } from '../../schemas/events.schema.js';
import { Point3D, StratumId } from '../../schemas/primitives.schema.js';
import { WorldState } from '../core/world.js';
import { getTileCell, isWithinBounds, setTileCell } from '../spatial/grid.js';
import { resolveDamageLimb } from './anatomy.system.js';
import { resolveActorDefeatIfFatal } from './mortality.system.js';
import { emitAcousticPulse } from './stealth-acoustics.system.js';
import { CARDINAL_DELTAS, calculateGaslightField, GASLIGHT_EMISSION_RADIUS } from './gaslight.system.js';

export { calculateGaslightField, GASLIGHT_EMISSION_RADIUS };

/**
 * Resolves a volatile whale oil pool ignition cascade along contiguous whale oil puddle tiles.
 */
export function resolveWhaleOilCascade(
  state: WorldState,
  origin: Point3D,
): { state: WorldState; events: SimEvent[]; tilesIgnited: number } {
  const grid = state.strata[origin.stratum];
  if (!grid || !isWithinBounds(grid, origin.x, origin.y)) {
    return { state, events: [], tilesIgnited: 0 };
  }

  const startCell = getTileCell(grid, origin.x, origin.y);
  if (!startCell || startCell.liquidType !== 'WHALE_OIL' || (startCell.liquidVolumeMl ?? 0) <= 0) {
    return { state, events: [], tilesIgnited: 0 };
  }

  let workingState = state;
  let updatedGrid = grid;
  const events: SimEvent[] = [];
  const turn = state.turnCount + 1;

  const queue: Array<{ x: number; y: number }> = [{ x: origin.x, y: origin.y }];
  const visited = new Set<string>();
  let ignitedCount = 0;

  while (queue.length > 0) {
    const curr = queue.shift()!;
    const key = `${curr.x},${curr.y}`;
    if (visited.has(key)) continue;
    visited.add(key);

    const cell = getTileCell(updatedGrid, curr.x, curr.y);
    if (!cell || cell.liquidType !== 'WHALE_OIL' || (cell.liquidVolumeMl ?? 0) <= 0) continue;

    const burnedVol = cell.liquidVolumeMl ?? 150;
    updatedGrid = setTileCell(updatedGrid, curr.x, curr.y, (c) => ({
      ...c,
      liquidType: 'NONE',
      liquidVolumeMl: 0,
      steamPressureKpa: c.steamPressureKpa + 45,
      smokePpm: (c.smokePpm ?? 0) + 120,
    }));
    ignitedCount++;

    const targetPt: Point3D = { x: curr.x, y: curr.y, stratum: origin.stratum };
    events.push({
      type: 'LIQUID_IGNITED',
      turn,
      target: targetPt,
      liquidType: 'WHALE_OIL',
      burnedVolumeMl: burnedVol,
      thermalDamage: 25,
    });
    events.push({
      type: 'HAZARD_TRIGGERED',
      turn,
      hazardType: 'WHALE_OIL_CASCADE',
      at: targetPt,
      severity: 'SEVERE',
      message: 'Volatile whale oil puddle ignited in a roaring flame cascade!',
    });

    for (const actor of Object.values(workingState.entities)) {
      if (actor.actor && actor.position && actor.position.stratum === origin.stratum && actor.position.x === curr.x && actor.position.y === curr.y) {
        const dmg = resolveDamageLimb(workingState, actor.id, 'TORSO', 25);
        workingState = dmg.state;
        events.push(...dmg.events);
        const def = resolveActorDefeatIfFatal(workingState, actor.id);
        workingState = def.state;
        events.push(...def.events);
      }
    }

    for (const d of CARDINAL_DELTAS) {
      const nx = curr.x + d.dx, ny = curr.y + d.dy;
      if (isWithinBounds(updatedGrid, nx, ny) && !visited.has(`${nx},${ny}`)) {
        queue.push({ x: nx, y: ny });
      }
    }
  }

  workingState = {
    ...workingState,
    strata: { ...workingState.strata, [origin.stratum]: updatedGrid },
  };

  const blast = emitAcousticPulse(workingState, origin, 85, turn);
  return { state: blast.state, events: [...events, ...blast.events], tilesIgnited: ignitedCount };
}

/**
 * Drifts soot clouds and triggers choking telemetry on actors occupying high-density soot tiles.
 */
export function advanceSootClouds(
  state: WorldState,
  stratum: StratumId,
  wind: { dx: number; dy: number } = { dx: 1, dy: 0 },
): { state: WorldState; events: SimEvent[] } {
  const grid = state.strata[stratum];
  if (!grid) return { state, events: [] };

  let nextCells: typeof grid.cells | undefined;
  const events: SimEvent[] = [];
  const turn = state.turnCount + 1;

  for (let y = 0; y < grid.height; y++) {
    for (let x = 0; x < grid.width; x++) {
      const cell = grid.cells[y * grid.width + x];
      if (!cell || (cell.smokePpm ?? 0) < 40) continue;

      const nx = x + wind.dx, ny = y + wind.dy;
      if (isWithinBounds(grid, nx, ny)) {
        const destIdx = ny * grid.width + nx;
        const srcIdx = y * grid.width + x;
        const dest = (nextCells ?? grid.cells)[destIdx];
        const currSrc = (nextCells ?? grid.cells)[srcIdx];
        if (dest && currSrc && !dest.blocksMovement) {
          const driftPpm = Math.floor((cell.smokePpm ?? 0) * 0.3);
          if (driftPpm > 0) {
            if (!nextCells) nextCells = [...grid.cells];
            nextCells[destIdx] = { ...dest, smokePpm: (dest.smokePpm ?? 0) + driftPpm };
            nextCells[srcIdx] = { ...currSrc, smokePpm: Math.max(0, (currSrc.smokePpm ?? 0) - driftPpm) };
          }
        }
      }
    }
  }

  const updatedGrid = nextCells ? { ...grid, cells: nextCells } : grid;
  let workingState = nextCells ? { ...state, strata: { ...state.strata, [stratum]: updatedGrid } } : state;

  for (const actor of Object.values(workingState.entities)) {
    if (actor.actor && actor.position && actor.position.stratum === stratum) {
      const cell = getTileCell(updatedGrid, actor.position.x, actor.position.y);
      if (cell && (cell.smokePpm ?? 0) >= 80) {
        events.push({
          type: 'HAZARD_TRIGGERED',
          turn,
          hazardType: 'SOOT_CLOUD',
          at: actor.position,
          actorId: actor.id,
          severity: 'MINOR',
          message: `${actor.name} chokes on dense drifting soot clouds!`,
        });
        const cough = emitAcousticPulse(workingState, actor.position, 35, turn, actor.id);
        workingState = cough.state;
        events.push(...cough.events);
      }
    }
  }

  return { state: workingState, events };
}

/**
 * Periodically deposits corrosive acid drops from ceiling drips and sizzles actors below.
 */
export function advanceAcidDrips(
  state: WorldState,
  stratum: StratumId,
): { state: WorldState; events: SimEvent[] } {
  const grid = state.strata[stratum];
  if (!grid) return { state, events: [] };

  let updatedGrid = grid;
  let workingState = state;
  const events: SimEvent[] = [];
  const turn = state.turnCount + 1;

  for (const ent of Object.values(state.entities)) {
    if (ent.position?.stratum === stratum && ent.name.toLowerCase().includes('acid_drip')) {
      const pt = ent.position;
      const cell = getTileCell(updatedGrid, pt.x, pt.y);
      if (cell) {
        updatedGrid = setTileCell(updatedGrid, pt.x, pt.y, (c) => ({
          ...c,
          liquidType: 'NITRIC_ACID',
          liquidVolumeMl: Math.min(500, (c.liquidVolumeMl ?? 0) + 60),
        }));
        events.push({
          type: 'HAZARD_TRIGGERED',
          turn,
          hazardType: 'ACID_DRIP',
          at: pt,
          severity: 'MODERATE',
          message: 'Corrosive acid drips from ceiling fixtures into a sizzling puddle.',
        });

        for (const actor of Object.values(workingState.entities)) {
          if (actor.actor && actor.position && actor.position.stratum === stratum && actor.position.x === pt.x && actor.position.y === pt.y) {
            const dmg = resolveDamageLimb(workingState, actor.id, 'RIGHT_LEG', 6);
            workingState = dmg.state;
            events.push(...dmg.events);
          }
        }
      }
    }
  }

  return {
    state: { ...workingState, strata: { ...workingState.strata, [stratum]: updatedGrid } },
    events,
  };
}

/**
 * Advances all active environmental hazards across the current active district stratum.
 */
export function advanceEnvironmentalHazards(
  state: WorldState,
  stratum: StratumId = 'STREET',
): { state: WorldState; events: SimEvent[] } {
  const sootRes = advanceSootClouds(state, stratum);
  const acidRes = advanceAcidDrips(sootRes.state, stratum);
  return {
    state: acidRes.state,
    events: [...sootRes.events, ...acidRes.events],
  };
}
