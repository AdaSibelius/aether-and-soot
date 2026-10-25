export type ShaderQualityTier = 'HIGH_OPTICAL' | 'BALANCED' | 'CRISP_TERMINAL';

export interface PerformanceSettings {
  readonly qualityTier: ShaderQualityTier;
  readonly reducedMotion: boolean;
  readonly disableLensDistortion: boolean;
  readonly autoScaleQuality: boolean;
}

export class PerformanceGovernor {
  private qualityTier: ShaderQualityTier = 'HIGH_OPTICAL';
  private reducedMotion = false;
  private disableLensDistortion = false;
  private autoScaleQuality = true;
  private readonly frameTimesMs: number[] = [];
  private readonly windowSize = 60;

  constructor(initialSettings?: Partial<PerformanceSettings>) {
    if (initialSettings?.qualityTier) this.qualityTier = initialSettings.qualityTier;
    if (initialSettings?.reducedMotion !== undefined) this.reducedMotion = initialSettings.reducedMotion;
    if (initialSettings?.disableLensDistortion !== undefined) this.disableLensDistortion = initialSettings.disableLensDistortion;
    if (initialSettings?.autoScaleQuality !== undefined) this.autoScaleQuality = initialSettings.autoScaleQuality;
  }

  public recordFrameTime(deltaMs: number): void {
    this.frameTimesMs.push(deltaMs);
    if (this.frameTimesMs.length > this.windowSize) {
      this.frameTimesMs.shift();
    }

    if (this.autoScaleQuality && this.frameTimesMs.length >= 30) {
      const avg = this.getAverageFrameTimeMs();
      if (avg > 33.3 && this.qualityTier === 'HIGH_OPTICAL') {
        this.qualityTier = 'BALANCED';
      } else if (avg > 45.0 && this.qualityTier === 'BALANCED') {
        this.qualityTier = 'CRISP_TERMINAL';
      } else if (avg < 16.6 && this.qualityTier === 'CRISP_TERMINAL') {
        this.qualityTier = 'BALANCED';
      }
    }
  }

  public getAverageFrameTimeMs(): number {
    if (this.frameTimesMs.length === 0) return 16.67;
    const sum = this.frameTimesMs.reduce((acc, v) => acc + v, 0);
    return sum / this.frameTimesMs.length;
  }

  public getFps(): number {
    const avg = this.getAverageFrameTimeMs();
    return avg > 0 ? Math.round(1000 / avg) : 60;
  }

  public getQualityTier(): ShaderQualityTier {
    return this.qualityTier;
  }

  public setQualityTier(tier: ShaderQualityTier): void {
    this.qualityTier = tier;
  }

  public isReducedMotion(): boolean {
    return this.reducedMotion;
  }

  public setReducedMotion(enabled: boolean): void {
    this.reducedMotion = enabled;
  }

  public isLensDistortionDisabled(): boolean {
    return this.disableLensDistortion || this.qualityTier === 'CRISP_TERMINAL';
  }

  public setLensDistortionDisabled(disabled: boolean): void {
    this.disableLensDistortion = disabled;
  }

  public isAutoScaleQuality(): boolean {
    return this.autoScaleQuality;
  }

  public setAutoScaleQuality(enabled: boolean): void {
    this.autoScaleQuality = enabled;
  }

  public getEffectiveDistortionScale(): number {
    if (this.isLensDistortionDisabled()) return 0.0;
    if (this.qualityTier === 'BALANCED') return 0.5;
    return 1.0;
  }

  public getEffectiveScanlineOpacity(): number {
    if (this.qualityTier === 'CRISP_TERMINAL') return 0.0;
    if (this.qualityTier === 'BALANCED') return 0.015;
    return 0.033;
  }

  public shouldSimulateSmoke(): boolean {
    return this.qualityTier === 'HIGH_OPTICAL';
  }

  public shouldApplyTremorJitter(): boolean {
    return !this.reducedMotion && this.qualityTier !== 'CRISP_TERMINAL';
  }
}

let defaultGovernor: PerformanceGovernor | null = null;

export function getPerformanceGovernor(): PerformanceGovernor {
  if (!defaultGovernor) {
    defaultGovernor = new PerformanceGovernor();
  }
  return defaultGovernor;
}
