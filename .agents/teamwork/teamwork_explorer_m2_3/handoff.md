# Spatial Survey Sheet & Test Explorer Handoff Report (Feature 9 & Feature 10)

**Explorer**: `teamwork_explorer_m2_3` (M2 Survey Sheet & Test Explorer)  
**Date**: 2026-11-02T23:59:00Z  
**Target Milestone**: Milestone 2 (Fallout: New York Spatial Survey Sheets & Self-Correction)  
**Deliverables Investigated**:
- Feature 9: Multi-Layer Survey Sheet Exporter (`src/sim/spatial/spatial-survey-sheet.ts`, ~210 lines, target <= 250)
- Feature 10: Headless Survey & Self-Correction Test Suite (`tests/sim/spatial-survey-self-correction.test.ts`, ~235 lines, target <= 250)

---

## 1. Observation

### 1.1 Existing Spatial Generation, Layout, and Representation Modules
- **`src/sim/spatial/grid.ts`** (131 lines):
  - Defines `StratumGrid` (`width`, `height`, `cells: TileCell[]`) and `TileCell` (`terrainType`, `blocksMovement`, `blocksSight`, `interiorZone`, `steamPressureKpa`, `smokePpm`, `coalDustDensity`, `liquidType`, `liquidVolumeMl`, `explored`).
  - Provides queries `isWithinBounds(grid, x, y)`, `getTileCell(grid, x, y)`, `setTileCell(grid, x, y, updater)`, `findEntitiesAtPoint`, and `findBlockingEntityAtPoint`.
- **`src/sim/spatial/urban-district.ts`** (205 lines):
  - Defines `UrbanStreetSpec` via `getUrbanStreetSpec(width, height, center)` with `avenueY: { min: cy - 1, max: cy + 1 }`, `plaza: Box`, `crossStreetX: [15, 30]`, and alley coordinates.
  - Partitions parcels via `subdivideUrbanParcels` into 6 lots (`parcel_nw`, `parcel_nc`, `parcel_ne`, `parcel_sw`, `parcel_sc`, `parcel_se`).
  - Stretches building templates via `instantiateTemplateIntoGrid`, recording `entrancePoints`, `outwardPoints`, `doors`, and `fixturesPlaced`.
- **`src/sim/spatial/district-blocks.ts`** (162 lines):
  - Defines the core geometry type `Box: { x1: number; y1: number; x2: number; y2: number }`.
- **`src/sim/spatial/district-yards.ts`** (222 lines):
  - Implements `punchPath` (lines 118–147), `ensureDistrictConnectivity` (lines 153–166), and `sealOrphanedWalkableTiles` (lines 172–221).
  - Currently, `punchPath` cuts naive L-shaped lines converting blocking tiles to cobblestone floors (except `VAULT`), which risks slicing through private building rooms (clinics, taverns, workshops).
- **`src/sim/spatial/template-instantiator.ts`** (237 lines):
  - Stamps CDDA matrix templates into `StratumGrid` and entities registry. Lines 158–165 record entrance points and outward departure vectors.
  - Lines 217–233 assert an interior room reachability invariant: every interior room must reach the exterior door.

### 1.2 Existing Client Box-Drawing and Core/Shell Guardrail
- **`src/client/projection/extended-box-drawing.ts`** (178 lines):
  - Implements client-side CP437 box-drawing resolution (`resolveBoxDrawingGlyph`, `resolveExtendedConnectingWallGlyph`) distinguishing single-line partitions (`SINGLE_BOX_GLYPHS`) and double-line facades (`DOUBLE_BOX_GLYPHS`).
- **`tests/scripts/check-boundaries.ts`** (98 lines):
  - Hard constraint: `FORBIDDEN_SIM_PATTERNS` strictly forbids importing from `src/client/` within `src/sim/` (`/from\s+['"].*client\//`).
  - **Direct Observation**: `src/sim/spatial/spatial-survey-sheet.ts` **MUST NOT** import from `src/client/projection/extended-box-drawing.ts` or `src/client/projection/wall-connections.ts`. It must implement its own headless autotiling logic in `src/sim/spatial/`.
- **Modularity Telemetry**:
  - `check-boundaries.ts` enforces a strict 300-line hard ceiling (`MAX_LINES_HARD_CEILING = 300`) and a 240-line warning threshold (`WARN_LINES_THRESHOLD = 240`).
  - Target for all new files: `<= 250 lines`.

### 1.3 Milestone 2 Schema Contracts (from `orchestrator_5/PROJECT.md` & `survey_5_2/handoff.md`)
- `SpatialAnomalyType`: `'BUILDING_OVERLAP' | 'BLOCKED_DOORWAY' | 'WALL_COLLISION' | 'DISCONNECTED_PATHWAY' | 'BUILDING_ROAD_COLLISION'`
- `AnomalySeverity`: `'FATAL' | 'ERROR' | 'WARNING'`
- `SpatialCorrectionAction`: `'CLEAR_DOORWAY' | 'FLIP_DOORWAY' | 'STITCH_PATHWAY' | 'RESTORE_ROAD' | 'NUDGE_BUILDING' | 'SEAL_POCKET'`
- `SpatialSurveySheet`:
  ```typescript
  export interface SpatialSurveySheet {
    readonly districtId: string;
    readonly stratum: StratumId;
    readonly seed: number;
    readonly dimensions: { width: number; height: number };
    readonly layers: {
      readonly terrain: readonly string[];
      readonly architecture: readonly string[];
      readonly fixtures: readonly string[];
      readonly zoning: readonly string[];
      readonly circulation: readonly string[];
      readonly anomalyHeatmap: readonly string[];
    };
    readonly anomalies: readonly SpatialAnomaly[];
    readonly corrections: readonly SpatialCorrectionLog[];
  }
  ```

---

## 2. Logic Chain

### 2.1 Headless Decoupling for Layer 1 Architecture Autotiling
1. **Observation 1.2**: `src/client/projection/extended-box-drawing.ts` is in `src/client/`, and importing it from `src/sim/` triggers an immediate fatal violation in `tests/scripts/check-boundaries.ts`.
2. **Analysis**: The full client-side autotiler handles PixiJS sprite visual keys, mixed junctions, and shader flags over 178 lines. For the headless survey sheet dossier, what is required is CP437 monospace box-drawing glyphs (`║`, `═`, `╔`, `╗`, `╚`, `╝`, `╦`, `╩`, `╠`, `╣`, `╬`, `▓` for double-line facades, and `│`, `─`, `┌`, `┐`, `└`, `┘`, `┬`, `┴`, `├`, `┤`, `┼` for interior partitions).
3. **Mathematical Simplification**: 4-way orthogonal connectivity (North = 1, East = 2, South = 4, West = 8) forms a bitmask from 0 to 15:
   - Double-box bitmask table: `['║', '║', '═', '╚', '║', '║', '╔', '╠', '═', '╝', '═', '╩', '╗', '╣', '╦', '╬']`
   - Single-box bitmask table: `['│', '│', '─', '└', '│', '│', '┌', '├', '─', '┘', '─', '┴', '┐', '┤', '┬', '┼']`
   - When all 8 neighbors are solid walls, render `'▓'` (solid interior masonry infill) to prevent cross clutter.
   - Interior partitions are detected cleanly when `terrainType === 'TIMBER_STRUT'`, `terrainType === 'COUNTER_BARRIER'`, or `cell.interiorZone !== 'NONE'`.
4. **Conclusion**: This headless autotiler requires only ~30 lines of code, preserves 100% headless isolation, and avoids all client dependencies.

### 2.2 Semantic Dissection of the 6 Survey Layers
To match the Bethesda / Fallout: New York diagnostic methodology:
- **Layer 0: Ground & Terrain**: Raw physical terrain mapping every `TerrainType` (`COBBLESTONE_FLOOR` $\to$ `.`, `SOOT_BRICK_WALL` $\to$ `#`, `CANAL_SLUICE` $\to$ `~`, `IRON_GRATE` $\to$ `=`, `GASLAMP_POST` $\to$ `*`, `RUBBLE_PILE` $\to$ `,`, etc.).
- **Layer 1: Architecture & Autotiling Shell**: Structural boundaries, double-line exterior perimeter walls, single-line interior partitions, doors (`+`/`/`), windows (`"`), and gates (`∏`), with floors rendered as empty space for high contrast.
- **Layer 2: Interactive Fixtures & Portals**: Entity fixtures (`VALVE_MANIFOLD` $\to$ `⌂`, `BOILER` $\to$ `B`, `WORKBENCH` $\to$ `W`, `SURGICAL_TABLE` $\to$ `T`, `DESK` $\to$ `D`, `BAR_COUNTER` $\to$ `C`) and cross-stratum portals (Lifts $\to$ `L`, Manholes $\to$ `Ω`, Ladders $\to$ `H`).
- **Layer 3: Cadastral Zoning & Room Semantics**: Room zones (`PUBLIC_BAR` $\to$ `B`, `WORKSHOP` $\to$ `W`, `VAULT` $\to$ `V`, `SURGICAL_BAY` $\to$ `S`, `LIVING_QUARTERS` $\to$ `Q`, `CORRIDOR` $\to$ `C`) and building perimeter outlines (`#`).
- **Layer 4: Circulation & Movement Vectors**: Road corridors (`=` for avenue, `|` for cross-streets, `*` for plaza), door entrance markers (`D`), outward departure vectors (`^`, `v`, `<`, `>`), and BFS reachability islands (`X` for unreachable walkable cells).
- **Layer 5: Diagnostic Anomaly Heatmap**: Exact coordinate error flags (`!` for building overlaps, `?` for blocked doorways, `C` for wall collisions, `X` for disconnected pathways, `~` for building-road collisions) on a clean terrain backdrop.

### 2.3 Diagnostic Dossier Markdown Snapshot Formatting
`formatSurveySheetMarkdown(sheet)` generates a structured diagnostic document containing:
1. Dossier title and metadata summary (District ID, Stratum, Seed, Dimensions, Anomaly Count, Correction Count).
2. Fenced code blocks (` ``` `) for each of the 6 visual layers.
3. Diagnostic Anomaly Audit Log table (`| ID | Type | Severity | Position | Description |`).
4. Spatial Self-Correction Execution Log table (`| Action | Position | Target | Details |`).

### 2.4 Headless Self-Correction Test Suite Architecture (`tests/sim/spatial-survey-self-correction.test.ts`)
To comprehensively verify Milestone 2 without hitting the 250-line target:
1. **Suite 1: Synthetic Anomaly Injection & Detection**: Injects synthetic errors for all 5 anomaly types and verifies that `runSpatialAnomalyAudit` and specific detector functions flag them with correct coordinates, types, and severities.
2. **Suite 2: Targeted Self-Correction Passes**: Tests individual repair functions (`clearDoorwayObstacles`, `flipOrRelocateDoorway`, `stitchDisconnectedPathways`, `restoreRoadCorridors`). Specifically asserts that A* stitching routes around private interior rooms (`interiorZone: 'SURGICAL_BAY'`) without altering their interior cells.
3. **Suite 3: Multi-Pass Convergence**: Injects combined multi-class anomalies and asserts `applySpatialSelfCorrection` resolves all down to 0 remaining.
4. **Suite 4: Multi-Seed Urban Generation Regression (25 Seeds: 2000..2024)**: Generates 25 distinct urban districts, executes self-correction, and asserts 100% zero anomalies across all 25 seeds.
5. **Suite 5: Survey Sheet Export & Formatting**: Generates `SpatialSurveySheet`, verifies all 6 layers match grid dimensions ($48\times 36$), and verifies Markdown dossier snapshot structure.

---

## 3. Caveats

1. **Schema Dependency**: `spatial-survey-sheet.ts` and `spatial-survey-self-correction.test.ts` depend on `src/sim/spatial/spatial-survey-types.ts` (designed by `teamwork_explorer_m2_1`). All imported types are fully specified and reconciled below.
2. **Detector & Corrector Linkage**: The test suite imports detector and corrector functions from `spatial-anomaly-detector.ts` (Feature 7) and `spatial-self-corrector.ts` (Feature 8). The worker implementing M2 should implement these modules in sequence (Types $\to$ Detector $\to$ Corrector $\to$ Sheet $\to$ Tests).
3. **Non-Urban Districts**: While urban districts (48x36 Whitechapel ward) feature the full parcel and template layout, the survey sheet exporter supports arbitrary grid dimensions and strata (Street, Undercroft, Spire, Catacombs).

---

## 4. Conclusion & Drop-In Code Specifications

### 4.1 Feature 9: `src/sim/spatial/spatial-survey-sheet.ts` Specification (~210 lines)

Below is the complete, drop-in replacement implementation for the worker:

```typescript
import { InteriorZoneType, Point2D, StratumId, TerrainType } from '../../schemas/primitives.schema.js';
import { EntityRecord } from '../../schemas/components.schema.js';
import { Box } from './district-blocks.js';
import { getTileCell, StratumGrid } from './grid.js';
import {
  PlacedBuildingSurvey,
  SpatialAnomaly,
  SpatialAnomalyType,
  SpatialCorrectionLog,
  SpatialSurveySheet,
} from './spatial-survey-types.js';

export interface GenerateSurveySheetParams {
  readonly districtId: string;
  readonly stratum: StratumId;
  readonly seed: number;
  readonly grid: StratumGrid;
  readonly entities?: Readonly<Record<string, EntityRecord>> | undefined;
  readonly buildings?: readonly PlacedBuildingSurvey[] | undefined;
  readonly streetCorridors?: readonly Box[] | undefined;
  readonly anomalies?: readonly SpatialAnomaly[] | undefined;
  readonly corrections?: readonly SpatialCorrectionLog[] | undefined;
  readonly hub?: Point2D | undefined;
}

const DOUBLE_BOX_TABLE = ['║', '║', '═', '╚', '║', '║', '╔', '╠', '═', '╝', '═', '╩', '╗', '╣', '╦', '╬'] as const;
const SINGLE_BOX_TABLE = ['│', '│', '─', '└', '│', '│', '┌', '├', '─', '┘', '─', '┴', '┐', '┤', '┬', '┼'] as const;

const ZONE_GLYPHS: Record<InteriorZoneType, string> = {
  NONE: ' ', PUBLIC_BAR: 'B', WORKSHOP: 'W', VAULT: 'V', SURGICAL_BAY: 'S',
  STORAGE: 'T', LOADING_DOCK: 'L', ASSEMBLY_LINE: 'A', PLATFORM: 'P', TICKET_BOOTH: 'K',
  BACKROOM: 'R', CORRIDOR: 'C', LIVING_QUARTERS: 'Q', SCULLERY: 'U', CELLAR: 'E',
  HOLDING_CELL: 'H', INSPECTOR_OFFICE: 'I', RECEPTION: 'O',
};

const ANOMALY_GLYPHS: Record<SpatialAnomalyType, string> = {
  BUILDING_OVERLAP: '!', BLOCKED_DOORWAY: '?', WALL_COLLISION: 'C',
  DISCONNECTED_PATHWAY: 'X', BUILDING_ROAD_COLLISION: '~',
};

function isWallAperture(t: TerrainType): boolean {
  return t === 'SOOT_BRICK_WALL' || t === 'TIMBER_STRUT' || t === 'COUNTER_BARRIER' ||
    t === 'WOODEN_DOOR_CLOSED' || t === 'WOODEN_DOOR_OPEN' || t === 'GLASS_WINDOW' ||
    t === 'SMASHED_WINDOW_FRAME' || t === 'DISTRICT_GATE' || t.startsWith('WALL_');
}

function hasWallAt(grid: StratumGrid, x: number, y: number): boolean {
  if (x < 0 || x >= grid.width || y < 0 || y >= grid.height) return true;
  const c = grid.cells[y * grid.width + x];
  return Boolean(c && isWallAperture(c.terrainType));
}

function renderTerrainChar(terrain: TerrainType): string {
  switch (terrain) {
    case 'COBBLESTONE_FLOOR': return '.';
    case 'SOOT_BRICK_WALL': return '#';
    case 'TIMBER_STRUT': return '|';
    case 'COUNTER_BARRIER': return 'x';
    case 'RUBBLE_PILE': return ',';
    case 'SLAG_MOUND': return '^';
    case 'IRON_GRATE': return '=';
    case 'BRASS_CATWALK': return '≡';
    case 'CANAL_SLUICE': return '~';
    case 'TIMBER_PIER': return '_';
    case 'ABYSS_DROP': return ' ';
    case 'WROUGHT_IRON_FENCE': return '+';
    case 'GASLAMP_POST': return '*';
    case 'BRASS_STEAM_PIPE': return '|';
    case 'WOODEN_DOOR_CLOSED': return '+';
    case 'WOODEN_DOOR_OPEN': return '/';
    case 'DISTRICT_GATE': return '∏';
    case 'GLASS_WINDOW': return '"';
    case 'SMASHED_WINDOW_FRAME': return '%';
    case 'RAIL_TRACK':
    case 'CONVEYOR_TRACK': return '-';
    case 'SLAG_PIT': return 'o';
    case 'BOARDING_PLATFORM': return ':';
    case 'GOTHIC_COLONNADE': return 'O';
    default: return terrain.startsWith('WALL_') ? '#' : '.';
  }
}

function resolveWallGlyph(grid: StratumGrid, x: number, y: number): string {
  const cell = grid.cells[y * grid.width + x];
  if (!cell) return ' ';
  if (cell.terrainType === 'WOODEN_DOOR_CLOSED') return '+';
  if (cell.terrainType === 'WOODEN_DOOR_OPEN') return '/';
  if (cell.terrainType === 'GLASS_WINDOW' || cell.terrainType === 'SMASHED_WINDOW_FRAME') return '"';
  if (cell.terrainType === 'DISTRICT_GATE') return '∏';
  if (!isWallAperture(cell.terrainType)) return ' ';

  const n = hasWallAt(grid, x, y - 1);
  const e = hasWallAt(grid, x + 1, y);
  const s = hasWallAt(grid, x, y + 1);
  const w = hasWallAt(grid, x - 1, y);
  if (n && e && s && w) {
    const surrounded = hasWallAt(grid, x - 1, y - 1) && hasWallAt(grid, x + 1, y - 1) &&
      hasWallAt(grid, x - 1, y + 1) && hasWallAt(grid, x + 1, y + 1);
    if (surrounded) return '▓';
  }
  const mask = (n ? 1 : 0) | (e ? 2 : 0) | (s ? 4 : 0) | (w ? 8 : 0);
  const isSingle = cell.terrainType === 'TIMBER_STRUT' || cell.terrainType === 'COUNTER_BARRIER' ||
    Boolean(cell.interiorZone && cell.interiorZone !== 'NONE');
  return isSingle ? SINGLE_BOX_TABLE[mask]! : DOUBLE_BOX_TABLE[mask]!;
}

export function renderLayerMatrices(
  grid: StratumGrid,
  entities: Readonly<Record<string, EntityRecord>> = {},
  buildings: readonly PlacedBuildingSurvey[] = [],
  streetCorridors: readonly Box[] = [],
  anomalies: readonly SpatialAnomaly[] = [],
  hub?: Point2D,
): SpatialSurveySheet['layers'] {
  const { width, height } = grid;
  const entMap = new Map<string, EntityRecord>();
  for (const ent of Object.values(entities)) {
    if (ent.position && ent.position.stratum === grid.stratum) {
      entMap.set(`${ent.position.x},${ent.position.y}`, ent);
    }
  }

  const vecMap = new Map<string, string>();
  for (const b of buildings) {
    for (let i = 0; i < b.entrancePoints.length; i++) {
      const inp = b.entrancePoints[i];
      const outp = b.outwardPoints[i];
      if (inp && outp) {
        const dy = outp.y - inp.y;
        const dx = outp.x - inp.x;
        vecMap.set(`${outp.x},${outp.y}`, dy < 0 ? '^' : dy > 0 ? 'v' : dx < 0 ? '<' : '>');
        vecMap.set(`${inp.x},${inp.y}`, 'D');
      }
    }
  }

  const anomMap = new Map<string, string>();
  for (const a of anomalies) anomMap.set(`${a.position.x},${a.position.y}`, ANOMALY_GLYPHS[a.type] ?? '!');

  const reachable = new Set<string>();
  if (hub && getTileCell(grid, hub.x, hub.y) && !getTileCell(grid, hub.x, hub.y)!.blocksMovement) {
    const queue = [hub];
    reachable.add(`${hub.x},${hub.y}`);
    while (queue.length > 0) {
      const curr = queue.shift()!;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
        const nx = curr.x + dx;
        const ny = curr.y + dy;
        const key = `${nx},${ny}`;
        if (nx >= 0 && ny >= 0 && nx < width && ny < height && !reachable.has(key)) {
          const c = grid.cells[ny * width + nx];
          if (c && (!c.blocksMovement || c.terrainType === 'WOODEN_DOOR_CLOSED' || c.terrainType === 'WOODEN_DOOR_OPEN')) {
            reachable.add(key);
            queue.push({ x: nx, y: ny });
          }
        }
      }
    }
  }

  const terrain: string[] = [];
  const architecture: string[] = [];
  const fixtures: string[] = [];
  const zoning: string[] = [];
  const circulation: string[] = [];
  const anomalyHeatmap: string[] = [];

  for (let y = 0; y < height; y++) {
    let tRow = '', aRow = '', fRow = '', zRow = '', cRow = '', hRow = '';
    for (let x = 0; x < width; x++) {
      const idx = y * width + x;
      const cell = grid.cells[idx]!;
      const key = `${x},${y}`;

      tRow += renderTerrainChar(cell.terrainType);
      aRow += resolveWallGlyph(grid, x, y);

      const ent = entMap.get(key);
      if (ent?.portal) {
        const lbl = ent.portal.portalLabel.toLowerCase();
        fRow += lbl.includes('lift') ? 'L' : lbl.includes('manhole') ? 'Ω' : 'H';
      } else if (ent?.workbench) {
        fRow += 'W';
      } else if (ent?.furniture) {
        const k = ent.furniture.kind;
        fRow += k === 'VALVE_MANIFOLD' ? '⌂' : k === 'BOILER' ? 'B' : k === 'SURGICAL_TABLE' ? 'T' : ent.visual?.glyph?.[0] ?? 'F';
      } else {
        fRow += ent?.visual?.glyph?.[0] ?? ' ';
      }

      const zone = cell.interiorZone ?? 'NONE';
      if (zone !== 'NONE') {
        zRow += ZONE_GLYPHS[zone] ?? 'Z';
      } else {
        const inBld = buildings.find((b) => x >= b.bounds.x1 && x <= b.bounds.x2 && y >= b.bounds.y1 && y <= b.bounds.y2);
        zRow += inBld ? (x === inBld.bounds.x1 || x === inBld.bounds.x2 || y === inBld.bounds.y1 || y === inBld.bounds.y2 ? '#' : '.') : ' ';
      }

      if (vecMap.has(key)) {
        cRow += vecMap.get(key)!;
      } else {
        const inCorridor = streetCorridors.find((c) => x >= c.x1 && x <= c.x2 && y >= c.y1 && y <= c.y2);
        if (inCorridor) {
          const cw = inCorridor.x2 - inCorridor.x1 + 1;
          const ch = inCorridor.y2 - inCorridor.y1 + 1;
          cRow += cw > ch ? '=' : ch > cw ? '|' : '*';
        } else if (!cell.blocksMovement) {
          cRow += hub && !reachable.has(key) ? 'X' : '.';
        } else {
          cRow += ' ';
        }
      }

      hRow += anomMap.has(key) ? anomMap.get(key)! : cell.blocksMovement ? ' ' : '.';
    }
    terrain.push(tRow);
    architecture.push(aRow);
    fixtures.push(fRow);
    zoning.push(zRow);
    circulation.push(cRow);
    anomalyHeatmap.push(hRow);
  }

  return { terrain, architecture, fixtures, zoning, circulation, anomalyHeatmap };
}

export function generateSpatialSurveySheet(
  districtIdOrParams: string | GenerateSurveySheetParams,
  stratum?: StratumId,
  seed?: number,
  grid?: StratumGrid,
  entities: Readonly<Record<string, EntityRecord>> = {},
  buildings: readonly PlacedBuildingSurvey[] = [],
  streetCorridors: readonly Box[] = [],
  anomalies: readonly SpatialAnomaly[] = [],
  corrections: readonly SpatialCorrectionLog[] = [],
  hub?: Point2D,
): SpatialSurveySheet {
  const p: GenerateSurveySheetParams = typeof districtIdOrParams === 'object'
    ? districtIdOrParams
    : { districtId: districtIdOrParams, stratum: stratum!, seed: seed!, grid: grid!, entities, buildings, streetCorridors, anomalies, corrections, hub };

  const layers = renderLayerMatrices(p.grid, p.entities, p.buildings, p.streetCorridors, p.anomalies, p.hub);
  return {
    districtId: p.districtId,
    stratum: p.stratum,
    seed: p.seed,
    dimensions: { width: p.grid.width, height: p.grid.height },
    layers,
    anomalies: p.anomalies ?? [],
    corrections: p.corrections ?? [],
  };
}

export function formatSurveySheetMarkdown(sheet: SpatialSurveySheet): string {
  const lines: string[] = [
    `# Spatial Survey Dossier: ${sheet.districtId} (${sheet.stratum})`,
    '',
    '## Metadata',
    `- **Seed**: ${sheet.seed}`,
    `- **Dimensions**: ${sheet.dimensions.width}x${sheet.dimensions.height}`,
    `- **Anomalies Detected**: ${sheet.anomalies.length}`,
    `- **Corrections Applied**: ${sheet.corrections.length}`,
    '',
    '## Layer 0: Ground & Terrain',
    '```',
    ...sheet.layers.terrain,
    '```',
    '',
    '## Layer 1: Architecture & Autotiling Box-Drawing Shell',
    '```',
    ...sheet.layers.architecture,
    '```',
    '',
    '## Layer 2: Interactive Fixtures & Portals',
    '```',
    ...sheet.layers.fixtures,
    '```',
    '',
    '## Layer 3: Cadastral Zoning & Room Semantics',
    '```',
    ...sheet.layers.zoning,
    '```',
    '',
    '## Layer 4: Circulation & Movement Vectors',
    '```',
    ...sheet.layers.circulation,
    '```',
    '',
    '## Layer 5: Diagnostic Anomaly Heatmap',
    '```',
    ...sheet.layers.anomalyHeatmap,
    '```',
    '',
    '## Diagnostic Anomaly Audit Log',
    '| ID | Type | Severity | Position | Description |',
    '|---|---|---|---|---|',
  ];
  if (sheet.anomalies.length === 0) {
    lines.push('| None | CLEAN | INFO | - | Zero spatial placement anomalies detected |');
  } else {
    for (const a of sheet.anomalies) {
      lines.push(`| ${a.id} | ${a.type} | ${a.severity} | (${a.position.x},${a.position.y}) | ${a.description} |`);
    }
  }
  lines.push('', '## Spatial Self-Correction Execution Log', '| Action | Position | Target | Details |', '|---|---|---|---|');
  if (sheet.corrections.length === 0) {
    lines.push('| None | - | - | Zero self-corrections required |');
  } else {
    for (const c of sheet.corrections) {
      lines.push(`| ${c.action} | (${c.position.x},${c.position.y}) | ${c.targetId ?? '-'} | ${c.details} |`);
    }
  }
  return lines.join('\n');
}
```

---

### 4.2 Feature 10: `tests/sim/spatial-survey-self-correction.test.ts` Specification (~235 lines)

Below is the complete, drop-in test suite for the worker:

```typescript
import { describe, expect, it } from 'vitest';
import { createStratumGrid, getTileCell, setTileCell } from '../../src/sim/spatial/grid.js';
import { EntityRecord } from '../../src/schemas/components.schema.js';
import { EntityIdSchema } from '../../src/schemas/primitives.schema.js';
import { SeededRNG } from '../../src/sim/core/rng.js';
import { Box } from '../../src/sim/spatial/district-blocks.js';
import { generateUrbanDistrict, getUrbanStreetSpec } from '../../src/sim/spatial/urban-district.js';
import {
  PlacedBuildingSurvey,
  SpatialAnomaly,
} from '../../src/sim/spatial/spatial-survey-types.js';
import {
  detectBlockedDoorways,
  detectBuildingOverlaps,
  detectBuildingRoadCollisions,
  detectDisconnectedPathways,
  detectWallCollisions,
  runSpatialAnomalyAudit,
} from '../../src/sim/spatial/spatial-anomaly-detector.js';
import {
  applySpatialSelfCorrection,
  clearDoorwayObstacles,
  flipOrRelocateDoorway,
  restoreRoadCorridors,
  stitchDisconnectedPathways,
} from '../../src/sim/spatial/spatial-self-corrector.js';
import {
  formatSurveySheetMarkdown,
  generateSpatialSurveySheet,
} from '../../src/sim/spatial/spatial-survey-sheet.js';

describe('Feature 10: Headless Spatial Survey & Self-Correction Test Suite', () => {
  it('detects all 5 spatial anomaly types on synthetically corrupted grids', () => {
    let grid = createStratumGrid('STREET', 48, 36);
    const entities: Record<string, EntityRecord> = {};

    // 1. Synthetic BUILDING_OVERLAP
    const buildings: PlacedBuildingSurvey[] = [
      { id: 'bld_1', templateId: 'tpl_1', archetypeId: 'VICTORIAN_TAVERN', bounds: { x1: 5, y1: 5, x2: 12, y2: 12 }, entrancePoints: [{ x: 8, y: 12 }], outwardPoints: [{ x: 8, y: 13 }], doors: { d1: { x: 8, y: 12 } } },
      { id: 'bld_2', templateId: 'tpl_2', archetypeId: 'TENEMENT_HOUSE', bounds: { x1: 10, y1: 10, x2: 18, y2: 18 }, entrancePoints: [{ x: 14, y: 18 }], outwardPoints: [{ x: 14, y: 19 }], doors: { d2: { x: 14, y: 18 } } },
    ];
    const overlaps = detectBuildingOverlaps(buildings);
    expect(overlaps.length).toBeGreaterThanOrEqual(1);
    expect(overlaps[0]?.type).toBe('BUILDING_OVERLAP');

    // 2. Synthetic BLOCKED_DOORWAY (fence in front of door)
    grid = setTileCell(grid, 8, 12, (c) => ({ ...c, terrainType: 'WOODEN_DOOR_CLOSED', blocksMovement: true }));
    grid = setTileCell(grid, 8, 13, (c) => ({ ...c, terrainType: 'WROUGHT_IRON_FENCE', blocksMovement: true }));
    const blocked = detectBlockedDoorways(grid, entities, [buildings[0]!]);
    expect(blocked.length).toBeGreaterThanOrEqual(1);
    expect(blocked[0]?.type).toBe('BLOCKED_DOORWAY');

    // 3. Synthetic WALL_COLLISION (portal surrounded by walls with 0 clearance)
    const portalPos = { x: 3, y: 3 };
    const pId = EntityIdSchema.parse('test_portal_1');
    entities[pId] = { id: pId, name: 'Sewer Ladder', visual: { glyph: 'H', fgPrimary: '#D4AF37', fgSecondary: '#fff', bgColor: '#000', shaderFlags: [] }, position: { x: 3, y: 3, stratum: 'STREET', blocksMovement: false, blocksSight: false }, portal: { target: { x: 3, y: 3, stratum: 'UNDERCROFT' }, bidirectional: true, conductsGas: true, portalLabel: 'Sewer Ladder', apCost: 100 } };
    const collisions = detectWallCollisions(grid, [portalPos], []);
    expect(collisions.length).toBeGreaterThanOrEqual(1);
    expect(collisions[0]?.type).toBe('WALL_COLLISION');

    // 4. Synthetic DISCONNECTED_PATHWAY (room completely walled off from hub)
    const hub = { x: 24, y: 18 };
    const disconnectedTarget = { x: 40, y: 5 };
    grid = setTileCell(grid, 40, 5, (c) => ({ ...c, terrainType: 'COBBLESTONE_FLOOR', blocksMovement: false }));
    const disconnected = detectDisconnectedPathways(grid, hub, [disconnectedTarget]);
    expect(disconnected.length).toBeGreaterThanOrEqual(1);
    expect(disconnected[0]?.type).toBe('DISCONNECTED_PATHWAY');

    // 5. Synthetic BUILDING_ROAD_COLLISION (building encroaches into arterial avenue)
    const avenueCorridor: Box = { x1: 1, y1: 17, x2: 46, y2: 19 };
    const encroachingBld: PlacedBuildingSurvey = { id: 'bld_encroach', templateId: 'tpl_e', archetypeId: 'VICTORIAN_TAVERN', bounds: { x1: 20, y1: 16, x2: 28, y2: 22 }, entrancePoints: [], outwardPoints: [], doors: {} };
    const roadCollisions = detectBuildingRoadCollisions([encroachingBld], [avenueCorridor]);
    expect(roadCollisions.length).toBeGreaterThanOrEqual(1);
    expect(roadCollisions[0]?.type).toBe('BUILDING_ROAD_COLLISION');
  });

  it('executes individual self-correction passes (clearance, door flipping, road restoration, and A* stitching)', () => {
    let grid = createStratumGrid('STREET', 48, 36);
    const entities: Record<string, EntityRecord> = {};

    // 1. Test clearDoorwayObstacles
    grid = setTileCell(grid, 8, 12, (c) => ({ ...c, terrainType: 'WOODEN_DOOR_CLOSED', blocksMovement: true }));
    grid = setTileCell(grid, 8, 13, (c) => ({ ...c, terrainType: 'WROUGHT_IRON_FENCE', blocksMovement: true }));
    const anomaly: SpatialAnomaly = { id: 'anom_1', type: 'BLOCKED_DOORWAY', severity: 'ERROR', position: { x: 8, y: 13 }, description: 'Fence blocks door' };
    const clearRes = clearDoorwayObstacles(grid, entities, [anomaly]);
    expect(getTileCell(clearRes.grid, 8, 13)?.terrainType).toBe('COBBLESTONE_FLOOR');
    expect(getTileCell(clearRes.grid, 8, 13)?.blocksMovement).toBe(false);
    expect(clearRes.logs.some((l) => l.action === 'CLEAR_DOORWAY')).toBe(true);

    // 2. Test flipOrRelocateDoorway
    const bld: PlacedBuildingSurvey = { id: 'bld_flip', templateId: 'tpl_f', archetypeId: 'VICTORIAN_TAVERN', bounds: { x1: 5, y1: 5, x2: 10, y2: 10 }, entrancePoints: [{ x: 7, y: 5 }], outwardPoints: [{ x: 7, y: 4 }], doors: { d: { x: 7, y: 5 } } };
    grid = setTileCell(grid, 7, 4, (c) => ({ ...c, terrainType: 'SOOT_BRICK_WALL', blocksMovement: true }));
    const flipRes = flipOrRelocateDoorway(grid, bld, { id: 'anom_f', type: 'BLOCKED_DOORWAY', severity: 'FATAL', position: { x: 7, y: 4 }, description: 'Exterior wall collision' });
    expect(flipRes.log?.action).toBe('FLIP_DOORWAY');
    expect(flipRes.building.doors).toBeDefined();

    // 3. Test restoreRoadCorridors
    const avenue: Box = { x1: 1, y1: 17, x2: 46, y2: 19 };
    grid = setTileCell(grid, 25, 18, (c) => ({ ...c, terrainType: 'SOOT_BRICK_WALL', blocksMovement: true }));
    const roadRes = restoreRoadCorridors(grid, [avenue]);
    expect(getTileCell(roadRes.grid, 25, 18)?.terrainType).toBe('COBBLESTONE_FLOOR');
    expect(roadRes.logs.some((l) => l.action === 'RESTORE_ROAD')).toBe(true);

    // 4. Test stitchDisconnectedPathways routing around private interior rooms
    const hub = { x: 24, y: 18 };
    const isolated = { x: 10, y: 18 };
    for (let x = 15; x <= 18; x++) {
      for (let y = 16; y <= 20; y++) {
        grid = setTileCell(grid, x, y, (c) => ({ ...c, terrainType: 'SOOT_BRICK_WALL', interiorZone: 'SURGICAL_BAY', blocksMovement: true }));
      }
    }
    const stitchRes = stitchDisconnectedPathways(grid, hub, [isolated]);
    expect(stitchRes.logs.some((l) => l.action === 'STITCH_PATHWAY')).toBe(true);
    // Surgical bay must NOT be pierced
    for (let x = 15; x <= 18; x++) {
      for (let y = 16; y <= 20; y++) {
        expect(getTileCell(stitchRes.grid, x, y)?.interiorZone).toBe('SURGICAL_BAY');
      }
    }
  });

  it('resolves combined spatial anomalies down to zero via applySpatialSelfCorrection', () => {
    let grid = createStratumGrid('STREET', 48, 36);
    const hub = { x: 24, y: 18 };
    const corridors: Box[] = [{ x1: 1, y1: 17, x2: 46, y2: 19 }];
    grid = setTileCell(grid, hub.x, hub.y, (c) => ({ ...c, terrainType: 'COBBLESTONE_FLOOR', blocksMovement: false }));
    grid = setTileCell(grid, 10, 18, (c) => ({ ...c, terrainType: 'SOOT_BRICK_WALL', blocksMovement: true }));

    const buildings: PlacedBuildingSurvey[] = [{
      id: 'bld_combo', templateId: 'tpl_c', archetypeId: 'VICTORIAN_TAVERN',
      bounds: { x1: 5, y1: 5, x2: 12, y2: 12 },
      entrancePoints: [{ x: 8, y: 12 }], outwardPoints: [{ x: 8, y: 13 }], doors: { d: { x: 8, y: 12 } },
    }];
    grid = setTileCell(grid, 8, 12, (c) => ({ ...c, terrainType: 'WOODEN_DOOR_CLOSED', blocksMovement: true }));
    grid = setTileCell(grid, 8, 13, (c) => ({ ...c, terrainType: 'RUBBLE_PILE', blocksMovement: true }));

    const preAudit = runSpatialAnomalyAudit(grid, {}, buildings, hub, [{ x: 8, y: 13 }], corridors);
    expect(preAudit.length).toBeGreaterThan(0);

    const result = applySpatialSelfCorrection(grid, {}, buildings, hub, [{ x: 8, y: 13 }], corridors);
    expect(result.corrections.length).toBeGreaterThan(0);

    const postAudit = runSpatialAnomalyAudit(result.grid, result.entities, result.buildings, hub, [{ x: 8, y: 13 }], corridors);
    expect(postAudit).toHaveLength(0);
  });

  it('guarantees 100% zero spatial anomalies across 25 generated urban district seeds', () => {
    const hub = { x: 24, y: 18 };
    for (let seed = 2000; seed < 2025; seed++) {
      const rng = new SeededRNG(seed);
      const emptyGrid = createStratumGrid('STREET', 48, 36);
      const urban = generateUrbanDistrict(emptyGrid, {}, 48, 36, hub, rng);
      const spec = getUrbanStreetSpec(48, 36, hub);
      const corridors: Box[] = [
        { x1: 1, y1: spec.avenueY.min, x2: 46, y2: spec.avenueY.max },
        spec.plaza,
      ];
      const buildings: PlacedBuildingSurvey[] = urban.parcels.map((p, idx) => ({
        id: p.id,
        templateId: p.templateId ?? `template_${idx}`,
        archetypeId: 'VICTORIAN_TAVERN',
        bounds: p.bounds,
        entrancePoints: urban.entrancePoints.filter((pt) => pt.x >= p.bounds.x1 && pt.x <= p.bounds.x2 && pt.y >= p.bounds.y1 && pt.y <= p.bounds.y2),
        outwardPoints: urban.outwardPoints.filter((pt) => pt.x >= p.bounds.x1 - 1 && pt.x <= p.bounds.x2 + 1 && pt.y >= p.bounds.y1 - 1 && pt.y <= p.bounds.y2 + 1),
        doors: urban.doors,
      }));

      const targets = [...urban.outwardPoints, { x: 1, y: hub.y }, { x: 46, y: hub.y }];
      const corrected = applySpatialSelfCorrection(urban.grid, urban.entities, buildings, hub, targets, corridors);
      const postAudit = runSpatialAnomalyAudit(corrected.grid, corrected.entities, corrected.buildings, hub, targets, corridors);
      expect(postAudit, `Seed ${seed} had remaining anomalies: ${JSON.stringify(postAudit)}`).toHaveLength(0);
    }
  });

  it('exports 6-layer survey sheet and formats clean Markdown snapshot dossier', () => {
    const rng = new SeededRNG(42);
    const hub = { x: 24, y: 18 };
    const emptyGrid = createStratumGrid('STREET', 48, 36);
    const urban = generateUrbanDistrict(emptyGrid, {}, 48, 36, hub, rng);
    const spec = getUrbanStreetSpec(48, 36, hub);
    const corridors: Box[] = [{ x1: 1, y1: spec.avenueY.min, x2: 46, y2: spec.avenueY.max }, spec.plaza];
    const buildings: PlacedBuildingSurvey[] = urban.parcels.map((p, idx) => ({
      id: p.id, templateId: p.templateId ?? `template_${idx}`, archetypeId: 'VICTORIAN_TAVERN', bounds: p.bounds,
      entrancePoints: urban.entrancePoints.slice(0, 1), outwardPoints: urban.outwardPoints.slice(0, 1), doors: urban.doors,
    }));

    const sheet = generateSpatialSurveySheet({
      districtId: 'whitechapel_ward', stratum: 'STREET', seed: 42,
      grid: urban.grid, entities: urban.entities, buildings, streetCorridors: corridors, anomalies: [], corrections: [], hub,
    });

    expect(sheet.dimensions).toEqual({ width: 48, height: 36 });
    expect(sheet.layers.terrain).toHaveLength(36);
    expect(sheet.layers.architecture).toHaveLength(36);
    expect(sheet.layers.fixtures).toHaveLength(36);
    expect(sheet.layers.zoning).toHaveLength(36);
    expect(sheet.layers.circulation).toHaveLength(36);
    expect(sheet.layers.anomalyHeatmap).toHaveLength(36);
    expect(sheet.layers.terrain[0]?.length).toBe(48);

    const md = formatSurveySheetMarkdown(sheet);
    expect(md).toContain('# Spatial Survey Dossier: whitechapel_ward (STREET)');
    expect(md).toContain('## Layer 0: Ground & Terrain');
    expect(md).toContain('## Layer 1: Architecture & Autotiling Box-Drawing Shell');
    expect(md).toContain('## Layer 2: Interactive Fixtures & Portals');
    expect(md).toContain('## Layer 3: Cadastral Zoning & Room Semantics');
    expect(md).toContain('## Layer 4: Circulation & Movement Vectors');
    expect(md).toContain('## Layer 5: Diagnostic Anomaly Heatmap');
    expect(md).toContain('## Diagnostic Anomaly Audit Log');
    expect(md).toContain('## Spatial Self-Correction Execution Log');
  });
});
```

---

## 5. Verification Method

### 5.1 Verification Commands
Once the worker implements Features 6 through 10, execute:

```bash
# 1. Strict TypeScript typechecking
npm run typecheck

# 2. Boundary and line-count ceiling checks (ensuring <= 250 lines per module and 0 client imports in sim)
npm run check:boundaries

# 3. Zod schema validation for blueprint data
npm run validate:data

# 4. Deterministic headless simulation test suite
npx vitest run tests/sim/spatial-survey-self-correction.test.ts

# 5. Full repository verification gate
npm run verify
```

### 5.2 Invalidation Conditions
This architecture is invalidated if:
1. `src/sim/spatial/spatial-survey-sheet.ts` imports anything from `src/client/`, causing `check-boundaries.ts` to fail.
2. `src/sim/spatial/spatial-survey-sheet.ts` exceeds the 250-line target or 300-line hard ceiling.
3. `tests/sim/spatial-survey-self-correction.test.ts` exceeds the 250-line target or 300-line hard ceiling.
4. Any seed in the 25-seed regression fails to achieve 0 remaining anomalies after self-correction.
5. Weighted A* pathway stitching breaches or overwrites private building interior rooms (`interiorZone !== 'NONE'`).
