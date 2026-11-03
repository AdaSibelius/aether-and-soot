import { UiCellBuffer } from '../../src/client/canvas-ui/cell-buffer.js';

export type ProjectionSourceGroup = 'HUD' | 'Radar' | 'Modal' | 'Chronicle' | 'TacticalUiBuffer' | 'System';

export interface ProjectionLeak {
  readonly category: 'RAW_IDENTIFIER' | 'TRUNCATED_STRING' | 'DESYNC_COORDINATES' | 'DUPLICATE_CHRONICLE' | 'MALFORMED_UI_CELL';
  readonly location: string;
  readonly text: string;
  readonly sourceGroup?: ProjectionSourceGroup | string;
  readonly coordinate?: { readonly x: number; readonly y: number } | undefined;
  readonly details?: string;
}

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
      const coordinate = { x, y };
      const sourceGroup: ProjectionSourceGroup = 'TacticalUiBuffer';
      if (!cell) {
        leaks.push({ category: 'MALFORMED_UI_CELL', location: loc, text: 'MISSING_CELL', details: 'Null cell', sourceGroup, coordinate });
        continue;
      }
      if (!cell.glyph) {
        leaks.push({ category: 'MALFORMED_UI_CELL', location: loc, text: 'EMPTY_GLYPH', details: 'Empty glyph', sourceGroup, coordinate });
      }
      if (!cell.fg || !cell.bg) {
        leaks.push({ category: 'MALFORMED_UI_CELL', location: loc, text: 'MISSING_PALETTE_COLOR', details: `fg=${cell.fg}, bg=${cell.bg}`, sourceGroup, coordinate });
      }
      if (cell.hitAction !== undefined && cell.hitAction.trim().length === 0) {
        leaks.push({ category: 'MALFORMED_UI_CELL', location: loc, text: 'EMPTY_HIT_ACTION', details: 'Empty hitAction', sourceGroup, coordinate });
      }
    }
  }
  return leaks;
}
