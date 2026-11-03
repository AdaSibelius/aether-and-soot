import { InteriorZoneType, Point2D, StratumId, TerrainType } from '../../schemas/primitives.schema.js';
import { EntityRecord } from '../../schemas/components.schema.js';
import { Box } from './block-geometry.js';
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

const DOUBLE_BOX = ['║', '║', '═', '╚', '║', '║', '╔', '╠', '═', '╝', '═', '╩', '╗', '╣', '╦', '╬'] as const;
const SINGLE_BOX = ['│', '│', '─', '└', '│', '│', '┌', '├', '─', '┘', '─', '┴', '┐', '┤', '┬', '┼'] as const;

const ZONE_GLYPHS: Record<InteriorZoneType, string> = {
  NONE: ' ', PUBLIC_BAR: 'B', WORKSHOP: 'W', VAULT: 'V', SURGICAL_BAY: 'S', STORAGE: 'T', LOADING_DOCK: 'L',
  ASSEMBLY_LINE: 'A', PLATFORM: 'P', TICKET_BOOTH: 'K', BACKROOM: 'R', CORRIDOR: 'C', LIVING_QUARTERS: 'Q',
  SCULLERY: 'U', CELLAR: 'E', HOLDING_CELL: 'H', INSPECTOR_OFFICE: 'I', RECEPTION: 'O',
};

const ANOMALY_GLYPHS: Record<SpatialAnomalyType, string> = {
  BUILDING_OVERLAP: '!', BLOCKED_DOORWAY: '?', WALL_COLLISION: 'C', DISCONNECTED_PATHWAY: 'X', BUILDING_ROAD_COLLISION: '~',
};

const TERRAIN_GLYPHS: Partial<Record<TerrainType, string>> = {
  COBBLESTONE_FLOOR: '.', SOOT_BRICK_WALL: '#', TIMBER_STRUT: '|', COUNTER_BARRIER: 'x', RUBBLE_PILE: ',',
  SLAG_MOUND: '^', IRON_GRATE: '=', BRASS_CATWALK: '≡', CANAL_SLUICE: '~', TIMBER_PIER: '_', ABYSS_DROP: ' ',
  WROUGHT_IRON_FENCE: '+', GASLAMP_POST: '*', BRASS_STEAM_PIPE: '|', WOODEN_DOOR_CLOSED: '+', WOODEN_DOOR_OPEN: '/',
  DISTRICT_GATE: '∏', GLASS_WINDOW: '"', SMASHED_WINDOW_FRAME: '%', RAIL_TRACK: '-', CONVEYOR_TRACK: '-',
  SLAG_PIT: 'o', BOARDING_PLATFORM: ':', GOTHIC_COLONNADE: 'O',
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

function resolveWallGlyph(grid: StratumGrid, x: number, y: number): string {
  const cell = grid.cells[y * grid.width + x];
  if (!cell) return ' ';
  if (cell.terrainType === 'WOODEN_DOOR_CLOSED') return '+';
  if (cell.terrainType === 'WOODEN_DOOR_OPEN') return '/';
  if (cell.terrainType === 'GLASS_WINDOW' || cell.terrainType === 'SMASHED_WINDOW_FRAME') return '"';
  if (cell.terrainType === 'DISTRICT_GATE') return '∏';
  if (!isWallAperture(cell.terrainType)) return ' ';

  const n = hasWallAt(grid, x, y - 1), e = hasWallAt(grid, x + 1, y), s = hasWallAt(grid, x, y + 1), w = hasWallAt(grid, x - 1, y);
  if (n && e && s && w && hasWallAt(grid, x - 1, y - 1) && hasWallAt(grid, x + 1, y - 1) && hasWallAt(grid, x - 1, y + 1) && hasWallAt(grid, x + 1, y + 1)) {
    return '▓';
  }
  const mask = (n ? 1 : 0) | (e ? 2 : 0) | (s ? 4 : 0) | (w ? 8 : 0);
  const isSingle = cell.terrainType === 'TIMBER_STRUT' || cell.terrainType === 'COUNTER_BARRIER' || Boolean(cell.interiorZone && cell.interiorZone !== 'NONE');
  return isSingle ? SINGLE_BOX[mask]! : DOUBLE_BOX[mask]!;
}

export function renderLayerMatrices(
  grid: StratumGrid,
  entities: Readonly<Record<string, EntityRecord>> = {},
  buildings: readonly PlacedBuildingSurvey[] = [],
  streetCorridors: readonly Box[] = [],
  anomalies: readonly SpatialAnomaly[] = [],
  hub?: Point2D,
): SpatialSurveySheet['layers'] {
  const { width, height } = grid, entMap = new Map<string, EntityRecord>();
  for (const ent of Object.values(entities)) {
    if (ent.position && ent.position.stratum === grid.stratum) entMap.set(`${ent.position.x},${ent.position.y}`, ent);
  }

  const vecMap = new Map<string, string>();
  for (const b of buildings) {
    for (let i = 0; i < b.entrancePoints.length; i++) {
      const inp = b.entrancePoints[i], outp = b.outwardPoints[i];
      if (inp && outp) {
        vecMap.set(`${outp.x},${outp.y}`, outp.y !== inp.y ? (outp.y < inp.y ? '^' : 'v') : (outp.x < inp.x ? '<' : '>'));
        vecMap.set(`${inp.x},${inp.y}`, 'D');
      }
    }
  }

  const anomMap = new Map<string, string>();
  for (const a of anomalies) anomMap.set(`${a.position.x},${a.position.y}`, ANOMALY_GLYPHS[a.type] ?? '!');

  const reachable = new Set<string>();
  if (hub && getTileCell(grid, hub.x, hub.y) && !getTileCell(grid, hub.x, hub.y)!.blocksMovement) {
    const queue = [hub]; reachable.add(`${hub.x},${hub.y}`);
    while (queue.length > 0) {
      const curr = queue.shift()!;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
        const nx = curr.x + dx, ny = curr.y + dy, key = `${nx},${ny}`;
        if (nx >= 0 && ny >= 0 && nx < width && ny < height && !reachable.has(key)) {
          const c = grid.cells[ny * width + nx];
          if (c && (!c.blocksMovement || c.terrainType === 'WOODEN_DOOR_CLOSED' || c.terrainType === 'WOODEN_DOOR_OPEN')) {
            reachable.add(key); queue.push({ x: nx, y: ny });
          }
        }
      }
    }
  }

  const terrain: string[] = [], architecture: string[] = [], fixtures: string[] = [];
  const zoning: string[] = [], circulation: string[] = [], anomalyHeatmap: string[] = [];

  for (let y = 0; y < height; y++) {
    let tRow = '', aRow = '', fRow = '', zRow = '', cRow = '', hRow = '';
    for (let x = 0; x < width; x++) {
      const idx = y * width + x, cell = grid.cells[idx]!, key = `${x},${y}`;
      tRow += TERRAIN_GLYPHS[cell.terrainType] ?? (cell.terrainType.startsWith('WALL_') ? '#' : '.');
      aRow += resolveWallGlyph(grid, x, y);

      const ent = entMap.get(key);
      if (ent?.portal) {
        const lbl = ent.portal.portalLabel.toLowerCase();
        fRow += lbl.includes('lift') ? 'L' : lbl.includes('manhole') ? 'Ω' : 'H';
      } else if (ent?.workbench) {
        fRow += 'W';
      } else if (ent?.furniture) {
        const k = ent.furniture.kind;
        fRow += k === 'VALVE_MANIFOLD' ? '⌂' : k === 'IRON_BOILER' ? 'B' : k === 'SURGICAL_TABLE' ? 'T' : ent.visual?.glyph?.[0] ?? 'F';
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
          const cw = inCorridor.x2 - inCorridor.x1 + 1, ch = inCorridor.y2 - inCorridor.y1 + 1;
          cRow += cw > ch ? '=' : ch > cw ? '|' : '*';
        } else if (!cell.blocksMovement) {
          cRow += hub && !reachable.has(key) ? 'X' : '.';
        } else {
          cRow += ' ';
        }
      }
      hRow += anomMap.has(key) ? anomMap.get(key)! : (cell.blocksMovement ? ' ' : '.');
    }
    terrain.push(tRow); architecture.push(aRow); fixtures.push(fRow);
    zoning.push(zRow); circulation.push(cRow); anomalyHeatmap.push(hRow);
  }
  return { terrain, architecture, fixtures, zoning, circulation, anomalyHeatmap };
}

export function generateSpatialSurveySheet(
  districtIdOrParams: string | GenerateSurveySheetParams,
  stratum?: StratumId, seed?: number, grid?: StratumGrid,
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
  return {
    districtId: p.districtId, stratum: p.stratum, seed: p.seed,
    dimensions: { width: p.grid.width, height: p.grid.height },
    layers: renderLayerMatrices(p.grid, p.entities, p.buildings, p.streetCorridors, p.anomalies, p.hub),
    anomalies: p.anomalies ? [...p.anomalies] : [], corrections: p.corrections ? [...p.corrections] : [],
  };
}

export function formatSurveySheetMarkdown(sheet: SpatialSurveySheet): string {
  const lines: string[] = [
    `# Spatial Survey Dossier: ${sheet.districtId} (${sheet.stratum})`, '', '## Metadata',
    `- **Seed**: ${sheet.seed}`, `- **Dimensions**: ${sheet.dimensions.width}x${sheet.dimensions.height}`,
    `- **Anomalies Detected**: ${sheet.anomalies.length}`, `- **Corrections Applied**: ${sheet.corrections.length}`, '',
    '## Layer 0: Ground & Terrain', '```', ...sheet.layers.terrain, '```', '',
    '## Layer 1: Architecture & Autotiling Box-Drawing Shell', '```', ...sheet.layers.architecture, '```', '',
    '## Layer 2: Interactive Fixtures & Portals', '```', ...sheet.layers.fixtures, '```', '',
    '## Layer 3: Cadastral Zoning & Room Semantics', '```', ...sheet.layers.zoning, '```', '',
    '## Layer 4: Circulation & Movement Vectors', '```', ...sheet.layers.circulation, '```', '',
    '## Layer 5: Diagnostic Anomaly Heatmap', '```', ...sheet.layers.anomalyHeatmap, '```', '',
    '## Diagnostic Anomaly Audit Log', '| ID | Type | Severity | Position | Description |', '|---|---|---|---|---|',
  ];
  if (sheet.anomalies.length === 0) {
    lines.push('| None | CLEAN | INFO | - | Zero spatial placement anomalies detected |');
  } else {
    for (const a of sheet.anomalies) lines.push(`| ${a.id} | ${a.type} | ${a.severity} | (${a.position.x},${a.position.y}) | ${a.description} |`);
  }
  lines.push('', '## Spatial Self-Correction Execution Log', '| Action | Position | Target | Details |', '|---|---|---|---|');
  if (sheet.corrections.length === 0) {
    lines.push('| None | - | - | Zero self-corrections required |');
  } else {
    for (const c of sheet.corrections) lines.push(`| ${c.action} | (${c.position.x},${c.position.y}) | ${c.targetId ?? '-'} | ${c.details} |`);
  }
  return lines.join('\n');
}
