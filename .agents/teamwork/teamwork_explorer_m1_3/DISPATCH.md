# Task Assignment: M1 Explorer 3 — Shader Compositing & 4K HDR Readability

Read:
- `/Users/emmett/Desktop/Game/.agents/teamwork/ORIGINAL_REQUEST.md`
- `/Users/emmett/Desktop/Game/.agents/teamwork/orchestrator_1/PROJECT.md`
- `/Users/emmett/Desktop/Game/.agents/teamwork/teamwork_explorer_survey_2/handoff.md`
- `src/client/renderer/steampunk-pipeline.ts`
- `src/client/renderer/diegetic-post-filter.ts`
- `src/client/renderer/glyph-stage.ts`
- `tests/sim/phase54-shader-pipeline.test.ts`
- `AGENTS.md` and `ARCHITECTURE.md`

Your Mission:
Formulate an exact, implementation-ready code blueprint and diff specification for the Worker:
1. Isolate the UI console area (columns 58..87, UV x >= 58.0 / 88.0) from spherical lens curvature, thermodynamic heat haze, and chromatic aberration:
   - Determine whether to add a `uTacticalSplit` uniform or pass boundary check in `DIEGETIC_FRAGMENT_SHADER`, or attach `postFilter` to `worldTacticalContainer` and `gaslightLightingContainer`.
   - Ensure `tests/sim/phase54-shader-pipeline.test.ts` continues to pass 100%.
2. 4K HDR text legibility:
   - Address font loading and ensure scanline/bloom parameters do not blur small 12x20px character cells in the console.
3. Modularity check:
   - `glyph-stage.ts` is at 239 lines. Do NOT add new lines to `glyph-stage.ts`. Keep `steampunk-pipeline.ts` (126 lines) and `diegetic-post-filter.ts` (166 lines) <= 220 lines.
4. Output your detailed plan to `/Users/emmett/Desktop/Game/.agents/teamwork/teamwork_explorer_m1_3/handoff.md`.

## 2026-11-01T18:48:13Z
You are M1 Explorer 3 (Shader Compositing & 4K HDR Readability).
Your working directory is: /Users/emmett/Desktop/Game/.agents/teamwork/teamwork_explorer_m1_3/
Read the mandatory files:
1. /Users/emmett/Desktop/Game/.agents/teamwork/ORIGINAL_REQUEST.md
2. /Users/emmett/Desktop/Game/.agents/teamwork/teamwork_explorer_m1_3/DISPATCH.md
3. /Users/emmett/Desktop/Game/.agents/teamwork/orchestrator_1/PROJECT.md
4. /Users/emmett/Desktop/Game/.agents/teamwork/teamwork_explorer_survey_2/handoff.md
5. src/client/renderer/steampunk-pipeline.ts, diegetic-post-filter.ts, and tests/sim/phase54-shader-pipeline.test.ts

Design the exact implementation blueprint for:
- Isolating the UI sidebar (x >= 58 cols / UV x >= 58.0 / 88.0) from lens curvature, heat haze, and chromatic aberration blur.
- Ensuring text remains razor sharp on 4K HDR displays.
- Preserving 100% pass rate in tests/sim/phase54-shader-pipeline.test.ts and all verification tests.
- Guarding line counts: glyph-stage.ts (239 lines) MUST NOT be modified; keep pipeline and filter files <= 220 lines (300 ceiling).

Write your detailed blueprint and handoff report to:
/Users/emmett/Desktop/Game/.agents/teamwork/teamwork_explorer_m1_3/handoff.md
When done, notify me via send_message.
