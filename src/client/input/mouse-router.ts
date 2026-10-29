import { EntityId } from '../../schemas/primitives.schema.js';
import { WorldState } from '../../sim/core/world.js';
import { projectWorldToVisualFrame } from '../projection/frame-adapter.js';
import { transformClientToGrid } from '../renderer/desktop-window-manager.js';
import { WIDESCREEN_GRID_HEIGHT, WIDESCREEN_GRID_WIDTH } from '../renderer/glyph-stage.js';

/**
 * Resolves browser mouse event coordinates to absolute world coordinates in the tactical grid,
 * scaling proportionally against the rendered bounding box.
 */
export function resolveTileFromMouse(
  ev: { clientX: number; clientY: number },
  canvasHost: { getBoundingClientRect: () => DOMRect | { left: number; top: number; width: number; height: number } },
  worldState: WorldState,
  playerId: EntityId,
): { x: number; y: number } | null {
  const rect = canvasHost.getBoundingClientRect();
  const { col: sx, row: sy, inside } = transformClientToGrid(
    ev.clientX,
    ev.clientY,
    rect,
    WIDESCREEN_GRID_WIDTH,
    WIDESCREEN_GRID_HEIGHT,
  );
  if (!inside) return null;

  const tacticalWidth = WIDESCREEN_GRID_WIDTH - 30;
  if (sx >= 0 && sx < tacticalWidth && sy >= 0 && sy < WIDESCREEN_GRID_HEIGHT) {
    const frame = projectWorldToVisualFrame(worldState, playerId, undefined, {
      width: WIDESCREEN_GRID_WIDTH,
      height: WIDESCREEN_GRID_HEIGHT,
      tacticalWidth,
    });
    return {
      x: frame.cameraOrigin.x + sx,
      y: frame.cameraOrigin.y + sy,
    };
  }
  return null;
}
