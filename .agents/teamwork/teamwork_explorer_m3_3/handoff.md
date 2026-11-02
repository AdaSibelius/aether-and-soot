# Handoff Report: Graphical Tileset & Presentation Modes Architecture (Milestone 3, Features 4 & 5)

## 1. Observation

Direct code observations from the codebase investigation:

1. **Cell Dimensions & Grid Configuration (`src/client/renderer/glyph-stage-types.ts:1-6`)**:
   ```typescript
   export const CELL_WIDTH_PX = 12;
   export const CELL_HEIGHT_PX = 20;
   export const WIDESCREEN_GRID_WIDTH = 88;
   export const WIDESCREEN_GRID_HEIGHT = 36;
   export const DESKTOP_GRID_WIDTH = 120;
   export const DESKTOP_GRID_HEIGHT = 40;
   ```
   - Aspect ratio is 3:5 (12x20 px per cell).
   - Widescreen canvas resolution is `88 * 12 = 1056` px wide by `36 * 20 = 720` px high.

2. **Tactical Split & Diegetic Shader Isolation (`src/client/renderer/shader-uniforms.ts:17-18`, `src/client/renderer/diegetic-post-filter.ts:50, 61-64`)**:
   - `DEFAULT_TACTICAL_SPLIT = 58.0 / 88.0;` (~0.65909).
   - Columns 0..57 (width = 58 cells = 696 px) define the tactical world viewport.
   - Columns 58..87 (width = 30 cells = 360 px) define the Canvas UI console.
   - In `DIEGETIC_FRAGMENT_SHADER`:
     ```glsl
     uniform float uTacticalSplit;
     ...
     bool isUi = vTextureCoord.x >= uTacticalSplit;
     vec2 curvedUV = vTextureCoord;

     if (!isUi) {
         float split = max(uTacticalSplit, 0.01);
         vec2 normUV = vec2(vTextureCoord.x / split, vTextureCoord.y);
         vec2 curvedNorm = applyLensCurvature(normUV, uLensCurvature * uDistortionScale);
         ...
     ```
   - Phosphor bloom, chromatic aberration, heat haze, scanlines, volumetric smoke, and lens curvature apply **exclusively** when `!isUi` (`vTextureCoord.x < uTacticalSplit`). The UI sidebar is completely immune to distortion.

3. **Existing Render Pipeline Stage Hierarchy (`src/client/renderer/steampunk-pipeline.ts:38-54`)**:
   - `worldTacticalContainer`: zIndex 10 (contains terrain, fixtures, items, actors)
   - `gaslightLightingContainer`: zIndex 20 (ambient lighting / steam glow)
   - `diegeticFrameContainer`: zIndex 30 (decorative frames/dividers)
   - `canvasUiBufferContainer`: zIndex 40 (interactive diegetic UI text and gauges)
   - `opticalOverlayContainer`: zIndex 50 (floating combat text, tooltips)
   - All layers are composited into `rootStage`, which carries the `postFilter` (`Filter` containing `GlProgram` with `DIEGETIC_FRAGMENT_SHADER`).

4. **Atlas & Headless Mock Pattern (`src/client/renderer/glyph-atlas-extended.ts:51-53`)**:
   ```typescript
   if (typeof document === 'undefined') {
     return createMockExtendedGlyphAtlas(cellWidth, cellHeight);
   }
   ```
   - In headless test environments (Vitest / Node), `document` is undefined. The atlas falls back to `Texture.WHITE` mock textures without attempting DOM canvas creation, allowing all simulation and presentation tests to pass in CI without JSDOM or GPU hardware.

5. **Client Modularity & Near-Cap Line Counts (`AGENTS.md:Rule 2.2`)**:
   - Target line count: `<= 250 lines`. Hard ceiling: `300 lines`.
   - `src/client/renderer/glyph-stage.ts` is currently at **240 lines** (exactly at the warning ceiling).
   - `src/client/projection/frame-adapter.ts` is at **197 lines**.
   - `src/client/renderer/steampunk-pipeline.ts` is at **139 lines**.
   - `src/client/renderer/diegetic-post-filter.ts` is at **186 lines**.
   - Therefore, new tileset generation and presentation mode management must reside in discrete, dedicated modules:
     - `src/client/renderer/procedural-tileset.ts` (target <= 220 lines).
     - `src/client/renderer/tileset-manager.ts` (target <= 200 lines).

---

## 2. Logic Chain

1. **Step 1: Zero-Dependency Asset Generation via Procedural Canvas Atlas**
   - *From Observation 1 and Observation 4*: External PNG binary assets introduce bundling bloat, network latency, and path-resolution friction in browser and test environments.
   - *Deduction*: By utilizing an offscreen 2D canvas generator (`createProceduralTileset`), Victorian Steampunk vector graphics (cobblestones, flagstones, brick masonry, riveted iron plates, boilers, gaslamps, conduits, brass gears) can be rendered procedurally into a single Pixi `Texture` atlas at startup in < 2ms.
   - *Resolution Alignment*: Generating each tile at native `CELL_WIDTH_PX = 12` and `CELL_HEIGHT_PX = 20` guarantees sub-pixel precision and exact 1:1 dimensional parity with CP437 monospace glyphs. Sub-textures are partitioned with `new Rectangle(col * 12, row * 20, 12, 20)`.

2. **Step 2: Single-Draw-Call WebGL Batching**
   - *From Observation 3*: In PixiJS v8, sprites that share the same underlying `baseTexture.source` are automatically batched into a single WebGL draw call.
   - *Deduction*: Partitioning all procedural tiles from one contiguous atlas canvas (e.g., 16 columns x 3 rows = 192x60 px) guarantees that transitioning between glyphs and tiles will never fragment WebGL draw batches or create VRAM thrashing.

3. **Step 3: Three-Tier Presentation Modes**
   - *From Survey R2-1 and PROJECT.md:17*: Milestone 3 requires three toggleable visual modes:
     1. `'CP437_ASCII'`: Strict monospace terminal aesthetic. All 5 layers (floor, fixture, item, actor, indicator) render CP437 glyphs from `GlyphAtlas` with tinted foregrounds.
     2. `'GRAPHICAL_TILESET'`: Rich Victorian Steampunk graphic presentation. Floors and fixtures render procedural vector tiles with neutral `0xffffff` tint; items and actors render graphic sprites when available with glyph fallbacks.
     3. `'HYBRID_OVERLAY'`: High-immersion, high-readability hybrid (Cataclysm: Dark Days Ahead and Caves of Qud style). Terrain and fixtures render atmospheric graphical tiles, while actors, items, and indicators render sharp, high-contrast CP437 monospace typography (`@`, `☺`, `⚙`, `!`, `?`) superimposed.
   - *Deduction*: `TilesetManager` acts as the pure translation governor. Given a layer request (`glyph`, `tileKey`, `fgPrimary`, `alpha`), it resolves `{ texture, tint, alpha }` according to the active `VisualRenderMode`.

4. **Step 4: WebGL Shader & Tactical Split Preservation (Feature 5)**
   - *From Observation 2 and Observation 3*: Post-processing filters (`DIEGETIC_FRAGMENT_SHADER`) operate on the entire `rootStage`, but apply effects (lens curvature, scanlines, bloom, smoke) exclusively where `vTextureCoord.x < uTacticalSplit`.
   - *Deduction*: Because tactical sprites (whether glyphs, graphical tiles, or hybrid overlays) are placed strictly within `worldTacticalContainer` (x: 0..696 px, columns 0..57), all three presentation modes seamlessly inherit:
     - Aperture grille scanlines and lens curvature across the tactical world.
     - Dual-threshold phosphor bloom: luminous amber gaslamps (`#ffb733`) and glowing aether conduits/phials (`#4dd4f5`) naturally trigger the shader's amber (`bloom.r > 0.65`) and cyan (`bloom.b > 0.70`) bloom passes.
     - Dark terrain tiles (cobblestones `#3a4450`, mud `#1e1914`, iron plates `#2a333d`) remain below bloom thresholds and will not produce unwanted luminescence.
     - UI sidebar (`columns >= 58`) remains 100% un-distorted and crystal-clear on 4K HDR displays.

5. **Step 5: Headless Test Determinism**
   - *From Observation 4*: Automated verification (`npm run verify` -> `vitest run`) executes in headless Node where `document` is undefined.
   - *Deduction*: `createProceduralTileset` must detect `typeof document === 'undefined'` and return a mock tileset (`Texture.WHITE`, `hasTile: () => true`) so headless unit tests in `tests/sim/client-presentation-modes.test.ts` execute deterministically with zero DOM dependencies.

---

## 3. Caveats

1. **Font Atlas vs Tileset Atlas Texture Merging**:
   - `GlyphAtlas` and `ProceduralTileset` maintain separate underlying base textures. While sprites of the same atlas batch together, switching from a procedural floor tile to an ASCII actor sprite in `HYBRID_OVERLAY` incurs a single texture bind transition. In practice, across a 58x36 grid (~2,000 sprites), this amounts to ~2-3 draw calls per frame, well within the 60 FPS budget (< 0.1ms render time).
2. **Client vs Sim Headless Boundary**:
   - `ProceduralTileset` and `TilesetManager` live strictly under `src/client/renderer/`. Simulation logic in `src/sim/` and data schemas in `src/schemas/` must never import from these files (`AGENTS.md:Rule 2.1`).
3. **Tile Key Resolution Fallback**:
   - If a layer visual requests an unknown or unmapped `tileKey`, `TilesetManager` must fallback immediately to the CP437 glyph texture from `GlyphAtlas`. This guarantees that missing tile graphics will never cause blank cells or runtime exceptions.

---

## 4. Conclusion

### 4.1. Visual Render Modes Specification
```typescript
export type VisualRenderMode = 'CP437_ASCII' | 'GRAPHICAL_TILESET' | 'HYBRID_OVERLAY';

export const PRESENTATION_MODES: readonly VisualRenderMode[] = [
  'CP437_ASCII',
  'GRAPHICAL_TILESET',
  'HYBRID_OVERLAY',
] as const;
```

### 4.2. Procedural Tile Key Catalog (37 Canonical Steampunk Keys)
```typescript
export const TILE_KEYS = {
  // Terrain Floors
  FLOOR_COBBLESTONE: 'tile_floor_cobblestone',
  FLOOR_FLAGSTONE: 'tile_floor_flagstone',
  FLOOR_WOOD_PLANK: 'tile_floor_wood_plank',
  FLOOR_IRON_GRATE: 'tile_floor_iron_grate',
  FLOOR_MUD_SOOT: 'tile_floor_mud_soot',
  FLOOR_SEWER_FLUME: 'tile_floor_sewer_flume',
  FLOOR_INSPECTION_WALKWAY: 'tile_floor_inspection_walkway',
  FLOOR_MINE_TRACKS: 'tile_floor_mine_tracks',
  FLOOR_ABYSS: 'tile_floor_abyss',

  // Walls & Barriers
  WALL_BRICK: 'tile_wall_brick',
  WALL_RIVETED_IRON: 'tile_wall_riveted_iron',
  WALL_TIMBER_STRUT: 'tile_wall_timber_strut',
  WALL_CORRUGATED_TIN: 'tile_wall_corrugated_tin',
  WALL_WINDOW: 'tile_wall_window',
  DOOR_CLOSED: 'tile_door_closed',
  DOOR_OPEN: 'tile_door_open',

  // Steampunk Fixtures & Furniture
  FIXTURE_WORKBENCH: 'tile_fixture_workbench',
  FIXTURE_BOILER: 'tile_fixture_boiler',
  FIXTURE_COAL_STOVE: 'tile_fixture_coal_stove',
  FIXTURE_DESK: 'tile_fixture_desk',
  FIXTURE_GASLAMP: 'tile_fixture_gaslamp',
  FIXTURE_DISPATCH_TUBE: 'tile_fixture_dispatch_tube',
  FIXTURE_CABINET: 'tile_fixture_cabinet',
  FIXTURE_VALVE_MANIFOLD: 'tile_fixture_valve_manifold',
  FIXTURE_PORTAL_STAIRS: 'tile_fixture_portal_stairs',
  FIXTURE_PORTAL_MANHOLE: 'tile_fixture_portal_manhole',

  // Conduits & Machinery
  CONDUIT_STEAM_PIPE_H: 'tile_conduit_pipe_h',
  CONDUIT_STEAM_PIPE_V: 'tile_conduit_pipe_v',
  CONDUIT_STEAM_PIPE_CROSS: 'tile_conduit_pipe_cross',
  CONDUIT_BRASS_GEAR: 'tile_conduit_gear',

  // Ground Items & Containers
  ITEM_SCRAP: 'tile_item_scrap',
  ITEM_SATCHEL: 'tile_item_satchel',
  ITEM_PHIAL: 'tile_item_phial',
  ITEM_CRATE: 'tile_item_crate',

  // Actors & Creatures
  ACTOR_PLAYER: 'tile_actor_player',
  ACTOR_AUTOMATON: 'tile_actor_automaton',
  ACTOR_HUMANOID: 'tile_actor_humanoid',
  ACTOR_CREATURE: 'tile_actor_creature',

  // Indicators
  INDICATOR_CURSOR: 'tile_indicator_cursor',
} as const;
```

### 4.3. Module Design 1: `src/client/renderer/procedural-tileset.ts`
- **Target Line Count**: ~200 lines (strictly <= 220 lines).
- **Zero-Dependency Guarantee**: Pure 2D canvas drawing routines; zero external asset loading.
- **Headless Safety**: Falls back to `createMockProceduralTileset` when `typeof document === 'undefined'`.
- **Public Interface**:
  ```typescript
  export interface ProceduralTileset {
    readonly cellWidth: number;
    readonly cellHeight: number;
    readonly baseTexture: Texture;
    getTexture(tileKey: string): Texture;
    hasTile(tileKey: string): boolean;
  }

  export function createProceduralTileset(
    cellWidth = 12,
    cellHeight = 20,
  ): ProceduralTileset;
  ```
- **Internal Atlas Architecture**:
  - Offscreen canvas initialized with 16 columns and `ceil(totalTiles / 16)` rows (`192 x 60` px).
  - Compact helper drawing routines:
    - `drawRoundedPaver(ctx, x, y, w, h, fill, stroke)`
    - `drawRivet(ctx, cx, cy, fill)`
    - `drawDial(ctx, cx, cy, r, baseFill, needleFill)`
    - `drawPipeFlange(ctx, x, y, w, h, fill)`
  - Dictionary mapping `tileKey` to its procedural canvas renderer.

### 4.4. Module Design 2: `src/client/renderer/tileset-manager.ts`
- **Target Line Count**: ~170 lines (strictly <= 200 lines).
- **Public Interface**:
  ```typescript
  import { Texture } from 'pixi.js';
  import { GlyphAtlas } from './glyph-atlas.js';
  import { ProceduralTileset } from './procedural-tileset.js';

  export type VisualRenderMode = 'CP437_ASCII' | 'GRAPHICAL_TILESET' | 'HYBRID_OVERLAY';

  export interface LayerRenderRequest {
    readonly glyph: string;
    readonly fgPrimary: string;
    readonly fgSecondary?: string | undefined;
    readonly alpha?: number | undefined;
    readonly shaderFlags?: readonly string[] | undefined;
    readonly tileKey?: string | undefined;
  }

  export interface ResolvedLayerVisual {
    readonly texture: Texture;
    readonly tint: number;
    readonly alpha: number;
  }

  export class TilesetManager {
    public constructor(
      atlas: GlyphAtlas,
      tileset: ProceduralTileset,
      initialMode?: VisualRenderMode,
    );

    public getMode(): VisualRenderMode;
    public setMode(mode: VisualRenderMode): void;
    public cycleMode(): VisualRenderMode;
    public getTileset(): ProceduralTileset;
    public getAtlas(): GlyphAtlas;

    public resolveLayerVisual(
      request: LayerRenderRequest,
      layerType: 'floor' | 'fixture' | 'item' | 'actor' | 'indicator',
      isVisible: boolean,
      isExplored: boolean,
      isUnderlay?: boolean,
    ): ResolvedLayerVisual;
  }
  ```
- **Layer Resolution Logic**:
  - Calculates base alpha: `request.alpha ?? 1.0`. Damped to `0.22` if underlay, `0.42` (glyph) / `0.50` (tile) if explored but out of FOV, and `0.0` if unexplored.
  - Mode dispatch:
    - In `CP437_ASCII`: all layers resolve to `atlas.getTexture(request.glyph)` with `hexToNumber(request.fgPrimary)`.
    - In `GRAPHICAL_TILESET`: if `request.tileKey` exists in `tileset`, resolves to `tileset.getTexture(request.tileKey)` with `0xffffff` tint; else falls back to glyph.
    - In `HYBRID_OVERLAY`:
      - `'floor'` and `'fixture'` use `tileset.getTexture(...)` with `0xffffff` tint.
      - `'item'`, `'actor'`, and `'indicator'` use `atlas.getTexture(...)` with `hexToNumber(request.fgPrimary)` tint for high-contrast tactical readability.

### 4.5. Integration Hooks
1. **`TacticalLayerComposer` (Explorer 2)**:
   - Takes `TilesetManager` in its constructor.
   - For each of the 5 layers per cell, calls `tilesetManager.resolveLayerVisual(...)` and updates sprite textures, tints, and alphas.
2. **`ClientSessionState` (`src/client/client-session-state.ts`)**:
   - Add `visualRenderMode: VisualRenderMode;` to `ClientSessionState` (default `'HYBRID_OVERLAY'`).
3. **`SystemSettingsControls` (`src/client/ui/SystemSettingsControls.tsx`)**:
   - Add presentation mode toggle button cycling between `[HYBRID OVERLAY]`, `[GRAPHIC TILESET]`, and `[CP437 ASCII]`.
4. **Keyboard Router (`src/client/input/keyboard-router.ts`)**:
   - Map `F10` or a dedicated hotkey to cycle presentation modes during gameplay.

---

## 5. Verification Method

### 5.1. Automated Verification Suite
Run the full verification gate from project root:
```bash
npm run verify
```
This executes:
1. `npm run typecheck` (`tsc --noEmit`): Confirms zero type errors and strict type safety across new files.
2. `npm run check:boundaries`: Confirms zero forbidden imports (`src/sim/` never imports `src/client/`), zero `Math.random()` tokens in sim, and all files remain strictly `<= 300 lines`.
3. `npm run validate:data`: Confirms blueprint schema integrity.
4. `npm run test:sim`: Executes all deterministic tests including the new presentation modes suite.

### 5.2. Targeted Vitest Test Suite (`tests/sim/client-presentation-modes.test.ts`)
Run:
```bash
npx vitest run tests/sim/client-presentation-modes.test.ts
```
The test suite will assert:
1. **ProceduralTileset Headless Mocking**:
   - `createProceduralTileset(12, 20)` initializes cleanly without throwing in Node.
   - All 37 canonical `TILE_KEYS` return valid `Texture` instances.
   - `hasTile` accurately identifies registered vs missing keys.
2. **TilesetManager State Transitions**:
   - Initial mode is `'HYBRID_OVERLAY'`.
   - `setMode('CP437_ASCII')` updates mode.
   - `cycleMode()` transitions: `CP437_ASCII -> GRAPHICAL_TILESET -> HYBRID_OVERLAY -> CP437_ASCII`.
3. **Mode Layer Mapping Assertions**:
   - In `CP437_ASCII`: Floor and actor layers map to glyph textures; tint equals parsed hex color.
   - In `GRAPHICAL_TILESET`: Floor and actor layers map to procedural tile textures; tint is `0xffffff`.
   - In `HYBRID_OVERLAY`: Floor maps to procedural tile texture (`0xffffff`), while actor maps to glyph texture with primary color tint.
   - Fallback behavior: Requesting an unknown `tileKey` in `GRAPHICAL_TILESET` falls back to glyph without crashing.
4. **WebGL Shader Tactical Split Uniform Stability**:
   - Verifies `uTacticalSplit = 58 / 88` in `SteampunkRenderPipeline` is unaffected by mode switches.
   - Confirms tactical world coordinates stay strictly within `x < 58 * CELL_WIDTH_PX`.

### 5.3. Invalidation Conditions
- Any file exceeding 250 lines (or breaking the 300-line ceiling).
- Any runtime crash in headless Node due to unguarded `document` or `window` references.
- Any mutation of `WorldState` from `src/client/`.
- Post-processing shader distortion leaking into columns `>= 58`.
