# Milestone 2 Invariants Challenge Report: Subterranean & Industrial Generation

## Verdict: REJECT

---

## 1. Observation

Direct empirical execution of the stress test harness `tests/sim/m2-challenger-invariants.test.ts` across 50 random seeds per generator confirms **5 test failures** across the sewer topology, mine generation, and heavy industrial sector generators.

### 1.1 Tool Command and Verbatim Execution Output
Command:
```bash
npx vitest run tests/sim/m2-challenger-invariants.test.ts
```

Output:
```
 RUN  v2.1.9 /Users/emmett/Desktop/Game

 ❯ tests/sim/m2-challenger-invariants.test.ts (7) 352ms
   ❯ Milestone 2 Invariants Adversarial Challenge (7) 351ms
     ❯ Sewer Topology across 50 seeds (seeds 3001..3050) (3)
       × preserves 100% BFS connectivity between north and south inspection walkways across weir crossovers
       × validates 5x5 octagonal junction chambers contain valid catch basin sumps without trapping the player
       × verifies miasma steam pressure and smoke ppm are seeded within specified ranges
     ❯ Mine Generation across 50 seeds (seeds 4001..4050) (3) 326ms
       × verifies unexcavated stone support pillars at (cx ± 2, cy ± 2) in stopes have complete perimeter walkable rings
       ✓ verifies all TIMBER_STRUT placements are non-severing (100% reachability from hoist cage to all stopes)
       ✓ verifies narrow-gauge rail corridors reach active stopes
     ❯ Heavy Industrial Sector across 50 seeds (seeds 5001..5050) (1)
       × verifies smelting furnace thermal halo exists, furnace is unobstructed, and conveyor run is unbroken

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯ Failed Tests 5 ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯

 FAIL  tests/sim/m2-challenger-invariants.test.ts > Milestone 2 Invariants Adversarial Challenge > Sewer Topology across 50 seeds (seeds 3001..3050) > preserves 100% BFS connectivity between north and south inspection walkways across weir crossovers
AssertionError: expected 2500 to be 500 // Object.is equality

- Expected
+ Received

- 500
+ 2500

 ❯ tests/sim/m2-challenger-invariants.test.ts:25:43
     23|             if (cell.terrainType === 'IRON_GRATE' && cell.liquidType === 'SLUICE_SLUDGE') {
     24|               expect(cell.blocksMovement).toBe(false);
     25|               expect(cell.liquidVolumeMl).toBe(500);
       |                                           ^

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/5]⎯

 FAIL  tests/sim/m2-challenger-invariants.test.ts > Milestone 2 Invariants Adversarial Challenge > Sewer Topology across 50 seeds (seeds 3001..3050) > validates 5x5 octagonal junction chambers contain valid catch basin sumps without trapping the player
AssertionError: expected 'IRON_GRATE' to be 'CANAL_SLUICE' // Object.is equality

Expected: "CANAL_SLUICE"
Received: "IRON_GRATE"

 ❯ tests/sim/m2-challenger-invariants.test.ts:51:39
     49|         const sumpCell = getTileCell(grid, catchBasinPos.x - 1, catchBasinPos.y);
     50|         expect(sumpCell).toBeDefined();
     51|         expect(sumpCell!.terrainType).toBe('CANAL_SLUICE');
       |                                       ^
     52|         expect(sumpCell!.liquidType).toBe('SLUICE_SLUDGE');
     53|         expect(sumpCell!.liquidVolumeMl).toBe(2500);

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[2/5]⎯

 FAIL  tests/sim/m2-challenger-invariants.test.ts > Milestone 2 Invariants Adversarial Challenge > Sewer Topology across 50 seeds (seeds 3001..3050) > verifies miasma steam pressure and smoke ppm are seeded within specified ranges
AssertionError: expected 37 to be less than or equal to 25
 ❯ tests/sim/m2-challenger-invariants.test.ts:85:43
     83|             expect(cell.smokePpm).toBeGreaterThanOrEqual(15);
     84|             expect(cell.smokePpm).toBeLessThanOrEqual(100);
     85|             expect(cell.steamPressureKpa).toBeLessThanOrEqual(25);
       |                                           ^

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[3/5]⎯

 FAIL  tests/sim/m2-challenger-invariants.test.ts > Milestone 2 Invariants Adversarial Challenge > Mine Generation across 50 seeds (seeds 4001..4050) > verifies unexcavated stone support pillars at (cx ± 2, cy ± 2) in stopes have complete perimeter walkable rings
AssertionError: expected true to be false // Object.is equality

- Expected
+ Received

- false
+ true

 ❯ tests/sim/m2-challenger-invariants.test.ts:119:48
    117|               const neighbor = getTileCell(grid, pillar.x + off.dx, pillar.y + off.dy);
    118|               expect(neighbor).toBeDefined();
    119|               expect(neighbor!.blocksMovement).toBe(false);
       |                                                ^

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[4/5]⎯

 FAIL  tests/sim/m2-challenger-invariants.test.ts > Milestone 2 Invariants Adversarial Challenge > Heavy Industrial Sector across 50 seeds (seeds 5001..5050) > verifies smelting furnace thermal halo exists, furnace is unobstructed, and conveyor run is unbroken
AssertionError: expected 0 to be greater than or equal to 45
 ❯ tests/sim/m2-challenger-invariants.test.ts:186:45
    184|             const hCell = getTileCell(grid, furnacePos.x + dx, furnacePos.y + dy);
    185|             expect(hCell).toBeDefined();
    186|             expect(hCell!.steamPressureKpa).toBeGreaterThanOrEqual(45);
       |                                             ^
    187|             expect(hCell!.smokePpm).toBeGreaterThanOrEqual(140);
    188|             expect(hCell!.coalDustDensity).toBeGreaterThanOrEqual(0.35);

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[5/5]⎯

 Test Files  1 failed (1)
      Tests  5 failed | 2 passed (7)
   Duration  1.11s
```

### 1.2 Boundary and Type Checks
- `tests/sim/m2-challenger-invariants.test.ts`: **216 lines** (POSIX wc -l), satisfying the $\le 250$-line limit and 300-line modularity ceiling.
- `npm run check:boundaries`: Checked 424 files, **0 violations**.
- `npm run typecheck`: **0 errors**.

---

## 2. Logic Chain

### 2.1 Bug 1 & 2: Catch Basin Sump Obliteration & Walkway Sludge Leaks in Sewers
- **Observation**:
  In `src/sim/spatial/sewer-topology.ts:51-62`, `carveOctagonalChamber` carves a recessed sediment catch basin sump at `(cx - 1, cy)`:
  ```typescript
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
  ```
  Immediately afterward, in `carveVictorianSewerTopology` lines 182–185, `carveDualChannelConduit(grid, entryPos, anchor, rng)` connects each anchor chamber.
  In `carveDualChannelConduit` (lines 127–137), for the vertical conduit arriving at column `cx = anchor.x`, the flanking walkways are stamped along columns `wx = cx - 1` and `wx = cx + 1`:
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
- **Inference**:
  Because the catch basin sump at `(cx - 1, cy)` has `blocksMovement: true`, `c.blocksMovement` evaluates to `true` when the vertical walkway visits `(cx - 1, cy)`.
  1. The sump is overwritten into `IRON_GRATE` with `blocksMovement: false`. The catch basin sump ceases to exist in the generated stratum (`expected 'CANAL_SLUICE', received 'IRON_GRATE'`).
  2. Because the update spreads `...c`, the resulting `IRON_GRATE` cell retains `liquidType: 'SLUICE_SLUDGE'`, `liquidVolumeMl: 2500`, and `steamPressureKpa: 25..45` (reaching up to 37 kPa, exceeding the 25 kPa ceiling for grates).
  3. Tests searching for weir crossovers encounter this corrupted `IRON_GRATE` tile containing 2500 ml of sludge instead of 500 ml.

### 2.2 Bug 3: Mine Support Pillars Fused to Cavern Walls
- **Observation**:
  The worker claimed in `handoff.md` lines 91–92:
  *"Three terminal stopes (R = 3 to 4) with preserved unmined natural rock columns at (cx ± 2, cy ± 2) ('SOOT_BRICK_WALL'), each encircled by a full ring of walkable floor."*
  In `src/sim/spatial/mines-generation.ts:72-76`, stopes 0 and 1 are defined with `radius = 3`.
  The stope carving loop (line 88) enforces:
  ```typescript
  if (dx * dx + dy * dy > radius * radius + 1) continue;
  ```
  For radius 3, `radius * radius + 1 = 10`.
  Support pillars are placed at offsets `(dx, dy) \in \{(-2, -2), (2, -2), (-2, 2), (2, 2)\}`.
- **Inference**:
  For pillar `(-2, -2)`:
  - Western adjacent tile `(-3, -2)`: $(-3)^2 + (-2)^2 = 9 + 4 = 13 > 10$. Not carved; remains solid rock (`SOOT_BRICK_WALL`, `blocksMovement: true`).
  - Northern adjacent tile `(-2, -3)`: $(-2)^2 + (-3)^2 = 4 + 9 = 13 > 10$. Not carved; remains solid rock (`SOOT_BRICK_WALL`, `blocksMovement: true`).
  - Northwestern diagonal tile `(-3, -3)`: $(-3)^2 + (-3)^2 = 18 > 10$. Not carved; remains solid rock (`SOOT_BRICK_WALL`, `blocksMovement: true`).
  Because multiple adjacent perimeter tiles are solid rock, the pillar is physically fused to the cavern wall. It does **not** have a complete perimeter walkable ring.

### 2.3 Bug 4: Smelting Furnace Thermal Halo Obliteration and Avenue Obstruction
- **Observation**:
  In `src/sim/spatial/industrial-district.ts:42`, `furnacePos` is `{ x: ox + 6, y: oy + 3 }`.
  In lines 76–90, a 5x5 thermal halo is stamped around `furnacePos`, setting `steamPressureKpa >= 45` and `smokePpm >= 140`.
  The furnace entity is stamped with `blocksMovement: true` (line 72).
  Then in line 200:
  ```typescript
  grid = carveCorridor(grid, { x: ox + 6, y: railY + 1 }, { x: ox + 6, y: Math.max(1, oy - 2) }, 'COBBLESTONE_FLOOR');
  ```
  In `src/sim/spatial/district-layout.ts:70-75`, `carveCorridor` unconditionally resets every traversed cell:
  ```typescript
  next = setTileCell(next, currX, currY, () => ({
    terrainType,
    blocksMovement: false,
    blocksSight: false,
    steamPressureKpa: 0,
    coalDustDensity: 0,
  }));
  ```
- **Inference**:
  The corridor is carved along column `x = ox + 6` from `y = railY + 1` (e.g. 29) to `y = oy - 2` (e.g. 18).
  This path passes directly through `furnacePos` at `(ox + 6, oy + 3)`.
  1. `carveCorridor` overwrites the furnace tile `(ox + 6, oy + 3)`, resetting its `steamPressureKpa` to `0`, `coalDustDensity` to `0`, and changing its terrain from `SCORCHED_STONE` to `COBBLESTONE_FLOOR`.
  2. The blocking furnace entity (`blocksMovement: true`) is left sitting squarely in the middle of a pedestrian thoroughfare intended to connect the sector to the main avenue.

---

## 3. Caveats

- `TIMBER_STRUT` non-severing placement checks and narrow-gauge rail corridor reachability tests in `mines-generation.ts` passed 100% across all 50 seeds.
- The continuous conveyor run (6 tiles) and high-pressure accumulator vessels (350 kPa) in `industrial-district.ts` passed all structural specifications.
- The failures identified are pure simulation/procedural generation defects in `src/sim/spatial/sewer-topology.ts`, `src/sim/spatial/mines-generation.ts`, and `src/sim/spatial/industrial-district.ts`.

---

## 4. Conclusion

**Verdict: REJECT.**

The worker's claims in `teamwork_worker_m2_r2/handoff.md` regarding invariant compliance are empirically refuted by `tests/sim/m2-challenger-invariants.test.ts`. Four actionable code fixes are required from the worker:

1. **`src/sim/spatial/sewer-topology.ts`**:
   - In `carveDualChannelConduit`, do not overwrite existing liquid cells (`c.liquidType !== 'NONE' && c.terrainType === 'CANAL_SLUICE'`) when stamping walkways.
   - When converting cells to `IRON_GRATE` walkways, reset `liquidType: 'NONE'`, `liquidVolumeMl: 0`, and clamp `steamPressureKpa` appropriately rather than spreading `...c`.
2. **`src/sim/spatial/mines-generation.ts`**:
   - Ensure stopes containing pillars at `(cx ± 2, cy ± 2)` have a sufficiently large excavation radius ($R \ge 4$), or adjust the pillar offsets to `(cx ± 1, cy ± 1)` / expand the stope boundary so that all 8 perimeter neighbors around each pillar are excavated into `SCORCHED_STONE` floor.
3. **`src/sim/spatial/industrial-district.ts`**:
   - Move the avenue corridor in line 200 to an unobstructed column (e.g., `ox + 5` or `ox + 7`) so it does not collide with `furnacePos` (`ox + 6, oy + 3`), or carve the corridor *before* applying the furnace and thermal halo.

---

## 5. Verification Method

To independently reproduce these findings and verify future fixes:

1. **Run the Challenger Invariants Test Suite**:
   ```bash
   npx vitest run tests/sim/m2-challenger-invariants.test.ts
   ```
   *Current Result*: 5 failed, 2 passed.
   *Target Result for Approval*: All 7 tests passed across all 50 seeds.
2. **Typecheck & Modularity Gate**:
   ```bash
   npm run typecheck
   npm run check:boundaries
   ```
   *Expected Result*: 0 type errors, 0 boundary violations.

### Invalidation Conditions
- Any change to `tests/sim/m2-challenger-invariants.test.ts` that weakens the assertions (e.g. removing the perimeter ring check or reducing the seed count below 50) without fixing the underlying generator bugs.
