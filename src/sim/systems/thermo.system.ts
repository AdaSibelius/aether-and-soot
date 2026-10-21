import { SimEvent } from '../../schemas/events.schema.js';
import { StratumId } from '../../schemas/primitives.schema.js';
import { WorldState } from '../core/world.js';
import { getTileCell, isWithinBounds, setTileCell, StratumGrid, TileCell } from '../spatial/grid.js';
import { resolveDamageLimb } from './anatomy.system.js';
import { computeEquippedBonuses } from './equipment.system.js';
import { resolveActorDefeatIfFatal } from './mortality.system.js';

export const SCALD_PRESSURE_THRESHOLD_KPA = 25;
const STEAM_DIFFUSION_SHARE = 0.4;
const STEAM_RETENTION_FACTOR = 0.96;

const CARDINAL_DELTAS: ReadonlyArray<{ dx: number; dy: number }> = [
  { dx: 1, dy: 0 },
  { dx: -1, dy: 0 },
  { dx: 0, dy: 1 },
  { dx: 0, dy: -1 },
];

/**
 * Double-buffered 2D cellular automata step for steam pressure and coal dust on a single stratum.
 */
function diffuseStratumGrid(grid: StratumGrid): StratumGrid {
  const nextSteam = new Float64Array(grid.cells.length);
  const nextDust = new Float64Array(grid.cells.length);

  for (let y = 0; y < grid.height; y++) {
    for (let x = 0; x < grid.width; x++) {
      const idx = y * grid.width + x;
      const cell = grid.cells[idx];
      if (!cell || cell.blocksMovement) {
        continue;
      }

      const openNeighbors: number[] = [];
      for (const { dx, dy } of CARDINAL_DELTAS) {
        const nx = x + dx;
        const ny = y + dy;
        if (!isWithinBounds(grid, nx, ny)) continue;
        const nIdx = ny * grid.width + nx;
        const nCell = grid.cells[nIdx];
        if (nCell && !nCell.blocksMovement) {
          openNeighbors.push(nIdx);
        }
      }

      if (openNeighbors.length === 0) {
        nextSteam[idx] = (nextSteam[idx] ?? 0) + cell.steamPressureKpa * STEAM_RETENTION_FACTOR;
        nextDust[idx] = (nextDust[idx] ?? 0) + cell.coalDustDensity;
        continue;
      }

      const retainedSteam = cell.steamPressureKpa * (1 - STEAM_DIFFUSION_SHARE);
      const sharedSteamPerNeighbor =
        (cell.steamPressureKpa * STEAM_DIFFUSION_SHARE) / openNeighbors.length;

      nextSteam[idx] = (nextSteam[idx] ?? 0) + retainedSteam * STEAM_RETENTION_FACTOR;
      for (const nIdx of openNeighbors) {
        nextSteam[nIdx] =
          (nextSteam[nIdx] ?? 0) + sharedSteamPerNeighbor * STEAM_RETENTION_FACTOR;
      }

      const retainedDust = cell.coalDustDensity * 0.85;
      const sharedDust = (cell.coalDustDensity * 0.15) / openNeighbors.length;
      nextDust[idx] = (nextDust[idx] ?? 0) + retainedDust;
      for (const nIdx of openNeighbors) {
        nextDust[nIdx] = (nextDust[nIdx] ?? 0) + sharedDust;
      }
    }
  }

  const nextCells: TileCell[] = grid.cells.map((cell, idx) => {
    const rawSteam = nextSteam[idx] ?? 0;
    const rawDust = nextDust[idx] ?? 0;
    return {
      ...cell,
      steamPressureKpa: rawSteam < 0.05 ? 0 : Math.round(rawSteam * 100) / 100,
      coalDustDensity: rawDust < 0.01 ? 0 : Math.min(1, Math.round(rawDust * 1000) / 1000),
    };
  });

  return { ...grid, cells: nextCells };
}

/**
 * Advances environmental gas/steam automata across all strata, vents rising steam through
 * gas-conducting portals, and applies scald damage to actors standing in high-pressure steam.
 */
export function advanceThermodynamicsTick(state: WorldState): {
  state: WorldState;
  events: SimEvent[];
} {
  const strataNames: StratumId[] = ['CATACOMBS', 'UNDERCROFT', 'STREET', 'SPIRE'];
  const nextStrata: Record<string, StratumGrid> = { ...state.strata };

  for (const s of strataNames) {
    const grid = nextStrata[s];
    if (grid) {
      nextStrata[s] = diffuseStratumGrid(grid);
    }
  }

  // Transfer 30% of steam upward through gas-conducting portals (e.g. Undercroft -> Street)
  const stratumElevation: Record<StratumId, number> = {
    CATACOMBS: -1,
    UNDERCROFT: 0,
    STREET: 1,
    SPIRE: 2,
  };

  for (const entity of Object.values(state.entities)) {
    const pos = entity.position;
    const portal = entity.portal;
    if (!pos || !portal || !portal.conductsGas) continue;

    const fromElev = stratumElevation[pos.stratum];
    const toElev = stratumElevation[portal.target.stratum];
    if (toElev <= fromElev) continue;

    const sourceGrid = nextStrata[pos.stratum];
    const targetGrid = nextStrata[portal.target.stratum];
    if (!sourceGrid || !targetGrid) continue;

    const sourceCell = getTileCell(sourceGrid, pos.x, pos.y);
    if (!sourceCell || sourceCell.steamPressureKpa <= 1) continue;

    const transferred = Math.round(sourceCell.steamPressureKpa * 0.3 * 100) / 100;
    nextStrata[pos.stratum] = setTileCell(sourceGrid, pos.x, pos.y, (c) => ({
      ...c,
      steamPressureKpa: Math.max(0, c.steamPressureKpa - transferred),
    }));
    nextStrata[portal.target.stratum] = setTileCell(
      targetGrid,
      portal.target.x,
      portal.target.y,
      (c) => ({
        ...c,
        steamPressureKpa: c.steamPressureKpa + transferred,
      }),
    );
  }

  let workingState: WorldState = {
    ...state,
    strata: nextStrata,
  };
  const scaldEvents: SimEvent[] = [];

  for (const entity of Object.values(workingState.entities)) {
    if (!entity.actor || !entity.position || !entity.anatomy) continue;
    const grid = workingState.strata[entity.position.stratum];
    const cell = grid ? getTileCell(grid, entity.position.x, entity.position.y) : undefined;
    const equipped = computeEquippedBonuses(workingState, entity);
    const threshold = SCALD_PRESSURE_THRESHOLD_KPA + (equipped.steamResistanceKpa ?? 0);
    if (!cell || cell.steamPressureKpa < threshold) continue;

    const scaldDmg = Math.max(2, Math.floor(cell.steamPressureKpa / 12));
    scaldEvents.push({
      type: 'THERMAL_SCALD',
      turn: workingState.turnCount + 1,
      targetId: entity.id,
      slot: 'TORSO',
      steamPressureKpa: cell.steamPressureKpa,
      damage: scaldDmg,
    });

    const dmgRes = resolveDamageLimb(workingState, entity.id, 'TORSO', scaldDmg);
    workingState = dmgRes.state;
    scaldEvents.push(...dmgRes.events);

    const defeatRes = resolveActorDefeatIfFatal(workingState, entity.id);
    workingState = defeatRes.state;
    scaldEvents.push(...defeatRes.events);
  }

  return { state: workingState, events: scaldEvents };
}
