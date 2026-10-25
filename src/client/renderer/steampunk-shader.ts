import { EntityId } from '../../schemas/primitives.schema.js';
import { WorldState } from '../../sim/core/world.js';

export const STEAMPUNK_VERTEX_SHADER = `
  in vec2 aPosition;
  out vec2 vTextureCoord;

  uniform vec4 uInputSize;
  uniform vec4 uOutputFrame;
  uniform vec4 uOutputTexture;

  vec4 filterVertexPosition(void)
  {
      vec2 position = aPosition * uOutputFrame.zw + uOutputFrame.xy;
      position.x = position.x * (2.0 / uOutputTexture.x) - 1.0;
      position.y = position.y * (2.0*uOutputTexture.z / uOutputTexture.y) - uOutputTexture.z;
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

export const STEAMPUNK_FRAGMENT_SHADER = `
  in vec2 vTextureCoord;
  out vec4 finalColor;

  uniform sampler2D uTexture;
  uniform float uTime;
  uniform float uScanlineOpacity;
  uniform float uThermoStress;
  uniform vec4 uSmokeMask;
  uniform float uDistortionScale;

  void main(void)
  {
      vec2 uv = vTextureCoord;
      vec2 centered = uv - vec2(0.5);
      float dist = length(centered);

      // 1. Crisp Edison Phosphor Surface — No wavy text distortion in reading area
      // Restrict subtle lens vignette purely to the outermost rim (dist > 0.46)
      float rimFactor = smoothstep(0.46, 0.50, dist) * uDistortionScale;
      vec2 sampleUV = uv + centered * (rimFactor * 0.005);

      vec3 col = texture(uTexture, sampleUV).rgb;

      // 2. Microscopic phosphor dust (barely perceptible grain)
      float grain = fract(sin(dot(sampleUV * 120.0, vec2(12.9898, 78.233)) + uTime * 0.02) * 43758.5453);
      col += (grain - 0.5) * 0.008;

      // 3. Crisp selective phosphor bloom (warm gaslight amber & sharp aether blue)
      vec3 bloom = vec3(0.0);
      float bShift = 0.0010;
      bloom += texture(uTexture, sampleUV + vec2(bShift, 0.0)).rgb;
      bloom += texture(uTexture, sampleUV - vec2(bShift, 0.0)).rgb;
      bloom += texture(uTexture, sampleUV + vec2(0.0, bShift)).rgb;
      bloom += texture(uTexture, sampleUV - vec2(0.0, bShift)).rgb;
      bloom *= 0.25;

      if (bloom.b > 0.70 && bloom.g > 0.65) {
          col += bloom * 0.15; // Sharp aether cyan glow
      } else if (bloom.r > 0.60 && bloom.g > 0.40) {
          col += bloom * vec3(1.10, 0.85, 0.35) * 0.12; // Warm amber gaslight bloom
      }

      // 4. Localized procedural volumetric smoke plumes within masked UV bounds
      if (uSmokeMask.z > uSmokeMask.x &&
          sampleUV.x >= uSmokeMask.x && sampleUV.x <= uSmokeMask.z &&
          sampleUV.y >= uSmokeMask.y && sampleUV.y <= uSmokeMask.w) {
          float smokeNoise = sin(sampleUV.x * 24.0 + uTime * 1.6) * cos((sampleUV.y - uTime * 0.9) * 18.0);
          float plume = smoothstep(0.15, 0.85, smokeNoise * 0.5 + 0.5) * 0.14;
          col = mix(col, vec3(0.20, 0.16, 0.13), plume);
      }

      // 5. Thermodynamic stress pulse restricted to outer edge bezel (never washes text)
      if (uThermoStress > 0.0) {
          float pulse = (sin(uTime * 4.5) * 0.5 + 0.5) * uThermoStress;
          float edgeStress = smoothstep(0.35, 0.50, dist) * pulse;
          col = mix(col, col * vec3(1.35, 0.35, 0.25) + vec3(0.18, 0.02, 0.0) * edgeStress, edgeStress * 0.55);
      }

      // 6. Ultra-fine hairline scanlines & soot-glass bezel
      float scanline = sin(sampleUV.y * 720.0 + uTime * 1.0) * uScanlineOpacity;
      col -= scanline;

      float vignette = 1.0 - dot(centered, centered) * 0.55;
      col *= clamp(vignette, 0.45, 1.0);

      finalColor = vec4(col, 1.0);
  }
`;

export interface ThermodynamicStressResult {
  readonly stressValue: number;
  readonly stressLevel: 'NOMINAL' | 'ELEVATED' | 'CRITICAL';
  readonly reason: string;
}

export function resolveThermodynamicStress(
  state: Readonly<WorldState>,
  actorId: EntityId,
): ThermodynamicStressResult {
  const actor = state.entities[actorId];
  const anatomy = actor?.anatomy;

  const steam = anatomy?.steamReserveKpa ?? 0;
  const maxSteam = anatomy?.maxSteamReserveKpa ?? 100;
  const steamRatio = maxSteam > 0 ? steam / maxSteam : 0;
  const strainLoadKw = anatomy?.strainLoadKw ?? 0;
  const governorCapKw = anatomy?.governorCapacityKw ?? 100;
  const strainRatio = governorCapKw > 0 ? strainLoadKw / governorCapKw : 0;
  const toxicity = (anatomy?.toxicityPct ?? 0) / 100;

  const pos = actor?.position;
  const stratumGrid = pos ? state.strata[pos.stratum] : undefined;
  const currentCell = (pos && stratumGrid) ? stratumGrid.cells[pos.y * stratumGrid.width + pos.x] : undefined;
  const ambientSteamKpa = currentCell?.steamPressureKpa ?? 0;

  const maxStress = Math.max(steamRatio, strainRatio, toxicity, ambientSteamKpa / 100);

  if (maxStress >= 0.85 || steam >= 90) {
    return {
      stressValue: Math.min(1.0, maxStress),
      stressLevel: 'CRITICAL',
      reason: steam >= 90 ? 'CRITICAL_BOILER_PRESSURE' : 'GOVERNOR_OVERHEAT',
    };
  }
  if (maxStress >= 0.50 || steam >= 50) {
    return {
      stressValue: maxStress,
      stressLevel: 'ELEVATED',
      reason: 'ELEVATED_THERMAL_LOAD',
    };
  }
  return {
    stressValue: 0.0,
    stressLevel: 'NOMINAL',
    reason: 'NOMINAL_OPERATION',
  };
}
