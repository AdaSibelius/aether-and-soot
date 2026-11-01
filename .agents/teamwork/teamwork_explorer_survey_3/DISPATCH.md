# Task Assignment: Survey Explorer 3 - ECS State Mapping & Dear ImGui Feasibility

Read:
- `/Users/emmett/Desktop/Game/.agents/teamwork/ORIGINAL_REQUEST.md`
- `src/sim/core/world.ts`, `src/sim/core/engine.ts`, `src/schemas/`, `src/client/projection/` or visual frame adapters
- `ARCHITECTURE.md` and `AGENTS.md`

Your Mission:
Investigate ECS architecture and Dear ImGui feasibility for Phase 2 ADR:
1. Examine how ECS state (entities, components, health, thermodynamic stress, inventory, turns, events) is structured and how `src/client/` accesses or projects it.
2. Analyze the technical friction of mapping this ECS data to an Immediate Mode GUI (Dear ImGui via WebAssembly/bindings): state lifecycle, cache invalidation, frame budget, WASM boundary marshalling.
3. Investigate WebGL context binding: how Dear ImGui would bind to the existing canvas/WebGL context and interact with custom post-processing shaders (aether bloom, smoke).
4. Quantify aesthetic compatibility: custom styling overhead, font atlas generation for Victorian ASCII glyphs, Edison gauge rendering in ImGui.
5. Quantify token and maintenance cost: complexity for AI agents maintaining ImGui WASM bindings, build pipeline impact, type definitions, and tooling overhead.
6. Output your detailed survey report to `/Users/emmett/Desktop/Game/.agents/teamwork/teamwork_explorer_survey_3/handoff.md`.

## 2026-11-01T18:37:57Z
You are Survey Explorer 3 (ECS State Mapping & Dear ImGui Feasibility).
Your working directory is: /Users/emmett/Desktop/Game/.agents/teamwork/teamwork_explorer_survey_3/
Read the mandatory files:
1. /Users/emmett/Desktop/Game/.agents/teamwork/ORIGINAL_REQUEST.md
2. /Users/emmett/Desktop/Game/.agents/teamwork/teamwork_explorer_survey_3/DISPATCH.md
3. src/sim/core/world.ts, src/sim/core/engine.ts, src/schemas/, and client projection files.
4. AGENTS.md and ARCHITECTURE.md in project root.

Investigate the feasibility of Dear ImGui (via WebAssembly/bindings) for Aether & Soot to support the clinical Architectural Decision Record (ADR):
- ECS Integration: Technical friction of mapping ECS data (flat entity records, components, queries, thermodynamic stress, inventory, turns, events) to an Immediate Mode GUI paradigm.
- Rendering Pipeline: How ImGui will bind to the existing WebGL context and handle custom post-processing shaders (bloom, smoke).
- Aesthetic Compatibility: Custom styling and font rendering overhead required to force ImGui to match heavy ASCII/Victorian terminal aesthetic.
- Token/Performance Cost: Maintenance complexity and token cost for AI agents working in this codebase with ImGui bindings.

Write your comprehensive findings and handoff report to:
/Users/emmett/Desktop/Game/.agents/teamwork/teamwork_explorer_survey_3/handoff.md
When done, notify me via send_message with a brief summary and the path to your handoff.md.
