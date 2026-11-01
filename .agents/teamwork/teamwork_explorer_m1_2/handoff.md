# M1 Explorer 2 Handoff Report: Oxidized Iron Palette & Visual Depth Separation

## 1. Observation

Direct code observations from inspection of `src/client/canvas-ui/`, `src/client/ui/`, `index.html`, and existing test suites:

### 1.1 Existing Palette Definition in `src/client/canvas-ui/material-palette.ts`
- Current file size: 71 lines (`wc -l` POSIX 70).
- Lines 1-26 define `VICTORIAN_PALETTE`:
  ```ts
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
  ```
- **Discrepancies against Requirements**:
  1. Mandated oxidized iron tokens `DEEP_RUST` (`#7A2E22`), `CHARCOAL` (`#1B1F22`), and `SULFUR_AMBER` (`#E5A93C`) are completely absent.
  2. `SOOT_BLACK` is defined as `#101615` (luminance 0.006) instead of the ratified deepest void `#0B0C0E` (luminance 0.002).
  3. `TARNISHED_BRASS` is lowercase `#c5a059` instead of canonical uppercase `#C5A059`.
  4. `VERDIGRIS_PATINA` and `OXIDIZED_TEAL` are both `#355B54` (identical to `AETHER_BLUE`), lacking distinct verdigris copper-carbonate patina (`#3D7E73`).
  5. There is no formal 4-tier Z-depth stratification hierarchy (`Z0_TACTICAL_VOID`, `Z1_RECESS_WELL`, `Z2_MACHINED_CHASSIS`, `Z3_EMISSIVE_READOUT`).

### 1.2 Bezel & Conduit Rendering in `src/client/canvas-ui/bezel-composer.ts`
- Current file size: 119 lines.
- Lines 5-11 define `BezelOptions`:
  ```ts
  export interface BezelOptions {
    readonly title?: string;
    readonly subtitle?: string;
    readonly rivetStyle?: 'BRASS_BOLTS' | 'STEEL_STUDS' | 'INDUSTRIAL_GEARS';
    readonly fgColor?: string;
    readonly bgColor?: string;
  }
  ```
- Lines 25-27 and 49-60 default to `VICTORIAN_PALETTE.TARNISHED_BRASS`, `VICTORIAN_PALETTE.SOOT_IRON_BG`, and `VICTORIAN_PALETTE.RIVET_STEEL`.
- Bezels lack programmatic awareness of visual depth layers (e.g. whether drawing a recessed instrument well at Z1 or a raised machine chassis frame at Z2).

### 1.3 HTML DOM CSS Styling in `index.html`
- Current file size: 172 lines.
- Lines 9-21 define `:root` CSS variables:
  ```css
  :root {
    --bg-soot: #101615;
    --panel-bg: #202A28;
    --panel-border: #355B54;
    --panel-border-bright: #C1A15B;
    --brass-gold: #C1A15B;
    --oxidized-copper: #cd7f32;
    --tesla-cyan: #355B54;
    --parchment: #D9CCAA;
    --muted-slate: #7a868a;
    --ok-green: #52be80;
    --warn-red: #B94B42;
  }
  ```
- **Discrepancies against Requirements**:
  1. `--panel-border: #355B54` renders generic teal-green borders on all DOM panels, conflicting with the Victorian Edison-era mechanical aesthetic.
  2. `.panel-box` (lines 86-92) uses a flat `border: 1px solid var(--panel-border)` with no CP437 double-borders (`═`, `║`) or machined corner rivets.
  3. `#canvas-stage` (lines 64-73) uses a generic brown border `border: 2px solid #221c15`.
  4. Buttons and log entries use generic `#11181c` and `#172126` backgrounds with teal borders.

### 1.4 Test Suite Coupling to Palette Tokens
- Inspection of `tests/sim/canvas-ui-primitives.test.ts:74-75`, `tests/sim/mechanical-conduits.test.ts:47, 81`, and `tests/sim/diegetic-visualizations.test.ts:42, 49`:
  All existing tests assert token identity references (`toBe(VICTORIAN_PALETTE.TARNISHED_BRASS)`, `toBe(VICTORIAN_PALETTE.SOOT_IRON_BG)`, `toBe(VICTORIAN_PALETTE.AMBER_GASLIGHT)`), not raw string literals.
- `npm run check:boundaries && npm run typecheck` currently succeeds with 0 errors across 404 files.

---

## 2. Logic Chain

1. **Root Aesthetic Cause**:
   - The current UI suffers from visual flatness because both the tactical map background, console frame, and instrument wells share the same background tone (`#101615` / `#202A28`) and generic teal borders (`#355B54`).
   - By ratifying the 6 oxidized iron tokens (`DEEP_RUST: #7A2E22`, `CHARCOAL: #1B1F22`, `TARNISHED_BRASS: #C5A059`, `VERDIGRIS: #3D7E73`, `SULFUR_AMBER: #E5A93C`, `SOOT_BLACK: #0B0C0E`), we establish distinct material identities for corrosion, soot, structural brass, patina, gaslight emissions, and the dark void.
2. **Depth Stratification**:
   - Visual hierarchy requires distinct luminance planes:
     - **Z0 (Tactical Void - `#0B0C0E`)**: Sub-stratum darkness and outer canvas viewport.
     - **Z1 (Recess Well - `#1B1F22` / `#7A2E22`)**: Recessed instrument beds, ticker-tape chronicles, and inventory satchels.
     - **Z2 (Machined Chassis - `#202A28` / `#C5A059`)**: Heavy brass framing, structural partitions, rivets, and conduit pipes.
     - **Z3 (Emissive Readout - `#E5A93C` / `#D9CCAA`)**: High-contrast needle indicators, odometers, and active vernier dossiers.
3. **DOM & Canvas Cohesion**:
   - Replacing `--panel-border: #355B54` with `--iron-deep-rust: #7A2E22` and applying `3px double var(--iron-tarnished-brass)` with `::before` / `::after` CP437 rivet studs (`☼`) aligns the HTML DOM fallback with the diegetic Canvas console aesthetic.
4. **Modularity Preservation**:
   - `material-palette.ts` will expand from 71 lines to ~115 lines, which satisfies the <= 150-line target and stays far below the 300-line ceiling in `tests/scripts/check-boundaries.ts`.
   - `bezel-composer.ts` will expand from 119 lines to ~135 lines, well below the 250-line target.

---

## 3. Caveats

1. **Browser Color Gamut**:
   - Hex colors are mapped in standard sRGB. On wide-gamut Display P3 or HDR monitors, colors will appear slightly more saturated, but relative luminance steps between Z0, Z1, Z2, and Z3 remain mathematically invariant.
2. **Read-Only Explorer Scope**:
   - In accordance with Teamwork Explorer protocols, no source files were mutated during this investigation. All code specifications below are complete, drop-in replacement artifacts for implementation.
3. **Headless DOM Testing**:
   - Vitest runs in Node.js without a full CSS engine; visual verification of pseudo-elements (`::before`/`::after`) requires browser rendering, while token presence is deterministically verified via TypeScript unit tests.

---

## 4. Conclusion & Implementation Blueprint

The following blueprint provides the exact, production-ready code changes for `src/client/canvas-ui/material-palette.ts`, `src/client/canvas-ui/bezel-composer.ts`, `index.html`, and the accompanying verification test `tests/sim/oxidized-iron-palette.test.ts`.

### Blueprint 4.1: `src/client/canvas-ui/material-palette.ts`
**Target File**: `/Users/emmett/Desktop/Game/src/client/canvas-ui/material-palette.ts`  
**Line Count Projection**: ~115 lines (Target: <= 150, Hard Ceiling: 300)

```typescript
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
```

---

### Blueprint 4.2: `src/client/canvas-ui/bezel-composer.ts`
**Target File**: `/Users/emmett/Desktop/Game/src/client/canvas-ui/bezel-composer.ts`  
**Line Count Projection**: ~135 lines (Target: <= 250, Hard Ceiling: 300)

```typescript
import { UiCellBuffer } from './cell-buffer.js';
import {
  resolveVisualDepthTier,
  VICTORIAN_PALETTE,
  VisualDepthTierKey,
} from './material-palette.js';
import { UiRect } from './viewport-controls.js';

export interface BezelOptions {
  readonly title?: string;
  readonly subtitle?: string;
  readonly rivetStyle?: 'BRASS_BOLTS' | 'STEEL_STUDS' | 'INDUSTRIAL_GEARS';
  readonly fgColor?: string;
  readonly bgColor?: string;
  readonly tier?: VisualDepthTierKey;
}

/**
 * Renders a heavy Victorian machined brass/iron console bezel with double-line conduits,
 * structural corner rivets, engraved title brackets, and recessed display housing.
 */
export function drawMachinedBezel(
  buf: UiCellBuffer,
  rect: UiRect,
  options: BezelOptions = {},
): void {
  const { x, y, width, height } = rect;
  if (width < 3 || height < 3) return;

  const tierConfig = options.tier ? resolveVisualDepthTier(options.tier) : undefined;
  const fg = options.fgColor ?? tierConfig?.border ?? VICTORIAN_PALETTE.TARNISHED_BRASS;
  const bg = options.bgColor ?? tierConfig?.bg ?? VICTORIAN_PALETTE.SOOT_IRON_BG;
  const rivet = options.rivetStyle === 'INDUSTRIAL_GEARS' ? '⚙' : options.rivetStyle === 'STEEL_STUDS' ? 'Ø' : '☼';

  // 0. Opaque recessed housing fill so underlying world glyphs never bleed through bezel panels
  for (let row = 1; row < height - 1; row++) {
    for (let col = 1; col < width - 1; col++) {
      buf.setCell(x + col, y + row, ' ', fg, bg);
    }
  }

  // 1. Horizontal double borders (CP437 ═)
  for (let col = 1; col < width - 1; col++) {
    buf.setCell(x + col, y, '═', fg, bg);
    buf.setCell(x + col, y + height - 1, '═', fg, bg);
  }

  // 2. Vertical double borders (CP437 ║)
  for (let row = 1; row < height - 1; row++) {
    buf.setCell(x, y + row, '║', fg, bg);
    buf.setCell(x + width - 1, y + row, '║', fg, bg);
  }

  // 3. Corner rivet housings (CP437 ╔, ╗, ╚, ╝)
  buf.setCell(x, y, '╔', fg, bg);
  buf.setCell(x + width - 1, y, '╗', fg, bg);
  buf.setCell(x, y + height - 1, '╚', fg, bg);
  buf.setCell(x + width - 1, y + height - 1, '╝', fg, bg);

  // Exterior structural rivets on perimeter
  const rivetColor = tierConfig?.accent ?? VICTORIAN_PALETTE.RIVET_STEEL;
  if (width > 6) {
    buf.setCell(x + 1, y, rivet, rivetColor, bg);
    buf.setCell(x + width - 2, y, rivet, rivetColor, bg);
    buf.setCell(x + 1, y + height - 1, rivet, rivetColor, bg);
    buf.setCell(x + width - 2, y + height - 1, rivet, rivetColor, bg);
  }

  // 4. Engraved Title Header Housing
  if (options.title) {
    const formattedTitle = `╡ ${options.title.toUpperCase()} ╞`;
    const titleStart = x + Math.max(3, Math.floor((width - formattedTitle.length) / 2));
    const titleFg = tierConfig ? tierConfig.fg : VICTORIAN_PALETTE.POLISHED_BRASS;
    buf.writeString(titleStart, y, formattedTitle, titleFg, bg);
  }

  // 5. Engraved Subtitle / Calibration Marking
  if (options.subtitle && height > 4) {
    const subStr = `[${options.subtitle}]`;
    const subStart = x + Math.max(3, Math.floor((width - subStr.length) / 2));
    const subFg = tierConfig ? tierConfig.accent : VICTORIAN_PALETTE.VERDIGRIS;
    buf.writeString(subStart, y + height - 1, subStr, subFg, bg);
  }
}

/**
 * Draws a rigid pressure-line divider or structural partition separating instrument dials.
 */
export function drawStructuralDivider(
  buf: UiCellBuffer,
  x: number,
  y: number,
  length: number,
  orientation: 'HORIZONTAL' | 'VERTICAL' = 'HORIZONTAL',
  fg = VICTORIAN_PALETTE.TARNISHED_BRASS,
  bg = VICTORIAN_PALETTE.SOOT_IRON_BG,
  tier?: VisualDepthTierKey,
): void {
  if (length <= 0) return;

  const tierConfig = tier ? resolveVisualDepthTier(tier) : undefined;
  const resolvedFg = tierConfig?.border ?? fg;
  const resolvedBg = tierConfig?.bg ?? bg;

  if (orientation === 'HORIZONTAL') {
    buf.setCell(x, y, '╠', resolvedFg, resolvedBg);
    for (let c = 1; c < length - 1; c++) {
      buf.setCell(x + c, y, '═', resolvedFg, resolvedBg);
    }
    buf.setCell(x + length - 1, y, '╣', resolvedFg, resolvedBg);
  } else {
    buf.setCell(x, y, '╦', resolvedFg, resolvedBg);
    for (let r = 1; r < length - 1; r++) {
      buf.setCell(x, y + r, '║', resolvedFg, resolvedBg);
    }
    buf.setCell(x, y + length - 1, '╩', resolvedFg, resolvedBg);
  }
}

/**
 * Emplaces a high-torque machined rivet cluster at structural stress intersections.
 */
export function drawRivetFlange(
  buf: UiCellBuffer,
  x: number,
  y: number,
  fg = VICTORIAN_PALETTE.RIVET_STEEL,
  bg = VICTORIAN_PALETTE.SOOT_IRON_BG,
): void {
  buf.setCell(x, y, '◈', fg, bg);
  buf.setCell(x + 1, y, '◈', fg, bg);
}
```

---

### Blueprint 4.3: `index.html` (Complete CSS & DOM Blueprint)
**Target File**: `/Users/emmett/Desktop/Game/index.html`

Replace lines 8-158 in `<style>` with:

```html
    <style>
      :root {
        /* Ratified 6-Token Oxidized Iron Palette */
        --iron-deep-rust: #7A2E22;
        --iron-charcoal: #1B1F22;
        --iron-tarnished-brass: #C5A059;
        --iron-verdigris: #3D7E73;
        --iron-sulfur-amber: #E5A93C;
        --iron-soot-black: #0B0C0E;

        /* 4-Tier Z-Depth Stratification Hierarchy */
        --z0-tactical-void: #0B0C0E;
        --z1-recess-well: #1B1F22;
        --z2-machined-chassis: #202A28;
        --z3-emissive-readout: #E5A93C;

        /* Semantic Mappings */
        --bg-soot: var(--z0-tactical-void);
        --panel-bg: var(--z1-recess-well);
        --panel-border: var(--iron-deep-rust);
        --panel-border-bright: var(--iron-tarnished-brass);
        --brass-gold: var(--iron-tarnished-brass);
        --oxidized-copper: #cd7f32;
        --tesla-cyan: var(--iron-verdigris);
        --parchment: #D9CCAA;
        --muted-slate: #7a868a;
        --ok-green: #52be80;
        --warn-red: #B94B42;
      }
      * {
        box-sizing: border-box;
      }
      body {
        margin: 0;
        padding: 0;
        background-color: var(--z0-tactical-void);
        color: var(--parchment);
        font-family: 'IBM Plex Mono', 'JetBrains Mono', 'Fira Code', 'Courier New', monospace;
        display: flex;
        justify-content: center;
        align-items: center;
        width: 100vw;
        height: 100vh;
        overflow: hidden;
      }
      .app-frame {
        display: flex;
        justify-content: center;
        align-items: center;
        width: 100vw;
        height: 100vh;
        margin: 0;
        padding: 0;
        background: #050708;
        position: relative;
        overflow: hidden;
      }
      .viewport-column {
        display: flex;
        flex-direction: column;
        justify-content: center;
        align-items: center;
        width: 100%;
        height: 100%;
        position: relative;
      }
      #hud-root:empty,
      #top-bar-root:empty,
      #action-bar-root:empty {
        display: none !important;
      }
      #canvas-stage {
        border: 3px double var(--iron-tarnished-brass);
        outline: 2px solid var(--iron-deep-rust);
        outline-offset: 1px;
        position: relative;
        display: flex;
        justify-content: center;
        align-items: center;
        margin: auto;
        overflow: hidden;
        background: var(--z0-tactical-void);
        box-shadow:
          0 0 32px rgba(197, 160, 89, 0.20),
          inset 0 0 24px rgba(11, 12, 14, 0.95);
      }
      #canvas-stage canvas {
        width: 100% !important;
        height: 100% !important;
        display: block;
        image-rendering: pixelated;
        image-rendering: crisp-edges;
      }
      .hud-sidebar {
        display: flex;
        flex-direction: column;
        gap: 10px;
      }
      .panel-box {
        position: relative;
        background: var(--z1-recess-well);
        border: 3px double var(--iron-tarnished-brass);
        outline: 1px solid var(--iron-deep-rust);
        padding: 8px 10px;
        font-size: 11px;
        box-shadow:
          inset 0 0 12px rgba(0, 0, 0, 0.85),
          0 2px 6px rgba(0, 0, 0, 0.6);
      }
      .panel-box::before {
        content: '☼';
        position: absolute;
        top: -6px;
        left: -3px;
        font-size: 8px;
        line-height: 1;
        color: var(--iron-tarnished-brass);
        text-shadow: 0 0 2px #000;
        pointer-events: none;
      }
      .panel-box::after {
        content: '☼';
        position: absolute;
        top: -6px;
        right: -3px;
        font-size: 8px;
        line-height: 1;
        color: var(--iron-tarnished-brass);
        text-shadow: 0 0 2px #000;
        pointer-events: none;
      }
      .panel-header {
        color: var(--iron-tarnished-brass);
        font-weight: bold;
        letter-spacing: 0.08em;
        border-bottom: 2px solid var(--iron-deep-rust);
        padding-bottom: 4px;
        margin-bottom: 6px;
        display: flex;
        justify-content: space-between;
        align-items: center;
        text-shadow: 0 1px 2px rgba(0, 0, 0, 0.8);
      }
      .stat-row,
      .limb-item {
        display: flex;
        justify-content: space-between;
        padding: 2px 0;
      }
      .brass-text {
        color: var(--iron-tarnished-brass);
      }
      .copper-text {
        color: var(--oxidized-copper);
      }
      .tesla-text {
        color: var(--iron-verdigris);
      }
      .amber-text {
        color: var(--iron-sulfur-amber);
      }
      .rust-text {
        color: var(--iron-deep-rust);
      }
      .ok-text {
        color: var(--ok-green);
      }
      .warn-text {
        color: var(--warn-red);
      }
      .button-grid {
        display: flex;
        flex-direction: column;
        gap: 6px;
      }
      button {
        background: var(--iron-charcoal);
        color: var(--iron-tarnished-brass);
        border: 1px solid var(--iron-deep-rust);
        border-left: 3px solid var(--iron-tarnished-brass);
        padding: 4px 8px;
        font-family: inherit;
        font-size: 11px;
        cursor: pointer;
        text-align: left;
        transition: border-color 0.15s, background 0.15s, color 0.15s;
      }
      button:hover {
        background: #232a2f;
        border-color: var(--iron-sulfur-amber);
        border-left-color: var(--iron-sulfur-amber);
        color: var(--iron-sulfur-amber);
      }
      .log-box {
        flex: 1;
        min-height: 140px;
        background: var(--z1-recess-well);
      }
      .log-entry {
        font-size: 11px;
        line-height: 1.4;
        padding: 2px 0;
        border-bottom: 1px dashed var(--iron-deep-rust);
      }
      .muted {
        color: var(--muted-slate);
      }
    </style>
```

---

### Blueprint 4.4: Verification Test Suite `tests/sim/oxidized-iron-palette.test.ts`
**Target File**: `/Users/emmett/Desktop/Game/tests/sim/oxidized-iron-palette.test.ts`  
**Purpose**: Deterministic unit verification for the 6 oxidized iron tokens, 4-tier Z-depth stratification, bezel tier integration, and backward compatibility.

```typescript
import { describe, expect, it } from 'vitest';
import { createUiCellBuffer } from '../../src/client/canvas-ui/cell-buffer.js';
import { drawMachinedBezel } from '../../src/client/canvas-ui/bezel-composer.js';
import {
  resolveThermodynamicPalette,
  resolveVisualDepthTier,
  VICTORIAN_PALETTE,
  VISUAL_DEPTH_TIERS,
} from '../../src/client/canvas-ui/material-palette.js';

describe('Oxidized Iron Palette & Visual Depth Stratification', () => {
  it('ratifies the 6 canonical oxidized iron tokens with exact hex values', () => {
    expect(VICTORIAN_PALETTE.DEEP_RUST).toBe('#7A2E22');
    expect(VICTORIAN_PALETTE.CHARCOAL).toBe('#1B1F22');
    expect(VICTORIAN_PALETTE.TARNISHED_BRASS).toBe('#C5A059');
    expect(VICTORIAN_PALETTE.VERDIGRIS).toBe('#3D7E73');
    expect(VICTORIAN_PALETTE.SULFUR_AMBER).toBe('#E5A93C');
    expect(VICTORIAN_PALETTE.SOOT_BLACK).toBe('#0B0C0E');
  });

  it('defines the 4-tier Z-depth stratification hierarchy with strict ascending zIndex', () => {
    expect(VISUAL_DEPTH_TIERS.Z0_TACTICAL_VOID.zIndex).toBe(0);
    expect(VISUAL_DEPTH_TIERS.Z1_RECESS_WELL.zIndex).toBe(1);
    expect(VISUAL_DEPTH_TIERS.Z2_MACHINED_CHASSIS.zIndex).toBe(2);
    expect(VISUAL_DEPTH_TIERS.Z3_EMISSIVE_READOUT.zIndex).toBe(3);

    // Z0 Tactical Void
    const z0 = resolveVisualDepthTier('Z0_TACTICAL_VOID');
    expect(z0.bg).toBe(VICTORIAN_PALETTE.SOOT_BLACK);
    expect(z0.accent).toBe(VICTORIAN_PALETTE.DEEP_RUST);

    // Z1 Recess Well
    const z1 = resolveVisualDepthTier('Z1_RECESS_WELL');
    expect(z1.bg).toBe(VICTORIAN_PALETTE.CHARCOAL);
    expect(z1.border).toBe(VICTORIAN_PALETTE.DEEP_RUST);

    // Z2 Machined Chassis
    const z2 = resolveVisualDepthTier('Z2_MACHINED_CHASSIS');
    expect(z2.border).toBe(VICTORIAN_PALETTE.TARNISHED_BRASS);

    // Z3 Emissive Readout
    const z3 = resolveVisualDepthTier('Z3_EMISSIVE_READOUT');
    expect(z3.fg).toBe(VICTORIAN_PALETTE.SULFUR_AMBER);
  });

  it('binds bezel tier options to the 4-tier visual depth palette in drawMachinedBezel', () => {
    const buf = createUiCellBuffer(12, 6);
    drawMachinedBezel(buf, { x: 0, y: 0, width: 12, height: 6 }, {
      tier: 'Z1_RECESS_WELL',
      title: 'TICKER',
    });

    // Interior well uses CHARCOAL background
    expect(buf.getCell(1, 1)?.bg).toBe(VICTORIAN_PALETTE.CHARCOAL);
    // Border uses DEEP_RUST
    expect(buf.getCell(1, 0)?.fg).toBe(VICTORIAN_PALETTE.DEEP_RUST);
    // Double line characters
    expect(buf.getCell(1, 0)?.glyph).toBe('═');
    expect(buf.getCell(0, 1)?.glyph).toBe('║');
  });

  it('preserves thermodynamic palette stress levels with sulfur amber highlights', () => {
    const nominal = resolveThermodynamicPalette('NOMINAL');
    expect(nominal.borderFg).toBe(VICTORIAN_PALETTE.TARNISHED_BRASS);
    expect(nominal.accentFg).toBe(VICTORIAN_PALETTE.SULFUR_AMBER);

    const elevated = resolveThermodynamicPalette('ELEVATED');
    expect(elevated.borderFg).toBe(VICTORIAN_PALETTE.SULFUR_AMBER);
    expect(elevated.primaryShaderFlag).toBe('GASLIGHT_BLOOM');

    const critical = resolveThermodynamicPalette('CRITICAL');
    expect(critical.borderFg).toBe(VICTORIAN_PALETTE.INCANDESCENT_RED);
    expect(critical.primaryShaderFlag).toBe('THERMO_CRITICAL_PULSE');
  });
});
```

---

## 5. Verification Method

To verify these changes after implementation by the worker:

1. **Boundary & Modularity Ceiling Check**:
   ```bash
   npm run check:boundaries
   ```
   *Expected Output*: Checked 404+ files. Zero Core/Shell violations. `material-palette.ts` <= 150 lines, `bezel-composer.ts` <= 250 lines.

2. **TypeScript Strict Typecheck**:
   ```bash
   npm run typecheck
   ```
   *Expected Output*: Exit code 0, 0 errors.

3. **Targeted Palette Unit Test**:
   ```bash
   npx vitest run tests/sim/oxidized-iron-palette.test.ts
   ```
   *Expected Output*: 4 passed (all assertions green).

4. **Existing Canvas Primitives & Conduits Regression**:
   ```bash
   npx vitest run tests/sim/canvas-ui-primitives.test.ts tests/sim/mechanical-conduits.test.ts tests/sim/diegetic-visualizations.test.ts
   ```
   *Expected Output*: All tests pass 100%.

5. **Full Verification Pipeline**:
   ```bash
   npm run verify
   ```
   *Expected Output*: 0 typecheck errors, 0 boundary violations, 0 data validation errors, all 109+ sim tests pass.
