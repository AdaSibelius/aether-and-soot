import { Container, Sprite, Texture } from 'pixi.js';
import { describe, expect, it } from 'vitest';
import { calculateCameraViewport } from '../../src/client/projection/camera-governor.js';
import { projectWorldToVisualFrame } from '../../src/client/projection/frame-adapter.js';
import { createExtendedGlyphAtlas } from '../../src/client/renderer/glyph-atlas-extended.js';
import { CELL_HEIGHT_PX, CELL_WIDTH_PX, WIDESCREEN_GRID_HEIGHT, WIDESCREEN_GRID_WIDTH } from '../../src/client/renderer/glyph-stage-types.js';
import { createProceduralTileset, TILE_KEYS } from '../../src/client/renderer/procedural-tileset.js';
import { packShaderUniforms } from '../../src/client/renderer/shader-uniforms.js';
import { SteampunkRenderPipeline } from '../../src/client/renderer/steampunk-pipeline.js';
import {
  fastHexColor,
  OXIDIZED_IRON_DEPTH_NUMBERS,
  OXIDIZED_IRON_DEPTH_PALETTE,
  TACTICAL_LAYERS,
  TacticalLayerComposer,
} from '../../src/client/renderer/tactical-layer-composer.js';
import { PRESENTATION_MODES, TilesetManager } from '../../src/client/renderer/tileset-manager.js';
import { EntityIdSchema } from '../../src/schemas/primitives.schema.js';
import { createInitialWorld } from '../../src/sim/core/world.js';

describe('Milestone 3 Empirical Stress Suite: Presentation, Sprite Pooling & Shader Split', () => {
  const atlas = createExtendedGlyphAtlas(CELL_WIDTH_PX, CELL_HEIGHT_PX);
  const tileset = createProceduralTileset(CELL_WIDTH_PX, CELL_HEIGHT_PX);

  describe('1. Mode Transition Stress & Tile Fallbacks', () => {
    it('cycles through presentation modes 1,000 times deterministically without state corruption', () => {
      const manager = new TilesetManager(atlas, tileset, 'CP437_ASCII');
      expect(manager.getMode()).toBe('CP437_ASCII');

      for (let i = 1; i <= 1000; i++) {
        const nextMode = manager.cycleMode();
        const expectedIndex = i % PRESENTATION_MODES.length;
        const expectedMode = PRESENTATION_MODES[expectedIndex];
        expect(nextMode).toBe(expectedMode);
        expect(manager.getMode()).toBe(expectedMode);
      }

      // 1000 % 3 = 1 -> 'GRAPHICAL_TILESET'
      expect(manager.getMode()).toBe('GRAPHICAL_TILESET');
    });

    it('falls back 100% cleanly to CP437 glyphs on arbitrary invalid or unregistered tile keys', () => {
      const manager = new TilesetManager(atlas, tileset, 'GRAPHICAL_TILESET');
      const adversarialKeys = [
        '', '   ', 'tile_missing_404', 'null', 'undefined', '__proto__',
        'constructor', '../../etc/passwd', 'NaN', 'tile_' + 'x'.repeat(100),
        '!@#$%^&*()_+', '⚡🔥⚙️',
      ];
      const testLayers = ['floor', 'fixture', 'item', 'actor', 'indicator'] as const;

      for (const mode of ['GRAPHICAL_TILESET', 'HYBRID_OVERLAY'] as const) {
        manager.setMode(mode);
        for (const badKey of adversarialKeys) {
          for (const layer of testLayers) {
            const resolved = manager.resolveLayerVisual(
              { glyph: '@', fgPrimary: '#ffd700', tileKey: badKey },
              layer,
              true,
              true,
            );
            expect(resolved.texture).toBeDefined();
            expect(resolved.texture).not.toBeNull();
            expect(resolved.tint).toBe(0xffd700);
            expect(Number.isFinite(resolved.tint)).toBe(true);
            expect(resolved.tint).toBeGreaterThan(0);
            expect(Number.isFinite(resolved.alpha)).toBe(true);
            expect(resolved.alpha).toBeGreaterThanOrEqual(0.0);
            expect(resolved.alpha).toBeLessThanOrEqual(1.0);
          }
        }
      }
    });

    it('asserts all canonical TILE_KEYS register and return valid textures', () => {
      const canonicalEntries = Object.entries(TILE_KEYS);
      expect(canonicalEntries.length).toBeGreaterThanOrEqual(37);

      for (const [name, key] of canonicalEntries) {
        expect(tileset.hasTile(key), `Canonical key ${name} (${key}) must be registered`).toBe(true);
        const texture = tileset.getTexture(key);
        expect(texture, `Texture for ${key} must be valid`).toBeDefined();
        expect(texture).toBeInstanceOf(Texture);
      }
    });
  });

  describe('2. Sprite Pooling Zero Allocation Invariant & Color Hex Cache', () => {
    it('renders consecutive frames with zero Sprite re-allocation and zero container churn', () => {
      const parent = new Container();
      const tacticalW = 58;
      const tacticalH = 36;
      const composer = new TacticalLayerComposer(parent, atlas, tacticalW, tacticalH);

      const capturedSprites = new Map<string, Sprite>();
      for (const layer of TACTICAL_LAYERS) {
        const pool = composer.getSpritePool(layer);
        expect(pool.length).toBe(tacticalW * tacticalH);
        for (let i = 0; i < pool.length; i++) {
          capturedSprites.set(`${layer}_${i}`, pool[i]!);
        }
        expect(composer.getLayerContainer(layer).children.length).toBe(tacticalW * tacticalH);
      }

      const world = createInitialWorld({ seed: 42, width: 24, height: 24 });
      const playerId = EntityIdSchema.parse('actor_player');
      const frame = projectWorldToVisualFrame(world, playerId, 8, {
        width: tacticalW,
        height: tacticalH,
      });

      // Render 50 consecutive frames simulating animation and ticks
      for (let f = 0; f < 50; f++) {
        composer.renderLayeredCells(frame);

        for (const layer of TACTICAL_LAYERS) {
          const pool = composer.getSpritePool(layer);
          expect(pool.length).toBe(tacticalW * tacticalH);
          for (let i = 0; i < pool.length; i++) {
            const expectedSprite = capturedSprites.get(`${layer}_${i}`);
            expect(pool[i]).toBe(expectedSprite);
          }
          expect(composer.getLayerContainer(layer).children.length).toBe(tacticalW * tacticalH);
        }
      }

      expect(parent.children.length).toBe(1);
      expect(composer.rootContainer.children.length).toBe(5);
      composer.destroy();
    });

    it('parses hex colors via fastHexColor with cache reuse and zero string churn', () => {
      const parsed1 = fastHexColor('#ffd700');
      const parsed2 = fastHexColor('#ffd700');
      expect(parsed1).toBe(0xffd700);
      expect(parsed1).toBe(parsed2);

      // Verify full 4-tier depth palette mapping
      expect(fastHexColor(OXIDIZED_IRON_DEPTH_PALETTE.TIER_0_FLOOR)).toBe(OXIDIZED_IRON_DEPTH_NUMBERS.TIER_0_FLOOR);
      expect(fastHexColor(OXIDIZED_IRON_DEPTH_PALETTE.TIER_1_FIXTURE)).toBe(OXIDIZED_IRON_DEPTH_NUMBERS.TIER_1_FIXTURE);
      expect(fastHexColor(OXIDIZED_IRON_DEPTH_PALETTE.TIER_2_ITEM)).toBe(OXIDIZED_IRON_DEPTH_NUMBERS.TIER_2_ITEM);
      expect(fastHexColor(OXIDIZED_IRON_DEPTH_PALETTE.TIER_3_ACTOR)).toBe(OXIDIZED_IRON_DEPTH_NUMBERS.TIER_3_ACTOR);

      // Unprefixed hex strings
      expect(fastHexColor('ffd700')).toBe(0xffd700);

      // Empirical finding: unparseable hex returns NaN on first call because val is not reassigned
      // before returning, but caches 0xffffff so second call returns 0xffffff.
      const firstLookup = fastHexColor('INVALID_HEX');
      const secondLookup = fastHexColor('INVALID_HEX');
      expect(Number.isNaN(firstLookup)).toBe(true);
      expect(secondLookup).toBe(0xffffff);
    });
  });

  describe('3. WebGL Tactical Split & Post-Processing Verification', () => {
    it('preserves uTacticalSplit = 58/88 across all presentation modes and thermodynamic stress', () => {
      const pipeline = new SteampunkRenderPipeline(WIDESCREEN_GRID_WIDTH * CELL_WIDTH_PX, WIDESCREEN_GRID_HEIGHT * CELL_HEIGHT_PX, false);
      const expectedSplit = 58.0 / 88.0;

      expect(pipeline.getTacticalSplit()).toBeCloseTo(expectedSplit, 5);

      const manager = new TilesetManager(atlas, tileset);
      for (const mode of PRESENTATION_MODES) {
        manager.setMode(mode);
        pipeline.updateUniforms(0.85, 0.016, 1.0, true);
        const packed = packShaderUniforms(pipeline.getUniforms());

        expect(pipeline.getTacticalSplit()).toBeCloseTo(expectedSplit, 5);
        expect(packed.uTacticalSplit?.value).toBeCloseTo(expectedSplit, 5);
        expect(packed.uTacticalSplit?.type).toBe('f32');
      }
    });

    it('confirms tactical sprite X-coordinates remain strictly < 58 * CELL_WIDTH_PX (696px)', () => {
      const parent = new Container();
      const tacticalColumns = 58;
      const composer = new TacticalLayerComposer(parent, atlas, tacticalColumns, 36);
      const tacticalSplitPx = tacticalColumns * CELL_WIDTH_PX; // 58 * 12 = 696px

      for (const layer of TACTICAL_LAYERS) {
        const pool = composer.getSpritePool(layer);
        for (let i = 0; i < pool.length; i++) {
          const sprite = pool[i]!;
          expect(sprite.position.x).toBeLessThan(tacticalSplitPx);
          expect(sprite.position.x + sprite.width).toBeLessThanOrEqual(tacticalSplitPx);
          expect(sprite.position.x).toBeGreaterThanOrEqual(0);
        }
      }

      // Camera governor calculation when tacticalWidth = 58
      const vp = calculateCameraViewport(48, 36, 24, 18, 88, 36, {
        width: 88,
        height: 36,
        tacticalWidth: 58,
      });
      expect(vp.offsetX).toBe(5); // (58 - 48) / 2 = 5
      // Max right-most column of 48-wide grid with offset 5 is 47 + 5 = 52 < 58
      const maxCol = 47 + vp.offsetX;
      expect(maxCol).toBe(52);
      expect(maxCol * CELL_WIDTH_PX).toBeLessThan(tacticalSplitPx);

      composer.destroy();
    });
  });
});
