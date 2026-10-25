import { VICTORIAN_PALETTE } from './material-palette.js';
import { UiCellWriteTarget, UiRect } from './viewport-controls.js';

export interface UiCell {
  glyph: string;
  fg: string;
  bg: string;
  shaderFlags?: readonly string[];
  hitAction?: string;
}

export class UiCellBuffer implements UiCellWriteTarget {
  public readonly width: number;
  public readonly height: number;
  public readonly grid: UiCell[][];

  constructor(width: number, height: number, defaultCell: Partial<UiCell> = {}) {
    this.width = width;
    this.height = height;
    const baseGlyph = defaultCell.glyph ?? ' ';
    const baseFg = defaultCell.fg ?? VICTORIAN_PALETTE.SEPIA_INK;
    const baseBg = defaultCell.bg ?? VICTORIAN_PALETTE.SOOT_IRON_BG;

    this.grid = Array.from({ length: height }, () =>
      Array.from({ length: width }, () => ({
        glyph: baseGlyph,
        fg: baseFg,
        bg: baseBg,
      }))
    );
  }

  public setCell(
    x: number,
    y: number,
    glyph: string,
    fg: string = VICTORIAN_PALETTE.SEPIA_INK,
    bg: string = VICTORIAN_PALETTE.SOOT_IRON_BG,
    shaderFlags?: string | readonly string[],
    hitAction?: string,
  ): void {
    if (x < 0 || x >= this.width || y < 0 || y >= this.height) return;
    const row = this.grid[y];
    if (!row) return;

    const cell: UiCell = { glyph, fg, bg };
    if (shaderFlags) {
      cell.shaderFlags = typeof shaderFlags === 'string' ? [shaderFlags] : shaderFlags;
    }
    if (hitAction) {
      cell.hitAction = hitAction;
    }
    row[x] = cell;
  }

  public getCell(col: number, row: number): UiCell | undefined {
    if (col < 0 || col >= this.width || row < 0 || row >= this.height) return undefined;
    return this.grid[row]?.[col];
  }

  public writeString(
    x: number,
    y: number,
    text: string,
    fg: string = VICTORIAN_PALETTE.SEPIA_INK,
    bg: string = VICTORIAN_PALETTE.SOOT_IRON_BG,
    shaderFlags?: string | readonly string[],
    hitAction?: string,
  ): void {
    if (y < 0 || y >= this.height) return;
    for (let i = 0; i < text.length; i++) {
      const cx = x + i;
      if (cx >= this.width) break;
      const char = text[i] ?? ' ';
      this.setCell(cx, y, char, fg, bg, shaderFlags, hitAction);
    }
  }

  public fillRect(
    rect: UiRect,
    glyph: string,
    fg: string = VICTORIAN_PALETTE.SEPIA_INK,
    bg: string = VICTORIAN_PALETTE.SOOT_IRON_BG,
    shaderFlags?: string | readonly string[],
  ): void {
    const maxX = Math.min(this.width, rect.x + rect.width);
    const maxY = Math.min(this.height, rect.y + rect.height);
    for (let y = Math.max(0, rect.y); y < maxY; y++) {
      for (let x = Math.max(0, rect.x); x < maxX; x++) {
        this.setCell(x, y, glyph, fg, bg, shaderFlags);
      }
    }
  }

  public writeWrappedText(
    rect: UiRect,
    text: string,
    options: {
      readonly fg?: string;
      readonly bg?: string;
      readonly shaderFlags?: readonly string[];
      readonly align?: 'LEFT' | 'CENTER' | 'RIGHT';
      readonly jitterIndent?: boolean;
    } = {},
  ): number {
    const fg = options.fg ?? VICTORIAN_PALETTE.SEPIA_INK;
    const bg = options.bg ?? VICTORIAN_PALETTE.SOOT_IRON_BG;
    const align = options.align ?? 'LEFT';
    const words = text.split(/\s+/).filter(Boolean);
    const lines: string[] = [];
    let currentLine = '';

    for (const word of words) {
      const testLine = currentLine.length === 0 ? word : `${currentLine} ${word}`;
      if (testLine.length <= rect.width) {
        currentLine = testLine;
      } else {
        if (currentLine) lines.push(currentLine);
        currentLine = word.slice(0, rect.width);
      }
    }
    if (currentLine) lines.push(currentLine);

    const maxLines = Math.min(rect.height, lines.length);
    for (let r = 0; r < maxLines; r++) {
      const lineText = lines[r] ?? '';
      let startX = rect.x;
      if (align === 'CENTER') {
        startX = rect.x + Math.max(0, Math.floor((rect.width - lineText.length) / 2));
      } else if (align === 'RIGHT') {
        startX = rect.x + Math.max(0, rect.width - lineText.length);
      } else if (options.jitterIndent && r % 2 === 1 && rect.width > lineText.length + 1) {
        startX = rect.x + 1; // Subtle letterpress alignment imperfection
      }
      this.writeString(startX, rect.y + r, lineText, fg, bg, options.shaderFlags);
    }
    return maxLines;
  }

  public extractRowString(rowIdx: number): string {
    const row = this.grid[rowIdx];
    if (!row) return '';
    return row.map((c) => c.glyph).join('');
  }

  public resolveHitActionAt(col: number, row: number): string | undefined {
    return this.getCell(col, row)?.hitAction;
  }
}

export function createUiCellBuffer(
  width: number,
  height: number,
  defaultCell?: Partial<UiCell>,
): UiCellBuffer {
  return new UiCellBuffer(width, height, defaultCell);
}
