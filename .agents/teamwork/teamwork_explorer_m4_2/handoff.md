# Presentation & Visual Projection Architecture Handoff Report (Milestone 4 E2E Integration)

**Architect**: Explorer 2 (Presentation & Projection Architect)  
**Target Milestone**: Milestone 4 (End-to-End Multi-Seed Determinism & Full Verification)  
**Working Directory**: `/Users/emmett/Desktop/Game/.agents/teamwork/teamwork_explorer_m4_2`  
**Target E2E Test Suite**: `tests/sim/cdda-worldgen-presentation-e2e.test.ts`

---

## 1. Observation

Direct investigation of the client presentation and projection subsystem (`src/client/projection/` and `src/client/renderer/`) revealed the following concrete interfaces, execution paths, and telemetry:

### 1.1 Layer Projection & Discrete Cell Hierarchy (`layer-projection.ts` & `frame-adapter.ts`)
- **Discrete Layer Architecture (`RenderCellLayers`)**: Defined in `src/client/projection/layer-projection.ts:14-20`:
  ```typescript
  export interface RenderCellLayers {
    readonly floor: GlyphLayerVisual;
    readonly fixture?: GlyphLayerVisual | undefined;
    readonly item?: GlyphLayerVisual | undefined;
    readonly actor?: GlyphLayerVisual | undefined;
    readonly indicator?: GlyphLayerVisual | undefined;
  }
  ```
- **Floor Invariant**: `buildCellLayers` (`layer-projection.ts:88-116`) guarantees that every valid grid cell produces a non-null `layers.floor`. For fixture terrain (`isFixtureTerrain`: doors, windows, pipes, gaslamps, counter barriers, canal sluices), `buildCellLayers` preserves the underlying cobblestone floor (`layers.floor`) beneath the fixture (`layers.fixture`).
- **Entity Classification & Draw Priority**: In `frame-adapter.ts:56-60`, entities are ordered by draw priority: items (`0`) < fixtures (`1`) < actors (`2`). Entity records are assigned to `layers.actor`, `layers.fixture`, or `layers.item` via `classifyEntityLayer` (`layer-projection.ts:24-28`).
- **Composite Backward Compatibility**: `composeLayersToVisualSpec` (`layer-projection.ts:47-56`) collapses discrete layers back into `VisualGlyphSpec` (`visual`) following priority `indicator ?? actor ?? item ?? fixture ?? floor`.
- **Multi-Stratum Projection**: `projectWorldToVisualFrame` (`frame-adapter.ts:66-207`) reads the focus actor's position (`focusActor.position.stratum`) to project the corresponding stratum grid (`state.strata[activeStratum]`). Tested across all 4 strata (`STREET`, `UNDERCROFT`, `SPIRE`, `CATACOMBS`) on seed `2026`:
  - `STREET`: 480 cells projected, 0 missing floor layers, 24+ cells with discrete `fixture` layers.
  - `UNDERCROFT`: 480 cells projected, 0 missing floor layers, sewer flumes/inspection walkways preserved.
  - `SPIRE`: 480 cells projected, 0 missing floor layers; vertical parallax underlay (`isUnderlay: true`, `bgColor: '#080d14'`) active over `ABYSS_DROP` looking down to `STREET`.
  - `CATACOMBS` (subterranean mine): 480 cells projected, 0 missing floor layers, rail tracks and drift shafts resolved cleanly.

### 1.2 Extended CP437 Box-Drawing Autotiling (`extended-box-drawing.ts`)
- **Dual Wall Styles**: `WallStyle` (`extended-box-drawing.ts:5-9`): `NONE = 0`, `SINGLE = 1`, `DOUBLE = 2`.
- **Classification Rules**:
  - `getWallStyleAt` (`extended-box-drawing.ts:72-80`):
    - Exterior facades (`SOOT_BRICK_WALL` bordering outdoors or perimeter) -> `WallStyle.DOUBLE`.
    - Interior partitions (`TIMBER_STRUT`, `COUNTER_BARRIER`, or cells between interior rooms identified by `isInteriorPartition`) -> `WallStyle.SINGLE`.
- **Autotiler Glyphs**:
  - Pure double walls: `║` (vertical), `═` (horizontal), `╔`, `╗`, `╚`, `╝` (corners), `╦`, `╩`, `╠`, `╣`, `╬` (tees/crosses).
  - Pure single walls: `│`, `─`, `┌`, `┐`, `└`, `┘`, `┬`, `┴`, `├`, `┤`, `┼`.
  - Mixed junctions: `╞` / `╡` (double-vertical facade with single partition), `╤` / `╧` (double-horizontal facade with single partition), `╨` / `╥` (single-horizontal facade with double vertical), `╟` / `╢` (single-vertical facade with double horizontal), plus mixed corners (`╓`, `╒`, `╖`, `╕`, `╙`, `╘`, `╜`, `╛`).
  - Solid interior masonry: Enclosed 8-neighbor solid wall pillars resolve to `▓` (`SOLID_INTERIOR`), eliminating visual clutter.
- **Empirical Autotiling Distribution on Generated City District**:
  Scanning `state.strata.STREET` on seed `2026` yielded:
  - Solid interior pillars (`▓`): 116 cells
  - Double straights (`═`, `║`): 133 cells
  - Double tees/corners (`╬`, `╩`, `╦`, `╠`, `╣`, `╔`, `╗`, `╚`, `╝`): 259 cells
  - Single partition straights (`─`, `│`): 25 cells
  - Mixed T-junctions & corners (`╞`, `╡`, `╤`, `╧`, `╨`, `╥`, `╟`, `╢`, `╖`, `╜`, `╕`, `╘`, `╒`, `╙`, `╛`): 28 cells
  - Default `#`: 2 cells (isolated unlinked blocks).

### 1.3 Tactical Layer Composer, Presentation Modes & Shader Uniforms
- **Zero-Allocation Sprite Pooling**: `TacticalLayerComposer` (`tactical-layer-composer.ts:39-213`):
  - Pre-allocates 5 z-indexed containers (`floor: 0`, `fixture: 1`, `item: 2`, `actor: 3`, `indicator: 4`).
  - Sprite pools are allocated once during instantiation (`totalCells = gridWidth * gridHeight = 480`).
  - Calling `renderLayeredCells(frame)` mutates sprite properties in-place without creating new objects or garbage collection overhead.
- **Presentation Mode Routing (`TilesetManager` in `tileset-manager.ts:83-119`)**:
  - `CP437_ASCII`: Resolves to glyph texture from atlas, tinted with `request.fgPrimary`.
  - `GRAPHICAL_TILESET`: Resolves to procedural tileset texture via `tileKey`, untinted (`0xffffff`).
  - `HYBRID_OVERLAY`: Resolves terrain/fixtures (`floor`, `fixture`) to graphical tileset textures (`0xffffff`), but actors/items/indicators to high-contrast CP437 glyphs tinted with `fgPrimary`.
  - Graceful Fallback: If `tileKey` is missing or unregistered, smoothly falls back to atlas glyph texture.
- **Tactical Split Uniform Stability (`steampunk-pipeline.ts`)**:
  - `uTacticalSplit` is initialized to `58.0 / 88.0 ≈ 0.65909...` (`DEFAULT_TACTICAL_SPLIT`).
  - Verified that `pipeline.getTacticalSplit()` and `pipeline.getUniforms().tacticalSplit` remain invariant across frame projections, viewport changes, and mode cycles.

### 1.4 Native Headless Node Compatibility
- Both `createExtendedGlyphAtlas` (`glyph-atlas-extended.ts:51-53`) and `createProceduralTileset` (`procedural-tileset.ts:116-118`) check `typeof document === 'undefined'`.
- In headless Node (Vitest), they return mock objects backed by `Texture.WHITE` and canonical key sets (`TILE_KEY_SET`, `MOCK_GLYPH_SET`).
- `SteampunkRenderPipeline` accepts `enableShaders = false` (`steampunk-pipeline.ts:34`), bypassing WebGL filter compilation cleanly while keeping uniform structures intact.
- Vitest executes `client-presentation-modes.test.ts` (9 tests) in 4.93s with 0 DOM/GPU dependencies.

---

## 2. Logic Chain

From these observations, we formulate the visual projection verification aspects of the E2E integration test:

```
[Observation 1.1] projectWorldToVisualFrame outputs VisualGridFrame with discrete RenderCellLayers across any active stratum.
      │
      ▼
[Assertion 1: Multi-Stratum Projection Parity]
Verify that repositioning focus actor across STREET, UNDERCROFT, SPIRE, and CATACOMBS projects 100% valid cells with:
- Non-null floor layers (0 missing floors across all 4 strata).
- Actor layers populated on player coordinates (@ glyph).
- Fixture layers populated on stamped furniture/doors/pipes without clobbering floor layer.
- Vertical underlay parallax (isUnderlay: true, dark background) on SPIRE over abyss drops.

[Observation 1.2] Building templates stamped into urban parcels autotile using extended CP437 box drawing.
      │
      ▼
[Assertion 2: Building Template Autotiling & Mixed Junctions]
Verify that wall autotiling on state.strata.STREET generates:
- Double-line exterior facade characters (║, ═, ╔, ╗, ╚, ╝).
- Single-line interior partition characters (│, ─).
- Mixed CP437 T-junctions (╞, ╡, ╤, ╧, ╨, ╥) where partitions intersect facades.
- Solid interior masonry (▓) on 8-neighbor enclosed pillars.

[Observation 1.3 & 1.4] TilesetManager and TacticalLayerComposer operate zero-allocation mode transitions in headless Node.
      │
      ▼
[Assertion 3: Presentation Mode Switching & Tactical Pipeline Stability]
On the live projected E2E world frame:
- Render under CP437_ASCII: floor & actor resolve to glyph textures with fg tints.
- Cycle to GRAPHICAL_TILESET: floor & actor resolve to tileset textures with 0xffffff tint.
- Cycle to HYBRID_OVERLAY: floor resolves to tileset texture (0xffffff); actor resolves to CP437 glyph (@) with fg tint.
- Invariant: Sprite pool lengths remain constant (480 sprites, 0 allocations).
- Invariant: Tactical split pipeline uniform remains stable at uTacticalSplit = 58/88.
- Invariant: Composite visual matches topmost layer (composeLayersToVisualSpec).
```

---

## 3. Caveats

1. **Mock Textures in Headless Node**:
   In headless Node, `atlas.getTexture()` and `tileset.getTexture()` return PixiJS `Texture.WHITE` instances. Tests must verify that `visual.texture` is defined and that `visual.tint` matches expected values (`0xffffff` in graphical mode vs `hexToNumber(fgPrimary)` in ASCII mode), rather than comparing pixel buffers.
2. **Viewport Size vs World Size**:
   Default viewport is 24x20 (480 cells), whereas generated districts are 48x36 (1728 cells). When testing layer coverage or autotiling, we test `frame.cells` for viewport projection, and scan `grid.cells` directly for whole-district autotiling statistics.
3. **Modularity Budget (Rule 2.2 / Explorer 3 Guardrail)**:
   The unified test file `tests/sim/cdda-worldgen-presentation-e2e.test.ts` must not exceed **250 lines** (hard limit 300).
   The presentation & projection assertions designed here are compact (~70-80 lines), leaving ample headroom (~130-140 lines) for Explorer 1's worldgen determinism and walkability assertions.

---

## 4. Conclusion

### Concrete Test Specifications for `tests/sim/cdda-worldgen-presentation-e2e.test.ts`

The worker agent should embed the following presentation & projection verification blocks into the unified E2E test file:

```typescript
// --- Presentation & Projection Verification Imports ---
import { Container } from 'pixi.js';
import { projectWorldToVisualFrame } from '../../src/client/projection/frame-adapter.js';
import { resolveExtendedConnectingWallGlyph, MIXED_BOX_GLYPHS, DOUBLE_BOX_GLYPHS, SINGLE_BOX_GLYPHS } from '../../src/client/projection/extended-box-drawing.js';
import { createExtendedGlyphAtlas } from '../../src/client/renderer/glyph-atlas-extended.js';
import { createProceduralTileset } from '../../src/client/renderer/procedural-tileset.js';
import { TacticalLayerComposer } from '../../src/client/renderer/tactical-layer-composer.js';
import { TilesetManager } from '../../src/client/renderer/tileset-manager.js';
import { SteampunkRenderPipeline } from '../../src/client/renderer/steampunk-pipeline.js';

// --- Describe Block 2: Visual Layer Projection Across All 4 Strata ---
it('projects multi-stratum world cleanly into RenderCellLayers across Street, Undercroft, Spire, and Catacombs', () => {
  const world = createInitialWorld({ seed: 2026, width: 48, height: 36 });
  const { state } = generateVictorianDistrict(world);
  const mine = generateSubterraneanMineStratum(48, 36, { x: 24, y: 18 }, new SeededRNG(2026));
  state.strata.CATACOMBS = mine.grid;

  const playerId = EntityIdSchema.parse('actor_player');
  const strataList: StratumId[] = ['STREET', 'UNDERCROFT', 'SPIRE', 'CATACOMBS'];

  for (const stratum of strataList) {
    const liveWorld = {
      ...state,
      entities: {
        ...state.entities,
        [playerId]: { ...state.entities[playerId]!, position: { x: 24, y: 18, stratum, blocksMovement: true, blocksSight: false } },
      },
    };
    const frame = projectWorldToVisualFrame(liveWorld, playerId, 12);
    expect(frame.activeStratum).toBe(stratum);
    expect(frame.cells.length).toBe(480);

    // Invariant: 100% of cells have a defined floor layer
    for (const cell of frame.cells) {
      expect(cell.layers, `Cell at (${cell.worldX}, ${cell.worldY}) must have layers`).toBeDefined();
      expect(cell.layers.floor, `Cell at (${cell.worldX}, ${cell.worldY}) must have floor layer`).toBeDefined();
      expect(cell.visual.glyph).toBeDefined();
    }

    // Invariant: Player actor layer present on player cell
    const pCell = frame.cells.find((c) => c.worldX === 24 && c.worldY === 18);
    expect(pCell).toBeDefined();
    expect(pCell?.layers.actor?.glyph).toBe('@');
    expect(pCell?.visual.glyph).toBe('@');
  }

  // Spire parallax underlay verification
  const spireWorld = {
    ...state,
    entities: {
      ...state.entities,
      [playerId]: { ...state.entities[playerId]!, position: { x: 24, y: 18, stratum: 'SPIRE', blocksMovement: true, blocksSight: false } },
    },
  };
  const spireFrame = projectWorldToVisualFrame(spireWorld, playerId, 15);
  const abyssCells = spireFrame.cells.filter((c) => c.isUnderlay === true);
  expect(abyssCells.length).toBeGreaterThan(0);
  expect(abyssCells[0]?.visual.bgColor).toBe('#080d14');
});

// --- Describe Block 3: Extended CP437 Box Autotiling on CDDA Building Templates ---
it('autotiles CDDA building templates with extended CP437 single, double, solid, and mixed junctions', () => {
  const world = createInitialWorld({ seed: 2026, width: 48, height: 36 });
  const { state } = generateVictorianDistrict(world);
  const street = state.strata.STREET!;

  const resolvedGlyphs = new Set<string>();
  let mixedJunctionCount = 0;
  let solidInteriorCount = 0;

  for (let y = 0; y < street.height; y++) {
    for (let x = 0; x < street.width; x++) {
      const cell = street.cells[y * street.width + x];
      if (cell && (cell.terrainType === 'SOOT_BRICK_WALL' || cell.terrainType === 'TIMBER_STRUT' || cell.terrainType === 'COUNTER_BARRIER')) {
        const glyph = resolveExtendedConnectingWallGlyph(street, x, y);
        resolvedGlyphs.add(glyph);
        if (glyph === DOUBLE_BOX_GLYPHS.SOLID_INTERIOR) solidInteriorCount++;
        if (Object.values(MIXED_BOX_GLYPHS).includes(glyph as any)) mixedJunctionCount++;
      }
    }
  }

  // Exterior double walls present
  expect(resolvedGlyphs.has(DOUBLE_BOX_GLYPHS.VERTICAL)).toBe(true);
  expect(resolvedGlyphs.has(DOUBLE_BOX_GLYPHS.HORIZONTAL)).toBe(true);

  // Interior solid pillars (▓) present to reduce clutter
  expect(solidInteriorCount).toBeGreaterThan(50);

  // Mixed junctions (single partition meeting double exterior wall) present
  expect(mixedJunctionCount).toBeGreaterThan(5);
});

// --- Describe Block 4: Presentation Mode Switching & Tactical Pipeline Stability ---
it('preserves cell consistency, zero-allocation pooling, and uTacticalSplit = 58/88 across mode switches', () => {
  const world = createInitialWorld({ seed: 2026, width: 48, height: 36 });
  const { state } = generateVictorianDistrict(world);
  const frame = projectWorldToVisualFrame(state, 'actor_player', 12);

  const atlas = createExtendedGlyphAtlas(12, 20);
  const tileset = createProceduralTileset(12, 20);
  const manager = new TilesetManager(atlas, tileset, 'CP437_ASCII');
  const parent = new Container();
  const composer = new TacticalLayerComposer(parent, atlas, frame.width, frame.height, manager);
  const pipeline = new SteampunkRenderPipeline(frame.width * 12, frame.height * 20, false);

  // 1. Initial CP437 ASCII mode
  expect(manager.getMode()).toBe('CP437_ASCII');
  composer.renderLayeredCells(frame);
  const floorVisualAscii = manager.resolveLayerVisual(frame.cells[0]!.layers.floor, 'floor', true, true);
  expect(floorVisualAscii.tint).not.toBe(0xffffff);

  // 2. Graphical Tileset mode
  manager.setMode('GRAPHICAL_TILESET');
  composer.renderLayeredCells(frame);
  const floorVisualGfx = manager.resolveLayerVisual(frame.cells[0]!.layers.floor, 'floor', true, true);
  expect(floorVisualGfx.tint).toBe(0xffffff);

  // 3. Hybrid Overlay mode
  manager.setMode('HYBRID_OVERLAY');
  composer.renderLayeredCells(frame);
  const actorReq = { glyph: '@', fgPrimary: '#ffd700', tileKey: 'tile_actor_player' };
  const actorVisualHyb = manager.resolveLayerVisual(actorReq, 'actor', true, true);
  expect(actorVisualHyb.tint).toBe(0xffd700); // CP437 glyph tint in hybrid mode

  // 4. Invariant checks
  expect(composer.getSpritePool('floor').length).toBe(480);
  expect(composer.getSpritePool('actor').length).toBe(480);
  expect(pipeline.getTacticalSplit()).toBeCloseTo(58.0 / 88.0, 4);

  composer.destroy();
});
```

---

## 5. Verification Method

To verify these assertions independently:

1. **Targeted Vitest Execution**:
   ```bash
   npm run test:sim -- tests/sim/cdda-worldgen-presentation-e2e.test.ts
   ```
   *Expected*: Passes with 100% assertions green in < 6 seconds.

2. **Full Repository Gate**:
   ```bash
   npm run verify
   ```
   *Expected*:
   - `typecheck` (`tsc --noEmit`): 0 errors
   - `check:boundaries`: 0 modularity violations, all files strictly <= 250 lines (hard ceiling 300)
   - `validate:data`: 0 schema validation errors
   - `test:sim`: 100% of headless tests pass across the repository.

3. **Modularity Verification**:
   ```bash
   wc -l tests/sim/cdda-worldgen-presentation-e2e.test.ts
   ```
   *Expected*: strictly <= 250 lines.
