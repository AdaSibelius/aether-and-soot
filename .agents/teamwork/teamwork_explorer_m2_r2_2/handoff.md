# Subterranean Strata Architecture Specification: Victorian Sewers & Subterranean Mines (Milestone 2)

## 1. Observation

Direct code examination and telemetry across `src/sim/spatial/`, `src/schemas/`, and `tests/sim/` reveal the existing spatial generation infrastructure, multi-stratum verticality, and pathfinding walkability enforcement:

### 1.1 Spatial Module Line Counts & Modularity Telemetry
Execution of `wc -l src/sim/spatial/*.ts` confirms that all current spatial modules strictly respect the 250-line target and 300-line hard ceiling (`AGENTS.md` Rule 2.2):
- `src/sim/spatial/undercroft-topology.ts`: 126 lines
- `src/sim/spatial/catacombs-generation.ts`: 142 lines
- `src/sim/spatial/spire-topology.ts`: 94 lines
- `src/sim/spatial/strata-dungeons.ts`: 181 lines
- `src/sim/spatial/district-scaler.ts`: 180 lines
- `src/sim/spatial/district-layout.ts`: 168 lines
- `src/sim/spatial/grid.ts`: 131 lines
- `src/sim/spatial/fixture-catalog.ts`: 232 lines
- `src/sim/spatial/building-templates.ts`: 245 lines
- `src/sim/spatial/template-instantiator.ts`: 189 lines

Both proposed new modules (`src/sim/spatial/sewer-topology.ts` and `src/sim/spatial/mines-generation.ts`) must stay strictly under **220 lines** each (target <= 250, hard ceiling 300).

### 1.2 Grid Cells, Liquids, and Primitive Schemas
In `src/schemas/primitives.schema.ts` and `src/sim/spatial/grid.ts`:
- **`TerrainTypeSchema`** (lines 79–116) already contains all required subterranean fixtures and structural elements:
  `'COBBLESTONE_FLOOR'`, `'SOOT_BRICK_WALL'`, `'IRON_GRATE'`, `'BRASS_CATWALK'`, `'CANAL_SLUICE'`, `'TIMBER_STRUT'`, `'RAIL_TRACK'`, `'BOARDING_PLATFORM'`, `'SCORCHED_STONE'`, `'RUBBLE_PILE'`, `'SLAG_MOUND'`, `'SLAG_PIT'`.
- **`LiquidTypeIdSchema`** (lines 152–159) already supports `'SLUICE_SLUDGE'`, `'NITRIC_ACID'`, `'WHALE_OIL'`, `'BLOOD'`, `'NONE'`.
- **`TileCellSchema`** (`grid.ts:5-16`) supports:
  - `terrainType: TerrainType`
  - `blocksMovement: boolean`
  - `blocksSight: boolean`
  - `steamPressureKpa: number` (thermodynamic gradient)
  - `coalDustDensity: number` (0 to 1, particulate accumulation)
  - `liquidType: LiquidTypeId` (`'SLUICE_SLUDGE'`)
  - `liquidVolumeMl: number` (e.g. 2000 ml)
  - `smokePpm: number` (toxic sewer miasma)
  - `interiorZone: InteriorZoneType`

### 1.3 Strata Hierarchy & Existing Subterranean Generators
1. **Undercroft Sewers** (`undercroft-topology.ts:48-125`):
   - Generates a solid `UNDERCROFT` grid, carves 6 cistern chambers (4 canonical quadrant anchors at `(10, 7)`, `(37, 7)`, `(10, 28)`, `(37, 28)`, plus 2 mid chambers), and joins them via `carveSerpentine` with `IRON_GRATE` and single-tile `CANAL_SLUICE` basins.
   - Lacks true dual-channel conduits, vaulted octagonal junction chambers, and miasma gradients.
2. **Catacombs Delve** (`catacombs-generation.ts:22-140`):
   - Generates 4 sequential rectangular rooms in a ring with miasma steam (`miasmaSteam = Math.min(60, 5 + depthLevel * 6)`) and stairs up/down.
   - Currently lacks organic meandering drift tunnels, excavated room-and-pillar stopes, timber strut shoring, and narrow-gauge rail haulage.
3. **Cross-Stratum Portals** (`utility-networks.ts`, `strata-dungeons.ts`, `district-scaler.ts`):
   - `streetManhole` <-> `undercroftLadder` at `(centerX, centerY)`.
   - `stairs_undercroft_to_catacombs` at `chambers[4]` targeting `(5, 5, 'CATACOMBS', depthLevel: 1)`.
   - Secondary sewer drops `portal_sewer_drop_1/2` <-> `portal_undercroft_ascent_1/2` with `CrossStratumShaftComponent` (`shaftType: 'SEWER_SIPHON'`).

---

## 2. Logic Chain

From the direct code observations, we derive the structural and algorithmic requirements for the two target modules:

### 2.1 Victorian Sewer Stratum Topology (`src/sim/spatial/sewer-topology.ts`)

#### A. Dual-Channel Conduit Profiles
- *Historical / Architectural Rationale*: Bazalgette's Victorian intercepting sewers featured brick conduits with a central low-flow effluent channel (cunette) conveying dark sludge, flanked on either side by elevated masonry inspection walkways (benches) allowing sewer flushers to walk along the tunnels above the water line.
- *Geometric Model*:
  A 3-tile wide conduit profile running between junction chambers:
  - **Horizontal Conduit Segment**:
    - Row $y - 1$: Elevated Inspection Walkway (`terrainType: 'IRON_GRATE'`, `blocksMovement: false`, `blocksSight: false`).
    - Row $y$: Central Effluent Sluice (`terrainType: 'CANAL_SLUICE'`, `liquidType: 'SLUICE_SLUDGE'`, `liquidVolumeMl: 2000`, `blocksMovement: true`, `blocksSight: false`).
    - Row $y + 1$: Elevated Inspection Walkway (`terrainType: 'IRON_GRATE'`, `blocksMovement: false`, `blocksSight: false`).
  - **Vertical Conduit Segment**:
    - Col $x - 1$: Elevated Inspection Walkway (`terrainType: 'IRON_GRATE'`, `blocksMovement: false`).
    - Col $x$: Central Effluent Sluice (`terrainType: 'CANAL_SLUICE'`, `liquidType: 'SLUICE_SLUDGE'`, `liquidVolumeMl: 2000`, `blocksMovement: true`).
    - Col $x + 1$: Elevated Inspection Walkway (`terrainType: 'IRON_GRATE'`, `blocksMovement: false`).
- *Crossover Weirs & Maintenance Bridges (Walkability Invariant)*:
  Because the central effluent sluice has `blocksMovement: true`, actors on one walkway would be permanently trapped from reaching the opposite walkway unless bridge points exist.
  - *Invariant Rule*: At regular intervals (every 5–6 steps along any conduit segment) and at all conduit turns/intersections, the center tile is carved as an **Elevated Weir Crossover**:
    `terrainType: 'IRON_GRATE'`, `blocksMovement: false`, `blocksSight: false`, with `liquidType: 'SLUICE_SLUDGE'`, `liquidVolumeMl: 500`.
  - This preserves the visual and semantic presence of sludge while guaranteeing that both flanking walkways are 100% 4-directionally BFS-connected!

#### B. Octagonal Vaulted Junction Chambers (5x5 Chambers)
- *Historical Rationale*: At arterial sewer intersections, Victorian municipal engineers constructed elaborate vaulted masonry junction chambers featuring central sediment catch basins, overflow weirs, and cast-iron maintenance ladder shafts.
- *Mathematical Construction*:
  For an octagonal chamber centered at $(c_x, c_y)$ with radius $R = 2$ (5x5 bounding box):
  - Bounding box: $x \in [c_x - 2, c_x + 2]$, $y \in [c_y - 2, c_y + 2]$.
  - Octagonal corner truncation: An interior cell $(x, y)$ is carved if and only if:
    $$(|x - c_x| \neq 2) \lor (|y - c_y| \neq 2)$$
    This removes the 4 extreme diagonal corners $\{ (-2, -2), (2, -2), (-2, 2), (2, 2) \}$, leaving exactly **21 carved tiles** forming a regular octagon.
  - *Perimeter Walkways*:
    All 16 outer excavated tiles are paved with `IRON_GRATE` (`blocksMovement: false`).
  - *Central Catch Basin & Ladder Landing*:
    - Center tile $(c_x, c_y)$: Iron maintenance landing platform (`IRON_GRATE`, `blocksMovement: false`). In the central chamber, this seats the `undercroftLadder` ascending to surface `streetManhole`.
    - Adjacent sump tiles (e.g. $(c_x - 1, c_y)$ and $(c_x + 1, c_y)$, or $(c_x, c_y + 1)$): Carved as recessed sediment catch basins (`CANAL_SLUICE`, `liquidType: 'SLUICE_SLUDGE'`, `liquidVolumeMl: 2500`, `blocksMovement: true`).
    - Flanking inspection paths remain open around the catch basin, guaranteeing unobstructed passage through the chamber in all 4 cardinal directions.

#### C. Miasma Atmospheric Gradients
- *Thermodynamic & Chemical Rationale*: Decomposing organic matter generates high concentrations of toxic hydrogen sulfide and sewer gas ("miasma"), while industrial blowdown discharges hot pressurized steam into the sewers.
- *Gradient Seeding*:
  - All `CANAL_SLUICE` tiles: `smokePpm = rng.nextInt(120, 220)`, `steamPressureKpa = rng.nextInt(15, 35)`.
  - Sump & catch basin tiles: `smokePpm = rng.nextInt(180, 260)`, `steamPressureKpa = rng.nextInt(25, 45)`.
  - Walkway tiles (`IRON_GRATE`): `smokePpm = rng.nextInt(40, 80)`, `coalDustDensity = 0.15 + rng.nextInt(0, 2) * 0.1`.
  - Surface ladder shafts (fresh air ventilation downcast): `smokePpm = rng.nextInt(15, 30)`, `steamPressureKpa = 0`.

---

### 2.2 Subterranean Mine Generation (`src/sim/spatial/mines-generation.ts`)

#### A. Meandering Drift Shafts & Vein Following
- *Geological / Mining Rationale*: Historical Cornish and Victorian adit mines followed rich mineral seams (anthracite coal, tin, copper, iron) through vitrified stone, producing organic, sinuous drift tunnels rather than orthogonal corridors.
- *Drift Carving Algorithm*:
  - Solid rock base: `SOOT_BRICK_WALL` (`blocksMovement: true`, `blocksSight: true`).
  - Directional random walk with momentum (Braitenberg-style vein following):
    - Starting from the central hoist terminal or rail trunk, 2 to 4 drift veins carve outward toward stope targets.
    - Width: 1 to 2 tiles.
    - Forward step probability: 0.70; perpendicular divergence: 0.15 left, 0.15 right.
    - Bounded within margins: $x \in [3, \text{width} - 4]$, $y \in [3, \text{height} - 4]$.
  - Collapsed Drift Dead-Ends:
    - Dead-end branches terminate in collapsed faces containing 1–2 tiles of `RUBBLE_PILE` (`blocksMovement: false`) and `SLAG_MOUND` (`blocksMovement: true`).

#### B. Room-and-Pillar Excavated Stopes
- *Mining Rationale*: Where rich orebodies widened into massive deposits, miners extracted large cavernous chambers ("stopes"). To prevent immediate structural roof collapse, monolithic pillars of unmined rock were left standing in regular arrays.
- *Stope Carving Math*:
  - Placed at terminal vein nodes (radius $R = 3$ to $5$ irregular disc/ellipse).
  - Flooring: `SCORCHED_STONE` or `COBBLESTONE_FLOOR` with heavy coal dust (`coalDustDensity: 0.35..0.75`).
  - *Support Pillars*:
    - In any stope with radius $\ge 3$, unexcavated natural stone support pillars are preserved at $(c_x \pm 2, c_y \pm 2)$.
    - Each pillar is a 1x1 or 2x2 solid tile of `SOOT_BRICK_WALL` (`blocksMovement: true`, `blocksSight: true`).
    - *Anti-Severing Guarantee*: Pillars are spaced $\ge 2$ tiles apart from each other and $\ge 1$ tile away from outer stope walls, ensuring a continuous ring of walkable floor encircling every pillar.

#### C. Support Timber Strut Placement Logic (`TIMBER_STRUT`)
- *Structural Rationale*: Square-set timber frames ("stulls" and "props") braced weak hanging walls along drift passages.
- *Placement Invariant*:
  - `TIMBER_STRUT` has `blocksMovement: true` and `blocksSight: false` (Mohs hardness 3.5, combustible).
  - Placed along drift walls at regular intervals (every 4 to 5 linear steps along tunnel edges).
  - *Safety Guard*: A strut candidate $(x, y)$ is ONLY placed if:
    1. It is adjacent to at least one solid wall tile (`SOOT_BRICK_WALL`).
    2. It does NOT sit on a `RAIL_TRACK` tile.
    3. Placing `TIMBER_STRUT` at $(x, y)$ preserves local 4-connected BFS continuity between the entrance and exit of the local tunnel segment (i.e. `canPlaceWithoutSevering` check).
  - *Unshored Hazard*: Any drift segment $\ge 6$ tiles without timber struts spawns a `RUBBLE_PILE` tile representing localized ceiling spalling.

#### D. Narrow-Gauge Ore Haulage & Terminals
- *Industrial Rationale*: 2-foot narrow-gauge tramways linked active stopes back to the winding hoist.
- *Corridor Layout*:
  - Main haulage trunk laid with `RAIL_TRACK` along the centerline (`blocksMovement: false`, `blocksSight: false`).
  - Terminal sidings inside stopes feature:
    - Container entity: `EntityRecord` with `furniture: { kind: 'CRATE', label: 'Narrow-Gauge Ore Trolley' }`, visual `{ glyph: '⌸', fgPrimary: '#D4AF37', fgSecondary: '#8B6914' }`.
    - Inventory populated with `commodity_anthracite_briquette` (quantity 2–4) and `mat_brass_gears` (quantity 1–2).

#### E. Headframe Vertical Hoist Shaft
- *Verticality Link*:
  - Central 5x5 timber-shored shaft station centered at $H = (h_x, h_y)$.
  - Floor: `BOARDING_PLATFORM` (`blocksMovement: false`).
  - Hoist cage entity:
    - `id`: `portal_mine_hoist_cage`
    - `name`: `'Mine Headframe Hoist Cage'`
    - `visual`: `{ glyph: 'H', fgPrimary: '#E67E22', fgSecondary: '#A04000', bgColor: '#0A0D0E', shaderFlags: ['PULSE_STEAM'] }`
    - `position`: `{ x: h_x, y: h_y, stratum: 'CATACOMBS', depthLevel: 1, blocksMovement: false, blocksSight: false }`
    - `portal`: `{ target: { x: h_x, y: h_y, stratum: 'UNDERCROFT' }, bidirectional: true, conductsGas: true, apCost: 100, portalLabel: 'Operate Steam Hoist to Undercroft Siding' }`
    - `crossStratumShaft`: `{ shaftType: 'MONORAIL_ELEVATOR', upperStratum: 'UNDERCROFT', lowerStratum: 'CATACOMBS', upperCoord: H, lowerCoord: H, operational: true, flowRateUnitsPerTick: 3 }`

---

### 2.3 100% BFS Reachability & Anti-Trapping Invariants

To guarantee zero player-trapping and 100% automated test compliance across all random seeds:

1. **Spanning Tree Connectivity**:
   - Both generators construct a minimum spanning tree between all key nodes (entrance, junction chambers, stopes, quadrant anchors) before any decorative or hazard tiles are stamped.
2. **Weir Bridge & Walkway Crossover Enforcement**:
   - In sewers, every conduit segment has guaranteed `IRON_GRATE` crossovers every 5–6 steps and at all junction thresholds.
3. **Pillar & Strut Safety Guards**:
   - In mines, pillars are strictly isolated from chamber boundaries, and `TIMBER_STRUT` is validated against local connectivity.
4. **Post-Generation Invariant Verification & Auto-Punching**:
   - After carving, run BFS `hasWalkablePath(grid, entryPoint, target)` to every chamber center, stope, and portal.
   - If any target is unreachable, execute `carveCorridor(grid, nearestReachable, target, floorTerrain)`.
5. **Sealing Isolated Pockets (`sealIsolatedPockets`)**:
   - Flood-fill from the primary entrance. Any open cell that cannot reach the entrance is converted back into solid `SOOT_BRICK_WALL`, guaranteeing **zero orphaned walkable pockets**.

---

## 3. Caveats

1. **Stratum ID Mapping for Mines**:
   - `StratumIdSchema` currently supports `['UNDERCROFT', 'STREET', 'SPIRE', 'CATACOMBS']`.
   - *Recommendation*: As confirmed in the Milestone 1 survey, model Mines as a specialized subterranean delve tier within `CATACOMBS` (`depthLevel: 1..N`, or mapped to subterranean depth records in `WorldState.catacombDepths`). This avoids breaking changes to `WorldStateSchema.strata`, `STRATUM_DEPTH_MAP`, or client UI minimaps, while providing full verticality and portal integration.
2. **Door Bump Traversal vs Raw BFS**:
   - Closed wooden doors have `blocksMovement: true`. Pathfinding during gameplay automatically triggers `MOVE_STEP` -> `DOOR_TOGGLED` -> `OPEN`. In both sewers and mine shafts, all public transit routes (conduits, drift shafts, junction chambers, stopes) use open walkways (`IRON_GRATE`, `COBBLESTONE_FLOOR`, `RAIL_TRACK`, `BOARDING_PLATFORM`), with doors reserved strictly for secure vaults or powder magazines.
3. **Modularity Constraints**:
   - To strictly respect the <= 220-line target, each file must remain dedicated to its domain:
     - `sewer-topology.ts`: Conduit profiles, octagonal chambers, weirs, miasma seeding (<= 180 lines).
     - `mines-generation.ts`: Drift shafts, stopes, support pillars, timber struts, rail haulage, hoist cage (<= 210 lines).
     - Integration into the 8-stage pipeline is handled via `district-pipeline-late.ts` or `strata-dungeons.ts`.

---

## 4. Conclusion

### 4.1 Detailed Module Interface Specifications

#### Specification for `src/sim/spatial/sewer-topology.ts`
```typescript
import { Point2D } from '../../schemas/primitives.schema.js';
import { SeededRNG } from '../core/rng.js';
import { StratumGrid } from './grid.js';

export interface SewerJunctionChamber {
  readonly center: Point2D;
  readonly isCatchBasin: boolean;
  readonly hasSurfaceLadder: boolean;
}

export interface SewerTopologyResult {
  readonly grid: StratumGrid;
  readonly chambers: readonly Point2D[];
  readonly junctionChambers: readonly SewerJunctionChamber[];
  readonly catchBasinPos: Point2D;
}

/**
 * Carves an authentic Victorian sewer network:
 * - 5x5 vaulted octagonal junction chambers at arterial intersections
 * - Dual-channel conduits: central CANAL_SLUICE effluent flanked by IRON_GRATE walkways
 * - Regular crossover weir bridges preserving 100% BFS walkability between walkway banks
 * - Low-lying miasma (smokePpm) and industrial runoff steam pressure (steamPressureKpa)
 */
export function carveVictorianSewerTopology(
  width: number,
  height: number,
  entryPos: Point2D,
  rng: SeededRNG,
): SewerTopologyResult;
```

#### Specification for `src/sim/spatial/mines-generation.ts`
```typescript
import { EntityRecord } from '../../schemas/components.schema.js';
import { Point2D } from '../../schemas/primitives.schema.js';
import { SeededRNG } from '../core/rng.js';
import { StratumGrid } from './grid.js';

export interface MineStope {
  readonly center: Point2D;
  readonly radius: number;
  readonly pillars: readonly Point2D[];
}

export interface MineStratumResult {
  readonly grid: StratumGrid;
  readonly entities: Record<string, EntityRecord>;
  readonly hoistPos: Point2D;
  readonly stopes: readonly MineStope[];
  readonly railTracks: readonly Point2D[];
}

/**
 * Generates a subterranean room-and-pillar mine delve:
 * - Meandering drift shafts following procedural ore veins through solid rock
 * - Irregular excavated stopes with unexcavated natural stone support pillars
 * - Non-obstructive TIMBER_STRUT placement along drift walls
 * - Narrow-gauge RAIL_TRACK corridors connecting stopes to haulage terminals
 * - Headframe vertical hoist shaft cage portal linking mine floor to surface/undercroft
 */
export function generateSubterraneanMineStratum(
  width: number,
  height: number,
  hoistPos: Point2D,
  rng: SeededRNG,
  depthLevel?: number,
): MineStratumResult;
```

### 4.2 Mathematical Formulas & Cell Rules Reference Table

| Feature | Terrain Type | Tile Cell Properties | Mathematical Geometry / Carving Rule |
| :--- | :--- | :--- | :--- |
| **Effluent Flume** | `CANAL_SLUICE` | `blocksMovement: true`, `blocksSight: false`, `liquidType: 'SLUICE_SLUDGE'`, `liquidVolumeMl: 2000`, `smokePpm: 120..220` | Central tile of 3-tile conduit: $(x, y)$ along path |
| **Inspection Walkway** | `IRON_GRATE` | `blocksMovement: false`, `blocksSight: false`, `coalDustDensity: 0.15..0.35`, `smokePpm: 40..80` | Flanking tiles: $(x, y \pm 1)$ or $(x \pm 1, y)$ |
| **Weir Crossover** | `IRON_GRATE` | `blocksMovement: false`, `blocksSight: false`, `liquidType: 'SLUICE_SLUDGE'`, `liquidVolumeMl: 500` | Stamped every 5–6 steps along conduit center: $(x, y)$ |
| **Octagonal Chamber** | `IRON_GRATE` | `blocksMovement: false`, `blocksSight: false` | 5x5 bounding box: $(|dx| \neq 2) \lor (|dy| \neq 2)$ (21 tiles) |
| **Catch Basin Sump** | `CANAL_SLUICE` | `blocksMovement: true`, `blocksSight: false`, `liquidType: 'SLUICE_SLUDGE'`, `liquidVolumeMl: 2500` | Recessed basin at $(c_x \pm 1, c_y)$ inside junction chamber |
| **Drift Shaft** | `COBBLESTONE_FLOOR` | `blocksMovement: false`, `blocksSight: false`, `coalDustDensity: 0.20..0.45` | Directional random walk: 70% forward, 15% left, 15% right |
| **Support Pillar** | `SOOT_BRICK_WALL` | `blocksMovement: true`, `blocksSight: true` | In stopes with $R \ge 3$: preserved at $(c_x \pm 2, c_y \pm 2)$ |
| **Timber Strut** | `TIMBER_STRUT` | `blocksMovement: true`, `blocksSight: false` | Stamped every 4–5 steps against wall if non-severing |
| **Ore Rail Track** | `RAIL_TRACK` | `blocksMovement: false`, `blocksSight: false` | Centerline of main drift haulage trunk |
| **Ore Trolley** | Fixture Entity | `furniture: { kind: 'CRATE' }`, inventory: coal briquettes & gears | Stamped at rail siding terminal inside active stopes |
| **Hoist Cage** | Portal Entity | `portal`: target Undercroft/Street; `crossStratumShaft`: `MONORAIL_ELEVATOR` | Center of 5x5 timbered station at $H = (h_x, h_y)$ |

---

## 5. Verification Method

To independently verify the implementation once executed by subsequent agents:

### 5.1 Verification Commands
1. **Modularity & Boundaries Check**:
   ```bash
   npm run check:boundaries
   ```
   *Expected*: Passes with 0 errors. Asserts `src/sim/spatial/sewer-topology.ts` and `src/sim/spatial/mines-generation.ts` are each $\le 220$ lines (strictly $< 300$).
2. **Strict TypeScript Compilation**:
   ```bash
   npm run typecheck
   ```
   *Expected*: Strict TypeScript compiles with 0 errors (`tsc --noEmit`).
3. **Headless Simulation Determinism & Walkability Tests**:
   ```bash
   npx vitest run tests/sim/strata-dungeons.test.ts tests/sim/spatial-reachability.test.ts tests/sim/spatial-contiguity-audit.test.ts
   ```
   *Expected*: 100% pass across all random seeds, confirming:
   - Undercroft sewer generates $\ge 250$ walkable tiles with 100% reachability to quadrant anchors $(10, 7)$, $(37, 7)$, $(10, 28)$, $(37, 28)$.
   - Surface manhole <-> undercroft ladder portal round-trip traversal remains unbroken.
   - Mine hoist cage connects Undercroft and subterranean mine floor with 100% reachability to all stopes.
4. **Full Verification Suite**:
   ```bash
   npm run verify
   ```
   *Expected*: All 4 gates (typecheck, boundaries, data validation, simulation tests) exit code 0.

### 5.2 Invalidation Conditions
The specifications in this report shall be invalidated if:
- Any conduit central sluice breaks BFS reachability between the north and south inspection walkways due to missing crossover weirs.
- Any support pillar or `TIMBER_STRUT` is placed such that it severs access to a stope or transit portal.
- Any generated sewer or mine floor contains disconnected open floor pockets that cannot reach the vertical entrance.
- Either `src/sim/spatial/sewer-topology.ts` or `src/sim/spatial/mines-generation.ts` exceeds 220 lines.
