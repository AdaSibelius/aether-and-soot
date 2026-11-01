# Handoff Report: Survey Explorer 1 — UI & HUD Architecture

## 1. Observation

### 1.1 Dual UI Architecture & Bootstrap Flow
- **Entry & Bootstrap**: In `src/client/main.tsx` (lines 10–38) and `src/client/bootstrap-loop.ts` (lines 49–175), the client boots with both a PixiJS WebGL canvas (`GlyphStageRenderer`, 88×36 cells at 12×20px per cell) and HTML DOM mount roots (`#canvas-stage`, `#top-bar-root`, `#action-bar-root`, `#hud-root`).
- **Mode Dispatch**: In `src/client/client-session-state.ts` (line 32), `createInitialSessionState` defaults `useDiegeticCanvasUi: true`.
- **Presentation Rendering**: In `src/client/ui/ClientPresentationView.tsx` (lines 60–95):
  - When `useDiegeticCanvasUi === true`:
    ```ts
    if (topBarHost) render(null, topBarHost);
    if (actionBarHost) render(null, actionBarHost);
    render(null, hudHost);
    render(<PreactBridge ... />, overlayHost);
    ```
    The DOM hosts are emptied, and the entire interface is rendered onto the PixiJS canvas via `composeDiegeticUiBuffer` (`src/client/canvas-ui/diegetic-screen-composer.ts`).
  - When `useDiegeticCanvasUi === false`:
    `ModalTopBar` mounts to `#top-bar-root`, `QuickActionBar` mounts to `#action-bar-root`, and `HudLayout` mounts to `#hud-root`.

### 1.2 Layout Split & Dimensions
- In `src/client/renderer/glyph-stage-types.ts`:
  - `WIDESCREEN_GRID_WIDTH = 88`, `WIDESCREEN_GRID_HEIGHT = 36`
  - `CELL_WIDTH_PX = 12`, `CELL_HEIGHT_PX = 20` (Total canvas resolution: 1056×720px)
- In `src/client/bootstrap-loop.ts` (line 133):
  `tacticalWidth = session.useDiegeticCanvasUi ? WIDESCREEN_GRID_WIDTH - 30 : WIDESCREEN_GRID_WIDTH;`
  - In diegetic mode, the tactical map takes columns `0..57` (width 58 cells = 696px).
  - The tactical console takes columns `58..87` (width 30 cells = 360px), rendered by `renderTacticalConsole` (`src/client/canvas-ui/tactical-console.ts`, lines 85–94).

### 1.3 Audit of Current HUD Panels & Components
| Component File | Directory | Lines | Responsibilities & Displayed Telemetry |
| :--- | :--- | :---: | :--- |
| `glyph-stage.ts` | `src/client/renderer/` | 239 | PixiJS v8 canvas renderer, sprite pooling, layer compositing (1 line below 240 warning ceiling!) |
| `steampunk-pipeline.ts` | `src/client/renderer/` | 127 | 5-layer container stack (`worldTactical`, `gaslightLighting`, `diegeticFrame`, `canvasUiBuffer`, `opticalOverlay`) |
| `steampunk-shader.ts` | `src/client/renderer/` | 150 | GLSL post-processing: barrel distortion (`rimFactor`), phosphor grain, amber/aether bloom, smoke plumes, scanlines |
| `diegetic-screen-composer.ts` | `src/client/canvas-ui/` | 195 | Composes `UiCellBuffer` based on session state (embarkation, system menu, modals, or tactical console) |
| `tactical-console.ts` | `src/client/canvas-ui/` | 103 | Machined bezel, split-flap turns/coinage, Bourdon steam dial, Sanguine manometer, wireframe paperdoll, posture/gas status, optical vernier, bottom navigation keys |
| `analog-gauges.ts` | `src/client/canvas-ui/` | 139 | Bourdon pressure gauge (5-step arc `[░ ▒ ▓ █ ■]` with needle `▲`), Sanguine mercury manometer (`█`/`░` with Pints & Drams), split-flap odometer |
| `bezel-composer.ts` | `src/client/canvas-ui/` | 119 | Machined brass bezel with rivets (`☼`, `Ø`, `⚙`), double borders (`╔═╗`, `╠═╣`, `║`), engraved headers `╡ TITLE ╞` |
| `industrial-primitives.ts` | `src/client/canvas-ui/` | 192 | Heavy iron framing (`PRIMARY_IRON` with block glyphs `█`, `▀`, `▄`), brass toggle tabs (`[► TAB ◄]`), segmented gauges (`[████▒▒····]`) |
| `tactical-vernier.ts` | `src/client/canvas-ui/` | 167 | Tile inspection: coordinates, terrain hardness (Mohs), acoustic echo (dB), soot PPM, steam kPa, coal dust %, gaslight luminescent state, occupying actors |
| `dossier-paperdoll.ts` | `src/client/canvas-ui/` | 95 | 6-slot anatomical schematic (HEAD, TORSO, L-ARM, R-ARM, L-LEG, R-LEG) with HP, prosthetic markers (`⚙`), conduit linkages, blood/tox/pain |
| `satchel-screen.ts` | `src/client/canvas-ui/` | 121 | Full-screen modal satchel: twin gauges (STM, BLD), compartment item listing, item dossier |
| `HudLayout.tsx` | `src/client/ui/` | 228 | HTML DOM HUD: Tactical Telemetry, Vitals & Reserves (segmented bars), Proximity Radar, TileInspectorPanel, TickerTapeLog, MorgueModal |
| `TileInspectorPanel.tsx` | `src/client/ui/` | 204 | HTML DOM tile inspector: terrain, steam kPa, coal dust units, entities present, interaction buttons |
| `TickerTapeLog.tsx` | `src/client/ui/` | 39 | HTML DOM event log: last 5 chronicle entries formatted by `aggregateChronicleEvents` |
| `InventoryPanel.tsx` | `src/client/ui/` | 116 | HTML DOM satchel: mass/volume bars, carried item list, floor items. *Orphaned*: not mounted in `HudLayout.tsx`! |
| `SatchelPanel.tsx` | `src/client/ui/` | 121 | HTML DOM quick satchel view. *Orphaned*: not mounted in `HudLayout.tsx`! |
| `AnatomyDoll.tsx` | `src/client/ui/` | 66 | HTML DOM anatomical list. *Orphaned*: not mounted in `HudLayout.tsx`! |
| `EventFormatter.ts` | `src/client/ui/` | 229 | Chronicler formatting 34 `SimEvent` variants into Victorian prose |
| `SystemMenuModal.tsx` | `src/client/ui/` | 230 | HTML DOM system menu: seed input, save/load, CRT toggle, UI mode toggle |

### 1.4 Modularity Watchlist (Near 240/300 Ceiling)
Exact line counts checked via `wc -l` and `tests/scripts/check-boundaries.ts`:
1. `src/client/renderer/glyph-stage.ts`: **239 lines** (Immediate warning ceiling: >= 240 lines; hard failure: > 300 lines)
2. `src/client/projection/biome-palette.ts`: **235 lines**
3. `src/client/audio/procedural-synth.ts`: **232 lines**
4. `src/client/ui/SystemMenuModal.tsx`: **230 lines**
5. `src/client/ui/EventFormatter.ts`: **229 lines**
6. `src/client/ui/HudLayout.tsx`: **228 lines**
7. `src/client/canvas-ui/naturalist-ledger-screen.ts`: **214 lines**
8. `src/client/ui/CartelLedgerView.tsx`: **211 lines**
9. `src/client/input/keyboard-router.ts`: **209 lines**
10. `src/client/ui/TileInspectorPanel.tsx`: **204 lines**
11. `src/client/ui/DialogueModal.tsx`: **202 lines**
12. `src/client/canvas-ui/diegetic-cartography.ts`: **202 lines**
13. `src/client/ui/InventoryWindow.tsx`: **201 lines**

### 1.5 Telemetry Formatting & Projection Gaps
1. **Character Health**:
   - *Simulation*: `anatomy.bloodVolumePct` (0..100%), `anatomy.limbs` (HP, maxHP, amputated, installedProstheticEntityId), `anatomy.painShock`, `anatomy.stamina`, `anatomy.toxicityPct`.
   - *Canvas UI*: High-fidelity representation in `dossier-paperdoll.ts` (conduits `║`, `═`, `O`, `╱`, `╲`, glyphs `■`, `⚙`, `✗`) and `drawSanguineManometer` (imperial Pints/Drams conversion).
   - *DOM HUD*: In `HudLayout.tsx`, only blood % is shown in a segmented bar. Limb HP is completely absent.
2. **Thermodynamic Stress States (Heat, Pressure, Soot, Steam)**:
   - *Simulation*:
     - Internal steam: `player.anatomy.steamReserveKpa` (overheat/scald at 85 kPa).
     - Internal strain: `player.anatomy.strainLoadKw` / `governorCapacityKw`.
     - Ambient thermal/steam: `tile.steamPressureKpa`.
     - Ambient particulate soot/smoke: `tile.smokePpm` (>100 toxic, >40 smoky).
     - Ambient coal dust density: `tile.coalDustDensity` (spark ignition risk > 0.35).
     - Synthesis: `resolveThermodynamicStress(state, actorId)` in `src/client/renderer/shader-uniforms.ts` computes `stressValue` (0..1), `stressLevel` (`NOMINAL`, `ELEVATED`, `CRITICAL`), and `reason`.
   - *Canvas UI*: Internal steam is on the Bourdon gauge; text shows `THM` and `GAS`; tile soot/steam/coal dust is on the vernier. **Gap**: No unified multi-parameter atmospheric stress gauge (Heat + Pressure + Soot Concentration) visible on the console during exploration.
   - *DOM HUD*: Shows boiler pressure and governor strain bars. **Gap**: Ambient thermodynamic stress (ambient steam, soot PPM, coal dust) is absent from the vitals readout.
3. **Inventory & Carried Items**:
   - *Canvas UI*: **Critical Gap**: In `tactical-console.ts`, there is ZERO inventory readout. The player cannot see their satchel mass, volume, carried item count, or equipped items without opening the full-screen modal `satchel-screen.ts`.
   - *DOM HUD*: **Critical Gap**: `InventoryPanel.tsx` is not mounted in `HudLayout.tsx`. No inventory telemetry is shown in the sidebar.
4. **Chronicle / Event Log**:
   - *Canvas UI*: **Critical Gap**: `tactical-console.ts` contains NO event log window. When moving, picking up items, fighting, or opening doors, the player gets no narrative feedback in diegetic canvas mode (only temporary floating combat text).
   - *DOM HUD*: `TickerTapeLog` displays 5 lines, but is only visible when diegetic canvas mode is toggled off.

### 1.6 WebGL Shader Compositing & 4K HDR Readability
- In `src/client/renderer/steampunk-pipeline.ts`:
  ```ts
  this.postFilter = createDiegeticPostFilter(this.uniforms);
  this.rootStage.filters = [this.postFilter];
  ```
  The post-processing filter is attached to `rootStage`, filtering all layers simultaneously (`worldTactical`, `gaslightLighting`, `diegeticFrame`, `canvasUiBuffer`, `opticalOverlay`).
- In `src/client/renderer/steampunk-shader.ts`:
  - **Lens Vignette / Distortion**: `float rimFactor = smoothstep(0.46, 0.50, dist) * uDistortionScale; vec2 sampleUV = uv + centered * (rimFactor * 0.005);`. For widescreen 88×36 cells, the console corners exceed `dist > 0.46`, causing subtle warping on peripheral UI text.
  - **Scanlines**: `float scanline = sin(sampleUV.y * 720.0 + uTime * 1.0) * uScanlineOpacity;`. On 4K displays (3840×2160, scaling the 720p internal buffer ~3×), 720 cycles creates heavy 3-pixel dark stripes that severely degrade readability of ASCII punctuation (`:`, `;`, `·`, `░`, `▒`).
  - **Selective Bloom**: `if (bloom.b > 0.70 && bloom.g > 0.65) col += bloom * 0.15;` and amber bloom `col += bloom * vec3(...) * 0.12;`. Text rendered in bright amber (`#e6a145`) or cyan (`#355B54`) blooms into adjacent character cells.

---

## 2. Logic Chain

1. **Premise 1 (Dual UI Reality)**: The repository maintains two distinct UI presentations: Diegetic Canvas UI (default, rendered by PixiJS via `UiCellBuffer`) and HTML DOM HUD (`HudLayout.tsx`).
2. **Premise 2 (Feature Parity & Utility Deficiency)**:
   - In Diegetic Canvas UI mode (`tactical-console.ts`), the console allocates 30 columns. However:
     - 10 rows (30% of vertical budget) are consumed by the optical vernier (`tactical-vernier.ts`), which sits in "STANDBY" when no tile is hovered.
     - 0 rows are allocated to the Event Chronicle (missing narrative causal feedback).
     - 0 rows are allocated to Satchel / Inventory load.
     - Thermodynamic stress is split between a steam-only Bourdon dial and a small text token (`THM: NOMINAL`), omitting ambient atmospheric soot, pressure, and thermal hazard metrics.
   - In HTML DOM mode (`HudLayout.tsx`):
     - `InventoryPanel.tsx` and `AnatomyDoll.tsx` exist in `src/client/ui/` but are omitted from `HudLayout.tsx`.
     - Visual styling in `index.html` uses generic 1px green border boxes (`--panel-border: #355B54`) without heavy block framing or CP437 box-drawing depth separation.
3. **Premise 3 (Aesthetic Cohesion — Caves of Qud vs Pip-Boy)**:
   - Pip-Boy tropes rely on curved green CRTs, cartoon icons, and flat bars.
   - Caves of Qud aesthetic relies on dense text grids, heavy Unicode/CP437 block characters (`█`, `▀`, `▄`, `░`, `▒`, `▓`), double-line pipes (`╔═╗`, `║`), machined fasteners (`☼`, `Ø`, `⚙`), and rich Victorian industrial tones (`#101615` Soot Black, `#202A28` Oxidized Iron, `#C1A15B` Aged Brass, `#D9CCAA` Parchment, `#B94B42` Warning Red).
4. **Premise 4 (4K HDR Shader Legibility)**:
   - Applying `postFilter` to `rootStage` forces the UI text through scanlines and distortion.
   - Because `SteampunkRenderPipeline` already structures its rendering into discrete containers (`worldTacticalContainer`, `gaslightLightingContainer`, `diegeticFrameContainer`, `canvasUiBufferContainer`), moving `postFilter` onto an internal tactical container (or masking the shader for `uv.x >= 58.0 / 88.0`) ensures the world map retains rich atmospheric shaders while HUD text remains razor-sharp at 4K.
5. **Premise 5 (300-Line Ceiling Constraint)**:
   - `src/client/renderer/glyph-stage.ts` is currently at 239 lines (1 line below 240). Any addition to `glyph-stage.ts` will trigger modularity warnings and risk the 300-line hard gate.
   - `src/client/ui/HudLayout.tsx` is at 228 lines.
   - Refinements must be extracted into focused sub-modules (target <= 200 lines).

---

## 3. Caveats

1. **Audio & Soundscape**: The WebAudio procedural synth (`src/client/audio/`) was not inspected in detail as it falls under audio telemetry rather than visual HUD architecture.
2. **Input Routers**: `src/client/input/` was verified for key bindings (`[I]`, `[A]`, `[C]`, `[L]`, `[ESC]`), but detailed keyboard navigation inside modal sub-views was not mapped.
3. **Headless Verification**: The simulation core (`src/sim/`) has zero dependency on UI changes, preserving headless determinism. `npm run verify` passed completely (109 test files, 560 tests, 0 boundary violations).

---

## 4. Conclusion & Actionable Implementation Blueprint

To fulfill Phase 1 of the request directly in the repository while respecting the 300-line modularity ceiling, the implementer should execute the following 4-part plan:

### Part A: Diegetic Canvas Console Overhaul (`src/client/canvas-ui/tactical-console.ts`)
Restructure the 30-column tactical console to achieve maximum information density and Edison-era mechanical aesthetic:
1. **Row 0–1**: Machined Brass Bezel Title (`AETHER & SOOT CONSOLE`) with corner rivets (`☼`).
2. **Row 2–4**: Split-Flap Chronometer & Coinage (`TURNS: [00142]`, `COINAGE: 14s 8d`).
3. **Row 5–11**: Twin Diegetic Gauges:
   - Bourdon Steam Pressure Arc (`drawBourdonPressureGauge`, 0..100 kPa).
   - Sanguine Fluid Manometer (`drawSanguineManometer`, Pints & Drams).
4. **Row 12–15 (NEW: Thermodynamic Stress & Atmosphere Barometer)**:
   - Implement `drawAtmosphericBarometer` (extract to `src/client/canvas-ui/analog-gauges.ts` or new module):
     - Internal Load: Governor Strain (`[████▒▒····] 42/100 kW`)
     - Atmosphere: Ambient Steam kPa + Soot Concentration (`SOOT: 85 PPM [SMOKY]  STM: 40 kPa`)
5. **Row 16–22**: Anatomical Wireframe Paperdoll (`renderDiegeticPaperdoll`) with limb damage states and conduit linkages.
6. **Row 23–27 (NEW: Compact Satchel & Load Gauge)**:
   - Satchel Load: Mass (`[████····] 4.2/10.0 kg`) and Volume (`[██████··] 650/1000 ml`).
   - Equipped Gear / Hand slot summary (e.g. `WIELD: Spanner (Iron)` or top carried item).
7. **Row 28–33 (NEW: Diegetic Ticker-Tape Chronicle)**:
   - Render the last 3 chronicle event lines in typewriter ink (`#f5e6cb`) within an engraved brass frame `╡ TICKER CHRONICLE ╞`.
8. **Row 34–35**: Collapsible Optical Vernier (compact 1-row summary when standby: `[L] VERNIER: STANDBY`; expands on hover/look mode).
9. **Row 35**: Quick navigation buttons (`[I]NV`, `[A]NAT`, `[C]RFT`, `[ESC]`).

### Part B: HTML DOM / Preact HUD Refinement (`src/client/ui/HudLayout.tsx` & `index.html`)
For when `useDiegeticCanvasUi === false`:
1. **Oxidized Iron Palette & Block Framing**:
   - Update `index.html` CSS: Replace thin 1px green borders with double brass borders (`border: 2px double var(--brass-gold)`), heavy CP437 header brackets (`╔═[ ... ]═╗`), rivet corner pseudo-elements, and recessed dark iron panel backgrounds (`background: #18201e`).
2. **Inventory Satchel Integration**:
   - Embed a compact satchel load bar and quick-item slot inside `HudLayout.tsx` (extracted to `src/client/ui/HudSatchelSummary.tsx` to keep `HudLayout.tsx` under 240 lines).
3. **Atmospheric Telemetry**:
   - Add ambient steam pressure and soot PPM readouts to Tactical Telemetry.

### Part C: Shader Pipeline Optimization for 4K HDR (`src/client/renderer/steampunk-pipeline.ts`)
1. **Isolate UI Layer from Post-Processing Blur**:
   - In `SteampunkRenderPipeline`, bind `this.postFilter` specifically to `worldTacticalContainer` and `gaslightLightingContainer`, or update `STEAMPUNK_FRAGMENT_SHADER` to bypass vignette, scanlines, and bloom for `sampleUV.x >= 58.0 / 88.0` (the console area).
   - This guarantees 100% crisp, unblurred text readability at 4K resolution while retaining lush gaslight bloom and smoke plumes over the tactical dungeon grid.

### Part D: Modularity Splitting Checklist
- Do NOT add new code directly to `glyph-stage.ts` (currently 239 lines).
- When expanding `analog-gauges.ts` or `tactical-console.ts`, keep each file <= 220 lines. Extract sub-panels (`console-chronicle.ts`, `console-satchel.ts`) as separate single-responsibility modules.

---

## 5. Verification Method

1. **Line Count & Modularity Gate**:
   ```bash
   npm run check:boundaries
   ```
   Must pass with 0 errors and zero files exceeding 300 lines.
2. **Type Safety & Schema Integrity**:
   ```bash
   npm run typecheck
   ```
   Must pass with 0 errors.
3. **Simulation Regression Suite**:
   ```bash
   npm run test:sim
   ```
   Must pass all 109 test files and 560 unit tests.
4. **Full Automated Verification**:
   ```bash
   npm run verify
   ```
   Runs all four gates in sequence (`typecheck`, `check:boundaries`, `validate:data`, `test:sim`).
5. **Visual Inspection**:
   Launch client (`npm run dev`) and inspect:
   - Diegetic Canvas Console (default): Verify Bourdon gauge, Sanguine manometer, Wireframe paperdoll, new Atmospheric stress gauge, Satchel load bar, and Ticker-tape chronicle are rendered in columns 58..87 with oxidized iron palette.
   - Shaders on 4K: Verify text in the console remains sharp without scanline banding or letter bleeding.
   - DOM HUD fallback (toggle via System Menu [Esc] -> UI Mode): Verify updated heavy double borders and CP437 framing.
