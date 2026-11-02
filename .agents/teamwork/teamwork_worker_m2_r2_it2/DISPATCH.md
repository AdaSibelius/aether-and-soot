## 2026-11-01T23:53:41Z
Your role: Milestone 2 Remediation Worker (teamwork_worker)
Your working directory is: /Users/emmett/Desktop/Game/.agents/teamwork/teamwork_worker_m2_r2_it2/

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

MANDATORY FIRST STEP:
Read the authoritative user request at:
/Users/emmett/Desktop/Game/.agents/teamwork/ORIGINAL_REQUEST.md
Also read the Project Index at:
/Users/emmett/Desktop/Game/.agents/teamwork/orchestrator_3/PROJECT.md
Read the three completed Explorer remediation reports:
- /Users/emmett/Desktop/Game/.agents/teamwork/teamwork_explorer_m2_it2_1/handoff.md (Industrial Furnace Corridor & Urban Pipeline Integration)
- /Users/emmett/Desktop/Game/.agents/teamwork/teamwork_explorer_m2_it2_2/handoff.md (Sewer Catch Basin & Mine Stope Pillar Clearances)
- /Users/emmett/Desktop/Game/.agents/teamwork/teamwork_explorer_m2_it2_3/handoff.md (Spire Platform, Pocket-Sealing & North Gate Corridors)
And inspect both adversarial test suites:
- `tests/sim/m2-challenger-invariants.test.ts`
- `tests/sim/m2-challenger-walkability.test.ts`

OBJECTIVE:
Apply the exact remediation fixes specified across the three Explorer reports to resolve all defects:
1. `src/sim/spatial/industrial-district.ts`:
   - Move the connecting avenue corridor to unobstructed column `ox + 5` and carve it BEFORE the smelting hall floor and 5x5 thermal halo are placed, removing the line 200 corridor that cut through the furnace. (See Explorer 1 handoff Section 4.1).
2. `src/sim/spatial/district-pipeline.ts`:
   - In Stage 3, carve North and South transit corridors from `ctx.center` to `ctx.northGatePos` and `ctx.southGatePos` when active.
   - In Stage 5, add `isUrbanDistrict(ctx.currDistrict)` predicate and dispatch `generateUrbanDistrict` for urban districts (like Whitechapel Ward), calling `fillUnbuiltYards` on parcels and `ensureDistrictConnectivity`, while preserving legacy typology placements for industrial districts. (See Explorer 1 handoff Section 4.2 and Explorer 3 handoff Diff 2).
3. `src/sim/spatial/sewer-topology.ts`:
   - In `carveDualChannelConduit`, check `const isLiquidSluice = c.liquidType !== 'NONE' && c.terrainType === 'CANAL_SLUICE'; if (c.blocksMovement && !isLiquidSluice)` so catch basin sumps are not converted to grates.
   - On walkway grates, explicitly set `liquidType: 'NONE'`, `liquidVolumeMl: 0`, and clamp `steamPressureKpa` to max 25. (See Explorer 2 handoff Section 4.1).
4. `src/sim/spatial/mines-generation.ts`:
   - Expand stope radius to 4 across all 3 stopes in `stopeDefs`.
   - Add a 1-tile clearance halo around all support pillars (`isPillarHalo = pillarOffsets.some(po => Math.abs(dx - po.dx) <= 1 && Math.abs(dy - po.dy) <= 1)`) so that all 8 perimeter tiles around every pillar are carved into walkable `SCORCHED_STONE`.
   - Guard `TIMBER_STRUT` placement: never place struts within the 8-cell perimeter ring of support pillars. (See Explorer 2 handoff Section 4.2).
5. `src/sim/spatial/landmark-micro-locations.ts`:
   - In `seedSpireGreenhouse`, preserve existing `BRASS_CATWALK` cells on the perimeter so spoke corridors crossing the greenhouse are not severed. (See Explorer 3 handoff Diff 1).
6. `src/sim/spatial/district-yards.ts`:
   - Make `punchPath` stratum-aware so that on `grid.stratum === 'SPIRE'`, it punches `BRASS_CATWALK`.
   - Export `sealOrphanedWalkableTiles(grid: StratumGrid, hub: Point2D): StratumGrid` using BFS flood-fill from `hub` to seal unreachable walkable floor/door tiles to `SOOT_BRICK_WALL` (Street/Undercroft) or `ABYSS_DROP` (Spire). (See Explorer 3 handoff Diff 3).
7. `src/sim/spatial/district-pipeline-late.ts`:
   - Add `{ x: 37, y: 7 }` to `spireTargets`.
   - Add and call `ensureCompassGateTransitCorridors(ctx)` to guarantee cardinal thoroughfares are 100% open floor.
   - Seal orphaned walkable floor pockets by calling `sealOrphanedWalkableTiles` on `street`, `spire`, and `undercroft` at the end of Stage 7. (See Explorer 3 handoff Diff 4).

VERIFICATION REQUIREMENTS:
Run and verify:
1. `npx vitest run tests/sim/m2-challenger-invariants.test.ts` (all 7/7 tests must pass).
2. `npx vitest run tests/sim/m2-challenger-walkability.test.ts` (all 6/6 tests must pass across seeds 3000..3100).
3. `npx vitest run tests/sim/multi-stratum-worldgen.test.ts` (all 4/4 tests must pass).
4. `npm run check:boundaries` (must exit 0; all modified files must be <= 250 lines, hard ceiling 300).
5. `npm run typecheck` (must exit 0 with zero errors).
6. `npm run verify` (all test files and gates green).

DELIVERABLE:
Write your completion handoff report to `/Users/emmett/Desktop/Game/.agents/teamwork/teamwork_worker_m2_r2_it2/handoff.md`. Include line counts (`wc -l`) and verbatim test outputs. Message the orchestrator when finished.
