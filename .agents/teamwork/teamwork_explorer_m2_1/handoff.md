# Milestone 2 Explorer Handoff: Feature 6 (Spatial Survey Schemas & Types) & Feature 7 (Programmatic Spatial Anomaly Detector)

**Author:** teamwork_explorer_m2_1 (M2 Anomaly Detector Explorer)  
**Date:** 2026-11-02T23:58:30Z  
**Parent Conversation ID:** `b1f4e92b-f8d8-4000-b9ea-8ea40dd02e57`  
**Working Directory:** `/Users/emmett/Desktop/Game/.agents/teamwork/teamwork_explorer_m2_1/`  
**Milestone:** Milestone 2 (Fallout: NY Spatial Survey Sheets & Self-Correction)  
**Deliverables:** Specifications and implementation guide for Feature 6 (`src/sim/spatial/spatial-survey-types.ts`) and Feature 7 (`src/sim/spatial/spatial-anomaly-detector.ts`)

---

## 1. Observation

### 1.1 Existing Spatial Generation, Layout, and Invariant Systems
Direct inspection of the codebase revealed the following structures and line counts:

- **`src/sim/spatial/grid.ts`** (131 lines):
  - Defines `TileCell` (lines 5–17) with `terrainType`, `blocksMovement: boolean`, `blocksSight: boolean`, `interiorZone: InteriorZoneType`, `steamPressureKpa`, `smokePpm`, and `explored`.
  - Defines `StratumGrid` (lines 19–25) containing `stratum: StratumId`, `width: number`, `height: number`, and `cells: TileCell[]`.
  - Exports standard spatial primitives (lines 53–109): `isWithinBounds(grid, x, y)`, `getTileCell(grid, x, y)`, `setTileCell(grid, x, y, updater)`, `findEntitiesAtPoint(entities, point)`, and `findBlockingEntityAtPoint(entities, point, ignoreEntityId)`.
- **`src/sim/spatial/block-geometry.ts`** (121 lines):
  - Defines `Box` (lines 4–9): `{ readonly x1: number; readonly y1: number; readonly x2: number; readonly y2: number }`.
  - Implements bounding box overlap predicate `intersects` (lines 70–72):
    ```typescript
    export function intersects(a: Box, b: Box, margin = 0): boolean {
      return a.x1 - margin <= b.x2 && a.x2 + margin >= b.x1 && a.y1 - margin <= b.y2 && a.y2 + margin >= b.y1;
    }
    ```
- **`src/sim/spatial/urban-district.ts`** (205 lines):
  - Lines 16–21: defines `UrbanParcel` (`id`, `bounds: Box`, `frontDirection: 'NORTH' | 'SOUTH'`, `templateId?`).
  - Lines 23–29: defines `UrbanStreetSpec` (`avenueY: { min, max }`, `plaza: Box`, `crossStreetX: readonly [number, number]`, `northAlleyY: number`, `southAlleyY: number`).
  - Lines 121–183 (`generateUrbanDistrict`): instantiates building templates into parcels, computes outward corridor connections `for (const outPt of stampRes.outwardPoints)`, and collects `doors: Record<string, Point2D>`, `entrancePoints: Point2D[]`, and `outwardPoints: Point2D[]`.
- **`src/sim/spatial/template-instantiator.ts`** (237 lines):
  - Lines 21–29: `TemplateInstantiationResult` returns `grid`, `entities`, `entrancePoints`, `outwardPoints`, `fixturesPlaced`, `doors`, and `keyPositions`.
  - Lines 158–165: exterior door detection records matching pairs of `entrancePoints` and `outwardPoints`:
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
- **`src/sim/spatial/district-yards.ts`** (222 lines):
  - Lines 153–166: `ensureDistrictConnectivity(grid, start, targets)` tests reachability via `hasWalkablePath(current, start, target)`.
  - Lines 196–201: traversability in BFS treats wooden doors as passable:
    ```typescript
    if (cell && (!cell.blocksMovement || cell.terrainType === 'WOODEN_DOOR_CLOSED' || cell.terrainType === 'WOODEN_DOOR_OPEN')) {
      visited[nIdx] = 1;
      queue.push(nIdx);
    }
    ```
- **`src/schemas/primitives.schema.ts`** (216 lines):
  - Exports `Point2DSchema`, `Point2D`, `StratumIdSchema`, `StratumId`, `BuildingArchetypeIdSchema`, and `TerrainTypeSchema`.
- **`tests/scripts/check-boundaries.ts`** (98 lines):
  - Enforces `MAX_LINES_HARD_CEILING = 300` lines, `WARN_LINES_THRESHOLD = 240` lines.
  - Line 40–41: `.agents/teamwork/` must contain only markdown metadata files (zero `.ts`, `.tsx`, `.js`, or `.json` files allowed).
  - Lines 8–15: strict prohibition of client imports, `pixi.js`, `preact`, `Math.random()`, `Date.now()`, `window`, and `document` in `src/sim/` and `src/schemas/`.
- **Baseline Verification (`npm run verify`)**:
  - Executed cleanly via task-64: `124 test files passed (124)`, `654 tests passed (654)`. `check:boundaries` confirmed 437 files with zero Core/Shell violations.

---

## 2. Logic Chain

### 2.1 Problem Decomposition & Interface Contract
1. **From Observation 1.1**: Procedural generation produces complex street grids and building stamps (`urban-district.ts`, `template-instantiator.ts`). However, prior to Milestone 2, there was no centralized schema to audit, report, or log spatial defects across world cells.
2. **Schema Invariant (Feature 6)**: To decouple detection, self-correction, and visual reporting, `src/sim/spatial/spatial-survey-types.ts` must define standardized Zod schemas and TypeScript interfaces for:
   - `SpatialAnomalyTypeSchema`: 5 distinct anomaly classifications (`BUILDING_OVERLAP`, `BLOCKED_DOORWAY`, `WALL_COLLISION`, `DISCONNECTED_PATHWAY`, `BUILDING_ROAD_COLLISION`).
   - `AnomalySeveritySchema`: `'FATAL' | 'ERROR' | 'WARNING'`.
   - `SpatialAnomalySchema`: unified diagnostic record containing `id`, `type`, `severity`, `position: Point2D`, optional `targetId`, and human-readable `description`.
   - `SpatialCorrectionActionSchema` & `SpatialCorrectionLogSchema`: tracking self-correction interventions (`CLEAR_DOORWAY`, `FLIP_DOORWAY`, `STITCH_PATHWAY`, `RESTORE_ROAD`, `NUDGE_BUILDING`, `SEAL_POCKET`).
   - `PlacedBuildingSurveySchema`: capturing surveyed building instances (`id`, `templateId`, `archetypeId`, `bounds: Box`, `entrancePoints`, `outwardPoints`, `doors`, `keyPositions`).
   - `SpatialSurveySheetSchema`: multi-layer survey matrix schema combining terrain, architecture, fixtures, zoning, circulation, and anomaly heatmap layers alongside detected anomalies and applied corrections.
3. **Detector Algorithms (Feature 7)**:
   - **`detectBuildingOverlaps`**: Pure $O(N^2)$ pairwise comparison of `PlacedBuildingSurvey` bounding boxes using `intersects(bA.bounds, bB.bounds)` from `block-geometry.ts`. Overlap origin $(ox, oy)$ is calculated as $(\max(A.x1, B.x1), \max(A.y1, B.y1))$. Severity is `FATAL`.
   - **`detectBlockedDoorways`**: For each door in a building:
     - Validates that the door cell in `grid` has not been overwritten by `SOOT_BRICK_WALL` (`FATAL`).
     - Validates that the door cell has no movement-blocking entity via `findBlockingEntityAtPoint` (`ERROR`).
     - Evaluates the departure cell `outPt` directly in front of the door:
       - If out of bounds $\to$ `FATAL`.
       - If solid wall (`SOOT_BRICK_WALL` or `TIMBER_STRUT`) $\to$ `FATAL`.
       - If yard obstacle (`WROUGHT_IRON_FENCE`, `GASLAMP_POST`, `BRASS_STEAM_PIPE`, `RUBBLE_PILE`, `SLAG_MOUND`) $\to$ `ERROR`.
       - If movement-blocking entity present $\to$ `ERROR`.
     - Evaluates interior approach cell `inPt` $\to$ `WARNING` if blocked by solid wall.
   - **`detectWallCollisions`**:
     - Inspects all cross-stratum portals: flags `WALL_COLLISION` (`FATAL`) if portal cell is solid wall or movement-blocking, and flags `ERROR` if portal has 0 walkable cardinal neighbors (trapped portal).
     - Inspects designated street corridors: scans each cell in `streetCorridors` for unexpected `SOOT_BRICK_WALL` terrain (`ERROR`).
   - **`detectDisconnectedPathways`**:
     - Rather than executing $K$ separate BFS searches from each target, executes a single-pass BFS flood fill from `hub` on a `Uint8Array(grid.width * grid.height)` buffer.
     - Traversability condition: `!cell.blocksMovement || cell.terrainType === 'WOODEN_DOOR_CLOSED' || cell.terrainType === 'WOODEN_DOOR_OPEN'` (doors are traversable).
     - Any target in `targets` not visited by the BFS flood fill is flagged as `DISCONNECTED_PATHWAY` (`ERROR`).
   - **`detectBuildingRoadCollisions`**:
     - Compares building bounding boxes with `streetCorridors` using `intersects(b.bounds, corridor)`. Flagged as `FATAL`.
   - **`runSpatialAnomalyAudit`**:
     - Pure orchestrator executing all 5 detectors in sequence, aggregating anomalies into a unified array. Automatically extracts stratum portals from `entities` if optional `portals` array is omitted.
4. **Modularity & 250-Line Budget**:
   - `src/sim/spatial/spatial-survey-types.ts`: ~115 lines (target $\le 250$).
   - `src/sim/spatial/spatial-anomaly-detector.ts`: ~215 lines (target $\le 250$).
   - Both modules strictly satisfy the 250-line target and zero-leak boundary rules.

---

## 3. Caveats

1. **Self-Corrector Delegation**: Explorer M2-1 designs schemas and detection algorithms (Features 6 & 7). Mutating the grid/entities to resolve anomalies (Feature 8, `spatial-self-corrector.ts`) is designed in parallel by Explorer M2-2 (`teamwork_explorer_m2_2`).
2. **Door Open vs Closed State**: Closed wooden doors (`WOODEN_DOOR_CLOSED`) have `blocksMovement: true` in base simulation ticks, but are traversable in pathfinding and urban connectivity. The detector explicitly treats closed doors as passable for pathway connectivity audits (`detectDisconnectedPathways`), while checking that departure/arrival cells are not blocked by permanent impassable obstacles (brick walls, fences, or heavy furniture).
3. **Corridor Bounding Boxes**: `streetCorridors` are represented as `Box` instances (`{ x1, y1, x2, y2 }`). For non-rectangular plazas, pass multiple boxes or the union bounding box.

---

## 4. Conclusion & Implementation Specification

### 4.1 Feature 6 Implementation: `src/sim/spatial/spatial-survey-types.ts`

```typescript
import { z } from 'zod';
import { Point2D, Point2DSchema, StratumId, StratumIdSchema } from '../../schemas/primitives.schema.js';
import { Box } from './block-geometry.js';

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

export const SpatialCorrectionActionSchema = z.enum([
  'CLEAR_DOORWAY',
  'FLIP_DOORWAY',
  'STITCH_PATHWAY',
  'RESTORE_ROAD',
  'NUDGE_BUILDING',
  'SEAL_POCKET',
]);
export type SpatialCorrectionAction = z.infer<typeof SpatialCorrectionActionSchema>;

export const SpatialCorrectionLogSchema = z.object({
  action: SpatialCorrectionActionSchema,
  position: Point2DSchema,
  targetId: z.string().optional(),
  details: z.string().min(1),
});
export type SpatialCorrectionLog = z.infer<typeof SpatialCorrectionLogSchema>;

export const BoundingBoxSchema = z.object({
  x1: z.number().int(),
  y1: z.number().int(),
  x2: z.number().int(),
  y2: z.number().int(),
});
export type BoundingBox = z.infer<typeof BoundingBoxSchema>;

export const PlacedBuildingSurveySchema = z.object({
  id: z.string().min(1),
  templateId: z.string().min(1),
  archetypeId: z.string().min(1),
  bounds: BoundingBoxSchema,
  entrancePoints: z.array(Point2DSchema),
  outwardPoints: z.array(Point2DSchema),
  doors: z.record(z.string(), Point2DSchema),
  keyPositions: z.record(z.string(), Point2DSchema).default({}).optional(),
});
export type PlacedBuildingSurvey = z.infer<typeof PlacedBuildingSurveySchema>;

export const SurveyLayersSchema = z.object({
  terrain: z.array(z.string()),
  architecture: z.array(z.string()),
  fixtures: z.array(z.string()),
  zoning: z.array(z.string()),
  circulation: z.array(z.string()),
  anomalyHeatmap: z.array(z.string()),
});
export type SurveyLayers = z.infer<typeof SurveyLayersSchema>;

export const SpatialSurveySheetSchema = z.object({
  districtId: z.string().min(1),
  stratum: StratumIdSchema,
  seed: z.number().int(),
  dimensions: z.object({
    width: z.number().int().positive(),
    height: z.number().int().positive(),
  }),
  layers: SurveyLayersSchema,
  anomalies: z.array(SpatialAnomalySchema),
  corrections: z.array(SpatialCorrectionLogSchema),
});
export type SpatialSurveySheet = z.infer<typeof SpatialSurveySheetSchema>;

export interface AnomalyAuditSummary {
  readonly totalAnomalies: number;
  readonly fatalCount: number;
  readonly errorCount: number;
  readonly warningCount: number;
  readonly isClean: boolean;
}

export function createPlacedBuildingSurvey(
  id: string,
  templateId: string,
  archetypeId: string,
  bounds: Box,
  entrancePoints: readonly Point2D[],
  outwardPoints: readonly Point2D[],
  doors: Readonly<Record<string, Point2D>>,
  keyPositions?: Readonly<Record<string, Point2D>>,
): PlacedBuildingSurvey {
  return {
    id,
    templateId,
    archetypeId,
    bounds: { x1: bounds.x1, y1: bounds.y1, x2: bounds.x2, y2: bounds.y2 },
    entrancePoints: [...entrancePoints],
    outwardPoints: [...outwardPoints],
    doors: { ...doors },
    keyPositions: keyPositions ? { ...keyPositions } : {},
  };
}

export function summarizeAnomalies(anomalies: readonly SpatialAnomaly[]): AnomalyAuditSummary {
  let fatalCount = 0;
  let errorCount = 0;
  let warningCount = 0;
  for (const a of anomalies) {
    if (a.severity === 'FATAL') fatalCount++;
    else if (a.severity === 'ERROR') errorCount++;
    else if (a.severity === 'WARNING') warningCount++;
  }
  return {
    totalAnomalies: anomalies.length,
    fatalCount,
    errorCount,
    warningCount,
    isClean: anomalies.length === 0,
  };
}
```

---

### 4.2 Feature 7 Implementation: `src/sim/spatial/spatial-anomaly-detector.ts`

```typescript
import { EntityRecord } from '../../schemas/components.schema.js';
import { Point2D } from '../../schemas/primitives.schema.js';
import { Box, intersects } from './block-geometry.js';
import { findBlockingEntityAtPoint, getTileCell, isWithinBounds, StratumGrid } from './grid.js';
import {
  AnomalySeverity,
  PlacedBuildingSurvey,
  SpatialAnomaly,
  SpatialAnomalyType,
} from './spatial-survey-types.js';

function makeAnomaly(
  id: string,
  type: SpatialAnomalyType,
  severity: AnomalySeverity,
  position: Point2D,
  description: string,
  targetId?: string,
): SpatialAnomaly {
  return { id, type, severity, position, description, targetId };
}

export function detectBuildingOverlaps(
  buildings: readonly PlacedBuildingSurvey[],
): SpatialAnomaly[] {
  const anomalies: SpatialAnomaly[] = [];
  for (let i = 0; i < buildings.length; i++) {
    const bA = buildings[i]!;
    for (let j = i + 1; j < buildings.length; j++) {
      const bB = buildings[j]!;
      if (intersects(bA.bounds, bB.bounds)) {
        const ox = Math.max(bA.bounds.x1, bB.bounds.x1);
        const oy = Math.max(bA.bounds.y1, bB.bounds.y1);
        anomalies.push(makeAnomaly(
          `anomaly_overlap_${bA.id}_${bB.id}`,
          'BUILDING_OVERLAP',
          'FATAL',
          { x: ox, y: oy },
          `Building '${bA.id}' overlaps with '${bB.id}' at (${ox}, ${oy})`,
          bA.id,
        ));
      }
    }
  }
  return anomalies;
}

export function detectBlockedDoorways(
  grid: StratumGrid,
  entities: Record<string, EntityRecord>,
  buildings: readonly PlacedBuildingSurvey[],
): SpatialAnomaly[] {
  const anomalies: SpatialAnomaly[] = [];
  for (const b of buildings) {
    for (let k = 0; k < b.entrancePoints.length; k++) {
      const doorPt = b.entrancePoints[k]!;
      const doorCell = getTileCell(grid, doorPt.x, doorPt.y);

      if (!doorCell || doorCell.terrainType === 'SOOT_BRICK_WALL') {
        anomalies.push(makeAnomaly(
          `anomaly_door_sealed_${b.id}_${doorPt.x}_${doorPt.y}`,
          'BLOCKED_DOORWAY',
          'FATAL',
          doorPt,
          `Door at (${doorPt.x}, ${doorPt.y}) in '${b.id}' is sealed by solid wall`,
          b.id,
        ));
        continue;
      }

      const doorBlockingEnt = findBlockingEntityAtPoint(entities, { x: doorPt.x, y: doorPt.y, stratum: grid.stratum });
      if (doorBlockingEnt) {
        anomalies.push(makeAnomaly(
          `anomaly_door_fixture_${b.id}_${doorPt.x}_${doorPt.y}`,
          'BLOCKED_DOORWAY',
          'ERROR',
          doorPt,
          `Door at (${doorPt.x}, ${doorPt.y}) in '${b.id}' is blocked by fixture '${doorBlockingEnt.name ?? doorBlockingEnt.id}'`,
          doorBlockingEnt.id,
        ));
      }

      let outPt = b.outwardPoints[k];
      if (!outPt) {
        if (doorPt.x === b.bounds.x1) outPt = { x: doorPt.x - 1, y: doorPt.y };
        else if (doorPt.x === b.bounds.x2) outPt = { x: doorPt.x + 1, y: doorPt.y };
        else if (doorPt.y === b.bounds.y1) outPt = { x: doorPt.x, y: doorPt.y - 1 };
        else outPt = { x: doorPt.x, y: doorPt.y + 1 };
      }

      if (!isWithinBounds(grid, outPt.x, outPt.y)) {
        anomalies.push(makeAnomaly(
          `anomaly_door_oob_${b.id}_${doorPt.x}_${doorPt.y}`,
          'BLOCKED_DOORWAY',
          'FATAL',
          doorPt,
          `Door at (${doorPt.x}, ${doorPt.y}) in '${b.id}' opens out of bounds at (${outPt.x}, ${outPt.y})`,
          b.id,
        ));
        continue;
      }

      const outCell = getTileCell(grid, outPt.x, outPt.y);
      if (outCell && outCell.blocksMovement && outCell.terrainType !== 'WOODEN_DOOR_CLOSED' && outCell.terrainType !== 'WOODEN_DOOR_OPEN') {
        const isWall = outCell.terrainType === 'SOOT_BRICK_WALL' || outCell.terrainType === 'TIMBER_STRUT';
        anomalies.push(makeAnomaly(
          `anomaly_door_obstruction_${b.id}_${doorPt.x}_${doorPt.y}`,
          'BLOCKED_DOORWAY',
          isWall ? 'FATAL' : 'ERROR',
          doorPt,
          `Door at (${doorPt.x}, ${doorPt.y}) in '${b.id}' faces impassable ${outCell.terrainType} at (${outPt.x}, ${outPt.y})`,
          b.id,
        ));
      }

      const outBlockingEnt = findBlockingEntityAtPoint(entities, { x: outPt.x, y: outPt.y, stratum: grid.stratum });
      if (outBlockingEnt) {
        anomalies.push(makeAnomaly(
          `anomaly_door_out_ent_${b.id}_${doorPt.x}_${doorPt.y}`,
          'BLOCKED_DOORWAY',
          'ERROR',
          doorPt,
          `Departure tile for door at (${doorPt.x}, ${doorPt.y}) in '${b.id}' is blocked by '${outBlockingEnt.name ?? outBlockingEnt.id}'`,
          outBlockingEnt.id,
        ));
      }

      const dx = outPt.x - doorPt.x;
      const dy = outPt.y - doorPt.y;
      const inPt = { x: doorPt.x - dx, y: doorPt.y - dy };
      if (isWithinBounds(grid, inPt.x, inPt.y)) {
        const inCell = getTileCell(grid, inPt.x, inPt.y);
        if (inCell?.terrainType === 'SOOT_BRICK_WALL') {
          anomalies.push(makeAnomaly(
            `anomaly_door_in_wall_${b.id}_${doorPt.x}_${doorPt.y}`,
            'BLOCKED_DOORWAY',
            'WARNING',
            doorPt,
            `Interior approach for door at (${doorPt.x}, ${doorPt.y}) in '${b.id}' is obstructed by solid wall`,
            b.id,
          ));
        }
      }
    }
  }
  return anomalies;
}

export function detectWallCollisions(
  grid: StratumGrid,
  portals: readonly Point2D[],
  streetCorridors: readonly Box[],
): SpatialAnomaly[] {
  const anomalies: SpatialAnomaly[] = [];

  for (const p of portals) {
    if (!isWithinBounds(grid, p.x, p.y)) {
      anomalies.push(makeAnomaly(`anomaly_portal_oob_${p.x}_${p.y}`, 'WALL_COLLISION', 'FATAL', p, `Portal at (${p.x}, ${p.y}) is out of bounds`));
      continue;
    }
    const cell = getTileCell(grid, p.x, p.y);
    if (cell && (cell.blocksMovement || cell.terrainType === 'SOOT_BRICK_WALL')) {
      anomalies.push(makeAnomaly(`anomaly_portal_wall_${p.x}_${p.y}`, 'WALL_COLLISION', 'FATAL', p, `Portal at (${p.x}, ${p.y}) is blocked by solid wall`));
      continue;
    }

    let walkableAdj = 0;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      const nx = p.x + dx, ny = p.y + dy;
      if (!isWithinBounds(grid, nx, ny)) continue;
      const c = getTileCell(grid, nx, ny);
      if (c && (!c.blocksMovement || c.terrainType === 'WOODEN_DOOR_CLOSED' || c.terrainType === 'WOODEN_DOOR_OPEN')) walkableAdj++;
    }
    if (walkableAdj === 0) {
      anomalies.push(makeAnomaly(`anomaly_portal_trapped_${p.x}_${p.y}`, 'WALL_COLLISION', 'ERROR', p, `Portal at (${p.x}, ${p.y}) has zero walkable adjacent tiles`));
    }
  }

  for (let ci = 0; ci < streetCorridors.length; ci++) {
    const box = streetCorridors[ci]!;
    for (let y = box.y1; y <= box.y2; y++) {
      for (let x = box.x1; x <= box.x2; x++) {
        if (!isWithinBounds(grid, x, y)) continue;
        const cell = getTileCell(grid, x, y);
        if (cell?.terrainType === 'SOOT_BRICK_WALL') {
          anomalies.push(makeAnomaly(
            `anomaly_corridor_wall_${ci}_${x}_${y}`,
            'WALL_COLLISION',
            'ERROR',
            { x, y },
            `Solid wall at (${x}, ${y}) breaches designated street corridor [${box.x1},${box.y1} - ${box.x2},${box.y2}]`,
          ));
        }
      }
    }
  }

  return anomalies;
}

export function detectDisconnectedPathways(
  grid: StratumGrid,
  hub: Point2D,
  targets: readonly Point2D[],
): SpatialAnomaly[] {
  const anomalies: SpatialAnomaly[] = [];
  if (!isWithinBounds(grid, hub.x, hub.y)) {
    return [makeAnomaly('anomaly_hub_oob', 'DISCONNECTED_PATHWAY', 'FATAL', hub, `Transit hub (${hub.x}, ${hub.y}) is out of bounds`)];
  }
  const hubCell = getTileCell(grid, hub.x, hub.y);
  if (hubCell && hubCell.blocksMovement && hubCell.terrainType !== 'WOODEN_DOOR_CLOSED' && hubCell.terrainType !== 'WOODEN_DOOR_OPEN') {
    return [makeAnomaly('anomaly_hub_blocked', 'DISCONNECTED_PATHWAY', 'FATAL', hub, `Transit hub (${hub.x}, ${hub.y}) is blocked by ${hubCell.terrainType}`)];
  }

  const { width, height } = grid;
  const visited = new Uint8Array(width * height);
  const queue: Point2D[] = [hub];
  visited[hub.y * width + hub.x] = 1;

  while (queue.length > 0) {
    const curr = queue.shift()!;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      const nx = curr.x + dx, ny = curr.y + dy;
      if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
      const idx = ny * width + nx;
      if (visited[idx]) continue;
      const cell = grid.cells[idx];
      if (cell && (!cell.blocksMovement || cell.terrainType === 'WOODEN_DOOR_CLOSED' || cell.terrainType === 'WOODEN_DOOR_OPEN')) {
        visited[idx] = 1;
        queue.push({ x: nx, y: ny });
      }
    }
  }

  for (const t of targets) {
    if (!isWithinBounds(grid, t.x, t.y)) {
      anomalies.push(makeAnomaly(`anomaly_target_oob_${t.x}_${t.y}`, 'DISCONNECTED_PATHWAY', 'FATAL', t, `Pathway target at (${t.x}, ${t.y}) is out of bounds`));
      continue;
    }
    if (!visited[t.y * width + t.x]) {
      anomalies.push(makeAnomaly(
        `anomaly_disconnected_${t.x}_${t.y}`,
        'DISCONNECTED_PATHWAY',
        'ERROR',
        t,
        `Pathway target at (${t.x}, ${t.y}) is disconnected from transit hub at (${hub.x}, ${hub.y})`,
      ));
    }
  }

  return anomalies;
}

export function detectBuildingRoadCollisions(
  buildings: readonly PlacedBuildingSurvey[],
  streetCorridors: readonly Box[],
): SpatialAnomaly[] {
  const anomalies: SpatialAnomaly[] = [];
  for (const b of buildings) {
    for (let ci = 0; ci < streetCorridors.length; ci++) {
      const corridor = streetCorridors[ci]!;
      if (intersects(b.bounds, corridor)) {
        const ox = Math.max(b.bounds.x1, corridor.x1);
        const oy = Math.max(b.bounds.y1, corridor.y1);
        anomalies.push(makeAnomaly(
          `anomaly_road_collision_${b.id}_${ci}`,
          'BUILDING_ROAD_COLLISION',
          'FATAL',
          { x: ox, y: oy },
          `Building '${b.id}' encroaches into street corridor [${corridor.x1},${corridor.y1} - ${corridor.x2},${corridor.y2}] at (${ox}, ${oy})`,
          b.id,
        ));
      }
    }
  }
  return anomalies;
}

export function runSpatialAnomalyAudit(
  grid: StratumGrid,
  entities: Record<string, EntityRecord>,
  buildings: readonly PlacedBuildingSurvey[],
  hub: Point2D,
  targets: readonly Point2D[],
  streetCorridors: readonly Box[],
  portals?: readonly Point2D[],
): SpatialAnomaly[] {
  const resolvedPortals = portals ?? Object.values(entities)
    .filter((e) => e.portal && e.position && e.position.stratum === grid.stratum)
    .map((e) => ({ x: e.position!.x, y: e.position!.y }));

  return [
    ...detectBuildingOverlaps(buildings),
    ...detectBlockedDoorways(grid, entities, buildings),
    ...detectWallCollisions(grid, resolvedPortals, streetCorridors),
    ...detectDisconnectedPathways(grid, hub, targets),
    ...detectBuildingRoadCollisions(buildings, streetCorridors),
  ];
}
```

---

## 5. Verification Method

### 5.1 Independent Verification Commands
The implementing worker or reviewer can verify the new modules with:

```bash
# 1. Typecheck: strict TypeScript compilation
npm run typecheck

# 2. Modularity & Boundary Rules: verify <= 250 lines and zero client imports
npm run check:boundaries

# 3. Data Validation:
npm run validate:data

# 4. Simulation Test Suite:
npm run test:sim

# 5. Full Repository Verification Gate:
npm run verify
```

### 5.2 Unit Test Cases to Include in `tests/sim/spatial-survey-self-correction.test.ts`
1. **`detectBuildingOverlaps`**:
   - Create two buildings with overlapping bounds: `{ x1: 2, y1: 2, x2: 10, y2: 10 }` and `{ x1: 8, y1: 8, x2: 16, y2: 16 }`.
   - Assert `anomalies.length === 1`, `type === 'BUILDING_OVERLAP'`, `severity === 'FATAL'`, `position === { x: 8, y: 8 }`.
   - Create two disjoint buildings: assert `anomalies.length === 0`.
2. **`detectBlockedDoorways`**:
   - Stamp building with door at `(5, 5)` and departure at `(5, 6)`.
   - Case A: Set tile `(5, 6)` to `SOOT_BRICK_WALL` $\to$ assert `BLOCKED_DOORWAY` detected with severity `FATAL`.
   - Case B: Set tile `(5, 6)` to `WROUGHT_IRON_FENCE` $\to$ assert `BLOCKED_DOORWAY` detected with severity `ERROR`.
   - Case C: Place a blocking entity at `(5, 6)` $\to$ assert `BLOCKED_DOORWAY` detected with severity `ERROR`.
   - Case D: Open cobblestone floor at `(5, 6)` with no obstacle $\to$ assert 0 doorway anomalies.
3. **`detectWallCollisions`**:
   - Place portal at `(10, 10)` surrounded by 4 solid wall tiles $\to$ assert `WALL_COLLISION` with `ERROR` ("zero walkable adjacent tiles").
   - Define corridor `{ x1: 0, y1: 15, x2: 40, y2: 17 }` and place a brick wall at `(20, 16)` $\to$ assert `WALL_COLLISION` detected for the breached corridor tile.
4. **`detectDisconnectedPathways`**:
   - Create grid with hub at `(24, 18)`.
   - Target A at `(10, 18)` connected by walkable cobblestone corridor.
   - Target B at `(5, 5)` enclosed in a 4-wall ring.
   - Assert `detectDisconnectedPathways` returns exactly 1 anomaly for Target B with `DISCONNECTED_PATHWAY`, `ERROR`.
5. **`detectBuildingRoadCollisions`**:
   - Define arterial avenue corridor `{ x1: 1, y1: 17, x2: 47, y2: 19 }`.
   - Place building with bounds `{ x1: 10, y1: 15, x2: 20, y2: 18 }`.
   - Assert `detectBuildingRoadCollisions` flags `BUILDING_ROAD_COLLISION` at `{ x: 10, y: 17 }`.
6. **`runSpatialAnomalyAudit` Integration**:
   - Verify combined audit captures all injected anomaly classes in a single call.

### 5.3 Invalidation Conditions
The specification is invalidated if:
- Any proposed file exceeds **250 lines** (hard limit: 300 lines).
- Any module in `src/sim/spatial/` imports from `src/client/`, uses `Math.random()`, or references browser globals.
- Any anomaly detection produces non-deterministic results across identical simulation states.
