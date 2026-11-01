import { describe, expect, it } from 'vitest';
import { createUiCellBuffer } from '../../src/client/canvas-ui/cell-buffer.js';
import { drawMachinedBezel } from '../../src/client/canvas-ui/bezel-composer.js';
import {
  resolveThermodynamicPalette,
  resolveVisualDepthTier,
  VICTORIAN_PALETTE,
  VISUAL_DEPTH_TIERS,
} from '../../src/client/canvas-ui/material-palette.js';

describe('Oxidized Iron Palette & Visual Depth Stratification', () => {
  it('ratifies the 6 canonical oxidized iron tokens with exact hex values', () => {
    expect(VICTORIAN_PALETTE.DEEP_RUST).toBe('#7A2E22');
    expect(VICTORIAN_PALETTE.CHARCOAL).toBe('#1B1F22');
    expect(VICTORIAN_PALETTE.TARNISHED_BRASS).toBe('#C5A059');
    expect(VICTORIAN_PALETTE.VERDIGRIS).toBe('#3D7E73');
    expect(VICTORIAN_PALETTE.SULFUR_AMBER).toBe('#E5A93C');
    expect(VICTORIAN_PALETTE.SOOT_BLACK).toBe('#0B0C0E');
  });

  it('defines the 4-tier Z-depth stratification hierarchy with strict ascending zIndex', () => {
    expect(VISUAL_DEPTH_TIERS.Z0_TACTICAL_VOID.zIndex).toBe(0);
    expect(VISUAL_DEPTH_TIERS.Z1_RECESS_WELL.zIndex).toBe(1);
    expect(VISUAL_DEPTH_TIERS.Z2_MACHINED_CHASSIS.zIndex).toBe(2);
    expect(VISUAL_DEPTH_TIERS.Z3_EMISSIVE_READOUT.zIndex).toBe(3);

    // Z0 Tactical Void
    const z0 = resolveVisualDepthTier('Z0_TACTICAL_VOID');
    expect(z0.bg).toBe(VICTORIAN_PALETTE.SOOT_BLACK);
    expect(z0.accent).toBe(VICTORIAN_PALETTE.DEEP_RUST);

    // Z1 Recess Well
    const z1 = resolveVisualDepthTier('Z1_RECESS_WELL');
    expect(z1.bg).toBe(VICTORIAN_PALETTE.CHARCOAL);
    expect(z1.border).toBe(VICTORIAN_PALETTE.DEEP_RUST);

    // Z2 Machined Chassis
    const z2 = resolveVisualDepthTier('Z2_MACHINED_CHASSIS');
    expect(z2.border).toBe(VICTORIAN_PALETTE.TARNISHED_BRASS);

    // Z3 Emissive Readout
    const z3 = resolveVisualDepthTier('Z3_EMISSIVE_READOUT');
    expect(z3.fg).toBe(VICTORIAN_PALETTE.SULFUR_AMBER);
  });

  it('binds bezel tier options to the 4-tier visual depth palette in drawMachinedBezel', () => {
    const buf = createUiCellBuffer(12, 6);
    drawMachinedBezel(buf, { x: 0, y: 0, width: 12, height: 6 }, {
      tier: 'Z1_RECESS_WELL',
      title: 'TICKER',
    });

    // Interior well uses CHARCOAL background
    expect(buf.getCell(1, 1)?.bg).toBe(VICTORIAN_PALETTE.CHARCOAL);
    // Border uses DEEP_RUST at non-rivet positions
    expect(buf.getCell(2, 0)?.fg).toBe(VICTORIAN_PALETTE.DEEP_RUST);
    expect(buf.getCell(2, 0)?.glyph).toBe('═');
    expect(buf.getCell(0, 1)?.glyph).toBe('║');
    // Rivet uses accent (VERDIGRIS for Z1)
    expect(buf.getCell(1, 0)?.glyph).toBe('☼');
    expect(buf.getCell(1, 0)?.fg).toBe(VICTORIAN_PALETTE.VERDIGRIS);
  });

  it('preserves thermodynamic palette stress levels with sulfur amber highlights', () => {
    const nominal = resolveThermodynamicPalette('NOMINAL');
    expect(nominal.borderFg).toBe(VICTORIAN_PALETTE.TARNISHED_BRASS);
    expect(nominal.accentFg).toBe(VICTORIAN_PALETTE.SULFUR_AMBER);

    const elevated = resolveThermodynamicPalette('ELEVATED');
    expect(elevated.borderFg).toBe(VICTORIAN_PALETTE.SULFUR_AMBER);
    expect(elevated.primaryShaderFlag).toBe('GASLIGHT_BLOOM');

    const critical = resolveThermodynamicPalette('CRITICAL');
    expect(critical.borderFg).toBe(VICTORIAN_PALETTE.INCANDESCENT_RED);
    expect(critical.primaryShaderFlag).toBe('THERMO_CRITICAL_PULSE');
  });
});
