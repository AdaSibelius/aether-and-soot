export const CELL_WIDTH_PX = 12;
export const CELL_HEIGHT_PX = 20;
export const WIDESCREEN_GRID_WIDTH = 88;
export const WIDESCREEN_GRID_HEIGHT = 36;
export const DESKTOP_GRID_WIDTH = 120;
export const DESKTOP_GRID_HEIGHT = 40;

export function hexToNumber(hex: string): number {
  return parseInt(hex.replace('#', ''), 16);
}
