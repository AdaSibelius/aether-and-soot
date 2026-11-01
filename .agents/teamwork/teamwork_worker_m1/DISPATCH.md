# Task Assignment: Worker — Milestone 1: UI Utility & Aesthetic Refinement Implementation

Read:
- `/Users/emmett/Desktop/Game/.agents/teamwork/ORIGINAL_REQUEST.md`
- `/Users/emmett/Desktop/Game/.agents/teamwork/orchestrator_1/PROJECT.md`
- `/Users/emmett/Desktop/Game/.agents/teamwork/teamwork_explorer_m1_1/handoff.md` (Console, gauges, satchel, chronicle blueprints)
- `/Users/emmett/Desktop/Game/.agents/teamwork/teamwork_explorer_m1_2/handoff.md` (Palette, depth stratification, CSS blueprints)
- `/Users/emmett/Desktop/Game/.agents/teamwork/teamwork_explorer_m1_3/handoff.md` (Shader split uTacticalSplit, font loading blueprints)
- `AGENTS.md` and `ARCHITECTURE.md`

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

Your Mission:
Implement all code changes for Milestone 1 directly in the repository according to the specifications in the Explorer handoff reports:

Part 1: Oxidized Iron Palette & Visual Depth
- `src/client/canvas-ui/material-palette.ts`: Ratify 6 oxidized iron tokens (DEEP_RUST #7A2E22, CHARCOAL #1B1F22, TARNISHED_BRASS #C5A059, VERDIGRIS #3D7E73, SULFUR_AMBER #E5A93C, SOOT_BLACK #0B0C0E), 4-tier Z-depth stratification hierarchy (Z0_TACTICAL_VOID, Z1_RECESS_WELL, Z2_MACHINED_CHASSIS, Z3_EMISSIVE_READOUT), and resolveVisualDepthTier.
- `src/client/canvas-ui/bezel-composer.ts`: Add tier options to BezelOptions and drawStructuralDivider.
- `index.html`: Update CSS with oxidized iron variables, double borders, corner rivet pseudo-elements.
- `tests/sim/oxidized-iron-palette.test.ts`: Create unit test suite.

Part 2: Tactical Console & Diegetic Gauges Overhaul
- `src/client/canvas-ui/console-satchel.ts`: Create new module (~80 lines) for compact satchel mass/vol bars and equipped item.
- `src/client/canvas-ui/console-chronicle.ts`: Create new module (~75 lines) for pneumatic ticker chronicle in typewriter ink gradient.
- `src/client/canvas-ui/analog-gauges.ts`: Append `drawAtmosphericBarometer` (strain load kW + ambient soot PPM + steam kPa).
- `src/client/canvas-ui/dossier-paperdoll.ts`: Append `renderCompactPaperdoll` (6-row wireframe).
- `src/client/canvas-ui/tactical-vernier.ts`: Append `renderCompactVernier` (4-row vernier).
- `src/client/canvas-ui/tactical-console.ts`: Restructure to master 36-row allocation using all sub-renderers.
- `tests/sim/tactical-console.test.ts`: Create unit test suite.

Part 3: 4K HDR Shader Compositing & Readability
- `src/client/renderer/shader-uniforms.ts`: Add `tacticalSplit` (default 58/88) and `uTacticalSplit`.
- `src/client/renderer/diegetic-post-filter.ts`: Update `DIEGETIC_FRAGMENT_SHADER` to bypass lens curvature, heat haze, chromatic aberration, bloom, scanlines, and vignette for `vTextureCoord.x >= uTacticalSplit`.
- `src/client/renderer/steampunk-pipeline.ts`: Add `setTacticalSplit` and `getTacticalSplit`.
- `src/client/renderer/glyph-atlas-extended.ts`: Prioritize "IBM Plex Mono" in font stack.
- `src/client/main.tsx`: Await `document.fonts.ready` before creating glyph stage.
- `tests/sim/phase54-shader-pipeline.test.ts`: Update test for tactical split.

CRITICAL CONSTRAINTS:
- `src/client/renderer/glyph-stage.ts` is FROZEN at 239 lines. DO NOT touch it!
- All files MUST remain <= 220 lines (hard ceiling 300 lines in `tests/scripts/check-boundaries.ts`).
- Execute `npm run verify` and ensure 0 errors (typecheck, boundaries, validate-data, test:sim).


## 2026-11-01T18:56:19Z
You are Worker M1 (UI Utility & Aesthetic Overhaul Implementation).
Your working directory is: /Users/emmett/Desktop/Game/.agents/teamwork/teamwork_worker_m1/
Read the mandatory files:
1. /Users/emmett/Desktop/Game/.agents/teamwork/ORIGINAL_REQUEST.md
2. /Users/emmett/Desktop/Game/.agents/teamwork/teamwork_worker_m1/DISPATCH.md
3. /Users/emmett/Desktop/Game/.agents/teamwork/orchestrator_1/PROJECT.md
4. /Users/emmett/Desktop/Game/.agents/teamwork/teamwork_explorer_m1_1/handoff.md
5. /Users/emmett/Desktop/Game/.agents/teamwork/teamwork_explorer_m1_2/handoff.md
6. /Users/emmett/Desktop/Game/.agents/teamwork/teamwork_explorer_m1_3/handoff.md
7. AGENTS.md, ARCHITECTURE.md, and skill /Users/emmett/Desktop/Game/.agents/skills/feature-recipe/SKILL.md

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

Execute the implementation directly in the repository following the blueprints in the three explorer handoffs:
1. Material palette & depth stratification in src/client/canvas-ui/material-palette.ts and bezel-composer.ts, and index.html CSS.
2. Tactical console overhaul: console-satchel.ts, console-chronicle.ts, analog-gauges.ts, dossier-paperdoll.ts, tactical-vernier.ts, and tactical-console.ts.
3. Shader compositing & 4K readability: shader-uniforms.ts, diegetic-post-filter.ts, steampunk-pipeline.ts, glyph-atlas-extended.ts, and main.tsx.
4. Unit tests: tests/sim/oxidized-iron-palette.test.ts, tests/sim/tactical-console.test.ts, update phase54-shader-pipeline.test.ts.
5. Run `npm run verify` to confirm 0 errors across all 4 gates.
6. Guard: DO NOT modify src/client/renderer/glyph-stage.ts (239 lines). Keep all modified/new files <= 220 lines.

Write your completion report to:
/Users/emmett/Desktop/Game/.agents/teamwork/teamwork_worker_m1/handoff.md
When done, notify me via send_message with build/test results.
