# Architectural Decision Record: Feasibility Evaluation of Dear ImGui Presentation Layer Migration

**Document Identifier**: ADR-001  
**Target Repository**: `AdaSibelius/aether-and-soot`  
**Status**: REJECTED  
**Date**: 2026-11-01  
**Deciders**: Principal UI/UX Architect, Core Simulation Engine Architect  
**Technical Stakeholders**: Headless Core Engineers, Presentation Shell Developers, AI Governance Specialists  
**Governing Documents**: `AGENTS.md`, `ARCHITECTURE.md`, `docs/architecture-map.md`, `docs/EVALUATION_REPORT.md`  

---

## 1. Context & Problem Statement

### 1.1 The Proposal
A formal architectural proposal was submitted to evaluate migrating the user interface and presentation tier of *Aether & Soot* from its current dual-layer presentation architecture—comprising a WebGL CP437 glyph stage with a canvas-based diegetic console (`src/client/renderer/`, `src/client/canvas-ui/`) and declarative Preact HUD drawers (`src/client/ui/`)—to an immediate-mode graphical user interface based on **Dear ImGui** (compiled to WebAssembly via Emscripten/TypeScript bindings such as `imgui-js`).

Proponents posited that Dear ImGui would:
1. Provide unified, out-of-the-box windowing, docking, tree hierarchies, and scrolling containers.
2. Reduce front-end state management by co-locating widget declarations with runtime data reads.
3. Consolidate DOM and Canvas rendering paths into a single WebGL rendering pipeline.

### 1.2 Evaluation Mandate
To assess this architectural migration with clinical rigor, this evaluation examines the technical friction, computational performance, aesthetic capability, and maintenance sustainability across four non-negotiable architectural axes:
- **Axis 1: ECS Data Mapping & Immediate Mode Paradigm Friction**: Technical impedance of binding immutable, event-sourced, relational ECS simulation state to immediate-mode mutable pointer widgets, alongside WebAssembly foreign function interface (WASM FFI) serialization overhead.
- **Axis 2: Rendering Pipeline & WebGL Context / Shader Compositing Feasibility**: WebGL state-machine contention with PixiJS v8, 4K HDR framebuffer bandwidth, and the mathematical conflict between non-linear diegetic lens curvature shaders and axis-aligned screen-space scissor clipping.
- **Axis 3: Aesthetic Compatibility & Styling Overhead**: Feasibility of forcing an automatic proportional pixel-layout engine into a strict 12x20px CP437 monospace character grid, dual-color character cell rendering, font atlas generation for Victorian technical glyphs, and authoring diegetic mechanical instruments (Bourdon gauges, mercury manometers, split-flap odometers).
- **Axis 4: Token Inflation & AI Maintenance Complexity**: Code-generation overhead within the 300-line modularity ceiling, AI context token inflation, brittleness of push/pop stack state machines leading to fatal WASM aborts, strict TypeScript type compliance (`noUncheckedIndexedAccess`, zero `any`), and preservation of sub-second Node.js headless testing.

---

## 2. Axis 1: ECS Data Mapping & Immediate Mode Paradigm Friction

```
Current Architecture:
[WorldState] (Immutable) ──(On Turn)──> [projectWorldToVisualFrame] ──> [UiCellBuffer / Preact]
       ▲                                                                         │
       └────────────────── dispatchCommand(GameCommand) ◄────────────────────────┘
                           (Zod Validated, Event Sourced)

Proposed Dear ImGui Architecture:
[WorldState] (Immutable) ──(60-120 FPS FFI Bridge)──> [WASM Heap Alloc] ──> [ImGui::Widgets]
       ▲                                                                         │
       X [FORBIDDEN MUTATION] ◄─── (ImGui::Slider(&hp)) ─────────────────────────┘
       └─────── Synthesized Staged Commands (Complex Local Buffering) ───────────┘
```

### 2.1 Unidirectional Event-Sourced Command Dispatch vs. Two-Way Mutable Pointers
Dear ImGui is fundamentally architected in C++ around direct, two-way mutable pointers and references passed into widget invocations:
```cpp
// Native Dear ImGui paradigm
ImGui::SliderInt("Boiler Pressure", &anatomy.steamReserveKpa, 0, 1000);
ImGui::InputText("Actor Name", buffer, sizeof(buffer));
ImGui::Checkbox("Governor Engaged", &governor.isEngaged);
```

In *Aether & Soot*, this design pattern violates the foundational architectural invariant established in `ARCHITECTURE.md` (§1.1, §2) and enforced by `AGENTS.md` (Rule 2.1):
1. **Presentation Immutability**: The presentation shell receives strictly `Readonly<WorldState>`. The client layer possesses zero authority to mutate entity hit points, steam reserves, inventories, or spatial tiles directly.
2. **Deterministic Command Pipeline**: All state transitions must flow exclusively through `dispatchCommand(currentState, rawCommand)` in `src/sim/core/engine.ts`. Each command undergoes runtime Zod schema parsing (`GameCommandSchema.parse`), executes within `resolveAction()` in `src/sim/core/action-resolver.ts`, resolves through pure domain systems (`src/sim/systems/*.system.ts`), and commits atomic state changes verified by `assertWorldInvariants()` in `src/sim/core/invariants.ts`.
3. **Event Sourcing**: Every gameplay state transition emits strongly typed `SimEvent` objects into `state.eventLog` (108 active event schemas). Direct pointer mutation bypasses event generation, breaking deterministic replay logging, the player's pneumatic chronicle, and AI playtester auditability.

Consequently, Dear ImGui **cannot** utilize its idiomatic pointer-based data binding in this codebase. Every interactive widget (sliders, toggles, text inputs, buttons) would require an intermediate client-side staging buffer. The client would have to:
- Intercept widget value modifications on every frame.
- Compare modified values against a shadow snapshot of `WorldState`.
- Synthesize an appropriate typed `GameCommand` payload (e.g. `VENT_STEAM`, `TOGGLE_GOVERNOR`, `TRANSFER_ITEM`).
- Dispatch the command through `dispatchCommand()`.

This negates the primary developer-velocity advantage of immediate-mode GUIs, replacing it with an error-prone, manually synchronized staging proxy layer.

### 2.2 Continuous 60 FPS WASM FFI Marshalling vs. Discrete Turn-Based Simulation
*Aether & Soot* is a discrete, turn-based roguelike simulation. The simulation clock advances solely when an actor command resolves (operating at human typing speed or turn rates of 1 to 5 Hz). In the existing architecture:
- Screen buffer generation (`composeDiegeticUiBuffer`) executes reactively when a turn completes, an input modal opens, or an animation interpolates.
- Between turns, the presentation shell performs zero state recomputation, consuming negligible CPU cycles.

In contrast, Dear ImGui executes its entire widget tree, layout resolution, and vertex generation **on every animation frame** (60 to 120 times per second):
1. **WASM Heap Crossing**: WebAssembly cannot directly access the V8 JavaScript heap or read complex JavaScript object trees (`WorldState`, `EntityRecord`, Zod records). To render text strings, labels, stat values, and tooltips, JavaScript must continuously serialize data and marshal it into WebAssembly linear memory via `Module._malloc`, `stringToUTF8`, or Emscripten FFI thunks.
2. **Main Thread Garbage Collection & Allocation Churn**:
   - A single frame of the tactical HUD displays approximately 120 distinct text labels (entity names, stats, coordinates, fluid ounces, inventory items, ticker log lines, combat stats).
   - At 60 FPS, this requires 7,200 string marshalling operations per second; at 120 FPS on modern displays, this reaches 14,400 allocations per second.
   - Continuously allocating, copying, and freeing UTF-8 byte buffers in WASM linear memory generates heavy main-thread garbage collection pressure, inducing perceptible micro-stutter in the browser JavaScript engine for completely static data.

### 2.3 Relational Entity Traversal Caching & Query Overhead
The ECS in `src/sim/core/world.ts` is strictly flat and relational (`entities: Record<string, EntityRecord>`). Entities never nest child entities; relations are expressed via branded identifier strings (`EntityIdSchema`):
- Inventory items are stored in `state.entities[actorId].inventory.containedEntityIds: EntityId[]`.
- Installed cybernetic prosthetics are referenced via `installedProstheticEntityId: EntityId`.
- Socket attachments are referenced via `socketAttachmentIds: EntityId[]`.

In an immediate-mode loop running at 60 FPS, traversing an actor’s inventory to compute total carried mass, volume, equipped weapons, and prosthetic status requires resolving dozens of dictionary lookups (`state.entities[id]`) on every animation frame. To prevent frame drops, front-end engineers would be forced to author an intermediate memoization and caching layer in JavaScript. This intermediate layer is identical in concept and maintenance cost to the existing `projectWorldToVisualFrame` adapter (`src/client/projection/frame-adapter.ts`) and `UiCellBuffer`, invalidating the claim that ImGui simplifies data access.

### 2.4 Event Sourcing, Chronicler Serialization & Log Streaming
The simulation records all gameplay occurrences into `state.eventLog: SimEvent[]`. The pneumatic action ticker (`src/client/canvas-ui/console-chronicle.ts` and `src/client/ui/EventFormatter.ts`) inspects this log to generate narrative log messages and localized barks. 

In Dear ImGui, rendering a scrolling log window requires passing pre-formatted strings into `ImGui::TextUnformatted()`. Re-formatting events on every frame inside the immediate-mode render loop is computationally prohibitive. Therefore, log formatting must occur outside the immediate loop and be cached in an array of strings in JavaScript, reducing Dear ImGui to a basic scrolling container that adds no architectural value over existing canvas buffer writes.

---

## 3. Axis 2: Rendering Pipeline & WebGL Context / Shader Compositing Feasibility

```
Current 5-Layer Steampunk Pipeline:
Layer 1: WORLD_TACTICAL   (Tile Grid, Entities, Fog)
Layer 2: GASLIGHT_LIGHTING (Volumetric Tinting)
Layer 3: DIEGETIC_FRAME   (Machined Bezels, CRT Boundary)
  └──> Passes through DIEGETIC_FRAGMENT_SHADER (Spherical Lens Curvature, Scanlines, Heat Haze)
Layer 4: CANVAS_UI_BUFFER (Tactical Console, Bourdon Gauges, Ticker) [ISOLATED FROM WARPING]
Layer 5: OPTICAL_OVERLAY  (Vignette, Edison Filament Grain)

Proposed Dear ImGui Compositing Dilemma:
Choice A: External Overlay (Outside Shader)
  ├── Tactical Map (Post-Processed CRT)
  └── ImGui Windows (Flat, Modern Razor-Sharp Grey Developer UI) -> Aesthetic Failure
Choice B: Inside Diegetic Post-Filter
  ├── Spherical Lens Curvature Warps Axis-Aligned Scissor Rects -> Text Clipping & Edge Tearing
  ├── Chromatic Aberration & Scanlines Blur Small 9-13px ImGui Fonts -> Illegible at 4K HDR
  └── Intermediate 4K FBO (3840x2160 RGBA16F) -> Massive VRAM Bandwidth Spike
```

### 3.1 WebGL Context Binding & PixiJS v8 State Machine Clobbering
*Aether & Soot* initializes its primary WebGL canvas using PixiJS v8 in `src/client/renderer/glyph-stage.ts`:
```typescript
const app = new Application();
await app.init({
  preference: 'webgl',
  width: gridWidth * CELL_WIDTH_PX,
  height: gridHeight * CELL_HEIGHT_PX,
  backgroundColor: 0x0b0c0e,
  antialias: false,
  resolution: window.devicePixelRatio || 1,
  autoDensity: true,
});
```

PixiJS v8 maintains an aggressive internal WebGL state cache manager (`app.renderer.gl`) that tracks:
- Bound Vertex Array Objects (VAOs) and Vertex Buffer Objects (VBOs).
- Active shader programs and Uniform Buffer Objects (UBOs).
- Bound texture units (`GL_TEXTURE0` through `GL_TEXTURE15`).
- Active blend equations, stencil states, viewport rectangles, and scissor test flags (`GL_SCISSOR_TEST`).

Standard WebAssembly Dear ImGui backends (`ImGui_ImplOpenGL3_RenderDrawData`) issue unmanaged, direct raw WebGL draw calls (`gl.drawElements`, `gl.bindBuffer`, `gl.useProgram`, `gl.enable(gl.SCISSOR_TEST)`).
When Dear ImGui executes raw WebGL calls on the same context as PixiJS v8:
1. PixiJS's cached state machine is desynchronized. PixiJS believes its own shaders, VAOs, and textures are still bound.
2. On subsequent PixiJS render passes (such as rendering tactical glyph sprites or lighting containers), PixiJS draws with corrupted state, leading to missing sprites, scrambled character glyphs, or fatal WebGL pipeline errors (`GL_INVALID_OPERATION`).
3. Mitigating this desynchronization requires a complete WebGL state snapshot and restore (`app.renderer.reset()`, querying and restoring all GL capabilities, bindings, and scissor rects) before and after every ImGui draw call. In WebGL, executing synchronous state queries (`gl.getParameter`) stalls the browser GPU pipeline, inducing substantial CPU bubbles and eliminating 60 FPS stability.

### 3.2 The Post-Processing Shader Compositing Dilemma
*Aether & Soot* achieves its distinctive visual identity through `SteampunkRenderPipeline` (`src/client/renderer/steampunk-pipeline.ts`) and the diegetic multi-pass GLSL shader in `src/client/renderer/diegetic-post-filter.ts`. The post-processing pipeline applies:
- Non-linear spherical glass lens barrel curvature (`applyLensCurvature`).
- Aperture grille shadow masks and scanlines (`uScanlineIntensity`).
- Dual-threshold phosphor bloom (amber 0.65, cyan 0.70).
- Thermodynamic heat haze and chromatic aberration (`uThermoStress`, `uChromaticAberration`).
- Localized procedural volumetric smoke plumes (`uSmokeMask`).

Integrating Dear ImGui creates an intractable architectural dilemma between two mutually exclusive approaches:

#### Scenario A: ImGui Rendered as an External Overlay (Outside Post-Filter)
If ImGui is rendered directly to the default framebuffer on top of the PixiJS canvas (or in a secondary transparent overlay canvas):
- ImGui completely bypasses the diegetic post-filter.
- The UI appears as a modern, flat, razor-sharp grey developer utility window floating awkwardly above an atmospheric Victorian phosphor cathode screen.
- This creates an unacceptable visual rupture, directly violating Requirement R1 and Requirement R2 to deepen the Edison-era mechanical aesthetic and avoid modern web/developer tropes.

#### Scenario B: ImGui Rendered into an Intermediate FBO (Inside Post-Filter)
If ImGui renders into an offscreen framebuffer and passes through `DIEGETIC_FRAGMENT_SHADER`:
1. **Severe Text Illegibility on 4K HDR Displays**:
   Dear ImGui typically renders UI text using small proportional or monospace fonts (9px to 14px raster heights). When sub-14px font vectors pass through spherical lens barrel curvature (`uv = d * (1.0 + k * r²)`), chromatic aberration color channel separation, and scanline masking, the glyphs suffer severe blurring, color fringing, and loss of contrast. While 12x20px high-contrast character cells with dedicated dark backgrounds withstand CRT filtering, small ImGui widget text becomes fatiguing and unreadable on 4K monitors.
2. **Spherical Distortion of Axis-Aligned Scissor Rectangles**:
   Dear ImGui relies entirely on axis-aligned screen-space rectangular clipping (`gl.scissor(x, y, width, height)`) to constrain text and widgets inside scrolling child windows, popup menus, combo boxes, and table columns.
   However, the diegetic lens shader applies non-linear radial pincushion distortion. In shader space, straight screen-space lines curve outward. When an axis-aligned scissored texture is sampled through a spherical curvature shader:
   - The rectangular scissor boundary is bent into curved pincushion geometry.
   - Text and content clipped against straight rectangular bounds visibly bleed or clip across curved seams.
   - Child window borders, splitters, and scrollbars curve inconsistently against fixed bezel margins, causing visible edge tearing and aesthetic artifacts.
3. **Double Framebuffer Bandwidth at 4K Resolution**:
   Compositing ImGui through an intermediate FBO requires allocating full-screen render targets matching the viewport resolution. On a 4K display (3840x2160) at 60–120 Hz:
   - A single 3840x2160 RGBA8 framebuffer consumes 33.18 MB of VRAM.
   - Reading, rendering, and compositing this additional buffer through post-processing shaders consumes over 4 GB/s of memory bandwidth exclusively for the UI pass, penalizing laptops and integrated GPUs.

In contrast, the current architecture isolates the tactical console (`x >= 58` columns) in screen space, applying subtle scanlines and phosphor bloom while completely bypassing lens curvature distortion, guaranteeing razor-sharp 12x20px CP437 legibility at 4K HDR without extra FBO overhead.

---

## 4. Axis 3: Aesthetic Compatibility & Styling Overhead

```
Terminal Monospace Grid vs. Dear ImGui Proportional Layout:

Aether & Soot CP437 Grid:
┌──────┬──────┬──────┬──────┐  Strict 12x20px character cells
│ █ FG │ ░ BG │ ═ FG │ ║ FG │  Dual-color: Independent FG & BG per cell
└──────┴──────┴──────┴──────┘  Sub-pixel aligned bitmap glyph atlas

Dear ImGui Default Layout:
┌───────────────────────────┐  Proportional pixel bounding boxes
│ Button Label (Sans-Serif) │  Single text color per draw call
└───────────────────────────┘  No native cell backgrounds (requires extra quad)
```

### 4.1 Proportional Layout Engine vs. Strict Monospace CP437 Grid
*Aether & Soot* belongs to the tactical terminal roguelike lineage (exemplified by *Caves of Qud* and *ADOM*). The entire display layout is strictly quantized to character cells of **12 pixels width by 20 pixels height** (`src/client/renderer/glyph-stage-types.ts`):
- Widescreen grid dimensions: 88 columns by 36 rows (1056x720 base resolution, scaled integer multiples up to 4K).
- Every visual element—the tactical map, machined box-drawing bezels (`═`, `║`, `╔`, `╗`), status readouts, Bourdon gauges, and inventory lists—aligns perfectly to integer cell coordinates `(col, row)`.

Dear ImGui is fundamentally an **automatic proportional pixel-layout engine**. Its layout algorithm calculates element sizes based on proportional font metrics, padding (`Style.FramePadding`), item spacing (`Style.ItemSpacing`), and window margins (`Style.WindowPadding`).

Forcing Dear ImGui into a fixed 12x20px character cell grid requires:
1. Setting all style padding, spacing, borders, and margins to zero:
   ```cpp
   ImGuiStyle& style = ImGui::GetStyle();
   style.WindowPadding = ImVec2(0, 0);
   style.FramePadding = ImVec2(0, 0);
   style.ItemSpacing = ImVec2(0, 0);
   style.ItemInnerSpacing = ImVec2(0, 0);
   style.WindowBorderSize = 0.0f;
   ```
2. Manually calculating pixel offsets for every single text element, label, and widget using integer cell math:
   ```cpp
   ImGui::SetCursorPos(ImVec2(col * 12.0f, row * 20.0f));
   ```
This manual positioning bypasses Dear ImGui's layout engine entirely (auto-wrap, flex columns, flow layout, automatic cursor advancement). Dear ImGui is reduced to an awkward, heavyweight coordinate-wrapper that provides no layout automation while imposing substantial runtime overhead.

### 4.2 Font Atlas Generation & Unicode Range Overhead
To render Victorian terminal interfaces, the presentation layer requires the complete 256-character Code Page 437 character set plus specialized Victorian technical symbols:
- Box-drawing characters (single and double lines: `═`, `║`, `╔`, `╗`, `╚`, `╝`, `╠`, `╣`, `╦`, `╩`, `╬`).
- Block elements (`░`, `▒`, `▓`, `█`, `▄`, `▀`, `■`).
- Victorian mechanical and astrological symbols: `⚙` (U+2699 Gear), `⌖` (U+2316 Position Indicator), `◈` (U+25C8 White Diamond Containing Black Small Diamond), `◆` (U+25C6 Black Diamond), `◇` (U+25C7 White Diamond), `□` (U+25A1 White Square), `⚡` (U+26A1 High Voltage), `⚠` (U+26A0 Warning), `‡` (U+2021 Double Dagger), `⣿` (U+28FF Braille Pattern Dots-12345678), `Ø` (U+00D8 Slashed O), `ø` (U+00F8), `☼` (U+263C White Sun with Rays).

In Dear ImGui, rendering non-ASCII glyphs requires:
1. Packing custom TrueType font files (`.ttf`) into the WebAssembly virtual filesystem.
2. Manually configuring wide `ImWchar` Unicode glyph ranges:
   - Latin-1 Supplement (0x00A0–0x00FF)
   - Box Drawing (0x2500–0x257F)
   - Block Elements (0x2580–0x259F)
   - Miscellaneous Technical (0x2300–0x23FF)
   - Miscellaneous Symbols (0x2600–0x26FF)
   - Braille Patterns (0x2800–0x28FF)
3. Rasterizing a large 2048x2048 font texture atlas in WebAssembly linear memory at initialization, consuming several megabytes of RAM and increasing startup latency.
In contrast, *Aether & Soot*'s `GlyphAtlasExtended` (`src/client/renderer/glyph-atlas-extended.ts`) procedurally draws crisp, sub-pixel aligned monochrome glyphs directly onto an HTML Canvas texture using native browser font rendering, binding directly to PixiJS with zero WASM memory overhead.

### 4.3 Dual-Color Cell Limitation & Draw Call Multiplication
In terminal roguelike presentation, every character cell is **dual-colored**: it possesses both an independent foreground color (`fgColor`) and an independent background color (`bgColor`). For example:
- Selected inventory item: `PARCHMENT` glyph on `OXIDIZED_TEAL` background.
- Critical health warning: `WARNING_RED` glyph on `DEEP_RUST` background.
- Ambient tile steam: `CHARCOAL` glyph on `SOOT_BLACK` background.

Dear ImGui's native text rendering primitive (`ImGui::Text()` / `ImDrawList::AddText()`) **only renders foreground glyph quads**. It has no concept of a per-character background cell color.
To achieve dual-color rendering in Dear ImGui, the developer must:
1. Emit an explicit filled rectangle for every non-black background cell via `ImDrawList::AddRectFilled(cellMin, cellMax, bgColor)`.
2. Emit the character glyph on top via `ImDrawList::AddText(cellPos, fgColor, charStr)`.

This doubles the vertex buffer traffic:
- 1 character cell = 2 quads = 8 vertices + 12 indices.
- For a full console surface of 88x36 = 3,168 cells, this generates 25,344 vertices and 38,016 indices every frame, completely overwhelming the WebGL vertex pipeline for static text that the current architecture draws with zero vertex overhead.

### 4.4 Recreating Diegetic Instruments with Raw Vector Primitives
*Aether & Soot*'s visual hallmark is its diegetic Victorian mechanical instrumentation:
- **Bourdon Steam Dial** (`src/client/canvas-ui/analog-gauges.ts`): Analog circular dial with stepped pressure arcs (`['░', '▒', '▓', '█', '■']`), pressure threshold color shifts, and calibrated needle indicators (`▲`).
- **Sanguine Mercury Manometer**: Fluid mercury column with meniscus level indicators and Imperial fluid measurements (pints, fluid ounces, drams, minims).
- **Split-Flap Odometer Reel Registers**: Mechanical counters with bracketed flanged digits (`[ 0 | 0 | 1 | 4 | 2 ]`).
- **Machined Brass Bezels & Rivets** (`src/client/canvas-ui/bezel-composer.ts`): Dual-piped box frames with engraved corner brackets, fastener rivets (`⚙`, `Ø`, `☼`), and centerplate title engravings (`╡ ... ╞`).

Dear ImGui possesses **zero native support** for circular gauges, manometers, split-flap reels, or character-cell bezels.
Implementing these instruments in Dear ImGui requires writing hundreds of lines of low-level `ImDrawList` vector commands (`PathArcTo`, `AddPolyline`, `AddCircleFilled`). This would throw away the clean, declarative, cell-based implementations already functioning in `analog-gauges.ts` and `bezel-composer.ts`, producing an inferior visual replica with massive maintenance liability.

---

## 5. Axis 4: Token Inflation & AI Maintenance Complexity

```
Code Generation Economy Comparison:

Aether & Soot Declarative Cell Buffer / Preact:
buf.drawBox(x, y, 30, 10, PALETTE.TARNISHED_BRASS, PALETTE.SOOT_BLACK);
buf.writeString(x + 2, y + 1, "PRESSURE: 420 kPa", PALETTE.PARCHMENT);
drawBourdonGauge(buf, x + 2, y + 3, pressureKpa);
// ~15 lines, ~80 tokens, 100% type-safe, impossible to crash runtime

Dear ImGui Imperative Binding Boilerplate:
ImGui.PushID("boiler_panel");
ImGui.PushStyleColor(ImGui.Col.WindowBg, colSoot);
ImGui.PushStyleVar(ImGui.StyleVar.WindowPadding, new ImGui.Vec2(0, 0));
if (ImGui.BeginChild("boiler_frame", new ImGui.Vec2(360, 200), true)) {
  ImGui.SetCursorPos(new ImGui.Vec2(24, 20));
  ImGui.TextColored(colParchment, `PRESSURE: ${pressureKpa} kPa`);
  renderCustomBourdonVector(ImGui.GetWindowDrawList(), 24, 60, pressureKpa);
}
ImGui.EndChild();
ImGui.PopStyleVar();
ImGui.PopStyleColor();
ImGui.PopID();
// ~50 lines, ~320 tokens (+300% inflation), stack imbalance aborts WASM
```

### 5.1 Modularity Ceiling & 300-Line Governance Breaches
Repository governance (`tests/scripts/check-boundaries.ts`, enforcing `AGENTS.md` Rule 2.2) mandates:
- Target file size: **<= 250 lines**.
- Hard automated verification ceiling: **300 lines**.
- Any TypeScript file exceeding 300 lines causes `npm run verify` to fail with exit code `1`.

Dear ImGui bindings are notoriously verbose. Every interactive widget, container, and styled section requires explicit push/pop scoping:
- `ImGui.PushID()` / `ImGui.PopID()`
- `ImGui.PushStyleColor()` / `ImGui.PopStyleColor()`
- `ImGui.PushStyleVar()` / `ImGui.PopStyleVar()`
- `ImGui.Begin()` / `ImGui.End()`
- `ImGui.BeginChild()` / `ImGui.EndChild()`

Migrating complex presentation modules to Dear ImGui would dramatically inflate code size:
- `src/client/canvas-ui/tactical-console.ts` is currently **240 lines** (safely under the 250-line target).
- Authoring the same layout with Dear ImGui bindings, push/pop color guards, cursor position calculations, and draw-list instrument calls would require **600 to 800 lines of TypeScript**.
- To satisfy the 300-line ceiling, engineers would be forced to fragment every UI panel into 3 to 4 micro-submodules. This artificial fragmentation increases repository complexity and file lookup latency for autonomous agents.

### 5.2 AI Context Window Inflation & Prompt Economics
*Aether & Soot* is engineered for autonomous AI development workflows using Antigravity agents and local LLM tooling (Hermes 3, Gemma 4, LFM 2.5). Under `AGENTS.md` Rule 1.4 (Output Economy), agents are strictly evaluated on token efficiency and precision:
1. **Token Inflation Factor**: Authoring and modifying ImGui UI components requires **300% to 500% more context tokens** than equivalent declarative Preact JSX components or `UiCellBuffer` procedural calls.
2. **Context Budget Consumption**: Expanding UI code with verbose ImGui push/pop boilerplate rapidly exhausts the active context window, crowding out architectural instructions, schema definitions, and system rules.

### 5.3 LLM Brittleness & Fatal WASM Assertion Crashes
Immediate-mode GUIs rely on rigorous stack balance:
- Every `PushID()` must have exactly one matching `PopID()`.
- Every `PushStyleColor(n)` must be paired with `PopStyleColor(n)`.
- Every `Begin()` that returns `true` must be paired with `End()`.

In code-generation benchmarks, Large Language Models frequently fail to maintain perfect stack pairing when refactoring code containing early returns, conditional branches, or exception handlers:
```typescript
// Common LLM refactoring bug: early return skips PopID/End
ImGui.PushID(actor.id);
if (!actor.isAlive) {
  return; // FATAL ERROR: Stack desynchronization! PopID() skipped!
}
ImGui.PopID();
```

In pure TypeScript (Preact or Canvas), an unhandled branch results in a visual glitch or a catchable JavaScript exception.
In Dear ImGui compiled to WebAssembly, a stack imbalance or missing `PopID()` triggers an uncatchable C++ runtime assertion:
```
RuntimeError: abort(Assertion failed: g.CurrentWindowStack.Size == 1) at Error
```
When this occurs:
- The entire WebAssembly module aborts and halts execution.
- The browser tab freezes or crashes completely.
- Headless autonomous playtesters (`npm run playtest`) deadlock and terminate with exit code `1`.
- Self-healing agent loops cannot recover from uncatchable WASM aborts.

### 5.4 Strict TypeScript Typing & Zero Untyped Boundaries
`AGENTS.md` Rule 2.3 strictly dictates:
> "`any`, `as unknown as`, and `@ts-ignore` / `@ts-expect-error` are FORBIDDEN."
> The project compiles with `"strict": true`, `"noUncheckedIndexedAccess": true`, and `"exactOptionalPropertyTypes": true`.

Available Dear ImGui WebAssembly bindings (`imgui-js`, `@flyover/imgui`, or emscripten ports) are notorious for weak, incomplete, or out-of-date TypeScript typings:
- Heavy reliance on `any` for pointers, callbacks, and user data.
- Missing discriminated unions for widget events.
- Incompatible type signatures that fail `tsc --noEmit`.

Bringing Dear ImGui bindings into strict compliance with *Aether & Soot*'s typing standards would require writing and maintaining thousands of lines of custom `.d.ts` declaration shims and runtime wrappers, creating a massive maintenance burden with zero gameplay return.

### 5.5 Destruction of Sub-Second Node.js Headless Testing
A primary engineering pillar of *Aether & Soot* is **sub-second automated verification** (`ARCHITECTURE.md` §1.1):
- The entire simulation test suite (113 test files, 590 tests) executes via Vitest in pure Node.js in **<19 seconds**, with individual unit tests executing in **<300ms**.
- This speed is possible because the simulation core (`src/sim/`) and schemas (`src/schemas/`) have zero browser, WebGL, or DOM dependencies.

If client presentation testing, HUD projection adapters, or layout formatting utilities link against Dear ImGui:
1. Vitest would be forced to load heavy WebAssembly binaries and emulate WebGL contexts in Node.js.
2. WebAssembly instantiation in Node.js environments requires asynchronous file system reads, custom memory loaders, and Canvas mock polyfills (`headless-gl` or `jsdom`).
3. This would instantly destroy the sub-second test cycle, slowing down agent verification runs and degrading continuous integration pipelines.

---

## 6. Implementation Architecture Comparison Matrix

The following multi-dimensional technical matrix contrasts the **Current Dual Presentation Architecture** against the **Proposed Dear ImGui WASM Architecture**:

| Architectural Dimension | Current Dual Architecture (`src/client/`) | Proposed Dear ImGui Architecture (WASM) | Evaluation Verdict |
| :--- | :--- | :--- | :--- |
| **Primary Paradigm** | Passive reactive projection (`UiCellBuffer` + Preact) | Continuous immediate-mode polling (60–120 FPS) | **Current Wins**: Turn-based simulation does not justify 60 FPS polling. |
| **State Mutation Model** | Strictly immutable `Readonly<WorldState>` -> `dispatchCommand()` | Native mutable pointers (`&variable`) -> requires staging proxy | **Current Wins**: Preserves event sourcing and headless determinism. |
| **FFI & Memory Boundary** | 100% native V8 JavaScript memory; zero FFI crossings | Continuous JSON/UTF-8 string marshalling into WASM heap | **Current Wins**: Zero GC churn; eliminates WASM linear memory overhead. |
| **WebGL Context Stability** | Native PixiJS v8 state management; zero state pollution | Raw GL calls clobber PixiJS VAO/VBO/shader state cache | **Current Wins**: Prevents WebGL state machine desynchronization. |
| **Post-Processing Compositing**| Direct integration with `SteampunkRenderPipeline` | Dilemma: Sterile overlay vs. distorted scissored FBO | **Current Wins**: Clean 4K text readability with selective CRT bloom. |
| **Character Cell Alignment** | Native 12x20px CP437 monospace cell quantization | Proportional layout engine; requires manual cursor positioning | **Current Wins**: Perfect Caves of Qud monospace aesthetic. |
| **Dual-Color Cell Support** | Native `fgColor` + `bgColor` per cell buffer entry | Text is single color; requires manual `AddRectFilled` quads | **Current Wins**: Half the vertex traffic; native terminal aesthetics. |
| **Victorian Instrumentation** | Procedural Bourdon dials, manometers, split-flap odometers | None; requires authoring low-level `ImDrawList` vector math | **Current Wins**: Existing instruments are modular, verified, and complete. |
| **Modularity & Line Ceilings**| Highly modular; all files <= 240 lines (under 300 ceiling) | Push/pop boilerplate inflates file sizes by 200–300% | **Current Wins**: Complies with automated governance gates. |
| **AI Token Economy** | Compact declarative syntax; minimal token consumption | Verbose imperative push/pop code; 300–500% token inflation | **Current Wins**: Conserves AI context window budget. |
| **Runtime Crash Resilience** | Graceful exception handling; DOM/Canvas error boundaries | Stack imbalance triggers uncatchable C++ `IM_ASSERT` WASM abort | **Current Wins**: Prevents autonomous playtester lockups. |
| **Type Safety Invariants** | Strict TypeScript (`noUncheckedIndexedAccess`, zero `any`) | Third-party bindings rely on untyped pointers and `any` | **Current Wins**: Zero untyped boundaries across codebase. |
| **Headless Test Velocity** | Pure Node.js Vitest runs in <300ms without browser mocks | Requires WASM loaders and WebGL emulators in Node.js | **Current Wins**: Preserves sub-second test-driven development. |

---

## 7. Decision Outcome & Strategic Roadmap

### 7.1 Formal Decision
**REJECT DEAR IMGUI MIGRATION FOR AETHER & SOOT.**

The proposal to migrate the presentation layer to Dear ImGui (via WebAssembly/bindings) is **rejected in its entirety**. Dear ImGui is fundamentally ill-suited for this repository’s architecture, visual identity, and autonomous AI development workflows.

### 7.2 Positive Consequences of Rejection
1. **Preservation of Headless Determinism**: The simulation core remains completely decoupled from presentation logic, maintaining bit-exact replayability and event-sourced causal history.
2. **Aesthetic Integrity**: The Edison-era Victorian terminal aesthetic (Caves of Qud style, zero Pip-Boy tropes) is preserved through the dedicated 12x20px CP437 character cell pipeline, custom analog gauges, and oxidized iron palette.
3. **Pristine 4K HDR Readability**: Text readouts in the tactical console remain isolated from spherical lens barrel distortion and chromatic aberration blur, ensuring crisp legibility on high-resolution displays.
4. **Stable AI Development & Playtesting**: Eliminating the risk of uncatchable WebAssembly assertion crashes ensures that autonomous playtester runs (`npm run playtest`) and AI agent workflows execute reliably without runtime tab freezes.
5. **Sub-Second Test Cycle**: The repository maintains its ultra-fast Node.js test execution cycle (<300ms unit tests, <20s full suite), enabling immediate feedback during engineering loops.

### 7.3 Acknowledged Tradeoffs & Foregone Benefits
1. **Lack of Generic Docking**: The rejected migration means developers cannot freely drag, float, or dock arbitrary UI windows across the screen. 
   - *Mitigation*: Roguelikes benefit from fixed, calibrated, diegetic console layouts rather than floating desktop windows. Modal interactions are cleanly handled by Preact drawers.
2. **Manual Scroll Containers**: Scrolling lists in the canvas console must be managed via integer offset math (`scrollOffset`) rather than ImGui's built-in scrollbars.
   - *Mitigation*: The `UiCellBuffer` already implements clean character-cell scroll offsets and scroll indicators (`▲`, `▼`).
3. **Dual Presentation Technology**: The team maintains both PixiJS/Canvas for the tactical console and Preact for complex dossiers and character generation.
   - *Mitigation*: Both technologies share the same TypeScript ecosystem, Zod schemas, and oxidized iron palette tokens (`src/client/canvas-ui/material-palette.ts`), ensuring cohesive aesthetics without WASM FFI overhead.

### 7.4 Strategic Roadmap: Evolution of the Ratified Dual Architecture
Following this rejection, presentation layer development will focus on deepening the ratified dual architecture:
1. **Canvas UI Console Expansion** (`src/client/canvas-ui/`):
   - Continue enhancing the 30-column tactical sidebar in `tactical-console.ts`.
   - Maintain the specialized gauge modules: `analog-gauges.ts` (Bourdon dials, Sanguine manometers, split-flap odometers), `console-satchel.ts` (satchel load registers), and `console-chronicle.ts` (pneumatic ticker log).
   - Enforce the 4-tier oxidized iron Z-depth palette: `DEEP_RUST`, `CHARCOAL`, `SULFUR_AMBER`, `VERDIGRIS`, `TARNISHED_BRASS`, `SOOT_BLACK`.
2. **Selective Shader Compositing** (`src/client/renderer/steampunk-pipeline.ts`):
   - Maintain layer isolation: apply volumetric gaslight, steam plumes, and spherical lens curvature to the tactical map (`WORLD_TACTICAL`), while applying only gentle phosphor bloom, scanlines, and Edison grain to the console (`CANVAS_UI_BUFFER`).
3. **Preact Overlay Harmonization** (`src/client/ui/`):
   - Ensure all Preact modal drawers (paperdoll dossiers, workbench crafting, mercantile storefronts) strictly utilize the oxidized iron palette and monospace typography, maintaining seamless visual parity with the canvas console.
