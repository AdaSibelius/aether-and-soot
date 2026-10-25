import { UiCellBuffer } from './cell-buffer.js';
import { VICTORIAN_PALETTE } from './material-palette.js';

const STRUCTURAL_BORDER_GLYPHS = new Set([
  '█', '▀', '▄', '▌', '▐',
  '═', '║', '╔', '╗', '╚', '╝', '╠', '╣', '╬', '╦', '╩',
  '─', '│', '┌', '┐', '└', '┘', '├', '┤', '┼', '┬', '┴',
  '☼', 'Ø', '⣿',
]);

const CYLINDER_SPIN_GLYPHS = ['/', '-', '\\', '|', '⚙', '▒'];

export interface MechanicalTransitionOptions {
  readonly reducedMotion?: boolean;
}

/**
 * Pure deterministic non-blocking 100ms mechanical cylinder transition filter.
 * Overlays a settling wave of spinning slashes and brass cylinder glyphs across
 * interior content cells while preserving structural borders.
 *
 * @returns true if transition was in-progress and applied, false if complete (>= durationMs) or bypassed.
 */
export function applyMechanicalCylinderScramble(
  targetBuffer: UiCellBuffer,
  elapsedMs: number,
  durationMs = 100,
  options?: MechanicalTransitionOptions,
): boolean {
  if (options?.reducedMotion) {
    return false;
  }

  if (elapsedMs >= durationMs || elapsedMs < 0) {
    return false; // Transition complete or bypassed; buffer remains settled.
  }

  const progress = Math.max(0, Math.min(1, elapsedMs / durationMs));
  const settledThresholdX = Math.floor(progress * targetBuffer.width);
  const frameTick = Math.floor(elapsedMs / 16);

  for (let y = 0; y < targetBuffer.height; y++) {
    for (let x = 0; x < targetBuffer.width; x++) {
      // Settle left-to-right across the screen as progress advances
      if (x < settledThresholdX) {
        continue;
      }

      const cell = targetBuffer.getCell(x, y);
      if (!cell) continue;

      // Keep structural iron/brass frames and borders solidly anchored
      if (STRUCTURAL_BORDER_GLYPHS.has(cell.glyph)) {
        continue;
      }

      // Interior cell is actively scrambling through brass mechanical cylinders
      const spinIndex = (x * 3 + y * 7 + frameTick) % CYLINDER_SPIN_GLYPHS.length;
      const scrambleGlyph = CYLINDER_SPIN_GLYPHS[spinIndex]!;

      targetBuffer.setCell(
        x,
        y,
        scrambleGlyph,
        VICTORIAN_PALETTE.TARNISHED_BRASS,
        cell.bg,
        ['GASLIGHT_BLOOM'],
        cell.hitAction,
      );
    }
  }

  return true;
}
