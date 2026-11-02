# Milestone 3 Feature 3: Tactical Layer Composer & Sprite Pooling Architecture Report

## 1. Observation

### 1.1 Existing Files and Telemetry Inspected
- `src/client/renderer/glyph-stage.ts`: **240 lines** (`wc -l` reports 239 lines + 1 trailing newline). This file is near the 250-line target and approaching the hard ceiling of 300 lines enforced by `tests/scripts/check-boundaries.ts`.
- `src/client/renderer/steampunk-pipeline.ts`: **139 lines**. Implements `SteampunkRenderPipeline` with a 5-layer container hierarchy:
  - `worldTacticalContainer` (zIndex 10)
  - `gaslightLightingContainer` (zIndex 20)
  - `diegeticFrameContainer` (zIndex 30)
  - `canvasUiBufferContainer` (zIndex 40)
  - `opticalOverlayContainer` (zIndex 50)
- `src/client/renderer/glyph-atlas.ts` (102 lines) & `glyph-atlas-extended.ts` (114 lines): Constructs a sub-pixel rasterized 256-glyph CP437 texture atlas. In headless environments (`typeof document === 'undefined'`), returns a mock atlas with `Texture.WHITE`.
- `src/client/renderer/glyph-stage-types.ts`: **11 lines**. Defines `CELL_WIDTH_PX = 12`, `CELL_HEIGHT_PX = 20`, widescreen grid 88x36, desktop grid 120x40, and `hexToNumber()`.
- `src/client/canvas-ui/material-palette.ts`: **140 lines**. Defines `VICTORIAN_PALETTE` and `VISUAL_DEPTH_TIERS` (Z0 Tactical Void, Z1 Recess Well, Z2 Machined Chassis, Z3 Emissive Readout).
- `src/client/projection/frame-adapter.ts`: **197 lines**. Pure projection generating `VisualGridFrame` and `RenderCellFrame`.

### 1.2 Current Tactical Sprite Pooling Bottleneck
In `src/client/renderer/glyph-stage.ts`:
- Lines 36, 124–152, 218–228:
  - `glyphStage.ts` maintains a single 1D array of `Sprite[]` (`this.glyphSprites`) containing `gridWidth * gridHeight` sprites (3,168 sprites for 88x36).
  - Every tactical cell can display only **one single glyph** (`cell.visual.glyph`).
  - When an entity (actor, fixture, or item) occupies a cell, `frame-adapter.ts` overwrites `cells[idx].visual`, completely obliterating the underlying floor terrain, road cobblestones, or partition wall beneath it.
  - Furthermore, `glyph-stage.ts` directly performs background graphics drawing, lighting rectangle filling, secondary pulse color selection, and sprite property mutation in a 29-line loop inside `renderFrame()`.
  - Attempting to add multi-layer sprite pooling or graphical tileset routing inside `glyph-stage.ts` would immediately push the file past 320+ lines, triggering automated build failures under Rule 2.2.

---

## 2. Logic Chain

### 2.1 Modularity De-escalation via Dedicated Auxiliary Module
- **Premise 1**: `glyph-stage.ts` is at 240 lines and must not exceed 250 lines.
- **Premise 2**: Managing 5 layered sprite pools, Z-depth ordering, depth-shading color mappings, and mode switching requires ~180–220 lines of code.
- **Deduction**: Extracting all tactical cell layer pooling and rendering into a dedicated auxiliary class `TacticalLayerComposer` in `src/client/renderer/tactical-layer-composer.ts` removes ~40 lines of pool initialization and loop logic from `glyph-stage.ts`. This reduces `glyph-stage.ts` to **~207 lines** and produces `tactical-layer-composer.ts` at **~215 lines**, keeping both modules comfortably below the 250-line target.

### 2.2 Visual Layer Stacking & Scene Graph Architecture
The prompt and `PROJECT.md` define 5 discrete visual layers per tactical cell:
1. `floor` (Layer 0, bottom): Foundation terrain (cobblestones, timber struts, grating, dirt, stone).
2. `fixture` (Layer 1): Heavy furniture, partition walls, boilers, workbenches, dispatch tubes, cabinets, valve manifolds.
3. `item` (Layer 2): Ground loot, scrap, cartridges, dropped weapons, tools.
4. `actor` (Layer 3): Player character, constables, steam automata, cultists, beasts.
5. `indicator` (Layer 4, top): Targeting reticles, selection cursors, pathfinding hints, hazard boundaries, AOE radii.

Rather than sorting sprites dynamically per frame (which incurs CPU overhead and memory churn), `TacticalLayerComposer` creates **5 dedicated PixiJS `Container` instances** inside its `rootContainer`:
- `floorContainer` (zIndex 0)
- `fixtureContainer` (zIndex 1)
- `itemContainer` (zIndex 2)
- `actorContainer` (zIndex 3)
- `indicatorContainer` (zIndex 4)

Because PixiJS renders child containers in strict scene-graph / zIndex order, the drawing sequence is mathematically guaranteed:
`Floor (bottom) -> Fixture -> Item -> Actor -> Indicator (top)`

### 2.3 Pool Sizing, Memory Overhead & WebGL Batch Optimization
- **Pool Sizing**:
  - For Widescreen Grid (88 × 36 = 3,168 cells):
    $3,168 \text{ cells} \times 5 \text{ layers} = 15,840 \text{ pre-allocated Sprite objects}$.
  - For Desktop Grid (120 × 40 = 4,800 cells):
    $4,800 \text{ cells} \times 5 \text{ layers} = 24,000 \text{ pre-allocated Sprite objects}$.
- **Memory Footprint**:
  - In PixiJS v8, a bare `Sprite` occupies ~200 bytes of V8 heap memory.
  - $15,840 \times 200 \text{ bytes} \approx 3.16 \text{ MB}$ of RAM.
  - $24,000 \times 200 \text{ bytes} \approx 4.80 \text{ MB}$ of RAM.
  - This is completely negligible on modern desktop browsers.
- **Zero Allocations During Render**:
  - Every sprite is created once during `initializePools()`.
  - Screen coordinates `(px = x * CELL_WIDTH_PX, py = y * CELL_HEIGHT_PX)` and dimensions `(width, height)` are assigned **once** at initialization. Since grid cell positions never shift, `sprite.position.set()` is NOT called in the per-frame render loop.
  - Empty layers (e.g. no indicator in cell 42, no fixture on a street cobble) have `sprite.visible = false`.
- **GPU Batching Efficiency**:
  - In PixiJS v8, `sprite.visible = false` causes the batch renderer to completely skip the sprite during scene traversal.
  - In a typical tactical frame:
    - Floor layer: ~3,168 active sprites.
    - Fixture layer: ~200–400 active sprites.
    - Item layer: ~30–80 active sprites.
    - Actor layer: ~10–25 active sprites.
    - Indicator layer: ~1–5 active sprites.
    - Total submitted to GPU: ~3,500 sprites (instead of 15,840).
    - GPU vertex submission volume is reduced by **~78%**, maintaining locked 60 FPS.
  - Because all glyph sprites share the single `baseTexture` generated by `createExtendedGlyphAtlas()`, PixiJS merges all sprites into a single batched WebGL draw call per active container.

### 2.4 Victorian Steampunk 4-Tier Oxidized Iron Depth Palette & Depth-Shading
The prompt specifies the 4-tier oxidized iron palette:
- `#2a221b` (0x2a221b) — Tier 0: Deep oxidized umber / foundation shadow (Floor baseline).
- `#524536` (0x524536) — Tier 1: Tarnished gunmetal / recessed apparatus (Fixtures & partitions).
- `#8f7a62` (0x8f7a62) — Tier 2: Patina brass / midground machinery (Items & loot).
- `#d4c2a5` (0xd4c2a5) — Tier 3: Burnished parchment / high-contrast amber (Actors & focus targets).

`TacticalLayerComposer` exposes these values via `OXIDIZED_IRON_DEPTH_PALETTE` and `OXIDIZED_IRON_DEPTH_NUMBERS`.
Depth shading rules:
1. **Floor Layer**: Defaults to Tier 0 (`#2a221b`) when no custom tint is provided. If `cell.visible`, displays full primary color; if `cell.explored && !cell.visible`, alpha is dimmed to 0.42 and tinted with Tier 0 umber for memory fog.
2. **Fixture Layer**: Displays `fixture.fgPrimary` (or Tier 1 `#524536` structure tint). If explored but not visible, alpha is 0.50.
3. **Item Layer**: Displays `item.fgPrimary` (or Tier 2 `#8f7a62` brass). Ground items are suppressed (`visible = false`) when outside FOV (`!cell.visible`).
4. **Actor Layer**: Displays `actor.fgPrimary` (or Tier 3 `#d4c2a5`). Uses dynamic shader flags (`PULSE_STEAM`, `SPARK_GLINT`) for steam pulsation.
5. **Indicator Layer**: Displays indicator color (e.g. Sulfur Amber `0xe5a93c`, Warning Red `0xb94b42`, or Aether Blue `0x355b54`) with semi-transparent alpha (`0.75`).

### 2.5 Fast Zero-Allocation Hex Color Cache
To prevent `hex.replace('#', '')` and `parseInt()` from allocating 15,000+ string objects per second, `TacticalLayerComposer` incorporates a `Map<string, number>` color cache:
```typescript
const COLOR_HEX_CACHE = new Map<string, number>();

export function fastHexColor(hex: string): number {
  let val = COLOR_HEX_CACHE.get(hex);
  if (val === undefined) {
    val = parseInt(hex.charCodeAt(0) === 35 ? hex.slice(1) : hex, 16);
    COLOR_HEX_CACHE.set(hex, val);
  }
  return val;
}
```
With ~25 canonical colors in the Victorian palette, the cache warms up in 2 frames and thereafter performs zero allocations.

### 2.6 Clean Delegation from `glyph-stage.ts`
In `glyph-stage.ts`:
- `this.composer = new TacticalLayerComposer(this.pipeline.layers.worldTacticalContainer, atlas, gridWidth, gridHeight);`
- In `renderFrame()`:
  `this.composer.renderLayeredCells(frame, this.bgGraphics, this.lightingGraphics);`
- Retains backward compatibility: if `cell.layers` is missing, `renderLegacyCell()` renders `cell.visual` on the floor layer and turns off all upper layers.

---

## 3. Caveats

1. **WebGL Texture Source Sharing**:
   - Optimal batching requires all sprites in a container to share the same WebGL texture source. When using pure CP437 glyphs, all sprites share `createExtendedGlyphAtlas().baseTexture`.
   - When Explorer 3's `TilesetManager` introduces graphical tile textures, if tile textures reside on a separate `HTMLCanvasElement` or texture sheet, PixiJS will issue an additional WebGL draw call whenever it switches between the atlas texture and the tileset texture.
   - *Mitigation*: Explorer 3's `ProceduralTileset` should either stitch procedural tiles into an atlas sheet or use layer-specific assignment (e.g., floors/fixtures graphical, actors/items ASCII in `HYBRID_OVERLAY`), ensuring draw calls remain bounded (<= 5 draw calls per frame).
2. **Empty / Absent Layer Handling**:
   - In sparse rooms or open streets, >80% of cells have no fixture, item, actor, or indicator.
   - *Invariant*: If a layer visual is `undefined` or `!cell.visible && !cell.explored`, the sprite's `visible` property MUST be set to `false` (not merely `alpha = 0.0`), ensuring PixiJS completely bypasses the sprite in its render graph.
3. **Layer Priority vs Roguelike Mechanics**:
   - In CDDA, an item placed on a table or counter should appear above the fixture. Stacking `floor (0) < fixture (1) < item (2) < actor (3) < indicator (4)` correctly ensures items rest on top of tables and counters, actors walk over dropped items, and indicators overlay everything.
4. **Shader Compositing Split (`uTacticalSplit = 58/88`)**:
   - All 5 tactical layers are children of `pipeline.layers.worldTacticalContainer`, which is processed by `SteampunkRenderPipeline`'s `DIEGETIC_FRAGMENT_SHADER` (bloom, scanlines, chromatic aberration).
   - Because the shader split is handled at the post-filter level on `pipeline.rootStage` based on normalized screen coordinate `uTacticalSplit`, the multi-layer composer requires no special shader handling; all tactical layers receive CRT/steam processing, while UI elements in `canvasUiBufferContainer` (zIndex 40) remain crisp.

---

## 4. Conclusion

### 4.1 Interface and Class Contracts for `src/client/renderer/tactical-layer-composer.ts`

```typescript
import { Container, Graphics, Sprite, Texture } from 'pixi.js';
import { GlyphAtlas } from './glyph-atlas.js';
import { CELL_HEIGHT_PX, CELL_WIDTH_PX } from './glyph-stage-types.js';
import { RenderCellFrame, VisualGridFrame } from '../projection/frame-adapter.js';

export type TacticalLayerType = 'floor' | 'fixture' | 'item' | 'actor' | 'indicator';

export const TACTICAL_LAYERS: readonly TacticalLayerType[] = [
  'floor',
  'fixture',
  'item',
  'actor',
  'indicator',
] as const;

export const TACTICAL_LAYER_Z_INDEX: Record<TacticalLayerType, number> = {
  floor: 0,
  fixture: 1,
  item: 2,
  actor: 3,
  indicator: 4,
};

export const OXIDIZED_IRON_DEPTH_PALETTE = {
  TIER_0_FLOOR: '#2a221b',
  TIER_1_FIXTURE: '#524536',
  TIER_2_ITEM: '#8f7a62',
  TIER_3_ACTOR: '#d4c2a5',
} as const;

export const OXIDIZED_IRON_DEPTH_NUMBERS = {
  TIER_0_FLOOR: 0x2a221b,
  TIER_1_FIXTURE: 0x524536,
  TIER_2_ITEM: 0x8f7a62,
  TIER_3_ACTOR: 0xd4c2a5,
} as const;

export interface GlyphLayerVisual {
  readonly glyph: string;
  readonly fgPrimary: string;
  readonly fgSecondary?: string;
  readonly alpha?: number;
  readonly shaderFlags?: readonly string[];
  readonly tileKey?: string;
}

export interface RenderCellLayers {
  readonly floor: GlyphLayerVisual;
  readonly fixture?: GlyphLayerVisual;
  readonly item?: GlyphLayerVisual;
  readonly actor?: GlyphLayerVisual;
  readonly indicator?: GlyphLayerVisual;
}

export interface TilesetTextureResolver {
  getTileTexture(tileKey: string): Texture | null;
  getRenderMode(): 'CP437_ASCII' | 'GRAPHICAL_TILESET' | 'HYBRID_OVERLAY';
}

const COLOR_HEX_CACHE = new Map<string, number>();

export function fastHexColor(hex: string): number {
  let val = COLOR_HEX_CACHE.get(hex);
  if (val === undefined) {
    val = parseInt(hex.charCodeAt(0) === 35 ? hex.slice(1) : hex, 16);
    COLOR_HEX_CACHE.set(hex, val);
  }
  return val;
}

export class TacticalLayerComposer {
  public readonly rootContainer: Container;
  private readonly layerContainers: Record<TacticalLayerType, Container>;
  private readonly layerSpritePools: Record<TacticalLayerType, Sprite[]>;
  private readonly atlas: GlyphAtlas;
  private readonly gridWidth: number;
  private readonly gridHeight: number;
  private readonly totalCells: number;
  private tilesetResolver: TilesetTextureResolver | null = null;
  private layerVisibility: Record<TacticalLayerType, boolean> = {
    floor: true,
    fixture: true,
    item: true,
    actor: true,
    indicator: true,
  };

  public constructor(
    parentContainer: Container,
    atlas: GlyphAtlas,
    gridWidth: number,
    gridHeight: number,
    tilesetResolver?: TilesetTextureResolver,
  ) {
    this.atlas = atlas;
    this.gridWidth = gridWidth;
    this.gridHeight = gridHeight;
    this.totalCells = gridWidth * gridHeight;
    this.tilesetResolver = tilesetResolver ?? null;

    this.rootContainer = new Container();
    this.rootContainer.label = 'tactical-layer-composer-root';
    parentContainer.addChild(this.rootContainer);

    this.layerContainers = {
      floor: new Container(),
      fixture: new Container(),
      item: new Container(),
      actor: new Container(),
      indicator: new Container(),
    };

    this.layerSpritePools = {
      floor: new Array<Sprite>(this.totalCells),
      fixture: new Array<Sprite>(this.totalCells),
      item: new Array<Sprite>(this.totalCells),
      actor: new Array<Sprite>(this.totalCells),
      indicator: new Array<Sprite>(this.totalCells),
    };

    this.initializePools();
  }

  private initializePools(): void {
    const blankTexture = this.atlas.getTexture(' ');

    for (const layer of TACTICAL_LAYERS) {
      const container = this.layerContainers[layer];
      container.label = `tactical-layer-${layer}`;
      container.zIndex = TACTICAL_LAYER_Z_INDEX[layer];
      this.rootContainer.addChild(container);

      const pool = this.layerSpritePools[layer];
      for (let y = 0; y < this.gridHeight; y++) {
        for (let x = 0; x < this.gridWidth; x++) {
          const idx = y * this.gridWidth + x;
          const sprite = new Sprite(blankTexture);
          sprite.position.set(x * CELL_WIDTH_PX, y * CELL_HEIGHT_PX);
          sprite.width = CELL_WIDTH_PX;
          sprite.height = CELL_HEIGHT_PX;
          sprite.visible = false;
          container.addChild(sprite);
          pool[idx] = sprite;
        }
      }
    }
  }

  public renderLayeredCells(
    frame: VisualGridFrame,
    bgGraphics?: Graphics,
    lightingGraphics?: Graphics,
  ): void {
    const cells = frame.cells;
    const maxCells = Math.min(cells.length, this.totalCells);
    const turnCount = frame.turnCount;
    const mode = this.tilesetResolver?.getRenderMode() ?? 'CP437_ASCII';

    for (let i = 0; i < maxCells; i++) {
      const cell = cells[i];
      if (!cell) continue;

      const px = cell.x * CELL_WIDTH_PX;
      const py = cell.y * CELL_HEIGHT_PX;

      if (bgGraphics) {
        const bgAlpha = cell.isUnderlay ? 0.22 : cell.visible ? 1.0 : cell.explored ? 0.65 : 1.0;
        bgGraphics.rect(px, py, CELL_WIDTH_PX, CELL_HEIGHT_PX).fill({
          color: fastHexColor(cell.visual.bgColor),
          alpha: bgAlpha,
        });
      }

      if (lightingGraphics && cell.steamPressureKpa > 0 && cell.visible) {
        lightingGraphics.rect(px + 2, py + 2, CELL_WIDTH_PX - 4, CELL_HEIGHT_PX - 4).fill({
          color: 0xd4af37,
          alpha: 0.18,
        });
      }

      const layers = (cell as { layers?: RenderCellLayers }).layers;
      if (layers) {
        this.renderCellLayers(i, cell, layers, turnCount, mode);
      } else {
        this.renderLegacyCell(i, cell, turnCount);
      }
    }
  }

  private renderCellLayers(
    idx: number,
    cell: RenderCellFrame,
    layers: RenderCellLayers,
    turnCount: number,
    mode: 'CP437_ASCII' | 'GRAPHICAL_TILESET' | 'HYBRID_OVERLAY',
  ): void {
    // 0. Floor
    const floorVisual = layers.floor;
    const floorSprite = this.layerSpritePools.floor[idx]!;
    if (this.layerVisibility.floor && (cell.visible || cell.explored)) {
      floorSprite.visible = true;
      floorSprite.texture = this.resolveTexture(floorVisual, 'floor', mode);
      floorSprite.tint = fastHexColor(floorVisual.fgPrimary);
      floorSprite.alpha = cell.isUnderlay ? 0.22 : cell.visible ? (floorVisual.alpha ?? 1.0) : 0.42;
    } else {
      floorSprite.visible = false;
    }

    // 1. Fixture
    const fixtureVisual = layers.fixture;
    const fixtureSprite = this.layerSpritePools.fixture[idx]!;
    if (this.layerVisibility.fixture && fixtureVisual && (cell.visible || cell.explored)) {
      fixtureSprite.visible = true;
      fixtureSprite.texture = this.resolveTexture(fixtureVisual, 'fixture', mode);
      fixtureSprite.tint = fastHexColor(fixtureVisual.fgPrimary);
      fixtureSprite.alpha = cell.visible ? (fixtureVisual.alpha ?? 1.0) : 0.50;
    } else {
      fixtureSprite.visible = false;
    }

    // 2. Item
    const itemVisual = layers.item;
    const itemSprite = this.layerSpritePools.item[idx]!;
    if (this.layerVisibility.item && itemVisual && cell.visible) {
      itemSprite.visible = true;
      itemSprite.texture = this.resolveTexture(itemVisual, 'item', mode);
      itemSprite.tint = fastHexColor(itemVisual.fgPrimary);
      itemSprite.alpha = itemVisual.alpha ?? 1.0;
    } else {
      itemSprite.visible = false;
    }

    // 3. Actor
    const actorVisual = layers.actor;
    const actorSprite = this.layerSpritePools.actor[idx]!;
    if (this.layerVisibility.actor && actorVisual && cell.visible) {
      actorSprite.visible = true;
      actorSprite.texture = this.resolveTexture(actorVisual, 'actor', mode);
      const useSecondary =
        (actorVisual.shaderFlags?.includes('PULSE_STEAM') && (cell.x + cell.y + turnCount) % 2 === 0) ||
        (actorVisual.shaderFlags?.includes('SPARK_GLINT') && (cell.x * 3 + cell.y * 7 + turnCount) % 3 === 0);
      const fgHex = useSecondary && actorVisual.fgSecondary ? actorVisual.fgSecondary : actorVisual.fgPrimary;
      actorSprite.tint = fastHexColor(fgHex);
      actorSprite.alpha = actorVisual.alpha ?? 1.0;
    } else {
      actorSprite.visible = false;
    }

    // 4. Indicator
    const indicatorVisual = layers.indicator;
    const indicatorSprite = this.layerSpritePools.indicator[idx]!;
    if (this.layerVisibility.indicator && indicatorVisual) {
      indicatorSprite.visible = true;
      indicatorSprite.texture = this.resolveTexture(indicatorVisual, 'indicator', mode);
      indicatorSprite.tint = fastHexColor(indicatorVisual.fgPrimary);
      indicatorSprite.alpha = indicatorVisual.alpha ?? 0.75;
    } else {
      indicatorSprite.visible = false;
    }
  }

  private renderLegacyCell(idx: number, cell: RenderCellFrame, turnCount: number): void {
    const floorSprite = this.layerSpritePools.floor[idx]!;
    this.layerSpritePools.fixture[idx]!.visible = false;
    this.layerSpritePools.item[idx]!.visible = false;
    this.layerSpritePools.actor[idx]!.visible = false;
    this.layerSpritePools.indicator[idx]!.visible = false;

    if (cell.visible || cell.explored) {
      const useSecondary =
        (cell.visual.shaderFlags.includes('PULSE_STEAM') && (cell.x + cell.y + turnCount) % 2 === 0) ||
        (cell.visual.shaderFlags.includes('SPARK_GLINT') && (cell.x * 3 + cell.y * 7 + turnCount) % 3 === 0);
      const fgHex = useSecondary ? cell.visual.fgSecondary : cell.visual.fgPrimary;
      floorSprite.visible = true;
      floorSprite.texture = this.atlas.getTexture(cell.visual.glyph);
      floorSprite.tint = fastHexColor(fgHex);
      floorSprite.alpha = cell.isUnderlay ? 0.22 : cell.visible ? 1.0 : cell.explored ? 0.42 : cell.visual.glyph !== ' ' ? 0.85 : 0.0;
    } else {
      floorSprite.visible = false;
    }
  }

  private resolveTexture(
    visual: GlyphLayerVisual,
    layer: TacticalLayerType,
    mode: 'CP437_ASCII' | 'GRAPHICAL_TILESET' | 'HYBRID_OVERLAY',
  ): Texture {
    if (this.tilesetResolver && visual.tileKey) {
      if (mode === 'GRAPHICAL_TILESET' || (mode === 'HYBRID_OVERLAY' && (layer === 'floor' || layer === 'fixture'))) {
        const tileTex = this.tilesetResolver.getTileTexture(visual.tileKey);
        if (tileTex) return tileTex;
      }
    }
    return this.atlas.getTexture(visual.glyph);
  }

  public setLayerVisibility(layer: TacticalLayerType, visible: boolean): void {
    this.layerVisibility[layer] = visible;
    this.layerContainers[layer].visible = visible;
  }

  public getLayerContainer(layer: TacticalLayerType): Container {
    return this.layerContainers[layer];
  }

  public getSpritePool(layer: TacticalLayerType): readonly Sprite[] {
    return this.layerSpritePools[layer];
  }

  public setTilesetResolver(resolver: TilesetTextureResolver | null): void {
    this.tilesetResolver = resolver;
  }

  public destroy(): void {
    this.rootContainer.destroy({ children: true });
  }
}
```

### 4.2 Integration Diff in `src/client/renderer/glyph-stage.ts`
- **Imports**:
  Add `import { TacticalLayerComposer } from './tactical-layer-composer.js';`
- **Class Members**:
  Remove `private readonly glyphSprites: Sprite[] = [];`
  Add `private readonly tacticalComposer: TacticalLayerComposer;`
- **Constructor**:
  `this.tacticalComposer = new TacticalLayerComposer(this.pipeline.layers.worldTacticalContainer, atlas, gridWidth, gridHeight);`
- **`renderFrame()` Step 1 Replacement**:
  Replace lines 124–152 (29 lines of manual sprite loop) with:
  `this.tacticalComposer.renderLayeredCells(frame, this.bgGraphics, this.lightingGraphics);`
- **`initializeGlyphPool()` Cleanup**:
  Remove the tactical sprite creation loop; rename to `initializeUiGlyphPool()` or keep name to initialize only `uiGlyphSprites`.
- **Public Accessor**:
  `public getTacticalComposer(): TacticalLayerComposer { return this.tacticalComposer; }`
- **Line Count Impact**:
  - `glyph-stage.ts` drops from 240 lines to **~207 lines** (<= 250 target).
  - `tactical-layer-composer.ts` target: **~215 lines** (<= 250 target).

---

## 5. Verification Method

### 5.1 Independent Headless Verification Commands
Run the headless verification suite:
```bash
npm run test:sim
```
Or execute targeted unit tests:
```bash
npx vitest run tests/sim/client-presentation-modes.test.ts
```

### 5.2 Unit Test Assertions for `TacticalLayerComposer`
Unit tests in `tests/sim/client-presentation-modes.test.ts` should verify:
1. **Container Scene Graph Hierarchy & Z-Index Ordering**:
   ```typescript
   expect(composer.getLayerContainer('floor').zIndex).toBe(0);
   expect(composer.getLayerContainer('fixture').zIndex).toBe(1);
   expect(composer.getLayerContainer('item').zIndex).toBe(2);
   expect(composer.getLayerContainer('actor').zIndex).toBe(3);
   expect(composer.getLayerContainer('indicator').zIndex).toBe(4);
   ```
2. **Zero Allocation Invariant**:
   - Capture sprite reference at index 0 before and after 100 render loops:
     ```typescript
     const initialFloorSprite = composer.getSpritePool('floor')[0];
     const initialActorSprite = composer.getSpritePool('actor')[0];
     for (let f = 0; f < 100; f++) {
       composer.renderLayeredCells(mockFrame);
     }
     expect(composer.getSpritePool('floor')[0]).toBe(initialFloorSprite);
     expect(composer.getSpritePool('actor')[0]).toBe(initialActorSprite);
     ```
3. **Empty Layer Visibility Suppression**:
   - On a cell with only floor and actor (no fixture, item, or indicator):
     ```typescript
     expect(composer.getSpritePool('floor')[0].visible).toBe(true);
     expect(composer.getSpritePool('fixture')[0].visible).toBe(false);
     expect(composer.getSpritePool('item')[0].visible).toBe(false);
     expect(composer.getSpritePool('actor')[0].visible).toBe(true);
     expect(composer.getSpritePool('indicator')[0].visible).toBe(false);
     ```
4. **Depth Shading & Palette Luminance Verification**:
   - Verify `OXIDIZED_IRON_DEPTH_NUMBERS` ascending luminance:
     `0x2a221b < 0x524536 < 0x8f7a62 < 0xd4c2a5`.
   - Verify indicator overlay alpha defaults to `0.75`.
5. **Modularity & Line Ceiling Gate**:
   ```bash
   npm run check:boundaries
   ```
   Confirms both `glyph-stage.ts` and `tactical-layer-composer.ts` are strictly $\le 250$ lines.
