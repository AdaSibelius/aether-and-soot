import { EntityId } from '../../schemas/primitives.schema.js';
import { WorldState } from '../../sim/core/world.js';
import { projectWorldToVisualFrame } from '../projection/frame-adapter.js';
import { CELL_HEIGHT_PX, CELL_WIDTH_PX, WIDESCREEN_GRID_HEIGHT, WIDESCREEN_GRID_WIDTH } from '../renderer/glyph-stage.js';

/**
 * Resolves browser mouse event coordinates to absolute world coordinates in the tactical grid.
 */
export function resolveTileFromMouse(
  ev: MouseEvent,
  canvasHost: HTMLElement,
  worldState: WorldState,
  playerId: EntityId,
): { x: number; y: number } | null {
  const rect = canvasHost.getBoundingClientRect();
  const sx = Math.floor((ev.clientX - rect.left) / CELL_WIDTH_PX);
  const sy = Math.floor((ev.clientY - rect.top) / CELL_HEIGHT_PX);

  if (sx >= 0 && sx < WIDESCREEN_GRID_WIDTH && sy >= 0 && sy < WIDESCREEN_GRID_HEIGHT) {
    const frame = projectWorldToVisualFrame(worldState, playerId, undefined, {
      width: WIDESCREEN_GRID_WIDTH,
      height: WIDESCREEN_GRID_HEIGHT,
    });
    return {
      x: frame.cameraOrigin.x + sx,
      y: frame.cameraOrigin.y + sy,
    };
  }
  return null;
}
