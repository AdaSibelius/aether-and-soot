import { describe, expect, it } from 'vitest';
import { createUiCellBuffer } from '../../src/client/canvas-ui/cell-buffer.js';
import {
  drawBrassToggleTabs,
  drawDiegeticGauge,
  drawIndustrialFrame,
} from '../../src/client/canvas-ui/industrial-primitives.js';
import { VICTORIAN_PALETTE } from '../../src/client/canvas-ui/material-palette.js';

describe('Canvas UI Industrial Primitives', () => {
  describe('drawIndustrialFrame', () => {
    it('renders PRIMARY_IRON frame with heavy rivets and block borders', () => {
      const buf = createUiCellBuffer(12, 6);
      drawIndustrialFrame(buf, { x: 0, y: 0, width: 12, height: 6 }, {
        tier: 'PRIMARY_IRON',
        title: 'BENCH',
      });

      expect(buf.getCell(0, 0)?.glyph).toBe('☼');
      expect(buf.getCell(11, 0)?.glyph).toBe('☼');
      expect(buf.getCell(0, 5)?.glyph).toBe('Ø');
      expect(buf.getCell(11, 5)?.glyph).toBe('Ø');
      expect(buf.getCell(10, 0)?.glyph).toBe('▀');
      expect(buf.getCell(0, 1)?.glyph).toBe('█');
      expect(buf.getCell(1, 5)?.glyph).toBe('▄');
      expect(buf.extractRowString(0)).toContain('[ BENCH ]');
    });

    it('adapts PRIMARY_IRON frame color and shader flag under CRITICAL thermodynamic stress', () => {
      const buf = createUiCellBuffer(10, 4);
      drawIndustrialFrame(buf, { x: 0, y: 0, width: 10, height: 4 }, {
        tier: 'PRIMARY_IRON',
        stressLevel: 'CRITICAL',
      });

      const topBorderCell = buf.getCell(1, 0);
      expect(topBorderCell?.fg).toBe(VICTORIAN_PALETTE.INCANDESCENT_RED);
      expect(topBorderCell?.shaderFlags).toContain('THERMO_CRITICAL_PULSE');
    });

    it('renders SECONDARY_BRASS double-line borders and SEPIA_LEDGER spine', () => {
      const brassBuf = createUiCellBuffer(8, 4);
      drawIndustrialFrame(brassBuf, { x: 0, y: 0, width: 8, height: 4 }, {
        tier: 'SECONDARY_BRASS',
      });
      expect(brassBuf.getCell(0, 0)?.glyph).toBe('╔');
      expect(brassBuf.getCell(7, 0)?.glyph).toBe('╗');
      expect(brassBuf.getCell(1, 0)?.glyph).toBe('═');
      expect(brassBuf.getCell(0, 1)?.glyph).toBe('║');

      const ledgerBuf = createUiCellBuffer(8, 4);
      drawIndustrialFrame(ledgerBuf, { x: 0, y: 0, width: 8, height: 4 }, {
        tier: 'SEPIA_LEDGER',
      });
      expect(ledgerBuf.getCell(0, 0)?.glyph).toBe('┌');
      expect(ledgerBuf.getCell(0, 1)?.glyph).toBe('⣿'); // Ledger spine
      expect(ledgerBuf.getCell(1, 0)?.glyph).toBe('─');
    });
  });

  describe('drawBrassToggleTabs', () => {
    it('renders depressed inverted active tab and raised machined inactive tabs with hit actions', () => {
      const buf = createUiCellBuffer(35, 4);
      const tabs = [
        { id: 'SATCHEL', label: 'SATCHEL' },
        { id: 'BENCH', label: 'BENCH' },
      ];

      drawBrassToggleTabs(buf, 0, 0, tabs, 'SATCHEL');

      // Active tab (SATCHEL) is depressed: rendered at y + 1 with inverted color
      const activeRow = buf.extractRowString(1);
      expect(activeRow).toContain('[► SATCHEL ◄]');
      expect(buf.getCell(1, 1)?.bg).toBe(VICTORIAN_PALETTE.TARNISHED_BRASS);
      expect(buf.getCell(1, 1)?.fg).toBe(VICTORIAN_PALETTE.SOOT_IRON_BG);
      expect(buf.resolveHitActionAt(1, 1)).toBe('tab:SATCHEL');

      // Inactive tab (BENCH) is raised: rendered at y
      const raisedRow = buf.extractRowString(0);
      expect(raisedRow).toContain('[ BENCH ]');
      const benchCellX = activeRow.indexOf('[ BENCH ]') !== -1 ? activeRow.indexOf('[ BENCH ]') + 1 : 16;
      expect(buf.resolveHitActionAt(benchCellX, 0)).toBe('tab:BENCH');
    });
  });

  describe('drawDiegeticGauge', () => {
    it('renders PRESSURE_COLUMN gauge with fill segments and numeric percentages', () => {
      const buf = createUiCellBuffer(25, 3);
      drawDiegeticGauge(buf, 0, 0, 20, 0.5, { label: 'BOILER' });

      const rowText = buf.extractRowString(0);
      expect(rowText).toContain('BOILER: [');
      expect(rowText).toContain('] 50%');
      expect(rowText).toContain('█');
      expect(rowText).toContain('▒');
      expect(rowText).toContain('·');
    });

    it('illuminates CRITICAL threshold with incandescent red and pulse flag', () => {
      const buf = createUiCellBuffer(25, 2);
      drawDiegeticGauge(buf, 0, 0, 20, 0.95, {
        label: 'HEAT',
        currentVal: 95,
        unit: 'C',
      });

      const rowText = buf.extractRowString(0);
      expect(rowText).toContain('HEAT: [');
      expect(rowText).toContain(' 95C');

      const filledCell = buf.getCell(7, 0); // Inside the bracket
      expect(filledCell?.fg).toBe(VICTORIAN_PALETTE.INCANDESCENT_RED);
      expect(filledCell?.shaderFlags).toContain('THERMO_CRITICAL_PULSE');
    });

    it('renders LIQUID_TUBE gauge with curved parenthesis and reservoir dithering', () => {
      const buf = createUiCellBuffer(20, 2);
      drawDiegeticGauge(buf, 0, 0, 16, 0.4, { style: 'LIQUID_TUBE' });

      const rowText = buf.extractRowString(0);
      expect(rowText).toContain('(');
      expect(rowText).toContain(')');
      expect(rowText).toContain('▓');
    });
  });

  describe('UiCellBuffer word wrapping and hit action resolution', () => {
    it('wraps text cleanly into the specified rect and resolves hit actions', () => {
      const buf = createUiCellBuffer(15, 4);
      const linesRendered = buf.writeWrappedText(
        { x: 0, y: 0, width: 10, height: 4 },
        'Steam pressure rising in boiler core',
      );

      expect(linesRendered).toBeGreaterThan(1);
      expect(buf.extractRowString(0)).toContain('Steam');
      expect(buf.extractRowString(1)).toContain('pressure');

      buf.setCell(2, 2, 'X', undefined, undefined, undefined, 'inspect:valve');
      expect(buf.resolveHitActionAt(2, 2)).toBe('inspect:valve');
      expect(buf.resolveHitActionAt(0, 0)).toBeUndefined();
    });
  });
});
