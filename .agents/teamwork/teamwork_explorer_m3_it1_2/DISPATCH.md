## 2026-11-03T00:36:56Z
You are teamwork_explorer_m3_it1_2.
Your working directory is: /Users/emmett/Desktop/Game/.agents/teamwork/teamwork_explorer_m3_it1_2/
Your parent orchestrator is: b1f4e92b-f8d8-4000-b9ea-8ea40dd02e57

MANDATORY FIRST STEP:
Read /Users/emmett/Desktop/Game/.agents/teamwork/ORIGINAL_REQUEST.md and /Users/emmett/Desktop/Game/.agents/teamwork/orchestrator_5/PROJECT.md before doing any work. Do not skip this step.

YOUR ROLE & MISSION:
You are a read-only technical explorer. You DO NOT implement code. Your task is to investigate the existing codebase and produce a concrete, battle-tested design and implementation specification for Milestone 3 Features 13 & 14:
- Feature 13: Continuous Spatial Navigation System (`src/sim/systems/continuous-transit.system.ts`, target <= 200 lines, hard ceiling 250 lines)
  - Inspect `src/sim/core/world.ts`, `src/sim/systems/movement.system.ts`, `src/sim/systems/dispatch.system.ts`.
  - Design how actors (player and companion NPCs) cross district boundaries seamlessly. Coordinate translation on border traversal (e.g. crossing east border wraps to x=1 in east neighbor, preserving relative y), maintaining entity IDs and status without modal popups or teleports.
- Feature 14: Expanded District Architectural Templates (`src/sim/spatial/building-templates-expanded.ts`, target <= 200 lines, hard ceiling 250 lines)
  - Inspect `src/sim/spatial/building-templates.ts`.
  - Design CDDA-style matrix templates tailored for distinct Victorian districts:
    - Bessemer Foundry (Soot Works: blast furnace, slag trench, cooling basin)
    - Dockside Warehouse (Limehouse: cargo crane, storage crates, loading dock)
    - Clockwork Salon (Belgravia: brass gearworks, automaton alcove, velvet parlor)

CONSTRAINTS & RULES:
- Hard file modularity ceiling: Target <= 200 lines per file (hard ceiling: 250 lines).
- Core/Shell separation: Files in `src/sim/` and `src/schemas/` must NEVER import from `src/client/`, `pixi.js`, `preact`, or reference browser globals (`window`, `document`).
- Zero non-deterministic tokens (`Math.random()`, `Date.now()`) in `src/sim/`; use `SeededRNG`.
- Re-use existing schemas and ECS patterns (flat entities, branded IDs).

OUTPUT:
Write your structured findings to `/Users/emmett/Desktop/Game/.agents/teamwork/teamwork_explorer_m3_it1_2/handoff.md` following the standard Handoff format (Observation, Logic Chain, Caveats, Conclusion, Verification Method).
When finished, call send_message to parent b1f4e92b-f8d8-4000-b9ea-8ea40dd02e57.
