import { EntityRecord } from '../schemas/components.schema.js';
import { EntityId, Point3D, StratumId } from '../schemas/primitives.schema.js';
import { WorldState } from '../sim/core/world.js';
import { getTileCell } from '../sim/spatial/grid.js';
import { ModalWindowId } from './ui/CharacterModalShell.js';

export const MODAL_WINDOW_IDS: readonly ModalWindowId[] = ['INVENTORY', 'ANATOMY', 'WORKBENCH', 'EXCHANGE', 'ATLAS', 'CODEX'];

export function cycleModalWindow(current: ModalWindowId | null, direction: 1 | -1): ModalWindowId {
  if (!current) return 'INVENTORY';
  const idx = MODAL_WINDOW_IDS.indexOf(current);
  const nextIdx = (idx + direction + MODAL_WINDOW_IDS.length) % MODAL_WINDOW_IDS.length;
  return MODAL_WINDOW_IDS[nextIdx] ?? 'INVENTORY';
}

export function findAdjacentDialogueNpc(state: WorldState, playerId: EntityId): EntityId | undefined {
  const p = state.entities[playerId]?.position;
  if (!p) return undefined;
  const adj = Object.values(state.entities).find(
    (e) => e.id !== playerId && e.actor && !e.actor.isPlayer && !e.aiController?.hostile && e.position
      && e.position.stratum === p.stratum && Math.max(Math.abs(e.position.x - p.x), Math.abs(e.position.y - p.y)) <= 1,
  );
  return adj?.id;
}

export function findAdjacentDoorTarget(state: WorldState, playerId: EntityId): Point3D | undefined {
  const p = state.entities[playerId]?.position;
  const grid = p ? state.strata[p.stratum] : undefined;
  if (!p || !grid) return undefined;
  const dirs = [{ x: 0, y: -1 }, { x: 0, y: 1 }, { x: -1, y: 0 }, { x: 1, y: 0 }];
  const match = dirs.map((d) => ({ x: p.x + d.x, y: p.y + d.y, c: getTileCell(grid, p.x + d.x, p.y + d.y) }))
    .find((t) => t.c?.terrainType === 'WOODEN_DOOR_CLOSED')
    ?? dirs.map((d) => ({ x: p.x + d.x, y: p.y + d.y, c: getTileCell(grid, p.x + d.x, p.y + d.y) }))
      .find((t) => t.c?.terrainType === 'WOODEN_DOOR_OPEN');
  return match ? { x: match.x, y: match.y, stratum: p.stratum } : undefined;
}

export function findEntityAtLookCursor(
  state: WorldState,
  stratum: StratumId,
  cursor: { x: number; y: number },
  excludeId?: EntityId,
): EntityRecord | undefined {
  return Object.values(state.entities).find(
    (e) => e.id !== excludeId && e.actor && e.position && e.position.stratum === stratum && e.position.x === cursor.x && e.position.y === cursor.y,
  );
}

export function clampLookCursor(
  cursor: { x: number; y: number },
  dx: number,
  dy: number,
  width: number,
  height: number,
): { x: number; y: number } {
  return {
    x: Math.max(0, Math.min(width - 1, cursor.x + dx)),
    y: Math.max(0, Math.min(height - 1, cursor.y + dy)),
  };
}
