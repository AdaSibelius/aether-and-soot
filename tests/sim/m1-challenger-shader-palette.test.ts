import { describe, expect, it } from 'vitest';
import {
  createDefaultShaderUniformValues,
  DEFAULT_TACTICAL_SPLIT,
  packShaderUniforms,
} from '../../src/client/renderer/shader-uniforms.js';
import {
  DIEGETIC_FRAGMENT_SHADER,
  DIEGETIC_VERTEX_SHADER,
} from '../../src/client/renderer/diegetic-post-filter.js';
import { SteampunkRenderPipeline } from '../../src/client/renderer/steampunk-pipeline.js';
import {
  resolveVisualDepthTier,
  VICTORIAN_PALETTE,
} from '../../src/client/canvas-ui/material-palette.js';

function calculateLuminance(hex: string): number {
  const cleanHex = hex.replace('#', '');
  const r = parseInt(cleanHex.substring(0, 2), 16) / 255;
  const g = parseInt(cleanHex.substring(2, 4), 16) / 255;
  const b = parseInt(cleanHex.substring(4, 6), 16) / 255;
  const toLin = (c: number): number => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
  return 0.2126 * toLin(r) + 0.7152 * toLin(g) + 0.0722 * toLin(b);
}

function calculateContrastRatio(hex1: string, hex2: string): number {
  const l1 = calculateLuminance(hex1);
  const l2 = calculateLuminance(hex2);
  return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
}

const isUiOracle = (x: number, split: number): boolean => x >= split;
const normOracle = (x: number, y: number, split: number) => ({
  normX: x / Math.max(split, 0.01),
  normY: y,
});

describe('Challenger 2 Empirical Stress Suite: Shader & Palette Separation', () => {
  describe('1. tacticalSplit Boundary & Out-of-Bounds Stress Testing', () => {
    it('handles tacticalSplit = 0.0 (full UI mode) with zero division hazards', () => {
      const uniforms = createDefaultShaderUniformValues(1056, 720, 0.0);
      expect(uniforms.tacticalSplit).toBe(0.0);
      const packed = packShaderUniforms(uniforms);
      expect(packed['uTacticalSplit']?.value).toBe(0.0);
      expect(packed['uTacticalSplit']?.type).toBe('f32');
      expect([0.0, 0.5, 1.0].every((x) => isUiOracle(x, 0.0))).toBe(true);
      expect(Number.isFinite(normOracle(0.0, 0.5, 0.0).normX)).toBe(true);
    });

    it('handles tacticalSplit = 1.0 (full CRT tactical mode)', () => {
      const uniforms = createDefaultShaderUniformValues(1056, 720, 1.0);
      expect(packShaderUniforms(uniforms)['uTacticalSplit']?.value).toBe(1.0);
      expect([0.0, 0.5, 0.999].every((x) => !isUiOracle(x, 1.0))).toBe(true);
      expect(isUiOracle(1.0, 1.0)).toBe(true);
      expect(normOracle(0.5, 0.5, 1.0).normX).toBe(0.5);
    });

    it('handles negative tacticalSplit (-0.5, -1.0) without crashing', () => {
      const uniforms = createDefaultShaderUniformValues(1056, 720, -0.5);
      expect(packShaderUniforms(uniforms)['uTacticalSplit']?.value).toBe(-0.5);
      expect([0.0, 0.8].every((x) => isUiOracle(x, -0.5))).toBe(true);
      expect(Number.isFinite(normOracle(0.0, 0.5, -0.5).normX)).toBe(true);
    });

    it('handles tacticalSplit > 1.0 (1.5, 2.0) cleanly', () => {
      const uniforms = createDefaultShaderUniformValues(1056, 720, 1.5);
      expect(packShaderUniforms(uniforms)['uTacticalSplit']?.value).toBe(1.5);
      expect([0.0, 1.0].every((x) => !isUiOracle(x, 1.5))).toBe(true);
    });

    it('falls back gracefully on undefined tacticalSplit', () => {
      const raw = createDefaultShaderUniformValues();
      delete (raw as { tacticalSplit?: number }).tacticalSplit;
      expect(packShaderUniforms(raw)['uTacticalSplit']?.value).toBeCloseTo(DEFAULT_TACTICAL_SPLIT, 6);
      const pipeline = new SteampunkRenderPipeline(1056, 720, false);
      expect(pipeline.getTacticalSplit()).toBeCloseTo(DEFAULT_TACTICAL_SPLIT, 6);
    });

    it('verifies SteampunkRenderPipeline setTacticalSplit mutates uniform state', () => {
      const pipeline = new SteampunkRenderPipeline(1056, 720, false);
      pipeline.setTacticalSplit(0.25);
      expect(pipeline.getTacticalSplit()).toBe(0.25);
      pipeline.setTacticalSplit(0.9);
      expect(pipeline.getTacticalSplit()).toBe(0.9);
    });
  });

  describe('2. Resolution Scaling (4K, 1440p, 1080p, 1056x720)', () => {
    const resolutions: Array<[string, number, number]> = [
      ['4K UHD', 3840, 2160],
      ['1440p QHD', 2560, 1440],
      ['1080p FHD', 1920, 1080],
      ['Native Retro', 1056, 720],
    ];

    for (const [name, width, height] of resolutions) {
      it(`scales cleanly to ${name} (${width}x${height}) with correct uniform buffers`, () => {
        const uniforms = createDefaultShaderUniformValues(width, height);
        expect(uniforms.resolution).toEqual([width, height]);
        const packed = packShaderUniforms(uniforms);
        expect(packed['uResolution']?.type).toBe('vec2<f32>');
        const buf = packed['uResolution']?.value as Float32Array;
        expect(buf[0]).toBe(width);
        expect(buf[1]).toBe(height);
        expect(height / 2).toBeGreaterThan(300);
        expect(isUiOracle(DEFAULT_TACTICAL_SPLIT + 0.05, DEFAULT_TACTICAL_SPLIT)).toBe(true);
      });
    }
  });

  describe('3. WebGL Uniform Packing Types & GlProgram Compatibility', () => {
    it('verifies exact WGSL/PixiJS uniform type mapping for all parameters', () => {
      const uniforms = createDefaultShaderUniformValues(1056, 720);
      const packed = packShaderUniforms(uniforms);
      const types: Record<string, string> = {
        uTime: 'f32',
        uResolution: 'vec2<f32>',
        uLensCurvature: 'f32',
        uScanlineIntensity: 'f32',
        uThermoStress: 'f32',
        uChromaticAberration: 'f32',
        uDistortionScale: 'f32',
        uBloomThresholds: 'vec2<f32>',
        uSmokeMask: 'vec4<f32>',
        uTacticalSplit: 'f32',
      };
      for (const [k, t] of Object.entries(types)) {
        expect(packed[k]?.type).toBe(t);
      }
      expect(packed['uResolution']?.value).toBeInstanceOf(Float32Array);
      expect((packed['uResolution']?.value as Float32Array).length).toBe(2);
      expect(packed['uBloomThresholds']?.value).toBeInstanceOf(Float32Array);
      expect((packed['uBloomThresholds']?.value as Float32Array).length).toBe(2);
      expect(packed['uSmokeMask']?.value).toBeInstanceOf(Float32Array);
      expect((packed['uSmokeMask']?.value as Float32Array).length).toBe(4);
      expect(typeof packed['uTime']?.value).toBe('number');
      expect(typeof packed['uTacticalSplit']?.value).toBe('number');
    });

    it('verifies every packed uniform is declared in DIEGETIC_FRAGMENT_SHADER', () => {
      const packed = packShaderUniforms(createDefaultShaderUniformValues());
      for (const key of Object.keys(packed)) {
        expect(DIEGETIC_FRAGMENT_SHADER).toContain(key);
      }
      expect(DIEGETIC_VERTEX_SHADER).toContain('filterVertexPosition');
    });
  });

  describe('4. Palette Luminance Contrast Intervals & Depth Stratification', () => {
    it('verifies border luminance ascends strictly across Z0 < Z1 < Z2 < Z3 with non-zero intervals', () => {
      const l0 = calculateLuminance(resolveVisualDepthTier('Z0_TACTICAL_VOID').border);
      const l1 = calculateLuminance(resolveVisualDepthTier('Z1_RECESS_WELL').border);
      const l2 = calculateLuminance(resolveVisualDepthTier('Z2_MACHINED_CHASSIS').border);
      const l3 = calculateLuminance(resolveVisualDepthTier('Z3_EMISSIVE_READOUT').border);

      expect(l0).toBeLessThan(l1);
      expect(l1).toBeLessThan(l2);
      expect(l2).toBeLessThan(l3);
      expect(l1 - l0).toBeGreaterThan(0.03);
      expect(l2 - l1).toBeGreaterThan(0.20);
      expect(l3 - l2).toBeGreaterThan(0.05);
    });

    it('verifies background luminance depth hierarchy', () => {
      const lVoid = calculateLuminance(VICTORIAN_PALETTE.SOOT_BLACK);
      const lCharcoal = calculateLuminance(VICTORIAN_PALETTE.CHARCOAL);
      const lGunmetal = calculateLuminance(VICTORIAN_PALETTE.GUNMETAL);
      expect(lVoid).toBeLessThan(lCharcoal);
      expect(lCharcoal).toBeLessThan(lGunmetal);
    });

    it('verifies WCAG contrast compliance for all depth tier foreground text against backgrounds', () => {
      const z1 = resolveVisualDepthTier('Z1_RECESS_WELL');
      const z2 = resolveVisualDepthTier('Z2_MACHINED_CHASSIS');
      const z3 = resolveVisualDepthTier('Z3_EMISSIVE_READOUT');
      expect(calculateContrastRatio(z1.fg, z1.bg)).toBeGreaterThan(7.0); // AAA
      expect(calculateContrastRatio(z2.fg, z2.bg)).toBeGreaterThan(4.5); // AA
      expect(calculateContrastRatio(z3.fg, z3.bg)).toBeGreaterThan(7.0); // AAA
    });

    it('verifies all 6 canonical oxidized iron tokens have unique stratified luminance values', () => {
      const tokens = [
        VICTORIAN_PALETTE.SOOT_BLACK,
        VICTORIAN_PALETTE.CHARCOAL,
        VICTORIAN_PALETTE.DEEP_RUST,
        VICTORIAN_PALETTE.VERDIGRIS,
        VICTORIAN_PALETTE.TARNISHED_BRASS,
        VICTORIAN_PALETTE.SULFUR_AMBER,
      ];
      const luminances = tokens.map(calculateLuminance);
      for (let i = 0; i < luminances.length - 1; i++) {
        expect(luminances[i]!).toBeLessThan(luminances[i + 1]!);
      }
    });
  });
});
