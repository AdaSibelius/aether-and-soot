import { describe, expect, it } from 'vitest';
import {
  calculateCameraViewport,
  resolveOutOfBoundsVisual,
} from '../../src/client/projection/camera-governor.js';
import {
  CP437_EXTENDED_GLYPHS,
  createExtendedGlyphAtlas,
} from '../../src/client/renderer/glyph-atlas-extended.js';
import {
  DIEGETIC_FRAGMENT_SHADER,
  DIEGETIC_VERTEX_SHADER,
} from '../../src/client/renderer/diegetic-post-filter.js';
import {
  createDefaultShaderUniformValues,
  DEFAULT_CHROMATIC_ABERRATION,
  DEFAULT_LENS_CURVATURE,
  DEFAULT_SCANLINE_INTENSITY,
  interpolateThermoStress,
  packShaderUniforms,
} from '../../src/client/renderer/shader-uniforms.js';
import { SteampunkRenderPipeline } from '../../src/client/renderer/steampunk-pipeline.js';

describe('Phase 54: Diegetic Presentation Shell & GLSL Shader Suite', () => {
  describe('SteampunkRenderPipeline 5-Layer Container Hierarchy', () => {
    it('initializes 5-layer depth-sorted stage hierarchy with correct z-indices', () => {
      const pipeline = new SteampunkRenderPipeline(1056, 720, false);
      const layers = pipeline.layers;

      expect(layers.worldTacticalContainer).toBeDefined();
      expect(layers.gaslightLightingContainer).toBeDefined();
      expect(layers.diegeticFrameContainer).toBeDefined();
      expect(layers.canvasUiBufferContainer).toBeDefined();
      expect(layers.opticalOverlayContainer).toBeDefined();

      expect(layers.worldTacticalContainer.zIndex).toBe(10);
      expect(layers.gaslightLightingContainer.zIndex).toBe(20);
      expect(layers.diegeticFrameContainer.zIndex).toBe(30);
      expect(layers.canvasUiBufferContainer.zIndex).toBe(40);
      expect(layers.opticalOverlayContainer.zIndex).toBe(50);

      expect(pipeline.getLayer('WORLD_TACTICAL')).toBe(layers.worldTacticalContainer);
      expect(pipeline.getLayer('GASLIGHT_LIGHTING')).toBe(layers.gaslightLightingContainer);
      expect(pipeline.getLayer('DIEGETIC_FRAME')).toBe(layers.diegeticFrameContainer);
      expect(pipeline.getLayer('CANVAS_UI_BUFFER')).toBe(layers.canvasUiBufferContainer);
      expect(pipeline.getLayer('OPTICAL_OVERLAY')).toBe(layers.opticalOverlayContainer);
    });

    it('toggles filter state cleanly without mutation corruption', () => {
      const pipeline = new SteampunkRenderPipeline(800, 600, false);
      expect(pipeline.isFilterEnabled()).toBe(true);

      pipeline.setFilterEnabled(false);
      expect(pipeline.isFilterEnabled()).toBe(false);

      pipeline.setFilterEnabled(true);
      expect(pipeline.isFilterEnabled()).toBe(true);
    });

    it('updates uniforms with smooth exponential decay dampening', () => {
      const pipeline = new SteampunkRenderPipeline(800, 600, false);
      const initial = pipeline.getUniforms();
      expect(initial.thermoStress).toBe(0);

      pipeline.updateUniforms(0.8, 0.1, 1.0, true);
      const after = pipeline.getUniforms();
      expect(after.thermoStress).toBeGreaterThan(0);
      expect(after.thermoStress).toBeLessThanOrEqual(0.8);
      expect(after.time).toBeCloseTo(0.1, 3);
    });
  });

  describe('Diegetic GLSL Shaders & Uniform Packing', () => {
    it('verifies 4-pass shader source components in GLSL programs', () => {
      expect(DIEGETIC_VERTEX_SHADER).toContain('filterVertexPosition');
      expect(DIEGETIC_VERTEX_SHADER).toContain('filterTextureCoord');

      // Pass 1: Spherical glass lens curvature
      expect(DIEGETIC_FRAGMENT_SHADER).toContain('applyLensCurvature');
      expect(DIEGETIC_FRAGMENT_SHADER).toContain('uLensCurvature');

      // Pass 2: Trinitron / Edison aperture shadow mask
      expect(DIEGETIC_FRAGMENT_SHADER).toContain('uScanlineIntensity');
      expect(DIEGETIC_FRAGMENT_SHADER).toContain('triadMask');

      // Pass 3: Dual-threshold phosphor bloom (amber & cyan)
      expect(DIEGETIC_FRAGMENT_SHADER).toContain('uBloomThresholds');

      // Pass 4: Thermodynamic heat haze & chromatic aberration
      expect(DIEGETIC_FRAGMENT_SHADER).toContain('uThermoStress');
      expect(DIEGETIC_FRAGMENT_SHADER).toContain('uChromaticAberration');
      expect(DIEGETIC_FRAGMENT_SHADER).toContain('heatHaze');
    });

    it('creates default uniform values and verifies physical optics constants', () => {
      const uniforms = createDefaultShaderUniformValues(1200, 800);
      expect(uniforms.lensCurvature).toBe(DEFAULT_LENS_CURVATURE);
      expect(uniforms.lensCurvature).toBe(0.03);
      expect(uniforms.scanlineIntensity).toBe(DEFAULT_SCANLINE_INTENSITY);
      expect(uniforms.scanlineIntensity).toBe(0.08);
      expect(uniforms.chromaticAberration).toBe(DEFAULT_CHROMATIC_ABERRATION);
      expect(uniforms.resolution).toEqual([1200, 800]);
      expect(uniforms.bloomThresholds).toEqual([0.65, 0.70]);

      const packed = packShaderUniforms(uniforms);
      expect(packed['uTime']?.type).toBe('f32');
      expect(packed['uResolution']?.type).toBe('vec2<f32>');
      expect(packed['uLensCurvature']?.type).toBe('f32');
      expect(packed['uScanlineIntensity']?.type).toBe('f32');
      expect(packed['uThermoStress']?.type).toBe('f32');
      expect(packed['uChromaticAberration']?.type).toBe('f32');
      expect(packed['uBloomThresholds']?.type).toBe('vec2<f32>');
    });

    it('interpolates thermodynamic stress predictably without runaway divergence', () => {
      let current = 0;
      current = interpolateThermoStress(current, 1.0, 0.05, 4.0);
      expect(current).toBeGreaterThan(0);
      expect(current).toBeLessThan(0.5);

      // Settle down to target
      for (let i = 0; i < 30; i++) {
        current = interpolateThermoStress(current, 1.0, 0.05, 4.0);
      }
      expect(current).toBeCloseTo(1.0, 2);

      // Decay back to 0
      for (let i = 0; i < 50; i++) {
        current = interpolateThermoStress(current, 0.0, 0.05, 4.0);
      }
      expect(current).toBe(0);
    });
  });

  describe('Camera Governor & Copperplate Border Cross-Sections', () => {
    it('calculates widescreen centered camera viewport coordinates accurately', () => {
      const gridWidth = 48;
      const gridHeight = 36;
      const viewport = calculateCameraViewport(
        gridWidth,
        gridHeight,
        24,
        18,
        24,
        20,
        { width: 88, height: 36 },
      );

      expect(viewport.isCenteredWidescreen).toBe(true);
      expect(viewport.viewportWidth).toBe(88);
      expect(viewport.viewportHeight).toBe(36);
      expect(viewport.offsetX).toBe(20);
      expect(viewport.offsetY).toBe(0);
      expect(viewport.cameraX).toBe(0);
      expect(viewport.cameraY).toBe(0);
    });

    it('calculates clamped camera coordinates for standard viewports', () => {
      const gridWidth = 48;
      const gridHeight = 36;
      const viewport = calculateCameraViewport(
        gridWidth,
        gridHeight,
        45,
        34,
        24,
        20,
      );

      expect(viewport.isCenteredWidescreen).toBe(false);
      expect(viewport.viewportWidth).toBe(24);
      expect(viewport.viewportHeight).toBe(20);
      expect(viewport.offsetX).toBe(0);
      expect(viewport.offsetY).toBe(0);
      expect(viewport.cameraX).toBe(24); // Clamped to 48 - 24
      expect(viewport.cameraY).toBe(16); // Clamped to 36 - 20
    });

    it('generates Victorian copperplate cross-sections for out-of-bounds cells', () => {
      const width = 48;
      const height = 36;

      // Distance 1: perimeter structural framing
      const leftBorder = resolveOutOfBoundsVisual(-1, 10, width, height, 0);
      expect(['║', '═', '╬']).toContain(leftBorder.glyph);
      expect(leftBorder.fgPrimary).toBe('#4a5b6d');

      const cornerBorder = resolveOutOfBoundsVisual(-1, -1, width, height, 0);
      expect(cornerBorder.glyph).toBe('╬');

      // Distance 2: technical cross-hatch / foundation rivets
      const hatchBorder = resolveOutOfBoundsVisual(-2, 10, width, height, 0);
      expect(['◈', '▒', '░']).toContain(hatchBorder.glyph);
      expect(hatchBorder.fgPrimary).toBe('#2f3b47');

      // Deep void
      const deepVoid = resolveOutOfBoundsVisual(-10, -10, width, height, 0);
      expect(['⌖', '⚙', '░', '·']).toContain(deepVoid.glyph);
      expect(deepVoid.bgColor).toBe('#080c10');
    });
  });

  describe('Extended 256-Glyph CP437 Texture Atlas', () => {
    it('contains full 256 CP437 glyph repertoire and Victorian technical symbols', () => {
      expect(CP437_EXTENDED_GLYPHS.length).toBeGreaterThanOrEqual(256);

      const requiredSymbols = [
        '⚙', '☼', '╬', '⌖', '◈', '░', '▒', '▓', '█', '─', '│', '┌', '┐', '└', '┘',
        '═', '║', '╔', '╗', '╚', '╝', '╠', '╣', '╦', '╩', '▲', '▼', '◄', '►', '⚡', '⚠',
      ];
      for (const sym of requiredSymbols) {
        expect(CP437_EXTENDED_GLYPHS).toContain(sym);
      }
    });

    it('creates extended glyph atlas in headless mock environment', () => {
      const atlas = createExtendedGlyphAtlas(12, 20);
      expect(atlas.cellWidth).toBe(12);
      expect(atlas.cellHeight).toBe(20);
      expect(atlas.hasGlyph('⚙')).toBe(true);
      expect(atlas.hasGlyph('╬')).toBe(true);
      expect(atlas.hasGlyph('⌖')).toBe(true);
      expect(atlas.getTexture('⚙')).toBeDefined();
    });
  });
});
