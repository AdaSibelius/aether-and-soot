export interface DiegeticShaderUniformValues {
  time: number;
  thermoStress: number;
  lensCurvature: number;
  scanlineIntensity: number;
  chromaticAberration: number;
  distortionScale: number;
  resolution: [number, number];
  bloomThresholds: [number, number]; // [amberMin, cyanMin]
}

export const DEFAULT_LENS_CURVATURE = 0.03;
export const DEFAULT_SCANLINE_INTENSITY = 0.08;
export const DEFAULT_CHROMATIC_ABERRATION = 0.0008;

export function createDefaultShaderUniformValues(
  widthPx = 1056,
  heightPx = 720,
): DiegeticShaderUniformValues {
  return {
    time: 0,
    thermoStress: 0,
    lensCurvature: DEFAULT_LENS_CURVATURE,
    scanlineIntensity: DEFAULT_SCANLINE_INTENSITY,
    chromaticAberration: DEFAULT_CHROMATIC_ABERRATION,
    distortionScale: 1.0,
    resolution: [widthPx, heightPx],
    bloomThresholds: [0.65, 0.70],
  };
}

/**
 * Linearly interpolates thermodynamic stress toward target with exponential dampening,
 * preventing sudden chromatic jarring during sudden steam vent bursts.
 */
export function interpolateThermoStress(
  current: number,
  target: number,
  dtSeconds: number,
  decaySpeed = 4.0,
): number {
  const alpha = 1.0 - Math.exp(-decaySpeed * dtSeconds);
  const next = current + (target - current) * alpha;
  return Math.abs(next) < 0.001 ? 0 : Math.min(1.0, Math.max(0.0, next));
}

/**
 * Packs diegetic uniform parameters into PixiJS v8 GlProgram resource record.
 */
export function packShaderUniforms(values: DiegeticShaderUniformValues): Record<string, { value: unknown; type: string }> {
  return {
    uTime: { value: values.time, type: 'f32' },
    uResolution: { value: new Float32Array(values.resolution), type: 'vec2<f32>' },
    uLensCurvature: { value: values.lensCurvature * values.distortionScale, type: 'f32' },
    uScanlineIntensity: { value: values.scanlineIntensity * values.distortionScale, type: 'f32' },
    uThermoStress: { value: values.thermoStress, type: 'f32' },
    uChromaticAberration: { value: values.chromaticAberration, type: 'f32' },
    uDistortionScale: { value: values.distortionScale, type: 'f32' },
    uBloomThresholds: { value: new Float32Array(values.bloomThresholds), type: 'vec2<f32>' },
  };
}

export { resolveThermodynamicStress } from './steampunk-shader.js';
export type { ThermodynamicStressResult } from './steampunk-shader.js';
