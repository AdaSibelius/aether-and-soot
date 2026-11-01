# Project: Enhanced Glyphs, Tileset Rendering & CDDA Multi-Stratum Worldgen

## Architecture
The system integrates visual representation advancements with deep procedural simulation generation across 4 distinct strata, following strict headless core/shell separation (`src/sim/` vs `src/client/`):
- **Core Simulation (`src/sim/spatial/`)**:
  - Declarative CDDA matrix templates (`BuildingTemplate`) instantiated into `StratumGrid` cells and `EntityRecord` fixtures.
  - Multi-stratum generation pipeline for City Districts, Sewers, Mines, and Industrial Zones.
  - Invariant enforcement: Spanning tree connectivity, non-severing fixture placement (`canPlaceWithoutSevering`), pocket sealing (`fillUnbuiltYards`), and 100% BFS walkability verification (`hasWalkablePath`, `ensureDistrictConnectivity`).
- **Data Schemas (`src/schemas/`)**:
  - `building-template.schema.ts` specifying cell rules, room boundaries, and matrix legends.
  - Extended primitives: `InteriorZoneTypeSchema`, `BuildingArchetypeIdSchema`, `TerrainTypeSchema` (`TIMBER_STRUT`).
  - Extended fixtures in `world-components.schema.ts` (`FurnitureComponentSchema`).
- **Client Presentation Shell (`src/client/renderer/` & `src/client/projection/`)**:
  - Multi-layer tactical frame projection (`RenderCellLayers`: floor, fixture, item, actor, indicator).
  - Extended CP437 box-drawing resolution for interior partitions and machinery.
  - `TacticalLayerComposer` managing layered sprite pools batched into single WebGL draw calls.
  - `TilesetManager` and `ProceduralTileset` providing toggleable `CP437_ASCII`, `GRAPHICAL_TILESET`, and `HYBRID_OVERLAY` modes.
  - 100% compatibility with `SteampunkRenderPipeline` and `DIEGETIC_FRAGMENT_SHADER` (isolated at `uTacticalSplit = 58/88`).

---

## Feature Inventory
| # | Feature | Description | Milestone | Source |
|---|---|---|---|---|
| 1 | Multi-Layer Glyph Projection | Extended `RenderCellFrame` with `RenderCellLayers` (floor, fixture, item, actor, indicator) preserving floor readability beneath entities | M3 | Survey R2-1 |
| 2 | Extended Box-Drawing | Resolution of single-line interior partitions, double-line exterior walls, and mixed junctions | M3 | Survey R2-1 |
| 3 | Tactical Layer Composer | Layered sprite pooling in PixiJS with 4-tier oxidized iron Z-depth palette depth shading | M3 | Survey R2-1 |
| 4 | Graphical Tileset & Presentation Modes | Procedural vector tileset generator and toggleable `CP437_ASCII`, `GRAPHICAL_TILESET`, `HYBRID_OVERLAY` modes | M3 | Survey R2-1 |
| 5 | WebGL Shader & Tactical Split Compatibility | Unbroken post-processing compositing (bloom, smoke, lens) with UI isolation at `uTacticalSplit = 58/88` | M3 | Survey R2-1 |
| 6 | Building Template & Fixture Schemas | `building-template.schema.ts` and schema extensions in `primitives.schema.ts` and `world-components.schema.ts` | M1 | Survey R2-3 |
| 7 | Victorian Steampunk Fixture Density | Blueprints and factories for 8 fixtures: workbenches, coal stoves, iron boilers, desks, lamps, dispatch tubes, cabinets, valve manifolds | M1 | Survey R2-3 |
| 8 | CDDA Building Layout Templates | Matrix templates for Taverns, Constabulary Offices, Tenement Houses, Apothecaries, Workshops, and Boilerhouses | M1 | Survey R2-3 |
| 9 | Template Instantiator | Deterministic placement with rotation, mirroring, door alignment, and fixture spawning | M1 | Survey R2-3 |
| 10 | CDDA City District Generation | Hierarchical street networks (thoroughfares, cross-streets, back-alleys, parcel lots, setbacks) | M2 | Survey R2-2 |
| 11 | Sewer Stratum Topology | Dual-channel effluent flumes, inspection walkways, and octagonal junction chambers | M2 | Survey R2-2 |
| 12 | Subterranean Mine Generation | Meandering drift shafts, stopes, `TIMBER_STRUT` shoring, and narrow-gauge rail haulage | M2 | Survey R2-2 |
| 13 | Industrial Sector Generation | Smelting halls, reverberatory furnaces, conveyor runs, rail spurs, and boiler yards | M2 | Survey R2-2 |
| 14 | Cross-Stratum Portals & Walkability Guarantees | Inter-stratum transitions (manholes, stairwells, mine hoists) and 100% BFS pathfinding walkability enforcement | M2 | Survey R2-2 |
| 15 | Deterministic Simulation Test Suite | Headless Vitest test suites verifying multi-seed determinism, template instantiation, and walkability | M4 | Survey R2-2/3 |
| 16 | Full Verification & Modularity Compliance | `npm run verify` passing 4 gates with 0 errors, strictly <= 250 lines per module (hard ceiling 300) | M4 | All Surveys |

---

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|---|---|---|---|
| M1 | Building Layout Templates & Steampunk Fixtures | Features 6, 7, 8, 9: Schemas, fixture catalog, CDDA matrix templates, instantiator, unit tests | None | **DONE** |
| M2 | Multi-Stratum Procedural Generation & Urban Layouts | Features 10, 11, 12, 13, 14: City districts, sewers, mines, industrial zones, portals, walkability | M1 | IN_PROGRESS |
| M3 | Enhanced CP437 Glyphs & Graphical Tileset Presentation | Features 1, 2, 3, 4, 5: Multi-layer projection, extended box-drawing, layer composer, tileset manager | M1 | PLANNED |
| M4 | E2E Integration, Determinism & Full Verification | Features 15, 16: Multi-seed integration tests, full verification gate (`npm run verify`), audit signoff | M1, M2, M3 | PLANNED |

---

## Interface Contracts

### M1 Building Templates ↔ M2 Multi-Stratum Worldgen
- `instantiateTemplateIntoGrid(grid: StratumGrid, entities: Record<string, EntityRecord>, template: BuildingTemplate, placement: TemplatePlacement, rng: SeededRNG): TemplateInstantiationResult`
  - Output: Modified `StratumGrid`, populated `entities`, `entrancePoints: Point2D[]`, `outwardPoints: Point2D[]`, and `fixturesPlaced: EntityId[]`.
  - Guaranteed: All interior rooms reach at least one exterior entrance door (`hasTemplateWalkablePath`).
- `BUILDING_TEMPLATE_REGISTRY`: Record mapping template IDs (`building_victorian_tavern`, `building_constabulary_station`, `building_tenement_house`, `building_apothecary_clinic`, `building_artisan_workshop`, `building_steam_boilerhouse`) to compiled `BuildingTemplate` instances.

### M1 / M2 Simulation Core ↔ M3 Client Presentation Shell
- `RenderCellLayers`:
  ```typescript
  export interface GlyphLayerVisual {
    readonly glyph: string;
    readonly fgPrimary: string;
    readonly fgSecondary?: string;
    readonly alpha?: number;
    readonly shaderFlags?: readonly ShaderFlag[];
    readonly tileKey?: string;
  }
  export interface RenderCellLayers {
    readonly floor: GlyphLayerVisual;
    readonly fixture?: GlyphLayerVisual;
    readonly item?: GlyphLayerVisual;
    readonly actor?: GlyphLayerVisual;
    readonly indicator?: GlyphLayerVisual;
  }
  ```
- `projectWorldToVisualFrame(state: Readonly<WorldState>, ...)` produces `RenderCellFrame` with both composite `visual: VisualGlyphSpec` (backward-compatible) and discrete `layers: RenderCellLayers`.
- `VisualRenderMode`: `'CP437_ASCII' | 'GRAPHICAL_TILESET' | 'HYBRID_OVERLAY'`.

---

## Code Layout

### Data Schemas (`src/schemas/`)
- `src/schemas/primitives.schema.ts`: Extended `InteriorZoneTypeSchema`, `BuildingArchetypeIdSchema`, `TerrainTypeSchema` (`TIMBER_STRUT`).
- `src/schemas/world-components.schema.ts`: Extended `FurnitureComponentSchema.kind`.
- `src/schemas/building-template.schema.ts`: CDDA matrix template schema.

### Simulation Core (`src/sim/spatial/`)
- `src/sim/spatial/fixture-catalog.ts`: Victorian Steampunk fixture factories with components.
- `src/sim/spatial/building-templates.ts`: Declarative CDDA-style matrix templates.
- `src/sim/spatial/template-instantiator.ts`: Stamping algorithm with rotation and door alignment.
- `src/sim/spatial/urban-district.ts`: CDDA urban street layout, alleys, and parcel plots.
- `src/sim/spatial/sewer-topology.ts`: Undercroft effluent flumes and octagonal junction chambers.
- `src/sim/spatial/mines-generation.ts`: Meandering drift shafts, stopes, and timber shoring.
- `src/sim/spatial/industrial-district.ts`: Smelting halls, conveyor runs, and boiler yards.
- `src/sim/spatial/strata-portals.ts`: Unified cross-stratum portal generation.

### Client Presentation Shell (`src/client/`)
- `src/client/projection/extended-box-drawing.ts`: Monospace CP437 box-drawing resolver.
- `src/client/projection/frame-adapter.ts`: Multi-layer visual projection.
- `src/client/renderer/tactical-layer-composer.ts`: PixiJS multi-layer sprite pooling.
- `src/client/renderer/tileset-manager.ts`: Visual mode routing and texture management.
- `src/client/renderer/procedural-tileset.ts`: Procedural canvas vector tile generator.

### Tests (`tests/sim/`)
- `tests/sim/building-templates.test.ts`: Template instantiation, fixtures, and multi-seed determinism.
- `tests/sim/multi-stratum-worldgen.test.ts`: Multi-stratum generation, walkability invariants across seeds.
- `tests/sim/client-presentation-modes.test.ts`: Presentation mode switching and layer composition validation.
