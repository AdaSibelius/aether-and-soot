import { describe, expect, it } from 'vitest';
import { drawMachinedBezel } from '../../src/client/canvas-ui/bezel-composer.js';
import { createUiCellBuffer } from '../../src/client/canvas-ui/cell-buffer.js';
import { resolveTileFromMouse } from '../../src/client/input/mouse-router.js';
import { projectWorldToVisualFrame } from '../../src/client/projection/frame-adapter.js';
import {
   computeAspectLockedScale,
  transformClientToGrid,
} from '../../src/client/renderer/desktop-window-manager.js';
import { CELL_HEIGHT_PX, CELL_WIDTH_PX, WIDESCREEN_GRID_HEIGHT, WIDESCREEN_GRID_WIDTH } from '../../src/client/renderer/glyph-stage.js';
import { EntityIdSchema } from '../../src/schemas/primitives.schema.js';
import { createInitialWorld } from '../../src/sim/core/world.js';
import { generateVictorianDistrict } from '../../src/sim/spatial/generator.js';

describe('Dynamic Viewport Scaling & Mouse Coordinate Transforms', () => {
  const baseWidth = WIDESCREEN_GRID_WIDTH * CELL_WIDTH_PX; // 1056
  const baseHeight = WIDESCREEN_GRID_HEIGHT * CELL_HEIGHT_PX; // 720

  describe('computeAspectLockedScale', () => {
    it('scales proportionally for 1560x980 widescreen capture resolution', () => {
      const metrics = computeAspectLockedScale({ windowWidth: 1560, windowHeight: 980 }, baseWidth, baseHeight);
      expect(metrics.scaledHeight).toBe(980);
      expect(metrics.scaledWidth).toBe(1437);
      expect(metrics.offsetX).toBe(61);
      expect(metrics.offsetY).toBe(0);
    });

    it('scales to exact 1.5x for 1920x1080 Full HD displays', () => {
      const metrics = computeAspectLockedScale({ windowWidth: 1920, windowHeight: 1080 }, baseWidth, baseHeight);
      expect(metrics.scaleFactor).toBeCloseTo(1.5, 4);
      expect(metrics.scaledWidth).toBe(1584);
      expect(metrics.scaledHeight).toBe(1080);
      expect(metrics.offsetX).toBe(168);
      expect(metrics.offsetY).toBe(0);
    });

    it('scales down cleanly on compact 800x600 displays', () => {
      const metrics = computeAspectLockedScale({ windowWidth: 800, windowHeight: 600 }, baseWidth, baseHeight);
      expect(metrics.scaledWidth).toBe(800);
      expect(metrics.scaledHeight).toBe(545);
      expect(metrics.offsetX).toBe(0);
      expect(metrics.offsetY).toBe(27);
    });
  });

  describe('transformClientToGrid', () => {
    it('maps 1:1 unscaled client coordinates to grid cells', () => {
      const rect = { left: 0, top: 0, width: baseWidth, height: baseHeight };
      expect(transformClientToGrid(0, 0, rect)).toEqual({ col: 0, row: 0, inside: true });
      expect(transformClientToGrid(12, 20, rect)).toEqual({ col: 1, row: 1, inside: true });
      expect(transformClientToGrid(baseWidth - 1, baseHeight - 1, rect)).toEqual({
        col: WIDESCREEN_GRID_WIDTH - 1,
        row: WIDESCREEN_GRID_HEIGHT - 1,
        inside: true,
      });
    });

    it('maps 1.5x scaled and letterboxed client coordinates accurately', () => {
      // 1.5x scale => cell width = 18px, cell height = 30px, offset (100, 50)
      const rect = { left: 100, top: 50, width: 1584, height: 1080 };
      expect(transformClientToGrid(100, 50, rect)).toEqual({ col: 0, row: 0, inside: true });
      expect(transformClientToGrid(100 + 18 * 10 + 5, 50 + 30 * 5 + 10, rect)).toEqual({
        col: 10,
        row: 5,
        inside: true,
      });
      expect(transformClientToGrid(90, 50, rect).inside).toBe(false);
    });
  });

  describe('resolveTileFromMouse & Scaled Hit Action Resolution', () => {
    it('resolves identical world coordinates across 1x and 2x scaled viewports', () => {
      const state = generateVictorianDistrict(createInitialWorld({ seed: 101 })).state;
      const playerId = EntityIdSchema.parse('actor_player');

      const host1x = {
        getBoundingClientRect: () => ({ left: 0, top: 0, width: baseWidth, height: baseHeight }),
      } as unknown as HTMLElement;
      const host2x = {
        getBoundingClientRect: () => ({ left: 200, top: 100, width: baseWidth * 2, height: baseHeight * 2 }),
      } as unknown as HTMLElement;

      const tile1x = resolveTileFromMouse({ clientX: 12 * 15 + 6, clientY: 20 * 10 + 10 } as MouseEvent, host1x, state, playerId);
      const tile2x = resolveTileFromMouse({ clientX: 200 + 24 * 15 + 12, clientY: 100 + 40 * 10 + 20 } as MouseEvent, host2x, state, playerId);

      expect(tile1x).not.toBeNull();
      expect(tile2x).toEqual(tile1x);
    });

    it('resolves UI cell buffer hit actions accurately when scaled', () => {
      const buf = createUiCellBuffer(88, 36);
      buf.writeString(62, 35, '[I]NV', '#ffffff', '#000000', undefined, 'open_inventory');

      const rectScaled = { left: 61, top: 0, width: 1437, height: 980 };
      const clientX = rectScaled.left + (63.5 / 88) * rectScaled.width;
      const clientY = rectScaled.top + (35.5 / 36) * rectScaled.height;

      const { col, row, inside } = transformClientToGrid(clientX, clientY, rectScaled);
      expect(inside).toBe(true);
      expect(col).toBe(63);
      expect(row).toBe(35);
      expect(buf.resolveHitActionAt(col, row)).toBe('open_inventory');
    });

    it('centers 48x36 district inside the 58-column tactical viewport (0..57) and keeps rightside console (58..87) opaque', () => {
      const state = generateVictorianDistrict(createInitialWorld({ seed: 101, width: 48, height: 36 })).state;
      const playerId = EntityIdSchema.parse('actor_player');

      const frame = projectWorldToVisualFrame(state, playerId, undefined, {
        width: WIDESCREEN_GRID_WIDTH,
        height: WIDESCREEN_GRID_HEIGHT,
        tacticalWidth: WIDESCREEN_GRID_WIDTH - 30,
      });

      // (58 - 48) / 2 = 5 => district occupies columns 5..52, never colliding with console columns 58..87
      expect(frame.cameraOrigin.x).toBe(-5);
      expect(frame.cells[5]?.worldX).toBe(0);
      expect(frame.cells[52]?.worldX).toBe(47);

      // Console bezel fills interior with opaque background (never transparent)
      const buf = createUiCellBuffer(88, 36, { glyph: ' ', fg: '#000000', bg: 'transparent' });
      drawMachinedBezel(buf, { x: 58, y: 0, width: 30, height: 36 });
      expect(buf.getCell(65, 18)?.bg).not.toBe('transparent');

      // Hovering over the rightside console (col >= 58) returns null instead of out-of-bounds world coordinates
      const host = {
        getBoundingClientRect: () => ({ left: 0, top: 0, width: baseWidth, height: baseHeight }),
      } as unknown as HTMLElement;
      expect(resolveTileFromMouse({ clientX: 60 * 12 + 4, clientY: 18 * 20 + 4 } as MouseEvent, host, state, playerId)).toBeNull();
    });
  });
});
