import { UiCellBuffer } from './cell-buffer.js';
import { VICTORIAN_PALETTE } from './material-palette.js';
import { UiRect } from './viewport-controls.js';

export interface BezelOptions {
  readonly title?: string;
  readonly subtitle?: string;
  readonly rivetStyle?: 'BRASS_BOLTS' | 'STEEL_STUDS' | 'INDUSTRIAL_GEARS';
  readonly fgColor?: string;
  readonly bgColor?: string;
}

/**
 * Renders a heavy Victorian machined brass/iron console bezel with double-line conduits,
 * structural corner rivets, engraved title brackets, and recessed display housing.
 */
export function drawMachinedBezel(
  buf: UiCellBuffer,
  rect: UiRect,
  options: BezelOptions = {},
): void {
  const { x, y, width, height } = rect;
  if (width < 3 || height < 3) return;

  const fg = options.fgColor ?? VICTORIAN_PALETTE.TARNISHED_BRASS;
  const bg = options.bgColor ?? VICTORIAN_PALETTE.SOOT_IRON_BG;
  const rivet = options.rivetStyle === 'INDUSTRIAL_GEARS' ? '⚙' : options.rivetStyle === 'STEEL_STUDS' ? 'Ø' : '☼';

  // 0. Opaque recessed housing fill so underlying world glyphs never bleed through bezel panels
  for (let row = 1; row < height - 1; row++) {
    for (let col = 1; col < width - 1; col++) {
      buf.setCell(x + col, y + row, ' ', fg, bg);
    }
  }

  // 1. Horizontal borders
  for (let col = 1; col < width - 1; col++) {
    buf.setCell(x + col, y, '═', fg, bg);
    buf.setCell(x + col, y + height - 1, '═', fg, bg);
  }

  // 2. Vertical borders
  for (let row = 1; row < height - 1; row++) {
    buf.setCell(x, y + row, '║', fg, bg);
    buf.setCell(x + width - 1, y + row, '║', fg, bg);
  }

  // 3. Corner rivet housings
  buf.setCell(x, y, '╔', fg, bg);
  buf.setCell(x + width - 1, y, '╗', fg, bg);
  buf.setCell(x, y + height - 1, '╚', fg, bg);
  buf.setCell(x + width - 1, y + height - 1, '╝', fg, bg);

  // Exterior structural rivets on perimeter
  if (width > 6) {
    buf.setCell(x + 1, y, rivet, VICTORIAN_PALETTE.RIVET_STEEL, bg);
    buf.setCell(x + width - 2, y, rivet, VICTORIAN_PALETTE.RIVET_STEEL, bg);
    buf.setCell(x + 1, y + height - 1, rivet, VICTORIAN_PALETTE.RIVET_STEEL, bg);
    buf.setCell(x + width - 2, y + height - 1, rivet, VICTORIAN_PALETTE.RIVET_STEEL, bg);
  }

  // 4. Engraved Title Header Housing
  if (options.title) {
    const formattedTitle = `╡ ${options.title.toUpperCase()} ╞`;
    const titleStart = x + Math.max(3, Math.floor((width - formattedTitle.length) / 2));
    buf.writeString(titleStart, y, formattedTitle, VICTORIAN_PALETTE.POLISHED_BRASS, bg);
  }

  // 5. Engraved Subtitle / Calibration Marking
  if (options.subtitle && height > 4) {
    const subStr = `[${options.subtitle}]`;
    const subStart = x + Math.max(3, Math.floor((width - subStr.length) / 2));
    buf.writeString(subStart, y + height - 1, subStr, VICTORIAN_PALETTE.VERDIGRIS_PATINA, bg);
  }
}

/**
 * Draws a rigid pressure-line divider or structural partition separating instrument dials.
 */
export function drawStructuralDivider(
  buf: UiCellBuffer,
  x: number,
  y: number,
  length: number,
  orientation: 'HORIZONTAL' | 'VERTICAL' = 'HORIZONTAL',
  fg = VICTORIAN_PALETTE.TARNISHED_BRASS,
  bg = VICTORIAN_PALETTE.SOOT_IRON_BG,
): void {
  if (length <= 0) return;

  if (orientation === 'HORIZONTAL') {
    buf.setCell(x, y, '╠', fg, bg);
    for (let c = 1; c < length - 1; c++) {
      buf.setCell(x + c, y, '═', fg, bg);
    }
    buf.setCell(x + length - 1, y, '╣', fg, bg);
  } else {
    buf.setCell(x, y, '╦', fg, bg);
    for (let r = 1; r < length - 1; r++) {
      buf.setCell(x, y + r, '║', fg, bg);
    }
    buf.setCell(x, y + length - 1, '╩', fg, bg);
  }
}

/**
 * Emplaces a high-torque machined rivet cluster at structural stress intersections.
 */
export function drawRivetFlange(
  buf: UiCellBuffer,
  x: number,
  y: number,
  fg = VICTORIAN_PALETTE.RIVET_STEEL,
  bg = VICTORIAN_PALETTE.SOOT_IRON_BG,
): void {
  buf.setCell(x, y, '◈', fg, bg);
  buf.setCell(x + 1, y, '◈', fg, bg);
}
