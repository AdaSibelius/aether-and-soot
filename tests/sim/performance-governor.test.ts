import { describe, expect, it } from 'vitest';
import { createUiCellBuffer } from '../../src/client/canvas-ui/cell-buffer.js';
import { applyMechanicalCylinderScramble } from '../../src/client/canvas-ui/mechanical-transition.js';
import { PerformanceGovernor } from '../../src/client/renderer/performance-governor.js';
import { auditUiCellBuffer } from '../scripts/playtester-projection-audit.js';

describe('PerformanceGovernor & Accessibility Gate (Phase UI-6)', () => {
  it('tracks rolling frame times and calculates average FPS correctly', () => {
    const governor = new PerformanceGovernor({ autoScaleQuality: false });
    expect(governor.getFps()).toBe(60);

    for (let i = 0; i < 30; i++) {
      governor.recordFrameTime(16.67);
    }
    expect(governor.getFps()).toBe(60);

    for (let i = 0; i < 30; i++) {
      governor.recordFrameTime(33.33);
    }
    // Average frame time across last 60 frames = (30 * 16.67 + 30 * 33.33) / 60 = 25ms => ~40 fps
    expect(governor.getFps()).toBe(40);
  });

  it('automatically scales down shader quality when frame times degrade', () => {
    const governor = new PerformanceGovernor({
      qualityTier: 'HIGH_OPTICAL',
      autoScaleQuality: true,
    });

    expect(governor.getQualityTier()).toBe('HIGH_OPTICAL');
    expect(governor.getEffectiveDistortionScale()).toBe(1.0);
    expect(governor.shouldSimulateSmoke()).toBe(true);

    // Simulate 35 heavy frames (> 33.3ms / < 30 fps)
    for (let i = 0; i < 35; i++) {
      governor.recordFrameTime(40.0);
    }

    expect(governor.getQualityTier()).toBe('BALANCED');
    expect(governor.getEffectiveDistortionScale()).toBe(0.5);
    expect(governor.shouldSimulateSmoke()).toBe(false);

    // Simulate critical drop (> 45ms)
    for (let i = 0; i < 35; i++) {
      governor.recordFrameTime(50.0);
    }

    expect(governor.getQualityTier()).toBe('CRISP_TERMINAL');
    expect(governor.getEffectiveDistortionScale()).toBe(0.0);
    expect(governor.getEffectiveScanlineOpacity()).toBe(0.0);
  });

  it('suppresses tremor jitter and cylinder scramble when reduced motion is enabled', () => {
    const governor = new PerformanceGovernor({ reducedMotion: false });
    expect(governor.shouldApplyTremorJitter()).toBe(true);

    governor.setReducedMotion(true);
    expect(governor.isReducedMotion()).toBe(true);
    expect(governor.shouldApplyTremorJitter()).toBe(false);

    // Test transition buffer behavior with reduced motion
    const buf = createUiCellBuffer(10, 5);
    buf.fillRect({ x: 0, y: 0, width: 10, height: 5 }, '.', '#ffffff', '#000000');

    // Without reduced motion, scramble applies during 50ms into 100ms transition
    const appliedWithMotion = applyMechanicalCylinderScramble(buf, 50, 100, { reducedMotion: false });
    expect(appliedWithMotion).toBe(true);

    // Reset buffer
    buf.fillRect({ x: 0, y: 0, width: 10, height: 5 }, '.', '#ffffff', '#000000');

    // With reduced motion, scramble is immediately bypassed
    const appliedReduced = applyMechanicalCylinderScramble(buf, 50, 100, { reducedMotion: true });
    expect(appliedReduced).toBe(false);
    expect(buf.getCell(5, 2)?.glyph).toBe('.');
  });

  it('respects lens distortion disable override', () => {
    const governor = new PerformanceGovernor({ qualityTier: 'HIGH_OPTICAL' });
    expect(governor.isLensDistortionDisabled()).toBe(false);
    expect(governor.getEffectiveDistortionScale()).toBe(1.0);

    governor.setLensDistortionDisabled(true);
    expect(governor.isLensDistortionDisabled()).toBe(true);
    expect(governor.getEffectiveDistortionScale()).toBe(0.0);
  });

  it('audits UiCellBuffer layout integrity detecting missing glyphs or empty hit actions', () => {
    const buf = createUiCellBuffer(8, 4);
    buf.fillRect({ x: 0, y: 0, width: 8, height: 4 }, '#', '#ffffff', '#000000');

    const cleanLeaks = auditUiCellBuffer(buf);
    expect(cleanLeaks).toHaveLength(0);

    // Corrupt one cell with an empty glyph and empty hitAction
    buf.setCell(2, 2, '', '#ffffff', '#000000', [], '   ');
    const corruptedLeaks = auditUiCellBuffer(buf);
    expect(corruptedLeaks.length).toBeGreaterThanOrEqual(2);
    expect(corruptedLeaks.some((l) => l.text === 'EMPTY_GLYPH')).toBe(true);
    expect(corruptedLeaks.some((l) => l.text === 'EMPTY_HIT_ACTION')).toBe(true);
  });
});
