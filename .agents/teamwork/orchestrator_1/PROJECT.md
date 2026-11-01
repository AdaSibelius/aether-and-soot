# Project: Interface Utility Overhaul & Dear ImGui Feasibility Study

## Architecture
- Dual UI presentation: Diegetic Canvas Console (PixiJS v8 + `UiCellBuffer` in `src/client/canvas-ui/`) and HTML DOM fallback (`src/client/ui/`).
- 5-Layer Steampunk Render Pipeline in `src/client/renderer/steampunk-pipeline.ts`.
- GLSL post-processing in `src/client/renderer/diegetic-post-filter.ts`.
- Clinical ADR authored in `docs/adr/001-dear-imgui-feasibility.md`.

## Feature Inventory
| # | Feature | Description | Milestone | Source |
|---|---------|-------------|-----------|--------|
| 1 | Diegetic Atmospheric Stress Gauge | Unified gauge for internal strain load (kW) and ambient steam (kPa) + soot PPM | M1 | Survey |
| 2 | Diegetic Satchel Load Gauge | Compact mass/volume gauge and quick item readout in tactical console | M1 | Survey |
| 3 | Diegetic Pneumatic Ticker Chronicle | 3-4 line live action log in console so player has narrative feedback in canvas UI | M1 | Survey |
| 4 | Oxidized Iron Palette Stratification | Add DEEP_RUST, CHARCOAL, SULFUR_AMBER, VERDIGRIS, TARNISHED_BRASS, SOOT_BLACK 4-tier Z-depth in material-palette.ts | M1 | Survey |
| 5 | Heavy Block Framing & Caves of Qud Aesthetic | Double-line pipes, CP437 block characters, machined rivets, zero Pip-Boy tropes | M1 | Survey |
| 6 | 4K HDR Shader Compositing & Text Readability | Isolate canvas UI sidebar from post-filter distortion/scanline blur, await font loading | M1 | Survey |
| 7 | ADR: ECS Integration Friction | Analysis of unidirectional event-sourced dispatch vs mutable pointer immediate mode | M2 | Survey |
| 8 | ADR: WebGL Context Binding & Post-Processing Shaders | Analysis of PixiJS v8 state clobbering, lens curvature distortion of scissor rects | M2 | Survey |
| 9 | ADR: Aesthetic Compatibility & Styling Overhead | Overhead of CP437 font atlas, per-cell background quads, vector ImDrawList instruments | M2 | Survey |
| 10 | ADR: Token & AI Maintenance Cost | Token inflation, 300-line modularity ceiling, WASM assertion crash risk, headless test cycles | M2 | Survey |

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| 1 | M1: UI Utility & Aesthetic Refinement | Implement HUD restructuring (thermodynamic stress, inventory, health, block framing, oxidized iron palette, shader compositing) | none | DONE |
| 2 | M2: Dear ImGui Clinical ADR | Author comprehensive Clinical ADR in docs/adr/001-dear-imgui-feasibility.md addressing all 4 axes | M1 | IN_PROGRESS |

## Interface Contracts
### `src/client/canvas-ui/material-palette.ts`
- Exports ratified oxidized iron palette tokens: `DEEP_RUST`, `CHARCOAL`, `TARNISHED_BRASS`, `VERDIGRIS`, `SULFUR_AMBER`, `SOOT_BLACK`.
### `src/client/canvas-ui/tactical-console.ts`
- Renders 30-column console: bezel, odometers, Bourdon steam dial, Sanguine manometer, atmospheric stress gauge, wireframe paperdoll, compact satchel load, pneumatic ticker chronicle, optical vernier.
### `src/client/renderer/diegetic-post-filter.ts` & `steampunk-pipeline.ts`
- UI console area (x >= 58 cols) isolated from lens curvature, heat haze, and chromatic aberration blur.

## Code Layout
- `src/client/canvas-ui/`: `material-palette.ts`, `tactical-console.ts`, `analog-gauges.ts`, `console-chronicle.ts` (if extracted), `console-satchel.ts` (if extracted).
- `src/client/renderer/`: `diegetic-post-filter.ts`, `steampunk-pipeline.ts`.
- `src/client/ui/`: `index.html` CSS and `HudLayout.tsx`.
- `docs/adr/`: `001-dear-imgui-feasibility.md`.
