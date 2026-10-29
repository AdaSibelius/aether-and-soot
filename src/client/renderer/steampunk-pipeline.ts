import { Container, Filter } from 'pixi.js';
import { createDiegeticPostFilter, updateDiegeticFilterUniforms } from './diegetic-post-filter.js';
import {
  createDefaultShaderUniformValues,
  DiegeticShaderUniformValues,
  interpolateThermoStress,
} from './shader-uniforms.js';

export type PipelineLayerId =
  | 'WORLD_TACTICAL'
  | 'GASLIGHT_LIGHTING'
  | 'DIEGETIC_FRAME'
  | 'CANVAS_UI_BUFFER'
  | 'OPTICAL_OVERLAY';

export interface PipelineStageLayers {
  readonly worldTacticalContainer: Container;
  readonly tacticalWorldContainer: Container;
  readonly gaslightLightingContainer: Container;
  readonly diegeticFrameContainer: Container;
  readonly canvasUiBufferContainer: Container;
  readonly canvasUiContainer: Container;
  readonly opticalOverlayContainer: Container;
}

export class SteampunkRenderPipeline {
  public readonly rootStage: Container;
  public readonly layers: PipelineStageLayers;
  private readonly postFilter: Filter | null = null;
  private readonly uniforms: DiegeticShaderUniformValues;
  private filterEnabled = true;

  public constructor(widthPx: number, heightPx: number, enableShaders = true) {
    this.rootStage = new Container();
    this.rootStage.sortableChildren = true;

    const worldTactical = new Container();
    worldTactical.zIndex = 10;
    const gaslightLighting = new Container();
    gaslightLighting.zIndex = 20;
    const diegeticFrame = new Container();
    diegeticFrame.zIndex = 30;
    const canvasUiBuffer = new Container();
    canvasUiBuffer.zIndex = 40;
    const opticalOverlay = new Container();
    opticalOverlay.zIndex = 50;

    this.rootStage.addChild(worldTactical);
    this.rootStage.addChild(gaslightLighting);
    this.rootStage.addChild(diegeticFrame);
    this.rootStage.addChild(canvasUiBuffer);
    this.rootStage.addChild(opticalOverlay);

    this.layers = {
      worldTacticalContainer: worldTactical,
      tacticalWorldContainer: worldTactical,
      gaslightLightingContainer: gaslightLighting,
      diegeticFrameContainer: diegeticFrame,
      canvasUiBufferContainer: canvasUiBuffer,
      canvasUiContainer: canvasUiBuffer,
      opticalOverlayContainer: opticalOverlay,
    };

    this.uniforms = createDefaultShaderUniformValues(widthPx, heightPx);

    if (enableShaders) {
      try {
        this.postFilter = createDiegeticPostFilter(this.uniforms);
        this.rootStage.filters = [this.postFilter];
      } catch (err) {
        console.warn('[SteampunkRenderPipeline] Shader compilation fallback:', err);
      }
    }
  }

  public setFilterEnabled(enabled: boolean): void {
    this.filterEnabled = enabled;
    if (this.postFilter) {
      this.rootStage.filters = enabled ? [this.postFilter] : [];
    }
  }

  public isFilterEnabled(): boolean {
    return this.filterEnabled;
  }

  public getUniforms(): Readonly<DiegeticShaderUniformValues> {
    return this.uniforms;
  }

  public updateUniforms(
    targetThermoStress: number,
    dtSeconds: number,
    distortionScale = 1.0,
    advanceTime = true,
  ): void {
    if (advanceTime) {
      this.uniforms.time += dtSeconds;
    }
    this.uniforms.distortionScale = distortionScale;
    this.uniforms.thermoStress = interpolateThermoStress(
      this.uniforms.thermoStress,
      targetThermoStress,
      dtSeconds,
    );

    if (this.postFilter && this.filterEnabled) {
      updateDiegeticFilterUniforms(this.postFilter, this.uniforms);
    }
  }

  public getLayer(layer: PipelineLayerId): Container {
    switch (layer) {
      case 'WORLD_TACTICAL':
        return this.layers.worldTacticalContainer;
      case 'GASLIGHT_LIGHTING':
        return this.layers.gaslightLightingContainer;
      case 'DIEGETIC_FRAME':
        return this.layers.diegeticFrameContainer;
      case 'CANVAS_UI_BUFFER':
        return this.layers.canvasUiBufferContainer;
      case 'OPTICAL_OVERLAY':
        return this.layers.opticalOverlayContainer;
    }
  }
}
