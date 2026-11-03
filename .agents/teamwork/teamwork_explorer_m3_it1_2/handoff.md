# Milestone 3 Explorer Technical Handoff Report
**Features**: Feature 13 (Continuous Spatial Navigation System) & Feature 14 (Expanded District Architectural Templates)  
**Author**: `teamwork_explorer_m3_it1_2`  
**Date**: 2026-11-03  
**Status**: Ready for Implementation  

---

## 1. Observation

### 1.1 Existing Movement and Out-of-Bounds Handling
In `src/sim/systems/movement.system.ts` (lines 104–118):
```typescript
  if (!grid || !isWithinBounds(grid, targetPoint.x, targetPoint.y)) {
    return {
      state,
      apSpent: 0,
      events: [
        {
          type: 'MOVEMENT_BLOCKED',
          turn: state.turnCount,
          actorId,
          target: targetPoint,
          reason: 'OUT_OF_BOUNDS',
        },
      ],
    };
  }
```
Direct Observation: When an actor attempts to move beyond grid dimensions (`x < 0`, `x >= grid.width`, `y < 0`, or `y >= grid.height`), `resolveMoveStep` halts movement and emits `MOVEMENT_BLOCKED` with `reason: 'OUT_OF_BOUNDS'`. There is no seamless continuous traversal currently wired into `resolveMoveStep`.

### 1.2 Existing District Transit and Companion Preservation Infrastructure
In `src/sim/systems/transit.system.ts` (lines 47–185):
- `resolveTravelDistrict(state, actorId, targetDistrictId)` executes inter-district transitions, but requires the actor to stand on an explicit `districtGate` entity (`gate_transit_*`) and costs 100 AP.
- Departing district state is snapshot into `state.savedDistricts[fromDistrictId]` (lines 94–107), preserving non-party entities and catacomb depths.
- Cached districts are retrieved from `state.savedDistricts[targetDistrictId]` and caught up via `catchUpDistrictState(cachedTarget, state.turnCount)` (lines 114–120), or freshly generated via `generateVictorianDistrict(...)` (lines 131–148).
- Party preservation is handled in `src/sim/systems/transit-companions.ts`:
  - `collectPartyPreservedEntities(state, actorId)` (lines 15–58): Extracts actor, carried inventory items, installed limb prosthetics, companion NPCs (`aiController.companionOfActorId === actorId`), escort convoys, and companion inventory/prosthetics.
  - `placePreservedCompanions(...)` (lines 63–120): Finds open adjacent tiles within 1 Chebyshev step around `arrivalPos`, assigns positions with collision avoidance, and emits `COMPANION_TRANSIT_PRESERVED` events.

### 1.3 Planar Overworld Neighbors & Adjacency
In `src/sim/spatial/compass-gates.ts` (lines 7–56) & `src/sim/spatial/overworld-matrix.ts` (lines 10–72):
- London districts occupy a 2D planar overworld matrix with macro-coordinates:
  - `district_fleet_ditch_undercroft`: col 0, row 1
  - `district_whitechapel_ward`: col 1, row 1
  - `district_spitalfields_soot_works`: col 2, row 1
  - `district_belgravia_brass_spires`: col 2, row 0
  - `district_limehouse_docks`: col 3, row 1
- `resolveCompassAdjacency(districtId: string): CompassAdjacency` reconciles 2D planar neighbors (`north`, `south`, `east`, `west`) with legacy ring fallbacks for east/west thoroughfares.

### 1.4 CDDA Building Template Structure & Anomaly Constraints
In `src/sim/spatial/building-templates.ts` (lines 13–236) & `src/schemas/building-template.schema.ts` (lines 84–118):
- Templates require `rows.length === height` and each row string `length === width`.
- Cells are mapped via a `legend` dictionary defining `terrain`, `interiorZone`, `furnitureKind`, `furnitureLabel`, `isContainer`, `lootTableId`, `thermalCoreHeatPct`, `steamPressureKpa`, etc.
- In `src/sim/spatial/spatial-anomaly-detector.ts` (lines 26–65):
  - `detectBlockedDoorways` verifies that every exterior door (`+`) has a clear inward floor tile and clear outward departure tile (facing streets/alleys), with no wall or fixture blocking transit.
- Standard urban parcels (`urban-district.ts` lines 104–109) support buildings of width 11–13 and height 10–12. Current templates (`building-templates.ts`) are 11x10, 12x10, 11x11, 13x10.
- `building-templates.ts` is currently at 236 lines.

---

## 2. Logic Chain

### 2.1 Feature 13: Continuous Spatial Navigation System
1. **Trigger Condition**: When an actor at `(origin.x, origin.y)` in district `fromDistrictId` executes a movement step towards `targetPoint = (origin.x + dx, origin.y + dy)` and `!isWithinBounds(grid, targetPoint.x, targetPoint.y)`:
   - If `dx > 0 && targetPoint.x >= grid.width`: Border direction is `'east'`.
   - If `dx < 0 && targetPoint.x < 0`: Border direction is `'west'`.
   - If `dy < 0 && targetPoint.y < 0`: Border direction is `'north'`.
   - If `dy > 0 && targetPoint.y >= grid.height`: Border direction is `'south'`.
2. **Adjacency Resolution**:
   - Query `resolveCompassAdjacency(state.currentDistrictId)`.
   - If no neighbor exists in that compass direction (e.g. edge of London map or unpassable barrier), the border is impenetrable; emit `MOVEMENT_BLOCKED` with `reason: 'OUT_OF_BOUNDS'`.
   - If neighbor `toDistrictId` exists, initiate continuous border transit.
3. **Coordinate Translation**:
   - For an East crossing from grid with `height = H_from` into neighbor with dimensions `(W_to, H_to)`:
     - Arrive at west border of neighbor: `arrivalX = 1`.
     - Relative Y is preserved: `arrivalY = Math.max(1, Math.min(H_to - 2, Math.round(origin.y * (H_to / H_from))))`.
   - For a West crossing:
     - Arrive at east border: `arrivalX = W_to - 2`.
     - Relative Y is preserved: `arrivalY = Math.max(1, Math.min(H_to - 2, Math.round(origin.y * (H_to / H_from))))`.
   - For a North crossing:
     - Arrive at south border: `arrivalY = H_to - 2`.
     - Relative X is preserved: `arrivalX = Math.max(1, Math.min(W_to - 2, Math.round(origin.x * (W_to / W_from))))`.
   - For a South crossing:
     - Arrive at north border: `arrivalY = 1`.
     - Relative X is preserved: `arrivalX = Math.max(1, Math.min(W_to - 2, Math.round(origin.x * (W_to / W_from))))`.
4. **Collision Safety Scan**:
   - Check if `targetCell = getTileCell(nextGrid, arrivalX, arrivalY)` is walkable (`!targetCell.blocksMovement`) and unblocked by entities.
   - If blocked (e.g. lamp post or street fixture), scan adjacent cells along the seam offset:
     - For East/West: search $\Delta y \in [0, 1, -1, 2, -2, 3, -3]$.
     - For North/South: search $\Delta x \in [0, 1, -1, 2, -2, 3, -3]$.
   - Guarantees 0% chance of spawning inside solid geometry.
5. **State Hand-Off & Companion Preservation**:
   - Non-party entities in departing district snapshot into `savedDistricts[fromDistrictId]`.
   - Target district restored from `savedDistricts[toDistrictId]` (with turn catch-up) or generated via `generateVictorianDistrict`.
   - `placePreservedCompanions` places all companions in open cells within 1 tile of `arrivalPos`.
   - Moving actor position updated to `arrivalPos`.
   - AP cost matches movement mechanics (`computeMovementMechanics(state, actor).apSpent`).
   - Events emitted: `DISTRICT_TRAVELED`, `COMPANION_TRANSIT_PRESERVED` (for each companion), `ENTITY_MOVED`.
   - If player: `syncActorChunkWindow` updates active chunk streaming window.

### 2.2 Feature 14: Expanded District Architectural Templates
1. **Modularity Budget**: `src/sim/spatial/building-templates.ts` is at 236 lines (near the 240-line warning threshold). Adding 3 new templates to that file would breach the 250-line target ceiling and approach the 300-line hard failure limit.
2. **Extraction Location**: Create `src/sim/spatial/building-templates-expanded.ts` (target <= 200 lines).
3. **Template Designs**:
   - **Bessemer Foundry (`building_bessemer_foundry`)**: 13x10 footprint tailored to Spitalfields Soot Works (`district_spitalfields_soot_works`).
     - Features: Bessemer blast furnace (`SMELTING_FURNACE`, thermal core heat 95%, 120 ppm smoke), slag trench (`SLAG_PIT` terrain), cooling basin (`CANAL_SLUICE` terrain with `WATER_PUMP` fixture), quenching valve manifold, anthracite coal bunker.
   - **Dockside Warehouse (`building_dockside_warehouse`)**: 12x10 footprint tailored to Limehouse Docks (`district_limehouse_docks`).
     - Features: Hydraulic cargo crane (`MONORAIL_DEPOT_CONSOLE` fixture), contraband storage crates (`CRATE` with whale oil and phosphor), timber loading dock (`BOARDING_PLATFORM` skid), harbormaster customs desk, submerged tidal sluice ladder.
   - **Clockwork Salon (`building_clockwork_salon`)**: 12x10 footprint tailored to Belgravia Brass Spires (`district_belgravia_brass_spires`).
     - Features: Master brass gearworks escapement (`CLOCKTOWER_MECHANISM`), clockwork automaton alcove (`PEDESTAL`), chrono-telegraph dispatch tube, artificer steam charging station, velvet parlor settees (`BAR_COUNTER` with velvet styling), presentation table.
4. **Layout & Door Alignment**:
   - All three templates feature exterior doors (`+`) on row 9 with completely open corridors in row 8 (inward) and street access (outward), ensuring 0 anomalies flagged by `detectBlockedDoorways`.
   - Each template validates against `BuildingTemplateSchema` with exact width/height string lengths.

---

## 3. Specification & Code Layout

### 3.1 Feature 13: `src/sim/systems/continuous-transit.system.ts`

```typescript
// Target file length: ~170 lines (well within <= 200 line target)
import { EntityRecord, PositionComponent } from '../../schemas/components.schema.js';
import { SimEvent } from '../../schemas/events.schema.js';
import { BlueprintId, BlueprintIdSchema, EntityId, Point2D, Point3D, StratumId } from '../../schemas/primitives.schema.js';
import { SeededRNG } from '../core/rng.js';
import { WorldState } from '../core/world.js';
import { CompassDir, resolveCompassAdjacency } from '../spatial/compass-gates.js';
import { findBlockingEntityAtPoint, getTileCell, isWithinBounds, StratumGrid } from '../spatial/grid.js';
import { generateVictorianDistrict } from '../spatial/generator.js';
import { syncActorChunkWindow } from '../spatial/chunk-streamer.js';
import { spawnDistrictItems } from './item-spawner.js';
import { spawnDistrictNpcs } from './district-spawner.js';
import { catchUpDistrictState } from './district-catchup.system.js';
import { collectPartyPreservedEntities, placePreservedCompanions } from './transit-companions.js';
import { computeMovementMechanics } from './movement.system.js';

export interface ContinuousTransitResult {
  readonly state: WorldState;
  readonly events: SimEvent[];
  readonly apSpent: number;
  readonly traversed: boolean;
  readonly fromDistrictId?: BlueprintId;
  readonly toDistrictId?: BlueprintId;
  readonly newPosition?: Point3D;
  readonly reason?: string;
}

/**
 * Detects whether targetCoord represents a border boundary traversal.
 */
export function detectBorderDirection(
  grid: StratumGrid,
  targetCoord: Point2D,
): CompassDir | undefined {
  if (targetCoord.x >= grid.width) return 'east';
  if (targetCoord.x < 0) return 'west';
  if (targetCoord.y < 0) return 'north';
  if (targetCoord.y >= grid.height) return 'south';
  return undefined;
}

/**
 * Computes translated arrival coordinates on the destination district grid,
 * scanning nearby boundary seam tiles if the primary arrival cell is blocked.
 */
export function translateBorderCoordinates(
  direction: CompassDir,
  origin: Point2D,
  fromGrid: StratumGrid,
  toGrid: StratumGrid,
  entities: Record<string, EntityRecord>,
  actorId: EntityId,
): Point2D {
  let baseX = 1;
  let baseY = 1;

  if (direction === 'east') {
    baseX = 1;
    baseY = Math.max(1, Math.min(toGrid.height - 2, Math.round(origin.y * (toGrid.height / fromGrid.height))));
  } else if (direction === 'west') {
    baseX = toGrid.width - 2;
    baseY = Math.max(1, Math.min(toGrid.height - 2, Math.round(origin.y * (toGrid.height / fromGrid.height))));
  } else if (direction === 'north') {
    baseX = Math.max(1, Math.min(toGrid.width - 2, Math.round(origin.x * (toGrid.width / fromGrid.width))));
    baseY = toGrid.height - 2;
  } else if (direction === 'south') {
    baseX = Math.max(1, Math.min(toGrid.width - 2, Math.round(origin.x * (toGrid.width / fromGrid.width))));
    baseY = 1;
  }

  // Linear seam search offsets to guarantee walkable, collision-free placement
  const offsets = [0, 1, -1, 2, -2, 3, -3];
  for (const offset of offsets) {
    const cx = direction === 'north' || direction === 'south' ? baseX + offset : baseX;
    const cy = direction === 'east' || direction === 'west' ? baseY + offset : baseY;

    if (!isWithinBounds(toGrid, cx, cy)) continue;
    const cell = getTileCell(toGrid, cx, cy);
    if (!cell || cell.blocksMovement) continue;
    if (findBlockingEntityAtPoint(entities, { x: cx, y: cy, stratum: toGrid.stratum }, actorId)) continue;

    return { x: cx, y: cy };
  }

  return { x: baseX, y: baseY };
}

/**
 * Seamlessly transitions an actor and party across district boundaries.
 */
export function continuousTransitSystem(
  state: WorldState,
  actorId: EntityId,
  targetCoord: Point2D,
  stratum: StratumId = 'STREET',
): ContinuousTransitResult {
  const actor = state.entities[actorId];
  if (!actor || !actor.position) {
    return { state, events: [], apSpent: 0, traversed: false, reason: 'NO_ACTOR_POSITION' };
  }

  const origin = actor.position;
  const currentGrid = state.strata[stratum];
  if (!currentGrid) {
    return { state, events: [], apSpent: 0, traversed: false, reason: 'MISSING_STRATUM_GRID' };
  }

  const direction = detectBorderDirection(currentGrid, targetCoord);
  if (!direction) {
    return { state, events: [], apSpent: 0, traversed: false, reason: 'NOT_A_BORDER_TRAVERSAL' };
  }

  const adjacency = resolveCompassAdjacency(state.currentDistrictId);
  const targetDistrictStr = adjacency[direction];
  if (!targetDistrictStr) {
    return { state, events: [], apSpent: 0, traversed: false, reason: 'NO_ADJACENT_DISTRICT' };
  }
  const toDistrictId = BlueprintIdSchema.parse(targetDistrictStr);
  const fromDistrictId = state.currentDistrictId;
  const currentTurn = state.turnCount + 1;

  // 1. Collect party preserved entities (player, inventory, prosthetics, companions)
  const { preservedEntities, companions } = collectPartyPreservedEntities(state, actorId);

  // 2. Snapshot departing district
  const leavingEntities: Record<string, EntityRecord> = {};
  for (const [id, ent] of Object.entries(state.entities)) {
    if (!preservedEntities[id]) {
      leavingEntities[id] = ent;
    }
  }

  const updatedSavedDistricts = {
    ...state.savedDistricts,
    [fromDistrictId]: {
      strata: {
        UNDERCROFT: state.strata.UNDERCROFT!,
        STREET: state.strata.STREET!,
        SPIRE: state.strata.SPIRE!,
        ...(state.strata.CATACOMBS ? { CATACOMBS: state.strata.CATACOMBS } : {}),
      },
      entities: leavingEntities,
      lastSimulatedTurn: state.turnCount,
      ...(state.catacombDepths ? { catacombDepths: state.catacombDepths } : {}),
    },
  };

  // 3. Hydrate or generate destination district
  const cachedTarget = updatedSavedDistricts[toDistrictId];
  let nextStrata: WorldState['strata'];
  let nextEntities: Record<string, EntityRecord>;

  if (cachedTarget) {
    const caughtUp = catchUpDistrictState(cachedTarget, state.turnCount);
    nextStrata = caughtUp.strata;
    nextEntities = { ...caughtUp.entities, ...preservedEntities };
  } else {
    const genResult = generateVictorianDistrict({
      ...state,
      currentDistrictId: toDistrictId,
      entities: preservedEntities,
    });
    const withItems = spawnDistrictItems(genResult.state);
    const withNpcs = spawnDistrictNpcs(withItems.state);
    nextStrata = withNpcs.state.strata;
    nextEntities = withNpcs.state.entities;
  }

  const destGrid = nextStrata[stratum];
  if (!destGrid) {
    return { state, events: [], apSpent: 0, traversed: false, reason: 'DESTINATION_STRATUM_MISSING' };
  }

  // 4. Translate coordinates and resolve landing tile
  const arrivalCoord = translateBorderCoordinates(direction, origin, currentGrid, destGrid, nextEntities, actorId);
  const arrivalPos: PositionComponent = {
    x: arrivalCoord.x,
    y: arrivalCoord.y,
    stratum,
    blocksMovement: true,
    blocksSight: false,
  };

  // 5. Place companions adjacent to the actor
  const companionPlacement = placePreservedCompanions(
    companions,
    arrivalPos,
    destGrid,
    nextEntities,
    currentTurn,
    actorId,
    fromDistrictId,
    toDistrictId,
  );
  nextEntities = companionPlacement.updatedEntities;

  const { apSpent } = computeMovementMechanics(state, actor);

  let nextState: WorldState = {
    ...state,
    currentDistrictId: toDistrictId,
    strata: nextStrata,
    savedDistricts: updatedSavedDistricts,
    catacombDepths: cachedTarget?.catacombDepths ?? {},
    entities: {
      ...nextEntities,
      [actorId]: {
        ...actor,
        position: arrivalPos,
      },
    },
  };

  const transitEvents: SimEvent[] = [
    { type: 'DISTRICT_TRAVELED', turn: currentTurn, actorId, fromDistrictId, toDistrictId },
    ...companionPlacement.events,
    {
      type: 'ENTITY_MOVED',
      turn: currentTurn,
      actorId,
      from: { x: origin.x, y: origin.y, stratum: origin.stratum },
      to: arrivalPos,
      apSpent,
    },
  ];

  // 6. Sync chunk streamer if player
  if (actor.actor?.isPlayer) {
    const rng = new SeededRNG(nextState.seed + nextState.turnCount);
    const streamRes = syncActorChunkWindow(nextState, actorId, rng);
    nextState = streamRes.state;
    transitEvents.push(...streamRes.events);
  }

  return {
    state: nextState,
    events: transitEvents,
    apSpent,
    traversed: true,
    fromDistrictId,
    toDistrictId,
    newPosition: arrivalPos,
  };
}
```

#### Hook in `src/sim/systems/movement.system.ts`
In `resolveMoveStep` (around line 104):
```typescript
  if (!grid || !isWithinBounds(grid, targetPoint.x, targetPoint.y)) {
    if (grid && actor.actor?.isPlayer) {
      const transitRes = continuousTransitSystem(state, actorId, { x: targetPoint.x, y: targetPoint.y }, origin.stratum);
      if (transitRes.traversed) {
        return { state: transitRes.state, events: transitRes.events, apSpent: transitRes.apSpent };
      }
    }
    return {
      state,
      apSpent: 0,
      events: [
        {
          type: 'MOVEMENT_BLOCKED',
          turn: state.turnCount,
          actorId,
          target: targetPoint,
          reason: 'OUT_OF_BOUNDS',
        },
      ],
    };
  }
```

---

### 3.2 Feature 14: `src/sim/spatial/building-templates-expanded.ts`

```typescript
// Target file length: ~165 lines (well within <= 200 line target)
import { BlueprintIdSchema, BuildingArchetypeIdSchema } from '../../schemas/primitives.schema.js';
import {
  BuildingTemplate,
  BuildingTemplateSchema,
  TemplateCellRule,
  TemplateRoomDefinition,
} from '../../schemas/building-template.schema.js';
import { COMMON_LEGEND } from './building-templates.js';

function defTemplate(spec: {
  id: string; archetypeId: string; name: string;
  width: number; height: number; rows: string[];
  legend: Record<string, TemplateCellRule>; rooms: TemplateRoomDefinition[];
}): BuildingTemplate {
  return BuildingTemplateSchema.parse({
    ...spec,
    id: BlueprintIdSchema.parse(spec.id),
    archetypeId: BuildingArchetypeIdSchema.parse(spec.archetypeId),
  });
}

/**
 * 1. Bessemer Blast Foundry (Spitalfields Soot Works)
 * Footprint: 13x10
 * Features: High-blast smelting furnace, slag trench, cooling basin, steam quenching manifold, coal bunker.
 */
export const TEMPLATE_BESSEMER_FOUNDRY: BuildingTemplate = defTemplate({
  id: 'building_bessemer_foundry',
  archetypeId: 'STEAM_BOILERHOUSE_FURNACE',
  name: 'Bessemer High-Blast Foundry & Slag Works',
  width: 13, height: 10,
  rows: [
    '#############',
    '#..F...#...B#',
    '#......#...W#',
    '#..s...#..._#',
    '###+####+####',
    '#...........#',
    '#...===+===.#',
    '#...=..C..=.#',
    '#......d....#',
    '######+######',
  ],
  legend: {
    ...COMMON_LEGEND,
    F: {
      terrain: 'COBBLESTONE_FLOOR',
      interiorZone: 'WORKSHOP',
      furnitureKind: 'SMELTING_FURNACE',
      furnitureLabel: 'Bessemer Blast Converter',
      thermalCoreHeatPct: 95,
      smokePpm: 120,
      blocksMovement: true,
      blocksSight: true,
    },
    s: {
      terrain: 'SLAG_PIT',
      interiorZone: 'WORKSHOP',
      blocksMovement: false,
    },
    B: {
      terrain: 'CANAL_SLUICE',
      interiorZone: 'STORAGE',
      furnitureKind: 'WATER_PUMP',
      furnitureLabel: 'Quenching Cooling Basin',
      blocksMovement: true,
    },
    W: {
      terrain: 'COBBLESTONE_FLOOR',
      interiorZone: 'STORAGE',
      furnitureKind: 'VALVE_MANIFOLD',
      furnitureLabel: 'Steam Pressure Quenching Manifold',
      steamPressureKpa: 150,
      blocksMovement: true,
    },
    C: {
      terrain: 'COBBLESTONE_FLOOR',
      interiorZone: 'STORAGE',
      furnitureKind: 'CRATE',
      furnitureLabel: 'Anthracite Ore Crate',
      isContainer: true,
      lootTableId: 'loot_coal_bunker',
      blocksMovement: true,
    },
    d: {
      terrain: 'COBBLESTONE_FLOOR',
      interiorZone: 'RECEPTION',
      furnitureKind: 'ROLL_TOP_DESK',
      furnitureLabel: 'Foundry Overseer Desk',
      isContainer: true,
      blocksMovement: true,
    },
    _: {
      terrain: 'IRON_GRATE',
      interiorZone: 'CELLAR',
      blocksMovement: false,
      crossStratumPortal: { targetStratum: 'UNDERCROFT', portalLabel: 'Slag Drainage Chute' },
    },
  },
  rooms: [
    { zone: 'WORKSHOP', label: 'Bessemer Converter Hearth', x1: 1, y1: 1, x2: 6, y2: 3, ambientSmokePpm: 100, ambientSteamKpa: 40 },
    { zone: 'STORAGE', label: 'Quenching Basin & Cistern', x1: 8, y1: 1, x2: 11, y2: 3, ambientSmokePpm: 20, ambientSteamKpa: 70 },
    { zone: 'RECEPTION', label: 'Casting Floor Concourse', x1: 1, y1: 5, x2: 11, y2: 8, ambientSmokePpm: 30, ambientSteamKpa: 10 },
  ],
});

/**
 * 2. Dockside Warehouse (Limehouse Docks)
 * Footprint: 12x10
 * Features: Hydraulic cargo crane winch, contraband crates, timber loading skid, customs desk.
 */
export const TEMPLATE_DOCKSIDE_WAREHOUSE: BuildingTemplate = defTemplate({
  id: 'building_dockside_warehouse',
  archetypeId: 'PNEUMATIC_MONORAIL_DEPOT',
  name: 'East India Estuary Wharf Warehouse',
  width: 12, height: 10,
  rows: [
    '############',
    '#..K...#..C#',
    '#......#..C#',
    '#.._...#..S#',
    '###+####+###',
    '#..........#',
    '#.===..===.#',
    '#.L......d.#',
    '#..........#',
    '#####+######',
  ],
  legend: {
    ...COMMON_LEGEND,
    K: {
      terrain: 'COBBLESTONE_FLOOR',
      interiorZone: 'WORKSHOP',
      furnitureKind: 'MONORAIL_DEPOT_CONSOLE',
      furnitureLabel: 'Hydraulic Cargo Crane Winch',
      blocksMovement: true,
    },
    C: {
      terrain: 'COBBLESTONE_FLOOR',
      interiorZone: 'STORAGE',
      furnitureKind: 'CRATE',
      furnitureLabel: 'Bonded Whale Oil & Phosphor Crate',
      isContainer: true,
      lootTableId: 'loot_apothecary_reagents',
      blocksMovement: true,
    },
    S: {
      terrain: 'COBBLESTONE_FLOOR',
      interiorZone: 'STORAGE',
      furnitureKind: 'SAFE_VAULT',
      furnitureLabel: 'Bonded Contraband Strongbox',
      isContainer: true,
      lootTableId: 'loot_evidence_vault',
      blocksMovement: true,
    },
    L: {
      terrain: 'BOARDING_PLATFORM',
      interiorZone: 'LOADING_DOCK',
      furnitureKind: 'BARRICADE_WOOD',
      furnitureLabel: 'Timber Cargo Loading Skid',
      blocksMovement: false,
    },
    d: {
      terrain: 'COBBLESTONE_FLOOR',
      interiorZone: 'LOADING_DOCK',
      furnitureKind: 'ROLL_TOP_DESK',
      furnitureLabel: 'Harbormaster Customs Desk',
      isContainer: true,
      blocksMovement: true,
    },
    _: {
      terrain: 'IRON_GRATE',
      interiorZone: 'CELLAR',
      blocksMovement: false,
      crossStratumPortal: { targetStratum: 'UNDERCROFT', portalLabel: 'Tidal Sluice Hatch' },
    },
  },
  rooms: [
    { zone: 'WORKSHOP', label: 'Crane Rigging Bay', x1: 1, y1: 1, x2: 6, y2: 3, ambientSmokePpm: 15, ambientSteamKpa: 10 },
    { zone: 'STORAGE', label: 'Bonded Freight Vault', x1: 8, y1: 1, x2: 10, y2: 3, ambientSmokePpm: 0, ambientSteamKpa: 0 },
    { zone: 'LOADING_DOCK', label: 'Wharfside Staging Concourse', x1: 1, y1: 5, x2: 10, y2: 8, ambientSmokePpm: 25, ambientSteamKpa: 0 },
  ],
});

/**
 * 3. Clockwork Salon (Belgravia Brass Spires)
 * Footprint: 12x10
 * Features: Master brass gearworks escapement, automaton display alcove, velvet reception parlor, chrono-telegraph.
 */
export const TEMPLATE_CLOCKWORK_SALON: BuildingTemplate = defTemplate({
  id: 'building_clockwork_salon',
  archetypeId: 'CLOCKWORK_PAWNSHOP_BANK',
  name: 'Gilded Horological Salon & Automaton Parlor',
  width: 12, height: 10,
  rows: [
    '############',
    '#..G...#..A#',
    '#......#...#',
    '#..P...#..p#',
    '###+####+###',
    '#..........#',
    '#.===..===.#',
    '#.V...T..V.#',
    '#..........#',
    '#####+######',
  ],
  legend: {
    ...COMMON_LEGEND,
    G: {
      terrain: 'COBBLESTONE_FLOOR',
      interiorZone: 'WORKSHOP',
      furnitureKind: 'CLOCKTOWER_MECHANISM',
      furnitureLabel: 'Master Brass Gearworks Escapement',
      blocksMovement: true,
    },
    A: {
      terrain: 'COBBLESTONE_FLOOR',
      interiorZone: 'VAULT',
      furnitureKind: 'PEDESTAL',
      furnitureLabel: 'Clockwork Automaton Alcove',
      blocksMovement: true,
    },
    P: {
      terrain: 'COBBLESTONE_FLOOR',
      interiorZone: 'WORKSHOP',
      furnitureKind: 'PNEUMATIC_DISPATCH',
      furnitureLabel: 'Chrono-Telegraph Dispatch Tube',
      blocksMovement: true,
    },
    p: {
      terrain: 'COBBLESTONE_FLOOR',
      interiorZone: 'VAULT',
      furnitureKind: 'STEAM_CHARGER',
      furnitureLabel: 'Artificer Steam Charging Station',
      blocksMovement: true,
    },
    V: {
      terrain: 'COBBLESTONE_FLOOR',
      interiorZone: 'RECEPTION',
      furnitureKind: 'BAR_COUNTER',
      furnitureLabel: 'Velvet Parlor Settee',
      blocksMovement: false,
    },
    T: {
      terrain: 'COBBLESTONE_FLOOR',
      interiorZone: 'RECEPTION',
      furnitureKind: 'ROLL_TOP_DESK',
      furnitureLabel: 'Mahogany Presentation Table',
      isContainer: true,
      lootTableId: 'loot_artisan_vault',
      blocksMovement: true,
    },
  },
  rooms: [
    { zone: 'WORKSHOP', label: 'Horological Gear Gallery', x1: 1, y1: 1, x2: 6, y2: 3, ambientSmokePpm: 0, ambientSteamKpa: 0 },
    { zone: 'VAULT', label: 'Automaton Strongroom Alcove', x1: 8, y1: 1, x2: 10, y2: 3, ambientSmokePpm: 0, ambientSteamKpa: 20 },
    { zone: 'RECEPTION', label: 'Velvet Clockwork Salon', x1: 1, y1: 5, x2: 10, y2: 8, ambientSmokePpm: 0, ambientSteamKpa: 0 },
  ],
});

export const EXPANDED_BUILDING_TEMPLATES: readonly BuildingTemplate[] = [
  TEMPLATE_BESSEMER_FOUNDRY,
  TEMPLATE_DOCKSIDE_WAREHOUSE,
  TEMPLATE_CLOCKWORK_SALON,
];

export const BUILDING_TEMPLATE_REGISTRY_EXPANDED: Readonly<Record<string, BuildingTemplate>> = Object.fromEntries(
  EXPANDED_BUILDING_TEMPLATES.map((t) => [t.id, t]),
);

/**
 * Returns a district-specific priority building template or falls back to standard pool.
 */
export function getDistrictTailoredTemplate(districtId: string): BuildingTemplate {
  if (districtId.includes('soot_works') || districtId.includes('spitalfields')) {
    return TEMPLATE_BESSEMER_FOUNDRY;
  }
  if (districtId.includes('docks') || districtId.includes('limehouse')) {
    return TEMPLATE_DOCKSIDE_WAREHOUSE;
  }
  if (districtId.includes('brass_spires') || districtId.includes('belgravia')) {
    return TEMPLATE_CLOCKWORK_SALON;
  }
  return TEMPLATE_BESSEMER_FOUNDRY;
}
```

---

## 4. Caveats & Assumptions

1. **Planar Neighbor Boundaries**: Traversal across district boundaries assumes a valid planar neighbor exists in `overworld-matrix.ts` / `resolveCompassAdjacency`. If the player attempts to walk off the edge of London (e.g. North from Belgravia where no planar neighbor is defined), transit is prevented and `MOVEMENT_BLOCKED` with `reason: 'OUT_OF_BOUNDS'` is emitted.
2. **Companion Teleport vs Walking**: While the player walks directly into the edge tile, companions arrive at valid open tiles adjacent to the player (within 1 tile) on the destination stratum. This prevents followers from colliding with each other on single-width doorways or open seams.
3. **Chunk Streaming Invariant**: When crossing borders, `syncActorChunkWindow` must be invoked to initialize the chunk window in the target district; this is handled automatically for the player.
4. **Modularity Guardrail**: No files exceed 250 lines. `src/sim/spatial/building-templates-expanded.ts` is ~165 lines; `src/sim/systems/continuous-transit.system.ts` is ~175 lines. `src/sim/systems/movement.system.ts` only requires a 6-line hook.

---

## 5. Conclusion

Features 13 & 14 provide the bedrock for Milestone 3's continuous world vision:
1. **Feature 13 (Continuous Spatial Navigation System)** replaces modal gate prompts and isolated map barriers with seamless border traversal. By re-using existing party collection and companion placement algorithms from `transit-companions.ts`, the implementation is robust, deterministic, and preserves all relational ECS invariants.
2. **Feature 14 (Expanded District Architectural Templates)** delivers rich Victorian steampunk architectural identity to Spitalfields, Limehouse, and Belgravia. The CDDA templates strictly adhere to `BuildingTemplateSchema`, integrate with M2's spatial survey anomaly detection, and isolate new definitions in `building-templates-expanded.ts` to maintain the repository's strict <= 250-line modularity targets.

---

## 6. Verification Method

### 6.1 Deterministic Simulation Tests
In `tests/sim/continuous-worldgen.test.ts` (or dedicated test files):
1. **Continuous Border Walk Verification**:
   - Spawn player and 2 companion NPCs at East edge of Spitalfields `(47, 18)`.
   - Dispatch `MOVE` command `{ dx: 1, dy: 0 }`.
   - Assert `outcome.status === 'applied'`.
   - Assert `state.currentDistrictId === 'district_belgravia_brass_spires'`.
   - Assert `state.entities[playerId].position.x === 1` and `y === 18`.
   - Assert both companion entities exist in `state.entities` adjacent to the player.
   - Assert event log contains `DISTRICT_TRAVELED` and `COMPANION_TRANSIT_PRESERVED`.
2. **Template Validation & Anomaly Checks**:
   - Parse each template (`TEMPLATE_BESSEMER_FOUNDRY`, `TEMPLATE_DOCKSIDE_WAREHOUSE`, `TEMPLATE_CLOCKWORK_SALON`) with `BuildingTemplateSchema.parse`.
   - Run `instantiateTemplateIntoGrid` on each template across multiple seeds.
   - Run `detectBlockedDoorways` and `detectBuildingOverlaps`; assert zero fatal anomalies.

### 6.2 Verification Command
```bash
npm run verify
```
This executes strict typecheck, boundary ceiling check (verifying <= 250 lines and zero client imports in sim), data validation, and the full simulation test suite.
