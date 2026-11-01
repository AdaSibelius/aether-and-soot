# Handoff Report: Building Layout Templates & Fixture Density (Requirements R2 & R3)

**Author**: Teamwork Explorer (Building Templates & Blueprints Explorer)  
**Date**: 2026-11-01  
**Working Directory**: `/Users/emmett/Desktop/Game/.agents/teamwork/teamwork_explorer_survey_r2_3/`  
**Target Milestone**: Survey Phase R2 & R3 — CDDA-Style Building Layout Templates, Victorian Steampunk Furniture & Fixture Density, and Deterministic Spatial Instantiation  

---

## 1. Observation

Direct code and schema inspection across the repository revealed the current state of spatial generation, building typologies, and fixture representation:

### 1.1 Existing Procedural Building Pipeline
- **Macro Layout & Plot Zoning**:
  - `src/sim/spatial/district-blocks.ts:32-58`: `planMacroLayout` permutes 6 canonical typologies across a 3x2 grid of plots flanking a central thoroughfare.
  - `src/sim/spatial/block-geometry.ts:14-22`: `CANONICAL` defines bounding boxes for 6 typologies: `apothecary` (33,3 to 43,12), `pawnshop` (8,3 to 15,12), `boilerhouse` (3,24 to 13,33), `rookeries` (33,24 to 43,33), `monorailDepot` (17,3 to 29,12), and `artisanWorkshop` (17,24 to 29,33).
  - `src/sim/spatial/district-blocks.ts:115-161`: `applyTypologyPlacements` generates typologies on a scratch grid and stamps their terrain, doors, and entities into target plot boxes, applying `mirrorX` and `flipY` to face the street.

### 1.2 Imperative Hardcoding of Building Typologies
- Currently, all building architectures are hardcoded imperatively across two files:
  - `src/sim/spatial/typologies-civic.ts` (203 lines): Contains hardcoded coordinate carving for `Apothecary` (Waiting Lounge, Operating Theatre, Chemical Dispensary), `Pawnshop` (Appraisal Concourse, Pawn Stash, Cartel Strongroom), and `Tenement Rookeries` (Flats 1-4, Pauper Alcove).
  - `src/sim/spatial/typologies-industrial.ts` (198 lines): Contains hardcoded coordinate carving for `Boilerhouse` (Smelting Hearth, Fuel Stacks), `Monorail Depot` (Ticket Booth, Concourse, Platforms), and `Artisan Workshop` (Showroom, Master Bench, Vault).
- **Line Count Warning**: Both `typologies-civic.ts` (203 lines) and `typologies-industrial.ts` (198 lines) are rapidly approaching the 240-line warning threshold and 300-line hard ceiling. Adding new requested building types (Taverns, Constabulary Offices, Tenement Houses with corridors/sculleries) directly into these files would immediately breach Rule 2.2 (`<= 250` target, `300` hard fail limit).

### 1.3 Existing Component and Schema Capabilities
- **Interior Zones** (`src/schemas/primitives.schema.ts:163-175`):
  ```ts
  export const InteriorZoneTypeSchema = z.enum([
    'NONE', 'RECEPTION', 'WORKSHOP', 'VAULT', 'SURGICAL_BAY',
    'STORAGE', 'LOADING_DOCK', 'ASSEMBLY_LINE', 'PLATFORM', 'TICKET_BOOTH', 'BACKROOM',
  ]);
  ```
  Missing zones: `'CORRIDOR'`, `'LIVING_QUARTERS'`, `'SCULLERY'`, `'CELLAR'`, `'PUBLIC_BAR'`, `'HOLDING_CELL'`, `'INSPECTOR_OFFICE'`.
- **Building Archetypes** (`src/schemas/primitives.schema.ts:178-186`):
  ```ts
  export const BuildingArchetypeIdSchema = z.enum([
    'VICTORIAN_APOTHECARY_CLINIC', 'CLOCKWORK_PAWNSHOP_BANK',
    'STEAM_BOILERHOUSE_FURNACE', 'TENEMENT_ROOKERIES',
    'PNEUMATIC_MONORAIL_DEPOT', 'GUILD_ARTISAN_WORKSHOP',
  ]);
  ```
  Missing archetypes: `'VICTORIAN_TAVERN'`, `'CONSTABULARY_OFFICE'`, `'TENEMENT_HOUSE'`.
- **Furniture Components** (`src/schemas/world-components.schema.ts:59-83`):
  ```ts
  export const FurnitureComponentSchema = z.object({
    kind: z.enum([
      'BED', 'SURGICAL_TABLE', 'LOCKER', 'CRATE', 'BOOKSHELF',
      'ARTIFICER_BENCH', 'STEAM_CHARGER', 'BARRICADE_WOOD', 'BARRICADE_IRON',
      'SAFE_VAULT', 'SMELTING_FURNACE', 'CLOCKTOWER_MECHANISM', 'WATER_PUMP',
      'CANAL_LOCK_MECHANISM', 'BOTANICAL_PLANTER', 'MONORAIL_DEPOT_CONSOLE',
      'APOTHECARY_COUNTER', 'PEDESTAL',
    ]),
    label: z.string().min(1),
    durabilityHp: z.number().int().positive().optional(),
  });
  ```
  Missing Victorian Steampunk fixtures: `'COAL_STOVE'`, `'IRON_BOILER'`, `'ROLL_TOP_DESK'`, `'GAS_LAMP'`, `'PNEUMATIC_DISPATCH'`, `'FILING_CABINET'`, `'VALVE_MANIFOLD'`, `'BAR_COUNTER'`, `'CELL_BENCH'`.
- **Physical Tile Representation** (`src/sim/spatial/grid.ts:5-17`):
  `TileCellSchema` already possesses fields for `interiorZone`, `steamPressureKpa`, `smokePpm`, `coalDustDensity`, `liquidType`, and `liquidVolumeMl`.
- **Flat Relational ECS & World Serialization** (`src/sim/core/world.ts:42-69`):
  `WorldStateSchema` stores `strata: z.record(StratumIdSchema, StratumGridSchema)` and `entities: z.record(z.string(), EntityComponentsSchema)`. All furniture and fixtures are stored as flat `EntityRecord` instances referencing branded `EntityId`s.

---

## 2. Logic Chain

1. **CDDA Mapgen Precedent**:
   - Cataclysm: Dark Days Ahead (CDDA) structures complex multi-tile urban buildings using ASCII matrix character maps ("rows") paired with declarative JSON palettes mapping characters to terrain, furniture, loot tables, and regional room zones.
   - In Aether & Soot, hardcoded imperative coordinate geometry prevents modular scaling, increases authoring friction, and threatens the 300-line modularity ceiling.
   - Adopting a CDDA-style matrix template specification (`BuildingTemplateSchema`) enables declarative authoring of building footprints, room partitions, and fixture anchors while retaining deterministic procedural variation (mirroring, flipping, room jittering, and annex attachments).

2. **Room Partitioning & Structural Semantics**:
   - Realistic Victorian urban architecture requires distinct functional zoning:
     * **Tenements**: Central circulation corridors, communal sculleries, private living quarters (flats), and cellar/coal storage.
     * **Taverns**: Public drinking bar, intimate private snug, scullery/prep kitchen, and beer/spirit cellar.
     * **Constabularies**: Charge desk reception, barred holding cells/lockup, inspector's private office, and evidence vault.
     * **Workshops & Boilerhouses**: Appraisal counters, master workbenches, smelting furnaces, and fuel bunker stacks.
   - Expanding `InteriorZoneTypeSchema` to include `'CORRIDOR'`, `'LIVING_QUARTERS'`, `'SCULLERY'`, `'CELLAR'`, `'PUBLIC_BAR'`, `'HOLDING_CELL'`, and `'INSPECTOR_OFFICE'` enables simulation systems (AI patrol routines, trespassing detection, crime witnessing, and acoustic/thermal propagation) to query `cell.interiorZone` directly.

3. **Victorian Steampunk Furniture & Fixture Physics**:
   - Fixtures in Aether & Soot are dual-nature: they are both physical interactive entities (`EntityRecord`) and spatial obstacles (`PositionComponent.blocksMovement`).
   - Specific physics and component integrations:
     * **Brass Workbenches**: `blocksMovement: false`, provides `WorkbenchComponent` (`stationType: 'ARTIFICER_BENCH', bonusEfficiencyPct: 25`).
     * **Coal Stoves**: `blocksMovement: true`, provides `ThermalComponent` (`coreHeatPct: 80`) and container `InventoryComponent` for anthracite fuel.
     * **Iron Boilers**: `blocksMovement: true`, `blocksSight: true`, provides `PressureVesselComponent` and emits thermodynamic pressure/smoke halos into `TileCell`.
     * **Mahogany Roll-Top Desks**: `blocksMovement: true`, container holding contracts, deeds, and currency.
     * **Gas Lamps**: `blocksMovement: false`, provides `ThermalComponent` (`coreHeatPct: 25`) and FOV illumination radius with `GASLIGHT_RADIANCE` shader flag.
     * **Pneumatic Dispatch Tubes**: `blocksMovement: true`, provides `UtilityConduitComponent` (`conduitType: 'PNEUMATIC_TRANSIT_TUBE'`) for message/canister delivery.
     * **Filing Cabinets**: `blocksMovement: true`, container holding dossiers and crime evidence.
     * **Valve Manifolds**: `blocksMovement: true`, provides `PressureVesselComponent` interactable to divert or vent high-pressure steam.

4. **Zero-Breaking Serialization & Determinism**:
   - Because all building instantiations write strictly to `grid.cells` and `state.entities`, no changes to `WorldStateSchema` are required.
   - Save/load serialization (`serializeWorld` and `deserializeWorld`) remains 100% backward- and forward-compatible.
   - Invariant enforcement: All template transformations (rotation, mirroring, fixture placement, loot rolls) consume `SeededRNG` from `PipelineDistrictContext`. No `Math.random()` or non-deterministic calls occur, ensuring identical random seeds yield byte-identical world states.

---

## 3. Detailed Architectural Specifications

### 3.1 Proposed Building Template Schema (`src/schemas/building-template.schema.ts`)

```typescript
import { z } from 'zod';
import {
  BlueprintIdSchema,
  BuildingArchetypeIdSchema,
  InteriorZoneTypeSchema,
  Point2DSchema,
  StratumIdSchema,
  TerrainTypeSchema,
  VisualGlyphSpecSchema,
} from './primitives.schema.js';
import { FurnitureComponentSchema } from './world-components.schema.js';

export const TemplateCellRuleSchema = z.object({
  terrain: TerrainTypeSchema,
  interiorZone: InteriorZoneTypeSchema.optional(),
  furnitureKind: FurnitureComponentSchema.shape.kind.optional(),
  furnitureLabel: z.string().optional(),
  furnitureVisual: VisualGlyphSpecSchema.optional(),
  isContainer: z.boolean().default(false),
  lootTableId: z.string().optional(),
  blocksMovement: z.boolean().optional(),
  blocksSight: z.boolean().optional(),
  steamPressureKpa: z.number().nonnegative().optional(),
  smokePpm: z.number().int().nonnegative().optional(),
  thermalCoreHeatPct: z.number().min(0).max(100).optional(),
  crossStratumPortal: z.object({
    targetStratum: StratumIdSchema,
    portalLabel: z.string(),
  }).optional(),
});
export type TemplateCellRule = z.infer<typeof TemplateCellRuleSchema>;

export const TemplateRoomDefinitionSchema = z.object({
  zone: InteriorZoneTypeSchema,
  label: z.string().min(1),
  x1: z.number().int().nonnegative(),
  y1: z.number().int().nonnegative(),
  x2: z.number().int().nonnegative(),
  y2: z.number().int().nonnegative(),
  ambientSmokePpm: z.number().int().nonnegative().default(0),
  ambientSteamKpa: z.number().nonnegative().default(0),
});
export type TemplateRoomDefinition = z.infer<typeof TemplateRoomDefinitionSchema>;

export const BuildingTemplateSchema = z.object({
  id: BlueprintIdSchema,
  archetypeId: BuildingArchetypeIdSchema,
  name: z.string().min(1),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  defaultWallTerrain: TerrainTypeSchema.default('SOOT_BRICK_WALL'),
  defaultFloorTerrain: TerrainTypeSchema.default('COBBLESTONE_FLOOR'),
  rows: z.array(z.string()),
  legend: z.record(z.string(), TemplateCellRuleSchema),
  rooms: z.array(TemplateRoomDefinitionSchema),
  exteriorDoorChar: z.string().length(1).default('+'),
  windowsChar: z.string().length(1).default('"'),
});
export type BuildingTemplate = z.infer<typeof BuildingTemplateSchema>;
```

### 3.2 CDDA Matrix Layouts for Key Typologies

#### A. Victorian Tavern (`building_victorian_tavern`)
Dimensions: 12x10. Features Public Bar, Private Snug, Kitchen Scullery, and Beer Cellar Sump Hatch.
```text
Rows (Matrix):
"############"
"#..g..#....#"  <- Top-Left: Private Snug (desk 'g', chairs); Top-Right: Scullery (stove 's', sink)
"#..D..#..s.#"
"#.###+#+####"  <- Interior partition doors ('+')
"#.#........#"  <- Cellar hatch ('H') leading to Undercroft
"#.H.======.#"  <- Bar counter barrier ('=')
"#...=....b.#"  <- Public Bar drinking concourse ('b' = bar stool)
"#...=.T..b.#"  <- Tables ('T')
"#...=......#"
"#####+######"  <- Main Entrance door ('+') facing street
```
- **Legend Mappings**:
  - `#`: `SOOT_BRICK_WALL` (exterior/partition)
  - `.`: `COBBLESTONE_FLOOR`
  - `+`: `WOODEN_DOOR_CLOSED`
  - `"`: `GLASS_WINDOW`
  - `=`: `COUNTER_BARRIER` (`interiorZone: 'PUBLIC_BAR'`)
  - `b`: Furniture `BAR_COUNTER` / stool (`blocksMovement: false`)
  - `T`: Furniture `ROLL_TOP_DESK` / table
  - `s`: Furniture `COAL_STOVE` (`thermal: { coreHeatPct: 80 }`, container for coal)
  - `g`: Furniture `ROLL_TOP_DESK` (`interiorZone: 'RECEPTION'`, container for ledger)
  - `H`: Portal `STREET -> UNDERCROFT` (Beer/Spirit Cellar Ladder)

#### B. Constabulary Office (`building_constabulary_station`)
Dimensions: 11x10. Features Charge Room, Inspector's Office, Holding Cells, and Evidence Locker.
```text
Rows (Matrix):
"###########"
"#..F#C1|C2#"  <- Top-Right: Barred Holding Cells ('C1', 'C2') with Iron Grate
"#..g#==+==#"  <- Top-Left: Inspector's Office (desk 'g', filing cabinet 'F')
"##+########"  <- Interior doors
"#.........#"
"#..======.#"  <- Charge Room Counter Barrier ('=')
"#..=....d.#"  <- Constable Charge Desk ('d')
"#..=..p...#"  <- Pneumatic Dispatch Tube ('p')
"#..E......#"  <- Evidence Safe Vault ('E')
"####+######"  <- Main street entrance door ('+')
```
- **Legend Mappings**:
  - `d`: Furniture `ROLL_TOP_DESK` (Constable charge desk)
  - `p`: Furniture `PNEUMATIC_DISPATCH` (`utilityConduit: 'PNEUMATIC_TRANSIT_TUBE'`)
  - `F`: Furniture `FILING_CABINET` (Rolled-steel evidence/dossier cabinet)
  - `E`: Furniture `SAFE_VAULT` (Reinforced evidence lockbox)
  - `C1`, `C2`: Terrain `IRON_GRATE`, Furniture `CELL_BENCH` (`interiorZone: 'HOLDING_CELL'`)
  - `|`: `WROUGHT_IRON_FENCE` (cell bars, `blocksMovement: true, blocksSight: false`)

#### C. Tenement House with Partitioned Living Quarters & Scullery (`building_tenement_house`)
Dimensions: 11x11. Central corridor spine accessing individual pauper rooms, shared scullery, and basement drop.
```text
Rows (Matrix):
"###########"
"#b..#.#..b#"  <- Flat 1 (left) and Flat 2 (right) with sleeping cots ('b')
"#...#.#...#"
"##+##.##+##"  <- Corridor doorways into flats
"#...#.#...#"
"#...#.###+#"  <- Shared Scullery (bottom right): coal stove ('s'), wash pump ('W')
"#...#.#.s.#"
"#...#.#.W.#"
"#H..#.#...#"  <- Tenement Cellar Hatch ('H') in common hall
"#####+#####"  <- Main Entrance door ('+')
```

---

### 3.3 Complete Steampunk Furniture & Fixture Entity Blueprints

The 8 required fixtures map cleanly to flat ECS components:

| Fixture Name | Furniture `kind` | Components Attached | Visual Specs | Collision & Physics |
|---|---|---|---|---|
| **Brass Artificer Workbench** | `ARTIFICER_BENCH` | `furniture`, `workbench` ({ stationType: 'ARTIFICER_BENCH', bonusEfficiencyPct: 25 }) | Glyph: `'T'`, `#D4AF37` / `#CD7F32`, `['SPARK_GLINT']` | Blocks move: `false`, Blocks sight: `false`. Crafting utility station. |
| **Cast-Iron Coal Stove** | `COAL_STOVE` | `furniture`, `thermal` ({ coreHeatPct: 80 }), `inventory` (coal fuel) | Glyph: `'♨'`, `#E67E22` / `#BA4A00`, `['HEAT_SHIMMER']` | Blocks move: `true`, Blocks sight: `false`. Radiant heat emitter. |
| **Industrial Iron Boiler** | `IRON_BOILER` | `furniture`, `pressureVessel` (120 kPa / 250 kPa), `thermal` ({ coreHeatPct: 90 }) | Glyph: `'Ω'`, `#5DADE2` / `#2E86C1`, `['PULSE_STEAM', 'VOLUMETRIC_PLUME']` | Blocks move: `true`, Blocks sight: `true`. Thermodynamic stress halo (3x3). |
| **Mahogany Roll-Top Desk** | `ROLL_TOP_DESK` | `furniture`, `inventory` (ledgers, pence, permits) | Glyph: `'╤'`, `#873600` / `#5B2C6F`, `['COUNTER_GLINT']` | Blocks move: `true`, Blocks sight: `false`. Container loot storage. |
| **Welsbach Mantle Gas Lamp** | `GAS_LAMP` | `furniture`, `thermal` ({ coreHeatPct: 25 }) | Glyph: `'☼'`, `#F9E79F` / `#F39C12`, `['GASLIGHT_RADIANCE']` | Blocks move: `false`, Blocks sight: `false`. FOV light emitter. |
| **Brass Pneumatic Dispatch Tube** | `PNEUMATIC_DISPATCH` | `furniture`, `utilityConduit` ({ conduitType: 'PNEUMATIC_TRANSIT_TUBE', operatingPressureKpa: 70 }), `inventory` | Glyph: `'¶'`, `#D4AF37` / `#B7950B`, `['PULSE_STEAM']` | Blocks move: `true`, Blocks sight: `false`. Inter-district messaging container. |
| **Rolled-Steel Filing Cabinet** | `FILING_CABINET` | `furniture`, `inventory` (dossiers, manifests) | Glyph: `'⌸'`, `#7F8C8D` / `#34495E`, `[]` | Blocks move: `true`, Blocks sight: `false`. Document container. |
| **High-Pressure Valve Manifold** | `VALVE_MANIFOLD` | `furniture`, `pressureVessel` (140 kPa / 250 kPa) | Glyph: `'X'`, `#E74C3C` / `#922B21`, `['SPARK_GLINT']` | Blocks move: `true`, Blocks sight: `false`. Pressure diversion valve. |

---

### 3.4 Modularity and File Size Architecture (< 250 Lines)

To strictly enforce Rule 2.2 (`<= 250 lines` per file, `300 lines` hard ceiling), the template implementation must be organized into 4 focused sub-modules:

1. **`src/schemas/building-template.schema.ts`** (~85 lines):
   - Defines `TemplateCellRuleSchema`, `TemplateRoomDefinitionSchema`, and `BuildingTemplateSchema`.
   - Reuses existing branded types from `primitives.schema.ts`.
2. **`src/sim/spatial/fixture-catalog.ts`** (~140 lines):
   - Deterministic factory functions: `createWorkbenchFixture`, `createCoalStoveFixture`, `createBoilerFixture`, `createDeskFixture`, `createGasLampFixture`, `createDispatchTubeFixture`, `createFilingCabinetFixture`, `createValveManifoldFixture`.
   - Seeds container contents using `seedContainer`.
3. **`src/sim/spatial/building-templates.ts`** (~170 lines):
   - Declarative catalogue of `BuildingTemplate` records for Tavern, Constabulary, Tenements, Clinic, Workshop, and Boilerhouse.
   - Decoupled from procedural drawing code.
4. **`src/sim/spatial/template-instantiator.ts`** (~190 lines):
   - Functions `instantiateTemplateIntoGrid(grid, entities, template, placement, rng)`:
     * Applies rotation (0, 90, 180, 270) and mirroring (`mirrorX`, `flipY`).
     * Stamps tile cells, terrain types, and interior zone tags.
     * Spawns fixture entities with deterministic `EntityId`s.
     * Connects exterior door to street thoroughfare.

---

## 4. Caveats

1. **Cellar / Multi-Stratum Linking Invariant**:
   - When placing a cellar hatch (`CELLAR_HATCH` or `IRON_GRATE` portal) inside a building template on `STREET`, the corresponding target coordinate on `UNDERCROFT` must be guaranteed walkable (not inside an uncarved solid wall). The pipeline must either align cellar portals with known undercroft cistern chambers or carve a dedicated 3x3 cellar alcove in `UNDERCROFT` at the target point.
2. **Door Facing Orientation**:
   - CDDA templates often have fixed door positions. When placing buildings in the top row (facing south toward thoroughfare) vs bottom row (facing north), `flipY` or 180-degree rotation must ensure the entrance door remains on the exterior wall facing the street corridor.
3. **Existing Test Fixture Dimensions**:
   - Small test fixtures run on 24x24 grids (`width < 36 || height < 28`). As confirmed in `src/sim/spatial/block-geometry.ts:51-53`, procedural macro-blocks activate only when `supportsProceduralBlocks(width, height)` (`width >= 45 && height >= 36`). Small 24x24 test fixtures must continue using their compact legacy paths so existing 24x24 regression tests continue passing without alteration.

---

## 5. Conclusion

1. **Feasibility**: Fully feasible. The spatial grid (`TileCellSchema`) and flat relational ECS (`EntityComponentsSchema`) already have all foundational fields necessary to support CDDA-style building templates and rich fixture density.
2. **Modularity Risk Resolved**: By defining declarative building templates and extracting `fixture-catalog.ts`, `building-templates.ts`, and `template-instantiator.ts`, the implementation avoids bloating existing 200-line files (`typologies-civic.ts`, `typologies-industrial.ts`) and stays comfortably under the 250-line target.
3. **Zero Serialization Friction**: Save state serialization (`WorldStateSchema`) remains 100% compatible with existing saves.
4. **Actionable Implementation Path**:
   - Step 1: Add new enum variants to `src/schemas/primitives.schema.ts` and `src/schemas/world-components.schema.ts`.
   - Step 2: Create `src/schemas/building-template.schema.ts`.
   - Step 3: Implement `src/sim/spatial/fixture-catalog.ts` and `src/sim/spatial/building-templates.ts`.
   - Step 4: Implement `src/sim/spatial/template-instantiator.ts` and integrate with `district-blocks.ts`.
   - Step 5: Author targeted unit tests in `tests/sim/building-templates.test.ts`.

---

## 6. Verification Method

To independently verify this design during implementation:

1. **Zod Schema & Typecheck**:
   ```bash
   npm run typecheck
   ```
   Ensures all new enum variants, template schemas, and fixture components typecheck strictly with zero `any` or loose casts.

2. **Boundary & Modularity Check**:
   ```bash
   npm run check:boundaries
   ```
   Verifies all new files (`building-template.schema.ts`, `fixture-catalog.ts`, `building-templates.ts`, `template-instantiator.ts`) are `<= 250 lines` and do not violate headless core/client separation.

3. **Deterministic Multi-Seed Test**:
   ```bash
   npx vitest run tests/sim/building-templates.test.ts
   ```
   Independent test suite verifying:
   - For seeds 1..50, building templates instantiate with 100% walkability between street doors and all partitioned rooms (`hasWalkablePath`).
   - Fixture counts (boilers, workbenches, coal stoves, roll-top desks, gas lamps, dispatch tubes, filing cabinets) match template specifications.
   - Identical seeds yield byte-identical `serializeWorld` output.
   - Smash terrain command (`SMASH_TERRAIN`) cleanly operates on glass windows and interior barriers without invalidating path invariants.

4. **Full Verification Suite Gate**:
   ```bash
   npm run verify
   ```
   All 4 verification gates (typecheck, boundary checks, data validation, simulation tests) must pass with 0 errors.
