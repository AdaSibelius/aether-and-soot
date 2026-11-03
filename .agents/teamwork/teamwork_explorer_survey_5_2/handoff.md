# Spatial Survey Explorer Handoff Report: Requirement R2 (Visual Testing & Survey Sheet Self-Correction)

**Author:** teamwork_explorer_survey_5_2 (Visual Survey Explorer)  
**Date:** 2026-11-02T17:03:00Z  
**Task:** Architectural Investigation for Requirement R2 (Visual Testing and Spatial Survey Sheet Self-Correction inspired by Fallout: New York methodology)  
**Target Milestone:** Milestone 5  

---

## 1. Observation

### 1.1 Existing Spatial Generation & Layout Pipelines (`src/sim/spatial/`)
- **`src/sim/spatial/grid.ts`** (130 lines):
  - Defines `StratumGrid` (`width`, `height`, `cells: TileCell[]`) and `TileCell` (`terrainType`, `blocksMovement`, `blocksSight`, `interiorZone`, `steamPressureKpa`, `smokePpm`, `coalDustDensity`, `liquidType`, `liquidVolumeMl`, `explored`).
  - Implements spatial queries `isWithinBounds`, `getTileCell`, `setTileCell`, `findEntitiesAtPoint`, and `findBlockingEntityAtPoint`.
- **`src/sim/spatial/building-templates.ts`** (235 lines):
  - Defines CDDA matrix templates (`TEMPLATE_VICTORIAN_TAVERN`, `TEMPLATE_CONSTABULARY_STATION`, `TEMPLATE_TENEMENT_HOUSE`, `TEMPLATE_APOTHECARY_CLINIC`, `TEMPLATE_ARTISAN_WORKSHOP`, `TEMPLATE_STEAM_BOILERHOUSE`).
  - Template matrices define interior fixtures (workbenches, stoves, desks, boilers, counters), room partitions, and exterior door character `'+'`.
- **`src/sim/spatial/template-instantiator.ts`** (236 lines):
  - Implements `instantiateTemplateIntoGrid(grid, entities, template, placement, rng)` with orthogonal rotation (`0 | 90 | 180 | 270`) and horizontal/vertical flipping (`mirrorX`, `flipY`).
  - Lines 158–165 record entrance and outward direction:
    ```typescript
    const isPerimeter = u === 0 || u === w - 1 || v === 0 || v === h - 1;
    if (ch === template.exteriorDoorChar && isPerimeter) {
      entrancePoints.push(pt);
      doors[`${template.id}_door_${entrancePoints.length}`] = pt;
      const outU = u === 0 ? -1 : u === w - 1 ? 1 : 0;
      const outV = v === 0 ? -1 : v === h - 1 ? 1 : 0;
      outwardPoints.push(transformCoord(u + outU, v + outV, w, h, rot, mx, fy, origin));
    }
    ```
  - Lines 217–233 enforce an interior room walkability invariant: every interior room in the template must reach the exterior door via `hasTemplateWalkablePath`.
- **`src/sim/spatial/urban-district.ts`** (204 lines):
  - Lines 53–98 (`carveHierarchicalStreetNetwork`): carves a 7x7 central plaza, 3-wide arterial avenue, 2-wide cross-streets, and 1-wide back-alleys.
  - Lines 100–111 (`subdivideUrbanParcels`): parcels are partitioned into 6 lots (`parcel_nw`, `parcel_nc`, `parcel_ne`, `parcel_sw`, `parcel_sc`, `parcel_se`) with `frontDirection: 'NORTH' | 'SOUTH'`.
  - Lines 160–169 stamp building templates into parcels, randomly mirroring with `rng.nextFloat() < 0.5`.
  - Lines 179–182 attempt a corridor connection:
    ```typescript
    for (const outPt of stampRes.outwardPoints) {
      const targetY = parcel.frontDirection === 'SOUTH' ? outPt.y + 1 : outPt.y - 1;
      g = carveCorridor(g, outPt, { x: outPt.x, y: targetY }, 'COBBLESTONE_FLOOR');
    }
    ```
- **`src/sim/spatial/district-yards.ts`** (221 lines):
  - Lines 40–74 (`fillUnbuiltYards`): Voronoi scatter of `SOOT_BRICK_WALL`, `COBBLESTONE_FLOOR`, `RUBBLE_PILE`, `SLAG_MOUND`, `WROUGHT_IRON_FENCE`, `GASLAMP_POST`, `BRASS_STEAM_PIPE` into unbuilt space outside footprints.
  - Lines 118–147 (`punchPath`): cuts an L-shaped passage converting blocking tiles to cobblestone floors (except `interiorZone === 'VAULT'`).
  - Lines 153–166 (`ensureDistrictConnectivity`): checks `hasWalkablePath` from central plaza to targets; calls `punchPath` when unreachable.
  - Lines 172–221 (`sealOrphanedWalkableTiles`): BFS flood fills from the hub; any walkable cell or door unreachable from the hub is sealed back to solid `SOOT_BRICK_WALL` or `ABYSS_DROP`.

### 1.2 Existing Client Projection & Rendering Pipelines (`src/client/projection/`, `src/client/renderer/`)
- **`src/client/projection/frame-adapter.ts`** (207 lines):
  - Pure read-only projection: `projectWorldToVisualFrame(state, focusActorId, baseFovRadius, viewportOverride)`.
  - Computes visible tiles via shadowcasting FOV (`computeVisibleTiles`); clamps output to a local camera viewport (default 24x20 cells).
  - Emits `RenderCellFrame` with composite `visual: VisualGlyphSpec` and discrete `layers: RenderCellLayers`.
- **`src/client/projection/layer-projection.ts`** (132 lines):
  - Defines `RenderCellLayers` (`floor: GlyphLayerVisual`, `fixture?: GlyphLayerVisual`, `item?: GlyphLayerVisual`, `actor?: GlyphLayerVisual`, `indicator?: GlyphLayerVisual`).
  - Maps terrain types to procedural vector tile keys via `resolveTerrainTileKey`.
- **`src/client/projection/extended-box-drawing.ts`** (177 lines):
  - Resolves single-line partitions (`SingleBoxGlyphs`), double-line facades (`DoubleBoxGlyphs`), and mixed junctions (`MixedBoxGlyphs`).
  - Resolves wall autotiling bitmasks in `resolveExtendedConnectingWallGlyph(grid, x, y)`.
- **`src/client/renderer/tactical-layer-composer.ts`** (213 lines):
  - Manages 5 discrete PixiJS layer containers batched into single draw calls with oxidized iron Z-depth palette tiers (Tier 0 Floor, Tier 1 Fixture, Tier 2 Item, Tier 3 Actor).

### 1.3 Existing Spatial & Visual Testing Infrastructure (`tests/sim/`, `tests/scripts/`)
- **`tests/sim/spatial-contiguity-audit.test.ts`** (169 lines):
  - Verifies zero sealed interior rooms and zero yard fence/lamp blobs > 3 tiles across 25 seeds (`AUD-01`, `AUD-02`).
  - Verifies 100% portal reciprocity and Spire bridge connectivity (`AUD-04`, `AUD-05`).
- **`tests/sim/wall-autotile-closure.test.ts`** (109 lines):
  - Tests wall autotiling closure when partitions meet door/window/gate jambs (no disconnected `#` glyphs).
- **`tests/scripts/playtester-projection-audit.ts`** (207 lines):
  - Audits client UI string buffers for raw snake_case ID leaks, truncated identifiers, and coordinate desyncs.
- **`tests/scripts/hermes-vision-critic.ts`** (216 lines):
  - Audits modal UI character buffers (88x36 grid) for clipping, unmapped glyphs, and border collisions.
- **`npm run verify` Status**:
  - Full suite cleanly passes 123 test files and 651 unit tests with 0 errors (`tsc --noEmit`, boundary check 434 files, data validation, Vitest).

### 1.4 Codebase Modularity Telemetry (Near-Cap Files)
- Files with high line counts near the 250-line target:
  - `src/sim/spatial/template-instantiator.ts`: **236 lines**
  - `src/sim/spatial/strata-portals.ts`: **236 lines**
  - `src/sim/spatial/building-templates.ts`: **235 lines**
  - `src/client/projection/biome-palette.ts`: **235 lines**
  - `src/sim/spatial/sewer-topology.ts`: **227 lines**
  - `src/sim/spatial/district-yards.ts`: **221 lines**
  - `src/sim/spatial/industrial-district.ts`: **213 lines**
  - `src/client/renderer/tactical-layer-composer.ts`: **213 lines**
  - `src/client/renderer/glyph-stage.ts`: **209 lines**
  - `src/client/projection/frame-adapter.ts`: **207 lines**
  - `src/sim/spatial/urban-district.ts`: **204 lines**

---

## 2. Logic Chain

### 2.1 The Architectural Gap in Visual & Spatial Testing
1. **Observation 1.1 & 1.2**: Existing visual testing (`projectWorldToVisualFrame`) is strictly viewport-clamped (24x20) and player-centric (shadowcasting FOV obscures unexplored terrain). Meanwhile, procedural simulation tests in `tests/sim/` check isolated conditions (e.g., BFS walkability from plaza to gates in `spatial-contiguity-audit.test.ts`), but do NOT capture or verify the complete multi-layer spatial topology of the whole district.
2. **Failure Mode Risk**: When procedural generation scales (e.g., larger continuous districts, mirrored building stamps, unbuilt yard Voronoi scatter), spatial errors can silently occur:
   - Doorways can face solid brick walls of adjacent buildings or unbuilt yard fences.
   - Buildings can overlap or encroach into arterial road avenues.
   - Naive L-shaped `punchPath` can slice straight through private building rooms (like clinics, taverns, or bedrooms) to force path connectivity, destroying interior architectural integrity.
   - Alternatively, `sealOrphanedWalkableTiles` can seal unreachable rooms or doors into solid brick, permanently locking players out of building content.
3. **Inference**: A headless, omniscient, multi-layer **Spatial Survey Sheet** system (inspired by the Fallout: New York methodology) is required to capture the full simulation state, systematically detect all 5 classes of placement errors, and execute deterministic self-correction passes before final output.

### 2.2 The Fallout: New York Spatial Survey Sheet Concept
In Bethesda/Fallout level design and procedural urban generation, a "Survey Sheet" is an orthogonal, multi-perspective diagnostic dossier that dissects a generated world cell into discrete semantic and physical strata:
- **Layer 0: Ground & Topography Matrix**: Paved cobblestone roads, sidewalks, flumes, rail tracks, unbuilt yard turf.
- **Layer 1: Structural Autotile Shell Matrix**: Monospace CP437 box-drawing characters distinguishing double-line exterior perimeter walls (`║`, `═`, `╔`, `╗`, etc.) from single-line interior room partitions (`│`, `─`, `┌`, `┐`, etc.), door jambs (`+`), and windows (`"`).
- **Layer 2: Interactive Fixtures & Portals Matrix**: Interactive furniture (boilers, workbenches, desks, hearths, bar counters) and vertical transition portals (stairs, manholes, lifts).
- **Layer 3: Cadastral Zoning & Room Matrix**: Parcel lot boundaries and interior zone semantics (`PUBLIC_BAR`, `WORKSHOP`, `VAULT`, `SCULLERY`, `RECEPTION`, `LIVING_QUARTERS`).
- **Layer 4: Circulation & Flow Matrix**: Road network lines, building frontages, outward door vectors, and BFS reachability distance gradients from central transit hubs.
- **Layer 5: Diagnostic Anomaly Heatmap**: Cell-level error flags highlighting building overlaps (`!`), blocked doorways (`?`), wall collisions (`#`), disconnected islands (`X`), and road encroachments (`~`).

### 2.3 Detailed Invariants for the 5 Key Error Classes
To enable robust automated testing, each error class is formalized into a deterministic invariant check:

1. **Building Overlaps (`BUILDING_OVERLAP`)**:
   - *Invariant*: For any two placed buildings $A$ and $B$, their bounding boxes must satisfy:
     $$\max(A.x_1, B.x_1) > \min(A.x_2, B.x_2) \lor \max(A.y_1, B.y_1) > \min(A.y_2, B.y_2)$$
   - *Cell Invariant*: No cell with `interiorZone !== 'NONE'` may be overwritten by the structural wall or interior floor of an unrelated building.
2. **Blocked Doorways (`BLOCKED_DOORWAY`)**:
   - *Exterior Invariant*: For every door at $(x, y)$ with outward normal $\vec{n} = (dx, dy)$:
     - Departure cell $(x + dx, y + dy)$ must be within grid bounds.
     - Departure cell must NOT be a solid wall (`SOOT_BRICK_WALL`, `TIMBER_STRUT`).
     - Departure cell must NOT be an impassable yard obstacle (`WROUGHT_IRON_FENCE`, `GASLAMP_POST`, `BRASS_STEAM_PIPE`, `RUBBLE_PILE`, `SLAG_MOUND`).
     - Departure cell must NOT contain a movement-blocking entity (`position.blocksMovement === true`).
   - *Interior Invariant*: Approach cell $(x - dx, y - dy)$ must NOT be blocked by solid walls or blocking furniture (`blocksMovement === true`).
3. **Wall Collisions & Boundary Breaches (`WALL_COLLISION`)**:
   - *Portal Buffer Invariant*: Every cross-stratum portal (manhole, lift, stairs) must maintain an unobstructed 8-neighbor clearance apron with at least 2 walkable adjacent tiles.
   - *Autotile Closure Invariant*: Every wall cell must resolve to a valid box-drawing glyph via `resolveExtendedConnectingWallGlyph` (zero fallback disconnected `#` glyphs).
4. **Disconnected Pathways & Island Nodes (`DISCONNECTED_PATHWAY`)**:
   - *Reachability Invariant*: For every building outward door point, every cross-stratum portal, and every compass gate, there must exist a walkable path ($100\%$ BFS reachability) to the district central plaza / transit hub.
   - *Zero Island Invariant*: The walkable sub-graph must consist of exactly 1 connected component (no isolated, unreachable floor pockets $\ge 4$ tiles).
5. **Building-Road Collisions (`BUILDING_ROAD_COLLISION`)**:
   - *Arterial Road Invariant*: No building bounding box or solid wall may encroach into the designated arterial avenue ($y \in [\text{avenueY.min}, \text{avenueY.max}]$), central plaza ($7\times 7$), or cross-streets ($x \in [\text{sx}, \text{sx}+1]$).

### 2.4 Deterministic Self-Correction Algorithms
When an anomaly is detected, the procedural pipeline must execute deterministic self-correction passes before final output:

1. **Exterior Clearance Pass (`clearDoorwayObstacles`)**:
   - If a doorway's departure tile $(x + dx, y + dy)$ contains a yard feature (`WROUGHT_IRON_FENCE`, `GASLAMP_POST`, `BRASS_STEAM_PIPE`, `RUBBLE_PILE`):
   - Demote the cell to `COBBLESTONE_FLOOR` (`blocksMovement: false, blocksSight: false`).
   - If an entity is present, shift it laterally or prune it.
   - Record log entry: `CLEAR_DOORWAY_OBSTACLE`.
2. **Door Flipping & Perimeter Relocation (`flipOrRelocateDoorway`)**:
   - If a doorway faces an impassable exterior facade (e.g. neighboring building wall or district boundary):
   - Scan the building's exterior perimeter for an unobstructed wall segment adjacent to an open street or alley.
   - Re-carve the blocked door back to `SOOT_BRICK_WALL`.
   - Install a new `WOODEN_DOOR_CLOSED` on the valid candidate perimeter coordinate.
   - Update `doors` and `outwardPoints` registries.
   - Record log entry: `RELOCATE_BLOCKED_DOORWAY`.
3. **Architectural A\* Pathway Stitching (`stitchDisconnectedPathways`)**:
   - *Critique of Naive `punchPath`*: Naive L-shaped line punching in `district-yards.ts` converts any non-vault tile to floor, which can slice straight through a tavern bar or hospital ward to connect a random path.
   - *Solution*: A weighted A\* pathfinder from the disconnected outward point to the nearest road cell:
     - Existing street/alley floor: weight $1.0$
     - Unbuilt yard turf / rubble: weight $2.0$
     - Yard fences / steam pipes: weight $5.0$ (cleared to cobblestone upon routing)
     - Exterior building walls: weight $60.0$ (heavily penalized; only pierced if no outdoor route exists, carved as an arched passage)
     - Interior building rooms (`interiorZone !== 'NONE'`): weight $300.0$ (prohibited; never route street traffic through private rooms)
     - Portals / Vaults: weight $\infty$ (impassable)
   - Carves a paved 1-tile sidewalk along the optimal outdoor trajectory.
   - Record log entry: `STITCH_PATHWAY_SIDEWALK`.
4. **Road Corridor Restoration (`restoreRoadCorridors`)**:
   - Re-stamps `COBBLESTONE_FLOOR` across all primary arterial avenues and cross-streets, clearing any stray wall stamps.
   - Record log entry: `RESTORE_ARTERIAL_ROAD`.
5. **Setback Nudge & Lot Adjustment (`resolveBuildingSetbacks`)**:
   - If a building overlaps an adjacent lot or road boundary by $\le 2$ tiles, translates the building origin away from the conflict.
   - If non-resolvable, substitutes a smaller archetype template from `BUILDING_TEMPLATE_REGISTRY` or converts the lot to a public courtyard.
   - Record log entry: `NUDGE_BUILDING_SETBACK`.

### 2.5 Modularity & 300-Line Ceiling Compliance
- **Observation 1.4**: `template-instantiator.ts` (236 lines), `building-templates.ts` (235 lines), `district-yards.ts` (221 lines), and `urban-district.ts` (204 lines) are near the 250-line target.
- **Rule Enforced**: No new functions may be added to these near-cap files.
- **Decomposition**: Requirement R2 must be implemented across four new, discrete, single-responsibility modules in `src/sim/spatial/`:
  1. `src/sim/spatial/spatial-survey-types.ts` (~110 lines)
  2. `src/sim/spatial/spatial-anomaly-detector.ts` (~210 lines)
  3. `src/sim/spatial/spatial-self-corrector.ts` (~220 lines)
  4. `src/sim/spatial/spatial-survey-sheet.ts` (~210 lines)
  And one dedicated test suite:
  5. `tests/sim/spatial-survey-self-correction.test.ts` (~240 lines)

---

## 3. Caveats

1. **Scope Boundary**: This investigation focuses strictly on Requirement R2 (Visual Testing and Spatial Survey Sheet Self-Correction). Continuous world generation chunk dimensions and streaming (R1) and the verification pipeline / local model token audit (R3) are investigated by peer explorers.
2. **Headless Execution Constraint**: In accordance with Rule 2.1 (Strict Headless Separation), all spatial detection, self-correction, and matrix generation algorithms reside strictly in `src/sim/spatial/`. They use zero browser globals (`window`, `document`), zero PixiJS references, and zero non-deterministic functions (`Math.random()`, `Date.now()`).
3. **Template Sizing Assumptions**: Current building templates range from $8\times 8$ to $12\times 10$ cells. If continuous world evolution in R1 expands district dimensions (e.g. from 48x36 to 64x48), the parcel partition logic in `subdivideUrbanParcels` will yield larger lot dimensions, increasing clearance margins and reducing overlap probability.

---

## 4. Conclusion & Proposed Architecture

### 4.1 Feature Inventory for Requirement R2

| # | Feature Name | Description | Target Module | Line Est. |
|---|---|---|---|:---:|
| 1 | Spatial Survey Schemas & Types | Zod schemas and TypeScript interfaces for `SpatialSurveySheet`, `SpatialAnomaly`, `PlacedBuildingRecord`, and `SpatialCorrectionLog` | `src/sim/spatial/spatial-survey-types.ts` | ~110 |
| 2 | Programmatic Anomaly Detector | Pure deterministic detection algorithms for building overlaps, blocked doorways, wall collisions, disconnected pathways, and road collisions | `src/sim/spatial/spatial-anomaly-detector.ts` | ~210 |
| 3 | Spatial Self-Corrector | Deterministic self-correction pipeline: clearance passes, door flipping/relocation, weighted A* pathway stitching, and road corridor restoration | `src/sim/spatial/spatial-self-corrector.ts` | ~220 |
| 4 | Multi-Layer Survey Sheet Exporter | Generator producing 6-layer visual matrices (Terrain, Architecture, Fixtures, Zoning, Circulation, Diagnostic Heatmap) and Markdown snapshot dossiers | `src/sim/spatial/spatial-survey-sheet.ts` | ~210 |
| 5 | Automated Visual/Spatial Regression Suite | Vitest test suite testing synthetic anomaly injections, self-correction efficacy, and multi-seed zero-anomaly validation across 25+ seeds | `tests/sim/spatial-survey-self-correction.test.ts` | ~240 |

### 4.2 Detailed Module Interfaces & Code Designs

#### Module 1: `src/sim/spatial/spatial-survey-types.ts`
```typescript
import { z } from 'zod';
import { Point2DSchema, StratumIdSchema } from '../../schemas/primitives.schema.js';

export const SpatialAnomalyTypeSchema = z.enum([
  'BUILDING_OVERLAP',
  'BLOCKED_DOORWAY',
  'WALL_COLLISION',
  'DISCONNECTED_PATHWAY',
  'BUILDING_ROAD_COLLISION',
]);
export type SpatialAnomalyType = z.infer<typeof SpatialAnomalyTypeSchema>;

export const AnomalySeveritySchema = z.enum(['FATAL', 'ERROR', 'WARNING']);
export type AnomalySeverity = z.infer<typeof AnomalySeveritySchema>;

export const SpatialAnomalySchema = z.object({
  id: z.string().min(1),
  type: SpatialAnomalyTypeSchema,
  severity: AnomalySeveritySchema,
  position: Point2DSchema,
  targetId: z.string().optional(),
  description: z.string().min(1),
});
export type SpatialAnomaly = z.infer<typeof SpatialAnomalySchema>;

export const SpatialCorrectionLogSchema = z.object({
  action: z.enum(['CLEAR_DOORWAY', 'FLIP_DOORWAY', 'STITCH_PATHWAY', 'RESTORE_ROAD', 'NUDGE_BUILDING', 'SEAL_POCKET']),
  position: Point2DSchema,
  targetId: z.string().optional(),
  details: z.string().min(1),
});
export type SpatialCorrectionLog = z.infer<typeof SpatialCorrectionLogSchema>;

export const PlacedBuildingSurveySchema = z.object({
  id: z.string().min(1),
  templateId: z.string().min(1),
  archetypeId: z.string().min(1),
  bounds: z.object({ x1: z.number().int(), y1: z.number().int(), x2: z.number().int(), y2: z.number().int() }),
  entrancePoints: z.array(Point2DSchema),
  outwardPoints: z.array(Point2DSchema),
  doors: z.record(z.string(), Point2DSchema),
});
export type PlacedBuildingSurvey = z.infer<typeof PlacedBuildingSurveySchema>;
```

#### Module 2: `src/sim/spatial/spatial-anomaly-detector.ts`
Contains pure, read-only inspection functions:
- `detectBuildingOverlaps(buildings: readonly PlacedBuildingSurvey[]): SpatialAnomaly[]`
- `detectBlockedDoorways(grid: StratumGrid, entities: Record<string, EntityRecord>, buildings: readonly PlacedBuildingSurvey[]): SpatialAnomaly[]`
- `detectWallCollisions(grid: StratumGrid, portals: readonly Point2D[], streetCorridors: readonly Box[]): SpatialAnomaly[]`
- `detectDisconnectedPathways(grid: StratumGrid, hub: Point2D, targets: readonly Point2D[]): SpatialAnomaly[]`
- `detectBuildingRoadCollisions(buildings: readonly PlacedBuildingSurvey[], streetCorridors: readonly Box[]): SpatialAnomaly[]`
- `runSpatialAnomalyAudit(grid: StratumGrid, entities: Record<string, EntityRecord>, buildings: readonly PlacedBuildingSurvey[], hub: Point2D, targets: readonly Point2D[], streetCorridors: readonly Box[]): SpatialAnomaly[]`

#### Module 3: `src/sim/spatial/spatial-self-corrector.ts`
Executes multi-pass self-correction on `StratumGrid` and `entities`:
- `clearDoorwayObstacles(grid: StratumGrid, entities: Record<string, EntityRecord>, anomalies: readonly SpatialAnomaly[]): { grid: StratumGrid; entities: Record<string, EntityRecord>; logs: SpatialCorrectionLog[] }`
- `flipOrRelocateDoorway(grid: StratumGrid, building: PlacedBuildingSurvey, anomaly: SpatialAnomaly): { grid: StratumGrid; building: PlacedBuildingSurvey; log?: SpatialCorrectionLog }`
- `stitchDisconnectedPathways(grid: StratumGrid, hub: Point2D, disconnectedTargets: readonly Point2D[]): { grid: StratumGrid; logs: SpatialCorrectionLog[] }`
- `restoreRoadCorridors(grid: StratumGrid, streetCorridors: readonly Box[]): { grid: StratumGrid; logs: SpatialCorrectionLog[] }`
- `applySpatialSelfCorrection(...)`: runs detection, applies corrections in priority order (Clearance $\to$ Road Restore $\to$ Door Relocation $\to$ A\* Pathway Stitching), and repeats until 0 anomalies remain or max passes (3) reached.

#### Module 4: `src/sim/spatial/spatial-survey-sheet.ts`
Produces the multi-layer visual survey sheet and Markdown dossier:
- `generateSpatialSurveySheet(districtId, stratum, seed, grid, entities, buildings, streetCorridors, anomalies, logs): SpatialSurveySheet`
- `renderLayerMatrices(grid, entities, buildings, anomalies): { terrain: string[]; architecture: string[]; fixtures: string[]; zoning: string[]; circulation: string[]; anomalyHeatmap: string[] }`
- `formatSurveySheetMarkdown(sheet: SpatialSurveySheet): string`

---

## 5. Verification Method

### 5.1 Independent Verification Commands
Once implemented, the reviewer or orchestrator can independently verify Requirement R2 using:

```bash
# 1. Typecheck: Verify strict TypeScript compilation with zero errors
npm run typecheck

# 2. Boundary & Line-Ceiling Check: Confirm zero core/shell leaks and <= 250 lines per module
npm run check:boundaries

# 3. Data Validation: Validate all blueprint data schemas
npm run validate:data

# 4. Deterministic Simulation Test Suite: Run targeted survey & self-correction tests
npx vitest run tests/sim/spatial-survey-self-correction.test.ts

# 5. Full Repository Verification Gate
npm run verify
```

### 5.2 Test Cases to Validate in `tests/sim/spatial-survey-self-correction.test.ts`
1. **Synthetic Anomaly Injection & Detection Tests**:
   - Manually inject a `WROUGHT_IRON_FENCE` directly in front of a tavern door $\to$ verify `detectBlockedDoorways` flags `BLOCKED_DOORWAY`.
   - Manually position two building bounding boxes overlapping $\to$ verify `detectBuildingOverlaps` flags `BUILDING_OVERLAP`.
   - Manually stamp a wall segment across the central arterial avenue $\to$ verify `detectBuildingRoadCollisions` flags `BUILDING_ROAD_COLLISION`.
   - Manually create an unreachable door island surrounded by walls $\to$ verify `detectDisconnectedPathways` flags `DISCONNECTED_PATHWAY`.
2. **Self-Correction Efficacy Tests**:
   - Run `applySpatialSelfCorrection` on the injected anomalies $\to$ verify all 4 anomalies are resolved, logs are populated, and 0 anomalies remain.
   - Verify that A\* pathway stitching routes sidewalks around private building rooms rather than slicing through them.
3. **Multi-Seed Regression Gate across 25+ Seeds (2000..2025)**:
   - Generate urban districts across 25 random seeds.
   - Run full spatial anomaly audit on every generated district.
   - Assert $100\%$ zero anomalies across all 25 seeds after self-correction pass.
4. **Survey Sheet Serialization & Layer Parity**:
   - Verify that all 6 layer matrices (`terrain`, `architecture`, `fixtures`, `zoning`, `circulation`, `anomalyHeatmap`) match the grid dimensions ($48\times 36$).
   - Verify Markdown export formats cleanly into structured test artifacts.

### 5.3 Invalidation Conditions
The proposed architecture is invalidated if:
- Any proposed module exceeds the **250-line target** or **300-line hard ceiling**.
- Any simulation module imports from `src/client/`, violating Rule 2.1.
- Self-correction alters `WorldState` non-deterministically across identical seeds.
- Pathway stitching punches through private building interior rooms (`interiorZone !== 'NONE'`).
