import { Filter, GlProgram } from 'pixi.js';
import {
  createDefaultShaderUniformValues,
  DiegeticShaderUniformValues,
  packShaderUniforms,
} from './shader-uniforms.js';

export const DIEGETIC_VERTEX_SHADER = `
  in vec2 aPosition;
  out vec2 vTextureCoord;

  uniform vec4 uInputSize;
  uniform vec4 uOutputFrame;
  uniform vec4 uOutputTexture;

  vec4 filterVertexPosition(void)
  {
      vec2 position = aPosition * uOutputFrame.zw + uOutputFrame.xy;
      position.x = position.x * (2.0 / uOutputTexture.x) - 1.0;
      position.y = position.y * (2.0 * uOutputTexture.z / uOutputTexture.y) - uOutputTexture.z;
      return vec4(position, 0.0, 1.0);
  }

  vec2 filterTextureCoord(void)
  {
      return aPosition * (uOutputFrame.zw * uInputSize.zw);
  }

  void main(void)
  {
      gl_Position = filterVertexPosition();
      vTextureCoord = filterTextureCoord();
  }
`;

export const DIEGETIC_FRAGMENT_SHADER = `
  in vec2 vTextureCoord;
  out vec4 finalColor;

  uniform sampler2D uTexture;
  uniform float uTime;
  uniform vec2 uResolution;
  uniform float uLensCurvature;
  uniform float uScanlineIntensity;
  uniform float uThermoStress;
  uniform float uChromaticAberration;
  uniform float uDistortionScale;
  uniform vec2 uBloomThresholds;

  // Pass 1: Spherical glass lens curvature (k = 0.08)
  vec2 applyLensCurvature(vec2 uv, float k) {
      vec2 d = uv - vec2(0.5);
      float r2 = dot(d, d);
      return vec2(0.5) + d * (1.0 + k * r2);
  }

  void main(void)
  {
      vec2 curvedUV = applyLensCurvature(vTextureCoord, uLensCurvature * uDistortionScale);

      // Dark oxidized bronze bezel boundary clamp
      if (curvedUV.x < 0.0 || curvedUV.x > 1.0 || curvedUV.y < 0.0 || curvedUV.y > 1.0) {
          finalColor = vec4(0.04, 0.05, 0.06, 1.0);
          return;
      }

      // Pass 4: Thermodynamic heat haze & chromatic aberration
      float heatHaze = sin(curvedUV.y * 36.0 + uTime * 4.2) * cos(curvedUV.x * 28.0 - uTime * 3.1);
      vec2 hazeOffset = vec2(heatHaze * 0.0005 * uThermoStress, 0.0);
      vec2 baseUV = curvedUV + hazeOffset;

      vec2 centered = baseUV - vec2(0.5);
      float caDist = length(centered);
      float caSplit = (uChromaticAberration + uThermoStress * 0.0012) * caDist;
      vec2 caDir = caDist > 0.001 ? normalize(centered) * caSplit : vec2(0.0);

      float r = texture(uTexture, baseUV - caDir).r;
      float g = texture(uTexture, baseUV).g;
      float b = texture(uTexture, baseUV + caDir).b;
      vec3 col = vec3(r, g, b);

      // Pass 3: Dual-threshold phosphor bloom (amber/cyan)
      vec3 bloom = vec3(0.0);
      float bShift = 0.0015;
      bloom += texture(uTexture, baseUV + vec2(bShift, 0.0)).rgb;
      bloom += texture(uTexture, baseUV - vec2(bShift, 0.0)).rgb;
      bloom += texture(uTexture, baseUV + vec2(0.0, bShift)).rgb;
      bloom += texture(uTexture, baseUV - vec2(0.0, bShift)).rgb;
      bloom *= 0.25;

      if (bloom.b > uBloomThresholds.y && bloom.g > 0.60) {
          col += bloom * vec3(0.30, 0.85, 1.00) * 0.20;
      }
      if (bloom.r > uBloomThresholds.x && bloom.g > 0.40) {
          col += bloom * vec3(1.15, 0.85, 0.30) * 0.16;
      }

      // Pass 2: Aperture grille shadow mask (luminance-only so glyphs never tint per pixel column)
      float scanline = sin(curvedUV.y * uResolution.y * 3.14159) * 0.5 + 0.5;
      col *= (1.0 - uScanlineIntensity * (1.0 - scanline));

      float triad = mod(curvedUV.x * uResolution.x, 3.0);
      vec3 triadMask = vec3(0.985);
      if (triad < 1.0) triadMask += 0.015;
      col *= triadMask;

      // Outer bezel vignette
      float vignette = 1.0 - dot(centered, centered) * 0.75;
      col *= clamp(vignette, 0.40, 1.0);

      // Microscopic Edison filament grain
      float grain = fract(sin(dot(curvedUV * 90.0, vec2(12.9898, 78.233)) + uTime * 0.05) * 43758.5453);
      col += (grain - 0.5) * 0.007;

      finalColor = vec4(col, 1.0);
  }
`;

export function createDiegeticPostFilter(
  options: Partial<DiegeticShaderUniformValues> = {},
): Filter {
  const glProgram = GlProgram.from({
    vertex: DIEGETIC_VERTEX_SHADER,
    fragment: DIEGETIC_FRAGMENT_SHADER,
  });

  const defaults = createDefaultShaderUniformValues();
  const values: DiegeticShaderUniformValues = {
    ...defaults,
    ...options,
  };

  return new Filter({
    glProgram,
    resources: {
      diegeticUniforms: packShaderUniforms(values),
    },
  });
}

export function updateDiegeticFilterUniforms(
  filter: Filter,
  values: DiegeticShaderUniformValues,
): void {
  const uniforms = (filter.resources.diegeticUniforms as { uniforms?: Record<string, unknown> } | undefined)?.uniforms;
  if (!uniforms) return;
  uniforms.uTime = values.time;
  uniforms.uResolution = values.resolution;
  uniforms.uLensCurvature = values.lensCurvature * values.distortionScale;
  uniforms.uScanlineIntensity = values.scanlineIntensity * values.distortionScale;
  uniforms.uThermoStress = values.thermoStress;
  uniforms.uChromaticAberration = values.chromaticAberration;
  uniforms.uDistortionScale = values.distortionScale;
  uniforms.uBloomThresholds = values.bloomThresholds;
}
