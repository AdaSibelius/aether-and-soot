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
