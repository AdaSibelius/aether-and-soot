import { Application, Container, Filter, Graphics, Text, TextStyle } from 'pixi.js';
import { VisualGridFrame } from '../projection/frame-adapter.js';
import { createCrtPostFilter, DEFAULT_SCANLINE_OPACITY } from './crt-filter.js';

export const CELL_WIDTH_PX = 22;
export const CELL_HEIGHT_PX = 24;
export const WIDESCREEN_GRID_WIDTH = 48;
export const WIDESCREEN_GRID_HEIGHT = 30;

function hexToNumber(hex: string): number {
  return parseInt(hex.replace('#', ''), 16);
}

/**
 * Caves of Qud style glyph/tile canvas stage with dual-color tinting,
 * steam shimmer pulse, and CRT scanline post-processing.
 */
export class GlyphStageRenderer {
  private readonly app: Application;
  private readonly gridContainer: Container;
  private readonly bgGraphics: Graphics;
  private readonly glyphNodes: Text[] = [];
  private crtFilter: Filter | null = null;
  private elapsedSeconds = 0;

  private constructor(app: Application) {
    this.app = app;
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
    gridWidth: number,
    gridHeight: number,
  ): Promise<GlyphStageRenderer> {
    const app = new Application();
    await app.init({
      width: gridWidth * CELL_WIDTH_PX,
      height: gridHeight * CELL_HEIGHT_PX,
      backgroundColor: 0x0a0d0e,
      antialias: false,
      resolution: window.devicePixelRatio || 1,
      autoDensity: true,
    });

    hostElement.innerHTML = '';
    hostElement.appendChild(app.canvas);

    const renderer = new GlyphStageRenderer(app);
    renderer.initializeGlyphPool(gridWidth, gridHeight);
    return renderer;
  }

  public renderFrame(frame: VisualGridFrame): void {
    this.elapsedSeconds += 0.1;
    this.bgGraphics.clear();

    for (let i = 0; i < frame.cells.length; i++) {
      const cell = frame.cells[i];
      const textNode = this.glyphNodes[i];
      if (!cell || !textNode) continue;

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
      textNode.text = cell.visual.glyph;
      textNode.style.fill = hexToNumber(fgHex);
      textNode.alpha = cell.visible ? 1.0 : cell.explored ? 0.42 : 0.0;
    }
  }

  private initializeGlyphPool(gridWidth: number, gridHeight: number): void {
    const baseStyle = new TextStyle({
      fontFamily: '"JetBrains Mono", "Fira Code", "Courier New", monospace',
      fontSize: 18,
      fontWeight: 'bold',
      fill: 0xd4af37,
    });

    for (let y = 0; y < gridHeight; y++) {
      for (let x = 0; x < gridWidth; x++) {
        const node = new Text({
          text: '·',
          style: baseStyle.clone(),
        });
        node.anchor.set(0.5, 0.5);
        node.position.set(
          x * CELL_WIDTH_PX + CELL_WIDTH_PX / 2,
          y * CELL_HEIGHT_PX + CELL_HEIGHT_PX / 2,
        );
        this.gridContainer.addChild(node);
        this.glyphNodes.push(node);
      }
    }
  }
}
