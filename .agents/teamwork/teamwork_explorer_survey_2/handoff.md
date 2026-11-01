# Survey Explorer 2 Handoff Report: Palette, Shaders & Compositing

## 1. Observation

Direct code observations from inspection of `src/client/renderer/`, `src/client/canvas-ui/`, `src/client/ui/`, and styling/config files:

### 1.1 WebGL Shader Suite & Pipeline Architecture
- **Active Post-Processing Filter**: `src/client/renderer/diegetic-post-filter.ts:8-127`
  - Defines `DIEGETIC_VERTEX_SHADER` (lines 8-34) and `DIEGETIC_FRAGMENT_SHADER` (lines 36-127) using PixiJS v8 `GlProgram` (lines 132-135).
  - Implements a 4-pass GLSL pipeline:
    - **Pass 1: Spherical glass lens curvature** (lines 52-66): `applyLensCurvature(vTextureCoord, uLensCurvature * uDistortionScale)`. Out-of-bounds UVs clamped to bronze bezel `vec4(0.04, 0.05, 0.06, 1.0)`.
    - **Pass 4: Thermodynamic heat haze & chromatic aberration** (lines 68-81):
      ```glsl
      float heatHaze = sin(curvedUV.y * 36.0 + uTime * 4.2) * cos(curvedUV.x * 28.0 - uTime * 3.1);
      vec2 hazeOffset = vec2(heatHaze * 0.0005 * uThermoStress, 0.0);
      vec2 baseUV = curvedUV + hazeOffset;
      vec2 centered = baseUV - vec2(0.5);
      float caDist = length(centered);
      float caSplit = (uChromaticAberration + uThermoStress * 0.0012) * caDist;
      vec2 caDir = caDist > 0.001 ? normalize(centered) * caSplit : vec2(0.0);
      float r = texture(uTexture, baseUV - caDir).r;
      float g = texture(uTexture, baseUV).g;
      float b = texture(uTexture, baseUV + caDir).b;
      ```
    - **Pass 3: Dual-threshold phosphor bloom** (lines 83-97): 4-tap cross-sampling with `bShift = 0.0015`:
      ```glsl
      if (bloom.b > uBloomThresholds.y && bloom.g > 0.60) {
          col += bloom * vec3(0.30, 0.85, 1.00) * 0.20;
      }
      if (bloom.r > uBloomThresholds.x && bloom.g > 0.40) {
          col += bloom * vec3(1.15, 0.85, 0.30) * 0.16;
      }
      ```
    - **Pass 3b: Localized volumetric smoke plume** (lines 99-106):
      ```glsl
      if (uSmokeMask.z > uSmokeMask.x &&
          baseUV.x >= uSmokeMask.x && baseUV.x <= uSmokeMask.z &&
          baseUV.y >= uSmokeMask.y && baseUV.y <= uSmokeMask.w) {
          float smokeNoise = sin(baseUV.x * 24.0 + uTime * 1.6) * cos((baseUV.y - uTime * 0.9) * 18.0);
          float plume = smoothstep(0.15, 0.85, smokeNoise * 0.5 + 0.5) * 0.16;
          col = mix(col, vec3(0.22, 0.18, 0.15), plume);
      }
      ```
    - **Pass 2: Aperture grille shadow mask** (lines 108-115): Scanlines `col *= (1.0 - uScanlineIntensity * (1.0 - scanline))` and triad luminance stripe modulation `mod(curvedUV.x * uResolution.x, 3.0)`.
    - **Vignette & filament grain** (lines 118-124): Lens vignette falloff `1.0 - dot(centered, centered) * 0.75` and PRNG noise grain `(grain - 0.5) * 0.007`.
- **Secondary / Legacy Shader**: `src/client/renderer/steampunk-shader.ts:4-100`
  - Defines `STEAMPUNK_VERTEX_SHADER` and `STEAMPUNK_FRAGMENT_SHADER`.
  - Also exports `resolveThermodynamicStress(state, actorId): ThermodynamicStressResult` (lines 108-149).
  - Referenced by `src/client/renderer/crt-filter.ts:1-56` (`createCrtPostFilter`).
- **Render Pipeline Hierarchy**: `src/client/renderer/steampunk-pipeline.ts:37-73`
  - 5-layer depth-sorted container hierarchy:
    1. `worldTacticalContainer` (zIndex: 10)
    2. `gaslightLightingContainer` (zIndex: 20)
    3. `diegeticFrameContainer` (zIndex: 30)
    4. `canvasUiBufferContainer` (zIndex: 40)
    5. `opticalOverlayContainer` (zIndex: 50)
  - Root filter attachment: `this.rootStage.filters = [this.postFilter];` (`steampunk-pipeline.ts:69`).
- **Shader Uniforms**: `src/client/renderer/shader-uniforms.ts:13-31`
  - `DEFAULT_LENS_CURVATURE = 0.03`, `DEFAULT_SCANLINE_INTENSITY = 0.08`, `DEFAULT_CHROMATIC_ABERRATION = 0.0008`.
  - `bloomThresholds: [0.65, 0.70]`, `smokeMask: [0, 0, 0, 0]`.

### 1.2 UI Layer Overlay & WebGL Compositing Interaction
- **Dual Presentation Architecture**:
  - `src/client/ui/ClientPresentationView.tsx:60-95`:
    - When `useDiegeticCanvasUi: true` (default):
      - `topBarHost`, `actionBarHost`, and `hudHost` are unmounted (`render(null, ...)`).
      - `PreactBridge.tsx` is mounted exclusively into `overlayHost` (`div` styled with `position: absolute; top: 0; left: 0; pointer-events: none`).
      - `PreactBridge` renders only `LookCursorOverlay`, `FloatingTextOverlay`, and `DialogueModal` (`src/client/ui/PreactBridge.tsx:56-93`).
    - When `useDiegeticCanvasUi: false` (legacy HTML mode):
      - `ModalTopBar` mounted to `topBarHost`, `QuickActionBar` to `actionBarHost`, `HudLayout` to `hudHost`.
- **Canvas UI Buffer Pipeline**: `src/client/renderer/glyph-stage.ts:155-197`
  - `composeDiegeticUiBuffer` (`src/client/canvas-ui/diegetic-screen-composer.ts:49-96`) populates `UiCellBuffer`.
  - In `GlyphStageRenderer.renderFrame`, `uiBuffer` cells are written to `this.uiBgGraphics` (rect fills) and `this.uiGlyphSprites` inside `canvasUiBufferContainer`.
  - Because `canvasUiBufferContainer` is a child of `rootStage` and `rootStage.filters = [this.postFilter]`, the UI sidebar (`x: 58..87`) is rendered through `DIEGETIC_FRAGMENT_SHADER`.

### 1.3 Palette Definitions & Depth Separation
- **Current Palette Tokens**: `src/client/canvas-ui/material-palette.ts:1-26`
  ```ts
  export const VICTORIAN_PALETTE = {
    SOOT_BLACK: '#101615',
    GUNMETAL: '#202A28',
    OXIDIZED_TEAL: '#355B54',
    AGED_BRASS: '#C1A15B',
    PARCHMENT: '#D9CCAA',
    WARNING_RED: '#B94B42',
    SOOT_IRON_BG: '#101615',
    OXIDIZED_IRON: '#202A28',
    TARNISHED_BRASS: '#c5a059',
    AMBER_GASLIGHT: '#e6a145',
    SEPIA_PARCHMENT: '#261f18',
    SEPIA_INK: '#D9CCAA',
    AETHER_BLUE: '#355B54',
    INCANDESCENT_RED: '#B94B42',
    WARN_RED: '#B94B42',
    OK_GREEN: '#2ecc71',
    POLISHED_BRASS: '#C1A15B',
    COPPER_ACCENT: '#d35400',
    VERDIGRIS_PATINA: '#355B54',
    RIVET_STEEL: '#7f8c8d',
    MUTED_PIPE: '#594928',
  } as const;
  ```
- **CSS Variable Definitions**: `index.html:9-21`
  - `--bg-soot: #101615`, `--panel-bg: #202A28`, `--panel-border: #355B54`, `--brass-gold: #C1A15B`, `--oxidized-copper: #cd7f32`, `--tesla-cyan: #355B54`, `--parchment: #D9CCAA`.
- **Biome Palettes**: `src/client/projection/biome-palette.ts:17-48`
  - Floor backgrounds: `#07161E`, `#120E0A`, `#181408`, `#0B0D0F`, `#090E11`.
- **Missing Ratified Tokens**:
  - The mandated oxidized iron palette tokens ("deep rust", "charcoal", "sulfur amber") are NOT explicitly defined.
  - `VERDIGRIS_PATINA`, `OXIDIZED_TEAL`, and `AETHER_BLUE` are all identical hex `#355B54`.
  - Console bezels, gauge backgrounds, paperdoll wells, and tactical vernier all share `#101615` background.
- **Missing Action Log in Diegetic UI**:
  - `src/client/canvas-ui/tactical-console.ts:36-102` renders:
    1. Bezel frame (`drawMachinedBezel`)
    2. Split-flap turns & currency odometers (rows 2..4)
    3. Bourdon steam gauge & Sanguine manometer (rows 5..12)
    4. Anatomical paperdoll & status flags (rows 14..22)
    5. Tactical vernier dossier (rows 24..34)
    6. Navigation buttons (row 35)
  - The action log (`TickerTapeLog.tsx`) exists only in `src/client/ui/HudLayout.tsx:216`. Because `HudLayout` is unmounted in diegetic mode, the exploration screen has **zero visible action log**.

### 1.4 Font Rendering & 4K HDR Readability
- **Font Stack**: `src/client/renderer/glyph-atlas-extended.ts:49`
  - `fontFamily = '"JetBrains Mono", "Fira Code", "IBM Plex Mono", "Courier New", monospace'`
  - Imported in `index.html:7`: `@fontsource/ibm-plex-mono/index.css`.
- **Atlas Rasterization**: `src/client/renderer/glyph-atlas-extended.ts:58-74`
  - Base dimensions: `cellWidth = 12`, `cellHeight = 20`.
  - Font size: `Math.floor(20 * 0.72) = 14px`.
  - Atlas canvas: 16 cols x 16 rows = 192 x 320 px, rasterized at 1x scale without scaling by `window.devicePixelRatio`.
  - `document.fonts.ready` is not awaited prior to rasterization in `GlyphStageRenderer.create`.
- **Viewport Scaling**: `src/client/renderer/desktop-window-manager.ts:16-42, 69-92`
  - Base logical grid: 88 cols x 36 rows = 1056 x 720 px.
  - On a 4K display (3840 x 2160), scale factor is ~3.63x.
  - `index.html:78-79` enforces `image-rendering: pixelated; image-rendering: crisp-edges;`.
- **Shader Bloom & Smoke Washout**:
  - In `diegetic-post-filter.ts:83-97`, 4-tap cross-sampling with `bShift = 0.0015` produces a 1.58px blur in logical UV space.
  - In small 12px monospace character cells, intra-character spacing is ~2px. Emissive amber/cyan bloom spills into adjacent letter boundaries, causing text halation and character smearing.
  - Pass 2 scanline math `sin(curvedUV.y * 720 * PI)` creates 360 scanlines across 2160 physical pixels (each scanline band is 6 physical pixels thick).

### 1.5 File Size & Modularity Check (300-Line Ceiling)
Measured via `wc -l` (POSIX line count):
- `src/client/renderer/glyph-stage.ts`: 239 lines (warning threshold >= 240, ceiling 300)
- `src/client/ui/HudLayout.tsx`: 227 lines
- `src/client/canvas-ui/naturalist-ledger-screen.ts`: 214 lines
- `src/client/canvas-ui/diegetic-cartography.ts`: 202 lines
- `src/client/canvas-ui/diegetic-screen-composer.ts`: 194 lines
- `src/client/canvas-ui/industrial-primitives.ts`: 191 lines
- `src/client/canvas-ui/embarkation-screen.ts`: 185 lines
- `src/client/renderer/floating-combat-text.tsx`: 180 lines
- `src/client/ui/ClientPresentationView.tsx`: 176 lines
- `src/client/renderer/desktop-window-manager.ts`: 174 lines
- `src/client/canvas-ui/artificer-bench-screen.ts`: 174 lines
- `src/client/renderer/diegetic-post-filter.ts`: 166 lines
- `src/client/canvas-ui/tactical-vernier.ts`: 166 lines
- `src/client/canvas-ui/cell-buffer.ts`: 157 lines
- `src/client/renderer/steampunk-shader.ts`: 149 lines
- `src/client/renderer/steampunk-pipeline.ts`: 126 lines
- `src/client/renderer/glyph-atlas-extended.ts`: 113 lines
- `src/client/canvas-ui/tactical-console.ts`: 102 lines
- `src/client/ui/PreactBridge.tsx`: 95 lines
- `src/client/canvas-ui/material-palette.ts`: 70 lines
- `src/client/renderer/shader-uniforms.ts`: 67 lines
- `src/client/renderer/crt-filter.ts`: 55 lines
- Total checked: 404 files. Zero boundary or ceiling violations in `npm run check:boundaries`.

---

## 2. Logic Chain

1. **Shader Filter Scope**:
   - `steampunk-pipeline.ts:69` applies `createDiegeticPostFilter` to `this.rootStage.filters`.
   - `this.rootStage` contains `canvasUiBufferContainer` (line 51), which renders the UI sidebar.
   - Therefore, the UI sidebar is passed through `DIEGETIC_FRAGMENT_SHADER`.
2. **Peripheral Distortion & Text Degradation**:
   - In `DIEGETIC_FRAGMENT_SHADER:74-76`, chromatic aberration is proportional to `caDist = length(curvedUV - vec2(0.5))`.
   - The UI sidebar is located in columns 58 to 87 (UV x from 0.659 to 0.989), where `caDist` is between 0.25 and 0.50.
   - Therefore, the UI sidebar receives the highest chromatic separation on the display, causing red/blue fringing around small 14px font glyphs.
   - Furthermore, `heatHaze` (line 69) and `uThermoStress` (line 70) distort `baseUV` horizontally whenever boiler steam pressure rises, causing telemetry readout numbers to wave and jitter.
3. **Missing In-Game Feedback**:
   - `ClientPresentationView.tsx:63-65` clears `#hud-root` when `useDiegeticCanvasUi: true`.
   - `tactical-console.ts:36-102` does not render an action log or event buffer.
   - Therefore, in the default and primary game mode, players cannot read combat outcomes, item pickups, or environmental alerts.
4. **Visual Depth Flatness**:
   - Tactical map floors use `#120E0A` or `#0B0D0F`, while console bezels and instrument wells use `#101615`.
   - All three surfaces share nearly identical luminance (~0.003 to 0.006).
   - In `material-palette.ts`, `VERDIGRIS_PATINA`, `OXIDIZED_TEAL`, and `AETHER_BLUE` are all `#355B54`.
   - Therefore, the interface lacks the visual layering required to distinguish between recessed readouts, raised chassis framing, active meters, and the map plane.
5. **Modularity Constraints**:
   - `glyph-stage.ts` is at 240 lines (POSIX 239). The hard ceiling in `check-boundaries.ts` is 300 lines.
   - Adding new rendering passes or texture logic directly to `glyph-stage.ts` risks triggering automated build failure. Any modifications must extract helper logic or stay strictly localized.
   - In contrast, `tactical-console.ts` (102 lines) and `material-palette.ts` (70 lines) possess substantial headroom (140+ lines) to incorporate ticker-tape logging and stratified palette tokens.

---

## 3. Caveats

1. **Hardware-Specific HDR Tone Mapping**:
   - WebGL renderers in standard browsers (Chrome/Safari/Firefox) default to SDR sRGB canvas contexts (`colorSpace: 'srgb'`). On 4K HDR displays with OS-level tone mapping (Apple EDR or Windows HDR), luminance clipping can amplify additive bloom artifacts (`col += bloom * ...`), which was evaluated through shader math analysis rather than specialized hardware photometers.
2. **Font Loading Asynchrony**:
   - In Node.js Vitest runs, `typeof document === 'undefined'`, triggering the mock atlas (`createMockExtendedGlyphAtlas`). Browser font decoding timing was verified by inspecting bootstrap sequencing (`main.tsx` vs `glyph-stage.ts`), noting that `document.fonts.ready` is not explicitly awaited before initial canvas draw.
3. **No Direct Code Modifications**:
   - As an explorer agent in a read-only investigation turn, no source code files in `src/` were edited. All proposals are structural recommendations for subsequent implementation phases.

---

## 4. Conclusion

The visual presentation shell of *Aether & Soot* has a robust 5-layer PixiJS foundation, but requires targeted architectural adjustments to fulfill the "Edison-era mechanical" aesthetic and 4K HDR readability goals:

1. **Shader Compositing Isolation**:
   - Apply the full-screen CRT/diegetic post-filter (`createDiegeticPostFilter`) selectively to the tactical map and atmospheric layers (`worldTacticalContainer` and `gaslightLightingContainer`), OR introduce a `uTacticalSplit` uniform (value `58.0 / 88.0 = 0.659`) to bypass lens curvature, heat haze, and chromatic aberration across the UI bay (`uv.x >= uTacticalSplit`).
   - Clamp or disable phosphor bloom on UI glyphs to eliminate intra-character text smearing.
2. **Diegetic Action Log Integration**:
   - Embed a 3-to-4 line continuous **Pneumatic Ticker-Tape Chronicle** into `src/client/canvas-ui/tactical-console.ts` (reallocating rows 22..25 above or below the Vernier Dossier), restoring vital turn logging to the diegetic canvas UI.
3. **Ratification of the Oxidized Iron Palette**:
   - Expand `src/client/canvas-ui/material-palette.ts` with the 6 core material tokens:
     - `DEEP_RUST`: `#7A2E22` (accents, warning thresholds, manifold pipes)
     - `CHARCOAL`: `#1B1F22` (recessed meter wells, ticker-tape paper backing)
     - `TARNISHED_BRASS`: `#C5A059` (dial indicators, structural dividers, text headers)
     - `VERDIGRIS`: `#3D7E73` (chemical status, patina accents, copper tubes)
     - `SULFUR_AMBER`: `#E5A93C` (steam pressure dials, gaslight highlights, warning odometers)
     - `SOOT_BLACK`: `#0B0C0E` (sub-stratum tactical map, chassis border)
   - Establish 4-tier visual depth layering:
     - **Z0 (Deep Tactical Void)**: `#0B0C0E`
     - **Z1 (Recessed Readout Wells)**: `#1B1F22` with `#7A2E22` rust framing
     - **Z2 (Machined Chassis)**: `#222927` with `#C5A059` bolts
     - **Z3 (Emissive Readouts & Vernier)**: `#D9CCAA` parchment and `#E5A93C` amber
4. **4K HDR Readability Safeguards**:
   - Await `document.fonts.ready` in `GlyphStageRenderer.create` before rasterizing `createExtendedGlyphAtlas`.
   - Scale scanline frequency proportionally with display height or keep intensity at `0.04` in text areas.
5. **Modularity Budgeting**:
   - Guard `glyph-stage.ts` (239 lines). Keep all UI expansions inside `tactical-console.ts` (102 lines) and `material-palette.ts` (70 lines).

---

## 5. Verification Method

To independently verify all findings in this report:

1. **Boundary & Modularity Ceiling Check**:
   ```bash
   npm run check:boundaries
   ```
   *Expected Output*: `[check:boundaries] OK — Checked 404 files. Zero Core/Shell or modularity violations.`
2. **TypeScript Compilation & Schema Types**:
   ```bash
   npm run typecheck
   ```
   *Expected Output*: Exit code 0, zero type errors.
3. **Shader Pipeline & Presentation Unit Tests**:
   ```bash
   npx vitest run tests/sim/phase54-shader-pipeline.test.ts
   ```
   *Expected Output*: All 11 tests pass (verifying 5-layer container hierarchy, 4-pass GLSL shader strings, default uniforms, camera governor, and 256-glyph CP437 atlas).
4. **Full Headless Deterministic Test Suite**:
   ```bash
   npm run test:sim
   ```
   *Expected Output*: 109 test files passed, 560 tests passed.
5. **File Line Count Inspection**:
   ```bash
   wc -l src/client/renderer/glyph-stage.ts src/client/canvas-ui/tactical-console.ts src/client/canvas-ui/material-palette.ts
   ```
   *Expected*: `glyph-stage.ts` <= 250 (current: 239), `tactical-console.ts` <= 250 (current: 102), `material-palette.ts` <= 250 (current: 70).
6. **Shader Source Inspection**:
   - View `src/client/renderer/diegetic-post-filter.ts:68-81` to confirm chromatic aberration and heat haze formulas.
   - View `src/client/renderer/steampunk-pipeline.ts:69` to confirm `this.rootStage.filters = [this.postFilter]`.
   - View `src/client/canvas-ui/tactical-console.ts:36-102` to confirm absence of action log event rendering.
