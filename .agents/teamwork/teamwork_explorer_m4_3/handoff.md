# Explorer 3 Investigation Report: M4 Verification Gate & Modularity Architecture

**Target**: Milestone 4 — End-to-End Multi-Seed Determinism & Full Verification  
**Author**: Explorer 3 (M4 Verification Gate & Modularity Architect)  
**Date**: 2026-11-02T01:04:40Z  
**Working Directory**: `/Users/emmett/Desktop/Game/.agents/teamwork/teamwork_explorer_m4_3`  

---

## 1. Observation

### 1.1 Codebase File Size & Modularity Inventory
A comprehensive scan of all TypeScript files (`.ts`, `.tsx`) across the workspace was conducted using `tests/scripts/check-boundaries.ts` methodology (`content.split('\n').length`, corresponding to POSIX `wc -l + 1`):
- **Total TS/TSX files scanned**: 433 files.
- **Rule 2.2 Violations (> 300 lines hard ceiling)**: **0 files**.
- **Files in `src/` exceeding target ceiling (> 250 lines)**: **0 files**.
- **Files in `src/` nearing warning threshold (>= 240 lines)**: Exactly 2 files:
  1. `src/schemas/core-events.schema.ts`: 244 lines.
  2. `src/sim/systems/ai.system.ts`: 240 lines.

### 1.2 Milestone 1, 2, and 3 File Line Counts
The following table details every file authored or modified across Milestones 1, 2, and 3:

| Milestone | File Path | Line Count | Status vs Target (<= 250) |
|---|---|---|---|
| **M1** | `src/schemas/building-template.schema.ts` | 120 | OK (<= 240) |
| **M1** | `src/schemas/primitives.schema.ts` | 216 | OK (<= 240) |
| **M1** | `src/schemas/world-components.schema.ts` | 207 | OK (<= 240) |
| **M1** | `src/sim/spatial/fixture-catalog.ts` | 232 | OK (<= 240) |
| **M1** | `src/sim/spatial/building-templates.ts` | 236 | Watch List (236/240) |
| **M1** | `src/sim/spatial/template-instantiator.ts` | 237 | Watch List (237/240) |
| **M1** | `src/sim/systems/furniture.system.ts` | 238 | Watch List (238/240) |
| **M1** | `tests/sim/building-templates.test.ts` | 185 | OK (<= 240) |
| **M1** | `tests/sim/template-instantiator-stress.test.ts` | 231 | OK (<= 240) |
| **M1** | `tests/sim/fixture-container-stress.test.ts` | 250 | **WARNING: At Target Ceiling (250)** |
| **M2** | `src/sim/spatial/urban-district.ts` | 205 | OK (<= 240) |
| **M2** | `src/sim/spatial/district-yards.ts` | 222 | OK (<= 240) |
| **M2** | `src/sim/spatial/sewer-topology.ts` | 228 | OK (<= 240) |
| **M2** | `src/sim/spatial/mines-generation.ts` | 186 | OK (<= 240) |
| **M2** | `src/sim/spatial/industrial-district.ts` | 214 | OK (<= 240) |
| **M2** | `src/sim/spatial/strata-portals.ts` | 237 | Watch List (237/240) |
| **M2** | `tests/sim/multi-stratum-worldgen.test.ts` | 138 | OK (<= 240) |
| **M2** | `tests/sim/m2-challenger-invariants.test.ts` | 217 | OK (<= 240) |
| **M2** | `tests/sim/m2-challenger-walkability.test.ts` | 186 | OK (<= 240) |
| **M3** | `src/client/projection/extended-box-drawing.ts` | 178 | OK (<= 240) |
| **M3** | `src/client/projection/frame-adapter.ts` | 208 | OK (<= 240) |
| **M3** | `src/client/renderer/tactical-layer-composer.ts` | 214 | OK (<= 240) |
| **M3** | `src/client/renderer/procedural-tileset.ts` | 149 | OK (<= 240) |
| **M3** | `src/client/renderer/tileset-manager.ts` | 121 | OK (<= 240) |
| **M3** | `tests/sim/client-presentation-modes.test.ts` | 214 | OK (<= 240) |
| **M3** | `tests/sim/m3-challenger-visual-projection.test.ts` | 249 | **WARNING: At Target Ceiling (249)** |
| **M3** | `tests/sim/m3-presentation-stress.test.ts` | 206 | OK (<= 240) |

### 1.3 Baseline Performance of Verification Gates (`npm run verify`)
The verification suite was executed and timed end-to-end:
```bash
time npm run verify
# Results:
# Gate 1: npm run typecheck (tsc --noEmit) -> 0 errors (~2.5s)
# Gate 2: npm run check:boundaries (tsx tests/scripts/check-boundaries.ts) -> 433 files checked, 0 violations (~0.5s)
# Gate 3: npm run validate:data (tsx tests/scripts/validate-data.ts) -> Validated 5 prosthetics, 2 commodities, 22 materials/consumables, 9 recipes, 2 gases/fluids, 5 districts, 4 bark corpora, 3 codex entries (~0.4s)
# Gate 4: npm run test:sim (vitest run) -> 122 test files passed (122), 647 tests passed (647) (~40.33s duration)
# Total time: 45.267s wall clock, 130.13s user, 17.23s system
```

#### Slowest Test Files Profiled (Vitest Critical Path)
1. `tests/sim/m2-challenger-walkability.test.ts`: **30,048 ms** (longest test thread, suite critical path)
2. `tests/sim/m3-presentation-stress.test.ts`: **20,689 ms**
3. `tests/sim/spatial-contiguity-audit.test.ts`: **19,831 ms**
4. `tests/sim/template-instantiator-stress.test.ts`: **16,377 ms**
5. `tests/sim/hermes-testgen.test.ts`: **15,903 ms**
6. `tests/sim/m3-challenger-visual-projection.test.ts`: **15,723 ms**
7. `tests/sim/multi-stratum-worldgen.test.ts`: **12,066 ms**

---

## 2. Logic Chain

### 2.1 Why a Unified E2E Acceptance Suite is Required
- **Isolated Verification vs Systemic Integration**:
  - M1 verified template matrix parsing and stamping into isolated sub-grids (`instantiateTemplateIntoGrid`).
  - M2 verified multi-stratum generation, sewer conduits, drift shafts, and BFS pathfinding on procedural world grids.
  - M3 verified tactical layer frame projection, extended box-drawing autotiling, and presentation mode toggling on synthetic worlds.
- **The Missing Contract**:
  - The missing acceptance link is an end-to-end integration test (`tests/sim/cdda-worldgen-presentation-e2e.test.ts`) that ties the entire pipeline together:
    1. A complete multi-stratum world is generated using `generateVictorianDistrict` and `generateUrbanDistrict` with CDDA building templates stamped and Victorian fixtures populated.
    2. Reciprocal cross-stratum portals (`STREET` <-> `UNDERCROFT`, `STREET` <-> `SPIRE`, `STREET` <-> `MINES`) are verified with `USE_PORTAL` command execution and 100% BFS walkability.
    3. The live multi-stratum world is projected into `RenderCellLayers` (floor, fixture, item, actor) with building facades and interior partitions resolving to extended CP437 box-drawing glyphs.
    4. The live frame is presented across all 3 visual modes (`CP437_ASCII`, `GRAPHICAL_TILESET`, `HYBRID_OVERLAY`), verifying shader split stability (`uTacticalSplit = 58/88`) and bit-exact multi-seed determinism.

### 2.2 Modularity Budgeting & Strict <= 250 Line Ceiling
- Under AGENTS.md Rule 2.2, all new files have a target of strictly `<= 250 lines` and an automated hard failure ceiling of `300 lines`.
- To guarantee `tests/sim/cdda-worldgen-presentation-e2e.test.ts` remains <= 250 lines (with a safe target of **200–225 lines**), the suite must be structured into exactly 4 cohesive test blocks:
  1. **Block 1: Multi-Stratum Worldgen & CDDA Template Fixture Density (~45 lines)**
     - Generates district, verifies Street, Undercroft, Spire, and Mines strata exist.
     - Verifies stamped templates (e.g., Tavern, Constabulary, Boilerhouse) contain interior fixtures (`BAR_COUNTER`, `SAFE_VAULT`, `VALVE_MANIFOLD`, `COAL_STOVE`) with non-severing walkability.
  2. **Block 2: Cross-Stratum Portal Reciprocity & 100% BFS Transit Reachability (~45 lines)**
     - Verifies portal linkage pairs (manhole, hoist, elevator).
     - Dispatches `USE_PORTAL` command to transit player across strata and verifies `STRATUM_CHANGED` event emission.
     - Tests BFS pathfinding walkability from spawn to entrance doors, portals, and district gates.
  3. **Block 3: Tactical Layer Frame Projection & Extended Box-Drawing Autotiling (~45 lines)**
     - Projects world via `projectWorldToVisualFrame`.
     - Validates discrete `RenderCellLayers` (floor, fixture, actor) and verifies floor visibility under entities.
     - Verifies autotiled double-line perimeter walls (`║`, `═`, `╔`), single-line partitions (`│`, `─`), and mixed T-junctions (`╞`, `╡`, `╤`).
  4. **Block 4: Presentation Mode Governance, Tactical Split & Multi-Seed Bit-Exact Determinism (~50 lines)**
     - Cycles presentation modes (`CP437_ASCII` -> `GRAPHICAL_TILESET` -> `HYBRID_OVERLAY`) with `TilesetManager`.
     - Verifies `SteampunkRenderPipeline` tactical split uniform stability (`58/88`).
     - Verifies bit-exact determinism across 3 distinct seeds (`seed = 4001, 7777, 9999`): identical grids, entity IDs, and portal connections.
  - Setup & Imports: ~25 lines.
  - **Total Projected Line Count**: **~210 lines** (leaves 40 lines of headroom below the 250-line target).

### 2.3 Verification Gate Performance & Concurrency Strategy
- **Concurrency Analysis**:
  - Vitest runs test files in parallel across worker threads.
  - The critical path is governed by the longest single test file: `tests/sim/m2-challenger-walkability.test.ts` at **30.0s**.
  - Total `npm run verify` wall-clock duration is currently **45.2s**.
- **Execution Budget for the E2E Suite**:
  - If `cdda-worldgen-presentation-e2e.test.ts` executes in **< 4.0 seconds**, it will run concurrently in an idle worker thread without extending the critical path.
  - **Design Rules to Guarantee < 4.0s Execution**:
    1. Limit multi-seed determinism testing to **3 carefully selected seeds** (e.g. `4001`, `7777`, `9999`) rather than looping over 25–50 seeds (which is what caused `m2-challenger-walkability.test.ts` to take 30s).
    2. Test BFS reachability to key landmarks and portals rather than performing an exhaustive O(N^2) all-pairs grid flood.
    3. Execute presentation layer checks headlessly using mock atlases and `ProceduralTileset` without creating DOM canvas elements or WebGL contexts.
  - Under these constraints, the new test file will finish in ~1.5–2.5s, well within the 30.0s critical path, keeping overall `npm run verify` at **~45s**.

---

## 3. Caveats

1. **Avoid Test Bloat & Over-Specification**:
   - The E2E test file must not attempt to duplicate granular unit tests already present in `building-templates.test.ts` (which tests all 6 templates individually) or `client-presentation-modes.test.ts` (which tests all bitmasks individually). The E2E test must focus strictly on the integration joints where M1, M2, and M3 connect.
2. **Line Ceiling Proximity on M1/M3 Tests**:
   - `tests/sim/fixture-container-stress.test.ts` is currently at **250 lines** (the exact target ceiling).
   - `tests/sim/m3-challenger-visual-projection.test.ts` is currently at **249 lines** (1 line below ceiling).
   - `src/sim/systems/furniture.system.ts` is at **238 lines**.
   - `src/sim/spatial/template-instantiator.ts` is at **237 lines**.
   - `src/sim/spatial/strata-portals.ts` is at **237 lines**.
   - **Constraint**: Under no circumstances should any developer add new helper methods or assertions to these files. All new acceptance assertions must live in `tests/sim/cdda-worldgen-presentation-e2e.test.ts`.
3. **Headless PixiJS & Canvas Mock Invariants**:
   - `TacticalLayerComposer` and `ProceduralTileset` rely on PixiJS `Container` and canvas mocking in Vitest. All imports in `tests/sim/` must continue to run headlessly without browser globals (`window`, `document`) or WebGL hardware.
4. **Seed Stability**:
   - Procedural generation relies on `SeededRNG`. If seed constants change or PRNG sequences are altered, hash assertions would invalidate. Using explicit seeds (`4001, 7777, 9999`) with structural checks ensures robust, deterministic assertions.

---

## 4. Conclusion

1. **Codebase Modularity Signoff**:
   - The entire codebase is 100% compliant with Rule 2.2. All 433 TypeScript files satisfy the `< 300` hard ceiling. All source files in `src/` are `<= 244 lines`, strictly complying with the `<= 250` line target.
2. **Unified Acceptance Test Blueprint**:
   - `tests/sim/cdda-worldgen-presentation-e2e.test.ts` is fully architected to integrate Explorer 1 (worldgen & determinism) and Explorer 2 (presentation & autotiling) into a single, high-value acceptance file.
   - Allocated Line Budget: **210–225 lines** (comfortably under the 250-line ceiling).
   - Test Structure:
     - Setup & Imports: 25 lines
     - `it('generates multi-stratum world with CDDA templates stamped and dense fixtures populated')`: ~45 lines
     - `it('verifies cross-stratum portal reciprocity, USE_PORTAL transit, and 100% BFS walkability')`: ~45 lines
     - `it('projects multi-stratum world into RenderCellLayers with extended box-drawing autotiling')`: ~45 lines
     - `it('maintains tactical split stability, presentation mode cycling, and bit-exact multi-seed determinism')`: ~50 lines
3. **Verification Suite Health**:
   - All 4 gates of `npm run verify` (`typecheck`, `check:boundaries`, `validate:data`, `test:sim`) are passing with 100% success rate across 122 test files and 647 tests.
   - Total verification time is budgeted to remain `< 45s`.

---

## 5. Verification Method

To independently verify all findings and validate the modularity and gate health:

1. **Modularity & Boundary Verification**:
   ```bash
   npm run check:boundaries
   # Expected output: "[check:boundaries] OK — Checked 433 files. Zero Core/Shell or modularity violations."
   ```

2. **Full Verification Suite**:
   ```bash
   npm run verify
   # Expected output: All 4 gates pass with 0 errors, 122/122 test files green, 647/647 tests passed, runtime ~40–45s.
   ```

3. **Modularity Line Scan Command**:
   ```bash
   node -e '
   const fs = require("fs");
   const path = require("path");
   function collect(dir) {
     if (!fs.existsSync(dir)) return [];
     return fs.readdirSync(dir, { withFileTypes: true }).flatMap(e => {
       const res = path.join(dir, e.name);
       return e.isDirectory() ? collect(res) : (/\.(ts|tsx)$/.test(e.name) ? [res] : []);
     });
   }
   const files = [...collect("src"), ...collect("tests")];
   const over250 = files.map(f => ({ f, l: fs.readFileSync(f, "utf8").split("\n").length })).filter(x => x.l > 250);
   console.log("Files over 250 lines:", over250);
   '
   # Expected output: Exactly 0 files in src/ over 250 lines.
   ```

4. **Targeted E2E Test Execution (Once Implemented)**:
   ```bash
   npx vitest run tests/sim/cdda-worldgen-presentation-e2e.test.ts
   # Expected output: 4/4 tests pass in < 4.0s.
   ```
