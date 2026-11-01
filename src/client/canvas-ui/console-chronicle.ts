import { WorldState } from '../../sim/core/world.js';
import { aggregateChronicleEvents } from '../ui/EventFormatterDomain.js';
import { UiCellBuffer } from './cell-buffer.js';
import { VICTORIAN_PALETTE } from './material-palette.js';

const TICKER_INK_PALETTE = [
  '#6b5e4f', // 0: Oldest (faded typewriter ink)
  '#998870', // 1: Intermediate
  '#c7b79d', // 2: Recent
  '#f5e6cb', // 3: Freshest (bright typewriter ribbon ink)
] as const;

/**
 * Renders the Edison Pneumatic Ticker Chronicle in the tactical console:
 * Displays the last 3-4 simulation events formatted in typewriter ink
 * with progressive ink ribbon fade gradient.
 */
export function renderPneumaticTickerChronicle(
  buf: UiCellBuffer,
  x: number,
  y: number,
  width: number,
  height: number,
  state: Readonly<WorldState>,
): void {
  const maxLines = Math.max(1, height);
  const rawEvents = state.eventLog ?? [];
  const lines = aggregateChronicleEvents(rawEvents, maxLines).filter(
    (l): l is string => typeof l === 'string' && l.trim().length > 0,
  );
  const maxChars = Math.max(10, width);

  if (lines.length === 0) {
    buf.writeString(
      x,
      y,
      '» Awaiting telegraph...'.slice(0, maxChars),
      '#7f6b55',
      VICTORIAN_PALETTE.SOOT_IRON_BG,
    );
    for (let r = 1; r < maxLines; r++) {
      buf.writeString(
        x,
        y + r,
        '· · · · · · · · · · · ·'.slice(0, maxChars),
        '#3a3228',
        VICTORIAN_PALETTE.SOOT_IRON_BG,
      );
    }
    return;
  }

  // Pad lines if fewer than maxLines
  const offset = maxLines - lines.length;
  for (let r = 0; r < offset; r++) {
    buf.writeString(
      x,
      y + r,
      '· · · · · · · · · · · ·'.slice(0, maxChars),
      '#2e2720',
      VICTORIAN_PALETTE.SOOT_IRON_BG,
    );
  }

  for (let idx = 0; idx < lines.length; idx++) {
    const rawLine = lines[idx];
    if (!rawLine) continue;
    // Strip turn range prefix [T123] or [T12–T14] for clean ticker readout
    const clean = rawLine.replace(/^\[T\d+(?:–T\d+)?\]\s*/, '');
    const rowY = y + offset + idx;

    // Ink ribbon gradient based on distance from latest line
    const colorIdx = Math.min(
      TICKER_INK_PALETTE.length - 1,
      Math.max(0, TICKER_INK_PALETTE.length - (lines.length - idx)),
    );
    const inkColor = TICKER_INK_PALETTE[colorIdx]!;
    const bulletColor = idx === lines.length - 1 ? VICTORIAN_PALETTE.AMBER_GASLIGHT : inkColor;

    buf.writeString(x, rowY, '»', bulletColor, VICTORIAN_PALETTE.SOOT_IRON_BG);
    const displayMsg = ` ${clean}`.slice(0, maxChars - 1);
    buf.writeString(x + 1, rowY, displayMsg, inkColor, VICTORIAN_PALETTE.SOOT_IRON_BG);
  }
}
