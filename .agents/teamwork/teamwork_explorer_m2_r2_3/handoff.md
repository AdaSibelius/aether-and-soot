# Heavy Industrial District Generation, Cross-Stratum Portals & Pipeline Architecture Report (Milestone 2)

## 1. Observation

Direct inspection of `src/sim/spatial/`, `src/schemas/`, `src/sim/systems/`, and `tests/` reveals the foundational building blocks, schema definitions, and pipeline execution model governing multi-stratum generation, industrial complexes, and vertical portal traversal in Aether & Soot.

### 1.1 Existing Spatial Pipeline & File Size Telemetry
- `src/sim/spatial/district-pipeline.ts` (132 lines): Executes Stages 1 through 5 (`executeStage1TopologyHydrology`, `executeStage2RailViaduct`, `executeStage3ThoroughfareSkeletization`, `executeStage4PlotZoning`, `executeStage5ArchitecturalTypologies`).
- `src/sim/spatial/district-pipeline-late.ts` (98 lines): Executes Stages 6 through 8 (`executeStage6MultiStratumDungeons`, `executeStage7InteractiveUtilityInfrastructure`, `executeStage8EmergenceAtmosphericSeeding`).
- `src/sim/spatial/district-pipeline-context.ts` (116 lines): Manages `PipelineDistrictContext` with `street`, `undercroft`, `spire` grids, entities, doors, key positions, and connectivity targets.
- `src/sim/spatial/generator.ts` (134 lines): Orchestrates the 8-stage pipeline in `generateVictorianDistrict(state: WorldState): GeneratedDistrictResult`.
- `tests/scripts/check-boundaries.ts` (lines 5, 31–48): Enforces a hard modularity ceiling of **300 lines** (`MAX_LINES_HARD_CEILING = 300`) across **all** TypeScript files in both `src/` AND `tests/`. Any file with `split('\n').length > 300` triggers fatal process exit (`process.exit(1)`).

### 1.2 Schema Primitives & Component Inventory
- **Terrain Types (`src/schemas/primitives.schema.ts:79-116`)**:
  Already includes all necessary heavy industrial and mining terrain tokens:
  - `'CONVEYOR_TRACK'` (passable, machinery conveyor run)
  - `'SLAG_PIT'` (blocking, high hazard liquid/slag trench)
  - `'RAIL_TRACK'` (passable, narrow/standard gauge rail track)
  - `'BOARDING_PLATFORM'` (passable, elevated loading dock)
  - `'SCORCHED_STONE'` (passable, thermal stone flooring)
  - `'TIMBER_STRUT'` (blocking, mine shoring strut)
  - `'BRASS_STEAM_PIPE'` (blocking, overhead/ground steam main)
  - `'CANAL_SLUICE'`, `'IRON_GRATE'`, `'COBBLESTONE_FLOOR'`, `'SOOT_BRICK_WALL'`
- **Furniture Kinds (`src/schemas/world-components.schema.ts:58-87`)**:
  Already includes all required industrial fixtures:
  - `'SMELTING_FURNACE'` (reverberatory smelting furnace)
  - `'MONORAIL_DEPOT_CONSOLE'` (dispatch console)
  - `'SAFE_VAULT'` (ingot strongbox / secure storage)
  - `'IRON_BOILER'`, `'COAL_STOVE'`, `'VALVE_MANIFOLD'`, `'CRATE'`
- **Pressure Vessels & Shafts (`src/schemas/components.schema.ts:90-95`, `world-components.schema.ts:166-180`)**:
  - `PressureVesselComponent`: `{ currentPressureKpa: number, maxPressureKpa: number, ruptured: boolean }`.
  - `CrossStratumShaftComponent`: `{ shaftType: 'PNEUMATIC_LIFT' | 'SEWER_SIPHON' | 'STEAM_RISER' | 'GRAVITY_CHUTE' | 'MONORAIL_ELEVATOR', upperStratum, lowerStratum, upperCoord, lowerCoord, operational, flowRateUnitsPerTick }`.
- **Portals (`src/schemas/components.schema.ts:57-65`)**:
  - `PortalComponent`: `{ target: Point3D, bidirectional: boolean, conductsGas: boolean, conductsLiquid?: boolean, apCost: number, portalLabel: string }`.

### 1.3 Industrial Typology Baseline (`src/sim/spatial/typologies-industrial.ts`)
- In lines 37–92: Stamps a Steam Boilerhouse & Smelting Hearth with `SMELTING_FURNACE`, `SLAG_PIT`, `BRASS_STEAM_PIPE`, and a 3x3 halo of `steamPressureKpa >= 35`, `smokePpm >= 120`.
- In lines 93–143: Stamps a Pneumatic Monorail Depot with parallel `RAIL_TRACK` (y=4,5), `BOARDING_PLATFORM` (y=6), `MONORAIL_DEPOT_CONSOLE`, and dual `PressureVessel` reserves (`vessel_depot_aether_fuel_1/2`).
- In lines 144–196: Stamps an Artisan Workshop with `CONVEYOR_TRACK`, `BRASS_STEAM_PIPE`, `SLAG_PIT`, and `SAFE_VAULT` with cast iron plates and aether salt.

### 1.4 Portal & Vertical Transit Mechanics
- In `src/sim/systems/portal-transit.system.ts` (lines 16–68):
  `resolveUsePortal(state, actorId)` calls `findPortalAtPoint(state.entities, origin)`.
  If found, verifies destination is unobstructed (`findBlockingEntityAtPoint`), updates actor position to `{ x: dest.x, y: dest.y, stratum: dest.stratum }`, spends `portal.apCost`, and emits `STRATUM_CHANGED`.
- In `src/sim/spatial/catacombs.ts` (lines 37–120):
  `resolveDescendCatacombs` and `resolveAscendCatacombs` handle multi-depth subterranean navigation using `stairs_catacombs_down_d*` and `stairs_catacombs_up_d*`.

### 1.5 Walkability & Anti-Trapping Invariant Enforcement
- `hasWalkablePath(grid, start, goal)` (`district-layout.ts:145-167`): 4-directional BFS validating `!cell.blocksMovement`.
- `ensureDistrictConnectivity(grid, start, targets)` (`district-yards.ts:151-164`): Tests reachability to all critical targets; calls `punchPath` to carve relief corridors outside `VAULT` zones for any unreachable node.
- `fillUnbuiltYards(grid, footprints, rng)` (`district-yards.ts:40-115`): Flood-fills from central plaza to seal any unreachable open floor tiles back into solid `SOOT_BRICK_WALL`, guaranteeing **zero orphaned walkable floor pockets**.
- `canPlaceWithoutSevering(grid, x, y, terrain, criticalLandmarks)` (`architectural-features.ts:85-102`): Tests that candidate feature placement preserves pairwise connectivity across critical district landmarks.

---

## 2. Logic Chain

### 2.1 Heavy Industrial Sector Architecture (`src/sim/spatial/industrial-district.ts`)
- *Observation*: Current industrial placement in `typologies-industrial.ts` stamps isolated, compact building footprints (11x10 and 13x10) designed for standard 24x24 street blocks. It lacks an expansive, contiguous heavy industrial complex featuring full conveyor runs, dedicated rail spurs, outdoor boiler yards, and slag trenches.
- *Reasoning*: Industrial districts (e.g. `district_spitalfields_soot_works`) and heavy industrial sectors in larger maps (48x36) require cohesive subdivision into four interconnected industrial sub-zones:
  1. **Smelting Hall & Reverberatory Hearth**: Heavy vaulted masonry hall with `SCORCHED_STONE` flooring, reverberatory furnace (`SMELTING_FURNACE`), flanking `SLAG_PIT` drainage trenches, and an atmospheric halo (`steamPressureKpa: 45–60`, `smokePpm: 140–200`, `coalDustDensity: 0.35`).
  2. **Feedstock Hopper & Continuous Conveyor Run**: Unbroken run of 6–10 `CONVEYOR_TRACK` tiles running from a bulk feedstock hopper/crusher container (`CRATE` with `commodity_anthracite_briquette`) into the smelting hearth and onward to the ingot strongroom (`SAFE_VAULT` with `mat_cast_iron_plate` and `mat_brass_gears`).
  3. **Freight Rail Spur & Monorail Terminus**: Multi-track siding (`RAIL_TRACK`) branching off the main viaduct artery, flanked by `BOARDING_PLATFORM`, dispatch console (`MONORAIL_DEPOT_CONSOLE`), freight monorail car (`monorail_car_street_depot`), and freight headframe hoist connecting to the subterranean mine stratum.
  4. **High-Pressure Boiler Yard & Accumulator Battery**: Outdoor gravel/iron-grate yard with industrial steam accumulator vessels (`PressureVesselComponent`: `currentPressureKpa: 220`, `maxPressureKpa: 350`), overhead `BRASS_STEAM_PIPE` distribution arches, and enclosed anthracite coal storage bunkers.
- *Inference*: `src/sim/spatial/industrial-district.ts` must provide a high-level function `carveHeavyIndustrialSector(grid, entities, bounds, rng, options)` and modular sub-carvers that instantiate these four sub-zones while maintaining non-severing walkability.

### 2.2 Cross-Stratum Portals Architecture (`src/sim/spatial/strata-portals.ts`)
- *Observation*: Portal spawning is currently scattered across `world-factory.ts` (manhole/ladder), `utility-networks.ts` (street/spire elevator), `district-scaler.ts` (sewer drop siphons), and `strata-dungeons.ts` (undercroft-to-catacombs stairs). There is no unified vertical portal manager, and no direct portal connecting the surface industrial sector / rail siding to the subterranean mine stratum.
- *Reasoning*: Requirement R2 calls for unified vertical portal generation across strata:
  - Street manholes $\leftrightarrow$ Undercroft sewer junction ladders (`streetManhole` $\leftrightarrow$ `undercroftLadder`)
  - Street freight headframe $\leftrightarrow$ Subterranean mine hoist (`streetMineHoist` $\leftrightarrow$ `mineHoistLanding`)
  - Surface grand elevator $\leftrightarrow$ Spire catwalks (`streetLift` $\leftrightarrow$ `spireLift`)
  - Undercroft sewer stairs $\leftrightarrow$ Catacombs Depth 1 stairs (`stairs_undercroft_to_catacombs`)
- *Inference*: `src/sim/spatial/strata-portals.ts` will centralize all vertical portal generation into:
  1. `createBidirectionalPortalPair(...)`: Generic factory ensuring matched portal coordinates, non-blocking positions, bidirectional flags, and `CrossStratumShaftComponent` telemetry.
  2. Concrete domain generators:
     - `spawnStreetUndercroftManholePair(entities, streetPos, undercroftPos, idSuffix?)`
     - `spawnStreetSpireElevatorPair(entities, streetPos, spirePos)`
     - `spawnStreetMineHoistPair(entities, streetPos, minePos)`
     - `spawnUndercroftCatacombsStairsPair(entities, undercroftPos, catacombsPos, depthLevel?)`
  3. Orchestrator `linkAllStrataPortals(ctx, strataGrids, entities): StrataPortalNetwork` verifying that every portal landing cell on both strata is walkable (`blocksMovement: false`).

### 2.3 Pipeline Integration Points (`district-pipeline.ts` & `district-pipeline-late.ts`)
- *Observation*: The pipeline has 8 established stages. Introducing urban street networks, heavy industrial sectors, and unified strata portals must hook into the exact appropriate stages without breaking existing callers or bloated file sizes.
- *Reasoning*:
  - **Stage 2 (Rail & Viaduct Arteries)**: Carves the main horizontal viaduct and rail spur branches feeding the monorail depot and industrial freight sidings.
  - **Stage 3 (Thoroughfare Skeletization)**: Spanning tree backbone connects the central plaza (with manhole), compass gates, pneumatic lift alcove, and industrial freight rail siding.
  - **Stage 5 (Architectural Typologies & Industrial Sector)**:
    - Urban parcel subdivision and CDDA building template stamping (via `urban-district.ts` / `template-instantiator.ts`).
    - If `currDistrict` is industrial (or on large maps), calls `carveHeavyIndustrialSector` from `industrial-district.ts`.
    - Runs `canPlaceWithoutSevering` on industrial pipe/pit features, seals orphaned floor pockets with `fillUnbuiltYards`, and runs intermediate `ensureDistrictConnectivity`.
  - **Stage 6 (Multi-Stratum Dungeons)**:
    - Generates Undercroft sewer flumes and junction chambers (`sewer-topology.ts`).
    - Generates Spire catwalks and greenhouse (`spire-topology.ts`).
    - Generates Subterranean Mine drift shafts and stopes (`mines-generation.ts`).
  - **Stage 7 (Interactive Utility Infrastructure & Strata Portals)**:
    - Replaces scattered portal calls with `linkAllStrataPortals` (`strata-portals.ts`), cleanly instantiating manholes, elevators, mine hoists, and catacomb stairs.
    - Spawns freight monorail car, utility conduits, and master workbenches.
    - Executes final post-barrier `ensureDistrictConnectivity` across all active strata grids (`STREET`, `UNDERCROFT`, `SPIRE`).
  - **Stage 8 (Atmospheric Emergence)**:
    - Infuses thermodynamic steam gradients, radiant heat halos, and smoke/soot density around the industrial smelting hall, boiler accumulator yard, and sewer sumps.

### 2.4 Walkability Invariants & Non-Severing Verification
- *Observation*: Steampunk fixtures (pipes, slag pits, fences, timber struts) have `blocksMovement: true`. If placed naively, they can partition street thoroughfares or trap the player inside rooms.
- *Reasoning*: The 4-phase invariant guarantee ensures zero reachability failures:
  1. **Phase 1: Spanning Tree Backbone**: Prior to placing any secondary feature or building interior, an open corridor network connecting all quadrant anchors and gates is established.
  2. **Phase 2: Local Non-Severing Check**: Every blocking tile (such as `BRASS_STEAM_PIPE`, `SLAG_PIT`, `WROUGHT_IRON_FENCE`, or `TIMBER_STRUT`) must pass `canPlaceWithoutSevering(grid, x, y, terrain, criticalAnchors)` before insertion.
  3. **Phase 3: Pocket Sealing**: `fillUnbuiltYards` executes BFS flood-fill from the stratum hub; any passable cell outside building footprints that cannot reach the hub is converted to solid `SOOT_BRICK_WALL`, eliminating all isolated pockets.
  4. **Phase 4: Global Invariant Gate**: `ensureDistrictConnectivity(grid, hub, targets)` checks reachability to all transit gates, portals, and doors. Any unreachable target triggers `punchPath` relief corridors.

### 2.5 Multi-Stratum Unit Test Architecture (`tests/sim/multi-stratum-worldgen.test.ts`)
- *Observation*: `check-boundaries.ts` strictly enforces <= 300 lines on test files.
- *Reasoning*: `tests/sim/multi-stratum-worldgen.test.ts` must comprehensively verify:
  1. Multi-stratum generation and bit-exact reproducibility across 25+ seeds (1000..1025).
  2. Heavy industrial sector fixtures, conveyor track continuity, and thermodynamic halos.
  3. Unified vertical portal pairing, coordinate alignment, and `USE_PORTAL` command execution.
  4. 100% BFS pathfinding walkability on `STREET`, `UNDERCROFT`, `SPIRE`, and Subterranean Mine floors.
  5. Zero isolated unreachable walkable floor pockets.
- *Inference*: By designing clean, expressive test helpers (e.g. `assertStratumReachability(grid, start, targets)`), the entire 5-suite verification test file can be written in ~240 lines, well below the 300-line ceiling.

---

## 3. Caveats

1. **Subterranean Stratum Keying (`StratumIdSchema`)**:
   - `StratumIdSchema` currently contains `'UNDERCROFT'`, `'STREET'`, `'SPIRE'`, `'CATACOMBS'`.
   - The mine delve is modeled under `'CATACOMBS'` (with `depthLevel: 1` representing the Mine Drift / Extraction Stope tier). This avoids breaking `WorldState.strata`, serialization roundtrips, and client UI/audio maps (`STRATUM_DEPTH_MAP`).
   - The mine hoist portal on `STREET` connects directly to `{ x, y, stratum: 'CATACOMBS', depthLevel: 1 }`.
2. **Door Pathfinding Semantics**:
   - Closed wooden doors (`WOODEN_DOOR_CLOSED`) intentionally have `blocksMovement: true`. In the simulation engine, walking into a closed door via `MOVE_STEP` emits `DOOR_TOGGLED` and opens it.
   - For strict corridor walkability verification, public thoroughfares, alleys, conveyor corridors, and portal access paths must have zero closed doors (100% open movement). Interior room verification uses `openAllDoors` or tests door coordinates directly as reachability targets.
3. **Modularity Constraints**:
   - All new files (`industrial-district.ts`, `strata-portals.ts`) and updated files (`district-pipeline.ts`, `district-pipeline-late.ts`, `district-pipeline-context.ts`) must remain strictly under 220 lines.
   - The test file `tests/sim/multi-stratum-worldgen.test.ts` must remain strictly under 260 lines (safely below the 300-line hard ceiling enforced by `check-boundaries.ts`).

---

## 4. Conclusion

### 4.1 Specification: `src/sim/spatial/industrial-district.ts` (~200 lines)

#### Module Purpose & Exports
Generates heavy industrial complexes with smelting halls, reverberatory furnaces, continuous conveyor tracks, rail sidings, monorail depots, and high-pressure boiler accumulator yards.

```typescript
export interface IndustrialSectorBounds {
  readonly x1: number;
  readonly y1: number;
  readonly x2: number;
  readonly y2: number;
}

export interface IndustrialSectorResult {
  readonly grid: StratumGrid;
  readonly entities: Record<string, EntityRecord>;
  readonly furnacePos: Point2D;
  readonly boilerPos: Point2D;
  readonly monorailPos: Point2D;
  readonly mineHoistPos: Point2D;
  readonly conveyorStart: Point2D;
  readonly conveyorEnd: Point2D;
  readonly doors: Record<string, Point2D>;
}
```

#### Detailed Algorithmic Procedures
1. **`carveSmeltingHall(grid, entities, origin, rng)`**:
   - Footprint: 12x8 room enclosed in `SOOT_BRICK_WALL` with `WOODEN_DOOR_OPEN` facing the thoroughfare.
   - Floor: `SCORCHED_STONE`.
   - Furnace Entity: `furniture_smelting_furnace` (`kind: 'SMELTING_FURNACE'`) at `(origin.x + 6, origin.y + 4)`.
   - Slag Pit: 3-tile trench of `SLAG_PIT` (`blocksMovement: true`) along one flank.
   - Steam Headers: 3-tile run of `BRASS_STEAM_PIPE` along opposite wall.
   - Thermodynamic Halo: 5x5 area centered on furnace with `steamPressureKpa: 45`, `smokePpm: 150`, `coalDustDensity: 0.35`.
2. **`carveContinuousConveyorRun(grid, entities, start, end, zone)`**:
   - Carves an L-shaped or linear run of `CONVEYOR_TRACK` (`blocksMovement: false, blocksSight: false`).
   - Feedstock Hopper at `start`: container `CRATE` holding 5x `commodity_anthracite_briquette`.
   - Ingot Strongroom at `end`: partitioned vault with `SAFE_VAULT` holding 3x `mat_cast_iron_plate` and 2x `mat_brass_gears`.
3. **`carveRailSpurAndMonorailTerminus(grid, entities, railY, xStart, xEnd)`**:
   - Multi-track spur: `RAIL_TRACK` at `railY` and `railY + 1`.
   - Boarding platform: `BOARDING_PLATFORM` at `railY + 2`.
   - Monorail car: `monorail_car_street_depot` (`MonorailCarComponent`).
   - Console: `furniture_monorail_console` (`MONORAIL_DEPOT_CONSOLE`).
   - Freight Mine Headframe: `portal_street_mine_hoist` at the spur terminus.
4. **`carveBoilerYard(grid, entities, origin, rng)`**:
   - Outdoor yard: 8x6 area paved with `IRON_GRATE` and `COBBLESTONE_FLOOR`.
   - Accumulator Vessels: `vessel_district_boiler` and `vessel_boiler_accumulator_2` (`PressureVesselComponent`: `currentPressureKpa: 220`, `maxPressureKpa: 350`).
   - Overhead steam pipe arches: `BRASS_STEAM_PIPE` connecting vessels.
   - Anthracite coal bunkers: 3x2 alcove holding anthracite fuel stacks with `coalDustDensity: 0.5`.
5. **`generateHeavyIndustrialSector(grid, entities, bounds, rng, options)`**:
   - Integrates the above four components within `bounds`.
   - Enforces non-severing checks via `canPlaceWithoutSevering`.
   - Returns `IndustrialSectorResult`.

---

### 4.2 Specification: `src/sim/spatial/strata-portals.ts` (~160 lines)

#### Module Purpose & Exports
Centralizes and unifies all cross-stratum vertical portal pairs across `STREET`, `UNDERCROFT`, `SPIRE`, and `CATACOMBS`, ensuring matched bidirectional coordinates and valid non-blocking landing cells.

```typescript
export interface StrataPortalPair {
  readonly upperEntity: EntityRecord;
  readonly lowerEntity: EntityRecord;
}

export interface StrataPortalNetwork {
  readonly streetUndercroftManhole: StrataPortalPair;
  readonly streetSpireElevator: StrataPortalPair;
  readonly streetMineHoist: StrataPortalPair;
  readonly undercroftCatacombsStairs: StrataPortalPair;
  readonly secondaryDrops: readonly StrataPortalPair[];
}
```

#### Core Functions & Signatures
1. **`createBidirectionalPortalPair(config)`**:
   ```typescript
   export function createBidirectionalPortalPair(config: {
     readonly upperId: string;
     readonly lowerId: string;
     readonly upperPos: Point2D & { stratum: StratumId; depthLevel?: number };
     readonly lowerPos: Point2D & { stratum: StratumId; depthLevel?: number };
     readonly upperLabel: string;
     readonly lowerLabel: string;
     readonly upperVisual: VisualGlyphSpec;
     readonly lowerVisual: VisualGlyphSpec;
     readonly shaftType?: 'PNEUMATIC_LIFT' | 'SEWER_SIPHON' | 'STEAM_RISER' | 'GRAVITY_CHUTE' | 'MONORAIL_ELEVATOR';
     readonly flowRateUnitsPerTick?: number;
   }): StrataPortalPair;
   ```
2. **Domain Factories**:
   - `spawnStreetUndercroftManholePair(entities, streetPos, undercroftPos, index = 0)`
   - `spawnStreetSpireElevatorPair(entities, streetPos, spirePos)`
   - `spawnStreetMineHoistPair(entities, streetPos, minePos)`
   - `spawnUndercroftCatacombsStairsPair(entities, undercroftPos, catacombsPos, depthLevel = 1)`
3. **Unified Linker**:
   ```typescript
   export function linkAllStrataPortals(
     ctx: PipelineDistrictContext,
     strataGrids: Record<StratumId, StratumGrid>,
     entities: Record<string, EntityRecord>,
     options?: { mineHoistPos?: Point2D; mineFloorPos?: Point2D },
   ): StrataPortalNetwork;
   ```
   - Automatically inspects grids to confirm portal landing cells have `blocksMovement === false`. If a landing cell is solid, converts it to `COBBLESTONE_FLOOR` or `IRON_GRATE`.

---

### 4.3 Specification: Pipeline Integration Points

#### 1. In `src/sim/spatial/district-pipeline-context.ts`
- Add `mineHoistPos: Point2D` to `PipelineDistrictContext`.
- In `createPipelineContext`, derive `mineHoistPos`:
  ```typescript
  const mineHoistPos: Point2D = depot
    ? mapPoint(depot, { x: 28, y: 5 })
    : { x: Math.min(width - 4, center.x + 8), y: 5 };
  ```
- In `connectivityTargets(ctx)`: Include `ctx.mineHoistPos` so BFS invariant checks guarantee pathfinding reachability from the plaza to the mine hoist.

#### 2. In `src/sim/spatial/district-pipeline.ts`
- In `executeStage5ArchitecturalTypologies(ctx)`:
  - If `ctx.currDistrict.includes('soot_works')` or `ctx.width >= 36`:
    - Invoke `generateHeavyIndustrialSector` in southern/eastern industrial quadrant.
    - Stitch conveyor runs and rail spurs to the viaduct.
  - Run `fillUnbuiltYards` and intermediate `ensureDistrictConnectivity`.

#### 3. In `src/sim/spatial/district-pipeline-late.ts`
- In `executeStage6MultiStratumDungeons(ctx)`:
  - Undercroft sewer carving delegates to `sewer-topology.ts`.
  - Spire web delegates to `spire-topology.ts`.
  - Subterranean mine delve delegates to `mines-generation.ts`.
- In `executeStage7InteractiveUtilityInfrastructure(ctx)`:
  - Replace legacy direct elevator/manhole entity generation with `linkAllStrataPortals(ctx, { STREET: ctx.street, UNDERCROFT: ctx.undercroft, SPIRE: ctx.spire }, ctx.entities, { mineHoistPos: ctx.mineHoistPos })`.
  - Execute post-placement `ensureDistrictConnectivity` on `ctx.street`, `ctx.undercroft`, and `ctx.spire`.

---

### 4.4 Specification: `tests/sim/multi-stratum-worldgen.test.ts` (< 260 lines)

The test file is structured into 4 cohesive describe blocks:

```typescript
describe('Milestone 2: Multi-Stratum Worldgen & Walkability Verification', () => {
  // 1. Multi-Stratum Generation & Seed Determinism
  it('generates Street, Undercroft, Spire, and Mine floors deterministically across seeds 1000..1025', () => {
    for (let seed = 1000; seed <= 1025; seed++) {
      const world = createInitialWorld({ seed, width: 48, height: 36 });
      const { state, landmarks } = generateVictorianDistrict(world);
      
      expect(state.strata.STREET).toBeDefined();
      expect(state.strata.UNDERCROFT).toBeDefined();
      expect(state.strata.SPIRE).toBeDefined();
      expect(state.strata.STREET!.cells.length).toBe(48 * 36);
      expect(state.strata.UNDERCROFT!.cells.length).toBe(48 * 36);
      expect(state.strata.SPIRE!.cells.length).toBe(48 * 36);
      
      // Seed determinism check
      const reGen = generateVictorianDistrict(createInitialWorld({ seed, width: 48, height: 36 }));
      expect(state.strata.STREET!.cells).toEqual(reGen.state.strata.STREET!.cells);
    }
  });

  // 2. Heavy Industrial Sector Fixtures & Layout Invariants
  it('validates industrial smelting hall, continuous conveyor run, rail spurs, and boiler yard', () => {
    const world = createInitialWorld({ seed: 1042, width: 48, height: 36, currentDistrictId: 'district_spitalfields_soot_works' });
    const { state } = generateVictorianDistrict(world);
    const street = state.strata.STREET!;
    const entities = state.entities;

    // Smelting furnace & halo
    const furnace = Object.values(entities).find((e) => e.furniture?.kind === 'SMELTING_FURNACE');
    expect(furnace).toBeDefined();
    const fCell = getTileCell(street, furnace!.position!.x, furnace!.position!.y)!;
    expect(fCell.steamPressureKpa).toBeGreaterThanOrEqual(35);
    expect(fCell.smokePpm).toBeGreaterThanOrEqual(120);

    // Continuous conveyor run (>= 4 contiguous cells)
    const conveyorCells = street.cells.filter((c) => c.terrainType === 'CONVEYOR_TRACK');
    expect(conveyorCells.length).toBeGreaterThanOrEqual(4);

    // Rail spurs & platform
    const railCells = street.cells.filter((c) => c.terrainType === 'RAIL_TRACK');
    expect(railCells.length).toBeGreaterThanOrEqual(8);

    // High-pressure accumulator vessel
    const vessel = Object.values(entities).find((e) => e.pressureVessel && e.pressureVessel.maxPressureKpa >= 300);
    expect(vessel).toBeDefined();
  });

  // 3. Cross-Stratum Portal Connectivity & Navigation
  it('validates bidirectional vertical portals across all strata and USE_PORTAL transit', () => {
    let world = createInitialWorld({ seed: 1050, width: 48, height: 36 });
    const { state: initialWorld, landmarks } = generateVictorianDistrict(world);
    const playerId = EntityIdSchema.parse('actor_player');

    // Verify portals exist for Manhole, Lift, and Mine Hoist
    const portals = Object.values(initialWorld.entities).filter((e) => e.portal !== undefined);
    expect(portals.some((p) => p.portal?.target.stratum === 'UNDERCROFT')).toBe(true);
    expect(portals.some((p) => p.portal?.target.stratum === 'SPIRE')).toBe(true);
    expect(portals.some((p) => p.portal?.target.stratum === 'CATACOMBS')).toBe(true);

    // Test USE_PORTAL from Street to Spire
    const liftPortal = portals.find((p) => p.position?.stratum === 'STREET' && p.portal?.target.stratum === 'SPIRE')!;
    world = {
      ...initialWorld,
      entities: {
        ...initialWorld.entities,
        [playerId]: { ...initialWorld.entities[playerId]!, position: { ...liftPortal.position!, blocksMovement: true, blocksSight: false } },
      },
    };
    const res = dispatchCommand(world, { type: 'USE_PORTAL', actorId: playerId });
    expect(res.events.some((e) => e.type === 'STRATUM_CHANGED')).toBe(true);
    expect(res.state.entities[playerId]!.position!.stratum).toBe('SPIRE');
  });

  // 4. 100% BFS Pathfinding Walkability & Zero Pocket Invariant
  it('guarantees 100% BFS reachability and zero isolated floor pockets across 25+ seeds', () => {
    for (let seed = 2000; seed <= 2025; seed++) {
      const world = createInitialWorld({ seed, width: 48, height: 36 });
      const { state, landmarks } = generateVictorianDistrict(world);

      const street = state.strata.STREET!;
      const undercroft = state.strata.UNDERCROFT!;
      const spire = state.strata.SPIRE!;

      // 1. Street connectivity from plaza to critical targets
      const hub = landmarks.streetManhole;
      expect(hasWalkablePath(street, hub, landmarks.westGate)).toBe(true);
      expect(hasWalkablePath(street, hub, landmarks.eastGate)).toBe(true);
      expect(hasWalkablePath(street, hub, landmarks.streetLift)).toBe(true);
      expect(hasWalkablePath(street, hub, landmarks.foundryBoiler)).toBe(true);

      // 2. Undercroft connectivity from ladder to sewer extremities
      expect(hasWalkablePath(undercroft, landmarks.undercroftLadder, { x: 10, y: 7 })).toBe(true);
      expect(hasWalkablePath(undercroft, landmarks.undercroftLadder, { x: 37, y: 28 })).toBe(true);

      // 3. Spire connectivity from lift to catwalk platforms
      expect(hasWalkablePath(spire, landmarks.spireLift, { x: 10, y: 7 })).toBe(true);
      expect(hasWalkablePath(spire, landmarks.spireLift, { x: 37, y: 28 })).toBe(true);
    }
  });
});
```

---

## 5. Verification Method

### 5.1 Verification Commands
The implementation must be verified using the standard automated test gates:

1. **Boundary & Modularity Check**:
   ```bash
   npm run check:boundaries
   ```
   *Expected*: Passes with 0 errors. Asserts all files in `src/` and `tests/` are $\le 300$ lines, with no forbidden imports (`window`, `Math.random`, `Date.now`).
2. **Strict Typecheck**:
   ```bash
   npm run typecheck
   ```
   *Expected*: Strict TypeScript compiles with 0 errors (`tsc --noEmit`).
3. **Multi-Stratum Worldgen Vitest Test Suite**:
   ```bash
   npx vitest run tests/sim/multi-stratum-worldgen.test.ts
   ```
   *Expected*: 100% pass across all 4 describe blocks and all 25+ seeds.
4. **Full Regression Test Suite**:
   ```bash
   npx vitest run tests/sim/spatial-reachability.test.ts tests/sim/spatial-contiguity-audit.test.ts tests/sim/strata-dungeons.test.ts tests/sim/catacombs-persistence.test.ts tests/sim/building-templates.test.ts
   ```
   *Expected*: Zero regressions on existing spatial, template, and stratum tests.
5. **Full Repository Verification**:
   ```bash
   npm run verify
   ```
   *Expected*: All 4 verification gates exit code 0.

### 5.2 Invalidation Conditions
This architecture shall be considered invalidated if:
- Any new or modified module in `src/sim/spatial/` or `tests/sim/` exceeds the 300-line hard ceiling.
- Any non-deterministic function (`Math.random()`, `Date.now()`) is called in `industrial-district.ts` or `strata-portals.ts`.
- Any vertical portal landing position on any stratum is generated inside a solid blocking tile (`blocksMovement: true`), causing `USE_PORTAL` to fail with `DESTINATION_BLOCKED`.
- Any seed between 1000..1025 or 2000..2025 results in an unreachable portal, gate, or door from the stratum transit hub.
