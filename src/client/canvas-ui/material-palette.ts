/**
 * Ratified Victorian Steampunk & Oxidized Iron Color Palette
 * Defines the canonical 6-token oxidized iron system, 4-tier Z-depth stratification,
 * and thermodynamic stress color resolution.
 */

export const VICTORIAN_PALETTE = {
  // 1. Ratified 6 Oxidized Iron Tokens
  DEEP_RUST: '#7A2E22',
  CHARCOAL: '#1B1F22',
  TARNISHED_BRASS: '#C5A059',
  VERDIGRIS: '#3D7E73',
  SULFUR_AMBER: '#E5A93C',
  SOOT_BLACK: '#0B0C0E',

  // 2. Named Semantic & Backward-Compatible Material Bindings
  SOOT_IRON_BG: '#0B0C0E',
  GUNMETAL: '#202A28',
  OXIDIZED_IRON: '#202A28',
  OXIDIZED_TEAL: '#3D7E73',
  AGED_BRASS: '#C5A059',
  POLISHED_BRASS: '#C1A15B',
  PARCHMENT: '#D9CCAA',
  AMBER_GASLIGHT: '#E5A93C',
  COPPER_ACCENT: '#cd7f32',
  VERDIGRIS_PATINA: '#3D7E73',
  RIVET_STEEL: '#7f8c8d',
  MUTED_PIPE: '#594928',
  SEPIA_PARCHMENT: '#261f18',
  SEPIA_INK: '#D9CCAA',
  AETHER_BLUE: '#355B54',
  INCANDESCENT_RED: '#B94B42',
  WARN_RED: '#B94B42',
  WARNING_RED: '#B94B42',
  OK_GREEN: '#2ecc71',
} as const;

export type VisualDepthTierKey =
  | 'Z0_TACTICAL_VOID'
  | 'Z1_RECESS_WELL'
  | 'Z2_MACHINED_CHASSIS'
  | 'Z3_EMISSIVE_READOUT';

export interface VisualDepthTier {
  readonly tier: VisualDepthTierKey;
  readonly zIndex: number;
  readonly bg: string;
  readonly fg: string;
  readonly border: string;
  readonly accent: string;
  readonly description: string;
}

export const VISUAL_DEPTH_TIERS: Record<VisualDepthTierKey, VisualDepthTier> = {
  Z0_TACTICAL_VOID: {
    tier: 'Z0_TACTICAL_VOID',
    zIndex: 0,
    bg: VICTORIAN_PALETTE.SOOT_BLACK,
    fg: '#4A5552',
    border: VICTORIAN_PALETTE.CHARCOAL,
    accent: VICTORIAN_PALETTE.DEEP_RUST,
    description: 'Sub-stratum tactical map void & background viewport underlay',
  },
  Z1_RECESS_WELL: {
    tier: 'Z1_RECESS_WELL',
    zIndex: 1,
    bg: VICTORIAN_PALETTE.CHARCOAL,
    fg: VICTORIAN_PALETTE.PARCHMENT,
    border: VICTORIAN_PALETTE.DEEP_RUST,
    accent: VICTORIAN_PALETTE.VERDIGRIS,
    description: 'Recessed readout wells, ticker-tape paper backing, and gauge beds',
  },
  Z2_MACHINED_CHASSIS: {
    tier: 'Z2_MACHINED_CHASSIS',
    zIndex: 2,
    bg: VICTORIAN_PALETTE.GUNMETAL,
    fg: VICTORIAN_PALETTE.TARNISHED_BRASS,
    border: VICTORIAN_PALETTE.TARNISHED_BRASS,
    accent: VICTORIAN_PALETTE.RIVET_STEEL,
    description: 'Raised heavy industrial chassis framing, structural bezels, and conduits',
  },
  Z3_EMISSIVE_READOUT: {
    tier: 'Z3_EMISSIVE_READOUT',
    zIndex: 3,
    bg: VICTORIAN_PALETTE.CHARCOAL,
    fg: VICTORIAN_PALETTE.SULFUR_AMBER,
    border: VICTORIAN_PALETTE.SULFUR_AMBER,
    accent: VICTORIAN_PALETTE.PARCHMENT,
    description: 'Active optical readouts, Bourdon needles, odometers, and vernier reticles',
  },
};

export function resolveVisualDepthTier(tier: VisualDepthTierKey): VisualDepthTier {
  return VISUAL_DEPTH_TIERS[tier];
}

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
        borderFg: VICTORIAN_PALETTE.SULFUR_AMBER,
        accentFg: '#f39c12',
        bg: VICTORIAN_PALETTE.SOOT_IRON_BG,
        primaryShaderFlag: 'GASLIGHT_BLOOM',
      };
    case 'NOMINAL':
    default:
      return {
        borderFg: VICTORIAN_PALETTE.TARNISHED_BRASS,
        accentFg: VICTORIAN_PALETTE.SULFUR_AMBER,
        bg: VICTORIAN_PALETTE.SOOT_IRON_BG,
      };
  }
}
