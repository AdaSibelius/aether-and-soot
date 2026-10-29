export const VICTORIAN_PALETTE = {
  // Core 6-color ratified Victorian Industrial tokens
  SOOT_BLACK: '#101615',
  GUNMETAL: '#202A28',
  OXIDIZED_TEAL: '#355B54',
  AGED_BRASS: '#C1A15B',
  PARCHMENT: '#D9CCAA',
  WARNING_RED: '#B94B42',

  // Named semantic & legacy backward-compatible bindings
  SOOT_IRON_BG: '#101615',
  OXIDIZED_IRON: '#202A28',
  TARNISHED_BRASS: '#c5a059',
  AMBER_GASLIGHT: '#e6a145',
  SEPIA_PARCHMENT: '#261f18',
  SEPIA_INK: '#D9CCAA',
  AETHER_BLUE: '#355B54',
  INCANDESCENT_RED: '#B94B42',
  WARN_RED: '#B94B42',
  OK_GREEN: '#2ecc71',
  POLISHED_BRASS: '#C1A15B',
  COPPER_ACCENT: '#d35400',
  VERDIGRIS_PATINA: '#355B54',
  RIVET_STEEL: '#7f8c8d',
  MUTED_PIPE: '#594928',
} as const;

export type ThermodynamicStressLevel = 'NOMINAL' | 'ELEVATED' | 'CRITICAL';

export type ExtendedShaderFlag =
  | 'GASLIGHT_BLOOM'
  | 'AETHER_HALATION'
  | 'THERMO_CRITICAL_PULSE'
  | 'SMOKE_MASK_REGION'
  | 'TREMOR_JITTER';

export interface ThermodynamicPaletteResult {
  readonly borderFg: string;
  readonly accentFg: string;
  readonly bg: string;
  readonly primaryShaderFlag?: ExtendedShaderFlag;
}

export function resolveThermodynamicPalette(
  stressLevel: ThermodynamicStressLevel = 'NOMINAL',
): ThermodynamicPaletteResult {
  switch (stressLevel) {
    case 'CRITICAL':
      return {
        borderFg: VICTORIAN_PALETTE.INCANDESCENT_RED,
        accentFg: '#ff6b4a',
        bg: VICTORIAN_PALETTE.SOOT_IRON_BG,
        primaryShaderFlag: 'THERMO_CRITICAL_PULSE',
      };
    case 'ELEVATED':
      return {
        borderFg: VICTORIAN_PALETTE.AMBER_GASLIGHT,
        accentFg: '#f39c12',
        bg: VICTORIAN_PALETTE.SOOT_IRON_BG,
        primaryShaderFlag: 'GASLIGHT_BLOOM',
      };
    case 'NOMINAL':
    default:
      return {
        borderFg: VICTORIAN_PALETTE.TARNISHED_BRASS,
        accentFg: VICTORIAN_PALETTE.AMBER_GASLIGHT,
        bg: VICTORIAN_PALETTE.SOOT_IRON_BG,
      };
  }
}
