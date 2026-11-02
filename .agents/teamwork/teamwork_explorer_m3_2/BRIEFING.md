# BRIEFING — 2026-11-02T00:31:00Z

## Mission
Investigate and design Feature 3 (Tactical Layer Composer & Layered Sprite Pooling) for Milestone 3, ensuring zero render allocations, 5 visual layers per cell, depth shading, and keeping glyph-stage.ts <= 250 lines.

## 🔒 My Identity
- Archetype: explorer
- Roles: Tactical Layer Composer & Sprite Pooling Architect
- Working directory: /Users/emmett/Desktop/Game/.agents/teamwork/teamwork_explorer_m3_2
- Original parent: 601ac16f-482f-4000-b0b1-e97361589e3d
- Milestone: Milestone 3 (Enhanced CP437 Glyphs & Graphical Tileset Presentation)

## 🔒 Key Constraints
- Read-only investigation — do NOT implement
- Target <= 250 lines per file; hard ceiling 300 lines
- Zero untyped boundaries (`any`, `as unknown as`, `@ts-ignore` are forbidden)
- Core/Shell separation: client rendering must consume `RenderCellFrame`, never mutate `WorldState`
- Zero allocation during render loops (pre-allocated pool of Pixi Text / Sprite objects or BitmapText)
- Proper Z-depth ordering and depth-shading using Victorian Steampunk 4-tier oxidized iron palette (`#2a221b`, `#524536`, `#8f7a62`, `#d4c2a5`)

## Current Parent
- Conversation ID: 601ac16f-482f-4000-b0b1-e97361589e3d
- Updated: 2026-11-02T00:26:04Z

## Investigation State
- **Explored paths**:
  - `src/client/renderer/glyph-stage.ts` (240 lines)
  - `src/client/renderer/steampunk-pipeline.ts` (139 lines)
  - `src/client/renderer/glyph-atlas.ts` (102 lines) & `glyph-atlas-extended.ts` (114 lines)
  - `src/client/renderer/glyph-stage-types.ts` (11 lines)
  - `src/client/renderer/performance-governor.ts` (115 lines)
  - `src/client/canvas-ui/material-palette.ts` (140 lines)
  - `src/client/projection/frame-adapter.ts` (197 lines)
  - `tests/sim/m1-challenger-shader-palette.test.ts` (197 lines)
- **Key findings**:
  - `glyph-stage.ts` is at 240 lines, 10 lines from 250-line target and near 300-line ceiling.
  - Extracting tactical grid sprite management to `TacticalLayerComposer` reduces `glyph-stage.ts` by ~33 lines to ~207 lines.
  - Designing `TacticalLayerComposer` with 5 discrete layer containers (`floor`, `fixture`, `item`, `actor`, `indicator`) guarantees Z-depth ordering in the scene graph without per-frame sorting.
  - Pre-allocating 5 * W * H sprites (15,840 sprites for 88x36 widescreen grid) with fixed positions takes ~3.1 MB RAM and achieves strict zero-allocation in render loops.
  - Setting `sprite.visible = false` on empty layers allows PixiJS v8 batch renderer to skip them, submitting only ~3,200-4,000 active sprites per frame (~80% reduction in vertex submissions).
  - Fast hex color cache (`fastHexColor`) eliminates string slicing and `parseInt` in render loops.
  - PixiJS `Container` and `Sprite` work in headless Node without DOM canvas when using mock atlas textures (`Texture.WHITE`), enabling comprehensive Vitest unit testing.
- **Unexplored areas**: None within Feature 3 scope.

## Key Decisions Made
- Architecture: 5 discrete `Container` objects inside `rootContainer`, child of `worldTacticalContainer`.
- Ordering: Floor (0) -> Fixture (1) -> Item (2) -> Actor (3) -> Indicator (4).
- Shading: 4-tier oxidized iron palette constants (`TIER_0_FLOOR: 0x2a221b`, `TIER_1_FIXTURE: 0x524536`, `TIER_2_ITEM: 0x8f7a62`, `TIER_3_ACTOR: 0xd4c2a5`).
- Backward compatibility: If `cell.layers` is undefined, fall back to legacy single-glyph rendering on floor layer with other layers invisible.
- Integration hook: `TilesetTextureResolver` interface connects to Explorer 3's `TilesetManager`.

## Artifact Index
- DISPATCH.md — Received instructions
- BRIEFING.md — Working memory and context index
- progress.md — Heartbeat and progress tracker
- handoff.md — Final 5-component handoff report
