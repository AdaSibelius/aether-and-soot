import { Container, Graphics, Sprite, Texture } from 'pixi.js';
import { GlyphLayerVisual, RenderCellLayers } from '../projection/layer-projection.js';
import { RenderCellFrame, VisualGridFrame } from '../projection/frame-adapter.js';
import { GlyphAtlas } from './glyph-atlas.js';
import { CELL_HEIGHT_PX, CELL_WIDTH_PX } from './glyph-stage-types.js';
import { TilesetTextureResolver, VisualRenderMode } from './tileset-manager.js';

export type TacticalLayerType = 'floor' | 'fixture' | 'item' | 'actor' | 'indicator';

export const TACTICAL_LAYERS: readonly TacticalLayerType[] = [
  'floor', 'fixture', 'item', 'actor', 'indicator',
] as const;

export const TACTICAL_LAYER_Z_INDEX: Record<TacticalLayerType, number> = {
  floor: 0, fixture: 1, item: 2, actor: 3, indicator: 4,
};

export const OXIDIZED_IRON_DEPTH_PALETTE = {
  TIER_0_FLOOR: '#2a221b', TIER_1_FIXTURE: '#524536',
  TIER_2_ITEM: '#8f7a62', TIER_3_ACTOR: '#d4c2a5',
} as const;

export const OXIDIZED_IRON_DEPTH_NUMBERS = {
  TIER_0_FLOOR: 0x2a221b, TIER_1_FIXTURE: 0x524536,
  TIER_2_ITEM: 0x8f7a62, TIER_3_ACTOR: 0xd4c2a5,
} as const;

const COLOR_HEX_CACHE = new Map<string, number>();

export function fastHexColor(hex: string): number {
  let val = COLOR_HEX_CACHE.get(hex);
  if (val === undefined) {
    val = parseInt(hex.charCodeAt(0) === 35 ? hex.slice(1) : hex, 16);
    COLOR_HEX_CACHE.set(hex, Number.isNaN(val) ? 0xffffff : val);
  }
  return val;
}

export class TacticalLayerComposer {
  public readonly rootContainer: Container;
  private readonly layerContainers: Record<TacticalLayerType, Container>;
  private readonly layerSpritePools: Record<TacticalLayerType, Sprite[]>;
  private readonly atlas: GlyphAtlas;
  private readonly gridWidth: number;
  private readonly gridHeight: number;
  private readonly totalCells: number;
  private tilesetResolver: TilesetTextureResolver | null = null;
  private layerVisibility: Record<TacticalLayerType, boolean> = {
    floor: true, fixture: true, item: true, actor: true, indicator: true,
  };

  public constructor(
    parentContainer: Container, atlas: GlyphAtlas, gridWidth: number, gridHeight: number,
    tilesetResolver?: TilesetTextureResolver,
  ) {
    this.atlas = atlas;
    this.gridWidth = gridWidth;
    this.gridHeight = gridHeight;
    this.totalCells = gridWidth * gridHeight;
    this.tilesetResolver = tilesetResolver ?? null;

    this.rootContainer = new Container();
    this.rootContainer.label = 'tactical-layer-composer-root';
    parentContainer.addChild(this.rootContainer);

    this.layerContainers = {
      floor: new Container(), fixture: new Container(), item: new Container(),
      actor: new Container(), indicator: new Container(),
    };
    this.layerSpritePools = {
      floor: new Array<Sprite>(this.totalCells), fixture: new Array<Sprite>(this.totalCells),
      item: new Array<Sprite>(this.totalCells), actor: new Array<Sprite>(this.totalCells),
      indicator: new Array<Sprite>(this.totalCells),
    };
    this.initializePools();
  }

  private initializePools(): void {
    const blank = this.atlas.getTexture(' ');
    for (const layer of TACTICAL_LAYERS) {
      const container = this.layerContainers[layer];
      container.label = `tactical-layer-${layer}`;
      container.zIndex = TACTICAL_LAYER_Z_INDEX[layer];
      this.rootContainer.addChild(container);

      const pool = this.layerSpritePools[layer];
      for (let y = 0; y < this.gridHeight; y++) {
        for (let x = 0; x < this.gridWidth; x++) {
          const idx = y * this.gridWidth + x;
          const sprite = new Sprite(blank);
          sprite.position.set(x * CELL_WIDTH_PX, y * CELL_HEIGHT_PX);
          sprite.width = CELL_WIDTH_PX;
          sprite.height = CELL_HEIGHT_PX;
          sprite.visible = false;
          container.addChild(sprite);
          pool[idx] = sprite;
        }
      }
    }
  }

  public renderLayeredCells(frame: VisualGridFrame, bgGraphics?: Graphics, lightingGraphics?: Graphics): void {
    const cells = frame.cells;
    const maxCells = Math.min(cells.length, this.totalCells);
    const mode = this.tilesetResolver?.getRenderMode() ?? 'CP437_ASCII';

    for (let i = 0; i < maxCells; i++) {
      const cell = cells[i];
      if (!cell) continue;

      const px = cell.x * CELL_WIDTH_PX;
      const py = cell.y * CELL_HEIGHT_PX;

      if (bgGraphics) {
        const bgAlpha = cell.isUnderlay ? 0.22 : cell.visible ? 1.0 : cell.explored ? 0.65 : 1.0;
        bgGraphics.rect(px, py, CELL_WIDTH_PX, CELL_HEIGHT_PX).fill({
          color: fastHexColor(cell.visual.bgColor), alpha: bgAlpha,
        });
      }
      if (lightingGraphics && cell.steamPressureKpa > 0 && cell.visible) {
        lightingGraphics.rect(px + 2, py + 2, CELL_WIDTH_PX - 4, CELL_HEIGHT_PX - 4).fill({
          color: 0xd4af37, alpha: 0.18,
        });
      }

      if (cell.layers) {
        this.renderCellLayers(i, cell, cell.layers, frame.turnCount, mode);
      } else {
        this.renderLegacyCell(i, cell, frame.turnCount);
      }
    }
  }

  private updateSprite(
    sprite: Sprite, visual: GlyphLayerVisual | undefined, active: boolean, alpha: number,
    layer: TacticalLayerType, mode: VisualRenderMode,
  ): void {
    if (!active || !visual) { sprite.visible = false; return; }
    sprite.visible = true;
    sprite.texture = this.resolveTexture(visual, layer, mode);
    sprite.tint = fastHexColor(visual.fgPrimary);
    sprite.alpha = alpha;
  }

  private renderCellLayers(
    idx: number, cell: RenderCellFrame, layers: RenderCellLayers, turnCount: number, mode: VisualRenderMode,
  ): void {
    this.updateSprite(this.layerSpritePools.floor[idx]!, layers.floor,
      this.layerVisibility.floor && (cell.visible || cell.explored),
      cell.isUnderlay ? 0.22 : cell.visible ? (layers.floor.alpha ?? 1.0) : 0.42, 'floor', mode);

    this.updateSprite(this.layerSpritePools.fixture[idx]!, layers.fixture,
      Boolean(this.layerVisibility.fixture && layers.fixture && (cell.visible || cell.explored)),
      cell.visible ? (layers.fixture?.alpha ?? 1.0) : 0.50, 'fixture', mode);

    this.updateSprite(this.layerSpritePools.item[idx]!, layers.item,
      Boolean(this.layerVisibility.item && layers.item && cell.visible),
      layers.item?.alpha ?? 1.0, 'item', mode);

    const actV = layers.actor;
    const actS = this.layerSpritePools.actor[idx]!;
    if (this.layerVisibility.actor && actV && cell.visible) {
      actS.visible = true;
      actS.texture = this.resolveTexture(actV, 'actor', mode);
      const useSec =
        (actV.shaderFlags?.includes('PULSE_STEAM') && (cell.x + cell.y + turnCount) % 2 === 0) ||
        (actV.shaderFlags?.includes('SPARK_GLINT') && (cell.x * 3 + cell.y * 7 + turnCount) % 3 === 0);
      actS.tint = fastHexColor(useSec && actV.fgSecondary ? actV.fgSecondary : actV.fgPrimary);
      actS.alpha = actV.alpha ?? 1.0;
    } else { actS.visible = false; }

    this.updateSprite(this.layerSpritePools.indicator[idx]!, layers.indicator,
      Boolean(this.layerVisibility.indicator && layers.indicator),
      layers.indicator?.alpha ?? 0.75, 'indicator', mode);
  }

  private renderLegacyCell(idx: number, cell: RenderCellFrame, turnCount: number): void {
    const fs = this.layerSpritePools.floor[idx]!;
    this.layerSpritePools.fixture[idx]!.visible = false;
    this.layerSpritePools.item[idx]!.visible = false;
    this.layerSpritePools.actor[idx]!.visible = false;
    this.layerSpritePools.indicator[idx]!.visible = false;
    if (cell.visible || cell.explored) {
      const useSec =
        (cell.visual.shaderFlags.includes('PULSE_STEAM') && (cell.x + cell.y + turnCount) % 2 === 0) ||
        (cell.visual.shaderFlags.includes('SPARK_GLINT') && (cell.x * 3 + cell.y * 7 + turnCount) % 3 === 0);
      fs.visible = true;
      fs.texture = this.atlas.getTexture(cell.visual.glyph);
      fs.tint = fastHexColor(useSec ? cell.visual.fgSecondary : cell.visual.fgPrimary);
      fs.alpha = cell.isUnderlay ? 0.22 : cell.visible ? 1.0 : cell.explored ? 0.42 : 0.85;
    } else { fs.visible = false; }
  }

  private resolveTexture(visual: GlyphLayerVisual, layer: TacticalLayerType, mode: VisualRenderMode): Texture {
    if (this.tilesetResolver && visual.tileKey) {
      if (mode === 'GRAPHICAL_TILESET' || (mode === 'HYBRID_OVERLAY' && (layer === 'floor' || layer === 'fixture'))) {
        const tileTex = this.tilesetResolver.getTileTexture(visual.tileKey);
        if (tileTex) return tileTex;
      }
    }
    return this.atlas.getTexture(visual.glyph);
  }

  public setLayerVisibility(layer: TacticalLayerType, visible: boolean): void {
    this.layerVisibility[layer] = visible;
    this.layerContainers[layer].visible = visible;
  }

  public getLayerContainer(layer: TacticalLayerType): Container { return this.layerContainers[layer]; }
  public getSpritePool(layer: TacticalLayerType): readonly Sprite[] { return this.layerSpritePools[layer]; }
  public setTilesetResolver(resolver: TilesetTextureResolver | null): void { this.tilesetResolver = resolver; }
  public destroy(): void { this.rootContainer.destroy({ children: true }); }
}
