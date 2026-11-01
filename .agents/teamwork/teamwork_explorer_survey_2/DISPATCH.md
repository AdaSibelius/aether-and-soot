# Task Assignment: Survey Explorer 2 - Palette, Shaders & Compositing

Read:
- `/Users/emmett/Desktop/Game/.agents/teamwork/ORIGINAL_REQUEST.md`
- Codebase files in `src/client/renderer/`, `src/client/shaders/`, `src/client/ui/`, styling/CSS files
- `ARCHITECTURE.md` and `AGENTS.md`

Your Mission:
Investigate the rendering, shader compositing, and visual hierarchy:
1. Identify all WebGL shaders in `src/client/renderer/` or `src/client/shaders/` (e.g., aether bloom, volumetric smoke, post-processing filters).
2. How the UI layer (DOM, canvas, or PIXI containers) overlays or composites with the WebGL rendering context.
3. Identify existing palette definitions (oxidized iron palette: deep rust, charcoal, tarnished brass, verdigris, sulfur amber, soot black) and how depth separation between tactical map, log window, and status readouts is currently handled vs. how it can be deepened.
4. Assess font rendering, scaling, text readability at 4K HDR resolution, and contrast against shader bloom/smoke.
5. Check line counts of affected files against the 300-line modularity ceiling.
6. Output your detailed survey report to `/Users/emmett/Desktop/Game/.agents/teamwork/teamwork_explorer_survey_2/handoff.md`.
## 2026-11-01T18:37:49Z
Sender: 61239d6e-5e21-48a8-8b66-444d6753c37e
Message:
You are Survey Explorer 2 (Palette, Shaders & Compositing).
Your working directory is: /Users/emmett/Desktop/Game/.agents/teamwork/teamwork_explorer_survey_2/
Read the mandatory files:
1. /Users/emmett/Desktop/Game/.agents/teamwork/ORIGINAL_REQUEST.md
2. /Users/emmett/Desktop/Game/.agents/teamwork/teamwork_explorer_survey_2/DISPATCH.md
3. AGENTS.md and ARCHITECTURE.md in project root.

Investigate:
- All WebGL shaders (aether bloom, volumetric smoke, post-processing filters) in src/client/.
- How the UI layer (DOM/canvas/Pixi) overlays or interacts with WebGL rendering.
- Oxidized iron palette (deep rust, charcoal, tarnished brass, verdigris, sulfur amber, soot black) across tactical map, log window, and status readouts.
- Font rendering and readability on 4K HDR displays without being washed out by shader bloom/smoke.
- Line counts of all affected files against the 300-line modularity ceiling.

Write your comprehensive findings and handoff report to:
/Users/emmett/Desktop/Game/.agents/teamwork/teamwork_explorer_survey_2/handoff.md
When done, notify me via send_message with a brief summary and the path to your handoff.md.
