## 2026-11-02T00:33:21Z
You are the Milestone 3 Worker for Aether & Soot.
Your working directory is: /Users/emmett/Desktop/Game/.agents/teamwork/teamwork_worker_m3

MANDATORY INPUTS:
- Read ORIGINAL_REQUEST.md at: /Users/emmett/Desktop/Game/.agents/teamwork/ORIGINAL_REQUEST.md
- Read PROJECT.md at: /Users/emmett/Desktop/Game/.agents/teamwork/orchestrator_3/PROJECT.md
- Read Explorer 1 Report at: /Users/emmett/Desktop/Game/.agents/teamwork/teamwork_explorer_m3_1/handoff.md
- Read Explorer 2 Report at: /Users/emmett/Desktop/Game/.agents/teamwork/teamwork_explorer_m3_2/handoff.md
- Read Explorer 3 Report at: /Users/emmett/Desktop/Game/.agents/teamwork/teamwork_explorer_m3_3/handoff.md

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

EXCLUSIVE WRITE FILE OWNERSHIP:
You have exclusive write access to the following files:
1. `src/client/projection/layer-projection.ts` (NEW, target <= 140 lines)
   - Defines `GlyphLayerVisual`, `RenderCellLayers`, `classifyEntityLayer`, `composeLayersToVisualSpec`, and layer extraction helpers.
2. `src/client/projection/extended-box-drawing.ts` (NEW, target <= 190 lines)
   - Full 81-state CP437 box-drawing resolver mapping single-line interior partitions, double-line exterior walls, and mixed single/double T-junctions and cross-junctions cleanly.
3. `src/client/projection/frame-adapter.ts` (EDIT, keep <= 220 lines)
   - Populate `layers: RenderCellLayers` in `RenderCellFrame` using `layer-projection.ts` while maintaining `visual: VisualGlyphSpec` via `composeLayersToVisualSpec`.
4. `src/client/renderer/tactical-layer-composer.ts` (NEW, target <= 220 lines)
   - 5 dedicated PixiJS layer containers (`floor`, `fixture`, `item`, `actor`, `indicator`), 15,840 pre-allocated sprites (widescreen 88x36), zero render-loop allocations, fast hex color caching, and 4-tier oxidized iron depth-shading (`#2a221b`, `#524536`, `#8f7a62`, `#d4c2a5`).
5. `src/client/renderer/procedural-tileset.ts` (NEW, target <= 210 lines)
   - Zero-dependency procedural 2D canvas vector generator for 37 Victorian Steampunk tile keys with native headless Node mock (`Texture.WHITE`).
6. `src/client/renderer/tileset-manager.ts` (NEW, target <= 180 lines)
   - Visual mode governor for `CP437_ASCII`, `GRAPHICAL_TILESET`, and `HYBRID_OVERLAY` modes. Resolves layer visual requests into `{ texture, tint, alpha }` with seamless fallback to CP437 glyphs.
7. `src/client/renderer/glyph-stage.ts` (REFACTOR, reduce from 240 lines to <= 210 lines!)
   - Delegate tactical cell rendering to `TacticalLayerComposer` and `TilesetManager`.
8. `src/client/client-session-state.ts` (EDIT)
   - Add `visualRenderMode?: VisualRenderMode`.
9. `tests/sim/client-presentation-modes.test.ts` (NEW)
   - Deterministic unit tests covering:
     - `ProceduralTileset` headless initialization and tile key catalog validity.
     - `TilesetManager` state transitions and mode cycling (`CP437_ASCII -> GRAPHICAL_TILESET -> HYBRID_OVERLAY`).
     - Layer visual resolution across modes (pure ASCII, full tileset, hybrid overlay).
     - Extended box-drawing bitmask resolution across single, double, and mixed wall combinations.
     - `SteampunkRenderPipeline` tactical split uniform stability (`uTacticalSplit = 58/88`).

HARD CONSTRAINTS:
- Strict modularity: EVERY `.ts`/`.tsx` file MUST be <= 250 lines (hard ceiling 300 lines enforced by `npm run check:boundaries`).
- Strict headless separation: `src/sim/` and `src/schemas/` must NEVER import `src/client/`. Zero browser globals in sim. Zero `Math.random()` or `Date.now()`.
- Zero untyped boundaries: NO `any`, NO `as unknown as`, NO `@ts-ignore`.
- Zero-dependency canvas generator: Do NOT add npm packages or external image files.

VERIFICATION REQUIREMENTS:
Run the following commands and include full verbatim outputs in your handoff report:
1. `npm run check:boundaries`
2. `npm run typecheck`
3. `npx vitest run tests/sim/client-presentation-modes.test.ts`
4. `npm run verify`

Write your complete handoff report to:
`/Users/emmett/Desktop/Game/.agents/teamwork/teamwork_worker_m3/handoff.md`

When complete, send a message to the orchestrator with your summary.
