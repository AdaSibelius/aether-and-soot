import { UiCellBuffer } from './cell-buffer.js';
import {
  resolveVisualDepthTier,
  VICTORIAN_PALETTE,
  VisualDepthTierKey,
} from './material-palette.js';
import { UiRect } from './viewport-controls.js';

export interface BezelOptions {
  readonly title?: string;
  readonly subtitle?: string;
  readonly rivetStyle?: 'BRASS_BOLTS' | 'STEEL_STUDS' | 'INDUSTRIAL_GEARS';
  readonly fgColor?: string;
  readonly bgColor?: string;
  readonly tier?: VisualDepthTierKey;
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

  const tierConfig = options.tier ? resolveVisualDepthTier(options.tier) : undefined;
  const fg = options.fgColor ?? tierConfig?.border ?? VICTORIAN_PALETTE.TARNISHED_BRASS;
  const bg = options.bgColor ?? tierConfig?.bg ?? VICTORIAN_PALETTE.SOOT_IRON_BG;
  const rivet = options.rivetStyle === 'INDUSTRIAL_GEARS' ? '⚙' : options.rivetStyle === 'STEEL_STUDS' ? 'Ø' : '☼';

  // 0. Opaque recessed housing fill so underlying world glyphs never bleed through bezel panels
  for (let row = 1; row < height - 1; row++) {
    for (let col = 1; col < width - 1; col++) {
      buf.setCell(x + col, y + row, ' ', fg, bg);
    }
  }

  // 1. Horizontal double borders (CP437 ═)
  for (let col = 1; col < width - 1; col++) {
    buf.setCell(x + col, y, '═', fg, bg);
    buf.setCell(x + col, y + height - 1, '═', fg, bg);
  }

  // 2. Vertical double borders (CP437 ║)
  for (let row = 1; row < height - 1; row++) {
    buf.setCell(x, y + row, '║', fg, bg);
    buf.setCell(x + width - 1, y + row, '║', fg, bg);
  }

  // 3. Corner rivet housings (CP437 ╔, ╗, ╚, ╝)
  buf.setCell(x, y, '╔', fg, bg);
  buf.setCell(x + width - 1, y, '╗', fg, bg);
  buf.setCell(x, y + height - 1, '╚', fg, bg);
  buf.setCell(x + width - 1, y + height - 1, '╝', fg, bg);

  // Exterior structural rivets on perimeter
  const rivetColor = tierConfig?.accent ?? VICTORIAN_PALETTE.RIVET_STEEL;
  if (width > 6) {
    buf.setCell(x + 1, y, rivet, rivetColor, bg);
    buf.setCell(x + width - 2, y, rivet, rivetColor, bg);
    buf.setCell(x + 1, y + height - 1, rivet, rivetColor, bg);
    buf.setCell(x + width - 2, y + height - 1, rivet, rivetColor, bg);
  }

  // 4. Engraved Title Header Housing
  if (options.title) {
    const formattedTitle = `╡ ${options.title.toUpperCase()} ╞`;
    const titleStart = x + Math.max(3, Math.floor((width - formattedTitle.length) / 2));
    const titleFg = tierConfig ? tierConfig.fg : VICTORIAN_PALETTE.POLISHED_BRASS;
    buf.writeString(titleStart, y, formattedTitle, titleFg, bg);
  }

  // 5. Engraved Subtitle / Calibration Marking
  if (options.subtitle && height > 4) {
    const subStr = `[${options.subtitle}]`;
    const subStart = x + Math.max(3, Math.floor((width - subStr.length) / 2));
    const subFg = tierConfig ? tierConfig.accent : VICTORIAN_PALETTE.VERDIGRIS;
    buf.writeString(subStart, y + height - 1, subStr, subFg, bg);
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
  tier?: VisualDepthTierKey,
): void {
  if (length <= 0) return;

  const tierConfig = tier ? resolveVisualDepthTier(tier) : undefined;
  const resolvedFg = tierConfig?.border ?? fg;
  const resolvedBg = tierConfig?.bg ?? bg;

  if (orientation === 'HORIZONTAL') {
    buf.setCell(x, y, '╠', resolvedFg, resolvedBg);
    for (let c = 1; c < length - 1; c++) {
      buf.setCell(x + c, y, '═', resolvedFg, resolvedBg);
    }
    buf.setCell(x + length - 1, y, '╣', resolvedFg, resolvedBg);
  } else {
    buf.setCell(x, y, '╦', resolvedFg, resolvedBg);
    for (let r = 1; r < length - 1; r++) {
      buf.setCell(x, y + r, '║', resolvedFg, resolvedBg);
    }
    buf.setCell(x + length - 1, y, '╩', resolvedFg, resolvedBg);
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
