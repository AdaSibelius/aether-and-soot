import { CELL_HEIGHT_PX, CELL_WIDTH_PX, WIDESCREEN_GRID_HEIGHT, WIDESCREEN_GRID_WIDTH } from './glyph-stage.js';

export interface WindowDimensions {
  readonly windowWidth: number;
  readonly windowHeight: number;
}

export interface ViewportScaleMetrics {
  readonly scaleFactor: number;
  readonly scaledWidth: number;
  readonly scaledHeight: number;
  readonly offsetX: number;
  readonly offsetY: number;
}

export function computeAspectLockedScale(
  container: WindowDimensions,
  baseWidth: number = WIDESCREEN_GRID_WIDTH * CELL_WIDTH_PX,
  baseHeight: number = WIDESCREEN_GRID_HEIGHT * CELL_HEIGHT_PX,
  integerScaleOnly = false,
): ViewportScaleMetrics {
  const scaleX = container.windowWidth / baseWidth;
  const scaleY = container.windowHeight / baseHeight;
  let scale = Math.min(scaleX, scaleY);

  if (integerScaleOnly) {
    scale = Math.max(1, Math.floor(scale));
  }

  const scaledWidth = Math.round(baseWidth * scale);
  const scaledHeight = Math.round(baseHeight * scale);
  const offsetX = Math.max(0, Math.floor((container.windowWidth - scaledWidth) / 2));
  const offsetY = Math.max(0, Math.floor((container.windowHeight - scaledHeight) / 2));

  return {
    scaleFactor: scale,
    scaledWidth,
    scaledHeight,
    offsetX,
    offsetY,
  };
}

/**
 * Maps browser client coordinates to logical grid cell coordinates proportionally
 * against the rendered canvas bounding box.
 */
export function transformClientToGrid(
  clientX: number,
  clientY: number,
  rect: { left: number; top: number; width: number; height: number },
  gridWidth: number = WIDESCREEN_GRID_WIDTH,
  gridHeight: number = WIDESCREEN_GRID_HEIGHT,
): { col: number; row: number; inside: boolean } {
  if (rect.width <= 0 || rect.height <= 0) {
    return { col: 0, row: 0, inside: false };
  }
  const relX = clientX - rect.left;
  const relY = clientY - rect.top;
  const inside = relX >= 0 && relX < rect.width && relY >= 0 && relY < rect.height;
  const col = Math.floor((relX / rect.width) * gridWidth);
  const row = Math.floor((relY / rect.height) * gridHeight);
  return { col, row, inside };
}

/**
 * Applies computed aspect-locked scale metrics to the canvas host and overlay elements.
 */
export function applyViewportScale(
  elements: { canvasHost: HTMLElement; overlayHost?: HTMLElement; appCanvas?: HTMLCanvasElement | null },
  metrics: ViewportScaleMetrics,
): void {
  const { canvasHost, overlayHost, appCanvas } = elements;
  const fillW = typeof window !== 'undefined' && window.innerWidth > 0 ? window.innerWidth : metrics.scaledWidth;
  const fillH = typeof window !== 'undefined' && window.innerHeight > 0 ? window.innerHeight : metrics.scaledHeight;
  canvasHost.style.width = `${fillW}px`;
  canvasHost.style.height = `${fillH}px`;

  if (appCanvas) {
    appCanvas.style.width = '100%';
    appCanvas.style.height = '100%';
  }

  if (overlayHost) {
    const baseW = WIDESCREEN_GRID_WIDTH * CELL_WIDTH_PX;
    const baseH = WIDESCREEN_GRID_HEIGHT * CELL_HEIGHT_PX;
    overlayHost.style.width = `${baseW}px`;
    overlayHost.style.height = `${baseH}px`;
    overlayHost.style.transform = `scale(${fillW / baseW}, ${fillH / baseH})`;
    overlayHost.style.transformOrigin = 'top left';
  }
}

export async function toggleFullscreen(targetElement?: HTMLElement): Promise<boolean> {
  if (typeof document === 'undefined') return false;
  try {
    if (!document.fullscreenElement) {
      const el = targetElement ?? document.documentElement;
      await el.requestFullscreen();
      return true;
    }
    await document.exitFullscreen();
    return false;
  } catch {
    return false;
  }
}

export interface WindowManagerCallbacks {
  readonly onSuspend?: () => void;
  readonly onResume?: () => void;
  readonly onResize?: (metrics: ViewportScaleMetrics) => void;
}

export class DesktopWindowManager {
  private isSuspended = false;
  private readonly callbacks: WindowManagerCallbacks;
  private readonly keydownHandler: (ev: KeyboardEvent) => void;
  private readonly visibilityHandler: () => void;
  private readonly resizeHandler: () => void;

  constructor(callbacks: WindowManagerCallbacks = {}) {
    this.callbacks = callbacks;

    this.keydownHandler = (ev: KeyboardEvent) => {
      if (ev.key === 'F11') {
        ev.preventDefault();
        void toggleFullscreen();
      }
    };

    this.visibilityHandler = () => {
      if (typeof document === 'undefined') return;
      if (document.hidden && !this.isSuspended) {
        this.isSuspended = true;
        this.callbacks.onSuspend?.();
      } else if (!document.hidden && this.isSuspended) {
        this.isSuspended = false;
        this.callbacks.onResume?.();
      }
    };

    this.resizeHandler = () => {
      if (typeof window === 'undefined') return;
      const metrics = computeAspectLockedScale({
        windowWidth: window.innerWidth,
        windowHeight: window.innerHeight,
      });
      this.callbacks.onResize?.(metrics);
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('keydown', this.keydownHandler);
      window.addEventListener('resize', this.resizeHandler);
    }
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', this.visibilityHandler);
    }
  }

  public isAppSuspended(): boolean {
    return this.isSuspended;
  }

  public destroy(): void {
    if (typeof window !== 'undefined') {
      window.removeEventListener('keydown', this.keydownHandler);
      window.removeEventListener('resize', this.resizeHandler);
    }
    if (typeof document !== 'undefined') {
      document.removeEventListener('visibilitychange', this.visibilityHandler);
    }
  }
}
