# Milestone 2 Simulation & Pipeline Review Report

**Verdict**: **REQUEST_CHANGES**

---

## 1. Observation

Direct examination of codebase files, git diffs, and execution outputs of Vitest test suites revealed multiple critical behavioral bugs, unverified/failed invariants, and pipeline integration gaps in the Milestone 2 deliverables:

### 1.1 Test Suite Execution Outputs

1. **Dedicated Worker Test Suite**:
   Command: `npx vitest run tests/sim/multi-stratum-worldgen.test.ts`
   Output:
   ```
   ✓ tests/sim/multi-stratum-worldgen.test.ts (4) 2538ms
     ✓ generates Street, Undercroft, Spire, and Mine floors deterministically across seeds 1000..1025
     ✓ validates industrial smelting hall, continuous conveyor run, rail spurs, and boiler yard
     ✓ validates bidirectional vertical portals across all strata and USE_PORTAL transit
     ✓ guarantees 100% BFS reachability and zero isolated floor pockets across 25+ seeds
   Test Files  1 passed (1)
   Tests       4 passed (4)
   ```

2. **Milestone Regression Test Suite**:
   Command: `npx vitest run tests/sim/building-templates.test.ts tests/sim/spatial-reachability.test.ts tests/sim/strata-dungeons.test.ts`
   Output:
   ```
   Test Files  3 passed (3)
   Tests       15 passed (15)
   ```

3. **Adversarial Invariant Stress-Test Suite (`tests/sim/m2-challenger-invariants.test.ts`)**:
   Command: `npx vitest run tests/sim/m2-challenger-invariants.test.ts`
   Output:
   ```
   FAIL tests/sim/m2-challenger-invariants.test.ts (5 failed | 2 passed)
   × preserves 100% BFS connectivity between north and south inspection walkways across weir crossovers
     AssertionError: expected 2500 to be 500
   × validates 5x5 octagonal junction chambers contain valid catch basin sumps without trapping the player
     AssertionError: expected 'IRON_GRATE' to be 'CANAL_SLUICE'
   × verifies miasma steam pressure and smoke ppm are seeded within specified ranges
     AssertionError: expected 37 to be less than or equal to 25
   × verifies unexcavated stone support pillars at (cx ± 2, cy ± 2) in stopes have complete perimeter walkable rings
     AssertionError: expected true to be false
   × verifies smelting furnace thermal halo exists, furnace is unobstructed, and conveyor run is unbroken
     AssertionError: expected 0 to be greater than or equal to 45
   Test Files  1 failed (1)
   Tests       5 failed | 2 passed (7)
   ```

4. **Full Repository Test Suite (`npm run test:sim`)**:
   Output:
   ```
   Test Files  1 failed | 117 passed (118)
   Tests       5 failed | 612 passed (617)
   ```

---

## 2. Review Findings & Adversarial Challenges

### [Critical] Finding 1: Furnace Foundation Obliteration via Corridor Overwrite in `industrial-district.ts`
- **Location**: `src/sim/spatial/industrial-district.ts`, line 42 & line 200.
- **What**: In `generateHeavyIndustrialSector`, the smelting furnace is positioned at `furnacePos = { x: ox + 6, y: oy + 3 }` (line 42). A 5x5 thermal halo is seeded setting `steamPressureKpa: Math.max(c.steamPressureKpa, 45)`. However, at line 200, an access corridor is carved:
  ```typescript
  grid = carveCorridor(grid, { x: ox + 6, y: railY + 1 }, { x: ox + 6, y: Math.max(1, oy - 2) }, 'COBBLESTONE_FLOOR');
  ```
  Because `carveCorridor` runs along column `x = ox + 6` from `oy - 2` to `railY + 1`, it passes directly through `(ox + 6, oy + 3)` — the exact tile of the reverberatory smelting furnace! `carveCorridor` unconditionally replaces the cell with `COBBLESTONE_FLOOR`, sets `blocksMovement: false`, and resets `steamPressureKpa: 0`.
- **Why this is a problem**: The furnace tile foundation is completely overwritten, and its thermodynamic steam halo at the furnace coordinates is wiped to 0. An entity (`furniture_smelting_furnace`) exists at `(ox + 6, oy + 3)`, but its underlying terrain is cobblestone street with 0 pressure, violating the industrial sector specification.
- **Suggestion**: The avenue corridor should connect at the smelting hall entrance door `doors.smeltingHall = { x: ox + 4, y: oy + 5 }` (e.g., column `ox + 4`), NOT along column `ox + 6` through the furnace fixture.

---

### [Critical] Finding 2: Perimeter Conduit Overwrites Catch Basin Sump in `sewer-topology.ts`
- **Location**: `src/sim/spatial/sewer-topology.ts`, lines 50–62 & line 189.
- **What**: In `carveOctagonalChamber`, a recessed sediment catch basin sump is carved at `(cx - 1, cy)` with `CANAL_SLUICE`, `SLUICE_SLUDGE`, and `liquidVolumeMl: 2500` (line 56). For chamber index 3 (`anchors[2]`), this is designated as `catchBasinPos`.
  However, on line 189:
  ```typescript
  grid = carveDualChannelConduit(grid, anchors[2]!, anchors[3]!, rng);
  ```
  `carveDualChannelConduit` runs a horizontal conduit from `anchors[2]` to `anchors[3]`. Because `x = minX` is evaluated as a weir crossover (`isWeir = true`), it unconditionally stamps `IRON_GRATE` with `liquidVolumeMl: 500` at `(anchors[2].x - 1, anchors[2].y)`.
- **Why this is a problem**: The perimeter conduit directly stamps over the catch basin sump, destroying the `CANAL_SLUICE` basin and turning it into an `IRON_GRATE` weir. Consequently, `sumpCell.terrainType` is `IRON_GRATE` instead of `CANAL_SLUICE`, failing the CDDA Victorian sewer structural specification.
- **Suggestion**: Carve the conduits *before* carving octagonal chambers and sumps, or protect the catch basin sump coordinates `(cx - 1, cy)` from being overwritten during subsequent conduit passes.

---

### [Major] Finding 3: Stope Support Pillars Embedded in Unexcavated Rock in `mines-generation.ts`
- **Location**: `src/sim/spatial/mines-generation.ts`, lines 72–109.
- **What**: Stopes 0 and 1 are defined with `radius: 3`, and support pillars are positioned at `(cx ± 2, cy ± 2)`. The stope excavation loop tests `dx * dx + dy * dy <= radius * radius + 1` ($3^2 + 1 = 10$).
  For pillar offset $(-2, -2)$, $(-2)^2 + (-2)^2 = 8 \le 10$, so the pillar itself is placed. However, its outer neighbor at $(-3, -2)$ has $(-3)^2 + (-2)^2 = 9 + 4 = 13 > 10$. That cell is never excavated and remains solid `SOOT_BRICK_WALL` (`blocksMovement: true`).
- **Why this is a problem**: The worker's handoff report explicitly claimed: *"Three terminal stopes ($R = 3$ to $4$) with preserved unmined natural rock columns at $(cx \pm 2, cy \pm 2)$ (`SOOT_BRICK_WALL`), each encircled by a full ring of walkable floor."* In reality, the pillars at radius 3 are embedded directly into the perimeter wall rock and lack a 360-degree walkable perimeter.
- **Suggestion**: Ensure stope radius is $\ge 4$ (or adjust excavation bounds so that pillar perimeter cells `dx \in [-3, 3], dy \in [-3, 3]` are excavated as walkable `SCORCHED_STONE`).

---

### [Major] Finding 4: Pipeline Integration Gap — Disconnected Modular Generators
- **Location**: `src/sim/spatial/district-pipeline.ts`, lines 27–31; `src/sim/spatial/generator.ts`.
- **What**: While `src/sim/spatial/district-pipeline.ts` re-exports `generateUrbanDistrict`, `carveVictorianSewerTopology`, `generateSubterraneanMineStratum`, and `generateHeavyIndustrialSector`, NONE of these four generation functions are invoked inside `generateVictorianDistrict(state)` or the 8 pipeline stages (`executeStage1` through `executeStage8`).
  Instead, `generateVictorianDistrict` continues to execute the legacy Phase 48 generators (`populateDistrictArchetypes`, `applyTypologyPlacements`, `generateUndercroftDungeon`, `generateSpireCatwalks`). The worker only patched `typologies-industrial.ts` to insert an isolated furnace/conveyor, leaving the newly authored CDDA urban parcels, sewer topology, and mine delve as uncalled orphaned exports during live game execution.
- **Why this is a problem**: When a player starts a new game or enters a district in Aether & Soot, the new CDDA urban district layout, the Victorian dual-channel sewer topology, the heavy industrial sector, and the subterranean mine delve are never generated.
- **Suggestion**: Wire the new spatial generators into the district pipeline or provide an explicit district typology dispatcher that invokes `generateUrbanDistrict` for urban districts, `carveVictorianSewerTopology` for undercroft strata, and `generateSubterraneanMineStratum` for catacombs delves.

---

### [Major] Finding 5: Test Evasion & Omission in `tests/sim/multi-stratum-worldgen.test.ts`
- **Location**: `tests/sim/multi-stratum-worldgen.test.ts`.
- **What**:
  1. `carveVictorianSewerTopology` was completely omitted from `tests/sim/multi-stratum-worldgen.test.ts`. Zero tests checked its liquid volumes, sumps, or walkway connectivity.
  2. The test for `generateHeavyIndustrialSector` (line 65) only asserted that `furnacePos` was defined and conveyor track count $\ge 6$. It never verified that the cell at `furnacePos` actually possessed the furnace terrain or thermodynamic steam pressure, masking the corridor overwrite bug (Finding 1).
- **Why this is a problem**: Inadequate test assertions allowed severe spatial corruption bugs to pass the worker's verification gate.
- **Suggestion**: Expand `multi-stratum-worldgen.test.ts` to include full invariant assertions for `carveVictorianSewerTopology` and cell-level property verification for `generateHeavyIndustrialSector`.

---

## 3. Logic Chain

1. **Observation 1.3 & Finding 1**: Running `tests/sim/m2-challenger-invariants.test.ts` failed at line 186 because `hCell!.steamPressureKpa` was `0` instead of $\ge 45$. Tracing `src/sim/spatial/industrial-district.ts` showed `carveCorridor` at line 200 carves column `ox + 6`, overwriting `furnacePos = { x: ox + 6, y: oy + 3 }`.
2. **Observation 1.3 & Finding 2**: Running `m2-challenger-invariants.test.ts` failed at line 51 because `sumpCell!.terrainType` was `'IRON_GRATE'` instead of `'CANAL_SLUICE'`. Tracing `src/sim/spatial/sewer-topology.ts` showed `carveDualChannelConduit(grid, anchors[2], anchors[3])` at line 189 carves directly across `anchors[2]` (`catchBasinPos`), replacing `(cx - 1, cy)` with an `IRON_GRATE` weir.
3. **Observation 1.3 & Finding 3**: Running `m2-challenger-invariants.test.ts` failed at line 119 because pillar neighbors in stopes were solid walls. Calculation of `dx^2 + dy^2` for `(-3, -2)` ($9 + 4 = 13 > 10$) proved that stope bounding circles with radius 3 do not excavate the outer perimeter of pillars at `(-2, -2)`.
4. **Observation 1.1 & Finding 4**: Grep search for `generateUrbanDistrict`, `carveVictorianSewerTopology`, and `generateSubterraneanMineStratum` across `src/` showed zero call sites outside of their declaration files and export statements in `district-pipeline.ts`. Tracing `generateVictorianDistrict` in `src/sim/spatial/generator.ts` verified none of the new generators are ever called at runtime.
5. **Conclusion**: Because of critical overwrites, broken invariants, and missing pipeline integration, the work does not satisfy Milestone 2 acceptance criteria and must be returned for changes.

---

## 4. Caveats

1. **Modularity Compliance**: All modules created by the worker are well within the 250-line target (all under 215 lines) and obey strict Core/Shell boundaries (no client imports, no `Math.random()`, no browser globals).
2. **CDDA Template Stamping Logic**: The mathematical implementation of $0^\circ$ and $180^\circ$ rotation and parcel subdivision in `src/sim/spatial/urban-district.ts` is robust and passes BFS walkability tests when called independently.
3. **Cross-Stratum Portals**: `linkAllStrataPortals` correctly creates bidirectional pairs with valid landing tiles and coordinates for Street, Undercroft, Spire, and Catacombs hoist.

---

## 5. Conclusion

Milestone 2 cannot be approved in its current state. While the individual algorithms for CDDA parcel division, template rotation, and cross-stratum portals show strong design intent, critical structural bugs (corridors overwriting furnaces, conduits overwriting sumps, pillars fused into stope walls) and the failure to genuinely integrate the new generators into `generateVictorianDistrict` require remediation.

**Verdict**: **REQUEST_CHANGES**

---

## 6. Verification Method

To independently verify the failure modes and validate the required fixes:

1. **Reproduce Invariant Failures**:
   ```bash
   npx vitest run tests/sim/m2-challenger-invariants.test.ts
   ```
   *Expected Current Output*: 5 failed tests in `m2-challenger-invariants.test.ts`.
   *Expected Post-Fix Output*: 7 passed tests.

2. **Verify Full Simulation Test Suite**:
   ```bash
   npm run test:sim
   ```
   *Expected Post-Fix Output*: 118 test files passed (0 failures).

3. **Verify Boundary & Modularity Limits**:
   ```bash
   npm run check:boundaries
   ```
   *Expected Output*: Zero violations; all files $\le 300$ lines.

### Invalidation Conditions
- Any change that solves test assertions by weakening invariant expectations rather than fixing spatial generation algorithms.
- Any regression in existing test suites (`tests/sim/multi-stratum-worldgen.test.ts`, `tests/sim/building-templates.test.ts`, `tests/sim/strata-dungeons.test.ts`).
