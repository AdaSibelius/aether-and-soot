import { describe, expect, it } from 'vitest';
import {
  drawDiegeticTextInput,
  drawScrollableRegion,
  TestCellBuffer,
} from '../../src/client/canvas-ui/viewport-controls.js';

describe('Canvas UI Viewport Controls', () => {
  describe('drawScrollableRegion', () => {
    it('renders text lines without scrollbar when content fits in viewport', () => {
      const buf = new TestCellBuffer(20, 5);
      const lines = ['Line 1', 'Line 2', 'Line 3'];

      const result = drawScrollableRegion(buf, { x: 0, y: 0, width: 20, height: 5 }, lines, 0);

      expect(result.isScrollable).toBe(false);
      expect(result.maxScrollOffset).toBe(0);
      expect(result.clampedScrollOffset).toBe(0);
      expect(buf.getRowText(0)).toContain('Line 1');
      expect(buf.getRowText(1)).toContain('Line 2');
      expect(buf.getRowText(2)).toContain('Line 3');
      expect(buf.getRowText(0)).not.toContain('▲');
    });

    it('clamps negative scroll offset to 0 and clamps excessive scroll offset to maxScrollOffset', () => {
      const buf = new TestCellBuffer(15, 4);
      const lines = ['A', 'B', 'C', 'D', 'E', 'F', 'G']; // 7 lines, height 4 -> max offset 3

      const underflow = drawScrollableRegion(buf, { x: 0, y: 0, width: 15, height: 4 }, lines, -5);
      expect(underflow.clampedScrollOffset).toBe(0);
      expect(underflow.maxScrollOffset).toBe(3);
      expect(underflow.isScrollable).toBe(true);
      expect(buf.getRowText(0)).toContain('A');

      const overflow = drawScrollableRegion(buf, { x: 0, y: 0, width: 15, height: 4 }, lines, 99);
      expect(overflow.clampedScrollOffset).toBe(3);
      expect(overflow.maxScrollOffset).toBe(3);
      expect(buf.getRowText(0)).toContain('D');
      expect(buf.getRowText(3)).toContain('G');
    });

    it('positions mechanical scrollbar arrows and thumb accurately along the track', () => {
      const buf = new TestCellBuffer(10, 5);
      const lines = ['1', '2', '3', '4', '5', '6', '7', '8', '9']; // 9 lines, height 5 -> max offset 4

      // At top (offset 0)
      const topResult = drawScrollableRegion(buf, { x: 0, y: 0, width: 10, height: 5 }, lines, 0);
      expect(buf.getCell(9, 0)?.glyph).toBe('▲');
      expect(buf.getCell(9, 4)?.glyph).toBe('▼');
      expect(topResult.thumbY).toBe(1);
      expect(buf.getCell(9, 1)?.glyph).toBe('█');
      expect(buf.getCell(9, 2)?.glyph).toBe('║');

      // At bottom (offset 4)
      const bottomResult = drawScrollableRegion(buf, { x: 0, y: 0, width: 10, height: 5 }, lines, 4);
      expect(bottomResult.thumbY).toBe(3);
      expect(buf.getCell(9, 3)?.glyph).toBe('█');
    });
  });

  describe('drawDiegeticTextInput', () => {
    it('renders two-row input box with label header and prompt prefix', () => {
      const buf = new TestCellBuffer(25, 3);
      drawDiegeticTextInput(buf, { x: 0, y: 0, width: 20, height: 2 }, 'SEED', '12345', false, 0);

      expect(buf.getRowText(0)).toContain('[ SEED ]');
      expect(buf.getRowText(1)).toContain('> 12345');
    });

    it('renders blinking cursor when focused based on tick frequency', () => {
      const bufEven = new TestCellBuffer(20, 2);
      drawDiegeticTextInput(bufEven, { x: 0, y: 0, width: 15, height: 2 }, 'NAME', 'Ada', true, 0);
      expect(bufEven.getRowText(1)).toContain('_');

      const bufOdd = new TestCellBuffer(20, 2);
      drawDiegeticTextInput(bufOdd, { x: 0, y: 0, width: 15, height: 2 }, 'NAME', 'Ada', true, 30);
      expect(bufOdd.getRowText(1)).not.toContain('_');

      const bufUnfocused = new TestCellBuffer(20, 2);
      drawDiegeticTextInput(bufUnfocused, { x: 0, y: 0, width: 15, height: 2 }, 'NAME', 'Ada', false, 0);
      expect(bufUnfocused.getRowText(1)).not.toContain('_');
    });

    it('truncates overflow values to show trailing characters near the cursor', () => {
      const buf = new TestCellBuffer(15, 2);
      // availableWidth = 15 - 3 = 12 characters. Value has 16 characters.
      drawDiegeticTextInput(buf, { x: 0, y: 0, width: 15, height: 2 }, 'KEY', '1234567890ABCDEF', true, 0);

      const inputRow = buf.getRowText(1);
      expect(inputRow).toContain('567890ABCDEF');
      expect(inputRow).not.toContain('1234');
    });

    it('renders single-row compact format when height is 1', () => {
      const buf = new TestCellBuffer(25, 1);
      drawDiegeticTextInput(buf, { x: 0, y: 0, width: 20, height: 1 }, 'FIND', 'Soot', false, 0);

      const row = buf.getRowText(0);
      expect(row).toContain('[ FIND: Soot');
      expect(row).toContain(']');
    });
  });
});
