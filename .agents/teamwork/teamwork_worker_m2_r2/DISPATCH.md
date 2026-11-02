## 2026-11-01T23:13:54Z
Your role: Milestone 2 Simulation & Worldgen Worker (teamwork_worker)
Your working directory is: /Users/emmett/Desktop/Game/.agents/teamwork/teamwork_worker_m2_r2/

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

MANDATORY FIRST STEP:
Read the authoritative user request at:
/Users/emmett/Desktop/Game/.agents/teamwork/ORIGINAL_REQUEST.md
Also read the Project Index at:
/Users/emmett/Desktop/Game/.agents/teamwork/orchestrator_3/PROJECT.md
Read the three completed Explorer specification handoff reports:
- /Users/emmett/Desktop/Game/.agents/teamwork/teamwork_explorer_m2_r2_1/handoff.md (Urban District & Street Network)
- /Users/emmett/Desktop/Game/.agents/teamwork/teamwork_explorer_m2_r2_2/handoff.md (Sewer Topology & Mine Generation)
- /Users/emmett/Desktop/Game/.agents/teamwork/teamwork_explorer_m2_r2_3/handoff.md (Industrial Sector, Strata Portals & Test Spec)
And read the skill instructions at:
/Users/emmett/Desktop/Game/.agents/skills/sim-feature/SKILL.md

OBJECTIVE:
Implement Milestone 2: Multi-Stratum World Generation & Urban Street/Alley/Plaza District Layouts:
1. `src/sim/spatial/urban-district.ts`:
   - Implement hierarchical 3-tier street network: 3-wide primary avenue (y in [17, 19]), 2-wide secondary cross-streets (x in [15, 16] and [30, 31]), 1-wide service back-alleys (y=2 and y=33 with cobblestone and rubble), 7x7 central plaza (x in [21, 27], y in [15, 21]) with street manhole and fountain/clocktower monument.
   - Implement 6-parcel subdivision (width 13, height 11-12) accommodating all 6 building templates in `ALL_BUILDING_TEMPLATES` with minimum 1-tile setbacks.
   - Implement deterministic template stamping with rotation: Top parcels rotate 0° (South-facing onto avenue/plaza), bottom parcels rotate 180° (North-facing onto avenue/plaza), with 1-tile stitched corridors connecting doors to the street network.
   - Integrate `ensureDistrictConnectivity` ensuring 100% BFS pathfinding between central plaza, gates, and building entrance doors.
   - Keep file strictly <= 220 lines (target <= 250, hard ceiling 300).
2. `src/sim/spatial/sewer-topology.ts`:
   - Implement dual-channel conduit profiles: central `CANAL_SLUICE` (`liquidType: 'SLUICE_SLUDGE'`, `liquidVolumeMl: 2000`, `blocksMovement: true`) flanked by elevated `IRON_GRATE` inspection walkways (`blocksMovement: false`).
   - Implement regular crossover weir bridges (`IRON_GRATE`, `liquidType: 'SLUICE_SLUDGE'`, `liquidVolumeMl: 500`, `blocksMovement: false`) every 5-6 steps and at junctions, guaranteeing 100% BFS walkability between both walkway banks.
   - Implement 5x5 vaulted octagonal junction chambers (21 carved tiles) with perimeter `IRON_GRATE` walkways and central catch basins with iron maintenance ladders linking to surface manholes.
   - Seed miasma atmospheric gradients (`smokePpm: 120-220`, `steamPressureKpa: 15-35`).
   - Keep file strictly <= 220 lines (target <= 250, hard ceiling 300).
3. `src/sim/spatial/mines-generation.ts`:
   - Implement meandering drift shafts (1-2 tiles wide) following mineral veins through solid rock (`SOOT_BRICK_WALL`).
   - Implement room-and-pillar stopes with preserved `SOOT_BRICK_WALL` rock columns at `(cx ± 2, cy ± 2)` with full perimeter clearance.
   - Implement non-severing `TIMBER_STRUT` wall shoring (`blocksMovement: true`, `blocksSight: false`) along drift walls without obstructing passages.
   - Implement narrow-gauge `RAIL_TRACK` corridors with ore trolley containers (`CRATE` holding coal briquettes and brass gears).
   - Implement headframe vertical hoist shaft portal linking subterranean mine floor (under `CATACOMBS` depthLevel 1) to Undercroft/Street.
   - Keep file strictly <= 220 lines (target <= 250, hard ceiling 300).
4. `src/sim/spatial/industrial-district.ts`:
   - Implement heavy industrial sector: smelting hall with reverberatory furnace (`SMELTING_FURNACE`, slag pit trench, thermal halo), continuous `CONVEYOR_TRACK` run from feedstock hopper to ingot safe vault, multi-track rail spurs, monorail depot terminus, outdoor boiler yard with accumulator vessels (`PressureVesselComponent`).
   - Keep file strictly <= 220 lines (target <= 250, hard ceiling 300).
5. `src/sim/spatial/strata-portals.ts`:
   - Implement unified cross-stratum vertical portal pair generator (`createBidirectionalPortalPair`, `spawnStreetUndercroftManholePair`, `spawnStreetSpireElevatorPair`, `spawnStreetMineHoistPair`, `spawnUndercroftCatacombsStairsPair`, and `linkAllStrataPortals`).
   - Automatically guarantee portal landing cells are walkable (`blocksMovement === false`).
   - Keep file strictly <= 220 lines (target <= 250, hard ceiling 300).
6. Pipeline Integrations:
   - Hook the new modules into `src/sim/spatial/district-pipeline.ts`, `src/sim/spatial/district-pipeline-late.ts`, and `src/sim/spatial/district-pipeline-context.ts` (ensuring each pipeline file stays strictly under 250 lines).
7. Test Suite:
   - Create `tests/sim/multi-stratum-worldgen.test.ts` implementing the 4 test suites specified by Explorer 3:
     1. Multi-stratum generation & seed determinism across seeds 1000..1025.
     2. Heavy industrial sector fixtures, continuous conveyor runs, rail spurs, and boiler yard.
     3. Cross-stratum portal connectivity, coordinate alignment, and `USE_PORTAL` command execution.
     4. 100% BFS pathfinding walkability on Street, Undercroft, Spire, and Mine floors across 25+ seeds (2000..2025).
   - Ensure test file stays strictly under 260 lines (hard ceiling 300).

VERIFICATION REQUIREMENTS:
Run and verify:
1. `npm run check:boundaries` (must exit 0, all files <= 300 lines, zero forbidden tokens/imports).
2. `npm run typecheck` (must exit 0, zero TypeScript errors).
3. `npx vitest run tests/sim/multi-stratum-worldgen.test.ts` (all tests pass).
4. `npx vitest run tests/sim/building-templates.test.ts tests/sim/spatial-reachability.test.ts tests/sim/strata-dungeons.test.ts` (zero regressions).
