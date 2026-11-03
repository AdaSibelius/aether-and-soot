# Handoff Report: Continuous World Evolution (R1 Survey)

**Agent**: `teamwork_explorer_survey_5_1` (Procgen Survey Explorer)  
**Parent**: `b1f4e92b-f8d8-4000-b9ea-8ea40dd02e57`  
**Date**: 2026-11-02  
**Target Requirement**: R1 — Continuous World Evolution: Districts, Layouts, and Visual Representation  

---

## 1. Observation

### 1.1 District Generation Pipeline & Current Codebase Layout
- **`src/sim/spatial/generator.ts` (133 lines)**:
  - Invokes `generateVictorianDistrict(state: WorldState): GeneratedDistrictResult` (lines 56–116).
  - Orchestrates an 8-stage pipeline using `PipelineDistrictContext`:
    - Stage 1: `executeStage1TopologyHydrology` (Thames canal, Fleet ditch, wharf cuts).
    - Stage 2: `executeStage2RailViaduct` (monorail pylons, viaduct arches).
    - Stage 3: `executeStage3ThoroughfareSkeletization` (plaza room, avenue axis, compass gates).
    - Stage 4: `executeStage4PlotZoning` (workshop and market footprints).
    - Stage 5: `executeStage5ArchitecturalTypologies` (seeded archetype blocks or CDDA urban district).
    - Stage 6: `executeStage6MultiStratumDungeons` (Undercroft sewers, Spire catwalks, macro barriers).
    - Stage 7: `executeStage7InteractiveUtilityInfrastructure` (portals, utility networks, BFS connectivity repair, orphaned pocket sealing).
    - Stage 8: `executeStage8EmergenceAtmosphericSeeding` (soot gradients, steam pools, heat halos).
  - Note: Stratum generation is decomposed across modular files rather than a monolithic `stratum-generator.ts`: `sewer-topology.ts` (`carveVictorianSewerTopology`), `mines-generation.ts` (`generateSubterraneanMineStratum`), `industrial-district.ts` (`generateHeavyIndustrialSector`), `strata-dungeons.ts` (`generateUndercroftDungeon`, `generateSpireCatwalks`), and `strata-portals.ts` (`linkAllStrataPortals`).

- **`src/sim/spatial/urban-district.ts` (204 lines)**:
  - `carveHierarchicalStreetNetwork` (lines 53–98): Carves a 7x7 central plaza at `center`, an arterial avenue of width 3 along `avenueY` (`cy - 1` to `cy + 1`), secondary cross-streets of width 2 at fixed coordinates `crossStreetX = [15, 30]`, and service back-alleys at north (`northAlleyY = 2`) and south (`southAlleyY = Math.max(cy + 4, height - 3)`).
  - `subdivideUrbanParcels` (lines 100–111):
    ```typescript
    export function subdivideUrbanParcels(width: number, height: number, center: Point2D): UrbanParcel[] {
      if (width < 45 || height < 35) return [];
      const spec = getUrbanStreetSpec(width, height, center);
      return [
        { id: 'parcel_nw', bounds: { x1: 2, y1: spec.northAlleyY + 1, x2: spec.crossStreetX[0] - 1, y2: spec.avenueY.min - 1 }, frontDirection: 'SOUTH' },
        { id: 'parcel_nc', bounds: { x1: spec.crossStreetX[0] + 2, y1: spec.northAlleyY + 1, x2: spec.crossStreetX[1] - 1, y2: spec.plaza.y1 - 1 }, frontDirection: 'SOUTH' },
        { id: 'parcel_ne', bounds: { x1: spec.crossStreetX[1] + 2, y1: spec.northAlleyY + 1, x2: width - 4, y2: spec.avenueY.min - 1 }, frontDirection: 'SOUTH' },
        { id: 'parcel_sw', bounds: { x1: 2, y1: spec.avenueY.max + 1, x2: spec.crossStreetX[0] - 1, y2: spec.southAlleyY - 1 }, frontDirection: 'NORTH' },
        { id: 'parcel_sc', bounds: { x1: spec.crossStreetX[0] + 2, y1: spec.plaza.y2 + 1, x2: spec.crossStreetX[1] - 1, y2: spec.southAlleyY - 1 }, frontDirection: 'NORTH' },
        { id: 'parcel_se', bounds: { x1: spec.crossStreetX[1] + 2, y1: spec.avenueY.max + 1, x2: width - 4, y2: spec.southAlleyY - 1 }, frontDirection: 'NORTH' },
      ];
    }
    ```
    *Observation*: Exactly 6 hardcoded parcels designed solely for 48x36. If `width < 45 || height < 35`, it returns `[]`. If dimensions expand (e.g. 72x48 or 96x72), parcels do not dynamically tile.

- **`src/sim/spatial/strata-portals.ts` (236 lines) & `portals.ts` (14 lines)**:
  - Manages cross-stratum portals: `spawnStreetUndercroftManholePair`, `spawnStreetSpireElevatorPair`, `spawnStreetMineHoistPair`, `spawnUndercroftCatacombsStairsPair`.
  - In `linkAllStrataPortals` (lines 185–213), scans for template-instantiated portals on `STREET` targeting `UNDERCROFT` and guarantees an undercroft return ladder entity is dynamically created if missing.
  - Ensures walkable landings on all strata via `ensureWalkableLanding`.

- **`src/sim/spatial/sewer-topology.ts` (227 lines)**:
  - Generates 6 octagonal chambers (21-tile octagons) linked by dual-channel conduits (central effluent flume with weir crossings at `x % 5 === 0` and flanking iron grate inspection walkways).

- **`src/sim/spatial/mines-generation.ts` (185 lines)**:
  - Catacombs depth 1 generation: 5x5 headframe hoist station, 3 room-and-pillar stopes with support pillars, narrow-gauge rail tracks, ore trolleys with inventories, and timber strut shoring placed along drift walls with reachability checks (`hasWalkablePath`).

- **`src/sim/spatial/industrial-district.ts` (213 lines)**:
  - Generates heavy industrial sectors: smelting hall with reverberatory furnace and 5x5 thermal halo, continuous conveyor track running between feedstock hopper and ingot vault, rail spur with monorail car depot terminus and freight mine hoist, and outdoor boiler yard.

### 1.2 District Dimensions, Boundaries, and Inter-District Connectivity
- **Dimensions & Chunks**:
  - `src/schemas/chunk-streaming.schema.ts` (lines 12–13): Defines `CHUNK_SIZE_X = 16` and `CHUNK_SIZE_Y = 12`.
  - A 48x36 district corresponds exactly to a **3x3 chunk grid** (48 = 3 * 16, 36 = 3 * 12).
  - In `src/sim/core/world-factory.ts` (lines 12–13): `width = config.width ?? 48; height = config.height ?? 36;`.
- **Perimeter Boundaries**:
  - The outer border cells (`x === 0`, `x === width - 1`, `y === 0`, `y === height - 1`) are initialized to solid `SOOT_BRICK_WALL` in `buildSolidStratumGrid`.
  - The only openings are discrete `DISTRICT_GATE` cells located at `(1, cy)`, `(width - 2, cy)`, `(cx, 1)`, and `(cx, height - 2)` (`compassGatePositions` in `compass-gates.ts:62-70`).
- **Inter-District Navigation Mechanics**:
  - In `src/sim/systems/transit.system.ts` (`resolveTravelDistrict`, lines 47–185):
    - When an actor is adjacent to a `districtGate` entity and triggers travel, the departing district is snapshotted into `state.savedDistricts[fromDistrictId]`.
    - Active `state.strata` are completely replaced with `nextStrata`.
    - The actor is teleported to `findArrivalGate` on the opposite perimeter of the new district.
    - Result: Districts exist as completely disjoint spatial islands separated by loading/teleport transitions. Players cannot walk across borders continuously.
- **Client Projection Clamping**:
  - In `src/client/projection/frame-adapter.ts` (lines 105–113): Coordinates where `worldX < 0 || worldX >= grid.width || worldY < 0 || worldY >= grid.height` are emitted as `resolveOutOfBoundsVisual(...)` out-of-bounds void glyphs.

### 1.3 Building Templates, Fixtures, and Schemas
- **`src/schemas/building-template.schema.ts` (119 lines)**:
  - `BuildingTemplateSchema`: CDDA-style ASCII matrix `rows: string[]`, `legend: Record<string, TemplateCellRule>`, `rooms: TemplateRoomDefinition[]`, `width`, `height`, `exteriorDoorChar` (defaults to `'+'`).
  - `TemplateCellRuleSchema`: Terrain, interior room zone semantic, interactive furniture fixture kind (`furnitureKind`), container loot tables, thermodynamic properties (`steamPressureKpa`, `smokePpm`, `thermalCoreHeatPct`), and `crossStratumPortal`.
- **`src/sim/spatial/building-templates.ts` (235 lines)**:
  - 6 archetypes:
    1. `TEMPLATE_VICTORIAN_TAVERN` (12x10): Public bar counter, snug, kitchen scullery, cellar alcove with portal to `UNDERCROFT`.
    2. `TEMPLATE_CONSTABULARY_STATION` (11x10): Inspector desk, holding cells with `WROUGHT_IRON_FENCE` bars, charge room, evidence safe.
    3. `TEMPLATE_TENEMENT_HOUSE` (11x11): Straw beds, central spine corridor, wash scullery, coal cellar alcove with portal to `UNDERCROFT`.
    4. `TEMPLATE_APOTHECARY_CLINIC` (11x10): Galvanic operating table, chemical dispensary, patient waiting lounge.
    5. `TEMPLATE_ARTISAN_WORKSHOP` (13x10): Brass artificer workbench, gear safe vault, blueprint cabinet, showroom, dispatch tube.
    6. `TEMPLATE_STEAM_BOILERHOUSE` (11x10): Cornish boiler, coal bunker, manifold control bay, pilot stove.
- **`src/sim/spatial/template-instantiator.ts` (236 lines)**:
  - Deterministically stamps templates with rotation (0, 90, 180, 270) and reflections (`mirrorX`, `flipY`).
  - Automatically identifies perimeter doors and outward points.
  - Spawns fixtures via `createVictorianFixture` (`fixture-catalog.ts:231 lines`).
  - Automatically binds cross-stratum portals.
  - Invariant enforcement: Rejects placement if any interior room is not reachable from an exterior entrance door (`hasTemplateWalkablePath`).

### 1.4 Headless Determinism & Connectivity Algorithms
- **PRNG**: `SeededRNG` (`src/sim/core/rng.ts`) provides deterministic state saving and restoration (`rng.getState()`, `rng.nextInt()`, `rng.nextFloat()`). Zero non-deterministic functions exist in `src/sim/`.
- **BFS Walkability**:
  - `hasWalkablePath(grid, start, goal)` (`district-layout.ts:153-167`): 4-directional BFS verifying path existence through non-blocking terrain and doors.
  - `ensureDistrictConnectivity(grid, center, targets)` (`district-yards.ts:16-56`): Checks connectivity from `center` to all target landmarks/gates. If broken, carves corridors from the closest reachable cell.
  - `sealOrphanedWalkableTiles(grid, anchor)` (`district-yards.ts:165-219`): Eliminates unreachable floor pockets by turning them into `SOOT_BRICK_WALL`.
  - Multi-seed testing in `tests/sim/district-generator.test.ts` (lines 8–26) verifies 100% walkability across 50 random seeds without failure.

### 1.5 File Line Counts & Modularity Ceilings
Line count audit for touched and relevant files (`wc -l`):
- `src/sim/spatial/building-templates.ts`: **235 lines** (Near threshold >= 240)
- `src/sim/spatial/template-instantiator.ts`: **236 lines** (Near threshold >= 240)
- `src/sim/spatial/strata-portals.ts`: **236 lines** (Near threshold >= 240)
- `src/sim/spatial/fixture-catalog.ts`: **231 lines**
- `src/sim/spatial/sewer-topology.ts`: **227 lines**
- `src/sim/spatial/district-yards.ts`: **221 lines**
- `src/sim/spatial/chunk-streamer.ts`: **220 lines**
- `src/sim/spatial/industrial-district.ts`: **213 lines**
- `src/client/projection/frame-adapter.ts`: **208 lines**
- `src/sim/spatial/overworld-matrix.ts`: **207 lines**
- `src/sim/spatial/urban-district.ts`: **204 lines**
- `src/sim/spatial/typologies-civic.ts`: **203 lines**
- `src/sim/spatial/typologies-industrial.ts`: **198 lines**
- `src/sim/spatial/district-pipeline.ts`: **185 lines**
- `src/sim/spatial/mines-generation.ts`: **185 lines**
- `src/sim/spatial/district-scaler.ts`: **179 lines**
- `src/sim/spatial/district-layout.ts`: **167 lines**
- `src/sim/spatial/district-blocks.ts`: **161 lines**
- `src/sim/spatial/district-pipeline-late.ts`: **159 lines**
- `src/sim/spatial/city-graph.ts`: **146 lines**
- `src/sim/spatial/generator.ts`: **133 lines**
- `src/sim/spatial/grid.ts`: **130 lines**
- `src/sim/spatial/district-pipeline-context.ts`: **125 lines**
- `src/schemas/building-template.schema.ts`: **119 lines**
- `src/sim/spatial/compass-gates.ts`: **112 lines**
- `src/sim/spatial/chunk-coords.ts`: **86 lines**
- `src/schemas/chunk-streaming.schema.ts`: **47 lines**
- `src/sim/spatial/portals.ts`: **14 lines**

*Modularity Assessment*:
- `building-templates.ts` (235 lines), `template-instantiator.ts` (236 lines), and `strata-portals.ts` (236 lines) are approaching the 250-line target.
- Any expansion of templates must be placed in a dedicated module (e.g. `src/sim/spatial/building-templates-expanded.ts`) rather than appending to `building-templates.ts`.
- Any continuous multi-district layout generator should reside in new modular files (`district-boundaries.ts`, `continuous-streets.ts`, `urban-parcels.ts`) to avoid inflating `urban-district.ts` or `generator.ts`.

---

## 2. Logic Chain

1. **Premise (Requirement R1)**: Evolve procedural generation, district boundaries, and building character so the world forms a continuous environment rather than disconnected discrete zones. Update district sizing, inter-district connectivity or streaming, building templates, and visual representation to reflect seamless transitions and consistent Victorian Steampunk spatial character.
2. **Current Structural Friction (Observation 1.1 & 1.2)**:
   - A single district is currently generated as a standalone 48x36 grid enclosed by perimeter walls.
   - `subdivideUrbanParcels` uses fixed cross-street coordinates `[15, 30]` and returns 6 static parcels. It cannot tile larger sizes (e.g. 72x48, 96x72, or variable chunk multiples).
   - `resolveTravelDistrict` requires an explicit interaction with a gate entity, completely halting the active simulation and teleporting the actor across maps.
   - The camera governor and frame adapter render black void beyond the 48x36 boundary.
3. **Existing Architectural Lever (Observation 1.2 & 1.4)**:
   - The project already defines `CHUNK_SIZE_X = 16` and `CHUNK_SIZE_Y = 12` in `src/schemas/chunk-streaming.schema.ts`.
   - `chunk-streamer.ts` contains `hibernateChunk` and `hydrateChunk` with `computeActiveChunkWindow`.
   - `overworld-matrix.ts` defines macro 2D grid coordinates for districts (`macroCoords: { col, row }`).
   - `compass-gates.ts` defines planar neighbors (`planarNeighbor(districtId, dCol, dRow)`).
4. **Resolution Strategy for Continuous Layouts**:
   - **Edge Alignment Invariant**: Align thoroughfares across adjacent districts. If District A is west of District B:
     - The primary avenue at `y = cy` in District A connects directly to `y = cy` at x=0 in District B.
     - Secondary cross-streets and monorail lines align at modular offsets.
   - **Open Border Seams**: Replace solid perimeter walls on shared borders with continuous open streets, colonnade arches, toll gates, and bridges.
   - **Continuous Spatial Navigation**: When an actor steps across a district border coordinate (`x >= width` or `x < 0`), the simulation can either:
     a) Transition seamlessly using a coordinate handoff into the adjacent district's matching border tile without a modal gate dialog.
     b) Or expand the active district into a composite multi-district grid (e.g. 96x72 or streamed chunks) where multiple districts are co-present on the same continuous coordinate canvas.
   - **Procedural Multi-Block Parcel Subdivider (`urban-parcels.ts`)**: Replace fixed 6-parcel subdivision with a parametric block subdivider that partitions arbitrary `width x height` into street grids, building parcels, setbacks, and service alleys.
   - **District-Specific Architectural Character**: Expand template archetypes to reflect regional Victorian Steampunk identities (e.g., Heavy Smelting Mills in Soot Works, Dockside Cargo Warehouses in Limehouse, Gilded Clockmaker Salons in Belgravia).
   - **Seamless Visual Projection**: Update `frame-adapter.ts` to look into adjacent cached or dormant chunks at the border so the viewport displays continuous cityscape rather than out-of-bounds void.

---

## 3. Caveats

- **Scope Boundary**: This investigation is strictly read-only. No code modifications or test changes were made during this turn.
- **Chunk Streaming vs. Giant Single Grids**: Generating an unbounded single array for the entire metropolis (e.g. 5x5 districts = 240x180 = 43,200 tiles per stratum * 4 strata = 172,800 TileCells) in a single unstreamed `WorldState` would substantially increase memory and JSON serialization size. The proposed architecture therefore adopts **Seamless Border Seams + Active Multi-Chunk Windowing** (building on the existing 16x12 chunk infrastructure) to maintain sub-second turn times and strict deterministic save/load performance.
- **R2 / R3 Interactions**: R1 focuses on continuous world generation and visual presentation. R2 (Visual Testing and Spatial Survey Sheet Self-Correction) and R3 (4-step verification and token audit) are complementary requirements that build directly upon this foundation.

---

## 4. Conclusion & Architectural Proposal for R1

### 4.1 Feature Inventory for R1

| # | Feature Name | Description | Target Module(s) | Est. Lines |
|---|---|---|---|---|
| **F1** | **Dynamic Multi-Block Parcel Subdivider** | Replaces hardcoded 6-parcel division with parametric block partitioning supporting arbitrary district dimensions (48x36, 72x48, 96x72, etc.) with configurable street, alley, and setback widths. | `src/sim/spatial/urban-parcels.ts` | ~160 lines |
| **F2** | **Inter-District Edge Seam Alignment** | Enforces thoroughfare alignment across macro-overworld neighbors (`cy` avenues, `cx` cross-streets, viaducts, canals) ensuring contiguous traversable corridors between adjacent districts. | `src/sim/spatial/district-boundaries.ts` | ~180 lines |
| **F3** | **Continuous Spatial Navigation & Border Crossing** | Enables actors to walk seamlessly across district borders without modal gate activation; executes automatic coordinate transformation, companion preservation, and chunk streaming handoff. | `src/sim/systems/continuous-transit.system.ts` | ~175 lines |
| **F4** | **District-Tailored Architectural Archetypes** | Adds CDDA matrix templates for specialized district identities: Bessemer Smelting Mill (Soot Works), Bonded Wharf Warehouse (Limehouse Docks), and Gilded Clockwork Salon (Belgravia Spires). | `src/sim/spatial/building-templates-expanded.ts` | ~210 lines |
| **F5** | **Continuous Viewport & Multi-District Lookahead Projection** | Extends `frame-adapter.ts` camera projection to query neighboring district/chunk cells when near borders, eliminating out-of-bounds void artifacts and rendering a continuous visual metropolis. | `src/client/projection/continuous-projection.ts` | ~150 lines |
| **F6** | **Continuous Multi-Seed Walkability Test Suite** | Headless deterministic Vitest suite verifying end-to-end multi-seed walkability across seamless district borders and multi-stratum portals. | `tests/sim/continuous-worldgen.test.ts` | ~190 lines |

---

### 4.2 Detailed Component Designs

#### 1. Dynamic Multi-Block Parcel Subdivider (`urban-parcels.ts`)
- **Location**: `src/sim/spatial/urban-parcels.ts`
- **Purpose**: Decouples urban layout from fixed 48x36 dimensions.
- **Interface**:
  ```typescript
  export interface UrbanGridSpec {
    readonly width: number;
    readonly height: number;
    readonly center: Point2D;
    readonly blockWidth?: number; // default: 12-14
    readonly blockHeight?: number; // default: 9-11
  }
  export function subdivideProceduralParcels(spec: UrbanGridSpec, rng: SeededRNG): {
    readonly streetGrid: StratumGrid;
    readonly parcels: readonly UrbanParcel[];
    readonly avenues: readonly Box[];
    readonly crossStreets: readonly Box[];
    readonly alleys: readonly Box[];
  };
  ```
- **Algorithm**:
  - Calculates primary arterial avenue connecting west border to east border at `spec.center.y`.
  - Calculates secondary cross-streets at modular intervals (e.g. `colWidth = 14`), connecting north border to south border.
  - Subdivides each rectangular block into parcels facing either the avenue or cross-streets, leaving back-alley access behind them.
  - Guaranteed: Every parcel has at least one front facing a paved street (`COBBLESTONE_FLOOR`) and at least one rear facing a service alley.

#### 2. Inter-District Edge Seam Alignment (`district-boundaries.ts`)
- **Location**: `src/sim/spatial/district-boundaries.ts`
- **Purpose**: Eliminates isolated perimeter walls along shared borders in the 2D Overworld Matrix.
- **Interface**:
  ```typescript
  export interface DistrictBoundarySeam {
    readonly direction: 'north' | 'south' | 'east' | 'west';
    readonly neighborDistrictId: BlueprintId;
    readonly openIntervals: readonly { min: number; max: number }[];
    readonly transitionalFeatures: readonly { pos: Point2D; feature: TerrainType }[];
  }
  export function computeDistrictBoundarySeams(
    districtId: BlueprintId,
    width: number,
    height: number,
  ): Record<'north' | 'south' | 'east' | 'west', DistrictBoundarySeam | undefined>;
  ```
- **Edge Seam Rules**:
  - If a planar neighbor exists in `overworld-matrix.ts`:
    - The border wall is **opened** along the connecting avenue (width 3–5) and secondary streets.
    - Instead of solid wall, the border features diegetic transition points: Wrought Iron Toll Arches (`DISTRICT_GATE` with open passage), canal bridges (`TIMBER_PIER` over `CANAL_SLUICE`), or viaduct colonnades (`GOTHIC_COLONNADE`).
    - If no planar neighbor exists (edge of the metropolis): The border remains a fortified natural boundary (e.g. Thames River deep channel, Sovereign Crown Fortress Wall).

#### 3. Continuous Spatial Navigation (`continuous-transit.system.ts`)
- **Location**: `src/sim/systems/continuous-transit.system.ts`
- **Purpose**: Seamless border crossing during standard movement dispatch.
- **Workflow**:
  - When an actor moves to `x < 0`, `x >= width`, `y < 0`, or `y >= height` through an open border seam:
    - Identifies target neighbor district from `resolveCompassAdjacency`.
    - Coordinates are translated to the neighbor's coordinate frame (e.g. crossing east border at `(width, y)` maps to `(0, y)` in the eastern district).
    - Preserves actor, inventory, prosthetics, and companions.
    - Emits a `DISTRICT_SEAM_TRAVERSED` event into the event log.
    - Zero prompt dialog or modal interaction required: standard arrow key / pathfinding movement continues unbroken across districts.

#### 4. Expanded District Templates (`building-templates-expanded.ts`)
- **Location**: `src/sim/spatial/building-templates-expanded.ts`
- **Purpose**: Character specialization across districts without bloating `building-templates.ts`.
- **New Templates**:
  1. `TEMPLATE_BESSEMER_FOUNDRY` (14x11): Heavy crucible furnace, slag gutters, casting floor, overhead gantry crane.
  2. `TEMPLATE_DOCKSIDE_WAREHOUSE` (13x10): Timber cargo floor, customs desk, storage bays, wharf crane anchor, bilge runoff grate.
  3. `TEMPLATE_CLOCKWORK_SALON` (12x10): Gilded parquetry floor, chronometer exhibition cases, private parlor, drafting tables.

#### 5. Continuous Visual Projection (`continuous-projection.ts`)
- **Location**: `src/client/projection/continuous-projection.ts`
- **Purpose**: Seamless viewport rendering near boundaries.
- **Behavior**:
  - When the viewport window extends beyond `[0, width)` or `[0, height)`:
    - Instead of defaulting to `resolveOutOfBoundsVisual`, it looks up the neighboring district's cached or dormant chunk cells.
    - Renders the neighbor's cobblestone road and building exteriors with subtle oxidized iron Z-depth atmospheric fogging (`alpha: 0.65`).
    - Eliminates the artificial "edge of the world" box.

---

### 4.3 Proposed Implementation Phases

1. **Phase 1: Parametric Parcel Subdivider & Boundary Seams**
   - Author `src/sim/spatial/urban-parcels.ts` and `src/sim/spatial/district-boundaries.ts`.
   - Update `urban-district.ts` to call `subdivideProceduralParcels`.
   - Unit test with variable dimensions (48x36, 64x48, 96x72).
2. **Phase 2: Continuous Spatial Navigation & Seam Handoff**
   - Author `src/sim/systems/continuous-transit.system.ts`.
   - Wire seam crossing into `dispatchCommand` for `MOVE` and `PATHFIND_MOVE`.
   - Ensure party companions (`placePreservedCompanions`) follow seamlessly across seams.
3. **Phase 3: Expanded Building Templates & Fixtures**
   - Author `src/sim/spatial/building-templates-expanded.ts`.
   - Add Bessemer Foundry, Dockside Warehouse, and Clockwork Salon.
   - Register in template instantiator and verify room walkability.
4. **Phase 4: Continuous Viewport Projection**
   - Author `src/client/projection/continuous-projection.ts` and integrate with `frame-adapter.ts`.
   - Verify camera smoothly pans across border seams without visual pops or void artifacts.
5. **Phase 5: Multi-Seed Determinism & Invariant Verification**
   - Author `tests/sim/continuous-worldgen.test.ts`.
   - Run full verification (`npm run verify`).

---

## 5. Verification Method

To independently verify the observations and validate the proposed continuous generation architecture:

1. **Verify File Line Counts and Modularity Limits**:
   ```bash
   wc -l src/sim/spatial/*.ts src/schemas/building-template.schema.ts
   ```
   *Expected*: All files `<= 250` target (ceiling `300`). Verify `building-templates.ts` (235), `template-instantiator.ts` (236), `strata-portals.ts` (236) are near cap and need separation for new templates.

2. **Verify Existing Simulation Determinism & Walkability**:
   ```bash
   npx vitest run tests/sim/district-generator.test.ts tests/sim/cdda-worldgen-presentation-e2e.test.ts tests/sim/building-templates.test.ts
   ```
   *Expected*: All tests pass with 0 failures, validating multi-seed determinism and room walkability invariants.

3. **Verify Boundary Invariants & Zero Prohibited Sim Tokens**:
   ```bash
   npm run check:boundaries
   ```
   *Expected*: OK — zero forbidden imports (`pixi.js`, `preact`, `client/`), zero `Math.random()` or `Date.now()`, and zero files > 300 lines.

4. **Verify Zod Schemas & Content**:
   ```bash
   npm run validate:data && npm run typecheck
   ```
   *Expected*: Zero TypeScript compiler errors and 100% blueprint schema validation.

5. **Invalidation Conditions**:
   - Any continuous boundary implementation that introduces non-deterministic random calls (`Math.random()`) or browser references in `src/sim/`.
   - Any parcel subdivision that produces buildings with unreachable rooms (violating `hasTemplateWalkablePath`).
   - Any seam transition that severs the 100% BFS walkability guarantee between critical landmarks or compass gates.
   - Any file exceeding 300 lines in `src/sim/spatial/`.
