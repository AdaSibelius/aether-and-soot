## 2026-11-01T20:57:51Z
You are teamwork_explorer (M2 Industrial & Pipeline Architect).
Your working directory is: /Users/emmett/Desktop/Game/.agents/teamwork/teamwork_explorer_m2_r2_3/

MANDATORY FIRST STEP:
Read the authoritative user request at:
/Users/emmett/Desktop/Game/.agents/teamwork/ORIGINAL_REQUEST.md
Also read the Project Index at:
/Users/emmett/Desktop/Game/.agents/teamwork/orchestrator_2/PROJECT.md
Reference the Survey report at:
/Users/emmett/Desktop/Game/.agents/teamwork/teamwork_explorer_survey_r2_2/handoff.md
And reference Milestone 1 deliverables.

OBJECTIVE:
Investigate and design `src/sim/spatial/industrial-district.ts`, `src/sim/spatial/strata-portals.ts`, pipeline integration in `district-pipeline.ts`, and test specifications for Milestone 2:
1. Heavy Industrial Sector Generation (`src/sim/spatial/industrial-district.ts`):
   - Industrial lot subdivision: smelting halls with reverberatory furnaces (`SMELTING_FURNACE`, slag pit trenches, high radiant heat/smoke halos).
   - Continuous conveyor runs (`CONVEYOR_TRACK`) moving feedstock between hoppers and ingot strongrooms.
   - Rail spurs (`RAIL_TRACK`) and freight monorail depot terminus (`monorail_car_street_depot`).
   - High-pressure boiler yards with accumulator vessels (`PressureVesselComponent`), overhead steam arches, and anthracite bunkers.
2. Cross-Stratum Portals & Pipeline Integration (`src/sim/spatial/strata-portals.ts`):
   - Unified vertical portal generation across strata: street manholes <-> undercroft sewer junction ladders; street freight headframe <-> subterranean mine hoist; surface grand elevator <-> spire catwalks.
   - Integration into the 8-stage district pipeline (`src/sim/spatial/district-pipeline.ts` / `district-pipeline-late.ts`).
3. Walkability Invariants & Non-Severing Verification:
   - Spanning tree backbone connection before secondary features are seeded.
   - Non-severing feature placement check (`canPlaceWithoutSevering`).
   - Isolated pocket elimination (`fillUnbuiltYards` / pocket-sealing).
   - BFS walkability enforcement (`ensureDistrictConnectivity`).
4. Unit Test Specifications:
   - Design `tests/sim/multi-stratum-worldgen.test.ts` verifying all 4 stratum generations, portal connectivity, and 100% walkability across 25+ seeds.
5. Modularity:
   - Ensure all new/updated modules remain strictly <= 220 lines (target <= 250, hard ceiling 300).

DELIVERABLE:
Write a concrete specification report to `/Users/emmett/Desktop/Game/.agents/teamwork/teamwork_explorer_m2_r2_3/handoff.md` with:
- Exact architecture for industrial district generation and strata portals
- Pipeline integration points in `district-pipeline.ts`
- Vitest test suite structure and assertions
When done, message the orchestrator with the completion status and report path. Do NOT modify source code or run build/test commands.
