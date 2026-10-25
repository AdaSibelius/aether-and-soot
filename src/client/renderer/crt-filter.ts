import { Filter, GlProgram } from 'pixi.js';
import { STEAMPUNK_FRAGMENT_SHADER, STEAMPUNK_VERTEX_SHADER } from './steampunk-shader.js';

export const DEFAULT_SCANLINE_OPACITY = 0.033;

export interface SteampunkFilterOptions {
  readonly scanlineOpacity?: number;
  readonly thermoStress?: number;
  readonly smokeMask?: [number, number, number, number];
}

export function createCrtPostFilter(
  opacity: number = DEFAULT_SCANLINE_OPACITY,
  options: SteampunkFilterOptions = {},
): Filter {
  const glProgram = GlProgram.from({
    vertex: STEAMPUNK_VERTEX_SHADER,
    fragment: STEAMPUNK_FRAGMENT_SHADER,
  });

  const thermoStress = options.thermoStress ?? 0;
  const smokeMask = options.smokeMask ?? [0, 0, 0, 0];

  return new Filter({
    glProgram,
    resources: {
      crtUniforms: {
        uTime: { value: 0, type: 'f32' },
        uScanlineOpacity: { value: opacity, type: 'f32' },
        uThermoStress: { value: thermoStress, type: 'f32' },
        uSmokeMask: { value: new Float32Array(smokeMask), type: 'vec4<f32>' },
      },
    },
  });
}

export function updateSteampunkFilterUniforms(
  filter: Filter,
  time: number,
  thermoStress = 0,
  smokeMask: [number, number, number, number] = [0, 0, 0, 0],
): void {
  const uniforms = filter.resources.crtUniforms?.uniforms;
  if (!uniforms) return;
  uniforms.uTime = time;
  uniforms.uThermoStress = thermoStress;
  uniforms.uSmokeMask = smokeMask;
}
