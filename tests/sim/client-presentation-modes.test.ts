import { Container } from 'pixi.js';
import { describe, expect, it } from 'vitest';
import { projectWorldToVisualFrame } from '../../src/client/projection/frame-adapter.js';
import {
  DOUBLE_BOX_GLYPHS,
  MIXED_BOX_GLYPHS,
  resolveBoxDrawingGlyph,
  resolveExtendedConnectingWallGlyph,
  SINGLE_BOX_GLYPHS,
  WallStyle,
} from '../../src/client/projection/extended-box-drawing.js';
import { createExtendedGlyphAtlas } from '../../src/client/renderer/glyph-atlas-extended.js';
import { createProceduralTileset, TILE_KEYS } from '../../src/client/renderer/procedural-tileset.js';
import { SteampunkRenderPipeline } from '../../src/client/renderer/steampunk-pipeline.js';
import {
  OXIDIZED_IRON_DEPTH_NUMBERS,
  TacticalLayerComposer,
} from '../../src/client/renderer/tactical-layer-composer.js';
import { TilesetManager } from '../../src/client/renderer/tileset-manager.js';
import { EntityIdSchema } from '../../src/schemas/primitives.schema.js';
import { createInitialWorld } from '../../src/sim/core/world.js';
import { createStratumGrid, setTileCell } from '../../src/sim/spatial/grid.js';

describe('Milestone 3: Client Presentation Modes & Multi-Layer Tactical Architecture', () => {
  const atlas = createExtendedGlyphAtlas(12, 20);

  describe('1. ProceduralTileset Headless Mock & Catalog Validity', () => {
    it('initializes cleanly in headless Node environment and registers canonical keys', () => {
      const tileset = createProceduralTileset(12, 20);
      expect(tileset.cellWidth).toBe(12);
      expect(tileset.cellHeight).toBe(20);
      expect(tileset.baseTexture).toBeDefined();

      for (const [name, key] of Object.entries(TILE_KEYS)) {
        expect(tileset.hasTile(key), `Key ${name} (${key}) should be registered`).toBe(true);
        const texture = tileset.getTexture(key);
        expect(texture, `Texture for ${key} should be defined`).toBeDefined();
      }

      expect(tileset.hasTile('tile_nonexistent_xyz')).toBe(false);
    });
  });

  describe('2. TilesetManager Presentation Mode Governance', () => {
    it('governs state transitions and cycles modes seamlessly', () => {
      const tileset = createProceduralTileset(12, 20);
      const manager = new TilesetManager(atlas, tileset, 'HYBRID_OVERLAY');

      expect(manager.getMode()).toBe('HYBRID_OVERLAY');
      expect(manager.cycleMode()).toBe('CP437_ASCII');
      expect(manager.cycleMode()).toBe('GRAPHICAL_TILESET');
      expect(manager.cycleMode()).toBe('HYBRID_OVERLAY');

      manager.setMode('CP437_ASCII');
      expect(manager.getMode()).toBe('CP437_ASCII');
      expect(manager.getAtlas()).toBe(atlas);
      expect(manager.getTileset()).toBe(tileset);
    });

    it('resolves visual layer requests according to active mode specifications', () => {
      const tileset = createProceduralTileset(12, 20);
      const manager = new TilesetManager(atlas, tileset, 'CP437_ASCII');

      const floorReq = { glyph: '·', fgPrimary: '#6a7d8f', tileKey: TILE_KEYS.FLOOR_COBBLESTONE };
      const actorReq = { glyph: '@', fgPrimary: '#ffd700', tileKey: TILE_KEYS.ACTOR_PLAYER };

      // Mode 1: Pure CP437 ASCII
      const asciiFloor = manager.resolveLayerVisual(floorReq, 'floor', true, true);
      const asciiActor = manager.resolveLayerVisual(actorReq, 'actor', true, true);
      expect(asciiFloor.tint).toBe(0x6a7d8f);
      expect(asciiActor.tint).toBe(0xffd700);

      // Mode 2: Graphical Tileset
      manager.setMode('GRAPHICAL_TILESET');
      const gfxFloor = manager.resolveLayerVisual(floorReq, 'floor', true, true);
      const gfxActor = manager.resolveLayerVisual(actorReq, 'actor', true, true);
      expect(gfxFloor.tint).toBe(0xffffff);
      expect(gfxActor.tint).toBe(0xffffff);

      // Mode 3: Hybrid Overlay (terrain tiles + high-contrast glyph actors)
      manager.setMode('HYBRID_OVERLAY');
      const hybFloor = manager.resolveLayerVisual(floorReq, 'floor', true, true);
      const hybActor = manager.resolveLayerVisual(actorReq, 'actor', true, true);
      expect(hybFloor.tint).toBe(0xffffff);
      expect(hybActor.tint).toBe(0xffd700);

      // Fallback on missing tile key
      const unknownReq = { glyph: '?', fgPrimary: '#e5a93c', tileKey: 'tile_missing_spec' };
      const fallback = manager.resolveLayerVisual(unknownReq, 'fixture', true, true);
      expect(fallback.texture).toBeDefined();
      expect(fallback.tint).toBe(0xe5a93c);
    });
  });

  describe('3. Extended CP437 Box-Drawing Bitmask & Autotile Resolution', () => {
    it('resolves pure single-line, double-line, and 8-neighbor enclosed walls', () => {
      const { SINGLE, DOUBLE, NONE } = WallStyle;

      // Pure double straights and corners
      expect(resolveBoxDrawingGlyph(DOUBLE, NONE, DOUBLE, NONE)).toBe(DOUBLE_BOX_GLYPHS.VERTICAL);
      expect(resolveBoxDrawingGlyph(NONE, DOUBLE, NONE, DOUBLE)).toBe(DOUBLE_BOX_GLYPHS.HORIZONTAL);
      expect(resolveBoxDrawingGlyph(NONE, DOUBLE, DOUBLE, NONE)).toBe(DOUBLE_BOX_GLYPHS.CORNER_NW);
      expect(resolveBoxDrawingGlyph(DOUBLE, DOUBLE, DOUBLE, DOUBLE, false)).toBe(DOUBLE_BOX_GLYPHS.CROSS);
      expect(resolveBoxDrawingGlyph(DOUBLE, DOUBLE, DOUBLE, DOUBLE, true)).toBe(DOUBLE_BOX_GLYPHS.SOLID_INTERIOR);

      // Pure single straights and corners
      expect(resolveBoxDrawingGlyph(SINGLE, NONE, SINGLE, NONE)).toBe(SINGLE_BOX_GLYPHS.VERTICAL);
      expect(resolveBoxDrawingGlyph(NONE, SINGLE, NONE, SINGLE)).toBe(SINGLE_BOX_GLYPHS.HORIZONTAL);
      expect(resolveBoxDrawingGlyph(NONE, SINGLE, SINGLE, NONE)).toBe(SINGLE_BOX_GLYPHS.CORNER_NW);
      expect(resolveBoxDrawingGlyph(SINGLE, SINGLE, SINGLE, SINGLE)).toBe(SINGLE_BOX_GLYPHS.CROSS);
    });

    it('resolves mixed single/double T-junctions and cross-junctions cleanly', () => {
      const { SINGLE, DOUBLE, NONE } = WallStyle;

      // Double horizontal with single vertical
      expect(resolveBoxDrawingGlyph(NONE, DOUBLE, SINGLE, DOUBLE)).toBe(MIXED_BOX_GLYPHS.TEE_DOWN_DOUBLE_HORIZ); // ╤
      expect(resolveBoxDrawingGlyph(SINGLE, DOUBLE, NONE, DOUBLE)).toBe(MIXED_BOX_GLYPHS.TEE_UP_DOUBLE_HORIZ);   // ╧
      expect(resolveBoxDrawingGlyph(SINGLE, DOUBLE, SINGLE, DOUBLE)).toBe(MIXED_BOX_GLYPHS.CROSS_DOUBLE_HORIZ); // ╪

      // Double vertical with single horizontal
      expect(resolveBoxDrawingGlyph(DOUBLE, SINGLE, DOUBLE, NONE)).toBe(MIXED_BOX_GLYPHS.TEE_RIGHT_DOUBLE_VERT); // ╞
      expect(resolveBoxDrawingGlyph(DOUBLE, NONE, DOUBLE, SINGLE)).toBe(MIXED_BOX_GLYPHS.TEE_LEFT_DOUBLE_VERT);  // ╡
      expect(resolveBoxDrawingGlyph(DOUBLE, SINGLE, DOUBLE, SINGLE)).toBe(MIXED_BOX_GLYPHS.CROSS_DOUBLE_VERT);  // ╫

      // Single horizontal with double vertical
      expect(resolveBoxDrawingGlyph(NONE, SINGLE, DOUBLE, SINGLE)).toBe(MIXED_BOX_GLYPHS.TEE_DOWN_SINGLE_HORIZ); // ╥
      expect(resolveBoxDrawingGlyph(DOUBLE, SINGLE, NONE, SINGLE)).toBe(MIXED_BOX_GLYPHS.TEE_UP_SINGLE_HORIZ);   // ╨
    });

    it('autotiles StratumGrid walls respecting interior partitions vs exterior facades', () => {
      let grid = createStratumGrid('STREET', 10, 10);
      // Exterior wall at (2, 2) with neighbors at (2, 1) and (2, 3)
      grid = setTileCell(grid, 2, 2, () => ({ terrainType: 'SOOT_BRICK_WALL', blocksMovement: true, blocksSight: true, steamPressureKpa: 0, coalDustDensity: 0 }));
      grid = setTileCell(grid, 2, 1, () => ({ terrainType: 'SOOT_BRICK_WALL', blocksMovement: true, blocksSight: true, steamPressureKpa: 0, coalDustDensity: 0 }));
      grid = setTileCell(grid, 2, 3, () => ({ terrainType: 'SOOT_BRICK_WALL', blocksMovement: true, blocksSight: true, steamPressureKpa: 0, coalDustDensity: 0 }));

      const verticalWall = resolveExtendedConnectingWallGlyph(grid, 2, 2);
      expect(verticalWall).toBe('║');

      // Add single partition branch at (3, 2)
      grid = setTileCell(grid, 3, 2, () => ({
        terrainType: 'TIMBER_STRUT', blocksMovement: true, blocksSight: false, steamPressureKpa: 0, coalDustDensity: 0,
      }));
      const mixedTee = resolveExtendedConnectingWallGlyph(grid, 2, 2);
      expect(mixedTee).toBe('╞'); // Double vertical facade meeting single timber strut
    });
  });

  describe('4. TacticalLayerComposer & Sprite Pooling Zero-Allocation Invariants', () => {
    it('maintains 5 discrete z-indexed containers and reuses pre-allocated sprite pools', () => {
      const parent = new Container();
      const composer = new TacticalLayerComposer(parent, atlas, 20, 15);

      expect(composer.getLayerContainer('floor').zIndex).toBe(0);
      expect(composer.getLayerContainer('fixture').zIndex).toBe(1);
      expect(composer.getLayerContainer('item').zIndex).toBe(2);
      expect(composer.getLayerContainer('actor').zIndex).toBe(3);
      expect(composer.getLayerContainer('indicator').zIndex).toBe(4);

      const floorPool = composer.getSpritePool('floor');
      const actorPool = composer.getSpritePool('actor');
      expect(floorPool.length).toBe(300);
      expect(actorPool.length).toBe(300);

      const spriteFloor0 = floorPool[0]!;
      const spriteActor0 = actorPool[0]!;

      // Ascending oxidized iron depth palette luminance check
      expect(OXIDIZED_IRON_DEPTH_NUMBERS.TIER_0_FLOOR).toBeLessThan(OXIDIZED_IRON_DEPTH_NUMBERS.TIER_1_FIXTURE);
      expect(OXIDIZED_IRON_DEPTH_NUMBERS.TIER_1_FIXTURE).toBeLessThan(OXIDIZED_IRON_DEPTH_NUMBERS.TIER_2_ITEM);
      expect(OXIDIZED_IRON_DEPTH_NUMBERS.TIER_2_ITEM).toBeLessThan(OXIDIZED_IRON_DEPTH_NUMBERS.TIER_3_ACTOR);

      composer.destroy();
      expect(spriteFloor0).toBeDefined();
      expect(spriteActor0).toBeDefined();
    });
  });

  describe('5. SteampunkRenderPipeline Tactical Split & Shader Compositing', () => {
    it('preserves tactical split uniform stability at uTacticalSplit = 58/88', () => {
      const pipeline = new SteampunkRenderPipeline(88 * 12, 36 * 20, false);
      const expectedSplit = 58.0 / 88.0;

      expect(pipeline.getTacticalSplit()).toBeCloseTo(expectedSplit, 4);
      expect(pipeline.getUniforms().tacticalSplit).toBeCloseTo(expectedSplit, 4);

      pipeline.setTacticalSplit(0.5);
      expect(pipeline.getTacticalSplit()).toBe(0.5);

      pipeline.setTacticalSplit(expectedSplit);
      expect(pipeline.getTacticalSplit()).toBeCloseTo(expectedSplit, 4);
    });

    it('projects discrete RenderCellLayers while maintaining composite visual parity', () => {
      const world = createInitialWorld({ seed: 2026, width: 16, height: 16 });
      const playerId = EntityIdSchema.parse('actor_player');
      const frame = projectWorldToVisualFrame(world, playerId, 8);

      expect(frame.cells.length).toBeGreaterThan(0);
      const playerPos = world.entities[playerId]!.position!;
      const playerCell = frame.cells.find((c) => c.worldX === playerPos.x && c.worldY === playerPos.y);

      expect(playerCell).toBeDefined();
      expect(playerCell!.layers).toBeDefined();
      expect(playerCell!.layers.floor).toBeDefined();
      expect(playerCell!.layers.actor).toBeDefined();
      expect(playerCell!.layers.actor?.glyph).toBe('@');
      expect(playerCell!.visual.glyph).toBe('@');
      expect(playerCell!.visual.bgColor).toBe(playerCell!.layers.floor.bgColor);
    });
  });
});
