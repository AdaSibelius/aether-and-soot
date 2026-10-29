import { EntityRecord } from '../../schemas/components.schema.js';
import { getShiftPhase, SavedDistrictSnapshot } from '../core/world.js';
import { StratumGrid } from '../spatial/grid.js';

export interface DistrictCatchupResult {
  readonly strata: {
    readonly UNDERCROFT: StratumGrid;
    readonly STREET: StratumGrid;
    readonly SPIRE: StratumGrid;
  };
  readonly entities: Record<string, EntityRecord>;
}

function decayStratumAtmosphere(
  grid: StratumGrid,
  steamFactor: number,
  dustFactor: number,
): StratumGrid {
  if (steamFactor >= 0.999 && dustFactor >= 0.999) return grid;
  const newCells = grid.cells.map((cell) => {
    if (cell.steamPressureKpa <= 0 && cell.coalDustDensity <= 0) return cell;
    const nextSteam = Math.max(0, Math.round(cell.steamPressureKpa * steamFactor * 100) / 100);
    const nextDust = Math.max(0, Math.round(cell.coalDustDensity * dustFactor * 1000) / 1000);
    return {
      ...cell,
      steamPressureKpa: nextSteam < 0.05 ? 0 : nextSteam,
      coalDustDensity: nextDust < 0.01 ? 0 : nextDust,
    };
  });
  return { ...grid, cells: newCells };
}

/**
 * Catches up an unloaded/cached district to match the elapsed world turn count.
 * Decays residual steam and coal dust and snaps scheduled NPCs to their active shift anchor.
 */
export function catchUpDistrictState(
  snapshot: SavedDistrictSnapshot,
  currentTurn: number,
): DistrictCatchupResult {
  const elapsedTurns = Math.max(0, currentTurn - snapshot.lastSimulatedTurn);
  const shift = getShiftPhase(currentTurn);

  // 1. Decay residual steam and coal dust proportional to elapsed turns
  const decayFactor = elapsedTurns > 0 ? Math.pow(0.9, Math.min(elapsedTurns, 40)) : 1.0;
  const dustDecayFactor = elapsedTurns > 0 ? Math.pow(0.95, Math.min(elapsedTurns, 40)) : 1.0;

  const nextStrata = {
    UNDERCROFT: decayStratumAtmosphere(snapshot.strata.UNDERCROFT, decayFactor, dustDecayFactor),
    STREET: decayStratumAtmosphere(snapshot.strata.STREET, decayFactor, dustDecayFactor),
    SPIRE: decayStratumAtmosphere(snapshot.strata.SPIRE, decayFactor, dustDecayFactor),
    ...(snapshot.strata.CATACOMBS ? { CATACOMBS: decayStratumAtmosphere(snapshot.strata.CATACOMBS, decayFactor, dustDecayFactor) } : {}),
  };

  // 2. Snap scheduled NPCs to active shift anchor
  const nextEntities: Record<string, EntityRecord> = {};
  for (const [id, ent] of Object.entries(snapshot.entities)) {
    if (ent.schedule && ent.position && !ent.actor?.isPlayer) {
      const isGuard = ent.aiController?.role === 'GUARD';
      const isNight = shift === 'GRAVEYARD_WATCH' && !isGuard;
      const targetAnchor = isNight ? ent.schedule.restAnchor : ent.schedule.workAnchor;
      const targetGoal = isNight ? 'REST' : 'WORK';

      nextEntities[id] = {
        ...ent,
        position: {
          ...ent.position,
          x: targetAnchor.x,
          y: targetAnchor.y,
          stratum: targetAnchor.stratum,
        },
        schedule: {
          ...ent.schedule,
          currentGoal: targetGoal,
        },
      };
    } else {
      nextEntities[id] = ent;
    }
  }

  return {
    strata: nextStrata,
    entities: nextEntities,
  };
}
