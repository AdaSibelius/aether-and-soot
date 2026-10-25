import { UiCellBuffer } from '../../src/client/canvas-ui/cell-buffer.js';

export interface ProjectionLeak {
  readonly category: 'RAW_IDENTIFIER' | 'TRUNCATED_STRING' | 'DESYNC_COORDINATES' | 'DUPLICATE_CHRONICLE' | 'MALFORMED_UI_CELL';
  readonly location: string;
  readonly text: string;
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
