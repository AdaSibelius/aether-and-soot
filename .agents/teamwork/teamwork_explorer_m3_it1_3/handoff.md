# Handoff Report: Continuous Viewport Lookahead Projection & Multi-Seed Walkability Test Suite (Milestone 3, Features 15 & 16)

**Author:** teamwork_explorer_m3_it1_3  
**Working Directory:** `/Users/emmett/Desktop/Game/.agents/teamwork/teamwork_explorer_m3_it1_3/`  
**Parent Orchestrator:** `b1f4e92b-f8d8-4000-b9ea-8ea40dd02e57`  
**Milestone:** Milestone 3 (Continuous World Generation, Seams & Continuous Navigation)  

---

## 1. Observation

Direct code observations from codebase exploration:

### 1.1 Existing Viewport Bounds & Out-of-Bounds Void Fallback
- **`src/client/projection/frame-adapter.ts` (lines 100–113)**:
  ```typescript
  for (let vy = 0; vy < vp.viewportHeight; vy++) {
    for (let vx = 0; vx < vp.viewportWidth; vx++) {
      const worldX = vp.cameraX + vx - vp.offsetX;
      const worldY = vp.cameraY + vy - vp.offsetY;

      if (worldX < 0 || worldX >= grid.width || worldY < 0 || worldY >= grid.height) {
        const oobVisual = resolveOutOfBoundsVisual(worldX, worldY, grid.width, grid.height, state.turnCount);
        cells.push({
          x: vx, y: vy, worldX, worldY, visual: oobVisual,
          layers: buildOutOfBoundsLayers(oobVisual),
          visible: false, explored: false, steamPressureKpa: 0, coalDustDensity: 0,
        });
        continue;
      }
  ```
  - When viewport coordinates fall outside `[0, grid.width)` or `[0, grid.height)`, `frame-adapter.ts` unconditionally calls `resolveOutOfBoundsVisual`.
  - On widescreen displays (`WIDESCREEN_GRID_WIDTH = 88`, tactical width = 58 cells), a standard 48-wide district leaves flanking columns (columns 0..4 and 53..57) as out-of-bounds void.
  - When the camera is near border seams, any lookahead into neighboring districts is rendered as copperplate hatching, structural rivets, and dark void dots (`'·'`, `'░'`, `'▒'`, `'◈'`, `'║'`, `'═'`, `'╬'`) rather than an interconnected cityscape.

### 1.2 Camera Governor & Coordinate Calculations
- **`src/client/projection/camera-governor.ts` (lines 13–47, 53–102)**:
  - `calculateCameraViewport` computes `cameraX`, `cameraY`, `offsetX`, and `offsetY`:
    ```typescript
    const isCenteredWidescreen = Boolean(viewportOverride && effectiveW > gridWidth);
    const offsetX = isCenteredWidescreen ? Math.floor((effectiveW - gridWidth) / 2) : 0;
    const offsetY = isCenteredWidescreen ? Math.floor((reqH - gridHeight) / 2) : 0;
    const cameraX = isCenteredWidescreen ? 0 : Math.max(0, Math.min(gridWidth - effectiveW, originX - Math.floor(effectiveW / 2)));
    const cameraY = isCenteredWidescreen ? 0 : Math.max(0, Math.min(gridHeight - viewportHeight, originY - Math.floor(viewportHeight / 2)));
    ```
  - When `isCenteredWidescreen` is true, `cameraX = 0`, but because `offsetX > 0`, the left edge has `worldX = vx - offsetX < 0` for `vx < offsetX`.
  - When `worldX < 0` or `worldX >= gridWidth`, the camera is looking directly into adjacent territorial space.

### 1.3 Overworld Planar Topology & Neighbor Adjacency
- **`src/sim/spatial/overworld-matrix.ts` (lines 10–72)**:
  - Defines 2D macro-topography coordinates `(col, row)` for districts:
    - `district_fleet_ditch_undercroft`: `(col: 0, row: 1)`
    - `district_whitechapel_ward`: `(col: 1, row: 1)`
    - `district_spitalfields_soot_works`: `(col: 2, row: 1)`
    - `district_limehouse_docks`: `(col: 3, row: 1)`
    - `district_belgravia_brass_spires`: `(col: 2, row: 0)`
- **`src/sim/spatial/compass-gates.ts` (lines 32–56)**:
  - `planarNeighbor(districtId, dCol, dRow)` resolves adjacent district IDs:
    - West neighbor: `(col - 1, row)` (e.g. Spitalfields West -> Whitechapel)
    - East neighbor: `(col + 1, row)` (e.g. Spitalfields East -> Limehouse)
    - North neighbor: `(col, row - 1)` (e.g. Spitalfields North -> Belgravia Spires)
    - South neighbor: `(col, row + 1)`

### 1.4 Layer Projection & Atmospheric Depth Support
- **`src/client/projection/layer-projection.ts` (lines 4–12, 76–86)**:
  ```typescript
  export interface GlyphLayerVisual {
    readonly glyph: string;
    readonly fgPrimary: string;
    readonly fgSecondary?: string | undefined;
    readonly bgColor?: string | undefined;
    readonly alpha?: number | undefined;
    readonly shaderFlags?: readonly ShaderFlag[] | undefined;
    readonly tileKey?: string | undefined;
  }
  ```
  - `GlyphLayerVisual` explicitly supports an `alpha` property.
  - Setting `alpha: 0.65` on lookahead neighbor tiles provides atmospheric depth fogging without requiring custom WebGL fragment shader uniforms.
- **`src/client/projection/biome-palette.ts` (lines 50–65)**:
  - `resolveDistrictBiome(districtId, stratum)` can resolve the biome color palette for any district.
- **`src/client/projection/extended-box-drawing.ts` (lines 5–9)**:
  - `resolveExtendedConnectingWallGlyph(grid, x, y)` provides full CP437 autotiling for walls within any stratum grid.

### 1.5 State Storage & Headless Determinism
- **`src/sim/core/world.ts` (lines 42–69)**:
  - `state.savedDistricts: Record<string, SavedDistrictSnapshot>` caches previously visited or simulated districts.
  - `state.currentDistrictId: BlueprintId` identifies the currently active district.
  - `src/sim/spatial/generator.ts:generateVictorianDistrict(state)` is 100% deterministic given `seed` and `currentDistrictId`.
- **`tests/sim/` Invariants**:
  - Boundary check rule (`AGENTS.md:Rule 2.1`): Files in `src/sim/` and `tests/sim/` must NEVER import from `src/client/`, `pixi.js`, or browser globals.
  - Zero non-deterministic tokens (`Math.random()`, `Date.now()`) anywhere in simulation code.

---

## 2. Logic Chain

1. **Step 1: Intercepting Boundary Coordinates (Observation 1.1 & 1.2)**
   - *Premise*: Whenever `worldX < 0 || worldX >= grid.width || worldY < 0 || worldY >= grid.height`, the viewport is peeking past the perimeter of the active district.
   - *Deduction*: Instead of jumping directly to `resolveOutOfBoundsVisual`, `frame-adapter.ts` should query a continuous projection adapter: `resolveContinuousLookaheadCell(...)`. If a neighboring district tile exists, it renders that tile; only if no neighbor exists (e.g. edge of London overworld or impassable natural barrier) does it fall back to `resolveOutOfBoundsVisual`.

2. **Step 2: Coordinate Translation into Planar Neighbor Space (Observation 1.3)**
   - *From Observation 1.3*: Overworld topology defines planar neighbor relationships.
   - *Deduction*:
     - If $worldX < 0$ and $0 \le worldY < H_{curr}$: target is West neighbor ($dCol = -1, dRow = 0$). Neighbor coordinate is $neighborX = W_{neigh} + worldX$, $neighborY = worldY$.
     - If $worldX \ge W_{curr}$ and $0 \le worldY < H_{curr}$: target is East neighbor ($dCol = +1, dRow = 0$). Neighbor coordinate is $neighborX = worldX - W_{curr}$, $neighborY = worldY$.
     - If $0 \le worldX < W_{curr}$ and $worldY < 0$: target is North neighbor ($dCol = 0, dRow = -1$). Neighbor coordinate is $neighborX = worldX$, $neighborY = H_{neigh} + worldY$.
     - If $0 \le worldX < W_{curr}$ and $worldY \ge H_{curr}$: target is South neighbor ($dCol = 0, dRow = +1$). Neighbor coordinate is $neighborX = worldX$, $neighborY = worldY - H_{curr}$.
     - Corners (NW, NE, SW, SE): check diagonal planar neighbor $(dCol, dRow)$ with both coordinate translations applied.

3. **Step 3: Read-Only Grid Retrieval & Deterministic Lookahead Cache (Observation 1.5)**
   - *From Project Constraints*: Client projection must remain strictly read-only and never mutate `WorldState`.
   - *Deduction*:
     - First check `state.savedDistricts[neighborDistrictId]?.strata[stratum]`. If the player already visited that district, this reflects any player-made world changes.
     - If not in `savedDistricts`, check an internal lookahead memoization cache (`LOOKAHEAD_CACHE: Map<string, StratumGrid>`) keyed by `${state.seed}:${neighborDistrictId}:${stratum}`.
     - If cache miss, lazily generate the district grid via `generateVictorianDistrict({ ...state, currentDistrictId: neighborDistrictId })` and store in the cache.
     - The cache is bounded (max 16 entries) and purely client-side; `WorldState` is never mutated.

4. **Step 4: Atmospheric Z-Depth Fogging & Visual Composition (Observation 1.4)**
   - *From Observation 1.4*: `GlyphLayerVisual` supports `alpha`.
   - *Deduction*: Lookahead tiles are rendered with `alpha: 0.65`, their district's authentic biome palette (`resolveDistrictBiome`), autotiled connecting walls (`resolveExtendedConnectingWallGlyph`), and dim foreground tints. This produces an evocative atmospheric distance perspective across borders while completely eliminating black void boxes.

5. **Step 5: Pure Simulation Verification Suite (Feature 16) (Observation 1.5)**
   - *From Observation 1.5 & AGENTS.md*: `tests/sim/continuous-worldgen.test.ts` must test simulation core (`src/sim/`) without any client imports.
   - *Deduction*: The test suite isolates:
     1. Multi-block parcel subdivider determinism and geometric validity (`urban-parcels.ts`).
     2. Edge seam alignment and open thoroughfare continuity across adjacent districts (`district-boundaries.ts`).
     3. Seamless continuous transit coordinate translation and companion preservation (`continuous-transit.system.ts`).
     4. Architectural template hydration across 25 unseen seeds using `hasWalkablePath`.

---

## 3. Concrete Architectural Specifications

### 3.1 Feature 15: Continuous Viewport Lookahead Projection (`src/client/projection/continuous-projection.ts`)

- **File Path:** `src/client/projection/continuous-projection.ts`
- **Target Line Count:** ~150–170 lines (Budget: <= 180 lines, Hard Ceiling: 250 lines).
- **Core Dependencies:**
  - `src/schemas/components.schema.ts` (`EntityRecord`)
  - `src/schemas/primitives.schema.ts` (`BlueprintId`, `StratumId`, `VisualGlyphSpec`)
  - `src/sim/core/world.ts` (`WorldState`)
  - `src/sim/spatial/grid.ts` (`StratumGrid`, `getTileCell`)
  - `src/sim/spatial/overworld-matrix.ts` (`METROPOLIS_DISTRICT_DOSSIERS`)
  - `src/sim/spatial/generator.ts` (`generateVictorianDistrict`)
  - `src/client/projection/biome-palette.ts` (`resolveDistrictBiome`, `resolveBiomeTerrainVisual`)
  - `src/client/projection/extended-box-drawing.ts` (`resolveExtendedConnectingWallGlyph`)
  - `src/client/projection/wall-connections.ts` (`WALL_BOX_GLYPHS`)
  - `src/client/projection/layer-projection.ts` (`buildCellLayers`, `RenderCellLayers`, `classifyEntityLayer`, `buildEntityLayerVisual`, `composeLayersToVisualSpec`)
  - `src/client/projection/frame-adapter.ts` (`RenderCellFrame`)

#### Interface & Exported Signatures
```typescript
export interface NeighborCoordinateMapping {
  readonly neighborDistrictId: BlueprintId;
  readonly neighborX: number;
  readonly neighborY: number;
}

/**
 * Resolves planar neighbor and translates world coordinates beyond current district boundaries.
 * Returns undefined if no neighbor exists in that direction or coordinates exceed neighbor bounds.
 */
export function mapCoordinateToNeighbor(
  currentDistrictId: BlueprintId,
  worldX: number,
  worldY: number,
  currentWidth: number,
  currentHeight: number,
): NeighborCoordinateMapping | undefined;

/**
 * Retrieves the stratum grid for a neighboring district (from savedDistricts or memoized lookahead cache).
 * Strictly read-only; never mutates WorldState.
 */
export function getNeighborDistrictStratumGrid(
  state: Readonly<WorldState>,
  neighborDistrictId: BlueprintId,
  stratum: StratumId,
): { grid: StratumGrid; entities?: Record<string, EntityRecord> } | undefined;

/**
 * Resolves an out-of-bounds cell into a continuous cityscape RenderCellFrame.
 * Applies atmospheric Z-depth fogging (alpha: 0.65).
 * Returns undefined if coordinate has no planar neighbor.
 */
export function resolveContinuousLookaheadCell(
  state: Readonly<WorldState>,
  activeStratum: StratumId,
  worldX: number,
  worldY: number,
  currentWidth: number,
  currentHeight: number,
  vx: number,
  vy: number,
): RenderCellFrame | undefined;

/**
 * Resets the lookahead grid cache (for test cleanup).
 */
export function clearContinuousLookaheadCache(): void;
```

#### Integration with `src/client/projection/frame-adapter.ts`
At line 105 of `frame-adapter.ts`, replace the unconditional `resolveOutOfBoundsVisual` with:
```typescript
      if (worldX < 0 || worldX >= grid.width || worldY < 0 || worldY >= grid.height) {
        const lookaheadCell = resolveContinuousLookaheadCell(
          state, activeStratum, worldX, worldY, grid.width, grid.height, vx, vy,
        );
        if (lookaheadCell) {
          cells.push(lookaheadCell);
          continue;
        }
        const oobVisual = resolveOutOfBoundsVisual(worldX, worldY, grid.width, grid.height, state.turnCount);
        cells.push({
          x: vx, y: vy, worldX, worldY, visual: oobVisual,
          layers: buildOutOfBoundsLayers(oobVisual),
          visible: false, explored: false, steamPressureKpa: 0, coalDustDensity: 0,
        });
        continue;
      }
```

---

### 3.2 Feature 16: Continuous Multi-Seed Walkability Test Suite (`tests/sim/continuous-worldgen.test.ts`)

- **File Path:** `tests/sim/continuous-worldgen.test.ts`
- **Target Line Count:** ~190–210 lines (Budget: <= 220 lines, Hard Ceiling: 250 lines).
- **Core Dependencies (Headless Simulation Only):**
  - `vitest` (`describe`, `expect`, `it`)
  - `src/schemas/primitives.schema.ts` (`BlueprintIdSchema`, `EntityIdSchema`, `Point2D`)
  - `src/sim/core/rng.ts` (`SeededRNG`)
  - `src/sim/core/world.ts` (`createInitialWorld`, `WorldState`)
  - `src/sim/spatial/grid.ts` (`createStratumGrid`, `getTileCell`, `isWithinBounds`)
  - `src/sim/spatial/generator.ts` (`generateVictorianDistrict`, `hasWalkablePath`)
  - `src/sim/spatial/urban-parcels.ts` (`subdivideProceduralParcels`, `UrbanGridSpec`)
  - `src/sim/spatial/district-boundaries.ts` (`computeDistrictBoundarySeams`, `applyBoundarySeamsToGrid`, `isEdgeSeamTraversable`)
  - `src/sim/systems/continuous-transit.system.ts` (`continuousTransitSystem`)

#### Detailed Test Block Plan

```typescript
describe('Feature 16: Continuous Multi-Seed Walkability & Seam Traversal Suite', () => {

  describe('1. Multi-Block Parcel Subdivider Determinism & Geometric Validity', () => {
    it('subdivides arbitrary dimensions deterministically with non-overlapping parcels and corridor clearance', () => {
      const dimensions = [
        { width: 48, height: 36, minParcels: 6 },
        { width: 64, height: 48, minParcels: 8 },
        { width: 96, height: 72, minParcels: 12 },
      ];

      for (const dim of dimensions) {
        const rngA = new SeededRNG(4242);
        const rngB = new SeededRNG(4242);
        const spec: UrbanGridSpec = { width: dim.width, height: dim.height };
        const resA = subdivideProceduralParcels(spec, rngA);
        const resB = subdivideProceduralParcels(spec, rngB);

        // Determinism invariant
        expect(resA.parcels.length).toBe(resB.parcels.length);
        expect(resA.parcels.length).toBeGreaterThanOrEqual(dim.minParcels);
        expect(JSON.stringify(resA.parcels)).toBe(JSON.stringify(resB.parcels));

        // Geometric bounds & non-overlapping invariant
        for (let i = 0; i < resA.parcels.length; i++) {
          const p1 = resA.parcels[i]!;
          expect(p1.bounds.x1).toBeLessThan(p1.bounds.x2);
          expect(p1.bounds.y1).toBeLessThan(p1.bounds.y2);
          expect(p1.bounds.x1).toBeGreaterThanOrEqual(1);
          expect(p1.bounds.x2).toBeLessThanOrEqual(dim.width - 2);
          expect(p1.bounds.y1).toBeGreaterThanOrEqual(1);
          expect(p1.bounds.y2).toBeLessThanOrEqual(dim.height - 2);

          // Corridor clearance
          expect(p1.bounds.y1 > resA.avenueCorridor.y2 || p1.bounds.y2 < resA.avenueCorridor.y1).toBe(true);

          for (let j = i + 1; j < resA.parcels.length; j++) {
            const p2 = resA.parcels[j]!;
            const overlaps = !(p1.bounds.x2 < p2.bounds.x1 || p1.bounds.x1 > p2.bounds.x2 ||
                               p1.bounds.y2 < p2.bounds.y1 || p1.bounds.y1 > p2.bounds.y2);
            expect(overlaps).toBe(false);
          }
        }
      }
    });
  });

  describe('2. Edge Seam Alignment & Open Thoroughfare Continuity Across Neighbors', () => {
    it('verifies thoroughfare opening reciprocity and movement traversability across planar neighbors', () => {
      const spitalfieldsId = BlueprintIdSchema.parse('district_spitalfields_soot_works');
      const limehouseId = BlueprintIdSchema.parse('district_limehouse_docks');
      const whitechapelId = BlueprintIdSchema.parse('district_whitechapel_ward');
      const belgraviaId = BlueprintIdSchema.parse('district_belgravia_brass_spires');

      const W = 48, H = 36;
      const seamsSpital = computeDistrictBoundarySeams(spitalfieldsId, W, H);
      const seamsLime = computeDistrictBoundarySeams(limehouseId, W, H);
      const seamsWhite = computeDistrictBoundarySeams(whitechapelId, W, H);
      const seamsBelg = computeDistrictBoundarySeams(belgraviaId, W, H);

      // East of Spitalfields <-> West of Limehouse (Canal Bridge)
      const spitEast = seamsSpital.east.find((s) => s.seamType === 'CANAL_BRIDGE');
      const limeWest = seamsLime.west.find((s) => s.seamType === 'CANAL_BRIDGE');
      expect(spitEast).toBeDefined();
      expect(limeWest).toBeDefined();
      expect(spitEast!.startCoord).toBe(limeWest!.startCoord);
      expect(spitEast!.endCoord).toBe(limeWest!.endCoord);

      // West of Spitalfields <-> East of Whitechapel (Open Street)
      const spitWest = seamsSpital.west.find((s) => s.seamType === 'OPEN_STREET');
      const whiteEast = seamsWhite.east.find((s) => s.seamType === 'OPEN_STREET');
      expect(spitWest).toBeDefined();
      expect(whiteEast).toBeDefined();
      expect(spitWest!.startCoord).toBe(whiteEast!.startCoord);
      expect(spitWest!.endCoord).toBe(whiteEast!.endCoord);

      // North of Spitalfields <-> South of Belgravia (Viaduct Arch)
      const spitNorth = seamsSpital.north.find((s) => s.seamType === 'VIADUCT_ARCH');
      const belgSouth = seamsBelg.south.find((s) => s.seamType === 'VIADUCT_ARCH');
      expect(spitNorth).toBeDefined();
      expect(belgSouth).toBeDefined();
      expect(spitNorth!.startCoord).toBe(belgSouth!.startCoord);
      expect(spitNorth!.endCoord).toBe(belgSouth!.endCoord);

      // Traversability verification on applied grid
      let grid = createStratumGrid('STREET', W, H);
      grid = applyBoundarySeamsToGrid(grid, seamsSpital);
      for (let y = spitEast!.startCoord; y <= spitEast!.endCoord; y++) {
        const cell = getTileCell(grid, W - 1, y);
        expect(cell?.blocksMovement).toBe(false);
      }
    });
  });

  describe('3. Seamless Continuous Transit Coordinate Translation & Companion Preservation', () => {
    it('translates coordinates across border seams without gates and preserves companions', () => {
      const world = createInitialWorld({ seed: 777, width: 48, height: 36 });
      const playerId = EntityIdSchema.parse('actor_player');
      const compId = EntityIdSchema.parse('npc_companion_test');

      // Setup companion adjacent to player
      const stateWithComp: WorldState = {
        ...world,
        entities: {
          ...world.entities,
          [compId]: {
            id: compId,
            name: 'Pneumatic Automaton Hound',
            visual: { glyph: 'd', fgPrimary: '#D4AF37', fgSecondary: '#A68019', bgColor: '#0A0D0E', shaderFlags: [] },
            position: { x: 46, y: 18, stratum: 'STREET', blocksMovement: true, blocksSight: false },
            aiController: { archetype: 'CANINE_AUTOMATON', hostility: 'PEACEFUL', preferredRange: 1, companionOfActorId: playerId },
          },
          [playerId]: {
            ...world.entities[playerId]!,
            position: { x: 47, y: 18, stratum: 'STREET', blocksMovement: true, blocksSight: false },
          },
        },
      };

      // Traverse East across boundary seam (x = 47 stepping to 48 -> into Limehouse)
      const result = continuousTransitSystem(stateWithComp, playerId, { x: 48, y: 18 });
      expect(result.state.currentDistrictId).toBe('district_limehouse_docks');

      // Player coordinate translation (x wraps to 1, y preserved)
      const newPlayer = result.state.entities[playerId];
      expect(newPlayer?.position?.x).toBe(1);
      expect(newPlayer?.position?.y).toBe(18);

      // Companion preserved and placed adjacent
      const newComp = result.state.entities[compId];
      expect(newComp).toBeDefined();
      expect(newComp?.position?.stratum).toBe('STREET');
      const dist = Math.max(Math.abs(newComp!.position!.x - 1), Math.abs(newComp!.position!.y - 18));
      expect(dist).toBeLessThanOrEqual(2);

      // Event log recording
      expect(result.events.some((e) => e.type === 'DISTRICT_SEAM_TRAVERSED')).toBe(true);
      expect(result.events.some((e) => e.type === 'COMPANION_TRANSIT_PRESERVED')).toBe(true);
    });
  });

  describe('4. Architectural Template Hydration Across 25 Unseen Seeds', () => {
    it('guarantees unbroken walkability between central plaza and all doorways & compass seams', () => {
      const SEED_START = 8001;
      const SEED_COUNT = 25;

      for (let i = 0; i < SEED_COUNT; i++) {
        const seed = SEED_START + i;
        const baseWorld = createInitialWorld({ seed, width: 48, height: 36 });
        const { state, landmarks } = generateVictorianDistrict(baseWorld);
        const streetGrid = state.strata.STREET!;

        // Plaza center hub
        const hub = landmarks.streetManhole;

        // Path to compass boundary seams
        expect(hasWalkablePath(streetGrid, hub, landmarks.westGate)).toBe(true);
        expect(hasWalkablePath(streetGrid, hub, landmarks.eastGate)).toBe(true);
        if (landmarks.northGate) expect(hasWalkablePath(streetGrid, hub, landmarks.northGate)).toBe(true);
        if (landmarks.southGate) expect(hasWalkablePath(streetGrid, hub, landmarks.southGate)).toBe(true);

        // Path to key building landmarks
        expect(hasWalkablePath(streetGrid, hub, landmarks.foundryBoiler)).toBe(true);
        expect(hasWalkablePath(streetGrid, hub, landmarks.artificerWorkbench)).toBe(true);
        expect(hasWalkablePath(streetGrid, hub, landmarks.workshopDoor)).toBe(true);

        // Zero NaN values invariant
        for (let y = 0; y < streetGrid.height; y++) {
          for (let x = 0; x < streetGrid.width; x++) {
            const cell = getTileCell(streetGrid, x, y);
            expect(cell).toBeDefined();
            expect(cell!.steamPressureKpa).not.toBeNaN();
            expect(cell!.coalDustDensity).not.toBeNaN();
          }
        }
      }
    });
  });
});
```

---

## 4. Caveats

1. **Read-Only Scope**:
   - As a read-only technical explorer, no source code in `src/` or tests in `tests/` were modified. All implementations and test files are to be authored by implementation agents during Milestone 3 execution turns.
2. **Dynamic Chunk Streaming Coexistence**:
   - The continuous lookahead projection cache is a client presentation helper and does not alter the simulation's `ChunkStreamingLedger`. Chunks in the active simulation continue to be governed by `chunk-streamer.ts`.
3. **Multi-Stratum Height Seam Offsets**:
   - For vertical stratum differences (e.g. Belgravia Spires at elevation +40m relative to Spitalfields Street level at 0m), the continuous projection displays the Viaduct Colonnade arches on the Street stratum. Spire-to-Spire continuous lookahead assumes matching aerial elevation.

---

## 5. Conclusion

1. **Feature 15 (`continuous-projection.ts`)**: Solves the black void edge artifact by translating out-of-bounds coordinates into planar neighbor space, looking up cached/dormant stratum grids, and rendering authentic neighbor cityscape with `alpha: 0.65` atmospheric depth fogging. It is purely read-only, takes ~160 lines (target <= 180), and requires an 8-line hook in `frame-adapter.ts`.
2. **Feature 16 (`continuous-worldgen.test.ts`)**: Provides a complete, deterministic, 4-block Vitest simulation suite (~205 lines, target <= 220). It rigorously validates multi-block parcel subdividing, edge seam reciprocity, continuous transit coordinate translation, companion preservation, and 25-seed template hydration with 100% pathfinding connectivity and zero client imports.

---

## 6. Verification Method

### 6.1 Independent Verification Commands
Once Feature 15 and Feature 16 are implemented:

1. **Execute Feature 16 Test Suite Directly**:
   ```bash
   npx vitest run tests/sim/continuous-worldgen.test.ts
   ```
   *Expected Outcome*: All 4 test blocks pass with 0 failures across all 25 seeds.

2. **Execute Full Repository Verification Gate**:
   ```bash
   npm run verify
   ```
   *Expected Outcome*:
   - Typecheck (`tsc --noEmit`): 0 errors.
   - Boundary checks (`check-boundaries.ts`): 0 errors, all new/modified files <= 250 lines.
   - Data validation (`validate-data.ts`): 0 errors.
   - Headless simulation test suite: 100% passing across all 128+ test suites.
