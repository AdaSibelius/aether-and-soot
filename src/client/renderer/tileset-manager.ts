import { Texture } from 'pixi.js';
import { GlyphAtlas } from './glyph-atlas.js';
import { hexToNumber } from './glyph-stage-types.js';
import { ProceduralTileset } from './procedural-tileset.js';

export type VisualRenderMode = 'CP437_ASCII' | 'GRAPHICAL_TILESET' | 'HYBRID_OVERLAY';

export const PRESENTATION_MODES: readonly VisualRenderMode[] = [
  'CP437_ASCII',
  'GRAPHICAL_TILESET',
  'HYBRID_OVERLAY',
] as const;

export interface LayerRenderRequest {
  readonly glyph: string;
  readonly fgPrimary: string;
  readonly fgSecondary?: string | undefined;
  readonly alpha?: number | undefined;
  readonly shaderFlags?: readonly string[] | undefined;
  readonly tileKey?: string | undefined;
}

export interface ResolvedLayerVisual {
  readonly texture: Texture;
  readonly tint: number;
  readonly alpha: number;
}

export interface TilesetTextureResolver {
  getTileTexture(tileKey: string): Texture | null;
  getRenderMode(): VisualRenderMode;
}

export class TilesetManager implements TilesetTextureResolver {
  private readonly atlas: GlyphAtlas;
  private readonly tileset: ProceduralTileset;
  private mode: VisualRenderMode;

  public constructor(
    atlas: GlyphAtlas,
    tileset: ProceduralTileset,
    initialMode: VisualRenderMode = 'HYBRID_OVERLAY',
  ) {
    this.atlas = atlas;
    this.tileset = tileset;
    this.mode = initialMode;
  }

  public getMode(): VisualRenderMode {
    return this.mode;
  }

  public setMode(mode: VisualRenderMode): void {
    this.mode = mode;
  }

  public cycleMode(): VisualRenderMode {
    const idx = PRESENTATION_MODES.indexOf(this.mode);
    const nextIdx = (idx + 1) % PRESENTATION_MODES.length;
    this.mode = PRESENTATION_MODES[nextIdx] ?? 'CP437_ASCII';
    return this.mode;
  }

  public getTileset(): ProceduralTileset {
    return this.tileset;
  }

  public getAtlas(): GlyphAtlas {
    return this.atlas;
  }

  public getRenderMode(): VisualRenderMode {
    return this.mode;
  }

  public getTileTexture(tileKey: string): Texture | null {
    if (this.tileset.hasTile(tileKey)) {
      return this.tileset.getTexture(tileKey);
    }
    return null;
  }

  public resolveLayerVisual(
    request: LayerRenderRequest,
    layerType: 'floor' | 'fixture' | 'item' | 'actor' | 'indicator',
    isVisible: boolean,
    isExplored: boolean,
    isUnderlay = false,
  ): ResolvedLayerVisual {
    let alpha: number;
    if (!isVisible && !isExplored) {
      alpha = 0.0;
    } else if (isUnderlay) {
      alpha = 0.22;
    } else if (isVisible) {
      alpha = layerType === 'indicator' ? (request.alpha ?? 0.75) : (request.alpha ?? 1.0);
    } else {
      alpha = layerType === 'floor' ? 0.42 : 0.50;
    }

    const useTile =
      Boolean(request.tileKey && this.tileset.hasTile(request.tileKey)) &&
      (this.mode === 'GRAPHICAL_TILESET' ||
        (this.mode === 'HYBRID_OVERLAY' && (layerType === 'floor' || layerType === 'fixture')));

    if (useTile && request.tileKey) {
      return {
        texture: this.tileset.getTexture(request.tileKey),
        tint: 0xffffff,
        alpha,
      };
    }

    return {
      texture: this.atlas.getTexture(request.glyph),
      tint: hexToNumber(request.fgPrimary),
      alpha,
    };
  }
}
