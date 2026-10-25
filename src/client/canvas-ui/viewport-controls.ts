export interface UiRect {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export interface UiCellWriteTarget {
  readonly width: number;
  readonly height: number;
  setCell(x: number, y: number, glyph: string, fg?: string, bg?: string, shaderFlag?: string): void;
  getCell?(x: number, y: number): { glyph: string; fg?: string; bg?: string; shaderFlag?: string } | undefined;
}

export interface ScrollResult {
  readonly maxScrollOffset: number;
  readonly clampedScrollOffset: number;
  readonly isScrollable: boolean;
  readonly thumbY: number;
}

export class TestCellBuffer implements UiCellWriteTarget {
  public readonly width: number;
  public readonly height: number;
  public readonly grid: { glyph: string; fg?: string; bg?: string; shaderFlag?: string }[][];

  constructor(width: number, height: number, defaultGlyph = ' ') {
    this.width = width;
    this.height = height;
    this.grid = Array.from({ length: height }, () =>
      Array.from({ length: width }, () => ({ glyph: defaultGlyph }))
    );
  }

  public setCell(x: number, y: number, glyph: string, fg?: string, bg?: string, shaderFlag?: string): void {
    if (x >= 0 && x < this.width && y >= 0 && y < this.height) {
      const row = this.grid[y];
      if (row) {
        const cell: { glyph: string; fg?: string; bg?: string; shaderFlag?: string } = { glyph };
        if (fg !== undefined) cell.fg = fg;
        if (bg !== undefined) cell.bg = bg;
        if (shaderFlag !== undefined) cell.shaderFlag = shaderFlag;
        row[x] = cell;
      }
    }
  }

  public getCell(x: number, y: number) {
    return (x >= 0 && x < this.width && y >= 0 && y < this.height) ? this.grid[y]?.[x] : undefined;
  }

  public getRowText(y: number): string {
    return (this.grid[y] ?? []).map((c) => c.glyph).join('');
  }
}

export function drawScrollableRegion(
  buf: UiCellWriteTarget,
  rect: UiRect,
  lines: readonly string[],
  scrollOffset: number,
  options: {
    readonly fgText?: string;
    readonly bgText?: string;
    readonly fgScrollbar?: string;
    readonly fgTrack?: string;
    readonly bgTrack?: string;
  } = {},
): ScrollResult {
  const fgText = options.fgText ?? '#d2c29d', bgText = options.bgText ?? '#0b0c0e';
  const fgScrollbar = options.fgScrollbar ?? '#d4af37', fgTrack = options.fgTrack ?? '#594928', bgTrack = options.bgTrack ?? '#14171a';
  const isScrollable = lines.length > rect.height;
  const maxScrollOffset = Math.max(0, lines.length - rect.height);
  const clampedScrollOffset = Math.min(Math.max(0, scrollOffset), maxScrollOffset);
  const contentWidth = isScrollable ? Math.max(1, rect.width - 1) : rect.width;

  for (let row = 0; row < rect.height; row++) {
    const lineIdx = clampedScrollOffset + row;
    const line = lineIdx < lines.length ? lines[lineIdx] ?? '' : '';
    const py = rect.y + row;
    for (let col = 0; col < contentWidth; col++) {
      buf.setCell(rect.x + col, py, col < line.length ? line[col] ?? ' ' : ' ', fgText, bgText);
    }
  }

  if (!isScrollable) {
    return { maxScrollOffset: 0, clampedScrollOffset: 0, isScrollable: false, thumbY: rect.y };
  }

  const trackX = rect.x + rect.width - 1;
  buf.setCell(trackX, rect.y, '▲', fgScrollbar, bgTrack);
  buf.setCell(trackX, rect.y + rect.height - 1, '▼', fgScrollbar, bgTrack);

  const trackHeight = Math.max(1, rect.height - 2);
  const thumbRelativeY = maxScrollOffset > 0 ? Math.round((clampedScrollOffset / maxScrollOffset) * (trackHeight - 1)) : 0;
  const thumbY = rect.y + 1 + thumbRelativeY;

  for (let r = 0; r < trackHeight; r++) {
    const currentY = rect.y + 1 + r;
    const isThumb = currentY === thumbY;
    buf.setCell(trackX, currentY, isThumb ? '█' : '║', isThumb ? fgScrollbar : fgTrack, bgTrack);
  }

  return { maxScrollOffset, clampedScrollOffset, isScrollable: true, thumbY };
}

export function drawDiegeticTextInput(
  buf: UiCellWriteTarget,
  rect: UiRect,
  label: string,
  value: string,
  isFocused: boolean,
  tick: number,
  options: {
    readonly fgBorder?: string;
    readonly fgLabel?: string;
    readonly fgValue?: string;
    readonly fgCursor?: string;
    readonly bg?: string;
  } = {},
): void {
  const fgBorder = isFocused ? (options.fgBorder ?? '#4deeea') : '#7f8c8d';
  const fgLabel = options.fgLabel ?? '#d4af37', fgValue = options.fgValue ?? '#ffffff';
  const fgCursor = options.fgCursor ?? (isFocused ? '#4deeea' : '#7f8c8d');
  const bg = options.bg ?? '#0b0c0e';
  const showCursor = isFocused && Math.floor(tick / 30) % 2 === 0;

  if (rect.height >= 2) {
    const header = label ? `[ ${label} ]` : '';
    for (let c = 0; c < rect.width; c++) {
      buf.setCell(rect.x + c, rect.y, c < header.length ? header[c] ?? ' ' : ' ', fgLabel, bg);
    }
    const inputY = rect.y + 1;
    buf.setCell(rect.x, inputY, '>', fgBorder, bg);
    buf.setCell(rect.x + 1, inputY, ' ', fgBorder, bg);

    const availableWidth = Math.max(1, rect.width - 2);
    const textWidth = showCursor ? Math.max(1, availableWidth - 1) : availableWidth;
    const visibleValue = value.length > textWidth ? value.slice(value.length - textWidth) : value;

    for (let c = 0; c < visibleValue.length; c++) {
      buf.setCell(rect.x + 2 + c, inputY, visibleValue[c] ?? ' ', fgValue, bg);
    }
    if (showCursor) {
      buf.setCell(rect.x + 2 + visibleValue.length, inputY, '_', fgCursor, bg);
    }
  } else {
    const prefix = label ? `[ ${label}: ` : '[ ', suffix = ' ]';
    const availableWidth = Math.max(1, rect.width - prefix.length - suffix.length);
    const textWidth = showCursor ? Math.max(1, availableWidth - 1) : availableWidth;
    const visibleValue = value.length > textWidth ? value.slice(value.length - textWidth) : value;

    let x = rect.x;
    for (const char of prefix) buf.setCell(x++, rect.y, char, fgLabel, bg);
    for (let c = 0; c < visibleValue.length; c++) buf.setCell(x++, rect.y, visibleValue[c] ?? ' ', fgValue, bg);
    if (showCursor) buf.setCell(x++, rect.y, '_', fgCursor, bg);
    for (const char of suffix) buf.setCell(x++, rect.y, char, fgBorder, bg);
  }
}
