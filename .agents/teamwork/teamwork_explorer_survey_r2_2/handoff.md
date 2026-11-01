# Multi-Stratum World Generation & CDDA-Style Urban Layouts: Spatial Architecture Survey (Requirement R2)

## 1. Observation

Direct code examination and telemetry across `src/sim/spatial/`, `src/schemas/`, and `tests/sim/` reveal the current state of spatial generation infrastructure, multi-stratum verticality, and pathfinding walkability enforcement:

### 1.1 Line Counts and Modularity Telemetry
Execution of `wc -l src/sim/spatial/*.ts` confirms **33 modules** comprising **4,464 total lines of code**, all strictly under the 250-line target and 300-line hard modularity ceiling (`AGENTS.md` Rule 2.2):
```
 187 src/sim/spatial/architectural-features.ts
  45 src/sim/spatial/architectural-typologies.ts
 120 src/sim/spatial/block-geometry.ts
  69 src/sim/spatial/building-prefabs.ts
 112 src/sim/spatial/building-variation.ts
  39 src/sim/spatial/catacombs-cache.ts
 141 src/sim/spatial/catacombs-generation.ts
 184 src/sim/spatial/catacombs.ts
  86 src/sim/spatial/chunk-coords.ts
 220 src/sim/spatial/chunk-streamer.ts
 146 src/sim/spatial/city-graph.ts
 112 src/sim/spatial/compass-gates.ts
 161 src/sim/spatial/district-blocks.ts
 167 src/sim/spatial/district-layout.ts
 115 src/sim/spatial/district-pipeline-context.ts
  97 src/sim/spatial/district-pipeline-late.ts
 131 src/sim/spatial/district-pipeline.ts
 179 src/sim/spatial/district-scaler.ts
 164 src/sim/spatial/district-yards.ts
 144 src/sim/spatial/facade.ts
 150 src/sim/spatial/fov.ts
 133 src/sim/spatial/generator.ts
 130 src/sim/spatial/grid.ts
 127 src/sim/spatial/interior-zoning.ts
 130 src/sim/spatial/landmark-micro-locations.ts
 207 src/sim/spatial/overworld-matrix.ts
  14 src/sim/spatial/portals.ts
  93 src/sim/spatial/spire-topology.ts
 180 src/sim/spatial/strata-dungeons.ts
 203 src/sim/spatial/typologies-civic.ts
 198 src/sim/spatial/typologies-industrial.ts
 125 src/sim/spatial/undercroft-topology.ts
 155 src/sim/spatial/utility-networks.ts
4464 total
```
The highest line count modules are `chunk-streamer.ts` (220 lines), `overworld-matrix.ts` (207 lines), `typologies-civic.ts` (203 lines), and `typologies-industrial.ts` (198 lines). No file exceeds 220 lines.

### 1.2 Core Spatial Grid & Cell Representation
In `src/sim/spatial/grid.ts`:
- **`TileCellSchema`** (lines 5–16):
  ```typescript
  export const TileCellSchema = z.object({
    terrainType: TerrainTypeSchema,
    blocksMovement: z.boolean(),
    blocksSight: z.boolean(),
    steamPressureKpa: z.number().nonnegative().default(0),
    coalDustDensity: z.number().min(0).max(1).default(0),
    liquidType: LiquidTypeIdSchema.default('NONE').optional(),
    liquidVolumeMl: z.number().int().nonnegative().default(0).optional(),
    smokePpm: z.number().int().nonnegative().default(0).optional(),
    interiorZone: InteriorZoneTypeSchema.default('NONE').optional(),
    explored: z.boolean().default(false),
  });
  ```
- **`StratumGridSchema`** (lines 19–25):
  ```typescript
  export const StratumGridSchema = z.object({
    stratum: StratumIdSchema,
    width: z.number().int().positive(),
    height: z.number().int().positive(),
    cells: z.array(TileCellSchema),
  });
  ```
  Cells are laid out in a flat 1D array of length `width * height`, indexed via `y * width + x`.
- **Grid Utilities** (lines 53–82):
  - `isWithinBounds(grid, x, y)`: guards array boundary violations.
  - `getTileCell(grid, x, y)`: returns `grid.cells[y * grid.width + x]`.
  - `setTileCell(grid, x, y, updater)`: performs immutable updates to the 1D cells array.
  - `findEntitiesAtPoint(entities, point)` and `findBlockingEntityAtPoint(entities, point)`: index ECS entity positions on `Point3D` (`{ x, y, stratum }`).

### 1.3 Strata Representation & Verticality Hierarchy
In `src/schemas/primitives.schema.ts` (lines 24–25, 73–77):
- `StratumIdSchema`:
  ```typescript
  export const StratumIdSchema = z.enum(['UNDERCROFT', 'STREET', 'SPIRE', 'CATACOMBS']);
  export type StratumId = z.infer<typeof StratumIdSchema>;
  ```
- `Point3DSchema`:
  ```typescript
  export const Point3DSchema = Point2DSchema.extend({
    stratum: StratumIdSchema,
    depthLevel: z.number().int().positive().optional(),
  });
  ```
- In `src/sim/core/world.ts` (lines 14–27, 42–69):
  - `WorldState.strata`: `Record<StratumId, StratumGrid>` holding active grids for the current district.
  - `WorldState.savedDistricts`: `Record<string, SavedDistrictSnapshot>` snapshotting dormant districts.
  - `WorldState.catacombDepths`: `Record<string, { grid: StratumGrid; entities: Record<string, EntityRecord> }>` for procedural subterranean depth levels (`depthLevel: 1..N`).
- In `src/client/canvas-ui/atlas-dossier-panel.ts` (line 39) & `src/client/canvas-ui/atlas-screen.ts` (line 13):
  - The vertical stack is mapped: `SPIRE (+30m to +50m) > STREET (0m) > UNDERCROFT (-10m to -15m) > CATACOMBS (-25m to -100m+)`.

### 1.4 Vertical Portals & Inter-Stratum Transitions
In `src/sim/spatial/portals.ts` and `src/schemas/components.schema.ts` (lines 57–65):
- `PortalComponentSchema`:
  ```typescript
  export const PortalComponentSchema = z.object({
    target: Point3DSchema,
    bidirectional: z.boolean().default(true),
    conductsGas: z.boolean().default(true),
    conductsLiquid: z.boolean().default(false).optional(),
    apCost: z.number().int().positive().default(100),
    portalLabel: z.string().min(1),
  });
  ```
- `CrossStratumShaftComponentSchema` in `src/schemas/world-components.schema.ts` (lines 154–169):
  Supports `shaftType: 'PNEUMATIC_LIFT' | 'SEWER_SIPHON' | 'STEAM_RISER' | 'GRAVITY_CHUTE' | 'MONORAIL_ELEVATOR'`.
- Canonical vertical portals generated across pipeline stages:
  1. **Street to Undercroft**: Central manhole `streetManhole` <-> `undercroftLadder` (`generator.ts:95-96`), plus secondary/tertiary `portal_sewer_drop_1/2` and `portal_undercroft_ascent_1/2` (`district-scaler.ts:123-161`).
  2. **Street to Spire**: Pneumatic Grand Elevator `streetLift` <-> `spireLift` (`generator.ts:97-98`, `utility-networks.ts:107-133`).
  3. **Undercroft to Catacombs**: `stairs_undercroft_to_catacombs` targeting Depth 1 `(5, 5, 'CATACOMBS')` (`strata-dungeons.ts:85-99`).
  4. **Catacombs Depth Traversal**: `stairs_catacombs_down_d*` and `stairs_catacombs_up_d*` (`catacombs-generation.ts:74-108`, `catacombs.ts:37-184`).

### 1.5 Deterministic Procedural Pipeline Execution
In `src/sim/spatial/generator.ts` (lines 56–115):
The simulation generates districts through an 8-stage pipeline driven by `SeededRNG(state.rngState)`:
1. `executeStage1TopologyHydrology(ctx)` (`district-pipeline.ts:29-37`): Carves Thames canal sluices (`CANAL_SLUICE`).
2. `executeStage2RailViaduct(ctx)` (`district-pipeline.ts:40-52`): Carves horizontal viaduct rail tracks (`IRON_GRATE` corridor).
3. `executeStage3ThoroughfareSkeletization(ctx)` (`district-pipeline.ts:64-80`): Carves central plaza (7x7), lift alcove (5x5), east-west arterial road, and compass gates.
4. `executeStage4PlotZoning(ctx)` (`district-pipeline.ts:83-97`): Carves workshop and market hall along the thoroughfare.
5. `executeStage5ArchitecturalTypologies(ctx)` (`district-pipeline.ts:104-131`): Stamps 6 multi-room building typologies, outdoor landmarks, yards (`fillUnbuiltYards`), and enforces BFS connectivity (`ensureDistrictConnectivity`).
6. `executeStage6MultiStratumDungeons(ctx)` (`district-pipeline-late.ts:13-39`): Carves Undercroft sewers (`carveUndercroftSewers`), Spire web (`carveSpireWeb`), Spire greenhouse, and macro barriers (`enrichLargeScaleDistrict`).
7. `executeStage7InteractiveUtilityInfrastructure(ctx)` (`district-pipeline-late.ts:42-79`): Seeds portals, gates, monorail cars, master benches, and utility conduits (`ensureDistrictConnectivity` invariant check).
8. `executeStage8EmergenceAtmosphericSeeding(ctx)` (`district-pipeline-late.ts:82-97`): Seeds thermodynamic steam pressure and coal dust halos.

### 1.6 Pathfinding Walkability & Anti-Trapping Invariant Enforcement
Observed across `district-layout.ts`, `district-yards.ts`, `architectural-features.ts`, and test suites:
- **`hasWalkablePath(grid, start, goal)`** (`district-layout.ts:145-167`): 4-directional BFS verifying `!cell.blocksMovement`.
- **`ensureDistrictConnectivity(grid, start, targets)`** (`district-yards.ts:151-164`):
  Checks `hasWalkablePath` from central plaza to every critical destination. If unreachable, `punchPath` converts blocking tiles outside `VAULT` zones into `COBBLESTONE_FLOOR`, `WOODEN_DOOR_OPEN`, or `TIMBER_PIER`.
- **`fillUnbuiltYards(grid, footprints, rng)`** (`district-yards.ts:40-115`):
  Generates Voronoi yard fills, then flood-fills from plaza `(width/2, centerY)`. Any unbuilt floor tile that cannot reach the plaza is converted back to solid `SOOT_BRICK_WALL`, guaranteeing **0 unreachable floor pockets**.
- **`canPlaceWithoutSevering(grid, x, y, terrainType, criticalLandmarks)`** (`architectural-features.ts:85-102`):
  Prevents placement of blocking features (`WROUGHT_IRON_FENCE`, `GASLAMP_POST`, `BRASS_STEAM_PIPE`) if they break BFS connectivity between any pair of critical landmarks.
- **Door Collision Invariant**: Closed doors have `blocksMovement: true`. The simulation engine (`combat.system.ts` / `engine.ts`) intercepts `MOVE_STEP` into closed doors and emits `DOOR_TOGGLED` to open them automatically (`tests/sim/strata-dungeons.test.ts:164-196`). In contiguity testing, `openAllDoors(grid)` validates reachability to all interior rooms (`spatial-contiguity-audit.test.ts:9-18, 59-82`).

---

## 2. Logic Chain

From the direct observations above, we establish the step-by-step logic chain governing the architecture for Requirement R2:

### Step 2.1: Multi-Stratum Procedural Specialization
- *Observation*: The codebase currently relies on `executeStage6MultiStratumDungeons` (`district-pipeline-late.ts:13`) which generates Undercroft sewers via `undercroft-topology.ts` and Spire catwalks via `spire-topology.ts`, while `catacombs-generation.ts` handles subterranean catacomb floors.
- *Reasoning*: Requirement R2 calls for structured generation across 4 distinct archetypes:
  1. **City Districts** (Streets, alleys, building footprints, plazas)
  2. **Sewers** (Tunnels, junction chambers, drainage channels)
  3. **Mines** (Meandering shafts, cavernous pockets, support timber struts)
  4. **Industrial Zones** (Smelting halls, conveyor runs, rail spurs, boiler yards)
- *Inference*:
  - City Districts and Industrial Zones are surface-stratum layouts (`STREET`) with distinct zoning topologies (civic/residential perimeter blocks vs heavy industrial machinery complexes).
  - Sewers are `UNDERCROFT` layouts featuring masonry drainage tunnels and siphon sumps.
  - Mines are subterranean delve layouts (`CATACOMBS` depth tier or dedicated mine stratum) characterized by organic meandering drift tunnels, excavated stopes, and structural timber shoring.

### Step 2.2: Algorithmic Architecture for Each Stratum Archetype

#### Archetype A: CDDA-Style City District Generation (`src/sim/spatial/urban-district.ts`)
- *Observation*: `district-blocks.ts` (161 lines) permutes 6 typologies across a 3x2 grid of plots. `interior-zoning.ts` (127 lines) carves multi-room floorplans with structural interior zones (`RECEPTION`, `WORKSHOP`, `VAULT`, `SURGICAL_BAY`, `STORAGE`, `BACKROOM`).
- *Design*:
  1. **Hierarchical Road Network**:
     - *Primary Arterial Thoroughfare*: Width 3–4 cobblestone avenue running between compass transit gates with a central 7x7 civic plaza (`streetManhole`, public fountain / clocktower monument).
     - *Secondary Cross-Streets*: Width 2 connecting northern and southern building plots.
     - *Back-Alleys*: Width 1 service lanes behind buildings paved with `RUBBLE_PILE` and `COBBLESTONE_FLOOR` for delivery access and stealth routing.
  2. **Parcel Subdivision & Building Footprints**:
     - Subdivide blocks into distinct parcel lots separated by 1-tile firebreaks (preventing monolithic wall blobs).
     - Front exterior facade features `WOODEN_DOOR_CLOSED` facing streets with `GLASS_WINDOW` display apertures.
     - Rear service doors face alleys.
  3. **Dense Victorian/Steampunk Interior Fixtures**:
     - Room partitioning with dedicated functional fixtures: `BED`, `BOOKSHELF`, `SAFE_VAULT`, `PEDESTAL`, `SURGICAL_TABLE`, `ARTIFICER_BENCH`.
     - Counter barriers (`COUNTER_BARRIER`) separating public reception from private backrooms.

#### Archetype B: Victorian Sewer Network Generation (`src/sim/spatial/sewer-topology.ts`)
- *Observation*: `undercroft-topology.ts` currently carves 6 quadrant chambers and connects them via `carveSerpentine` with `IRON_GRATE` and sluice basins.
- *Design*:
  1. **Dual-Channel Conduit Profiles**:
     - Central effluent channel: Width 1–2 tiles of `CANAL_SLUICE` or `COBBLESTONE_FLOOR` with `liquidType: 'SLUICE_SLUDGE'` (`liquidVolumeMl: 2000`).
     - Flanking inspection walkways: Elevated `IRON_GRATE` catwalks (passable, dry).
  2. **Octagonal Junction Chambers**:
     - 5x5 vaulted brick chambers at arterial sewer intersections.
     - Central sediment catch basin with iron maintenance ladders leading directly to surface `streetManhole`.
     - Overflow weir gates (`CANAL_SLUICE` / `IRON_GRATE`) regulating cross-stratum stormwater flow.
  3. **Atmospheric Miasma Gradients**:
     - Low-lying areas have elevated `smokePpm` (toxic miasma) and `steamPressureKpa` from industrial discharges.

#### Archetype C: Subterranean Mine Generation (`src/sim/spatial/mines-generation.ts`)
- *Observation*: `catacombs-generation.ts` generates 4 rooms in a ring with miasma steam. Currently, no dedicated mine generation exists, but `RAIL_TRACK`, `RUBBLE_PILE`, `SLAG_MOUND`, and `SCORCHED_STONE` already exist in `TerrainTypeSchema`.
- *Design*:
  1. **Meandering Drift Shafts**:
     - Bounded random walk / Braitenberg drift carving 1-to-2 tile wide winding tunnels following procedural ore/coal veins through solid rock (`SOOT_BRICK_WALL` / vitrified stone).
     - Branching dead-ends ending in collapsed faces (`RUBBLE_PILE`).
  2. **Cavernous Excavated Pockets (Stopes)**:
     - Organic irregular rooms (radius 3–5) carved using cellular expansion where rich mineral veins were extracted.
     - Unexcavated natural stone pillars left in chamber centers to emulate historical room-and-pillar mining.
  3. **Support Timber Struts (`TIMBER_STRUT`)**:
     - Introduce `TIMBER_STRUT` into `TerrainTypeSchema`: blocking movement, flammable, destructible (Mohs hardness 3.5).
     - Place timber struts at regular intervals (every 4–5 steps) along drift shafts against walls, never fully obstructing the passage.
     - Unshored shaft segments have a calculated collapse risk generating `RUBBLE_PILE`.
  4. **Narrow-Gauge Ore Haulage**:
     - `RAIL_TRACK` runs along main drift shafts connecting stopes to the hoist terminus.
     - Ore trolley containers (`CRATE` with `mat_brass_gears`, `commodity_anthracite_briquette`).
  5. **Vertical Hoist Shaft**:
     - Steam-powered hoist headframe (`MINE_HOIST` via `CrossStratumShaftComponent`) linking the mine floor vertically to the surface industrial boiler yard or Undercroft rail siding.

#### Archetype D: Heavy Industrial Zone Generation (`src/sim/spatial/industrial-district.ts`)
- *Observation*: `typologies-industrial.ts` currently stamps a Boilerhouse, Monorail Depot, and Artisan Workshop within `STREET`.
- *Design*:
  1. **Expanded Industrial Zoning**:
     - Large-scale industrial lots (e.g. 14x10 to 18x12) designed for factory complexes.
  2. **Smelting Halls & Reverberatory Furnaces**:
     - Central `SMELTING_FURNACE` entity surrounded by `SLAG_PIT` trenches, `BRASS_STEAM_PIPE` headers, and `SCORCHED_STONE` flooring.
     - High radiant heat: 3x3 halo of `steamPressureKpa >= 35` and `smokePpm >= 120`.
  3. **Conveyor Runs & Assembly Tracks**:
     - Continuous lines of `CONVEYOR_TRACK` moving between feedstock hoppers, crushers, and ingot strongrooms.
  4. **Rail Spurs & Monorail Terminus**:
     - Multi-track rail sidings (`RAIL_TRACK`) with elevated boarding platforms (`BOARDING_PLATFORM`) and freight monorail cars (`monorail_car_street_depot`).
  5. **Boiler Yards & High-Pressure Infrastructure**:
     - Outdoor accumulator yards featuring `vessel_district_boiler` (`PressureVesselComponent`), overhead steam arches, and coal storage bunkers (`commodity_anthracite_briquette`).

### Step 2.3: Connectivity and Walkability Guarantee Invariants
- *Observation*: Existing simulation tests (`spatial-reachability.test.ts`, `spatial-contiguity-audit.test.ts`) assert 100% BFS reachability from the central plaza to all gates, vertical portals, and building doors across seeds 1000..1020 and 2000..2024.
- *Reasoning*: Introducing complex street layouts, meandering mines, and dual-channel sewers could introduce partition bugs if not strictly bound by invariant gates.
- *Inference*: The multi-stratum generation must reuse and extend the proven 3-layer connectivity guarantee:
  1. **Spanning Tree Foundation**: Main thoroughfares, sewer trunks, and mine drift backbones are carved using spanning trees (Prim's algorithm or Bresenham corridors) connecting all quadrant anchors before any local features are seeded.
  2. **Placement Safety Check**: Any blocking feature (`WROUGHT_IRON_FENCE`, `GASLAMP_POST`, `TIMBER_STRUT`, `BRASS_STEAM_PIPE`) must pass `canPlaceWithoutSevering(grid, x, y, terrain, criticalLandmarks)` before insertion.
  3. **Post-Generation Invariant Gate (`ensureDistrictConnectivity`)**: BFS from the stratum's primary entry/hub to every landmark and portal. Any unreachable target triggers `punchPath` which carves a guaranteed passable corridor.
  4. **Isolated Pocket Elimination (`fillUnbuiltYards` / `sealIsolatedPockets`)**: Flood fill from the entry hub identifies any unreachable walkable pockets and seals them into solid wall, ensuring zero orphaned walkable cells.

### Step 2.4: Determinism & SeededRNG Discipline
- *Observation*: `AGENTS.md` Rule 1.1 and Rule 2.1 strictly forbid `Math.random()` and `Date.now()`. `createPipelineContext` initializes `const rng = new SeededRNG(state.rngState)`.
- *Reasoning*: All procedural generation routines must accept a `SeededRNG` instance and advance state deterministically.
- *Inference*: Subterranean and multi-stratum floors must derive seed states hierarchically: `rng.nextInt(...)` or `seed + stratumOffset * 31337`, preserving 100% bit-exact replayability across headless test runs.

---

## 3. Caveats

1. **Subterranean Stratum Modeling (`StratumIdSchema`)**:
   - `StratumIdSchema` currently contains `'UNDERCROFT'`, `'STREET'`, `'SPIRE'`, `'CATACOMBS'`.
   - *Option A*: Model Mines as a subterranean depth/biome under `CATACOMBS` (`depthLevel: 1..N`, or `BiomeId: 'ABANDONED_COAL_MINES'`). This avoids any breaking changes to `StratumIdSchema`, `WorldState.strata`, and client audio/UI maps (`STRATUM_DEPTH_MAP`, `STRATUM_AMBIENCE_PROFILES`).
   - *Option B*: Add `'MINES'` directly to `StratumIdSchema`. This makes Mines a first-class stratum alongside Street and Undercroft, but requires updating exhaustive enum mappings across client UI panels (`atlas-dossier-panel.ts`, `AtlasMinimapView.tsx`, `modal-buffer-router.ts`) and audio synthesis profiles (`synth-presets-environment.ts`).
   - *Recommendation*: Implement Mines as a specialized delve tier / subterranean generation mode in `src/sim/spatial/mines-generation.ts` that can be mapped to deep Undercroft/Catacomb levels or promoted to a standalone stratum via a non-breaking union if approved.
2. **Door Pathfinding Semantics**:
   - Closed wooden doors (`WOODEN_DOOR_CLOSED`) intentionally have `blocksMovement: true`. Pathfinding for actors automatically handles bump-to-open via `MOVE_STEP`, but raw BFS (`hasWalkablePath`) treats them as blocking unless `openAllDoors` is invoked. Connectivity verification must distinguish between public corridors (which must be 100% walkable with zero doors) and interior building rooms (which are walkable when doors are opened).
3. **Modularity Budget**:
   - Modularity splits must keep every new module under 250 lines. Splitting generator concerns into `urban-district.ts`, `sewer-topology.ts`, `mines-generation.ts`, and `industrial-district.ts` keeps each domain clean and well below the limit.

---

## 4. Conclusion

### 4.1 Reusable Infrastructure Catalog
The following existing functions and schemas in `src/sim/spatial/` and `src/schemas/` are directly reusable without modification:

| Utility / Schema | File Location | Line Numbers | Reuse Purpose |
| :--- | :--- | :--- | :--- |
| `TileCellSchema`, `StratumGridSchema` | `src/sim/spatial/grid.ts` | 5–25 | Grid data structures, flat 1D cell indexing, and layer representations |
| `getTileCell`, `setTileCell`, `isWithinBounds` | `src/sim/spatial/grid.ts` | 53–82 | Safe bounds-checked cell inspection and immutable updates |
| `findPortalAtPoint` | `src/sim/spatial/portals.ts` | 8–14 | Detecting cross-stratum portals at 3D coordinates |
| `computeVisibleTiles`, `isPointVisible` | `src/sim/spatial/fov.ts` | 12–126 | 8-octant shadowcasting FOV accounting for smoke, steam, and coal dust |
| `hasWalkablePath` | `src/sim/spatial/district-layout.ts` | 145–167 | BFS pathfinding connectivity validation |
| `carveRoom`, `carveCorridor` | `src/sim/spatial/district-layout.ts` | 24–90 | Base carving primitives for rooms and orthogonal passages |
| `carveMultiRoomBuilding`, `findCellsInZone` | `src/sim/spatial/interior-zoning.ts` | 37–127 | Multi-room building layouts with structural `InteriorZoneType` |
| `ensureDistrictConnectivity` | `src/sim/spatial/district-yards.ts` | 151–164 | Invariant gate verifying reachability and punching relief corridors |
| `fillUnbuiltYards` | `src/sim/spatial/district-yards.ts` | 40–115 | Voronoi yard fills and unreachable pocket sealing |
| `canPlaceWithoutSevering` | `src/sim/spatial/architectural-features.ts` | 85–102 | Non-destructive feature placement guard |
| `enrichLargeScaleDistrict` | `src/sim/spatial/district-scaler.ts` | 29–165 | Macro barriers (canals, viaducts, toll walls, sewer drops) |
| `SeededRNG` | `src/sim/core/rng.ts` | 1–45 | Deterministic PRNG with state serialization |

### 4.2 Proposed Modular Decomposition for Multi-Stratum Worldgen

```
src/sim/spatial/
├── urban-district.ts          # CDDA-style street networks, back-alleys, parcel lots, setbacks (<= 200 lines)
├── sewer-topology.ts          # Dual-channel effluent sluices, junction chambers, weir basins (<= 180 lines)
├── mines-generation.ts        # Meandering drift shafts, stopes, timber struts, rail haulage (<= 200 lines)
├── industrial-district.ts     # Smelting halls, conveyor runs, rail spurs, boiler yards (<= 190 lines)
├── strata-portals.ts          # Unified portal linking (manholes, stairwells, mine hoists, lifts) (<= 140 lines)
└── district-pipeline.ts       # Orchestrator integrating urban, sewer, mine, and industrial stages (<= 180 lines)
```

### 4.3 Schema Impacts

1. **`src/schemas/primitives.schema.ts`**:
   - `TerrainTypeSchema`: Add `TIMBER_STRUT` (blocks movement, flammability rating, structural support for mine shafts).
   - `InteriorZoneTypeSchema`: Optionally add `MINING_STOPE` and `SMELTING_HEARTH`.
2. **`src/schemas/world-components.schema.ts`**:
   - `CrossStratumShaftComponentSchema`: Add `'MINE_HOIST'` to `shaftType` enum (or reuse existing `'MONORAIL_ELEVATOR'` / `'PNEUMATIC_LIFT'`).
   - `FurnitureComponentSchema`: Add `'ORE_CART'` and `'MINE_WINCH'` to `kind` enum.
3. **`src/schemas/components.schema.ts`**:
   - No breaking changes; `PositionComponentSchema` and `EntityComponentsSchema` accommodate all new fixtures and portals seamlessly.

---

## 5. Verification Method

To independently verify the spatial generation architecture and ensure 0 regressions against existing deterministic suites:

### 5.1 Verification Commands
1. **Modularity & Boundary Verification**:
   ```bash
   npm run check:boundaries
   ```
   *Expected*: Passes with 0 errors. Asserts all files in `src/sim/spatial/` are $\le 300$ lines, with no forbidden imports (`window`, `Math.random`, `Date.now`).
2. **Typecheck Verification**:
   ```bash
   npm run typecheck
   ```
   *Expected*: Strict TypeScript compiles with 0 errors (`tsc --noEmit`).
3. **Spatial Reachability & Contiguity Test Suites**:
   ```bash
   npx vitest run tests/sim/spatial-reachability.test.ts tests/sim/spatial-contiguity-audit.test.ts
   ```
   *Expected*: Passes 100% across all 25+ seeds asserting BFS reachability from central plaza to all gates, doors, and vertical portals.
4. **Strata Dungeons & Prefab Test Suites**:
   ```bash
   npx vitest run tests/sim/strata-dungeons.test.ts tests/sim/phase48-building-prefabs.test.ts tests/sim/phase49-overworld-atlas.test.ts
   ```
   *Expected*: Passes with 0 errors, validating Undercroft sewers, Spire catwalks, building prefabs, and multi-stratum navigation.
5. **Full Repository Verification**:
   ```bash
   npm run verify
   ```
   *Expected*: All 4 verification gates (typecheck, boundary checks, data validation, simulation tests) exit code 0.

### 5.2 Invalidation Conditions
The architectural findings in this report shall be deemed invalidated if:
- Any file in `src/sim/spatial/` exceeds 250 lines target or 300 lines ceiling.
- Any non-deterministic call (`Math.random()`, `Date.now()`) is introduced into spatial generation.
- Any procedurally generated district contains sealed or unreachable walkable floor pockets that cannot reach a primary transit portal.
- Modifying `StratumIdSchema` or `TerrainTypeSchema` breaks `WorldState` save/load serialization round-trips in `serializeWorld` / `deserializeWorld`.
