import { LiquidTypeId, VisualGlyphSpec } from '../../schemas/primitives.schema.js';

export const SOOT_OCCLUSION_GLYPHS = ['%', '&', '*'] as const;

/**
 * Returns dynamic ASCII glyph and soot styling if a soot cloud or coal dust is present.
 */
export function applySootVisualOverlay(
  base: VisualGlyphSpec,
  smokePpm: number,
  coalDustDensity: number,
  worldX: number,
  worldY: number,
  turnCount: number,
  isVisible: boolean,
  isExplored: boolean = true,
): VisualGlyphSpec {
  if (!isExplored) return base;
  if (smokePpm < 50 && coalDustDensity < 0.2) return base;

  const glyphIndex = Math.abs(worldX + worldY + turnCount) % SOOT_OCCLUSION_GLYPHS.length;
  const sootGlyph = SOOT_OCCLUSION_GLYPHS[glyphIndex] ?? '%';

  const fgPrimary = isVisible ? '#5D6D7E' : '#2C3E50';
  const fgSecondary = '#34495E';
  const shaderFlags = isVisible && !base.shaderFlags.includes('SOOT_OCCLUSION')
    ? [...base.shaderFlags, 'SOOT_OCCLUSION' as const]
    : base.shaderFlags;

  return {
    glyph: sootGlyph,
    fgPrimary,
    fgSecondary,
    bgColor: base.bgColor,
    shaderFlags,
  };
}

/**
 * Applies surface liquid puddles (whale oil, acid) visual styling.
 */
export function applyLiquidSurfaceVisual(
  base: VisualGlyphSpec,
  liquidType?: LiquidTypeId,
  volumeMl?: number,
  isVisible: boolean = true,
  isExplored: boolean = true,
): VisualGlyphSpec {
  if (!isExplored) return base;
  if (!liquidType || liquidType === 'NONE' || (volumeMl ?? 0) <= 0) return base;

  if (liquidType === 'WHALE_OIL') {
    return {
      glyph: '~',
      fgPrimary: isVisible ? '#E67E22' : '#784212',
      fgSecondary: '#BA4A00',
      bgColor: base.bgColor,
      shaderFlags: isVisible && !base.shaderFlags.includes('SPARK_GLINT')
        ? [...base.shaderFlags, 'SPARK_GLINT' as const]
        : base.shaderFlags,
    };
  }

  if (liquidType === 'NITRIC_ACID') {
    return {
      glyph: '≈',
      fgPrimary: isVisible ? '#2ECC71' : '#145A32',
      fgSecondary: '#27AE60',
      bgColor: base.bgColor,
      shaderFlags: isVisible && !base.shaderFlags.includes('HEAT_SHIMMER')
        ? [...base.shaderFlags, 'HEAT_SHIMMER' as const]
        : base.shaderFlags,
    };
  }

  return base;
}

/**
 * Applies volumetric gaslight radiance to illuminated tiles.
 */
export function applyGaslightVisual(
  base: VisualGlyphSpec,
  isGaslit: boolean,
): VisualGlyphSpec {
  if (!isGaslit || base.shaderFlags.includes('GASLIGHT_RADIANCE')) return base;
  return {
    ...base,
    shaderFlags: [...base.shaderFlags, 'GASLIGHT_RADIANCE'],
  };
}
