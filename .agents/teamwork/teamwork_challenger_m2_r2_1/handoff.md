# Milestone 2 Challenge Report: Walkability & Multi-Seed Determinism

**Verdict: REJECT**

---

## 1. Observation

Direct execution of the adversarial stress test suite in `tests/sim/m2-challenger-walkability.test.ts` (185 lines, verified compliant with modularity and boundary checks via `npm run check:boundaries` across 425 files) over 101 pseudo-random seeds (`seeds 3000..3100`) reveals three distinct failure modes in the Milestone 2 generation implementation:

### 1.1 Vitest Execution Output (`npx vitest run tests/sim/m2-challenger-walkability.test.ts`)
```
 RUN  v2.1.9 /Users/emmett/Desktop/Game

 ❯ tests/sim/m2-challenger-walkability.test.ts (6) 15989ms
   ❯ Milestone 2 Adversarial Walkability & Determinism Challenge (Seeds 3000..3100) (6) 15989ms
     ✓ verifies bit-exact multi-seed regeneration across seeds 3000..3100 4884ms
     ✓ verifies 100% BFS reachability from plaza manhole to building entrance doors 2599ms
     ✓ verifies 100% BFS reachability from Undercroft ladder to sewer quadrant extremities and siphons 2129ms
     × verifies 100% BFS reachability from Spire lift landing to all catwalk platforms 2091ms
     × verifies zero orphaned or unreachable walkable floor pockets across all strata 2220ms
     × verifies 100% BFS reachability from central plaza manhole to all four compass gates (West, East, North, South) 2063ms

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯ Failed Tests 3 ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯

 FAIL  tests/sim/m2-challenger-walkability.test.ts > Milestone 2 Adversarial Walkability & Determinism Challenge (Seeds 3000..3100) > verifies 100% BFS reachability from Spire lift landing to all catwalk platforms
AssertionError: expected [ …(3) ] to deeply equal []

- Expected
+ Received

- Array []
+ Array [
+   "Seed 3016: Spire platform (37,7) unreachable from lift (41,18)",
+   "Seed 3019: Spire platform (37,7) unreachable from lift (41,19)",
+   "Seed 3050: Spire platform (37,7) unreachable from lift (42,18)",
+ ]

 ❯ tests/sim/m2-challenger-walkability.test.ts:135:22

 FAIL  tests/sim/m2-challenger-walkability.test.ts > Milestone 2 Adversarial Walkability & Determinism Challenge (Seeds 3000..3100) > verifies zero orphaned or unreachable walkable floor pockets across all strata
AssertionError: expected [ …(64) ] to deeply equal []

- Expected
+ Received

- Array []
+ Array [
+   "Seed 3000: STREET has 29 orphaned tiles (e.g. (16,31))",
+   "Seed 3001: STREET has 5 orphaned tiles (e.g. (14,29))",
+   "Seed 3002: STREET has 27 orphaned tiles (e.g. (16,5))",
+   "Seed 3004: STREET has 8 orphaned tiles (e.g. (32,7))",
+   "Seed 3005: STREET has 16 orphaned tiles (e.g. (28,31))",
+   "Seed 3008: STREET has 2 orphaned tiles (e.g. (21,31))",
+   "Seed 3011: STREET has 11 orphaned tiles (e.g. (32,1))",
+   "Seed 3012: STREET has 73 orphaned tiles (e.g. (45,26))",
+   "Seed 3013: STREET has 50 orphaned tiles (e.g. (30,31))",
+   "Seed 3014: STREET has 1 orphaned tiles (e.g. (15,6))",
+   "Seed 3015: STREET has 15 orphaned tiles (e.g. (16,31))",
+   "Seed 3016: STREET has 41 orphaned tiles (e.g. (15,31))",
+   "Seed 3016: SPIRE has 27 orphaned tiles (e.g. (35,5))",
+   "Seed 3017: STREET has 25 orphaned tiles (e.g. (16,31))",
+   "Seed 3018: STREET has 26 orphaned tiles (e.g. (31,31))",
+   "Seed 3019: STREET has 61 orphaned tiles (e.g. (16,31))",
+   "Seed 3019: SPIRE has 28 orphaned tiles (e.g. (35,5))",
+   "Seed 3020: STREET has 54 orphaned tiles (e.g. (15,31))",
+   ... (46 additional seeds failing with orphaned walkable tiles)
+ ]

 ❯ tests/sim/m2-challenger-walkability.test.ts:159:22

 FAIL  tests/sim/m2-challenger-walkability.test.ts > Milestone 2 Adversarial Walkability & Determinism Challenge (Seeds 3000..3100) > verifies 100% BFS reachability from central plaza manhole to all four compass gates (West, East, North, South)
AssertionError: expected [ Array(1) ] to deeply equal []

- Expected
+ Received

- Array []
+ Array [
+   "Seed 3073: North gate (24,1) unreachable",
+ ]

 ❯ tests/sim/m2-challenger-walkability.test.ts:183:22

 Test Files  1 failed (1)
      Tests  3 failed | 3 passed (6)
   Duration  16.83s
```

### 1.2 Pipeline Disconnect Observation
Inspection of `src/sim/spatial/generator.ts` and `src/sim/spatial/district-pipeline.ts`:
- `generateUrbanDistrict` is declared in `src/sim/spatial/urban-district.ts` (204 lines) and re-exported in `src/sim/spatial/district-pipeline.ts` (line 27).
- However, `generateVictorianDistrict` in `src/sim/spatial/generator.ts` does NOT invoke `generateUrbanDistrict`. It continues executing the Phase 48 legacy pipeline (`executeStage1TopologyHydrology` through `executeStage8EmergenceAtmosphericSeeding`).
- In `src/sim/spatial/district-pipeline.ts` (line 121), Stage 5 still calls `applyTypologyPlacements` and `fillUnbuiltYards`.
- Consequently, all new CDDA parcel subdivisions and urban street networks created by the worker are orphaned from the main game generation pipeline.

---

## 2. Logic Chain

### 2.1 Spire Catwalk Platform Reachability Failure (Seeds 3016, 3019, 3050)
1. In `src/sim/spatial/spire-topology.ts` (lines 53–60), canonical catwalk tower platforms are carved at `(10, 7)`, `(10, 28)`, `(37, 28)`, `(37, 7)`, and connected to `hub` via `carveSpoke`.
2. In `src/sim/spatial/district-pipeline-late.ts` (lines 19–23), `seedSpireGreenhouse` is stamped onto `ctx.spire` immediately following Spire generation.
3. In `src/sim/spatial/landmark-micro-locations.ts` (lines 95–114), `seedSpireGreenhouse` places a 5x5 conservatory box with `GLASS_WINDOW` perimeter walls (`blocksMovement: true`) offset from the lift. In seeds 3016, 3019, and 3050, this greenhouse box sits squarely across the diagonal spoke corridor connecting the lift hub to North-East tower `(37, 7)`.
4. In `src/sim/spatial/district-pipeline-late.ts` (lines 87–88):
   ```typescript
   const spireTargets = [{ x: 10, y: 7 }, { x: 37, y: 28 }, { x: 10, y: 28 }];
   ctx.spire = ensureDistrictConnectivity(ctx.spire, ctx.liftPos, spireTargets).grid;
   ```
   The connectivity repair list **omits `(37, 7)`**.
5. Because `(37, 7)` is missing from `spireTargets`, the severed path to North-East tower `(37, 7)` is never repaired, leaving the tower completely disconnected and unreachable from the lift landing.

### 2.2 Orphaned Walkable Floor Pockets on Street and Spire (57% of Seeds)
1. In `src/sim/spatial/district-pipeline.ts` (lines 131–135), `fillUnbuiltYards` executes at the conclusion of Stage 5, sealing isolated yard pockets in solid brick walls.
2. In Stage 6 (`executeStage6MultiStratumDungeons`), `enrichLargeScaleDistrict` (`src/sim/spatial/district-scaler.ts`) subsequently stamps:
   - Viaduct monorail rail corridors (`IRON_GRATE` at `y = viaductY` spanning across `x = 2..width - 2`).
   - Perimeter toll barriers (`WROUGHT_IRON_FENCE`).
   - Multi-point sewer drops.
3. These Stage 6 features slice across plots and fence off segments of previously carved floors, piers, and grates (e.g. `(16, 31)` to `(20, 31)` in seed 3000, `(45, 26)` to `(46, 28)` in seed 3012).
4. Stage 7 (`ensureDistrictConnectivity`) only punches paths to a small, fixed array of `connectivityTargets(ctx)` (gates, lift, boiler, mine hoist, sewer drops).
5. All non-target walkable tiles severed by fences or buildings remain stranded, creating orphaned walkable pockets across 57 of the 101 tested seeds (up to 111 orphaned tiles in seed 3070).
6. Similarly, 7 seeds on Spire have severed catwalk platforms that become orphaned floating islands.

### 2.3 Compass Gate Severance by Closed Building Door (Seed 3073)
1. In `src/sim/spatial/generator.ts`, `district_spitalfields_soot_works` has North gate at `(24, 1)`.
2. In seed 3073, a stamped building typology places a closed exterior door `WOODEN_DOOR_CLOSED` (`blocksMovement: true`) at `(24, 7)`.
3. The surrounding tiles along `y = 7` are solid brick walls.
4. Because `hasWalkablePath` respects physical movement blocking (`blocksMovement: false`), the player cannot traverse past `(24, 7)` to reach North gate `(24, 1)`.
5. Thus, central plaza to North gate BFS pathfinding fails in seed 3073.

---

## 3. Caveats

1. **Deterministic Regeneration Robustness**:
   Determinism testing passed 100%: generating twice with the same seed across all 101 seeds (3000..3100) produced bit-exact matches across all tile cells on all strata (`STREET`, `UNDERCROFT`, `SPIRE`) and all entity records. The PRNG pipeline itself is strictly deterministic.
2. **Door Pathfinding Semantics**:
   When actors interact with closed doors, they can toggle them via `MOVE_STEP`. In `isReachableOrAdjacentReachable`, all 6 stamped building doors were verified reachable from the central plaza in 100% of seeds. The bug in seed 3073 is that the closed door blocks transit *through* a thoroughfare to a compass gate on the far side.
3. **Stand-alone `generateUrbanDistrict` Invariant**:
   When `generateUrbanDistrict` is executed directly as a standalone module, it exhibits 100% reachability and 0 orphaned pockets. However, because it was not integrated into `generateVictorianDistrict`, the active game engine experiences all legacy failure modes.

---

## 4. Conclusion

**Verdict: REJECT**

Milestone 2 cannot be approved in its current state. The implementation fails the core acceptance criteria specified in the user request and dispatch objective:
1. Spire catwalk reachability is broken on seeds 3016, 3019, and 3050 due to an omitted target in `spireTargets` in `src/sim/spatial/district-pipeline-late.ts`.
2. 57% of generated districts violate the "zero orphaned or unreachable walkable floor pockets" invariant due to Stage 6 features severing yard and rail cells without post-enrichment sealing.
3. Seed 3073 fails thoroughfare reachability to the North gate due to a closed building door blocking passage.
4. `generateUrbanDistrict` remains disconnected from the primary `generateVictorianDistrict` pipeline.

### Required Worker Fixes:
1. In `src/sim/spatial/district-pipeline-late.ts`: add `{ x: 37, y: 7 }` to `spireTargets` so `ensureDistrictConnectivity` repairs the North-East Spire platform if obstructed by the greenhouse.
2. In `src/sim/spatial/district-pipeline-late.ts` or `district-pipeline.ts`: perform a final pocket-sealing pass after Stage 6/7 (similar to `fillUnbuiltYards` or converting unreachable walkable floor tiles to walls) so zero orphaned walkable tiles exist on `STREET` or `SPIRE`.
3. Ensure thoroughfare corridors to compass gates (`westGatePos`, `eastGatePos`, `northGatePos`, `southGatePos`) cannot be severed by closed building doors.
4. Integrate `generateUrbanDistrict` directly into the `generateVictorianDistrict` pipeline as mandated by R2 and the Milestone 2 specifications.

---

## 5. Verification Method

To independently reproduce all findings and verify this challenge report:

1. **Run the Adversarial Test Suite**:
   ```bash
   npx vitest run tests/sim/m2-challenger-walkability.test.ts
   ```
   *Expected result*: Exits code 1, exactly 3 tests fail with the identical failure signatures documented above:
   - Spire platforms fail on seeds 3016, 3019, 3050 (`(37, 7)` unreachable).
   - Zero orphaned pockets fails on 64 distinct seed runs (57 street, 7 spire).
   - North gate reachability fails on seed 3073.
2. **Verify Modularity and Boundaries**:
   ```bash
   npm run check:boundaries
   ```
   *Expected result*: Exits code 0 with 425 files checked; `tests/sim/m2-challenger-walkability.test.ts` is 185 lines (<= 250 budget).
3. **Invalidation Condition**:
   If `npx vitest run tests/sim/m2-challenger-walkability.test.ts` passes with 6/6 tests green without relaxing any assertions, this challenge is invalidated.
