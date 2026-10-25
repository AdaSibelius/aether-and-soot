import { VisualGlyphSpec } from '../../schemas/primitives.schema.js';

export interface CameraViewportConfig {
  readonly viewportWidth: number;
  readonly viewportHeight: number;
  readonly offsetX: number;
  readonly offsetY: number;
  readonly cameraX: number;
  readonly cameraY: number;
  readonly isCenteredWidescreen: boolean;
}

export function calculateCameraViewport(
  gridWidth: number,
  gridHeight: number,
  originX: number,
  originY: number,
  defaultWidth: number,
  defaultHeight: number,
  viewportOverride?: { width: number; height: number },
): CameraViewportConfig {
  const reqW = viewportOverride?.width ?? defaultWidth;
  const reqH = viewportOverride?.height ?? defaultHeight;
  const isCenteredWidescreen = Boolean(viewportOverride && viewportOverride.width > gridWidth);
  const viewportWidth = isCenteredWidescreen ? reqW : Math.min(reqW, gridWidth);
  const viewportHeight = isCenteredWidescreen ? reqH : Math.min(reqH, gridHeight);
  const offsetX = isCenteredWidescreen ? Math.floor((reqW - gridWidth) / 2) : 0;
  const offsetY = isCenteredWidescreen ? Math.floor((reqH - gridHeight) / 2) : 0;

  const cameraX = isCenteredWidescreen
    ? 0
    : Math.max(0, Math.min(gridWidth - viewportWidth, originX - Math.floor(viewportWidth / 2)));
  const cameraY = isCenteredWidescreen
    ? 0
    : Math.max(0, Math.min(gridHeight - viewportHeight, originY - Math.floor(viewportHeight / 2)));

  return {
    viewportWidth,
    viewportHeight,
    offsetX,
    offsetY,
    cameraX,
    cameraY,
    isCenteredWidescreen,
  };
}

/**
 * Procedurally generates engraved Victorian copperplate cross-sections and technical hatching
 * for coordinates lying beyond the district boundary grid, replacing dead void with diegetic architectural drawings.
 */
export function resolveOutOfBoundsVisual(
  worldX: number,
  worldY: number,
  gridWidth: number,
  gridHeight: number,
  _turnCount = 0,
): VisualGlyphSpec {
  const distLeft = -worldX;
  const distRight = worldX - (gridWidth - 1);
  const distTop = -worldY;
  const distBottom = worldY - (gridHeight - 1);
  const borderDist = Math.max(distLeft, distRight, distTop, distBottom);

  // Immediate perimeter (borderDist === 1): architectural structural framing
  if (borderDist === 1) {
    const isCorner = (distLeft === 1 || distRight === 1) && (distTop === 1 || distBottom === 1);
    const isVertical = distLeft === 1 || distRight === 1;
    return {
      glyph: isCorner ? '╬' : isVertical ? '║' : '═',
      fgPrimary: '#4a5b6d',
      fgSecondary: '#364452',
      bgColor: '#10161c',
      shaderFlags: [],
    };
  }

  // Intermediate band (borderDist === 2..3): technical cross-hatch & foundation rivets
  if (borderDist <= 3) {
    const isRivet = (Math.abs(worldX) + Math.abs(worldY)) % 4 === 0;
    return {
      glyph: isRivet ? '◈' : (borderDist % 2 === 0 ? '▒' : '░'),
      fgPrimary: '#2f3b47',
      fgSecondary: '#242e38',
      bgColor: '#0c1015',
      shaderFlags: [],
    };
  }

  // Deep boundary void (borderDist >= 4): subtle strata hatching & survey datum marks
  const hash = Math.abs((worldX * 31 + worldY * 17)) % 16;
  const glyph = hash === 0 ? '⌖' : hash === 5 ? '⚙' : hash < 8 ? '░' : '·';

  return {
    glyph,
    fgPrimary: '#1a222a',
    fgSecondary: '#141b22',
    bgColor: '#080c10',
    shaderFlags: [],
  };
}
