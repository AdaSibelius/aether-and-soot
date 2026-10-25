import { UiCellBuffer } from './cell-buffer.js';
import { VICTORIAN_PALETTE } from './material-palette.js';

export interface ConduitPoint {
  readonly x: number;
  readonly y: number;
}

export interface ConduitRouteOptions {
  readonly signalProgress?: number;
  readonly fg?: string;
  readonly bg?: string;
  readonly activeFg?: string;
  readonly isHorizontalFirst?: boolean;
}

export interface ConduitCell {
  readonly x: number;
  readonly y: number;
  readonly glyph: string;
}

export interface ConduitRouteResult {
  readonly pathLength: number;
  readonly path: readonly ConduitCell[];
}

export function drawAsciiConduit(
  buf: UiCellBuffer,
  fromPoint: ConduitPoint,
  toPoint: ConduitPoint,
  options: ConduitRouteOptions = {},
): ConduitRouteResult {
  const fg = options.fg ?? VICTORIAN_PALETTE.MUTED_PIPE;
  const bg = options.bg ?? VICTORIAN_PALETTE.SOOT_IRON_BG;
  const activeFg = options.activeFg ?? VICTORIAN_PALETTE.AETHER_BLUE;
  const signalProgress = options.signalProgress;
  const isHorizontalFirst = options.isHorizontalFirst ?? true;

  const path: ConduitCell[] = [];
  const dx = toPoint.x - fromPoint.x;
  const dy = toPoint.y - fromPoint.y;

  if (isHorizontalFirst) {
    // 1. Horizontal segment from fromPoint.x to toPoint.x at y = fromPoint.y
    const stepX = dx >= 0 ? 1 : -1;
    for (let x = fromPoint.x; x !== toPoint.x; x += stepX) {
      const isStart = x === fromPoint.x;
      const glyph = isStart ? '╠' : '═';
      path.push({ x, y: fromPoint.y, glyph });
    }

    // 2. Corner at (toPoint.x, fromPoint.y) if direction changes
    if (dy !== 0) {
      let cornerGlyph = '╬';
      if (dx >= 0 && dy > 0) cornerGlyph = '╗';
      else if (dx >= 0 && dy < 0) cornerGlyph = '╝';
      else if (dx < 0 && dy > 0) cornerGlyph = '╔';
      else if (dx < 0 && dy < 0) cornerGlyph = '╚';
      path.push({ x: toPoint.x, y: fromPoint.y, glyph: cornerGlyph });

      // 3. Vertical segment from fromPoint.y to toPoint.y at x = toPoint.x
      const stepY = dy >= 0 ? 1 : -1;
      for (let y = fromPoint.y + stepY; y !== toPoint.y; y += stepY) {
        path.push({ x: toPoint.x, y, glyph: '║' });
      }
    }

    // 4. End cap / terminus at toPoint
    const endGlyph = dy === 0 ? '╣' : '╬';
    path.push({ x: toPoint.x, y: toPoint.y, glyph: endGlyph });
  } else {
    // Vertical first
    const stepY = dy >= 0 ? 1 : -1;
    for (let y = fromPoint.y; y !== toPoint.y; y += stepY) {
      const isStart = y === fromPoint.y;
      const glyph = isStart ? '╦' : '║';
      path.push({ x: fromPoint.x, y, glyph });
    }
    if (dx !== 0) {
      let cornerGlyph = '╬';
      if (dy >= 0 && dx > 0) cornerGlyph = '╚';
      else if (dy >= 0 && dx < 0) cornerGlyph = '╝';
      else if (dy < 0 && dx > 0) cornerGlyph = '╔';
      else if (dy < 0 && dx < 0) cornerGlyph = '╗';
      path.push({ x: fromPoint.x, y: toPoint.y, glyph: cornerGlyph });

      const stepX = dx >= 0 ? 1 : -1;
      for (let x = fromPoint.x + stepX; x !== toPoint.x; x += stepX) {
        path.push({ x, y: toPoint.y, glyph: '═' });
      }
    }
    const endGlyph = dx === 0 ? '╩' : '╬';
    path.push({ x: toPoint.x, y: toPoint.y, glyph: endGlyph });
  }

  // Calculate 3-cell traveling highlight pulse if signalProgress is active
  let activeIndices: Set<number> | null = null;
  if (signalProgress !== undefined && signalProgress >= 0 && signalProgress <= 1 && path.length > 0) {
    const centerIdx = Math.round(signalProgress * (path.length - 1));
    activeIndices = new Set([centerIdx - 1, centerIdx, centerIdx + 1]);
  }

  // Draw conduit path into buffer
  for (let idx = 0; idx < path.length; idx++) {
    const cell = path[idx]!;
    const isLit = activeIndices?.has(idx) ?? false;
    const cellFg = isLit ? activeFg : fg;
    const shader = isLit ? ['AETHER_HALATION'] : undefined;
    buf.setCell(cell.x, cell.y, cell.glyph, cellFg, bg, shader);
  }

  return { pathLength: path.length, path };
}
