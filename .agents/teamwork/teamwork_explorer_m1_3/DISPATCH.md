## 2026-11-01T20:23:58Z

You are teamwork_explorer (M1 Template & Stamping Architect).
Your working directory is: /Users/emmett/Desktop/Game/.agents/teamwork/teamwork_explorer_m1_3/

MANDATORY FIRST STEP:
Read the authoritative user request at:
/Users/emmett/Desktop/Game/.agents/teamwork/ORIGINAL_REQUEST.md
Also read the Project Index at:
/Users/emmett/Desktop/Game/.agents/teamwork/orchestrator_2/PROJECT.md
And reference the Survey Report at:
/Users/emmett/Desktop/Game/.agents/teamwork/teamwork_explorer_survey_r2_3/handoff.md

OBJECTIVE:
Investigate and design `src/sim/spatial/building-templates.ts` and `src/sim/spatial/template-instantiator.ts` for Milestone 1:
1. `src/sim/spatial/building-templates.ts`:
   - Declarative `BuildingTemplate` matrix definitions for:
     * Victorian Tavern (`building_victorian_tavern`) — public bar, private snug, scullery, cellar hatch
     * Constabulary Office (`building_constabulary_station`) — charge desk, barred holding cells, inspector's office, evidence safe
     * Tenement House (`building_tenement_house`) — central corridor, living flats, scullery, cellar drop
     * Apothecary Clinic (`building_apothecary_clinic`)
     * Clockwork Artisan Workshop (`building_artisan_workshop`)
     * Steam Boilerhouse (`building_steam_boilerhouse`)
2. `src/sim/spatial/template-instantiator.ts`:
   - Algorithm `instantiateTemplateIntoGrid(grid, entities, template, placement, rng)`:
     * Matrix transformation: 4-directional rotation (0, 90, 180, 270) and mirroring (`mirrorX`, `flipY`)
     * Tile stamping: applying terrain, interiorZone, and physical properties to `StratumGrid.cells`
     * Fixture spawning: instantiating entities via `fixture-catalog.ts` with correct `PositionComponent`
     * Door alignment: ensuring exterior doors connect to streets and face outward
     * Invariant check: ensuring BFS walkability (`hasWalkablePath`) from entrance door to all interior rooms
3. Unit Test Design:
   - Design test specifications for `tests/sim/building-templates.test.ts` verifying multi-seed determinism, fixture placement, and path reachability across 25+ seeds.
4. Modularity:
   - Ensure both `building-templates.ts` and `template-instantiator.ts` remain strictly under 220 lines (target <= 250, hard ceiling 300).

DELIVERABLE:
Write a concrete specification report to `/Users/emmett/Desktop/Game/.agents/teamwork/teamwork_explorer_m1_3/handoff.md` with:
- Complete template matrix records and legend mappings
- Step-by-step stamping and orientation algorithm
- Vitest test suite structure and assertions
When done, message the orchestrator with the completion status and report path. Do NOT modify source code or run build/test commands.
