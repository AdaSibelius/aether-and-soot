import { Application, Container, Filter, Graphics, Sprite } from 'pixi.js';
import { UiCellBuffer } from '../canvas-ui/cell-buffer.js';
import { VisualGridFrame } from '../projection/frame-adapter.js';
import { createCrtPostFilter, DEFAULT_SCANLINE_OPACITY, updateSteampunkFilterUniforms } from './crt-filter.js';
import { createGlyphAtlas, GlyphAtlas } from './glyph-atlas.js';
import { getPerformanceGovernor, PerformanceGovernor } from './performance-governor.js';

export const CELL_WIDTH_PX = 22;
export const CELL_HEIGHT_PX = 24;
export const WIDESCREEN_GRID_WIDTH = 48;
export const WIDESCREEN_GRID_HEIGHT = 30;
export const DESKTOP_GRID_WIDTH = 120;
export const DESKTOP_GRID_HEIGHT = 40;

function hexToNumber(hex: string): number {
  return parseInt(hex.replace('#', ''), 16);
}

export class GlyphStageRenderer {
  private readonly app: Application;
  private readonly gridContainer: Container;
  private readonly bgGraphics: Graphics;
  private readonly glyphSprites: Sprite[] = [];
  private readonly atlas: GlyphAtlas;
  private readonly gridWidth: number;
  private readonly gridHeight: number;
  private crtFilter: Filter | null = null;
  private elapsedSeconds = 0;
  private activeUiBuffer: UiCellBuffer | null = null;
  private readonly governor: PerformanceGovernor;

  private constructor(
    app: Application,
    atlas: GlyphAtlas,
    gridWidth: number,
    gridHeight: number,
    governor?: PerformanceGovernor,
  ) {
    this.app = app;
    this.atlas = atlas;
    this.gridWidth = gridWidth;
    this.gridHeight = gridHeight;
    this.governor = governor ?? getPerformanceGovernor();
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

  public getGovernor(): PerformanceGovernor {
    return this.governor;
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
      backgroundColor: 0x0b0c0e, // Oxidized soot-iron background
      antialias: false,
      resolution: (typeof window !== 'undefined' && window.devicePixelRatio) || 1,
      autoDensity: true,
    });

    hostElement.innerHTML = '';
    hostElement.appendChild(app.canvas);

    const atlas = createGlyphAtlas(CELL_WIDTH_PX, CELL_HEIGHT_PX);
    const renderer = new GlyphStageRenderer(app, atlas, gridWidth, gridHeight);
    renderer.initializeGlyphPool(gridWidth, gridHeight);
    return renderer;
  }

  public renderFrame(
    frame: VisualGridFrame,
    uiBuffer?: UiCellBuffer,
    thermoStress = 0,
    deltaMs = 16.67,
  ): void {
    this.elapsedSeconds += 0.05;
    this.activeUiBuffer = uiBuffer ?? null;
    this.governor.recordFrameTime(deltaMs);

    if (this.crtFilter) {
      const distortion = this.governor.getEffectiveDistortionScale();
      const scanlines = this.governor.getEffectiveScanlineOpacity();
      updateSteampunkFilterUniforms(
        this.crtFilter,
        this.elapsedSeconds,
        thermoStress,
        [0, 0, 0, 0],
        distortion,
        scanlines,
      );
    }

    this.bgGraphics.clear();

    // 1. Render World Tactical Grid
    const maxWorldCells = Math.min(frame.cells.length, this.glyphSprites.length);
    for (let i = 0; i < maxWorldCells; i++) {
      const cell = frame.cells[i];
      const sprite = this.glyphSprites[i];
      if (!cell || !sprite) continue;

      const px = cell.x * CELL_WIDTH_PX;
      const py = cell.y * CELL_HEIGHT_PX;

      this.bgGraphics.rect(px, py, CELL_WIDTH_PX, CELL_HEIGHT_PX).fill({
        color: hexToNumber(cell.visual.bgColor),
        alpha: cell.visible ? 1.0 : cell.explored ? 0.65 : 1.0,
      });

      if (cell.steamPressureKpa > 0 && cell.visible) {
        this.bgGraphics.rect(px + 2, py + 2, CELL_WIDTH_PX - 4, CELL_HEIGHT_PX - 4).fill({
          color: 0xd4af37,
          alpha: 0.18,
        });
      }

      const useSecondary =
        (cell.visual.shaderFlags.includes('PULSE_STEAM') && (cell.x + cell.y + frame.turnCount) % 2 === 0) ||
        (cell.visual.shaderFlags.includes('SPARK_GLINT') && (cell.x * 3 + cell.y * 7 + frame.turnCount) % 3 === 0);

      const fgHex = useSecondary ? cell.visual.fgSecondary : cell.visual.fgPrimary;
      sprite.position.set(px, py);
      sprite.texture = this.atlas.getTexture(cell.visual.glyph);
      sprite.tint = hexToNumber(fgHex);
      sprite.alpha = cell.visible ? 1.0 : cell.explored ? 0.42 : 0.0;
    }

    // 2. Composite Diegetic UiCellBuffer Layer over World Grid
    if (uiBuffer) {
      for (let uy = 0; uy < Math.min(uiBuffer.height, this.gridHeight); uy++) {
        for (let ux = 0; ux < Math.min(uiBuffer.width, this.gridWidth); ux++) {
          const uiCell = uiBuffer.getCell(ux, uy);
          if (!uiCell) continue;

          const idx = uy * this.gridWidth + ux;
          const sprite = this.glyphSprites[idx];
          if (!sprite) continue;

          const px = ux * CELL_WIDTH_PX;
          const py = uy * CELL_HEIGHT_PX;

          // Background fill for UI cell
          this.bgGraphics.rect(px, py, CELL_WIDTH_PX, CELL_HEIGHT_PX).fill({
            color: hexToNumber(uiCell.bg),
            alpha: 1.0,
          });

          // Mechanical Tremor Jitter on stressed components (bypassed if reduced motion or terminal tier)
          let jx = 0;
          let jy = 0;
          if (uiCell.shaderFlags?.includes('TREMOR_JITTER') && this.governor.shouldApplyTremorJitter()) {
            const jitterPhase = (ux * 5 + uy * 7 + Math.floor(this.elapsedSeconds * 20)) % 4;
            jx = jitterPhase === 1 ? 1 : jitterPhase === 3 ? -1 : 0;
            jy = jitterPhase === 0 ? 1 : jitterPhase === 2 ? -1 : 0;
          }

          sprite.position.set(px + jx, py + jy);
          sprite.texture = this.atlas.getTexture(uiCell.glyph);
          sprite.tint = hexToNumber(uiCell.fg);
          sprite.alpha = 1.0;
        }
      }
    }
  }

  public resolveHitActionAt(clientX: number, clientY: number, canvasBoundingRect?: DOMRect): string | undefined {
    if (!this.activeUiBuffer) return undefined;
    const left = canvasBoundingRect ? canvasBoundingRect.left : 0;
    const top = canvasBoundingRect ? canvasBoundingRect.top : 0;
    const col = Math.floor((clientX - left) / CELL_WIDTH_PX);
    const row = Math.floor((clientY - top) / CELL_HEIGHT_PX);
    return this.activeUiBuffer.resolveHitActionAt(col, row);
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
