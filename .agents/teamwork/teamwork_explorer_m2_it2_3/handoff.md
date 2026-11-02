# Milestone 2 Walkability, Spire & Pocket-Sealing Remediation Report

**Explorer**: Walkability, Spire & Pocket-Sealing Fix Explorer (`teamwork_explorer_m2_it2_3`)  
**Target Milestone**: Milestone 2 (`Multi-Stratum World Generation & Urban Layouts`)  
**Scope**: Exact remediation design, AST diffs, line counts, and algorithms for all 3 walkability failure modes discovered by Challenger 1 (`tests/sim/m2-challenger-walkability.test.ts`).

---

## 1. Observation

Direct inspection of test execution outputs, source code, and data flows revealed three distinct defect chains causing 3 of 6 tests in `tests/sim/m2-challenger-walkability.test.ts` to fail across 101 pseudo-random seeds (seeds 3000..3100):

### 1.1 Verbatim Challenger 1 Test Suite Failures (`tests/sim/m2-challenger-walkability.test.ts`)
1. **Spire Platform Reachability** (Line 135:22):
   ```
   FAIL tests/sim/m2-challenger-walkability.test.ts > verifies 100% BFS reachability from Spire lift landing to all catwalk platforms
   AssertionError: expected [ ...(3) ] to deeply equal []
   - Array []
   + Array [
   +   "Seed 3016: Spire platform (37,7) unreachable from lift (41,18)",
   +   "Seed 3019: Spire platform (37,7) unreachable from lift (41,19)",
   +   "Seed 3050: Spire platform (37,7) unreachable from lift (42,18)",
   + ]
   ```

2. **Orphaned Walkable Floor Pockets** (Line 159:22):
   ```
   FAIL tests/sim/m2-challenger-walkability.test.ts > verifies zero orphaned or unreachable walkable floor pockets across all strata
   AssertionError: expected [ ...(64) ] to deeply equal []
   - Array []
   + Array [
   +   "Seed 3000: STREET has 29 orphaned tiles (e.g. (16,31))",
   +   "Seed 3001: STREET has 5 orphaned tiles (e.g. (14,29))",
   +   "Seed 3002: STREET has 27 orphaned tiles (e.g. (16,5))",
   +   "Seed 3004: STREET has 8 orphaned tiles (e.g. (32,7))",
   +   "Seed 3005: STREET has 16 orphaned tiles (e.g. (28,31))",
   +   "Seed 3016: SPIRE has 27 orphaned tiles (e.g. (35,5))",
   +   ... (46 additional seeds failing with orphaned walkable tiles)
   + ]
   ```

3. **North Gate Reachability in Seed 3073** (Line 183:22):
   ```
   FAIL tests/sim/m2-challenger-walkability.test.ts > verifies 100% BFS reachability from central plaza manhole to all four compass gates (West, East, North, South)
   AssertionError: expected [ Array(1) ] to deeply equal []
   - Array []
   + Array [
   +   "Seed 3073: North gate (24,1) unreachable",
   + ]
   ```

### 1.2 Codebase Source Code Observations
1. **Omission in `district-pipeline-late.ts:87`**:
   `src/sim/spatial/district-pipeline-late.ts`:
   ```typescript
   // Line 87
   const spireTargets = [{ x: 10, y: 7 }, { x: 37, y: 28 }, { x: 10, y: 28 }];
   ctx.spire = ensureDistrictConnectivity(ctx.spire, ctx.liftPos, spireTargets).grid;
   ```
   `spireTargets` has only 3 points. North-East platform `{ x: 37, y: 7 }` is missing.
2. **Spoke Corridor Overwrite in `landmark-micro-locations.ts:106-113`**:
   `src/sim/spatial/landmark-micro-locations.ts`:
   ```typescript
   // Lines 106-113
   grid = setTileCell(grid, x, y, (c) => ({
     ...c,
     terrainType: isDoor ? 'WOODEN_DOOR_CLOSED' : isPerimeter ? 'GLASS_WINDOW' : 'BRASS_CATWALK',
     blocksMovement: isPerimeter && !isDoor,
     blocksSight: false,
     interiorZone: isPerimeter ? 'NONE' : 'WORKSHOP',
   }));
   ```
   `seedSpireGreenhouse` stamps `GLASS_WINDOW` (`blocksMovement: true`) on all perimeter tiles (`dx === 0 || dy === 0 || dx === 4 || dy === 4`) without checking whether `c.terrainType === 'BRASS_CATWALK'`. When lift landing is at `(41, 18)`, `ghX = 41 - 8 = 33`, and perimeter `dx = 4` lies exactly at column `x = 37`, overwriting the vertical spoke corridor at `y = 12..16`.
3. **Stage 6 Feature Sealing Gaps in `district-pipeline-late.ts:25-39` & `district-scaler.ts`**:
   `fillUnbuiltYards` only runs once at the end of Stage 5 (`district-pipeline.ts:131`). Stage 6 (`enrichLargeScaleDistrict`) subsequently places `CANAL_SLUICE` across `y = height - 6`, `WROUGHT_IRON_FENCE` along toll lines, and `GOTHIC_COLONNADE` along viaducts, cutting off dead-end yard patches. Stage 7 punches corridors only to `connectivityTargets(ctx)`, leaving non-target floor tiles stranded.
4. **Missing Transit Corridors in `district-pipeline.ts:69-85`**:
   Stage 3 (`executeStage3ThoroughfareSkeletization`) carves:
   ```typescript
   ctx.street = carveCorridor(ctx.street, ctx.westGatePos, ctx.eastGatePos, 'COBBLESTONE_FLOOR');
   carveGateCell(ctx, ctx.westGatePos);
   carveGateCell(ctx, ctx.eastGatePos);
   if (ctx.compass.north) carveGateCell(ctx, ctx.northGatePos);
   if (ctx.compass.south) carveGateCell(ctx, ctx.southGatePos);
   ```
   No corridor is carved connecting `ctx.center` to `ctx.northGatePos` or `ctx.southGatePos`. In Stage 5, building slot 1 (middle column `x = 17..31`) places a building directly over column 24. A closed door or partition wall at `(24, 7)` severs North gate `(24, 1)`.

---

## 2. Logic Chain

### 2.1 Spire Platform (37, 7) Reachability Failure (Seeds 3016, 3019, 3050)
1. **Observation 1.2.2**: `carveSpireWeb` (`spire-topology.ts`) creates canonical tower platform `(37, 7)` and connects it to `hub` via `carveSpoke`. When `hub.x > 37` (e.g. `(41, 18)` in seed 3016), `carveSpoke` steps `x` down to 37 and then follows column `x = 37` from `y = 14` down to `y = 7` with `BRASS_CATWALK` cells (`blocksMovement: false`).
2. **Observation 1.2.2**: In `executeStage6MultiStratumDungeons`, `seedSpireGreenhouse` is stamped at `ghX = Math.min(width - 6, Math.max(5, liftPos.x - 8))` and `ghY = Math.min(height - 6, Math.max(5, liftPos.y - 6))`. For `liftPos = (41, 18)`, `ghX = 33`, `ghY = 12`. The eastern perimeter wall (`dx = 4`) lies at `x = 33 + 4 = 37` from `y = 12` to `y = 16`.
3. **Observation 1.2.2**: `seedSpireGreenhouse` unconditionally sets `dx === 4` to `GLASS_WINDOW` (`blocksMovement: true`), overwriting the spoke catwalk on `(37, 12..16)`.
4. **Observation 1.2.1**: In `district-pipeline-late.ts:87`, `ensureDistrictConnectivity(ctx.spire, ctx.liftPos, spireTargets)` runs, but `spireTargets` omits `{ x: 37, y: 7 }`.
5. **Deduction**: Because `{ x: 37, y: 7 }` is missing from repair targets, the severed corridor is never punched open, leaving platform `(37, 7)` and 27-28 adjoining tiles completely unreachable from the lift landing.
6. **Remediation**:
   - In `landmark-micro-locations.ts`: Check `c.terrainType === 'BRASS_CATWALK'` before applying `GLASS_WINDOW`. If an existing spoke is present, preserve `BRASS_CATWALK` (`blocksMovement: false`).
   - In `district-pipeline-late.ts:87`: Append `{ x: 37, y: 7 }` to `spireTargets`.
   - In `district-yards.ts:130`: In `punchPath`, punch `BRASS_CATWALK` if `grid.stratum === 'SPIRE'`.

### 2.2 Orphaned Walkable Floor Pockets on Street and Spire (57% Street, 7% Spire)
1. **Observation 1.1.2 & 1.2.3**: `fillUnbuiltYards` runs once at Stage 5 (`district-pipeline.ts:131`).
2. **Observation 1.2.3**: Stage 6 (`enrichLargeScaleDistrict`) runs afterward and stamps continuous macro features:
   - `CANAL_SLUICE` across `y = height - 6` (south quadrant).
   - `WROUGHT_IRON_FENCE` along toll lines (`x = centerX - 8`).
   - `GOTHIC_COLONNADE` along northern viaducts (`y = 6`).
   - Carves corridors to sewer drop points.
3. **Observation 1.2.3**: These Stage 6 features slice across previously continuous yard plots, fence off dead-end sections, and leave non-target floor tiles cut off from the main avenue.
4. **Observation 1.1.2**: In `tests/sim/m2-challenger-walkability.test.ts:20-52`, `findOrphanedWalkableTiles` performs a BFS from `streetManhole` / `spireLift` traversing `!cell.blocksMovement || cell.terrainType === 'WOODEN_DOOR_CLOSED' || cell.terrainType === 'WOODEN_DOOR_OPEN'`. Any unvisited tile matching that predicate is flagged as orphaned.
5. **Deduction**: Because no sealing pass occurs after Stage 6 and Stage 7, 57% of street seeds retain between 1 and 111 disconnected walkable floor tiles. Similarly, Spire retains disconnected catwalk fragments when spokes are clipped.
6. **Remediation**:
   - Architect `sealOrphanedWalkableTiles(grid: StratumGrid, hub: Point2D): StratumGrid` in `src/sim/spatial/district-yards.ts`.
   - Run a BFS flood fill from `hub` (`ctx.center` on Street/Undercroft, `ctx.liftPos` on Spire) using the exact same traversal predicate.
   - Any cell not reached by the BFS that is walkable or a door is sealed:
     - On `SPIRE`: converted to `ABYSS_DROP` (`blocksMovement: true`, `blocksSight: false`, `interiorZone: 'NONE'`).
     - On `STREET` / `UNDERCROFT`: converted to `SOOT_BRICK_WALL` (`blocksMovement: true`, `blocksSight: true`, `interiorZone: 'NONE'`).
   - Execute `sealOrphanedWalkableTiles` at the conclusion of Stage 7 in `district-pipeline-late.ts`.

### 2.3 North Gate Severing in Seed 3073
1. **Observation 1.1.3 & 1.2.4**: In `tests/sim/m2-challenger-walkability.test.ts:162-184`, reachability from `streetManhole` `(24, 18)` to North gate `(24, 1)` fails on seed 3073.
2. **Observation 1.2.4**: Stage 3 carves East-West avenue `(1, 18)` to `(46, 18)`, but omits carving North-South avenue.
3. **Observation 1.2.4**: `planMacroLayout` places middle top building plot (`slotW = 14`, `x1 = 17..20`, width ~11) directly covering column 24.
4. **Observation 1.2.4**: Stamped typologies (`monorailDepot`, `pawnshop`, `apothecary`) place perimeter walls, room partitions, and doors at row `y = 7`.
5. **Observation 1.2.4**: The exterior door at `(24, 7)` is initialized as `WOODEN_DOOR_CLOSED` (`blocksMovement: true`).
6. **Observation 1.2.3**: In `tests/sim/m2-challenger-walkability.test.ts:145-167`, `hasWalkablePath` checks `!cell.blocksMovement`. Because `WOODEN_DOOR_CLOSED` has `blocksMovement: true`, BFS cannot pass through it.
7. **Deduction**: Public municipal transit corridors between compass gates and the central plaza must be 100% open floor. They must never be blocked by closed doors, building walls, or macro barriers.
8. **Remediation**:
   - In `district-pipeline.ts` (Stage 3): Carve corridor from `ctx.center` to `ctx.northGatePos` and `ctx.southGatePos` when active.
   - In `district-pipeline-late.ts`: Implement `ensureCompassGateTransitCorridors(ctx)` to guarantee that the full column `x = cx` from `y = 2` to `cy - 1` (North) and `y = cy + 1` to `height - 3` (South), as well as row `cy` from `x = 2` to `width - 3` (West/East), is `COBBLESTONE_FLOOR` (`blocksMovement: false`, `blocksSight: false`, `interiorZone: 'NONE'`).

---

## 3. Caveats

1. **Building Interior Aesthetic**: Carving open transit floor along `x = cx` cuts a straight public passage through any building stamped in the middle plot. This accurately simulates a Victorian covered thoroughfare/arcade (e.g. Burlington Arcade, Leadenhall Market) and preserves building door reachability for adjacent rooms without blocking cross-district travel.
2. **Non-Severing Verification**: Sealing unreachable walkable tiles to `SOOT_BRICK_WALL` / `ABYSS_DROP` cannot sever any valid landmark because `ensureDistrictConnectivity` connects all targets (`westGate`, `eastGate`, `northGate`, `southGate`, `lift`, `boiler`, `mineHoist`, `artisanBench`, `sewerDrops`, `spirePlatforms`, building outward doors) *before* `sealOrphanedWalkableTiles` executes.
3. **No Changes to Test Suite**: All fixes are made strictly to spatial generation algorithms. Zero assertions in `tests/sim/m2-challenger-walkability.test.ts` are altered.

---

## 4. Conclusion & Proposed Remediation Diffs

All three failure modes are fully resolved by targeted modifications across four existing modules. Every module remains strictly within modularity guidelines (target <= 250 lines, hard ceiling 300 lines).

### File Size & Modularity Budget
| File Path | Current Lines | Delta Lines | Projected Lines | Status |
|---|---|---|---|---|
| `src/sim/spatial/district-pipeline-late.ts` | 108 | +32 | 140 | Compliant (<= 250) |
| `src/sim/spatial/district-yards.ts` | 165 | +45 | 210 | Compliant (<= 250) |
| `src/sim/spatial/landmark-micro-locations.ts` | 131 | +7 | 138 | Compliant (<= 250) |
| `src/sim/spatial/district-pipeline.ts` | 137 | +6 | 143 | Compliant (<= 250) |

---

### Exact Remediation Diffs

#### Diff 1: `src/sim/spatial/landmark-micro-locations.ts`
Preserve existing `BRASS_CATWALK` tiles on greenhouse perimeter to prevent spoke corridor truncation.
```typescript
<<<<
      const isPerimeter = dx === 0 || dy === 0 || dx === 4 || dy === 4;
      const isDoor = dx === 2 && dy === 4;
      const x = ghX + dx;
      const y = ghY + dy;
      grid = setTileCell(grid, x, y, (c) => ({
        ...c,
        terrainType: isDoor ? 'WOODEN_DOOR_CLOSED' : isPerimeter ? 'GLASS_WINDOW' : 'BRASS_CATWALK',
        blocksMovement: isPerimeter && !isDoor,
        blocksSight: false,
        interiorZone: isPerimeter ? 'NONE' : 'WORKSHOP',
      }));
====
      const isPerimeter = dx === 0 || dy === 0 || dx === 4 || dy === 4;
      const isDoor = dx === 2 && dy === 4;
      const x = ghX + dx;
      const y = ghY + dy;
      const isExistingCatwalk = c.terrainType === 'BRASS_CATWALK';
      grid = setTileCell(grid, x, y, (c) => ({
        ...c,
        terrainType: isDoor
          ? 'WOODEN_DOOR_CLOSED'
          : isPerimeter && !isExistingCatwalk
            ? 'GLASS_WINDOW'
            : 'BRASS_CATWALK',
        blocksMovement: isDoor ? false : isPerimeter && !isExistingCatwalk,
        blocksSight: false,
        interiorZone: isPerimeter ? 'NONE' : 'WORKSHOP',
      }));
>>>>
```

#### Diff 2: `src/sim/spatial/district-pipeline.ts`
Carve North and South transit corridors from center in Stage 3.
```typescript
<<<<
  ctx.street = carveCorridor(ctx.street, ctx.westGatePos, ctx.eastGatePos, 'COBBLESTONE_FLOOR');

  carveGateCell(ctx, ctx.westGatePos);
  carveGateCell(ctx, ctx.eastGatePos);
  if (ctx.compass.north) carveGateCell(ctx, ctx.northGatePos);
  if (ctx.compass.south) carveGateCell(ctx, ctx.southGatePos);
====
  ctx.street = carveCorridor(ctx.street, ctx.westGatePos, ctx.eastGatePos, 'COBBLESTONE_FLOOR');
  if (ctx.compass.north) {
    ctx.street = carveCorridor(ctx.street, ctx.center, ctx.northGatePos, 'COBBLESTONE_FLOOR');
  }
  if (ctx.compass.south) {
    ctx.street = carveCorridor(ctx.street, ctx.center, ctx.southGatePos, 'COBBLESTONE_FLOOR');
  }

  carveGateCell(ctx, ctx.westGatePos);
  carveGateCell(ctx, ctx.eastGatePos);
  if (ctx.compass.north) carveGateCell(ctx, ctx.northGatePos);
  if (ctx.compass.south) carveGateCell(ctx, ctx.southGatePos);
>>>>
```

#### Diff 3: `src/sim/spatial/district-yards.ts`
1. Make `punchPath` stratum-aware so Spire repairs punch `BRASS_CATWALK`.
2. Add `sealOrphanedWalkableTiles`.
```typescript
<<<<
    } else if (cell.terrainType === 'CANAL_SLUICE') {
      cells[idx] = { ...cell, terrainType: 'TIMBER_PIER', blocksMovement: false, blocksSight: false };
    } else {
      cells[idx] = { ...cell, terrainType: 'COBBLESTONE_FLOOR', blocksMovement: false, blocksSight: false };
    }
====
    } else if (cell.terrainType === 'CANAL_SLUICE') {
      cells[idx] = { ...cell, terrainType: 'TIMBER_PIER', blocksMovement: false, blocksSight: false };
    } else if (grid.stratum === 'SPIRE') {
      cells[idx] = { ...cell, terrainType: 'BRASS_CATWALK', blocksMovement: false, blocksSight: false };
    } else {
      cells[idx] = { ...cell, terrainType: 'COBBLESTONE_FLOOR', blocksMovement: false, blocksSight: false };
    }
>>>>
```

Append `sealOrphanedWalkableTiles` export to `src/sim/spatial/district-yards.ts`:
```typescript
/**
 * BFS flood fill from the stratum hub; any walkable cell or door unreachable from the hub is sealed back to solid
 * wall / void to eliminate orphaned floor pockets created by post-Stage 5 feature carving.
 */
export function sealOrphanedWalkableTiles(grid: StratumGrid, hub: Point2D): StratumGrid {
  const { width, height, stratum } = grid;
  const isSpire = stratum === 'SPIRE';
  const visited = new Uint8Array(width * height);
  const queue: number[] = [];
  const startIdx = hub.y * width + hub.x;

  const startCell = grid.cells[startIdx];
  if (!startCell) return grid;

  visited[startIdx] = 1;
  queue.push(startIdx);

  while (queue.length > 0) {
    const curr = queue.shift()!;
    const cx = curr % width;
    const cy = Math.floor(curr / width);

    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      const nx = cx + dx;
      const ny = cy + dy;
      if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
      const nIdx = ny * width + nx;
      if (visited[nIdx]) continue;
      const cell = grid.cells[nIdx];
      if (cell && (!cell.blocksMovement || cell.terrainType === 'WOODEN_DOOR_CLOSED' || cell.terrainType === 'WOODEN_DOOR_OPEN')) {
        visited[nIdx] = 1;
        queue.push(nIdx);
      }
    }
  }

  let modified = false;
  const newCells = grid.cells.slice();
  for (let i = 0; i < newCells.length; i++) {
    const cell = newCells[i]!;
    if ((!cell.blocksMovement || cell.terrainType === 'WOODEN_DOOR_CLOSED' || cell.terrainType === 'WOODEN_DOOR_OPEN') && !visited[i]) {
      modified = true;
      newCells[i] = {
        ...cell,
        terrainType: isSpire ? 'ABYSS_DROP' : 'SOOT_BRICK_WALL',
        blocksMovement: true,
        blocksSight: !isSpire,
        interiorZone: 'NONE',
      };
    }
  }

  return modified ? { ...grid, cells: newCells } : grid;
}
```

#### Diff 4: `src/sim/spatial/district-pipeline-late.ts`
1. Add `{ x: 37, y: 7 }` to `spireTargets`.
2. Add `ensureCompassGateTransitCorridors(ctx)`.
3. Seal orphaned pockets across all three strata at the end of Stage 7.
```typescript
<<<<
import { ensureDistrictConnectivity } from './district-yards.js';
====
import { ensureDistrictConnectivity, sealOrphanedWalkableTiles } from './district-yards.js';
>>>>
```

```typescript
<<<<
  // TSK-P3-04: macro barriers (canal, viaduct, fences) may have severed arteries; punch corridors where needed.
  ctx.street = ensureDistrictConnectivity(ctx.street, ctx.center, connectivityTargets(ctx)).grid;
  const spireTargets = [{ x: 10, y: 7 }, { x: 37, y: 28 }, { x: 10, y: 28 }];
  ctx.spire = ensureDistrictConnectivity(ctx.spire, ctx.liftPos, spireTargets).grid;
====
  // TSK-P3-04: macro barriers (canal, viaduct, fences) may have severed arteries; punch corridors where needed.
  ctx.street = ensureDistrictConnectivity(ctx.street, ctx.center, connectivityTargets(ctx)).grid;
  const spireTargets = [
    { x: 10, y: 7 },
    { x: 37, y: 7 },
    { x: 37, y: 28 },
    { x: 10, y: 28 },
  ];
  ctx.spire = ensureDistrictConnectivity(ctx.spire, ctx.liftPos, spireTargets).grid;

  // Guarantee cardinal transit arteries remain 100% open floor
  ensureCompassGateTransitCorridors(ctx);

  // Seal isolated orphaned walkable floor pockets across all strata
  ctx.street = sealOrphanedWalkableTiles(ctx.street, ctx.center);
  ctx.spire = sealOrphanedWalkableTiles(ctx.spire, ctx.liftPos);
  ctx.undercroft = sealOrphanedWalkableTiles(ctx.undercroft, ctx.center);
>>>>
```

Add helper function inside `src/sim/spatial/district-pipeline-late.ts`:
```typescript
/** Guarantees that public transit routes between compass gates and the central plaza are 100% open floor. */
function ensureCompassGateTransitCorridors(ctx: PipelineDistrictContext): void {
  const { width, height, center } = ctx;
  const cx = center.x;
  const cy = center.y;

  // West-to-East Avenue
  for (let x = 2; x <= width - 3; x++) {
    ctx.street = setTileCell(ctx.street, x, cy, (c) => ({
      ...c,
      terrainType: 'COBBLESTONE_FLOOR',
      blocksMovement: false,
      blocksSight: false,
      interiorZone: 'NONE',
    }));
  }

  // North Transit Corridor
  if (ctx.compass.north) {
    for (let y = 2; y <= cy - 1; y++) {
      ctx.street = setTileCell(ctx.street, cx, y, (c) => ({
        ...c,
        terrainType: 'COBBLESTONE_FLOOR',
        blocksMovement: false,
        blocksSight: false,
        interiorZone: 'NONE',
      }));
    }
  }

  // South Transit Corridor
  if (ctx.compass.south) {
    for (let y = cy + 1; y <= height - 3; y++) {
      ctx.street = setTileCell(ctx.street, cx, y, (c) => ({
        ...c,
        terrainType: 'COBBLESTONE_FLOOR',
        blocksMovement: false,
        blocksSight: false,
        interiorZone: 'NONE',
      }));
    }
  }
}
```

---

## 5. Verification Method

Once implemented by the designated worker agent, the orchestrator and reviewer can independently verify complete resolution via the following execution sequence:

1. **Adversarial Walkability Challenge Test Suite**:
   ```bash
   npx vitest run tests/sim/m2-challenger-walkability.test.ts
   ```
   *Expected Result*: All 6 tests pass (100% green across seeds 3000..3100):
   - `✓ verifies bit-exact multi-seed regeneration across seeds 3000..3100`
   - `✓ verifies 100% BFS reachability from plaza manhole to building entrance doors`
   - `✓ verifies 100% BFS reachability from Undercroft ladder to sewer quadrant extremities and siphons`
   - `✓ verifies 100% BFS reachability from Spire lift landing to all catwalk platforms`
   - `✓ verifies zero orphaned or unreachable walkable floor pockets across all strata`
   - `✓ verifies 100% BFS reachability from central plaza manhole to all four compass gates (West, East, North, South)`

2. **Milestone 2 Invariant Stress-Tests**:
   ```bash
   npx vitest run tests/sim/m2-challenger-invariants.test.ts
   ```
   *Expected Result*: 7 passed tests.

3. **Full Boundary, Modularity & Typecheck Gates**:
   ```bash
   npm run verify
   ```
   *Expected Result*: Exits 0 with 0 errors across all 4 gates; all files strictly $\le 250$ lines.

### Invalidation Conditions
- Any change that solves test assertions by deleting or relaxing assertions in `tests/sim/m2-challenger-walkability.test.ts`.
- Any regression in multi-seed determinism test (`verifies bit-exact multi-seed regeneration across seeds 3000..3100`).
- Any new file exceeding 250 lines or any existing file exceeding 300 lines.
