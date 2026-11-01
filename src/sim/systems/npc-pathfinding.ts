import { EntityRecord } from '../../schemas/components.schema.js';
import { Point3D, StratumId } from '../../schemas/primitives.schema.js';
import { WorldState } from '../core/world.js';
import { findBlockingEntityAtPoint, getTileCell, isWithinBounds } from '../spatial/grid.js';

export const HAZARD_PATH_PENALTY = 50;

/**
 * Returns true if a tile contains severe environmental hazards (scald steam or corrosive acid).
 */
export function isHazardTile(
  state: WorldState,
  x: number,
  y: number,
  stratum: StratumId,
): boolean {
  const grid = state.strata[stratum];
  if (!grid || !isWithinBounds(grid, x, y)) return false;
  const cell = getTileCell(grid, x, y);
  if (!cell) return false;
  return cell.steamPressureKpa >= 25 || cell.liquidType === 'NITRIC_ACID';
}

/**
 * Computes the next step (dx, dy) for an NPC moving toward targetPos, avoiding solid obstacles,
 * blocking actors, and high-temperature steam / nitric acid hazards.
 */
export function findEcologyNextStep(
  state: WorldState,
  actor: EntityRecord,
  targetPos: Point3D,
): { dx: number; dy: number } | null {
  if (!actor.position || actor.position.stratum !== targetPos.stratum) return null;
  const { x: ax, y: ay, stratum } = actor.position;
  if (ax === targetPos.x && ay === targetPos.y) return null;

  const grid = state.strata[stratum];
  if (!grid) return null;

  const deltas = [
    { dx: 0, dy: -1 },
    { dx: 0, dy: 1 },
    { dx: -1, dy: 0 },
    { dx: 1, dy: 0 },
    { dx: -1, dy: -1 },
    { dx: 1, dy: -1 },
    { dx: -1, dy: 1 },
    { dx: 1, dy: 1 },
  ];

  type Candidate = { dx: number; dy: number; score: number };
  const validCandidates: Candidate[] = [];

  for (const { dx, dy } of deltas) {
    const nx = ax + dx;
    const ny = ay + dy;
    if (!isWithinBounds(grid, nx, ny)) continue;

    const cell = getTileCell(grid, nx, ny);
    if (!cell || cell.blocksMovement) continue;

    const blocking = findBlockingEntityAtPoint(state.entities, { x: nx, y: ny, stratum });
    if (blocking && blocking.id !== actor.id && blocking.position?.blocksMovement) continue;

    const distToTarget = Math.max(Math.abs(targetPos.x - nx), Math.abs(targetPos.y - ny));
    const hazardPenalty = isHazardTile(state, nx, ny, stratum) ? HAZARD_PATH_PENALTY : 0;
    const score = distToTarget + hazardPenalty;

    validCandidates.push({ dx, dy, score });
  }

  if (validCandidates.length === 0) return null;

  validCandidates.sort((a, b) => a.score - b.score);
  return { dx: validCandidates[0]!.dx, dy: validCandidates[0]!.dy };
}
