import { describe, expect, it } from 'vitest';
import {
  DOUBLE_BOX_GLYPHS,
  MIXED_BOX_GLYPHS,
  resolveBoxDrawingGlyph,
  resolveExtendedConnectingWallGlyph,
  SINGLE_BOX_GLYPHS,
  WallStyle,
} from '../../src/client/projection/extended-box-drawing.js';
import {
  classifyEntityLayer,
  composeLayersToVisualSpec,
  RenderCellLayers,
} from '../../src/client/projection/layer-projection.js';
import { projectWorldToVisualFrame } from '../../src/client/projection/frame-adapter.js';
import { createExtendedGlyphAtlas } from '../../src/client/renderer/glyph-atlas-extended.js';
import { createProceduralTileset } from '../../src/client/renderer/procedural-tileset.js';
import { TilesetManager } from '../../src/client/renderer/tileset-manager.js';
import { EntityIdSchema } from '../../src/schemas/primitives.schema.js';
import { createInitialWorld } from '../../src/sim/core/world.js';
import { createStratumGrid, setTileCell } from '../../src/sim/spatial/grid.js';
import { TEMPLATE_VICTORIAN_TAVERN } from '../../src/sim/spatial/building-templates.js';
import { instantiateTemplateIntoGrid } from '../../src/sim/spatial/template-instantiator.js';
import { SeededRNG } from '../../src/sim/core/rng.js';

describe('Milestone 3 Empirical Challenger: Visual Projection & Box-Drawing Stress Suite', () => {
  const { NONE, SINGLE, DOUBLE } = WallStyle;

  describe('1. Extended Box-Drawing Resolution: 81-State Enumeration & Autotiling', () => {
    it('resolves all 81 connection combinations to non-blank, non-empty CP437 glyphs', () => {
      const styles = [NONE, SINGLE, DOUBLE];
      let combinationCount = 0;

      for (const n of styles) {
        for (const e of styles) {
          for (const s of styles) {
            for (const w of styles) {
              combinationCount++;
              const glyphNormal = resolveBoxDrawingGlyph(n, e, s, w, false);
              const glyphSurrounded = resolveBoxDrawingGlyph(n, e, s, w, true);

              expect(typeof glyphNormal).toBe('string');
              expect(glyphNormal.length).toBeGreaterThan(0);
              expect(glyphNormal.trim()).not.toBe('');
              expect(glyphNormal).not.toMatch(/undefined|NaN|null/i);

              expect(typeof glyphSurrounded).toBe('string');
              expect(glyphSurrounded.length).toBeGreaterThan(0);
              expect(glyphSurrounded.trim()).not.toBe('');
            }
          }
        }
      }
      expect(combinationCount).toBe(81);
    });

    it('validates canonical single, double, and all 10 mixed T/cross junctions', () => {
      // Single-line partition primitives
      expect(resolveBoxDrawingGlyph(SINGLE, NONE, SINGLE, NONE)).toBe(SINGLE_BOX_GLYPHS.VERTICAL);   // │
      expect(resolveBoxDrawingGlyph(NONE, SINGLE, NONE, SINGLE)).toBe(SINGLE_BOX_GLYPHS.HORIZONTAL); // ─
      expect(resolveBoxDrawingGlyph(NONE, SINGLE, SINGLE, NONE)).toBe(SINGLE_BOX_GLYPHS.CORNER_NW);   // ┌
      expect(resolveBoxDrawingGlyph(NONE, NONE, SINGLE, SINGLE)).toBe(SINGLE_BOX_GLYPHS.CORNER_NE);   // ┐
      expect(resolveBoxDrawingGlyph(SINGLE, SINGLE, NONE, NONE)).toBe(SINGLE_BOX_GLYPHS.CORNER_SW);   // └
      expect(resolveBoxDrawingGlyph(SINGLE, NONE, NONE, SINGLE)).toBe(SINGLE_BOX_GLYPHS.CORNER_SE);   // ┘
      expect(resolveBoxDrawingGlyph(NONE, SINGLE, SINGLE, SINGLE)).toBe(SINGLE_BOX_GLYPHS.TEE_NORTH);  // ┬
      expect(resolveBoxDrawingGlyph(SINGLE, SINGLE, NONE, SINGLE)).toBe(SINGLE_BOX_GLYPHS.TEE_SOUTH);  // ┴
      expect(resolveBoxDrawingGlyph(SINGLE, SINGLE, SINGLE, NONE)).toBe(SINGLE_BOX_GLYPHS.TEE_EAST);   // ├
      expect(resolveBoxDrawingGlyph(SINGLE, NONE, SINGLE, SINGLE)).toBe(SINGLE_BOX_GLYPHS.TEE_WEST);   // ┤
      expect(resolveBoxDrawingGlyph(SINGLE, SINGLE, SINGLE, SINGLE)).toBe(SINGLE_BOX_GLYPHS.CROSS);     // ┼

      // Double-line exterior facade primitives
      expect(resolveBoxDrawingGlyph(DOUBLE, NONE, DOUBLE, NONE)).toBe(DOUBLE_BOX_GLYPHS.VERTICAL);   // ║
      expect(resolveBoxDrawingGlyph(NONE, DOUBLE, NONE, DOUBLE)).toBe(DOUBLE_BOX_GLYPHS.HORIZONTAL); // ═
      expect(resolveBoxDrawingGlyph(NONE, DOUBLE, DOUBLE, NONE)).toBe(DOUBLE_BOX_GLYPHS.CORNER_NW);   // ╔
      expect(resolveBoxDrawingGlyph(NONE, NONE, DOUBLE, DOUBLE)).toBe(DOUBLE_BOX_GLYPHS.CORNER_NE);   // ╗
      expect(resolveBoxDrawingGlyph(DOUBLE, DOUBLE, NONE, NONE)).toBe(DOUBLE_BOX_GLYPHS.CORNER_SW);   // ╚
      expect(resolveBoxDrawingGlyph(DOUBLE, NONE, NONE, DOUBLE)).toBe(DOUBLE_BOX_GLYPHS.CORNER_SE);   // ╝
      expect(resolveBoxDrawingGlyph(DOUBLE, DOUBLE, DOUBLE, DOUBLE, false)).toBe(DOUBLE_BOX_GLYPHS.CROSS); // ╬
      expect(resolveBoxDrawingGlyph(DOUBLE, DOUBLE, DOUBLE, DOUBLE, true)).toBe(DOUBLE_BOX_GLYPHS.SOLID_INTERIOR); // ▓

      // 10 Mixed T/cross junctions
      expect(resolveBoxDrawingGlyph(NONE, DOUBLE, SINGLE, DOUBLE)).toBe(MIXED_BOX_GLYPHS.TEE_DOWN_DOUBLE_HORIZ); // ╤
      expect(resolveBoxDrawingGlyph(SINGLE, DOUBLE, NONE, DOUBLE)).toBe(MIXED_BOX_GLYPHS.TEE_UP_DOUBLE_HORIZ);   // ╧
      expect(resolveBoxDrawingGlyph(SINGLE, DOUBLE, SINGLE, DOUBLE)).toBe(MIXED_BOX_GLYPHS.CROSS_DOUBLE_HORIZ); // ╪
      expect(resolveBoxDrawingGlyph(DOUBLE, SINGLE, DOUBLE, NONE)).toBe(MIXED_BOX_GLYPHS.TEE_RIGHT_DOUBLE_VERT); // ╞
      expect(resolveBoxDrawingGlyph(DOUBLE, NONE, DOUBLE, SINGLE)).toBe(MIXED_BOX_GLYPHS.TEE_LEFT_DOUBLE_VERT);  // ╡
      expect(resolveBoxDrawingGlyph(DOUBLE, SINGLE, DOUBLE, SINGLE)).toBe(MIXED_BOX_GLYPHS.CROSS_DOUBLE_VERT);  // ╫
      expect(resolveBoxDrawingGlyph(NONE, SINGLE, DOUBLE, SINGLE)).toBe(MIXED_BOX_GLYPHS.TEE_DOWN_SINGLE_HORIZ); // ╥
      expect(resolveBoxDrawingGlyph(DOUBLE, SINGLE, NONE, SINGLE)).toBe(MIXED_BOX_GLYPHS.TEE_UP_SINGLE_HORIZ);   // ╨
      expect(resolveBoxDrawingGlyph(SINGLE, DOUBLE, SINGLE, NONE)).toBe(MIXED_BOX_GLYPHS.TEE_RIGHT_SINGLE_VERT); // ╟
      expect(resolveBoxDrawingGlyph(SINGLE, NONE, SINGLE, DOUBLE)).toBe(MIXED_BOX_GLYPHS.TEE_LEFT_SINGLE_VERT);  // ╢
    });

    it('autotiles intersections of interior partition walls with exterior building facades', () => {
      let grid = createStratumGrid('STREET', 12, 12);
      // North exterior facade along row y = 2
      for (let x = 1; x <= 6; x++) {
        grid = setTileCell(grid, x, 2, () => ({ terrainType: 'SOOT_BRICK_WALL', blocksMovement: true, blocksSight: true, steamPressureKpa: 0, coalDustDensity: 0 }));
      }
      // Interior partition meeting north facade at (3, 2) extending south (y = 3, 4)
      grid = setTileCell(grid, 3, 3, () => ({ terrainType: 'TIMBER_STRUT', blocksMovement: true, blocksSight: false, steamPressureKpa: 0, coalDustDensity: 0 }));
      grid = setTileCell(grid, 3, 4, () => ({ terrainType: 'TIMBER_STRUT', blocksMovement: true, blocksSight: false, steamPressureKpa: 0, coalDustDensity: 0 }));

      // Facade at (3, 2) has W=DOUBLE, E=DOUBLE, S=SINGLE, N=NONE -> ╤ (TEE_DOWN_DOUBLE_HORIZ)
      const junctionNorth = resolveExtendedConnectingWallGlyph(grid, 3, 2);
      expect(junctionNorth).toBe('╤');

      // Partition at (3, 3) has N=DOUBLE, S=SINGLE -> resolves to ║ (DOUBLE vertical priority in collinear CP437)
      const partitionJunction = resolveExtendedConnectingWallGlyph(grid, 3, 3);
      expect(partitionJunction).toBe('║');

      // Partition at (3, 4) has N=SINGLE, S=NONE -> resolves to │ (SINGLE vertical)
      const partitionInterior = resolveExtendedConnectingWallGlyph(grid, 3, 4);
      expect(partitionInterior).toBe('│');
    });

    it('autotiles instantiated CDDA building templates with zero unhandled fallback glyphs', () => {
      const rng = new SeededRNG(1888);
      const grid = createStratumGrid('STREET', 24, 24);
      const res = instantiateTemplateIntoGrid(grid, {}, TEMPLATE_VICTORIAN_TAVERN, {
        origin: { x: 2, y: 2 }, rotation: 0, mirrorX: false, flipY: false,
      }, rng);

      let wallCount = 0;
      for (let y = 2; y < 12; y++) {
        for (let x = 2; x < 14; x++) {
          const cell = res.grid.cells[y * res.grid.width + x];
          if (cell && cell.terrainType === 'SOOT_BRICK_WALL') {
            wallCount++;
            const glyph = resolveExtendedConnectingWallGlyph(res.grid, x, y);
            expect(glyph).not.toBe('#');
            expect(glyph.length).toBe(1);
          }
        }
      }
      expect(wallCount).toBeGreaterThan(15);
    });
  });

  describe('2. Layer Stacking & Visibility Invariants', () => {
    it('preserves underlying floor terrain in layers.floor beneath fixtures, items, and actors', () => {
      const world = createInitialWorld({ seed: 42, width: 20, height: 20 });
      const playerId = EntityIdSchema.parse('actor_player');
      const playerPos = world.entities[playerId]!.position!;

      const frame = projectWorldToVisualFrame(world, playerId, 10);
      const cell = frame.cells.find((c) => c.worldX === playerPos.x && c.worldY === playerPos.y);

      expect(cell).toBeDefined();
      expect(cell!.layers.floor.glyph).toMatch(/[·=≡\-_]/);
      expect(cell!.layers.floor.fgPrimary).toBeDefined();
      expect(cell!.layers.floor.bgColor).toBeDefined();
      expect(cell!.layers.actor?.glyph).toBe('@');
      expect(cell!.visual.glyph).toBe('@');
      expect(cell!.visual.bgColor).toBe(cell!.layers.floor.bgColor);
    });

    it('enforces exact visual priority (indicator > actor > item > fixture > floor) and floor bgColor retention', () => {
      const floorVisual = { glyph: '·', fgPrimary: '#555555', fgSecondary: '#444444', bgColor: '#111822' };
      const fixtureVisual = { glyph: 'b', fgPrimary: '#b94b42', fgSecondary: '#8f3020' };
      const itemVisual = { glyph: '$', fgPrimary: '#ffd700', fgSecondary: '#d4af37' };
      const actorVisual = { glyph: '@', fgPrimary: '#ffffff', fgSecondary: '#cccccc' };
      const indicatorVisual = { glyph: 'X', fgPrimary: '#e5a93c', fgSecondary: '#ffcc00' };

      const baseLayers: RenderCellLayers = { floor: floorVisual };
      expect(composeLayersToVisualSpec(baseLayers).glyph).toBe('·');
      expect(composeLayersToVisualSpec(baseLayers).bgColor).toBe('#111822');

      const withFixture: RenderCellLayers = { ...baseLayers, fixture: fixtureVisual };
      expect(composeLayersToVisualSpec(withFixture).glyph).toBe('b');
      expect(composeLayersToVisualSpec(withFixture).bgColor).toBe('#111822');

      const withItem: RenderCellLayers = { ...withFixture, item: itemVisual };
      expect(composeLayersToVisualSpec(withItem).glyph).toBe('$');
      expect(composeLayersToVisualSpec(withItem).bgColor).toBe('#111822');

      const withActor: RenderCellLayers = { ...withItem, actor: actorVisual };
      expect(composeLayersToVisualSpec(withActor).glyph).toBe('@');
      expect(composeLayersToVisualSpec(withActor).bgColor).toBe('#111822');

      const withIndicator: RenderCellLayers = { ...withActor, indicator: indicatorVisual };
      expect(composeLayersToVisualSpec(withIndicator).glyph).toBe('X');
      expect(composeLayersToVisualSpec(withIndicator).bgColor).toBe('#111822');
    });

    it('correctly classifies entities into actor, item, and fixture layers', () => {
      const world = createInitialWorld({ seed: 777 });
      const player = world.entities[EntityIdSchema.parse('actor_player')]!;
      expect(classifyEntityLayer(player)).toBe('actor');

      const mockItem = { ...player, id: EntityIdSchema.parse('item_gear_1'), actor: undefined, item: { name: 'Brass Gear' } };
      expect(classifyEntityLayer(mockItem as any)).toBe('item');

      const mockFixture = { ...player, id: EntityIdSchema.parse('fixture_furnace_1'), actor: undefined, fixture: { fixtureType: 'FURNACE' } };
      expect(classifyEntityLayer(mockFixture as any)).toBe('fixture');
    });
  });

  describe('3. Multi-Seed Stress Testing: 55 Seeds Stability & NaN Invariant', () => {
    it('executes visual projection across 55 random seed worlds without crashes or NaNs', () => {
      const atlas = createExtendedGlyphAtlas(12, 20);
      const tileset = createProceduralTileset(12, 20);
      const manager = new TilesetManager(atlas, tileset, 'CP437_ASCII');

      const SEED_START = 5001;
      const SEED_COUNT = 55;

      for (let s = 0; s < SEED_COUNT; s++) {
        const seed = SEED_START + s;
        const world = createInitialWorld({ seed, width: 24, height: 24 });
        const playerId = EntityIdSchema.parse('actor_player');
        const frame = projectWorldToVisualFrame(world, playerId, 10);

        expect(frame.cells.length).toBe(frame.width * frame.height);
        expect(frame.cameraOrigin.x).not.toBeNaN();
        expect(frame.cameraOrigin.y).not.toBeNaN();

        for (const cell of frame.cells) {
          expect(cell.x).not.toBeNaN();
          expect(cell.y).not.toBeNaN();
          expect(cell.worldX).not.toBeNaN();
          expect(cell.worldY).not.toBeNaN();
          expect(cell.steamPressureKpa).not.toBeNaN();
          expect(cell.coalDustDensity).not.toBeNaN();

          expect(cell.visual).toBeDefined();
          expect(cell.visual.glyph.length).toBeGreaterThan(0);
          expect(cell.visual.fgPrimary).toBeDefined();
          expect(cell.visual.bgColor).toBeDefined();
          expect(cell.visual.glyph).not.toMatch(/NaN|undefined/i);

          expect(cell.layers).toBeDefined();
          expect(cell.layers.floor).toBeDefined();
          expect(cell.layers.floor.glyph.length).toBeGreaterThan(0);
          expect(cell.layers.floor.bgColor).toBeDefined();

          // Tileset manager layer resolution smoke check on sample cells
          if (cell.x % 5 === 0 && cell.y % 5 === 0) {
            const req = { glyph: cell.visual.glyph, fgPrimary: cell.visual.fgPrimary };
            const resolved = manager.resolveLayerVisual(req, 'floor', cell.visible, cell.explored);
            expect(resolved.tint).not.toBeNaN();
            expect(resolved.alpha).toBeGreaterThanOrEqual(0);
          }
        }
      }
    });
  });
});
