import { UiCellBuffer } from './cell-buffer.js';
import {
  resolveThermodynamicPalette,
  ThermodynamicStressLevel,
  VICTORIAN_PALETTE,
} from './material-palette.js';
import { UiRect } from './viewport-controls.js';

export interface IndustrialFrameOptions {
  readonly tier?: 'PRIMARY_IRON' | 'SECONDARY_BRASS' | 'SEPIA_LEDGER';
  readonly title?: string;
  readonly stressLevel?: ThermodynamicStressLevel;
}

export function drawIndustrialFrame(
  buf: UiCellBuffer,
  rect: UiRect,
  options: IndustrialFrameOptions = {},
): void {
  const tier = options.tier ?? 'PRIMARY_IRON';
  const stressLevel = options.stressLevel ?? 'NOMINAL';
  const thermo = resolveThermodynamicPalette(stressLevel);
  const { x, y, width, height } = rect;
  if (width < 2 || height < 2) return;

  if (tier === 'PRIMARY_IRON') {
    const borderFg = thermo.borderFg;
    const bg = thermo.bg;
    const shader = thermo.primaryShaderFlag ? [thermo.primaryShaderFlag] : undefined;

    // Top & Bottom heavy borders
    for (let c = 1; c < width - 1; c++) {
      buf.setCell(x + c, y, '▀', borderFg, bg, shader);
      buf.setCell(x + c, y + height - 1, '▄', borderFg, bg, shader);
    }
    // Left & Right structural iron walls
    for (let r = 1; r < height - 1; r++) {
      buf.setCell(x, y + r, '█', borderFg, bg, shader);
      buf.setCell(x + width - 1, y + r, '█', borderFg, bg, shader);
    }
    // Heavy corner rivets: [O], ☼, Ø
    buf.setCell(x, y, '☼', VICTORIAN_PALETTE.RIVET_STEEL, bg, shader);
    buf.setCell(x + width - 1, y, '☼', VICTORIAN_PALETTE.RIVET_STEEL, bg, shader);
    buf.setCell(x, y + height - 1, 'Ø', VICTORIAN_PALETTE.RIVET_STEEL, bg, shader);
    buf.setCell(x + width - 1, y + height - 1, 'Ø', VICTORIAN_PALETTE.RIVET_STEEL, bg, shader);
  } else if (tier === 'SECONDARY_BRASS') {
    const borderFg = VICTORIAN_PALETTE.TARNISHED_BRASS;
    const bg = VICTORIAN_PALETTE.SOOT_IRON_BG;

    for (let c = 1; c < width - 1; c++) {
      buf.setCell(x + c, y, '═', borderFg, bg);
      buf.setCell(x + c, y + height - 1, '═', borderFg, bg);
    }
    for (let r = 1; r < height - 1; r++) {
      buf.setCell(x, y + r, '║', borderFg, bg);
      buf.setCell(x + width - 1, y + r, '║', borderFg, bg);
    }
    buf.setCell(x, y, '╔', borderFg, bg);
    buf.setCell(x + width - 1, y, '╗', borderFg, bg);
    buf.setCell(x, y + height - 1, '╚', borderFg, bg);
    buf.setCell(x + width - 1, y + height - 1, '╝', borderFg, bg);
  } else {
    // SEPIA_LEDGER
    const borderFg = VICTORIAN_PALETTE.SEPIA_INK;
    const bg = VICTORIAN_PALETTE.SEPIA_PARCHMENT;

    for (let c = 1; c < width - 1; c++) {
      buf.setCell(x + c, y, '─', borderFg, bg);
      buf.setCell(x + c, y + height - 1, '─', borderFg, bg);
    }
    for (let r = 1; r < height - 1; r++) {
      buf.setCell(x, y + r, '⣿', VICTORIAN_PALETTE.TARNISHED_BRASS, bg); // Dense ledger binding spine
      buf.setCell(x + width - 1, y + r, '│', borderFg, bg);
    }
    buf.setCell(x, y, '┌', borderFg, bg);
    buf.setCell(x + width - 1, y, '┐', borderFg, bg);
    buf.setCell(x, y + height - 1, '└', borderFg, bg);
    buf.setCell(x + width - 1, y + height - 1, '┘', borderFg, bg);
  }

  // Centered or framed title header
  if (options.title) {
    const titleText = `[ ${options.title} ]`;
    const startX = x + Math.max(1, Math.floor((width - titleText.length) / 2));
    const titleFg = tier === 'SEPIA_LEDGER' ? VICTORIAN_PALETTE.SEPIA_INK : thermo.accentFg;
    const titleBg = tier === 'SEPIA_LEDGER' ? VICTORIAN_PALETTE.SEPIA_PARCHMENT : thermo.bg;
    buf.writeString(startX, y, titleText, titleFg, titleBg);
  }
}

export interface BrassToggleTab {
  readonly id: string;
  readonly label: string;
  readonly shortcut?: string;
}

export function drawBrassToggleTabs(
  buf: UiCellBuffer,
  x: number,
  y: number,
  tabs: readonly BrassToggleTab[],
  activeTabId: string,
): void {
  let curX = x;
  for (const tab of tabs) {
    const isActive = tab.id === activeTabId;
    const actionKey = `tab:${tab.id}`;
    const displayLabel = tab.shortcut ? `${tab.label} ${tab.shortcut}` : tab.label;

    if (isActive) {
      // Depressed active state: inverted color and shifted 1 cell down
      const text = `[► ${displayLabel} ◄]`;
      buf.writeString(curX, y + 1, text, VICTORIAN_PALETTE.SOOT_IRON_BG, VICTORIAN_PALETTE.TARNISHED_BRASS, undefined, actionKey);
      curX += text.length + 1;
    } else {
      // Raised machined toggle appearance
      const text = `[ ${displayLabel} ]`;
      buf.writeString(curX, y, text, VICTORIAN_PALETTE.TARNISHED_BRASS, VICTORIAN_PALETTE.OXIDIZED_IRON, undefined, actionKey);
      curX += text.length + 1;
    }
  }
}

export interface DiegeticGaugeOptions {
  readonly label?: string;
  readonly thresholdState?: 'NOMINAL' | 'WARNING' | 'CRITICAL';
  readonly style?: 'PRESSURE_COLUMN' | 'LIQUID_TUBE';
  readonly currentVal?: number;
  readonly maxVal?: number;
  readonly unit?: string;
}

export function drawDiegeticGauge(
  buf: UiCellBuffer,
  x: number,
  y: number,
  width: number,
  ratio: number,
  options: DiegeticGaugeOptions = {},
): void {
  const clampedRatio = Math.max(0, Math.min(1, ratio));
  const style = options.style ?? 'PRESSURE_COLUMN';
  const threshold = options.thresholdState ?? (clampedRatio >= 0.85 ? 'CRITICAL' : clampedRatio >= 0.6 ? 'WARNING' : 'NOMINAL');

  let fillFg: string = VICTORIAN_PALETTE.AETHER_BLUE;
  let flag: string | undefined = undefined;
  if (threshold === 'CRITICAL') {
    fillFg = VICTORIAN_PALETTE.INCANDESCENT_RED;
    flag = 'THERMO_CRITICAL_PULSE';
  } else if (threshold === 'WARNING') {
    fillFg = VICTORIAN_PALETTE.AMBER_GASLIGHT;
    flag = 'GASLIGHT_BLOOM';
  }

  const prefix = options.label ? `${options.label}: ` : '';
  const suffix = options.currentVal !== undefined
    ? ` ${options.currentVal}${options.unit ?? ''}`
    : ` ${Math.round(clampedRatio * 100)}%`;

  let curX = x;
  if (prefix) {
    buf.writeString(curX, y, prefix, VICTORIAN_PALETTE.TARNISHED_BRASS, VICTORIAN_PALETTE.SOOT_IRON_BG);
    curX += prefix.length;
  }

  const openBracket = style === 'PRESSURE_COLUMN' ? '[' : '(';
  const closeBracket = style === 'PRESSURE_COLUMN' ? ']' : ')';
  const barWidth = Math.max(3, width - prefix.length - suffix.length - 2);

  buf.setCell(curX++, y, openBracket, VICTORIAN_PALETTE.RIVET_STEEL, VICTORIAN_PALETTE.SOOT_IRON_BG);

  const filledChars = Math.round(clampedRatio * barWidth);
  const midChars = style === 'PRESSURE_COLUMN' && filledChars > 0 && filledChars < barWidth ? 1 : 0;
  const solidChars = Math.max(0, filledChars - midChars);

  for (let i = 0; i < barWidth; i++) {
    if (i < solidChars) {
      const glyph = style === 'PRESSURE_COLUMN' ? '█' : '▓';
      buf.setCell(curX + i, y, glyph, fillFg, VICTORIAN_PALETTE.SOOT_IRON_BG, flag);
    } else if (i < filledChars) {
      const glyph = style === 'PRESSURE_COLUMN' ? '▒' : '░';
      buf.setCell(curX + i, y, glyph, fillFg, VICTORIAN_PALETTE.SOOT_IRON_BG, flag);
    } else {
      buf.setCell(curX + i, y, '·', VICTORIAN_PALETTE.MUTED_PIPE, VICTORIAN_PALETTE.SOOT_IRON_BG);
    }
  }
  curX += barWidth;

  buf.setCell(curX++, y, closeBracket, VICTORIAN_PALETTE.RIVET_STEEL, VICTORIAN_PALETTE.SOOT_IRON_BG);
  buf.writeString(curX, y, suffix, VICTORIAN_PALETTE.SEPIA_INK, VICTORIAN_PALETTE.SOOT_IRON_BG);
}
