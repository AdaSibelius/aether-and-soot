import { Application, Container, Filter, Graphics, Sprite } from 'pixi.js';
import { VisualGridFrame } from '../projection/frame-adapter.js';
import { createCrtPostFilter, DEFAULT_SCANLINE_OPACITY } from './crt-filter.js';
import { createGlyphAtlas, GlyphAtlas } from './glyph-atlas.js';

export const CELL_WIDTH_PX = 22;
export const CELL_HEIGHT_PX = 24;
export const WIDESCREEN_GRID_WIDTH = 48;
export const WIDESCREEN_GRID_HEIGHT = 30;
export const DESKTOP_GRID_WIDTH = 120;
export const DESKTOP_GRID_HEIGHT = 40;

function hexToNumber(hex: string): number {
  return parseInt(hex.replace('#', ''), 16);
}

/**
 * High-performance GPU Sprite-based glyph canvas stage with dual-color tinting,
 * steam shimmer pulse, and CRT scanline post-processing.
 */
export class GlyphStageRenderer {
  private readonly app: Application;
  private readonly gridContainer: Container;
  private readonly bgGraphics: Graphics;
  private readonly glyphSprites: Sprite[] = [];
  private readonly atlas: GlyphAtlas;
  private crtFilter: Filter | null = null;
  private elapsedSeconds = 0;

  private constructor(app: Application, atlas: GlyphAtlas) {
    this.app = app;
    this.atlas = atlas;
    this.gridContainer = new Container();
    this.bgGraphics = new Graphics();
    this.gridContainer.addChild(this.bgGraphics);

    try {
      this.crtFilter = createCrtPostFilter(DEFAULT_SCANLINE_OPACITY);
      this.app.stage.filters = [this.crtFilter];
    } catch {
      // Fallback cleanly if WebGL context does not support custom filter compilation
    }

    this.app.stage.addChild(this.gridContainer);
  }

  public setCrtScanlinesEnabled(enabled: boolean): void {
    if (this.crtFilter) {
      this.app.stage.filters = enabled ? [this.crtFilter] : [];
    }
  }

  public static async create(
    hostElement: HTMLElement,
    gridWidth: number = WIDESCREEN_GRID_WIDTH,
    gridHeight: number = WIDESCREEN_GRID_HEIGHT,
  ): Promise<GlyphStageRenderer> {
    const app = new Application();
    await app.init({
      width: gridWidth * CELL_WIDTH_PX,
      height: gridHeight * CELL_HEIGHT_PX,
      backgroundColor: 0x0a0d0e,
      antialias: false,
      resolution: (typeof window !== 'undefined' && window.devicePixelRatio) || 1,
      autoDensity: true,
    });

    hostElement.innerHTML = '';
    hostElement.appendChild(app.canvas);

    const atlas = createGlyphAtlas(CELL_WIDTH_PX, CELL_HEIGHT_PX);
    const renderer = new GlyphStageRenderer(app, atlas);
    renderer.initializeGlyphPool(gridWidth, gridHeight);
    return renderer;
  }

  public renderFrame(frame: VisualGridFrame): void {
    this.elapsedSeconds += 0.1;
    this.bgGraphics.clear();

    const maxCells = Math.min(frame.cells.length, this.glyphSprites.length);
    for (let i = 0; i < maxCells; i++) {
      const cell = frame.cells[i];
      const sprite = this.glyphSprites[i];
      if (!cell || !sprite) continue;

      const px = cell.x * CELL_WIDTH_PX;
      const py = cell.y * CELL_HEIGHT_PX;

      const bgColor = hexToNumber(cell.visual.bgColor);
      this.bgGraphics.rect(px, py, CELL_WIDTH_PX, CELL_HEIGHT_PX).fill({
        color: bgColor,
        alpha: cell.visible ? 1.0 : cell.explored ? 0.65 : 1.0,
      });

      if (cell.steamPressureKpa > 0 && cell.visible) {
        this.bgGraphics.rect(px + 2, py + 2, CELL_WIDTH_PX - 4, CELL_HEIGHT_PX - 4).fill({
          color: 0xd4af37,
          alpha: 0.18,
        });
      }

      if (cell.visual.shaderFlags.includes('GASLIGHT_RADIANCE') && cell.visible) {
        this.bgGraphics.rect(px + 1, py + 1, CELL_WIDTH_PX - 2, CELL_HEIGHT_PX - 2).fill({
          color: 0xf39c12,
          alpha: 0.14,
        });
      }

      const useSecondaryPulse =
        (cell.visual.shaderFlags.includes('PULSE_STEAM') && (cell.x + cell.y + frame.turnCount) % 2 === 0) ||
        (cell.visual.shaderFlags.includes('SPARK_GLINT') && (cell.x * 3 + cell.y * 7 + frame.turnCount) % 3 === 0) ||
        (cell.visual.shaderFlags.includes('GASLIGHT_RADIANCE') && (cell.x + frame.turnCount) % 4 === 0);

      const fgHex = useSecondaryPulse ? cell.visual.fgSecondary : cell.visual.fgPrimary;
      sprite.texture = this.atlas.getTexture(cell.visual.glyph);
      sprite.tint = hexToNumber(fgHex);
      sprite.alpha = cell.visible ? 1.0 : cell.explored ? 0.42 : 0.0;
    }

    for (let i = maxCells; i < this.glyphSprites.length; i++) {
      const sprite = this.glyphSprites[i];
      if (sprite) sprite.alpha = 0.0;
    }
  }

  private initializeGlyphPool(gridWidth: number, gridHeight: number): void {
    for (let y = 0; y < gridHeight; y++) {
      for (let x = 0; x < gridWidth; x++) {
        const sprite = new Sprite(this.atlas.getTexture('·'));
        sprite.position.set(x * CELL_WIDTH_PX, y * CELL_HEIGHT_PX);
        sprite.width = CELL_WIDTH_PX;
        sprite.height = CELL_HEIGHT_PX;
        sprite.tint = 0xd4af37;
        this.gridContainer.addChild(sprite);
        this.glyphSprites.push(sprite);
      }
    }
  }
}
