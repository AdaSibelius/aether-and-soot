# Technical Investigation & Architectural Specification: Milestone 3 Features 11 & 12

**Author:** teamwork_explorer_m3_it1_1  
**Mission:** Battle-tested design and implementation specification for:
- **Feature 11:** Parametric Multi-Block Parcel Subdivider (`src/sim/spatial/urban-parcels.ts`, target <= 200 lines, hard ceiling 250 lines)
- **Feature 12:** Inter-District Edge Seam Alignment (`src/sim/spatial/district-boundaries.ts`, target <= 200 lines, hard ceiling 250 lines)

---

## 1. Observation

### 1.1 Existing Urban District & Block Partitioning
- **`src/sim/spatial/urban-district.ts` (lines 42–51, 100–111)**:
  - `getUrbanStreetSpec`: Hardcoded cross streets `crossStreetX: [15, 30]`, plaza `center.x ± 3, cy ± 3`, `northAlleyY: 2`, and `southAlleyY: Math.max(cy + 4, height - 3)`.
  - `subdivideUrbanParcels`: Strictly bails out if `width < 45 || height < 35` (line 101), returning `[]`.
  - Hardcodes exactly 6 parcels:
    ```typescript
    return [
      { id: 'parcel_nw', bounds: { x1: 2, y1: spec.northAlleyY + 1, x2: spec.crossStreetX[0] - 1, y2: spec.avenueY.min - 1 }, frontDirection: 'SOUTH' },
      { id: 'parcel_nc', bounds: { x1: spec.crossStreetX[0] + 2, y1: spec.northAlleyY + 1, x2: spec.crossStreetX[1] - 1, y2: spec.plaza.y1 - 1 }, frontDirection: 'SOUTH' },
      { id: 'parcel_ne', bounds: { x1: spec.crossStreetX[1] + 2, y1: spec.northAlleyY + 1, x2: width - 4, y2: spec.avenueY.min - 1 }, frontDirection: 'SOUTH' },
      { id: 'parcel_sw', bounds: { x1: 2, y1: spec.avenueY.max + 1, x2: spec.crossStreetX[0] - 1, y2: spec.southAlleyY - 1 }, frontDirection: 'NORTH' },
      { id: 'parcel_sc', bounds: { x1: spec.crossStreetX[0] + 2, y1: spec.plaza.y2 + 1, x2: spec.crossStreetX[1] - 1, y2: spec.southAlleyY - 1 }, frontDirection: 'NORTH' },
      { id: 'parcel_se', bounds: { x1: spec.crossStreetX[1] + 2, y1: spec.avenueY.max + 1, x2: width - 4, y2: spec.southAlleyY - 1 }, frontDirection: 'NORTH' },
    ];
    ```
  - `UrbanParcel` type is defined locally in `src/sim/spatial/urban-district.ts` (lines 16–21) as:
    ```typescript
    export interface UrbanParcel {
      readonly id: string;
      readonly bounds: Box;
      readonly frontDirection: 'NORTH' | 'SOUTH';
      readonly templateId?: string;
    }
    ```
  - Template instantiator in `urban-district.ts` (lines 155–163) fits templates into parcels and skips any template if `dims.width > pw || dims.height > ph`.

### 1.2 District Boundaries & Perimeter Wall Bottlenecks
- **`src/sim/spatial/district-layout.ts` (lines 10–22, 36)**:
  - `buildSolidStratumGrid` initializes the entire grid with `SOOT_BRICK_WALL` (outer perimeter `x=0`, `x=width-1`, `y=0`, `y=height-1` are solid walls).
  - `carveRoom` explicitly enforces: `if (x <= 0 || y <= 0 || x >= grid.width - 1 || y >= grid.height - 1) continue;`, preserving the outer border wall.
- **`src/sim/spatial/compass-gates.ts` (lines 21–70)**:
  - Transit gates are fixed 1 tile inside the boundary walls:
    - West gate: `{ x: 1, y: centerY }`
    - East gate: `{ x: width - 2, y: centerY }`
    - North gate: `{ x: centerX, y: 1 }`
    - South gate: `{ x: centerX, y: height - 2 }`
  - Traversing between districts currently requires stepping onto a `DISTRICT_GATE` tile and triggering a discrete telepathic/modal warp.
  - Border walls elsewhere are solid `SOOT_BRICK_WALL`, preventing continuous visual rendering and continuous walking.

### 1.3 Overworld Planar Neighbors & Natural Barriers
- **`src/sim/spatial/overworld-matrix.ts` (lines 10–95)**:
  - Macro-coordinates define a coherent 2D planar topography:
    - `district_fleet_ditch_undercroft`: `(col: 0, row: 1)`
    - `district_whitechapel_ward`: `(col: 1, row: 1)`
    - `district_spitalfields_soot_works`: `(col: 2, row: 1)`
    - `district_limehouse_docks`: `(col: 3, row: 1)`
    - `district_belgravia_brass_spires`: `(col: 2, row: 0)`
  - Natural barriers define transitional edge typologies:
    - `barrier_thames_estuary` between `district_limehouse_docks` and `district_spitalfields_soot_works`: `THAMES_CANAL`
    - `barrier_spitalfields_viaduct` between `district_spitalfields_soot_works` and `district_belgravia_brass_spires`: `VIADUCT`
    - `barrier_toll_perimeter_wall` between `district_whitechapel_ward` and `district_belgravia_brass_spires`: `TOLL_PERIMETER_WALL`
    - `barrier_multipoint_sewers` between `district_fleet_ditch_undercroft` and `district_whitechapel_ward`: `SEWER_DROP`
    - Direct street borders exist between `Whitechapel` and `Spitalfields`, and `Whitechapel` and `Fleet Ditch`.

### 1.4 M2 Spatial Survey & Anomaly Detector Interoperability
- **`src/sim/spatial/spatial-anomaly-detector.ts` (lines 69–155)**:
  - `detectBuildingRoadCollisions(buildings, streetCorridors)` checks `intersects(b.bounds, corridor)`.
  - `detectWallCollisions(grid, portals, streetCorridors)` checks if any `SOOT_BRICK_WALL` breaches `streetCorridors`.
- **`src/sim/spatial/spatial-self-corrector.ts` (lines 170–180)**:
  - `restoreRoadCorridors(grid, streetCorridors)` restores cobblestone floor on any cell within `streetCorridors`.
  - Both M2 tools rely on `readonly Box[]` representing street corridors.

---

## 2. Logic Chain

1. **Decoupling Urban Dimensions (Observation 1.1 → Feature 11 Design)**:
   - Fixed 48x36 assumptions prevent world scaling (e.g. 32x24 compact districts, 64x48 or 80x60 metropolitan districts).
   - Chunk streaming (`src/schemas/chunk-streaming.schema.ts`) uses chunk dimensions `CHUNK_SIZE_X = 16`, `CHUNK_SIZE_Y = 12`.
   - Cross-street intervals aligned to multiples of 16 (e.g. 15–16, 31–32, 47–48) naturally partition any arbitrary district width `W` into `ceil(W / 16)` super-blocks.
   - Building templates require minimum dimensions 11x10 (e.g. Constabulary 11x10, Tenement 11x11, Tavern 12x10). Therefore, super-blocks of width `bw >= 22` can be split into 2 parcels, while `11 <= bw < 22` yield 1 parcel. Any block smaller than 11 cannot fit standard templates and is reserved as a pocket courtyard or civic space.

2. **Frontage & Service Alley Access (Observation 1.1 → Feature 11 Design)**:
   - Frontage: For Northern super-blocks, building frontages face SOUTH toward the central arterial avenue. For Southern super-blocks, frontages face NORTH toward the avenue.
   - Service Alleys: A 1-tile service alley placed along the outer block row (`y = 2` for North, `y = height - 3` for South) provides rear access for utilities, soot drainage, and back exits, preventing dead-ends.
   - Plaza Reservation: A central civic plaza (`cx ± pw/2, cy ± ph/2`, default 7x7) is explicitly reserved; parcels overlapping this zone are clipped or stepped back so building perimeters never encroach into the central civic monument area.

3. **Seamless Thoroughfares vs Perimeter Walls (Observation 1.2 & 1.3 → Feature 12 Design)**:
   - `buildSolidStratumGrid` default border walls isolate districts into enclosed cages.
   - By calculating `DistrictBoundarySeams` from overworld planar neighbors:
     - Where a planar neighbor exists on an edge, the thoroughfare intersection (e.g., avenue at `y = cy - 1 .. cy + 1` or cross-street at `x = cx - 1 .. cx + 1`) replaces the perimeter `SOOT_BRICK_WALL` with open traversable terrain.
     - Where a canal barrier exists (Limehouse <-> Spitalfields), the seam features water canal incisions crossed by a `TIMBER_PIER` or `IRON_GRATE` bridge span.
     - Where a toll perimeter exists (Whitechapel <-> Belgravia), the seam features a `TOLL_ARCH` with gatepost checkpoints.
     - Where a viaduct barrier exists (Spitalfields <-> Belgravia), the seam features a `VIADUCT_ARCH` with gothic colonnade pillars.
     - Where no planar neighbor exists (or map boundary), the perimeter remains `SOLID_WALL`.

4. **Coordinate Alignment & Continuous Navigation Coupling (Observation 1.3 → Downstream Feature 13)**:
   - Because the arterial avenue in both adjacent districts is aligned along the exact same vertical center coordinate `cy = Math.floor(height / 2)`, stepping off the East edge of district A (`x = width - 1, y`) lands seamlessly on the West edge of district B (`x = 0, y`) on continuous cobblestones.
   - Zero coordinate warping or modal interruptions are needed.

5. **Modularity & Core/Shell Compliance (Project Rules & Line Limits)**:
   - Both modules belong in `src/sim/spatial/`.
   - Pure headless simulation: zero imports from `src/client/`, `pixi.js`, `preact`, `window`, or browser globals.
   - Zero non-deterministic tokens (`Math.random()`, `Date.now()`); all permutations use `SeededRNG`.
   - Line counts targeted to <= 180 lines, well below the 200-line target and 250-line ceiling.

---

## 3. Concrete Architectural Specifications

### 3.1 Feature 11: `src/sim/spatial/urban-parcels.ts`

**Target Line Count:** ~175 lines (Budget: <= 200, Hard Ceiling: 250).

#### Interface Contract
```typescript
import { Point2D } from '../../schemas/primitives.schema.js';
import { SeededRNG } from '../core/rng.js';
import { Box } from './block-geometry.js';

export interface UrbanGridSpec {
  readonly width: number;
  readonly height: number;
  readonly center?: Point2D;
  readonly avenueWidth?: number;          // Default: 3
  readonly crossStreetWidth?: number;     // Default: 2
  readonly alleyWidth?: number;           // Default: 1
  readonly minParcelWidth?: number;       // Default: 11
  readonly minParcelHeight?: number;      // Default: 10
  readonly plazaSize?: { width: number; height: number }; // Default: { width: 7, height: 7 }
  readonly crossStreetSpacing?: number;   // Default: 16 (chunk size X)
}

export interface UrbanParcel {
  readonly id: string;
  readonly bounds: Box;
  readonly frontDirection: 'NORTH' | 'SOUTH' | 'EAST' | 'WEST';
  readonly templateId?: string;
  readonly streetAccess: 'AVENUE' | 'CROSS_STREET' | 'PLAZA';
  readonly serviceAlleyBounds?: Box;
}

export interface ProceduralParcelResult {
  readonly spec: UrbanGridSpec;
  readonly center: Point2D;
  readonly avenueCorridor: Box;
  readonly crossStreetCorridors: readonly Box[];
  readonly serviceAlleys: readonly Box[];
  readonly plaza: Box;
  readonly blocks: readonly Box[];
  readonly parcels: readonly UrbanParcel[];
  readonly streetCorridors: readonly Box[];
}
```

#### Core Algorithm (`subdivideProceduralParcels`)
1. **Center & Avenue Resolution**:
   - `cx = spec.center?.x ?? Math.floor(spec.width / 2)`
   - `cy = spec.center?.y ?? Math.floor(spec.height / 2)`
   - `aw = spec.avenueWidth ?? 3`, `halfAw = Math.floor(aw / 2)`
   - `avenueCorridor = { x1: 0, y1: cy - halfAw, x2: spec.width - 1, y2: cy + halfAw }`
2. **Plaza Reservation**:
   - `pw = spec.plazaSize?.width ?? 7`, `ph = spec.plazaSize?.height ?? 7`
   - `plaza = { x1: cx - Math.floor(pw / 2), y1: cy - Math.floor(ph / 2), x2: cx + Math.floor(pw / 2), y2: cy + Math.floor(ph / 2) }`
3. **Parametric Cross-Streets**:
   - Spacing `spacing = spec.crossStreetSpacing ?? 16`
   - Compute cross-street start indices: `for (let sx = spacing - 1; sx < spec.width - spacing / 2; sx += spacing)`
   - For each `sx`, create corridor `{ x1: sx, y1: 0, x2: sx + (spec.crossStreetWidth ?? 2) - 1, y2: spec.height - 1 }`.
4. **Service Alleys**:
   - North alley: `{ x1: 2, y1: 2, x2: spec.width - 3, y2: 2 + (spec.alleyWidth ?? 1) - 1 }`
   - South alley: `{ x1: 2, y1: spec.height - 3 - (spec.alleyWidth ?? 1) + 1, x2: spec.width - 3, y2: spec.height - 3 }`
5. **Super-Block & Parcel Subdivision**:
   - Define column slices between cross-streets: `[2, ...crossStreetXEnds, spec.width - 3]`.
   - For each column slice `[colStart, colEnd]`:
     - Width `bw = colEnd - colStart + 1`.
     - If `bw < (spec.minParcelWidth ?? 11)`, continue (too narrow for full building).
     - **North Block**: `y1 = northAlley.y2 + 1`, `y2 = avenueCorridor.y1 - 1`.
       - If column overlaps `plaza.x1..plaza.x2`, adjust `y2 = plaza.y1 - 1`.
     - **South Block**: `y1 = avenueCorridor.y2 + 1`, `y2 = southAlley.y1 - 1`.
       - If column overlaps `plaza.x1..plaza.x2`, adjust `y1 = plaza.y2 + 1`.
     - **Splitting**: If `bw >= 2 * (spec.minParcelWidth ?? 11)`, split column into two equal parcels (`west` and `east`). Otherwise, 1 parcel.
     - Northern parcels get `frontDirection: 'SOUTH'`. Southern parcels get `frontDirection: 'NORTH'`.
6. **Aggregate Street Corridors**:
   - `streetCorridors = [avenueCorridor, ...crossStreetCorridors, plaza]`.

---

### 3.2 Feature 12: `src/sim/spatial/district-boundaries.ts`

**Target Line Count:** ~185 lines (Budget: <= 200, Hard Ceiling: 250).

#### Interface Contract
```typescript
import { BlueprintId } from '../../schemas/primitives.schema.js';
import { EntityRecord } from '../../schemas/components.schema.js';
import { StratumGrid } from './grid.js';

export type SeamType = 'OPEN_STREET' | 'TOLL_ARCH' | 'CANAL_BRIDGE' | 'VIADUCT_ARCH' | 'SOLID_WALL';

export interface EdgeSeamSegment {
  readonly startCoord: number; // Y for West/East edges, X for North/South edges
  readonly endCoord: number;   // Y for West/East edges, X for North/South edges
  readonly seamType: SeamType;
  readonly neighborDistrictId?: BlueprintId;
  readonly description: string;
}

export interface DistrictBoundarySeams {
  readonly districtId: BlueprintId;
  readonly dimensions: { width: number; height: number };
  readonly north: readonly EdgeSeamSegment[];
  readonly south: readonly EdgeSeamSegment[];
  readonly east: readonly EdgeSeamSegment[];
  readonly west: readonly EdgeSeamSegment[];
}
```

#### Core Algorithm (`computeDistrictBoundarySeams`)
1. **Planar Neighbor Resolution**:
   - Query `METROPOLIS_DISTRICT_DOSSIERS[districtId].macroCoords`.
   - West neighbor: `(col - 1, row)`, East: `(col + 1, row)`, North: `(col, row - 1)`, South: `(col, row + 1)`.
   - Fall back to `RING_FALLBACK` for East/West if planar lookup yields no hit.
2. **Barrier Typology Resolution**:
   - Call `getOverworldBarriersForDistrict(districtId)`.
   - For each adjacent pair `(districtId, neighborId)`:
     - If barrier has `barrierType === 'THAMES_CANAL'` → `CANAL_BRIDGE`
     - If barrier has `barrierType === 'TOLL_PERIMETER_WALL'` → `TOLL_ARCH`
     - If barrier has `barrierType === 'VIADUCT'` → `VIADUCT_ARCH`
     - Otherwise → `OPEN_STREET`
3. **Edge Segment Generation**:
   - **East & West Edges (`height`)**:
     - Thoroughfare span: `start = cy - 1`, `end = cy + 1`.
     - Segment 1: `[0, start - 1]` → `SOLID_WALL`.
     - Segment 2: `[start, end]` → `seamType` (`OPEN_STREET` / `TOLL_ARCH` / `CANAL_BRIDGE`), tagged with `neighborDistrictId`.
     - Segment 3: `[end + 1, height - 1]` → `SOLID_WALL`.
     - If no neighbor on that edge, single segment `[0, height - 1]` with `SOLID_WALL`.
   - **North & South Edges (`width`)**:
     - If planar neighbor exists (e.g. Spitalfields ↔ Belgravia on North edge):
       - Thoroughfare span: `start = cx - 1`, `end = cx + 1`.
       - Segment 1: `[0, start - 1]` → `SOLID_WALL`.
       - Segment 2: `[start, end]` → `seamType`, tagged with `neighborDistrictId`.
       - Segment 3: `[end + 1, width - 1]` → `SOLID_WALL`.
     - If no neighbor on that edge, single segment `[0, width - 1]` with `SOLID_WALL`.
4. **Grid Stamping (`applyBoundarySeamsToGrid`)**:
   - Applies seam rules directly to perimeter cells of `StratumGrid`:
     - `OPEN_STREET`: sets terrain to `COBBLESTONE_FLOOR`, `blocksMovement: false`, `blocksSight: false`.
     - `TOLL_ARCH`: sets threshold cell to `IRON_GRATE`, `blocksMovement: false`, and places Constabulary toll checkpoint pillars on flank cells.
     - `CANAL_BRIDGE`: border cells become `CANAL_SLUICE`, while bridge path cells become `TIMBER_PIER` / `IRON_GRATE`, `blocksMovement: false`.
     - `VIADUCT_ARCH`: places `GOTHIC_COLONNADE` archway framing open cobblestone road.
     - `SOLID_WALL`: guarantees `SOOT_BRICK_WALL`, `blocksMovement: true`, `blocksSight: true`.
5. **Traversal Helpers**:
   - `isEdgeSeamTraversable(seams, edge, coord): boolean`
   - `getEdgeNeighbor(seams, edge, coord): BlueprintId | undefined`

---

## 4. Caveats

1. **Read-Only Explorer Scope**:
   - This report delivers the technical blueprint, interface contracts, and implementation algorithm. No simulation or client files were modified during this turn.
2. **Chunk Streaming Engine Decoupling**:
   - Dynamic chunk unload/load lifecycle (`ChunkStreamingLedger`) is managed as a separate concern. Features 11 and 12 focus on spatial generation, parcel layout, and border seam alignment.
3. **Multi-Stratum Height Seams**:
   - Belgravia Spires is at elevation +40m relative to Spitalfields Street (0m). The seam connection uses the Viaduct Colonnade archway on the Street level, while the high-altitude monorail handles direct Spire-to-Spire transit.

---

## 5. Conclusion

- **Feature 11 (`urban-parcels.ts`)**: Solves the fixed 48x36 limitation by providing a purely deterministic, parametric parcel divider driven by `UrbanGridSpec`. Aligns cross-streets to chunk bounds, provides rear service alleys, reserves central civic plazas, and outputs `streetCorridors` directly compatible with M2 anomaly detection and self-correction.
- **Feature 12 (`district-boundaries.ts`)**: Replaces artificial solid perimeter cages with contextual border seams (`OPEN_STREET`, `TOLL_ARCH`, `CANAL_BRIDGE`, `VIADUCT_ARCH`). Accurately aligns with 2D overworld planar coordinates and existing natural barriers, paving the way for Feature 13 continuous boundary traversal.

---

## 6. Verification Method

### 6.1 Unit Test Specifications to Implement
1. **`tests/sim/urban-parcels.test.ts`**:
   - Test 1: Subdivides 48x36 district into >= 6 building parcels with front access facing the central avenue.
   - Test 2: Subdivides expanded 64x48 and 80x60 districts, verifying proportional parcel count increases and 0 building overlap with plaza.
   - Test 3: Verifies service alleys run behind building parcels and all street corridors validate against `detectBuildingRoadCollisions`.
2. **`tests/sim/district-boundaries.test.ts`**:
   - Test 1: Verifies Spitalfields Soot Works computes `OPEN_STREET` on West (to Whitechapel), `CANAL_BRIDGE` on East (to Limehouse), and `VIADUCT_ARCH` on North (to Belgravia).
   - Test 2: Verifies `applyBoundarySeamsToGrid` carves open, walkable, sight-clear cobblestone and pier cells on the seam segments while keeping non-thoroughfare walls solid.
   - Test 3: Multi-seed determinism: 50 random seeds produce bit-identical boundary seams.

### 6.2 Verification Command Gate
Execute the project verification gate:
```bash
npm run verify
```
Must pass with:
- 0 TypeScript compiler errors (`tsc --noEmit`)
- 0 Boundary check violations (`check-boundaries.ts`, all files <= 250 lines)
- 0 Data validation errors (`validate-data.ts`)
- All Vitest simulation test suites passing (`tests/sim/*.test.ts`)
