import { EntityId, EntityIdSchema } from '../../src/schemas/primitives.schema.js';
import { WorldState } from '../../src/sim/core/world.js';
import { projectWorldToVisualFrame, resolveCatalogDisplayName, VisualGridFrame } from '../../src/client/projection/frame-adapter.js';
import { formatEventMessage } from '../../src/client/ui/EventFormatter.js';
import { UiCellBuffer } from '../../src/client/canvas-ui/cell-buffer.js';

export interface ProjectionLeak {
  readonly category: 'RAW_IDENTIFIER' | 'TRUNCATED_STRING' | 'DESYNC_COORDINATES' | 'DUPLICATE_CHRONICLE' | 'MALFORMED_UI_CELL';
  readonly location: string;
  readonly text: string;
  readonly details?: string;
}

export interface ClientProjectionAudit {
  readonly leaks: readonly ProjectionLeak[];
  readonly leakCount: number;
  readonly hudLabels: readonly string[];
  readonly radarRows: readonly string[];
  readonly modalTitles: readonly string[];
  readonly chronicleStrings: readonly string[];
  readonly lookCursorSync: {
    readonly synchronized: boolean;
    readonly lookCursorCoord: { x: number; y: number } | null;
    readonly inspectorCoord: { x: number; y: number } | null;
  };
  readonly visualFrame: VisualGridFrame;
}

const RAW_ID_REGEX = /\b(district_|landmark_|npc_|item_|mat_)[a-z0-9_]+\b/g;
const TRUNCATED_REGEX = /\b(district_|landmark_|npc_|item_|mat_)[a-z0-9]*_\b/g;
const CLIPPED_TOKENS = ['npc_guild_', 'landmark_stree', 'item_salvage_', 'district_spital_'];

export interface AuditProjectionOptions {
  readonly lookCursor?: { x: number; y: number } | null | undefined;
  readonly inspectorTile?: { x: number; y: number } | null | undefined;
  readonly uiBuffer?: UiCellBuffer | undefined;
}

export function auditUiCellBuffer(
  buffer: UiCellBuffer,
  locationName = 'UiCellBuffer',
): ProjectionLeak[] {
  const leaks: ProjectionLeak[] = [];
  for (let y = 0; y < buffer.height; y++) {
    for (let x = 0; x < buffer.width; x++) {
      const cell = buffer.getCell(x, y);
      const loc = `${locationName} (${x}, ${y})`;
      if (!cell) {
        leaks.push({ category: 'MALFORMED_UI_CELL', location: loc, text: 'MISSING_CELL', details: 'Null cell' });
        continue;
      }
      if (!cell.glyph) {
        leaks.push({ category: 'MALFORMED_UI_CELL', location: loc, text: 'EMPTY_GLYPH', details: 'Empty glyph' });
      }
      if (!cell.fg || !cell.bg) {
        leaks.push({ category: 'MALFORMED_UI_CELL', location: loc, text: 'MISSING_PALETTE_COLOR', details: `fg=${cell.fg}, bg=${cell.bg}` });
      }
      if (cell.hitAction !== undefined && cell.hitAction.trim().length === 0) {
        leaks.push({ category: 'MALFORMED_UI_CELL', location: loc, text: 'EMPTY_HIT_ACTION', details: 'Empty hitAction' });
      }
    }
  }
  return leaks;
}

export function auditClientProjection(
  state: WorldState,
  playerId: EntityId = EntityIdSchema.parse('actor_player'),
  options?: AuditProjectionOptions,
): ClientProjectionAudit {
  const leaks: ProjectionLeak[] = [];
  const visualFrame = projectWorldToVisualFrame(state, playerId);

  const player = state.entities[playerId];
  const pos = player?.position;

  // 1. HUD Labels
  const hudLabels: string[] = [
    'TACTICAL TELEMETRY',
    resolveCatalogDisplayName('district', state.currentDistrictId ?? 'district_spitalfields_soot_works'),
    pos?.stratum ?? 'STREET',
    `(${pos?.x ?? 0}, ${pos?.y ?? 0})`,
    `Turn ${state.turnCount} (Tick #${state.macroTickCount})`,
    'VITALS & ENERGY RESERVES',
    `Sanguine Volume: ${player?.anatomy?.bloodVolumePct ?? 100}%`,
    `Boiler Pressure: ${player?.anatomy?.steamReserveKpa ?? 0} / 200 kPa`,
    `Cartel Treasury: ${state.economy?.playerTreasuryPence ?? 0}d`,
  ];

  // 2. Radar Rows
  const radarRows: string[] = [];
  if (pos) {
    const nearby = Object.values(state.entities)
      .filter((ent) => ent.position && ent.id !== playerId && ent.position.stratum === pos.stratum)
      .slice(0, 4);

    for (const ent of nearby) {
      const label = ent.aiController
        ? `${ent.aiController.role}: ${ent.name ?? resolveCatalogDisplayName('actor', ent.id)}`
        : ent.item
          ? `Item: ${ent.name ?? resolveCatalogDisplayName('item', ent.item.blueprintId)}`
          : ent.portal
            ? `Portal: ${ent.portal.portalLabel ?? 'Passage'}`
            : (ent.name ?? resolveCatalogDisplayName('landmark', ent.id));
      radarRows.push(label);
    }
  }

  // 3. Modal Titles
  const modalTitles: string[] = [
    'SATCHEL [I]',
    'VITRUVIAN ANATOMY & GRAFTS [A]',
    'ARTIFICER SCHEMATIC BENCH [C]',
    'DUAL-COLUMN EXCHANGE & FACTIONS [M]',
    'WORLD ATLAS & CARTOGRAPHY [W]',
    'COMMODITIES EXCHANGE & MERCHANDISE',
    'SYSTEM & ARCHIVAL DIRECTIVE',
    'STRATUM & METROPOLIS CARTOGRAPHY',
    'VICTORIAN CORONER MORTUARY REPORT',
  ];

  // 4. Chronicle Strings (last 5 events)
  const recentEvents = state.eventLog.slice(-5).reverse();
  const chronicleStrings: string[] = recentEvents.map((ev) => formatEventMessage(ev));

  // Scan strings for raw identifiers and truncated tokens
  const stringGroups: Array<{ name: string; strings: readonly string[] }> = [
    { name: 'HUD', strings: hudLabels },
    { name: 'Radar', strings: radarRows },
    { name: 'Modal', strings: modalTitles },
    { name: 'Chronicle', strings: chronicleStrings },
  ];

  for (const group of stringGroups) {
    for (const str of group.strings) {
      // Check for raw snake_case leaks
      const rawMatches = str.match(RAW_ID_REGEX);
      if (rawMatches) {
        for (const m of rawMatches) {
          leaks.push({
            category: 'RAW_IDENTIFIER',
            location: `${group.name} string`,
            text: m,
            details: `Found unformatted identifier '${m}' in '${str}'`,
          });
        }
      }

      // Check for truncated strings ending in underscore
      const truncMatches = str.match(TRUNCATED_REGEX);
      if (truncMatches) {
        for (const tm of truncMatches) {
          leaks.push({
            category: 'TRUNCATED_STRING',
            location: `${group.name} string`,
            text: tm,
            details: `Found truncated identifier ending with underscore in '${str}'`,
          });
        }
      }

      // Check for clipped token fragments
      for (const clipped of CLIPPED_TOKENS) {
        if (str.includes(clipped)) {
          leaks.push({
            category: 'TRUNCATED_STRING',
            location: `${group.name} string`,
            text: clipped,
            details: `Found clipped token '${clipped}' in '${str}'`,
          });
        }
      }
    }
  }

  // Check 5: LookCursorOverlay vs TileInspectorPanel coordinate sync
  let lookSync = {
    synchronized: true,
    lookCursorCoord: options?.lookCursor ?? null,
    inspectorCoord: options?.inspectorTile ?? null,
  };
  if (options?.lookCursor && options?.inspectorTile) {
    if (
      options.lookCursor.x !== options.inspectorTile.x ||
      options.lookCursor.y !== options.inspectorTile.y
    ) {
      lookSync = {
        synchronized: false,
        lookCursorCoord: options.lookCursor,
        inspectorCoord: options.inspectorTile,
      };
      leaks.push({
        category: 'DESYNC_COORDINATES',
        location: 'LookCursorOverlay vs TileInspectorPanel',
        text: `Look (${options.lookCursor.x}, ${options.lookCursor.y}) !== Inspector (${options.inspectorTile.x}, ${options.inspectorTile.y})`,
        details: 'LookCursor coordinates do not match hovered TileInspectorPanel coordinates.',
      });
    }
  }

  // Check 6: Duplicate consecutive movement entries in five-line ACTION CHRONICLE
  const chronological = state.eventLog.slice(-5);
  for (let i = 1; i < chronological.length; i++) {
    const cur = chronological[i];
    const prev = chronological[i - 1];
    if (
      cur?.type === 'ENTITY_MOVED' &&
      prev?.type === 'ENTITY_MOVED' &&
      cur.actorId === prev.actorId &&
      cur.to.x === prev.to.x &&
      cur.to.y === prev.to.y &&
      cur.to.stratum === prev.to.stratum
    ) {
      leaks.push({
        category: 'DUPLICATE_CHRONICLE',
        location: 'ACTION CHRONICLE',
        text: `Duplicate consecutive ENTITY_MOVED to (${cur.to.x}, ${cur.to.y}) on turn ${cur.turn}`,
        details: 'Consecutive duplicate movement log entries detected in recent chronicle window.',
      });
    }
  }

  // Check 7: Audit UiCellBuffer if active
  if (options?.uiBuffer) {
    const uiLeaks = auditUiCellBuffer(options.uiBuffer, 'TacticalUiBuffer');
    leaks.push(...uiLeaks);
  }

  return {
    leaks,
    leakCount: leaks.length,
    hudLabels,
    radarRows,
    modalTitles,
    chronicleStrings,
    lookCursorSync: lookSync,
    visualFrame,
  };
}
