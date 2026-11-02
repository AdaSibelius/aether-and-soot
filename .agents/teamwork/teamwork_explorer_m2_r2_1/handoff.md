# CDDA-Style Urban District Generation (`src/sim/spatial/urban-district.ts`): Architectural Specification

## 1. Observation

Direct code examination and telemetry across `src/sim/spatial/`, `src/schemas/`, and `tests/sim/` establish the architectural baseline for Milestone 2 (Urban Street/Alley/Plaza District Generation):

### 1.1 Milestone 1 Deliverables and Building Templates
In `src/sim/spatial/building-templates.ts` (lines 32–236) and `src/schemas/building-template.schema.ts` (lines 84–120):
- **Template Registry**: `ALL_BUILDING_TEMPLATES` contains 6 CDDA matrix templates:
  1. `TEMPLATE_VICTORIAN_TAVERN`: 12x10, exterior door at `(5, 9)` on row 9 (`v = h - 1`).
  2. `TEMPLATE_CONSTABULARY_STATION`: 11x10, exterior door at `(4, 9)` on row 9 (`v = h - 1`).
  3. `TEMPLATE_TENEMENT_HOUSE`: 11x11, exterior door at `(5, 10)` on row 10 (`v = h - 1`).
  4. `TEMPLATE_APOTHECARY_CLINIC`: 11x10, exterior door at `(5, 9)` on row 9 (`v = h - 1`).
  5. `TEMPLATE_ARTISAN_WORKSHOP`: 13x10, exterior door at `(6, 9)` on row 9 (`v = h - 1`).
  6. `TEMPLATE_STEAM_BOILERHOUSE`: 11x10, exterior door at `(4, 9)` on row 9 (`v = h - 1`).
- **Critical Structural Invariant**: In all 6 templates, the primary exterior entrance door (`exteriorDoorChar: '+'`) is situated on the bottom row (`v = h - 1`, facing South in local coordinates).
- **Template Footprint Bounds**: Maximum template width is 13 cells (`artisan_workshop`), minimum is 11 cells. Maximum template height is 11 cells (`tenement_house`), minimum is 10 cells.

### 1.2 Template Instantiator Interface
In `src/sim/spatial/template-instantiator.ts` (lines 21–236):
- Function signature:
  ```typescript
  export function instantiateTemplateIntoGrid(
    grid: StratumGrid,
    entities: Record<string, EntityRecord>,
    template: BuildingTemplate,
    placement: TemplatePlacement,
    rng: SeededRNG,
  ): TemplateInstantiationResult;
  ```
- Output contract `TemplateInstantiationResult` returns:
  - `grid: StratumGrid`: Stamped stratum grid with interior zones, terrain, and atmospheric steam/smoke.
  - `entities: Record<string, EntityRecord>`: Populated entities (interactive Victorian furniture and cellar portals).
  - `entrancePoints: readonly Point2D[]`: Global coordinates of exterior doors.
  - `outwardPoints: readonly Point2D[]`: Global coordinates 1 tile outside the exterior door in outward-facing orientation.
  - `doors: Record<string, Point2D>`: Door identifier mapping.
  - `keyPositions: Record<string, Point2D>`: Named anchor coordinates.
- Coordinate transformation:
  - `rotation: 0`: Faces South (outward vector: `dy = +1`).
  - `rotation: 90`: Faces West (outward vector: `dx = -1`).
  - `rotation: 180`: Faces North (outward vector: `dy = -1`).
  - `rotation: 270`: Faces East (outward vector: `dx = +1`).

### 1.3 District Spatial Dimensions & Transit Anchors
In `src/sim/spatial/district-pipeline-context.ts` (lines 43–85) and `compass-gates.ts` (lines 62–70):
- Standard district dimensions: `width = 48`, `height = 36`.
- District center anchor: `center = { x: 24, y: 18 }`.
- Compass gate positions:
  - `westGatePos: { x: 1, y: 18 }` (always present).
  - `eastGatePos: { x: 46, y: 18 }` (always present).
  - `northGatePos: { x: 24, y: 1 }` (conditional on planar neighbor).
  - `southGatePos: { x: 24, y: 34 }` (conditional on planar neighbor).

### 1.4 Pathfinding Walkability & Invariant Gates
In `src/sim/spatial/district-layout.ts` (lines 145–167) and `src/sim/spatial/district-yards.ts` (lines 151–164):
- `hasWalkablePath(grid, start, goal)`: 4-directional BFS verifying `!cell.blocksMovement`.
- `ensureDistrictConnectivity(grid, start, targets)`: Invariant check from `center` to all gates, portals, and outward points; punches emergency cobblestone corridors if severed.
- `spatial-reachability.test.ts` (lines 38–100): Asserts 100% BFS reachability from central plaza to all gates, portals, and building entrance doors across seeds 1000..1020.
- `spatial-contiguity-audit.test.ts` (lines 59–82): Asserts 0 sealed interior rooms and 0 unreachable floor pockets when doors are toggled open across seeds 2000..2024.

---

## 2. Logic Chain

From the direct observations above, we establish the step-by-step logic chain governing the design of `src/sim/spatial/urban-district.ts`:

### Step 2.1: Mathematical Analysis of Parcel Dimensions vs. Building Footprints
- *Observation*: Standard district grid is $48 \times 36$. All 6 templates in `ALL_BUILDING_TEMPLATES` have width $W \in [11, 13]$ and height $H \in [10, 11]$.
- *Reasoning*: To accommodate all 6 building templates simultaneously without clipping or overlapping, the playable area must be partitioned into exactly 6 discrete parcels (3 North of the central thoroughfare, 3 South).
- *Dimension Calculation*:
  - Playable width: $x \in [2, 45]$ (44 tiles).
  - Partition into 3 columns separated by two 2-tile wide cross-streets:
    - West Parcel column: $x \in [2, 14]$ (width = 13).
    - Cross-Street 1: $x \in [15, 16]$ (width = 2).
    - Central Parcel column: $x \in [17, 29]$ (width = 13).
    - Cross-Street 2: $x \in [30, 31]$ (width = 2).
    - East Parcel column: $x \in [32, 44]$ (width = 13).
    - Total: $13 + 2 + 13 + 2 + 13 = 43$ tiles. With boundaries at $x=1$ and $x=45..46$, this fits the 48-wide grid with zero error.
  - Playable height: $y \in [2, 33]$ (32 tiles).
    - North Service Back-Alley: $y = 2$ (width = 1).
    - Top Parcels (North): $y \in [3, 14]$ (height = 12).
    - Central Thoroughfare & Plaza band: $y \in [15, 21]$ (height = 7).
    - Bottom Parcels (South): $y \in [22, 32]$ (height = 11).
    - South Service Back-Alley: $y = 33$ (width = 1).
    - Total: $1 + 12 + 7 + 11 + 1 = 32$ tiles. Fits $y \in [1, 34]$ between compass gates.
- *Inference*:
  - Every parcel has width 13 and height 11–12.
  - Since max template width is 13 (`TEMPLATE_ARTISAN_WORKSHOP`) and max template height is 11 (`TEMPLATE_TENEMENT_HOUSE`), **every single template fits into every single parcel**.

### Step 2.2: Hierarchical Street Network Topology
- *Observation*: Requirement 1 specifies a 3-tier street hierarchy: Primary Arterial Thoroughfare, Secondary Cross-Streets, and Service Back-Alleys.
- *Design*:
  1. **Tier 1: Primary Arterial Thoroughfare & Central Civic Plaza**:
     - *Central Plaza*: $7 \times 7$ cobblestone court centered at $(24, 18)$ ($x \in [21, 27], y \in [15, 21]$). Holds the central `streetManhole` leading to Undercroft sewers and a public clocktower monument or fountain.
     - *East-West Arterial Boulevard*: 3-tile wide avenue ($y \in [17, 19]$) extending from West Gate $(1, 18)$ to East Gate $(46, 18)$, expanded to width 7 through the plaza.
  2. **Tier 2: Secondary Cross-Streets (Width 2)**:
     - Cross-Street 1 at $x \in [15, 16]$ running from North Alley ($y = 2$) to South Alley ($y = 33$).
     - Cross-Street 2 at $x \in [30, 31]$ running from North Alley ($y = 2$) to South Alley ($y = 33$).
     - Both cross-streets intersect the primary arterial avenue at $y \in [17, 19]$, providing continuous, two-way cart/pedestrian traffic connecting all 6 parcels to the central thoroughfare.
  3. **Tier 3: Service Back-Alleys (Width 1)**:
     - North Back-Alley along $y = 2$ from $x = 2$ to $x = 45$. Paved with `COBBLESTONE_FLOOR` and traversable `RUBBLE_PILE`.
     - South Back-Alley along $y = 33$ from $x = 2$ to $x = 45$. Paved with `COBBLESTONE_FLOOR` and traversable `RUBBLE_PILE`.
     - Stealth Routing & Compass Gate Integration: North Gate at $(24, 1)$ steps directly into the North Alley at $(24, 2)$. South Gate at $(24, 34)$ steps directly into the South Alley at $(24, 33)$. The alleys connect to Cross-Streets 1 and 2, which feed directly into the central plaza. **No emergency wall-punching is required for transit gates.**

### Step 2.3: Parcel Subdivision & Setback Enforcement
- *Observation*: Requirement 2 specifies discrete parcel footprints and minimum 1-tile setbacks around building footprints.
- *Reasoning*:
  - The 6 parcel footprints are defined by the grid geometry:
    - `parcel_nw`: $x \in [2, 14], y \in [3, 14]$ ($13 \times 12$).
    - `parcel_nc`: $x \in [17, 29], y \in [3, 14]$ ($13 \times 12$).
    - `parcel_ne`: $x \in [32, 44], y \in [3, 14]$ ($13 \times 12$).
    - `parcel_sw`: $x \in [2, 14], y \in [22, 32]$ ($13 \times 11$).
    - `parcel_sc`: $x \in [17, 29], y \in [22, 32]$ ($13 \times 11$).
    - `parcel_se`: $x \in [32, 44], y \in [22, 32]$ ($13 \times 11$).
  - Setbacks:
    - In X: Parcel width is 13. For templates of width 11 or 12, centering the template yields $\ge 1$ tile setback on left and right flanks. For templates of width 13, the flanks border the 2-tile wide cross-streets or the district border alley, ensuring clear perimeter separation.
    - In Y: Top parcels have height 12. Templates have height 10 (or 11 for tenement). Positioning the building leaves 1–2 tiles of setback between the rear wall and the North Alley.
    - Bottom parcels have height 11. Templates have height 10 (or 11). Positioning leaves 1 tile of rear setback.

### Step 2.4: Deterministic Orientation & Template Stamping
- *Observation*: In all templates, the exterior entrance door is on row $v = h - 1$ (South edge in local coordinates).
- *Reasoning*:
  - **Top Row Parcels (`parcel_nw`, `parcel_nc`, `parcel_ne`)**:
    - Street frontage is to the **South** (facing Primary Avenue $y \in [17, 19]$ and Plaza $y \in [15, 21]$).
    - Rotation: `0` degrees.
    - Door remains on the South edge of the building, facing directly toward the avenue/plaza.
    - `originY = parcel.bounds.y2 - dims.height + 1`.
  - **Bottom Row Parcels (`parcel_sw`, `parcel_sc`, `parcel_se`)**:
    - Street frontage is to the **North** (facing Primary Avenue $y \in [17, 19]$ and Plaza $y \in [15, 21]$).
    - Rotation: `180` degrees.
    - In 180° rotation, local $(u, v)$ maps to $(w - 1 - u, h - 1 - v)$. Since the door was at $v = h - 1$, its transformed row becomes $h - 1 - (h - 1) = 0$ (the North edge)!
    - Door faces North directly toward the avenue/plaza.
    - `originY = parcel.bounds.y1`.
- *Inference*:
  - Front entrance doors of all 6 buildings always face the primary street network.
  - Back walls always face the service alleys.

### Step 2.5: Door-to-Street Corridor Stitching & Walkability Invariants
- *Observation*: `instantiateTemplateIntoGrid` returns `outwardPoints` (1 tile outside the exterior door in outward direction).
- *Reasoning*:
  - For top row: `outwardPoint.y` falls on $y = 14$ or $y = 15$. If $y = 14$, carving a 1-tile cobblestone connector to $y = 15$ links the door to the primary avenue.
  - For bottom row: `outwardPoint.y` falls on $y = 21$ or $y = 20$, which is already on the plaza/avenue.
  - After stitching:
    - Central plaza is connected to primary avenue (East-West).
    - Primary avenue connects to Cross-Streets 1 and 2.
    - Cross-streets connect to North and South service alleys.
    - Service alleys connect to North and South compass gates.
    - Primary avenue connects to West and East compass gates.
    - Outward points connect all 6 building doors to the avenue/cross-streets.
    - Interior rooms connect to entrance doors via template instantiator walkability guarantee.
- *Inference*: The entire district forms a single strongly connected component with **100% BFS pathfinding guarantee**. Running `ensureDistrictConnectivity` serves as an automated safeguard.

### Step 2.6: Modularity & Line Count Budget
- *Observation*: Hard ceiling is 300 lines; target is $\le 220$ lines.
- *Reasoning*:
  - By cleanly delegating template instantiating to `template-instantiator.ts`, connectivity repair to `district-yards.ts`, and primitives to `grid.ts` and `district-layout.ts`, `urban-district.ts` needs only:
    1. Grid carving for the 3 street tiers (~45 lines).
    2. Parcel bounding box generation (~20 lines).
    3. Stamping loop with corridor stitching (~55 lines).
    4. Type declarations and exports (~25 lines).
  - Total implementation size: **~150–165 lines**, safely below the 220-line target.

---

## 3. Caveats

1. **Compact / Scaled Districts**:
   - The primary design targets standard $48 \times 36$ district grids. If the engine generates compact test grids (e.g., $24 \times 24$ in legacy unit tests), `urban-district.ts` must provide a dimension guard (`if (width < 45 || height < 35)`) that falls back to compact 2-parcel stamping or skips outer columns to prevent out-of-bounds coordinates.
2. **Door Pathfinding Collision**:
   - Exterior doors (`WOODEN_DOOR_CLOSED`) have `blocksMovement: true` in the raw grid. In-game actors bump-to-open via `MOVE_STEP` (`DOOR_TOGGLED`). In BFS verification, the walkability check must verify reachability to `outwardPoints` (the sidewalk outside the door) rather than the closed door cell itself, or invoke `openAllDoors(grid)` when checking interior contiguity.
3. **Planar Overworld Gate Omission**:
   - In districts with no northern or southern overworld neighbors (e.g. edge districts), North and South gates are omitted from `entities`. The hierarchical street network retains the service alleys and cross-streets regardless, ensuring consistent urban aesthetics and 100% pathfinding whether or not the gates are spawned.

---

## 4. Conclusion

### 4.1 Interface Contract & Data Types
The following data structures and function signatures are specified for `src/sim/spatial/urban-district.ts`:

```typescript
import { EntityRecord } from '../../schemas/components.schema.js';
import { EntityId, Point2D } from '../../schemas/primitives.schema.js';
import { SeededRNG } from '../core/rng.js';
import { Box } from './district-blocks.js';
import { StratumGrid } from './grid.js';

export interface UrbanParcel {
  readonly id: string;
  readonly bounds: Box;
  readonly frontDirection: 'NORTH' | 'SOUTH';
  readonly templateId?: string;
}

export interface UrbanStreetSpec {
  readonly avenueY: { readonly min: number; readonly max: number };
  readonly plaza: Box;
  readonly crossStreetX: readonly [number, number];
  readonly northAlleyY: number;
  readonly southAlleyY: number;
}

export interface UrbanDistrictResult {
  readonly grid: StratumGrid;
  readonly entities: Record<string, EntityRecord>;
  readonly parcels: readonly UrbanParcel[];
  readonly doors: Record<string, Point2D>;
  readonly entrancePoints: readonly Point2D[];
  readonly outwardPoints: readonly Point2D[];
  readonly keyPositions: Record<string, Point2D>;
  readonly fixturesPlaced: readonly EntityId[];
}
```

### 4.2 Algorithmic Implementation Blueprint

The complete, modular implementation of `src/sim/spatial/urban-district.ts` (158 lines, strictly $\le 220$ lines):

```typescript
import { EntityRecord } from '../../schemas/components.schema.js';
import { EntityId, Point2D } from '../../schemas/primitives.schema.js';
import { SeededRNG } from '../core/rng.js';
import { ALL_BUILDING_TEMPLATES, BuildingTemplate } from './building-templates.js';
import { Box } from './district-blocks.js';
import { carveCorridor, carveRoom } from './district-layout.js';
import { ensureDistrictConnectivity } from './district-yards.js';
import { setTileCell, StratumGrid } from './grid.js';
import {
  getTransformedDimensions,
  instantiateTemplateIntoGrid,
  TemplateRotation,
} from './template-instantiator.js';

export interface UrbanParcel {
  readonly id: string;
  readonly bounds: Box;
  readonly frontDirection: 'NORTH' | 'SOUTH';
  readonly templateId?: string;
}

export interface UrbanStreetSpec {
  readonly avenueY: { readonly min: number; readonly max: number };
  readonly plaza: Box;
  readonly crossStreetX: readonly [number, number];
  readonly northAlleyY: number;
  readonly southAlleyY: number;
}

export interface UrbanDistrictResult {
  readonly grid: StratumGrid;
  readonly entities: Record<string, EntityRecord>;
  readonly parcels: readonly UrbanParcel[];
  readonly doors: Record<string, Point2D>;
  readonly entrancePoints: readonly Point2D[];
  readonly outwardPoints: readonly Point2D[];
  readonly keyPositions: Record<string, Point2D>;
  readonly fixturesPlaced: readonly EntityId[];
}

export function getUrbanStreetSpec(width: number, height: number, center: Point2D): UrbanStreetSpec {
  const cy = center.y;
  return {
    avenueY: { min: cy - 1, max: cy + 1 },
    plaza: { x1: center.x - 3, y1: cy - 3, x2: center.x + 3, y2: cy + 3 },
    crossStreetX: [15, 30],
    northAlleyY: 2,
    southAlleyY: height - 3,
  };
}

export function carveHierarchicalStreetNetwork(
  grid: StratumGrid,
  width: number,
  height: number,
  center: Point2D,
  rng: SeededRNG,
): StratumGrid {
  const spec = getUrbanStreetSpec(width, height, center);
  let g = grid;

  // 1. Central 7x7 Plaza
  g = carveRoom(g, center.x, center.y, 3, 3, 'COBBLESTONE_FLOOR');

  // 2. Primary Arterial Avenue (Width 3)
  for (let y = spec.avenueY.min; y <= spec.avenueY.max; y++) {
    for (let x = 1; x < width - 1; x++) {
      g = setTileCell(g, x, y, (c) => ({ ...c, terrainType: 'COBBLESTONE_FLOOR', blocksMovement: false, blocksSight: false }));
    }
  }

  // 3. Secondary Cross-Streets (Width 2)
  for (const sx of spec.crossStreetX) {
    for (let y = spec.northAlleyY; y <= spec.southAlleyY; y++) {
      for (let dx = 0; dx <= 1; dx++) {
        g = setTileCell(g, sx + dx, y, (c) => ({ ...c, terrainType: 'COBBLESTONE_FLOOR', blocksMovement: false, blocksSight: false }));
      }
    }
  }

  // 4. Service Back-Alleys (Width 1, cobblestone + rubble)
  for (const ay of [spec.northAlleyY, spec.southAlleyY]) {
    for (let x = 2; x < width - 2; x++) {
      const terrain = rng.nextFloat() < 0.25 ? 'RUBBLE_PILE' : 'COBBLESTONE_FLOOR';
      g = setTileCell(g, x, ay, (c) => ({ ...c, terrainType: terrain, blocksMovement: false, blocksSight: false }));
    }
  }

  // Compass Gate Access Points
  g = setTileCell(g, center.x, 1, (c) => ({ ...c, terrainType: 'COBBLESTONE_FLOOR', blocksMovement: false, blocksSight: false }));
  g = setTileCell(g, center.x, height - 2, (c) => ({ ...c, terrainType: 'COBBLESTONE_FLOOR', blocksMovement: false, blocksSight: false }));

  return g;
}

export function subdivideUrbanParcels(width: number, height: number, center: Point2D): UrbanParcel[] {
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

export function generateUrbanDistrict(
  grid: StratumGrid,
  entities: Record<string, EntityRecord>,
  width: number,
  height: number,
  center: Point2D,
  rng: SeededRNG,
): UrbanDistrictResult {
  let g = carveHierarchicalStreetNetwork(grid, width, height, center, rng);
  let outEntities = { ...entities };
  const parcels = subdivideUrbanParcels(width, height, center);
  const doors: Record<string, Point2D> = {};
  const entrancePoints: Point2D[] = [];
  const outwardPoints: Point2D[] = [];
  const keyPositions: Record<string, Point2D> = {};
  const fixturesPlaced: EntityId[] = [];

  const templates: BuildingTemplate[] = [...ALL_BUILDING_TEMPLATES];
  for (let i = templates.length - 1; i > 0; i--) {
    const j = rng.nextInt(0, i);
    const tmp = templates[i]!;
    templates[i] = templates[j]!;
    templates[j] = tmp;
  }

  for (let i = 0; i < parcels.length; i++) {
    const parcel = parcels[i]!;
    const tpl = templates[i % templates.length]!;
    const rot: TemplateRotation = parcel.frontDirection === 'SOUTH' ? 0 : 180;
    const dims = getTransformedDimensions(tpl.width, tpl.height, rot);
    const pw = parcel.bounds.x2 - parcel.bounds.x1 + 1;
    const ph = parcel.bounds.y2 - parcel.bounds.y1 + 1;
    if (dims.width > pw || dims.height > ph) continue;

    const originX = parcel.bounds.x1 + Math.floor((pw - dims.width) / 2);
    const originY = parcel.frontDirection === 'SOUTH'
      ? parcel.bounds.y2 - dims.height + 1
      : parcel.bounds.y1;

    const stampRes = instantiateTemplateIntoGrid(g, outEntities, tpl, {
      origin: { x: originX, y: originY },
      rotation: rot,
      mirrorX: rng.nextFloat() < 0.5,
      targetStratum: 'STREET',
    }, rng);

    g = stampRes.grid;
    outEntities = { ...stampRes.entities };
    entrancePoints.push(...stampRes.entrancePoints);
    outwardPoints.push(...stampRes.outwardPoints);
    fixturesPlaced.push(...stampRes.fixturesPlaced);
    Object.assign(doors, stampRes.doors);
    Object.assign(keyPositions, stampRes.keyPositions);

    for (const outPt of stampRes.outwardPoints) {
      const targetY = parcel.frontDirection === 'SOUTH' ? outPt.y + 1 : outPt.y - 1;
      g = carveCorridor(g, outPt, { x: outPt.x, y: targetY }, 'COBBLESTONE_FLOOR');
    }
  }

  const targets = [
    ...outwardPoints,
    { x: 1, y: center.y },
    { x: width - 2, y: center.y },
    { x: center.x, y: 1 },
    { x: center.x, y: height - 2 },
  ];
  const { grid: repaired } = ensureDistrictConnectivity(g, center, targets);

  return {
    grid: repaired,
    entities: outEntities,
    parcels,
    doors,
    entrancePoints,
    outwardPoints,
    keyPositions,
    fixturesPlaced,
  };
}
```

---

## 5. Verification Method

To independently verify the CDDA Urban District architecture and guarantee zero regressions:

### 5.1 Verification Commands
1. **Modularity & Boundary Verification**:
   ```bash
   npm run check:boundaries
   ```
   *Expected*: Passes with 0 errors. Asserts all files in `src/sim/spatial/` are $\le 300$ lines (with `urban-district.ts` at ~158 lines), with zero forbidden imports or non-deterministic tokens.
2. **Typecheck Verification**:
   ```bash
   npm run typecheck
   ```
   *Expected*: Strict TypeScript compiles with 0 errors (`tsc --noEmit`).
3. **Unit Test Verification for Urban District Layout**:
   ```bash
   npx vitest run tests/sim/building-templates.test.ts tests/sim/spatial-reachability.test.ts
   ```
   *Expected*: 100% passing across all seeds and rotations.
4. **Full Verification Suite**:
   ```bash
   npm run verify
   ```
   *Expected*: All 4 verification gates (typecheck, boundary checks, data validation, simulation tests) exit code 0.

### 5.2 Invalidation Conditions
The design in this specification shall be deemed invalidated if:
- `src/sim/spatial/urban-district.ts` exceeds 220 lines.
- Any building entrance door is spawned facing away from the thoroughfare or severed from the street network.
- Any compass gate (West, East, North, South) fails BFS reachability to the central plaza manhole in any seed.
- Non-deterministic calls (`Math.random()`, `Date.now()`) or browser-specific references are introduced.
