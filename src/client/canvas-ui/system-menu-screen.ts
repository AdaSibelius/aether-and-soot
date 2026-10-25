import { drawMachinedBezel } from './bezel-composer.js';
import { UiCellBuffer } from './cell-buffer.js';
import { VICTORIAN_PALETTE } from './material-palette.js';
import { UiRect } from './viewport-controls.js';

export interface SystemMenuView {
  readonly seedInput: string;
  readonly statusMsg: string;
  readonly crtEnabled: boolean;
  readonly diegeticUi: boolean;
}

export const SYSTEM_MENU_RECT: UiRect = { x: 18, y: 6, width: 52, height: 24 };

/**
 * Canvas-native "Chronos & Engine Archive" system menu. Every clickable row carries a
 * `sys:<action>` hit action resolved by the system-menu controller.
 */
export function renderSystemMenuScreen(buf: UiCellBuffer, view: SystemMenuView, rect: UiRect = SYSTEM_MENU_RECT): void {
  const { x, y, width, height } = rect;
  const bg = VICTORIAN_PALETTE.SOOT_IRON_BG;
  for (let r = y; r < y + height; r++) {
    for (let c = x; c < x + width; c++) buf.setCell(c, r, ' ', VICTORIAN_PALETTE.SEPIA_INK, bg);
  }
  drawMachinedBezel(buf, rect, {
    title: 'CHRONOS & ENGINE ARCHIVE',
    rivetStyle: 'BRASS_BOLTS',
    fgColor: VICTORIAN_PALETTE.TARNISHED_BRASS,
    bgColor: bg,
  });

  const lx = x + 3;
  const inner = width - 6;
  const header = (row: number, text: string): void => {
    buf.writeString(lx, y + row, `-[ ${text} ]`.padEnd(inner, '-').slice(0, inner), VICTORIAN_PALETTE.TARNISHED_BRASS, bg);
  };
  const button = (col: number, row: number, text: string, action: string, fg: string): void => {
    buf.writeString(col, y + row, text, fg, VICTORIAN_PALETTE.OXIDIZED_IRON, undefined, `sys:${action}`);
  };

  button(lx, 2, '[N] Create New Character / Scenario'.padEnd(inner), 'create', VICTORIAN_PALETTE.AMBER_GASLIGHT);

  header(4, 'OPTICAL GOVERNOR');
  button(lx, 5, `[C] CRT Scanlines: [${view.crtEnabled ? 'ACTIVE' : 'OFF'}]`.padEnd(inner), 'crt', VICTORIAN_PALETTE.AETHER_BLUE);
  button(lx, 6, `[U] Interface: [${view.diegeticUi ? 'DIEGETIC CANVAS' : 'LEGACY HTML'}]`.padEnd(inner), 'ui', VICTORIAN_PALETTE.AETHER_BLUE);

  header(8, 'DISTRICT SEED GENERATION');
  buf.writeString(lx, y + 9, `Seed: [${view.seedInput}_]`.slice(0, inner), VICTORIAN_PALETTE.POLISHED_BRASS, bg);
  button(lx, 10, '[Enter] Generate', 'generate', VICTORIAN_PALETTE.AMBER_GASLIGHT);
  button(lx + 20, 10, '[R] Roll Random', 'roll', VICTORIAN_PALETTE.AMBER_GASLIGHT);

  header(12, 'SAVE / LOAD WORLD STATE');
  button(lx, 13, '[S] Save to LocalStorage Slot'.padEnd(inner), 'save', VICTORIAN_PALETTE.SEPIA_INK);
  button(lx, 14, '[L] Restore from LocalStorage Slot'.padEnd(inner), 'load', VICTORIAN_PALETTE.SEPIA_INK);
  button(lx, 15, '[E] Export Save JSON File'.padEnd(inner), 'export', VICTORIAN_PALETTE.SEPIA_INK);
  button(lx, 16, '[I] Import Save JSON File'.padEnd(inner), 'import', VICTORIAN_PALETTE.SEPIA_INK);

  if (view.statusMsg) {
    buf.writeWrappedText({ x: lx, y: y + 18, width: inner, height: 3 }, view.statusMsg, {
      fg: VICTORIAN_PALETTE.VERDIGRIS_PATINA,
      bg,
      jitterIndent: false,
    });
  }

  button(lx, height - 2, '[Esc] Resume Boiler & Simulation'.padEnd(inner), 'resume', VICTORIAN_PALETTE.POLISHED_BRASS);
}
