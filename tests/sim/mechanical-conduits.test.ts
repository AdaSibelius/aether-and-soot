import { describe, expect, it } from 'vitest';
import { createUiCellBuffer } from '../../src/client/canvas-ui/cell-buffer.js';
import { VICTORIAN_PALETTE } from '../../src/client/canvas-ui/material-palette.js';
import { drawAsciiConduit } from '../../src/client/canvas-ui/mechanical-conduits.js';
import { applyMechanicalCylinderScramble } from '../../src/client/canvas-ui/mechanical-transition.js';

describe('Mechanical Conduits & 100ms Cylinder Transitions', () => {
  describe('drawAsciiConduit', () => {
    it('routes Manhattan CP437 pipes with proper corner junctions', () => {
      const buf = createUiCellBuffer(15, 10);
      const result = drawAsciiConduit(buf, { x: 2, y: 3 }, { x: 8, y: 7 });

      expect(result.pathLength).toBeGreaterThan(5);

      // Start cap at (2, 3)
      expect(buf.getCell(2, 3)?.glyph).toBe('╠');
      // Horizontal run
      expect(buf.getCell(4, 3)?.glyph).toBe('═');
      // Downward right corner at (8, 3)
      expect(buf.getCell(8, 3)?.glyph).toBe('╗');
      // Vertical run
      expect(buf.getCell(8, 5)?.glyph).toBe('║');
      // Terminus at (8, 7)
      expect(buf.getCell(8, 7)?.glyph).toBe('╬');
    });

    it('routes straight horizontal pipes with terminal caps', () => {
      const buf = createUiCellBuffer(12, 6);
      drawAsciiConduit(buf, { x: 2, y: 4 }, { x: 7, y: 4 });

      expect(buf.getCell(2, 4)?.glyph).toBe('╠');
      expect(buf.getCell(4, 4)?.glyph).toBe('═');
      expect(buf.getCell(7, 4)?.glyph).toBe('╣');
    });

    it('illuminates a 3-cell traveling highlight along the conduit with aether halation', () => {
      const buf = createUiCellBuffer(15, 6);
      const result = drawAsciiConduit(buf, { x: 1, y: 2 }, { x: 10, y: 2 }, {
        signalProgress: 0.5,
      });

      const midIdx = Math.round(0.5 * (result.pathLength - 1));
      const midPoint = result.path[midIdx]!;
      const midCell = buf.getCell(midPoint.x, midPoint.y);

      // Midpoint has Aether Blue and halation
      expect(midCell?.fg).toBe(VICTORIAN_PALETTE.AETHER_BLUE);
      expect(midCell?.shaderFlags).toContain('AETHER_HALATION');

      // Beginning of pipe is unlit (muted pipe color)
      const startPoint = result.path[0]!;
      const startCell = buf.getCell(startPoint.x, startPoint.y);
      expect(startCell?.fg).toBe(VICTORIAN_PALETTE.MUTED_PIPE);
      expect(startCell?.shaderFlags).toBeUndefined();
    });
  });

  describe('applyMechanicalCylinderScramble', () => {
    it('scrambles interior cells during the 100ms transition while preserving structural borders', () => {
      const buf = createUiCellBuffer(12, 6);

      // Draw structural border
      buf.setCell(0, 0, '☼');
      buf.setCell(1, 0, '═');
      buf.setCell(0, 1, '█');

      // Draw interior text content
      buf.writeString(3, 2, 'SATCHEL');

      // Apply transition at 30ms (< 100ms)
      const inProgress = applyMechanicalCylinderScramble(buf, 30, 100);
      expect(inProgress).toBe(true);

      // Structural borders remain anchored
      expect(buf.getCell(0, 0)?.glyph).toBe('☼');
      expect(buf.getCell(1, 0)?.glyph).toBe('═');
      expect(buf.getCell(0, 1)?.glyph).toBe('█');

      // Unsettled interior cells scramble to brass cylinder glyphs with gaslight bloom
      const scrambledCell = buf.getCell(10, 2);
      expect(scrambledCell?.fg).toBe(VICTORIAN_PALETTE.TARNISHED_BRASS);
      expect(scrambledCell?.shaderFlags).toContain('GASLIGHT_BLOOM');
    });

    it('completes immediately and leaves buffer completely settled when elapsedMs >= durationMs', () => {
      const buf = createUiCellBuffer(12, 6);
      buf.writeString(2, 2, 'FINISHED');

      const completed = applyMechanicalCylinderScramble(buf, 100, 100);
      expect(completed).toBe(false);

      // Content is completely settled and unmodified
      expect(buf.extractRowString(2)).toContain('FINISHED');

      const pastDuration = applyMechanicalCylinderScramble(buf, 150, 100);
      expect(pastDuration).toBe(false);
      expect(buf.extractRowString(2)).toContain('FINISHED');
    });
  });
});
