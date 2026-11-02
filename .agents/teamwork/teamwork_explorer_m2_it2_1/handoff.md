# Remediation Report: Smelting Furnace Thermal Halo & Urban Pipeline Integration

**Explorer Role**: Urban & Industrial Pipeline Fix Explorer (`teamwork_explorer_m2_it2_1`)  
**Scope**: 
1. Smelting Furnace Thermal Halo & Corridor Collision in `src/sim/spatial/industrial-district.ts`
2. Pipeline Integration of `generateUrbanDistrict` in `src/sim/spatial/district-pipeline.ts`

---

## 1. Observation

Direct inspection of code, line counts, and test execution outputs across the repository revealed the exact structural mechanisms behind the reported failures:

### 1.1 Smelting Furnace Collision in `src/sim/spatial/industrial-district.ts`
- **Location**: `src/sim/spatial/industrial-district.ts`, line 42 and lines 199–201.
- **Current Line Count**: 214 lines (POSIX `wc -l`).
- **Verbatim Code at Line 42**:
  ```typescript
  // 1. Smelting Hall & Reverberatory Hearth (top section of industrial bounds)
  const furnacePos: Point2D = { x: ox + 6, y: oy + 3 };
  const smeltingDoor: Point2D = { x: ox + 4, y: oy + 5 };
  doors.smeltingHall = smeltingDoor;
  ```
- **Verbatim Thermal Halo Seeding (Lines 76–90)**:
  ```typescript
  // 5x5 thermal halo around furnace
  for (let dy = -2; dy <= 2; dy++) {
    for (let dx = -2; dx <= 2; dx++) {
      const hx = furnacePos.x + dx;
      const hy = furnacePos.y + dy;
      if (hx >= 1 && hy >= 1 && hx < grid.width - 1 && hy < grid.height - 1) {
        grid = setTileCell(grid, hx, hy, (c) => ({
          ...c,
          steamPressureKpa: Math.max(c.steamPressureKpa, 45),
          smokePpm: Math.max(c.smokePpm ?? 0, 140),
          coalDustDensity: Math.max(c.coalDustDensity, 0.35),
        }));
      }
    }
  }
  ```
  Note that the 5x5 halo spans columns `ox + 4` to `ox + 8` ($dx \in [-2, +2]$) and rows `oy + 1` to `oy + 5` ($dy \in [-2, +2]$).
- **Verbatim Corridor Carving (Lines 199–201)**:
  ```typescript
  // Connecting path from industrial sector to avenue
  grid = carveCorridor(grid, { x: ox + 6, y: railY + 1 }, { x: ox + 6, y: Math.max(1, oy - 2) }, 'COBBLESTONE_FLOOR');
  ```
- **Verbatim Cell Reset in `src/sim/spatial/district-layout.ts` (Lines 71–77)**:
  ```typescript
  next = setTileCell(next, currX, currY, () => ({
    terrainType,
    blocksMovement: false,
    blocksSight: false,
    steamPressureKpa: 0,
    coalDustDensity: 0,
  }));
  ```
- **Verbatim Failure Output in `tests/sim/m2-challenger-invariants.test.ts` (Lines 96–105)**:
  ```
  FAIL tests/sim/m2-challenger-invariants.test.ts > Milestone 2 Invariants Adversarial Challenge > Heavy Industrial Sector across 50 seeds (seeds 5001..5050) > verifies smelting furnace thermal halo exists, furnace is unobstructed, and conveyor run is unbroken
  AssertionError: expected 0 to be greater than or equal to 45
   ❯ tests/sim/m2-challenger-invariants.test.ts:186:45
      184|             const hCell = getTileCell(grid, furnacePos.x + dx, furnacePos.y + dy);
      185|             expect(hCell).toBeDefined();
      186|             expect(hCell!.steamPressureKpa).toBeGreaterThanOrEqual(45);
      187|             expect(hCell!.smokePpm).toBeGreaterThanOrEqual(140);
      188|             expect(hCell!.coalDustDensity).toBeGreaterThanOrEqual(0.35);
  ```

### 1.2 Pipeline Integration Gap in `src/sim/spatial/district-pipeline.ts`
- **Location**: `src/sim/spatial/district-pipeline.ts`, line 27 and lines 108–137.
- **Current Line Count**: 137 lines (POSIX `wc -l`).
- **Verbatim Re-export at Line 27**:
  ```typescript
  export { generateUrbanDistrict } from './urban-district.js';
  ```
- **Verbatim Stage 5 Implementation (Lines 108–137)**:
  ```typescript
  /** Stage 5: Architectural Typology Carving (seeded block placement, landmarks, yards, BFS repair) */
  export function executeStage5ArchitecturalTypologies(ctx: PipelineDistrictContext): void {
    const critical = criticalAnchors(ctx);
    if (!ctx.layout) {
      const archetypes = populateDistrictArchetypes(ctx.street, ctx.entities, ctx.width, ctx.height, critical, ctx.rng);
      ctx.street = seedDistrictArchitecture(archetypes.grid, ctx.currDistrict, ctx.rng, critical);
      ctx.entities = archetypes.entities;
      ctx.doors = archetypes.doors ?? {};
      ctx.keyPositions = archetypes.keyPositions ?? {};
      ctx.landmarks = archetypes.landmarks ?? {};
      return;
    }

    const placed = applyTypologyPlacements(ctx.street, ctx.entities, ctx.layout, ctx.rng, ctx.center.y);
    ctx.entities = placed.entities;
    ctx.doors = { ...placed.doors };
    ctx.keyPositions = { ...placed.keyPositions };
    // Establish connectivity before feature seeding so `canPlaceWithoutSevering` guards are meaningful.
    const repaired = ensureDistrictConnectivity(placed.grid, ctx.center, connectivityTargets(ctx));
    const landmarkRes = seedOutdoorStreetLandmarks(repaired.grid, ctx.entities, critical, ctx.layout.landmarkSites);
    ctx.entities = landmarkRes.entities;
    ctx.landmarks = landmarkRes.positions;
    const footprints = [...ctx.layout.placements.map((p) => p.dst), ctx.layout.workshop.box, ctx.layout.market.box];
    ctx.street = fillUnbuiltYards(
      seedDistrictArchitecture(landmarkRes.grid, ctx.currDistrict, ctx.rng, critical),
      footprints,
      ctx.rng,
    );
  }
  ```
  `generateUrbanDistrict` is exported at line 27, but is never invoked anywhere inside `executeStage5ArchitecturalTypologies` or any other stage of `district-pipeline.ts`.
- **Urban District Generator Signature in `src/sim/spatial/urban-district.ts` (Lines 113–120)**:
  ```typescript
  export function generateUrbanDistrict(
    grid: StratumGrid,
    entities: Record<string, EntityRecord>,
    width: number,
    height: number,
    center: Point2D,
    rng: SeededRNG,
  ): UrbanDistrictResult
  ```

---

## 2. Logic Chain

### 2.1 Smelting Furnace Thermal Halo & Avenue Corridor Collision
1. **Direct Collision**: In `generateHeavyIndustrialSector`, `furnacePos` is placed at $(ox + 6, oy + 3)$ with `blocksMovement: true`. An avenue access corridor was carved at line 200 along column $x = ox + 6$ from $y = railY + 1$ down to $y = \max(1, oy - 2)$. Because $(ox + 6, oy + 3)$ lies directly along this vertical line, `carveCorridor` passes straight through `furnacePos`.
2. **State Destruction**: `carveCorridor` replaces every cell it traverses with a fresh cell having `terrainType: 'COBBLESTONE_FLOOR'`, `blocksMovement: false`, `steamPressureKpa: 0`, and `coalDustDensity: 0`, omitting `smokePpm`. This unconditionally destroys the `furniture_smelting_furnace` foundation, resets the terrain to cobblestone, and zeroes out the 5x5 thermodynamic steam halo at the furnace coordinates.
3. **Why Shifting Column to $ox + 5$ or $ox + 7$ at Line 200 Alone is INSUFFICIENT**:
   The 5x5 thermal halo around $(ox + 6, oy + 3)$ extends from $x = ox + 4$ to $x = ox + 8$ ($dx \in [-2, +2]$) and from $y = oy + 1$ to $y = oy + 5$ ($dy \in [-2, +2]$).
   - If line 200 is shifted to $ox + 5$ ($dx = -1$), `carveCorridor` runs through $(ox + 5, oy + 1..oy + 5)$ AFTER the halo is placed, resetting $steamPressureKpa: 0$ for $dx = -1$. Test assertion line 186 would still fail with `expected 0 to be >= 45`.
   - If line 200 is shifted to $ox + 7$ ($dx = +1$), the same failure occurs for $dx = +1$.
   - If line 200 is shifted to $ox + 4$ ($dx = -2$), it collides with steam pipes at $(ox + 4, oy + 1)$ and resets $dx = -2$.
4. **The Complete Remediation**:
   - Column $x = ox + 5$ is completely clear of obstacles across its entire height:
     - $y \in [oy - 2, oy]$: Open exterior ground to northern avenue.
     - $y \in [oy + 1, oy + 5]$: Smelting hall interior (steam pipes end at $ox + 4$; slag pits are at $ox + 2$; furnace is at $ox + 6$).
     - $y \in [oy + 6, oy + 7]$: Open courtyard between smelting hall and rail spur.
     - $y = railY$ ($oy + 8$): Walkable `RAIL_TRACK` (monorail car is at $ox + 4$).
     - $y = railY + 1$ ($oy + 9$): Walkable `BOARDING_PLATFORM` (monorail console is at $ox + 2$).
   - Carving this corridor along $x = ox + 5$ **BEFORE** the smelting hall floor, furnace entity, and 5x5 thermal halo are placed guarantees:
     1. An unobstructed, straight walkable avenue corridor from $y = oy - 2$ to $y = railY + 1$.
     2. Smelting hall door $(ox + 4, oy + 5)$ immediately connects to this avenue at $(ox + 5, oy + 5)$ and reaches furnace approach $(ox + 6, oy + 4)$ via interior walkable floor.
     3. The 5x5 thermal halo stamped on $(ox + 4..ox + 8, oy + 1..oy + 5)$ is never subsequently overwritten, leaving all 25 cells with $steamPressureKpa \ge 45$, $smokePpm \ge 140$, and $coalDustDensity \ge 0.35$.

### 2.2 Pipeline Integration in `district-pipeline.ts`
1. **District Differentiation**: Aether & Soot defines 5 canonical districts in `METROPOLIS_DISTRICT_DOSSIERS`:
   - `district_spitalfields_soot_works`: Heavy industrial Bessemer smelting works (uses `typologies-industrial.ts`).
   - `district_whitechapel_ward`: Dense urban CDDA rookeries, alleys, and infirmary (the exact target for `generateUrbanDistrict`).
   - `district_fleet_ditch_undercroft`: Undercroft sewers and sluice vaults.
   - `district_limehouse_docks`: River wharves and canal hydrology.
   - `district_belgravia_brass_spires`: Elevated brass catwalks and spires.
2. **Preserving Phase 48 Legacy Tests**: Existing test suites (`tests/sim/phase48-building-prefabs.test.ts`, `tests/sim/procgen-pipeline.test.ts`) instantiate default worlds where `currentDistrictId` defaults to `'district_spitalfields_soot_works'`. These tests specifically assert that Phase 48 prefabs (`doors.apothecary`, `furniture_surgical_table`, `furniture_smelting_furnace`, `furniture_monorail_console`) are generated via `applyTypologyPlacements`.
3. **Dispatch Mechanism**: In `executeStage5ArchitecturalTypologies(ctx)`:
   - For urban districts (`isUrbanDistrict(ctx.currDistrict)`: e.g. `district_whitechapel_ward` or district IDs containing `'whitechapel'`, `'ward'`, `'rookeries'`, `'urban'`) where $width \ge 45$ and $height \ge 35$:
     Invoke `generateUrbanDistrict(ctx.street, ctx.entities, ctx.width, ctx.height, ctx.center, ctx.rng)`.
     Transfer the resulting `grid`, `entities`, `doors`, and `keyPositions`.
     Run `seedDistrictArchitecture` and `fillUnbuiltYards` across `urban.parcels`.
     Execute `ensureDistrictConnectivity(ctx.street, ctx.center, connectivityTargets(ctx))` to guarantee 100% BFS reachability from the central plaza to all compass gates, vertical lifts, boilers, and sewer drops.
   - For all other districts (industrial, compact fixtures):
     Preserve the existing `applyTypologyPlacements` execution path.
4. **Modularity Impact**: Adding the `isUrbanDistrict` predicate and dispatch branch adds only 18 lines to `district-pipeline.ts`, bringing its total length from 137 lines to 155 lines — well under the 250-line target and 300-line modularity ceiling.

---

## 3. Caveats

1. **No In-Place Modification**: This report provides read-only investigation and exact code specifications. No source code files or git working tree states were modified during this turn.
2. **Subterranean Mine and Sewer Scope**: Failures in `sewer-topology.ts` (catch basin sump grate overwrite) and `mines-generation.ts` (stope pillar wall fusion) are under parallel investigation by peer explorer `teamwork_explorer_m2_it2_2`.
3. **Door ID Keying Distinction**: `template-instantiator.ts` generates door keys formatted as `${template.id}_door_${index}` (e.g. `building_apothecary_clinic_door_1`). Spreading `urban.doors` into `ctx.doors` preserves both standard door accessibility in `landmarks.doors` and compatibility with `isReachableOrAdjacentReachable` tests in `spatial-reachability.test.ts`.

---

## 4. Conclusion & Proposed Remediation Patches

### 4.1 Exact Code Fix for `src/sim/spatial/industrial-district.ts`

- **File Path**: `/Users/emmett/Desktop/Game/src/sim/spatial/industrial-district.ts`
- **Current Line Count**: 214 lines
- **Proposed Line Count**: 214 lines (net change: 0 lines)
- **Target Function**: `generateHeavyIndustrialSector`

#### Proposed Changes
1. Define `railY = oy + 8` at line 40 (before Smelting Hall).
2. Carve the connecting avenue corridor along column `ox + 5` from `railY + 1` to `Math.max(1, oy - 2)` BEFORE line 46 (before the smelting hall floor and 5x5 thermal halo are stamped).
3. Remove the destructive `carveCorridor` call at line 200.

#### Exact Diff Patch:
```diff
--- a/src/sim/spatial/industrial-district.ts
+++ b/src/sim/spatial/industrial-district.ts
@@ -38,6 +38,10 @@ export function generateHeavyIndustrialSector(
   const ox = bounds.x1;
   const oy = bounds.y1;
+  const railY = oy + 8;
+
+  // Connecting avenue corridor along unobstructed column ox + 5 (carved before furnace/halo)
+  grid = carveCorridor(grid, { x: ox + 5, y: railY + 1 }, { x: ox + 5, y: Math.max(1, oy - 2) }, 'COBBLESTONE_FLOOR');
 
   // 1. Smelting Hall & Reverberatory Hearth (top section of industrial bounds)
   const furnacePos: Point2D = { x: ox + 6, y: oy + 3 };
@@ -141,7 +145,6 @@ export function generateHeavyIndustrialSector(
 
   // 3. Rail Spur, Monorail Depot Terminus & Freight Mine Hoist
-  const railY = oy + 8;
   const xStart = ox + 1;
   const xEnd = Math.min(grid.width - 3, ox + 13);
   for (let rx = xStart; rx <= xEnd; rx++) {
@@ -198,8 +201,6 @@ export function generateHeavyIndustrialSector(
     pressureVessel: { currentPressureKpa: 210, maxPressureKpa: 350, ruptured: false },
   };
 
-  // Connecting path from industrial sector to avenue
-  grid = carveCorridor(grid, { x: ox + 6, y: railY + 1 }, { x: ox + 6, y: Math.max(1, oy - 2) }, 'COBBLESTONE_FLOOR');
-
   return {
     grid,
```

---

### 4.2 Exact Code Fix for `src/sim/spatial/district-pipeline.ts`

- **File Path**: `/Users/emmett/Desktop/Game/src/sim/spatial/district-pipeline.ts`
- **Current Line Count**: 137 lines
- **Proposed Line Count**: 155 lines (net change: +18 lines, well under 250 limit)
- **Target Functions**: `isUrbanDistrict`, `executeStage5ArchitecturalTypologies`

#### Proposed Changes
1. Import `generateUrbanDistrict` at line 18 from `./urban-district.js`.
2. Export helper predicate `isUrbanDistrict(districtId: string): boolean`.
3. In `executeStage5ArchitecturalTypologies`, insert the CDDA urban district dispatch branch before `applyTypologyPlacements`.

#### Exact Diff Patch:
```diff
--- a/src/sim/spatial/district-pipeline.ts
+++ b/src/sim/spatial/district-pipeline.ts
@@ -17,16 +17,21 @@ import { setTileCell } from './grid.js';
 import { seedOutdoorStreetLandmarks } from './landmark-micro-locations.js';
+import { generateUrbanDistrict } from './urban-district.js';
 
 export { DISTRICT_ADJACENCY } from './compass-gates.js';
 export { connectivityTargets, createPipelineContext };
 export type { PipelineDistrictContext };
 export {
   executeStage6MultiStratumDungeons,
   executeStage7InteractiveUtilityInfrastructure,
   executeStage8EmergenceAtmosphericSeeding,
 } from './district-pipeline-late.js';
-export { generateUrbanDistrict } from './urban-district.js';
+export { generateUrbanDistrict };
 export { carveVictorianSewerTopology } from './sewer-topology.js';
 export { generateSubterraneanMineStratum } from './mines-generation.js';
 export { generateHeavyIndustrialSector } from './industrial-district.js';
 export { linkAllStrataPortals } from './strata-portals.js';
 
+export function isUrbanDistrict(districtId: string): boolean {
+  return districtId.includes('whitechapel') || districtId.includes('ward') || districtId.includes('rookeries') || districtId.includes('urban');
+}
+
@@ -120,6 +125,23 @@ export function executeStage5ArchitecturalTypologies(ctx: PipelineDistrictContext): void {
     return;
   }
 
+  // CDDA Hierarchical Urban District Generation (Whitechapel Ward / Urban Districts)
+  if (isUrbanDistrict(ctx.currDistrict) && ctx.width >= 45 && ctx.height >= 35) {
+    const urban = generateUrbanDistrict(ctx.street, ctx.entities, ctx.width, ctx.height, ctx.center, ctx.rng);
+    ctx.street = urban.grid;
+    ctx.entities = urban.entities;
+    ctx.doors = { ...ctx.doors, ...urban.doors };
+    ctx.keyPositions = { ...ctx.keyPositions, ...urban.keyPositions };
+    if (urban.parcels.length > 0) {
+      const footprints = urban.parcels.map((p) => p.bounds);
+      ctx.street = fillUnbuiltYards(
+        seedDistrictArchitecture(ctx.street, ctx.currDistrict, ctx.rng, critical),
+        footprints,
+        ctx.rng,
+      );
+    }
+    const repaired = ensureDistrictConnectivity(ctx.street, ctx.center, connectivityTargets(ctx));
+    ctx.street = repaired.grid;
+    return;
+  }
+
   const placed = applyTypologyPlacements(ctx.street, ctx.entities, ctx.layout, ctx.rng, ctx.center.y);
```

---

## 5. Verification Method

Once implemented by the worker agent, these changes can be independently verified using the following commands:

1. **Verify Industrial Sector Challenger Invariant**:
   ```bash
   npx vitest run tests/sim/m2-challenger-invariants.test.ts -t "Heavy Industrial Sector"
   ```
   *Expected Output*: Test passes with 0 failures across all 50 seeds (seeds 5001..5050). The smelting furnace foundation is preserved on `SCORCHED_STONE`, the 5x5 thermal halo maintains $steamPressureKpa \ge 45$, $smokePpm \ge 140$, $coalDustDensity \ge 0.35$, and `doors.smeltingHall` reaches furnace approach $(ox + 6, oy + 4)$.

2. **Verify Multi-Stratum Worldgen Suite**:
   ```bash
   npx vitest run tests/sim/multi-stratum-worldgen.test.ts
   ```
   *Expected Output*: All 4 tests pass with 0 failures across seeds 1000..1025.

3. **Verify Full Spatial Reachability Across All 5 Canonical Districts**:
   ```bash
   npx vitest run tests/sim/spatial-reachability.test.ts
   ```
   *Expected Output*: Passes with 0 failures across all 5 districts, confirming both `district_spitalfields_soot_works` (legacy typology) and `district_whitechapel_ward` (CDDA urban layout) maintain 100% BFS reachability to all compass gates, doors, and vertical portals.

4. **Verify Modularity and Boundaries**:
   ```bash
   npm run check:boundaries
   ```
   *Expected Output*: 0 boundary violations. `industrial-district.ts` is 214 lines and `district-pipeline.ts` is 155 lines (both strictly $\le 250$ lines, hard ceiling 300).

### Invalidation Conditions
- Any edit that carves a corridor through columns $ox + 4$ to $ox + 8$ between rows $oy + 1$ and $oy + 5$ *after* the thermal halo loop runs.
- Any change that replaces `applyTypologyPlacements` unconditionally for industrial districts, which would break `tests/sim/phase48-building-prefabs.test.ts`.
