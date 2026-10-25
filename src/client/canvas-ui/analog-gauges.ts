import { UiCellBuffer } from './cell-buffer.js';
import { VICTORIAN_PALETTE } from './material-palette.js';

/**
 * Converts a total copper/pence sum into traditional pre-decimal Victorian currency (£ s d):
 * 1 Pound (£) = 20 Shillings (s) = 240 Pence (d); 1 Shilling (s) = 12 Pence (d).
 */
export function formatVictorianCurrency(penceTotal: number): string {
  const isNegative = penceTotal < 0;
  const abs = Math.abs(penceTotal);
  const pounds = Math.floor(abs / 240);
  const remainder = abs % 240;
  const shillings = Math.floor(remainder / 12);
  const pence = remainder % 12;

  const sign = isNegative ? '-' : '';
  if (pounds > 0) return `${sign}£${pounds} ${shillings}s ${pence}d`;
  if (shillings > 0) return `${sign}${shillings}s ${pence}d`;
  return `${sign}${pence}d`;
}

/**
 * Converts blood volume percentage (0..100) into Victorian imperial liquid measures:
 * Nominal adult human capacity is 8 Imperial Pints (128 Fluid Ounces, 1024 Fluid Drams).
 */
export function formatVictorianFluidMeasures(bloodPct: number): { pints: number; drams: number; formatted: string } {
  const clamped = Math.max(0, Math.min(100, bloodPct));
  const totalDrams = Math.round((clamped / 100) * 1024);
  const pints = Math.floor(totalDrams / 128);
  const drams = totalDrams % 128;
  return {
    pints,
    drams,
    formatted: `${pints} Pts ${drams} Drm`,
  };
}

/**
 * Draws a circular Bourdon steam pressure dial with a calibrated arc scale and radial needle.
 */
export function drawBourdonPressureGauge(
  buf: UiCellBuffer,
  x: number,
  y: number,
  currentKpa: number,
  maxKpa = 100,
): void {
  const ratio = Math.max(0, Math.min(1.0, currentKpa / Math.max(1, maxKpa)));
  const isCritical = currentKpa >= 85;
  const isElevated = currentKpa >= 50;

  const arcColors = isCritical
    ? [VICTORIAN_PALETTE.WARN_RED, VICTORIAN_PALETTE.WARN_RED]
    : isElevated
    ? [VICTORIAN_PALETTE.COPPER_ACCENT, VICTORIAN_PALETTE.WARN_RED]
    : [VICTORIAN_PALETTE.OK_GREEN, VICTORIAN_PALETTE.POLISHED_BRASS];

  // Draw 5-step analog arc: [ .  :  |  !  ▲ ]
  const arcScale = ['░', '▒', '▓', '█', '■'];
  const pointerIdx = Math.min(arcScale.length - 1, Math.floor(ratio * arcScale.length));

  buf.writeString(x, y, '╭──BOURDON──╮', VICTORIAN_PALETTE.TARNISHED_BRASS);
  buf.setCell(x, y + 1, '│', VICTORIAN_PALETTE.TARNISHED_BRASS);

  for (let i = 0; i < arcScale.length; i++) {
    const isPointer = i === pointerIdx;
    const glyph = isPointer ? '▲' : arcScale[i]!;
    const color = isCritical ? VICTORIAN_PALETTE.WARN_RED : arcColors[i > 2 ? 1 : 0]!;
    buf.setCell(x + 2 + i * 2, y + 1, glyph, color, VICTORIAN_PALETTE.SOOT_IRON_BG);
  }

  buf.setCell(x + 12, y + 1, '│', VICTORIAN_PALETTE.TARNISHED_BRASS);
  const readout = `${Math.round(currentKpa)}/${maxKpa}k`;
  buf.writeString(x + 2, y + 2, readout.padStart(9, ' '), isCritical ? VICTORIAN_PALETTE.WARN_RED : VICTORIAN_PALETTE.POLISHED_BRASS);
  buf.writeString(x, y + 3, '╰───────────╯', VICTORIAN_PALETTE.TARNISHED_BRASS);
}

/**
 * Draws a vertical galvanic/mercury manometer column monitoring blood volume.
 */
export function drawSanguineManometer(
  buf: UiCellBuffer,
  x: number,
  y: number,
  bloodPct: number,
  height = 8,
): void {
  if (height < 4) return;
  const { pints, drams } = formatVictorianFluidMeasures(bloodPct);
  const fillLevels = Math.round((Math.max(0, Math.min(100, bloodPct)) / 100) * (height - 2));

  buf.writeString(x, y, '┌MANO┐', VICTORIAN_PALETTE.TARNISHED_BRASS);
  for (let r = 1; r < height - 1; r++) {
    const levelFromBottom = (height - 1) - r;
    const isFilled = levelFromBottom <= fillLevels;
    const glyph = isFilled ? '█' : '░';
    const color = isFilled
      ? (bloodPct < 35 ? VICTORIAN_PALETTE.WARN_RED : '#8a1c14')
      : VICTORIAN_PALETTE.SOOT_IRON_BG;

    buf.setCell(x, y + r, '│', VICTORIAN_PALETTE.TARNISHED_BRASS);
    buf.setCell(x + 1, y + r, glyph, color);
    buf.setCell(x + 2, y + r, glyph, color);
    buf.setCell(x + 3, y + r, '│', VICTORIAN_PALETTE.TARNISHED_BRASS);

    if (r === 1) buf.writeString(x + 5, y + r, `${pints} Pts`, '#c0392b');
    if (r === 2) buf.writeString(x + 5, y + r, `${drams} Drm`, VICTORIAN_PALETTE.VERDIGRIS_PATINA);
  }
  buf.writeString(x, y + height - 1, '└────┘', VICTORIAN_PALETTE.TARNISHED_BRASS);
}

/**
 * Renders a split-flap mechanical reel register (e.g. for turns, chronometers, or accounts).
 */
export function drawSplitFlapOdometer(
  buf: UiCellBuffer,
  x: number,
  y: number,
  value: string | number,
  digits = 5,
  label = 'REG',
): void {
  const valStr = String(value).padStart(digits, '0');
  buf.writeString(x, y, `${label}:`, VICTORIAN_PALETTE.TARNISHED_BRASS);

  const startX = x + label.length + 1;
  buf.setCell(startX, y, '[', VICTORIAN_PALETTE.RIVET_STEEL);

  for (let i = 0; i < valStr.length; i++) {
    const char = valStr[i]!;
    buf.setCell(startX + 1 + i * 2, y, char, '#ffffff', '#11161b');
    if (i < valStr.length - 1) {
      buf.setCell(startX + 2 + i * 2, y, '│', '#37474f');
    }
  }

  buf.setCell(startX + valStr.length * 2, y, ']', VICTORIAN_PALETTE.RIVET_STEEL);
}
