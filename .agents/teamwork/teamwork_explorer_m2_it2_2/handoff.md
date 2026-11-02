# Handoff Report: Subterranean Sewer Topology & Mine Stope Geometry Fixes

**Role**: Subterranean Topology & Stope Geometry Fix Explorer (`teamwork_explorer`)  
**Target Files**:
1. `src/sim/spatial/sewer-topology.ts` (Current: 208 lines -> Post-fix: ~218 lines)
2. `src/sim/spatial/mines-generation.ts` (Current: 178 lines -> Post-fix: ~186 lines)

---

## 1. Observation

Direct inspection of test execution traces in `tests/sim/m2-challenger-invariants.test.ts`, reviewer reports (`teamwork_reviewer_m2_r2_2/handoff.md`), challenger reports (`teamwork_challenger_m2_r2_2/handoff.md`), and the source code reveals four discrete invariant violations across two subsystems:

### 1.1 Sewer Topology Invariant Failures
Command:
```bash
npx vitest run tests/sim/m2-challenger-invariants.test.ts
```
Verbatim test failures:
```
FAIL tests/sim/m2-challenger-invariants.test.ts > Milestone 2 Invariants Adversarial Challenge > Sewer Topology across 50 seeds (seeds 3001..3050) > preserves 100% BFS connectivity between north and south inspection walkways across weir crossovers
AssertionError: expected 2500 to be 500
 ❯ tests/sim/m2-challenger-invariants.test.ts:25:43
     23|             if (cell.terrainType === 'IRON_GRATE' && cell.liquidType === 'SLUICE_SLUDGE') {
     24|               expect(cell.blocksMovement).toBe(false);
     25|               expect(cell.liquidVolumeMl).toBe(500);

FAIL tests/sim/m2-challenger-invariants.test.ts > Milestone 2 Invariants Adversarial Challenge > Sewer Topology across 50 seeds (seeds 3001..3050) > validates 5x5 octagonal junction chambers contain valid catch basin sumps without trapping the player
AssertionError: expected 'IRON_GRATE' to be 'CANAL_SLUICE'
 ❯ tests/sim/m2-challenger-invariants.test.ts:51:39
     49|         const sumpCell = getTileCell(grid, catchBasinPos.x - 1, catchBasinPos.y);
     50|         expect(sumpCell).toBeDefined();
     51|         expect(sumpCell!.terrainType).toBe('CANAL_SLUICE');

FAIL tests/sim/m2-challenger-invariants.test.ts > Milestone 2 Invariants Adversarial Challenge > Sewer Topology across 50 seeds (seeds 3001..3050) > verifies miasma steam pressure and smoke ppm are seeded within specified ranges
AssertionError: expected 37 to be less than or equal to 25
 ❯ tests/sim/m2-challenger-invariants.test.ts:85:43
     82|           } else if (cell.terrainType === 'IRON_GRATE') {
     83|             expect(cell.smokePpm).toBeGreaterThanOrEqual(15);
     84|             expect(cell.smokePpm).toBeLessThanOrEqual(100);
     85|             expect(cell.steamPressureKpa).toBeLessThanOrEqual(25);
```

**Code Location in `src/sim/spatial/sewer-topology.ts`**:
- Lines 51–62 carve the recessed catch basin sump at `(cx - 1, cy)`:
  ```typescript
  if (!isEntry && inBounds(g, cx - 1, cy)) {
    g = setTileCell(g, cx - 1, cy, (cell) => ({
      ...cell,
      terrainType: 'CANAL_SLUICE',
      liquidType: 'SLUICE_SLUDGE',
      liquidVolumeMl: 2500,
      blocksMovement: true,
      blocksSight: false,
      smokePpm: rng.nextInt(180, 260),
      steamPressureKpa: rng.nextInt(25, 45),
    }));
  }
  ```
- Lines 127–137 carve the vertical flanking walkways in `carveDualChannelConduit`:
  ```typescript
  for (const wx of [x - 1, x + 1]) {
    if (inBounds(g, wx, y)) {
      g = setTileCell(g, wx, y, (c) => (c.blocksMovement ? {
        ...c,
        terrainType: 'IRON_GRATE',
        blocksMovement: false,
        blocksSight: false,
        coalDustDensity: 0.15,
        smokePpm: rng.nextInt(40, 80),
      } : c));
    }
  }
  ```
- Lines 100–108 perform the identical operation on horizontal flanking walkways:
  ```typescript
  for (const wy of [y - 1, y + 1]) {
    if (inBounds(g, x, wy)) {
      g = setTileCell(g, x, wy, (c) => (c.blocksMovement ? {
        ...c,
        terrainType: 'IRON_GRATE',
        blocksMovement: false,
        blocksSight: false,
        coalDustDensity: 0.15,
        smokePpm: rng.nextInt(40, 80),
      } : c));
    }
  }
  ```

---

### 1.2 Mine Stope Support Pillar Fusion Invariant Failure
Verbatim test failure:
```
FAIL tests/sim/m2-challenger-invariants.test.ts > Milestone 2 Invariants Adversarial Challenge > Mine Generation across 50 seeds (seeds 4001..4050) > verifies unexcavated stone support pillars at (cx ± 2, cy ± 2) in stopes have complete perimeter walkable rings
AssertionError: expected true to be false
 ❯ tests/sim/m2-challenger-invariants.test.ts:119:48
    117|               const neighbor = getTileCell(grid, pillar.x + off.dx, pillar.y + off.dy);
    118|               expect(neighbor).toBeDefined();
    119|               expect(neighbor!.blocksMovement).toBe(false);
```

**Code Location in `src/sim/spatial/mines-generation.ts`**:
- Lines 72–76 define stopes:
  ```typescript
  const stopeDefs = [
    { center: { x: Math.max(6, Math.floor(width * 0.22)), y: Math.max(6, Math.floor(height * 0.28)) }, radius: 3 },
    { center: { x: Math.min(width - 7, Math.floor(width * 0.78)), y: Math.max(6, Math.floor(height * 0.32)) }, radius: 3 },
    { center: { x: Math.floor(width * 0.5), y: Math.min(height - 7, Math.floor(height * 0.78)) }, radius: 4 },
  ];
  ```
- Lines 81–88 define pillar offsets and excavation boundary:
  ```typescript
  const pillarOffsets = [
    { dx: -2, dy: -2 }, { dx: 2, dy: -2 },
    { dx: -2, dy: 2 }, { dx: 2, dy: 2 },
  ];

  for (let dy = -radius; dy <= radius; dy++) {
    for (let dx = -radius; dx <= radius; dx++) {
      if (dx * dx + dy * dy > radius * radius + 1) continue;
  ```
- Lines 147–168 place `TIMBER_STRUT` shoring along drift edges:
  ```typescript
  if (adjacentWall && (x + y) % 7 === 0) {
    const testGrid = setTileCell(grid, x, y, (c) => ({ ...c, terrainType: 'TIMBER_STRUT', blocksMovement: true, blocksSight: false }));
    const allReachable = stopes.every((s) => hasWalkablePath(testGrid, hoistPos, s.center));
    if (allReachable) {
      grid = testGrid;
    }
  }
  ```

---

## 2. Logic Chain

### 2.1 Sewer Mechanics & Sump Protection Logic
1. **Observation 1.1**: The sump is placed at `(cx - 1, cy)` with `terrainType: 'CANAL_SLUICE'`, `liquidType: 'SLUICE_SLUDGE'`, `liquidVolumeMl: 2500`, `steamPressureKpa: 25..45`, and `blocksMovement: true`.
2. **Observation 1.1**: Vertical conduits connecting entry to anchors at column `cx` carve flanking walkways at columns `wx = cx - 1` and `wx = cx + 1` across row `y = cy`.
3. **Inference**: When evaluating `(cx - 1, cy)`, the condition `c.blocksMovement` evaluates to `true` because the sluice basin blocks movement.
4. **Inference**: The flanking walkway updater replaces `terrainType` with `'IRON_GRATE'`, sets `blocksMovement: false`, but spreads `...c`. Consequently:
   - Sump terrain is overwritten from `CANAL_SLUICE` to `IRON_GRATE` (causing Failure 2).
   - `liquidType: 'SLUICE_SLUDGE'` and `liquidVolumeMl: 2500` persist onto the `IRON_GRATE` cell. The weir test discovers this tile and expects 500 ml (causing Failure 1).
   - `steamPressureKpa: 25..45` (e.g. 37 kPa) persists onto the `IRON_GRATE` cell, violating the grate limit of 25 kPa (causing Failure 3).
5. **Deduction & Remedy**:
   - The flanking walkway updater in BOTH horizontal and vertical branches must check:
     ```typescript
     const isLiquidSluice = c.liquidType !== 'NONE' && c.terrainType === 'CANAL_SLUICE';
     if (c.blocksMovement && !isLiquidSluice) { ... }
     ```
   - Walkway grates must explicitly set `liquidType: 'NONE'`, `liquidVolumeMl: 0`, and clamp `steamPressureKpa: Math.min(c.steamPressureKpa ?? 0, 25)` (or `0`).
   - This preserves all `CANAL_SLUICE` sumps and canals completely untouched while ensuring all walkway grates are clean, dry, and low-pressure.

---

### 2.2 Mine Stope Support Pillar Geometry Logic
1. **Observation 1.2**: Support pillars are placed at offsets $(dx, dy) \in \{(-2, -2), (2, -2), (-2, 2), (2, 2)\}$.
2. **Observation 1.2**: For a pillar at `(-2, -2)`:
   - Adjacent orthogonal neighbor `(-3, -2)`: $dx^2 + dy^2 = (-3)^2 + (-2)^2 = 9 + 4 = 13$.
   - Adjacent orthogonal neighbor `(-2, -3)`: $dx^2 + dy^2 = (-2)^2 + (-3)^2 = 4 + 9 = 13$.
   - Adjacent diagonal neighbor `(-3, -3)`: $dx^2 + dy^2 = (-3)^2 + (-3)^2 = 9 + 9 = 18$.
3. **Observation 1.2**: In stopes 0 and 1, `radius: 3`, so the carving filter is $dx^2 + dy^2 \le 3^2 + 1 = 10$.
   - Because $13 > 10$ and $18 > 10$, cells `(-3, -2)`, `(-2, -3)`, and `(-3, -3)` are skipped. They remain untouched `SOOT_BRICK_WALL` with `blocksMovement: true`.
4. **Observation 1.2**: Even in stope 2 where `radius: 4`:
   - $radius^2 + 1 = 4^2 + 1 = 17$.
   - For diagonal neighbor `(-3, -3)`: $18 > 17$.
   - Therefore, expanding radius to 4 alone is **insufficient**—the outer diagonal corner of each pillar remains unexcavated solid rock!
5. **Deduction & Remedy**:
   - Every pillar at offset $(po.dx, po.dy)$ requires an excavated 1-tile clearance halo:
     $$\forall (dx, dy): \max(|dx - po.dx|, |dy - po.dy|) \le 1$$
   - The stope excavation loop must iterate up to $\max(radius, 3)$ and carve any cell satisfying:
     ```typescript
     const isPillar = pillarOffsets.some((po) => po.dx === dx && po.dy === dy);
     const isPillarHalo = pillarOffsets.some((po) => Math.abs(dx - po.dx) <= 1 && Math.abs(dy - po.dy) <= 1);
     const inStopeRadius = dx * dx + dy * dy <= radius * radius + 1;

     if (!inStopeRadius && !isPillarHalo) continue;
     ```
   - If `isPillar` is true: carve `SOOT_BRICK_WALL` (`blocksMovement: true`).
   - Else: carve `SCORCHED_STONE` floor (`blocksMovement: false`).
   - Additionally, in Step 5 (timber strut shoring), prevent timber struts from being placed on any of the 8 perimeter neighbor cells:
     ```typescript
     const isNearPillar = stopes.some((s) => s.pillars.some((p) => Math.abs(x - p.x) <= 1 && Math.abs(y - p.y) <= 1));
     if (isNearPillar) continue;
     ```
   - Expanding `radius: 4` across all three stopes in `stopeDefs` further ensures natural cavern curvature enclosing the pillars.

---

## 3. Caveats

1. **Industrial District Fix Scope**: Finding 1 from Reviewer 2 / Challenger 2 (furnace foundation corridor overwrite in `industrial-district.ts`) is outside the subterranean/mine mandate for this explorer and is tracked separately.
2. **Zero Modification Invariant**: Per explorer directives, no source files were modified, and no test commands were executed during this turn.
3. **Modularity Constraints**: Target file lengths after applying proposed diffs:
   - `src/sim/spatial/sewer-topology.ts`: 208 lines $\to$ 218 lines (Target: $\le 250$, Hard ceiling: 300).
   - `src/sim/spatial/mines-generation.ts`: 178 lines $\to$ 188 lines (Target: $\le 250$, Hard ceiling: 300).

---

## 4. Conclusion & Exact Remediation Specifications

### 4.1 Specification for `src/sim/spatial/sewer-topology.ts`

#### Exact Before $\to$ After Diffs

**Diff 1: Flanking Walkways in Horizontal Conduits (Lines 98–109)**
```typescript
<<<< CURRENT CODE (Lines 98-109)
        // Flanking walkways
        for (const wy of [y - 1, y + 1]) {
          if (inBounds(g, x, wy)) {
            g = setTileCell(g, x, wy, (c) => (c.blocksMovement ? {
              ...c,
              terrainType: 'IRON_GRATE',
              blocksMovement: false,
              blocksSight: false,
              coalDustDensity: 0.15,
              smokePpm: rng.nextInt(40, 80),
            } : c));
          }
        }
==== PROPOSED REPLACEMENT
        // Flanking walkways
        for (const wy of [y - 1, y + 1]) {
          if (inBounds(g, x, wy)) {
            g = setTileCell(g, x, wy, (c) => {
              const isLiquidSluice = c.liquidType !== 'NONE' && c.terrainType === 'CANAL_SLUICE';
              if (c.blocksMovement && !isLiquidSluice) {
                return {
                  ...c,
                  terrainType: 'IRON_GRATE',
                  liquidType: 'NONE',
                  liquidVolumeMl: 0,
                  blocksMovement: false,
                  blocksSight: false,
                  coalDustDensity: 0.15,
                  smokePpm: rng.nextInt(40, 80),
                  steamPressureKpa: Math.min(c.steamPressureKpa ?? 0, 25),
                };
              }
              return c;
            });
          }
        }
>>>>
```

**Diff 2: Flanking Walkways in Vertical Conduits (Lines 127–138)**
```typescript
<<<< CURRENT CODE (Lines 127-138)
        for (const wx of [x - 1, x + 1]) {
          if (inBounds(g, wx, y)) {
            g = setTileCell(g, wx, y, (c) => (c.blocksMovement ? {
              ...c,
              terrainType: 'IRON_GRATE',
              blocksMovement: false,
              blocksSight: false,
              coalDustDensity: 0.15,
              smokePpm: rng.nextInt(40, 80),
            } : c));
          }
        }
==== PROPOSED REPLACEMENT
        for (const wx of [x - 1, x + 1]) {
          if (inBounds(g, wx, y)) {
            g = setTileCell(g, wx, y, (c) => {
              const isLiquidSluice = c.liquidType !== 'NONE' && c.terrainType === 'CANAL_SLUICE';
              if (c.blocksMovement && !isLiquidSluice) {
                return {
                  ...c,
                  terrainType: 'IRON_GRATE',
                  liquidType: 'NONE',
                  liquidVolumeMl: 0,
                  blocksMovement: false,
                  blocksSight: false,
                  coalDustDensity: 0.15,
                  smokePpm: rng.nextInt(40, 80),
                  steamPressureKpa: Math.min(c.steamPressureKpa ?? 0, 25),
                };
              }
              return c;
            });
          }
        }
>>>>
```

**Diff 3: Entry Landing Tile Hygiene (Lines 191–197)**
```typescript
<<<< CURRENT CODE (Lines 191-197)
  // Guarantee entry landing tile is walkable
  grid = setTileCell(grid, entryPos.x, entryPos.y, (c) => ({
    ...c,
    terrainType: 'IRON_GRATE',
    blocksMovement: false,
    blocksSight: false,
  }));
==== PROPOSED REPLACEMENT
  // Guarantee entry landing tile is walkable
  grid = setTileCell(grid, entryPos.x, entryPos.y, (c) => ({
    ...c,
    terrainType: 'IRON_GRATE',
    liquidType: 'NONE',
    liquidVolumeMl: 0,
    blocksMovement: false,
    blocksSight: false,
  }));
>>>>
```

---

### 4.2 Specification for `src/sim/spatial/mines-generation.ts`

#### Exact Before $\to$ After Diffs

**Diff 1: Stope Definitions Radius Expansion (Lines 72–76)**
```typescript
<<<< CURRENT CODE (Lines 72-76)
  const stopeDefs = [
    { center: { x: Math.max(6, Math.floor(width * 0.22)), y: Math.max(6, Math.floor(height * 0.28)) }, radius: 3 },
    { center: { x: Math.min(width - 7, Math.floor(width * 0.78)), y: Math.max(6, Math.floor(height * 0.32)) }, radius: 3 },
    { center: { x: Math.floor(width * 0.5), y: Math.min(height - 7, Math.floor(height * 0.78)) }, radius: 4 },
  ];
==== PROPOSED REPLACEMENT
  const stopeDefs = [
    { center: { x: Math.max(6, Math.floor(width * 0.22)), y: Math.max(6, Math.floor(height * 0.28)) }, radius: 4 },
    { center: { x: Math.min(width - 7, Math.floor(width * 0.78)), y: Math.max(6, Math.floor(height * 0.32)) }, radius: 4 },
    { center: { x: Math.floor(width * 0.5), y: Math.min(height - 7, Math.floor(height * 0.78)) }, radius: 4 },
  ];
>>>>
```

**Diff 2: Pillar Clearance Halo and Radial Excavation (Lines 86–107)**
```typescript
<<<< CURRENT CODE (Lines 86-107)
    for (let dy = -radius; dy <= radius; dy++) {
      for (let dx = -radius; dx <= radius; dx++) {
        if (dx * dx + dy * dy > radius * radius + 1) continue;
        const x = center.x + dx;
        const y = center.y + dy;
        if (!inBounds(grid, x, y)) continue;

        const isPillar = pillarOffsets.some((po) => po.dx === dx && po.dy === dy);
        if (isPillar) {
          pillars.push({ x, y });
          grid = setTileCell(grid, x, y, (c) => ({ ...c, terrainType: 'SOOT_BRICK_WALL', blocksMovement: true, blocksSight: true }));
        } else {
          grid = setTileCell(grid, x, y, (c) => ({
            ...c,
            terrainType: 'SCORCHED_STONE',
            blocksMovement: false,
            blocksSight: false,
            coalDustDensity: 0.45,
            smokePpm: rng.nextInt(20, 60),
          }));
        }
      }
    }
==== PROPOSED REPLACEMENT
    const maxExtent = Math.max(radius, 3);
    for (let dy = -maxExtent; dy <= maxExtent; dy++) {
      for (let dx = -maxExtent; dx <= maxExtent; dx++) {
        const isPillar = pillarOffsets.some((po) => po.dx === dx && po.dy === dy);
        const isPillarHalo = pillarOffsets.some((po) => Math.abs(dx - po.dx) <= 1 && Math.abs(dy - po.dy) <= 1);
        const inStopeRadius = dx * dx + dy * dy <= radius * radius + 1;

        if (!inStopeRadius && !isPillarHalo) continue;
        const x = center.x + dx;
        const y = center.y + dy;
        if (!inBounds(grid, x, y)) continue;

        if (isPillar) {
          pillars.push({ x, y });
          grid = setTileCell(grid, x, y, (c) => ({ ...c, terrainType: 'SOOT_BRICK_WALL', blocksMovement: true, blocksSight: true }));
        } else {
          grid = setTileCell(grid, x, y, (c) => ({
            ...c,
            terrainType: 'SCORCHED_STONE',
            blocksMovement: false,
            blocksSight: false,
            coalDustDensity: 0.45,
            smokePpm: rng.nextInt(20, 60),
          }));
        }
      }
    }
>>>>
```

**Diff 3: Timber Strut Pillar Protection Guard (Lines 158–168)**
```typescript
<<<< CURRENT CODE (Lines 158-168)
      if (adjacentWall && (x + y) % 7 === 0) {
        // Test if placing timber strut keeps reachability to all stopes
        const testGrid = setTileCell(grid, x, y, (c) => ({ ...c, terrainType: 'TIMBER_STRUT', blocksMovement: true, blocksSight: false }));
        const allReachable = stopes.every((s) => hasWalkablePath(testGrid, hoistPos, s.center));
        if (allReachable) {
          grid = testGrid;
        }
      }
==== PROPOSED REPLACEMENT
      // Never place timber struts within the 8-cell perimeter ring of support pillars
      const isNearPillar = stopes.some((s) => s.pillars.some((p) => Math.abs(x - p.x) <= 1 && Math.abs(y - p.y) <= 1));
      if (isNearPillar) continue;

      if (adjacentWall && (x + y) % 7 === 0) {
        // Test if placing timber strut keeps reachability to all stopes
        const testGrid = setTileCell(grid, x, y, (c) => ({ ...c, terrainType: 'TIMBER_STRUT', blocksMovement: true, blocksSight: false }));
        const allReachable = stopes.every((s) => hasWalkablePath(testGrid, hoistPos, s.center));
        if (allReachable) {
          grid = testGrid;
        }
      }
>>>>
```

---

## 5. Verification Method

Once the implementer applies the diffs above, independent verification can be confirmed with:

1. **Sewer & Mine Invariant Verification**:
   ```bash
   npx vitest run tests/sim/m2-challenger-invariants.test.ts
   ```
   *Expected Outcome*:
   - `preserves 100% BFS connectivity between north and south inspection walkways across weir crossovers` $\to$ **PASS**
   - `validates 5x5 octagonal junction chambers contain valid catch basin sumps without trapping the player` $\to$ **PASS**
   - `verifies miasma steam pressure and smoke ppm are seeded within specified ranges` $\to$ **PASS**
   - `verifies unexcavated stone support pillars at (cx ± 2, cy ± 2) in stopes have complete perimeter walkable rings` $\to$ **PASS**
   - `verifies all TIMBER_STRUT placements are non-severing` $\to$ **PASS**
   - `verifies narrow-gauge rail corridors reach active stopes` $\to$ **PASS**

2. **Regression Check on Multi-Stratum Worldgen Suite**:
   ```bash
   npx vitest run tests/sim/multi-stratum-worldgen.test.ts
   ```
   *Expected Outcome*: All 4 tests pass (seed determinism, BFS reachability, portal transitions).

3. **Boundary & Modularity Ceiling Check**:
   ```bash
   npm run check:boundaries
   ```
   *Expected Outcome*: 0 boundary violations; all files strictly $\le 300$ lines (`sewer-topology.ts` at ~218 lines, `mines-generation.ts` at ~188 lines).

4. **Invalidation Conditions**:
   - Any modification that overwrites `CANAL_SLUICE` cells during conduit carving.
   - Any geometry change that leaves any of the 8 neighbor cells around `(cx ± 2, cy ± 2)` unexcavated or blocked by `SOOT_BRICK_WALL` or `TIMBER_STRUT`.
   - Modifying `m2-challenger-invariants.test.ts` to weaken assertions rather than adhering to these generator fixes.
