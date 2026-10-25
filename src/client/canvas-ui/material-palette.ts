export const VICTORIAN_PALETTE = {
  SOOT_IRON_BG: '#0b0c0e',
  OXIDIZED_IRON: '#14171a',
  TARNISHED_BRASS: '#c5a059',
  AMBER_GASLIGHT: '#e6a145',
  SEPIA_PARCHMENT: '#261f18',
  SEPIA_INK: '#d2c29d',
  AETHER_BLUE: '#4deeea',
  INCANDESCENT_RED: '#ff3b1f',
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
