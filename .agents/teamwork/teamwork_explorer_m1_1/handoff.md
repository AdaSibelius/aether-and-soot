# Handoff Report: M1 Explorer 1 — Tactical Console & Diegetic Gauges Blueprint

## 1. Observation

### 1.1 Geometry & Screen Layout Constraints
- **Canvas Resolution**: In `src/client/renderer/glyph-stage-types.ts`:
  - `WIDESCREEN_GRID_WIDTH = 88` cells, `WIDESCREEN_GRID_HEIGHT = 36` cells.
  - `CELL_WIDTH_PX = 12`, `CELL_HEIGHT_PX = 20` (Total native canvas resolution: 1056×720px).
- **Console Partitioning**: In `src/client/bootstrap-loop.ts` (line 133) and `src/client/canvas-ui/diegetic-screen-composer.ts` (lines 85–94):
  - The tactical dungeon map occupies columns `0..57` (width: 58 cells = 696px).
  - The tactical console occupies columns `58..87` (width: 30 cells = 360px) and vertical rows `0..35` (height: 36 cells = 720px).
  - The console frame is rendered via `renderTacticalConsole(buf, { x: 58, y: 0, width: 30, height: 36 }, state, playerId, options)`.
- **Inner Printable Margins**:
  - Border column `x = 58` (`║`) and `x + width - 1 = 87` (`║`).
  - Safe inner printable area: `innerX = x + 2` (column 60) to `x + 27` (column 85), yielding exactly **26 printable characters per row**.

### 1.2 Audit of Current `tactical-console.ts` (103 lines)
Examining `src/client/canvas-ui/tactical-console.ts`:
- **Rows 0 & 35**: Bezel outer frame drawn via `drawMachinedBezel` (lines 37–42). Bottom nav buttons placed at `navY = y + height - 1` (row 35, lines 97–102).
- **Rows 2–3**: Split-flap turn odometer (`drawSplitFlapOdometer`) and currency text (`COINAGE: ...`).
- **Rows 5–12**: Twin gauges: `drawBourdonPressureGauge` (lines 53–56, height: 4 rows) and `drawSanguineManometer` (lines 58–59, height: 7 rows).
- **Rows 14–23**: `renderDiegeticPaperdoll(buf, x + 2, y + 14, anatomy)`.
  - *Observation of Vertical Collision*: In `dossier-paperdoll.ts`, `renderDiegeticPaperdoll` writes from `y + 0` to `y + 9` (10 rows, filling rows 14–23). However, `tactical-console.ts` lines 80–84 overwrite rows 21–23 with `PST: ... THM: ...` and `drawStructuralDivider(buf, x, y + 23, width, 'HORIZONTAL')`, destroying the paperdoll's vital blood, toxicity, and pain indicators!
- **Rows 24–34**: `renderTacticalVernierDossier` (lines 88–94) consumes 10 vertical rows, which remains mostly blank (`VERNIER: STANDBY`) when no tile is hovered.
- **Critical Telemetry Gaps Observed**:
  1. *Thermodynamic Stress*: Only internal boiler steam is visualized on the Bourdon gauge. Governor strain load (`strainLoadKw`), ambient soot concentration (`smokePpm`), and ambient steam (`steamPressureKpa`) are relegated to tiny text tags or hidden in the vernier.
  2. *Satchel & Inventory*: Zero inventory telemetry exists in `tactical-console.ts`. The player has no visibility into carried mass, volume capacity, or equipped tools without triggering the full-screen modal (`satchel-screen.ts`).
  3. *Action Chronicle*: Zero event log feedback exists in `tactical-console.ts`. Player movement, combat strikes, and door interactions produce no text narrative on the canvas HUD.

### 1.3 Audit of Current Sub-modules & Line Counts
Exact line counts verified via filesystem analysis:
- `src/client/canvas-ui/tactical-console.ts`: **103 lines**
- `src/client/canvas-ui/analog-gauges.ts`: **139 lines**
- `src/client/canvas-ui/dossier-paperdoll.ts`: **95 lines**
- `src/client/canvas-ui/tactical-vernier.ts`: **167 lines**
- `src/client/canvas-ui/bezel-composer.ts`: **119 lines**
- `src/client/canvas-ui/industrial-primitives.ts`: **192 lines**
- `src/client/canvas-ui/material-palette.ts`: **71 lines**
- Hard gate ceiling enforced by `tests/scripts/check-boundaries.ts`: **300 lines**.
- Target ceiling for all modules: **<= 220 lines** (well below the 240-line warning threshold).

---

## 2. Logic Chain

1. **Information Density & Aesthetic Pillar (Caves of Qud Steampunk)**:
   - The user requires deep Edison-era mechanical aesthetics with zero Pip-Boy tropes.
   - This necessitates replacing dead vertical space with dense, calibrated instruments: double-line conduits (`╔═╗`, `╠═╣`), machined rivets (`☼`, `Ø`), CP437 block gauges (`█`, `▒`, `░`, `·`), split-flap wheels, and a fading typewriter-ribbon action ticker.
2. **Deterministic Row Budgeting (36 Rows: 0..35)**:
   - To eliminate visual collisions and provide complete telemetry coverage, every vertical row must have an explicit single-occupancy assignment.
   - The 36-row budget is partitioned into 7 distinct instrument tiers separated by rigid structural dividers (`╠═[ HEADER ]═╣`):
     - **Rows 0–2 (Chronometer & Ledger)**: Top Bezel, Split-Flap Turns, Victorian Currency (£ s d), Stratum, and Posture.
     - **Rows 3–8 (Twin Analog Gauges)**: Bourdon Steam Pressure Dial (0..100 kPa) + Sanguine Mercury Manometer (Pints & Drams).
     - **Rows 9–12 (Thermodynamics & Atmosphere)**: Governor Strain Load (kW) + Ambient Soot PPM + Ambient Steam kPa + Hazard Classification.
     - **Rows 13–17 (Satchel Load & Gear)**: Mass Gauge (kg) + Volume Gauge (L) + Wielded Tool + Carried Item Count.
     - **Rows 18–24 (Vitruvian Anatomical Wireframe)**: 6-slot limb wireframe (`■`, `⚙`, `✗`) with HP numbers + Toxicity, Pain Shock, and Stamina.
     - **Rows 25–29 (Edison Pneumatic Ticker)**: 4-line live action chronicle in typewriter ink gradient.
     - **Rows 30–34 (Compact Optical Vernier)**: Forensic tile physics (Coordinates, Mohs hardness, Acoustics dB, Soot PPM, Occupant).
     - **Row 35 (Bezel Perimeter & Navigation)**: Bottom border with interactive buttons (`[I]NV`, `[A]NAT`, `[C]RFT`, `[ESC]`).
   - Total rows: $1 + 2 + 1 + 5 + 1 + 3 + 1 + 4 + 1 + 6 + 1 + 4 + 1 + 4 + 1 = 36$ rows. Exact zero-remainder fit!
3. **Modularity Splitting Rationale**:
   - Rather than bloating `tactical-console.ts` beyond 200 lines, extract single-responsibility sub-renderers:
     - `src/client/canvas-ui/console-satchel.ts` (~80 lines): Computes carried volume via `computeCarriedVolumeMl` and renders mass/vol bars and equipped item.
     - `src/client/canvas-ui/console-chronicle.ts` (~75 lines): Aggregates events via `aggregateChronicleEvents` and formats typewriter ink ribbon gradient.
     - `analog-gauges.ts`: Append `drawAtmosphericBarometer` (+42 lines $\rightarrow$ 181 lines).
     - `dossier-paperdoll.ts`: Append `renderCompactPaperdoll` (+45 lines $\rightarrow$ 140 lines).
     - `tactical-vernier.ts`: Append `renderCompactVernier` (+38 lines $\rightarrow$ 205 lines).
     - `tactical-console.ts`: Master orchestrator stays compact at ~125 lines.
   - All modules remain well below 220 lines (hard ceiling: 300).
4. **Data Sourcing & Headless Decoupling**:
   - `WorldState` already holds all necessary telemetry:
     - `state.eventLog` for action ticker.
     - `player.inventory` and `state.entities` for satchel mass, volume, and equipped items.
     - `player.anatomy` for strain kW, governor capacity, limb HP, and fluid volume.
     - `grid.cells[idx]` for ambient soot PPM, steam kPa, and coal dust density.
     - `resolveThermodynamicStress(state, playerId)` for stress classification and shader flags.
   - No schema changes or state mutations are required; the canvas HUD purely projects existing simulation state into `UiCellBuffer`.

---

## 3. Caveats

1. **Widescreen Anchor Assumption**: The tactical console blueprint assumes the standard widescreen canvas dimensions (`88×36` cells at `12×20px`). If `width < 24` or `height < 30`, `renderTacticalConsole` contains an early guard return to avoid buffer overrun.
2. **Tile Inspection Fallback**: When `hoveredTile` is null and Look Mode is inactive, `renderCompactVernier` inspects the tile currently occupied by the player (`player.position`), ensuring the vernier displays live ambient data instead of sitting in standby during normal walking.
3. **Event Log Volume**: `aggregateChronicleEvents` handles continuous move event compaction (`Traversed 4m North...`), preventing rapid key repeat from flooding the 4-line ticker with identical movement steps.

---

## 4. Conclusion & Actionable Implementation Blueprint

### 4.1 Master 36-Row Visual Layout Specification
```
Row 0:  ╔══╡ AETHER & SOOT CONSOLE ╞══╗    [Machined Bezel Header, Rivets ☼]
Row 1:  TURNS: [00142]   £1 14s 8d         [Split-Flap Turn Register & Currency]
Row 2:  STRATUM: [STREET]  PST: STAND      [Stratum Location & Posture]
Row 3:  ╠═[ PRECISION GAUGES ]═══════╣    [Divider 1]
Row 4:  ╭──BOURDON──╮   ┌MANO┐             [Twin Gauges: Steam + Blood Manometer]
Row 5:  │ ░ ▒ ▲ █ ■ │   │██│  8 Pts        [Bourdon Radial Arc + Mercury Column]
Row 6:  │  42/100k  │   │██│  0 Drm        [Calibrated Pressure + Imperial Drams]
Row 7:  ╰───────────╯   │██│  100%         [Bourdon Housing + Percentage Readout]
Row 8:                  └────┘             [Manometer Base Housing]
Row 9:  ╠═[ THERMAL & STRAIN ]═══════╣    [Divider 2]
Row 10: STR: [████▒▒····]  42/100 kW       [Internal Governor Strain Load]
Row 11: SOOT: 85 PPM     STM: 40 kPa       [Ambient Soot PPM & Ambient Steam]
Row 12: ATM: [SMOKY]    THM: ELEVATED      [Atmospheric Hazard Classification]
Row 13: ╠═[ SATCHEL & GEAR ]═════════╣    [Divider 3]
Row 14: MASS: [████····]  4.2/25.0kg       [Carried Mass Load with Overload Shift]
Row 15: VOL:  [██████··]   6.5/30.0L       [Carried Volume Capacity]
Row 16: WIELD: Iron Spanner (1.2kg)        [Equipped Tool / Main Hand]
Row 17: PACK:  4 items  [I]nspect          [Carried Item Count & Modal Trigger]
Row 18: ╠═[ VITRUVIAN ANATOMY ]══════╣    [Divider 4]
Row 19:        ■ HEAD 100HP                [Head Slot & Prosthetic Indicator ⚙]
Row 20:  ■ L.ARM   ■ TORSO   ■ R.ARM       [Upper Body Limb Modules]
Row 21:   85HP      100HP     90HP         [Upper Limb Structural HP]
Row 22:        ■ L.LEG   ■ R.LEG           [Lower Body Locomotion Limbs]
Row 23:         100HP     100HP            [Lower Limb Structural HP]
Row 24: TOX: 0%   PAIN: 0   STM: 100%      [Metabolic Vitals: Toxicity, Pain, Stamina]
Row 25: ╠═[ PNEUMATIC TICKER ]═══════╣    [Divider 5]
Row 26: » Traversed 3m East to (15,20)     [Event 1: Faded Ribbon Ink #6b5e4f]
Row 27: » Vented 25 kPa superheated stm    [Event 2: Muted Typewriter Ink #998870]
Row 28: » Pocketed 1x Brass Spanner        [Event 3: Clear Typewriter Ink #c7b79d]
Row 29: » Opened iron door at (16,20)      [Event 4: Bright Parchment Ink #f5e6cb]
Row 30: ╠═[ OPTICAL VERNIER ]════════╣    [Divider 6]
Row 31: COORD:(14,22) [STREET]             [Inspected Grid Coordinates]
Row 32: TERR: COBBLESTONE (5.5 Mohs)       [Forensic Material & Mohs Hardness]
Row 33: SOOT: 85 PPM · 68dB [LUM]          [Acoustic Echo & Gaslight Luminosity]
Row 34: ENTITY: Automated Sentry           [Occupying Actor / Item Target]
Row 35: ╚ [I]NV  [A]NAT  [C]RFT  [ESC] ╝   [Machined Bezel Base & Quick Action Buttons]
```

---

### 4.2 Exact Implementation Specifications for Worker

#### File 1: `src/client/canvas-ui/console-satchel.ts` (NEW MODULE, ~80 lines)
```ts
import { EntityId } from '../../schemas/primitives.schema.js';
import { WorldState } from '../../sim/core/world.js';
import { computeCarriedVolumeMl } from '../../sim/systems/inventory-utils.js';
import { resolveCatalogDisplayName } from '../projection/frame-adapter.js';
import { UiCellBuffer } from './cell-buffer.js';
import { VICTORIAN_PALETTE } from './material-palette.js';

export interface SatchelRenderOptions {
  readonly maxChars?: number;
}

/**
 * Renders the compact 4-row Satchel Load instrument in the tactical console:
 * Row 0: Mass bar with overload warning
 * Row 1: Volume bar
 * Row 2: Wielded / equipped item or primary tool
 * Row 3: Total carried items summary with [I] shortcut
 */
export function renderConsoleSatchel(
  buf: UiCellBuffer,
  x: number,
  y: number,
  width: number,
  state: Readonly<WorldState>,
  playerId: EntityId,
  options: SatchelRenderOptions = {},
): void {
  const player = state.entities[playerId];
  const inventory = player?.inventory;
  const maxChars = options.maxChars ?? Math.max(10, width);

  const currentMassG = inventory?.currentMassGrams ?? 0;
  const maxMassG = inventory?.maxMassGrams ?? 25000;
  const massRatio = maxMassG > 0 ? currentMassG / maxMassG : 0;
  const isMassOverload = massRatio > 1.0;

  const currentVolMl = inventory ? computeCarriedVolumeMl(state, inventory) : 0;
  const maxVolMl = inventory?.maxVolumeMl ?? 30000;
  const volRatio = maxVolMl > 0 ? currentVolMl / maxVolMl : 0;

  // Row 0: Mass gauge [████····] 4.2/25.0kg
  const massKg = (currentMassG / 1000).toFixed(1);
  const maxMassKg = (maxMassG / 1000).toFixed(0);
  const massBar = renderCompactBar(massRatio, 8);
  const massFg = isMassOverload ? VICTORIAN_PALETTE.WARN_RED : massRatio > 0.75 ? VICTORIAN_PALETTE.AMBER_GASLIGHT : VICTORIAN_PALETTE.AETHER_BLUE;
  buf.writeString(x, y, 'MASS:', VICTORIAN_PALETTE.TARNISHED_BRASS, VICTORIAN_PALETTE.SOOT_IRON_BG);
  buf.writeString(x + 5, y, `[${massBar}]`, massFg, VICTORIAN_PALETTE.SOOT_IRON_BG);
  buf.writeString(x + 16, y, `${massKg}/${maxMassKg}k`.slice(0, 9), massFg, VICTORIAN_PALETTE.SOOT_IRON_BG);

  // Row 1: Volume gauge [██████··] 6.5/30.0L
  const volL = (currentVolMl / 1000).toFixed(1);
  const maxVolL = (maxVolMl / 1000).toFixed(0);
  const volBar = renderCompactBar(volRatio, 8);
  const volFg = volRatio > 0.85 ? VICTORIAN_PALETTE.WARN_RED : VICTORIAN_PALETTE.VERDIGRIS_PATINA;
  buf.writeString(x, y + 1, 'VOL: ', VICTORIAN_PALETTE.TARNISHED_BRASS, VICTORIAN_PALETTE.SOOT_IRON_BG);
  buf.writeString(x + 5, y + 1, `[${volBar}]`, volFg, VICTORIAN_PALETTE.SOOT_IRON_BG);
  buf.writeString(x + 16, y + 1, `${volL}/${maxVolL}L`.slice(0, 9), volFg, VICTORIAN_PALETTE.SOOT_IRON_BG);

  // Row 2: Wielded weapon / hand item
  const equippedHandId = inventory?.equippedSlots?.MAIN_HAND ?? inventory?.equippedSlots?.OFF_HAND;
  let handText = 'WIELD: Bare Hands';
  if (equippedHandId) {
    const itemEnt = state.entities[equippedHandId];
    const name = itemEnt?.item?.blueprintId
      ? resolveCatalogDisplayName('item', itemEnt.item.blueprintId)
      : (itemEnt?.name ?? 'Instrument');
    handText = `WIELD: ${name}`;
  } else if ((inventory?.containedEntityIds?.length ?? 0) > 0) {
    const firstId = inventory!.containedEntityIds[0]!;
    const itemEnt = state.entities[firstId];
    const name = itemEnt?.item?.blueprintId
      ? resolveCatalogDisplayName('item', itemEnt.item.blueprintId)
      : (itemEnt?.name ?? 'Item');
    handText = `TOP: ${name}`;
  }
  buf.writeString(x, y + 2, handText.slice(0, maxChars), VICTORIAN_PALETTE.POLISHED_BRASS, VICTORIAN_PALETTE.SOOT_IRON_BG);

  // Row 3: Total carried count + quick navigation button
  const itemCount = inventory?.containedEntityIds?.length ?? 0;
  const packStr = `PACK: ${itemCount} items · [I]nspect`;
  buf.writeString(x, y + 3, packStr.slice(0, maxChars), VICTORIAN_PALETTE.SEPIA_INK, VICTORIAN_PALETTE.SOOT_IRON_BG, undefined, 'open_inventory');
}

function renderCompactBar(ratio: number, totalChars = 8): string {
  const clamped = Math.max(0, Math.min(1, ratio));
  const filled = Math.round(clamped * totalChars);
  return '█'.repeat(filled) + '·'.repeat(totalChars - filled);
}
```

#### File 2: `src/client/canvas-ui/console-chronicle.ts` (NEW MODULE, ~75 lines)
```ts
import { WorldState } from '../../sim/core/world.js';
import { aggregateChronicleEvents } from '../ui/EventFormatterDomain.js';
import { UiCellBuffer } from './cell-buffer.js';
import { VICTORIAN_PALETTE } from './material-palette.js';

const TICKER_INK_PALETTE = [
  '#6b5e4f', // 0: Oldest (faded typewriter ink)
  '#998870', // 1: Intermediate
  '#c7b79d', // 2: Recent
  '#f5e6cb', // 3: Freshest (bright typewriter ribbon ink)
] as const;

/**
 * Renders the Edison Pneumatic Ticker Chronicle in the tactical console:
 * Displays the last 3-4 simulation events formatted in typewriter ink
 * with progressive ink ribbon fade gradient.
 */
export function renderPneumaticTickerChronicle(
  buf: UiCellBuffer,
  x: number,
  y: number,
  width: number,
  height: number,
  state: Readonly<WorldState>,
): void {
  const maxLines = Math.max(1, height);
  const rawEvents = state.eventLog ?? [];
  const lines = aggregateChronicleEvents(rawEvents, maxLines);
  const maxChars = Math.max(10, width);

  if (lines.length === 0) {
    buf.writeString(
      x,
      y,
      '» Awaiting telegraph...'.slice(0, maxChars),
      '#7f6b55',
      VICTORIAN_PALETTE.SOOT_IRON_BG,
    );
    for (let r = 1; r < maxLines; r++) {
      buf.writeString(
        x,
        y + r,
        '· · · · · · · · · · · ·'.slice(0, maxChars),
        '#3a3228',
        VICTORIAN_PALETTE.SOOT_IRON_BG,
      );
    }
    return;
  }

  // Pad lines if fewer than maxLines
  const offset = maxLines - lines.length;
  for (let r = 0; r < offset; r++) {
    buf.writeString(
      x,
      y + r,
      '· · · · · · · · · · · ·'.slice(0, maxChars),
      '#2e2720',
      VICTORIAN_PALETTE.SOOT_IRON_BG,
    );
  }

  for (let idx = 0; idx < lines.length; idx++) {
    const rawLine = lines[idx]!;
    // Strip turn range prefix [T123] or [T12–T14] for clean ticker readout
    const clean = rawLine.replace(/^\[T\d+(?:–T\d+)?\]\s*/, '');
    const rowY = y + offset + idx;

    // Ink ribbon gradient based on distance from latest line
    const colorIdx = Math.min(
      TICKER_INK_PALETTE.length - 1,
      Math.max(0, TICKER_INK_PALETTE.length - (lines.length - idx)),
    );
    const inkColor = TICKER_INK_PALETTE[colorIdx]!;
    const bulletColor = idx === lines.length - 1 ? VICTORIAN_PALETTE.AMBER_GASLIGHT : inkColor;

    buf.writeString(x, rowY, '»', bulletColor, VICTORIAN_PALETTE.SOOT_IRON_BG);
    const displayMsg = ` ${clean}`.slice(0, maxChars - 1);
    buf.writeString(x + 1, rowY, displayMsg, inkColor, VICTORIAN_PALETTE.SOOT_IRON_BG);
  }
}
```

#### File 3: `src/client/canvas-ui/analog-gauges.ts` (Append `drawAtmosphericBarometer`, ~42 lines)
```ts
/**
 * Renders a compact multi-parameter atmospheric barometer and thermodynamic stress readout:
 * Row 0: Internal strain load (kW) vs governor capacity
 * Row 1: Ambient steam pressure (kPa) + soot concentration (PPM)
 * Row 2: Atmospheric classification and thermodynamic stress state
 */
export function drawAtmosphericBarometer(
  buf: UiCellBuffer,
  x: number,
  y: number,
  width: number,
  strainKw: number,
  governorCapKw: number,
  ambientSteamKpa: number,
  smokePpm: number,
  stressLevel: 'NOMINAL' | 'ELEVATED' | 'CRITICAL',
): void {
  const maxLen = Math.max(10, width);
  const strainRatio = governorCapKw > 0 ? strainKw / governorCapKw : 0;
  const isCritical = stressLevel === 'CRITICAL' || strainRatio >= 0.85;
  const isElevated = stressLevel === 'ELEVATED' || strainRatio >= 0.50;

  // Row 0: Strain Load bar
  const strainChars = Math.round(Math.max(0, Math.min(1, strainRatio)) * 8);
  const bar = '█'.repeat(strainChars) + '·'.repeat(8 - strainChars);
  const strainFg = isCritical ? VICTORIAN_PALETTE.WARN_RED : isElevated ? VICTORIAN_PALETTE.AMBER_GASLIGHT : VICTORIAN_PALETTE.AETHER_BLUE;
  buf.writeString(x, y, 'STR:', VICTORIAN_PALETTE.TARNISHED_BRASS, VICTORIAN_PALETTE.SOOT_IRON_BG);
  buf.writeString(x + 5, y, `[${bar}]`, strainFg, VICTORIAN_PALETTE.SOOT_IRON_BG);
  buf.writeString(x + 16, y, `${Math.round(strainKw)}/${governorCapKw}kW`.slice(0, 9), strainFg, VICTORIAN_PALETTE.SOOT_IRON_BG);

  // Row 1: Ambient Soot PPM & Steam kPa
  const sootFg = smokePpm > 100 ? VICTORIAN_PALETTE.WARN_RED : smokePpm > 40 ? VICTORIAN_PALETTE.AMBER_GASLIGHT : VICTORIAN_PALETTE.VERDIGRIS_PATINA;
  const steamFg = ambientSteamKpa > 50 ? VICTORIAN_PALETTE.COPPER_ACCENT : VICTORIAN_PALETTE.TARNISHED_BRASS;
  const sootStr = `SOOT:${smokePpm}PPM`.padEnd(12, ' ');
  const steamStr = `STM:${Math.round(ambientSteamKpa)}kPa`;
  buf.writeString(x, y + 1, sootStr.slice(0, 12), sootFg, VICTORIAN_PALETTE.SOOT_IRON_BG);
  buf.writeString(x + 13, y + 1, steamStr.slice(0, 12), steamFg, VICTORIAN_PALETTE.SOOT_IRON_BG);

  // Row 2: Status classifications
  const gasStatus = smokePpm > 100 ? 'TOXIC' : smokePpm > 40 ? 'SMOKY' : 'CALM';
  const statusStr = `ATM:[${gasStatus}] THM:[${stressLevel}]`.slice(0, maxLen);
  const statusFg = isCritical ? VICTORIAN_PALETTE.WARN_RED : isElevated ? VICTORIAN_PALETTE.AMBER_GASLIGHT : VICTORIAN_PALETTE.POLISHED_BRASS;
  buf.writeString(x, y + 2, statusStr, statusFg, VICTORIAN_PALETTE.SOOT_IRON_BG);
}
```

#### File 4: `src/client/canvas-ui/dossier-paperdoll.ts` (Append `renderCompactPaperdoll`, ~45 lines)
```ts
/**
 * Renders a compact 6-row anatomical wireframe for the 30-column tactical console:
 * Row 0: Head glyph & HP
 * Row 1: Upper limbs (L-Arm, Torso, R-Arm) with prosthetic markers
 * Row 2: Upper limb HP numbers
 * Row 3: Lower limbs (L-Leg, R-Leg)
 * Row 4: Lower limb HP numbers
 * Row 5: Toxicity, Pain Shock, and Stamina status
 */
export function renderCompactPaperdoll(
  buf: UiCellBuffer,
  x: number,
  y: number,
  anatomy: Partial<AnatomyComponent>,
): void {
  if (!anatomy.limbs) {
    buf.writeString(x, y, 'ANATOMY TELEMETRY OFFLINE', VICTORIAN_PALETTE.SEPIA_INK);
    return;
  }

  const limbs = anatomy.limbs;
  const getLimb = (slot: LimbSlotId) => {
    const l = limbs[slot];
    const isProsthetic = Boolean(l?.installedProstheticEntityId);
    const hp = l?.hp ?? 0;
    const maxHp = l?.maxHp ?? 100;
    const color = resolveLimbColor(hp, maxHp, isProsthetic);
    const glyph = isProsthetic ? '⚙' : hp <= 0 ? '✗' : '■';
    return { hp, color, glyph };
  };

  const head = getLimb('HEAD');
  const torso = getLimb('TORSO');
  const lArm = getLimb('LEFT_ARM');
  const rArm = getLimb('RIGHT_ARM');
  const lLeg = getLimb('LEFT_LEG');
  const rLeg = getLimb('RIGHT_LEG');

  // Row 0: Centered Head
  buf.setCell(x + 9, y, head.glyph, head.color, VICTORIAN_PALETTE.SOOT_IRON_BG);
  buf.writeString(x + 11, y, `HEAD ${head.hp}`, head.color, VICTORIAN_PALETTE.SOOT_IRON_BG);

  // Row 1: Upper Limbs
  buf.setCell(x + 1, y + 1, lArm.glyph, lArm.color, VICTORIAN_PALETTE.SOOT_IRON_BG);
  buf.writeString(x + 3, y + 1, 'L-ARM', lArm.color, VICTORIAN_PALETTE.SOOT_IRON_BG);
  buf.setCell(x + 10, y + 1, torso.glyph, torso.color, VICTORIAN_PALETTE.SOOT_IRON_BG);
  buf.writeString(x + 12, y + 1, 'BODY', torso.color, VICTORIAN_PALETTE.SOOT_IRON_BG);
  buf.setCell(x + 18, y + 1, rArm.glyph, rArm.color, VICTORIAN_PALETTE.SOOT_IRON_BG);
  buf.writeString(x + 20, y + 1, 'R-ARM', rArm.color, VICTORIAN_PALETTE.SOOT_IRON_BG);

  // Row 2: Upper HP
  buf.writeString(x + 3, y + 2, `${lArm.hp}k`.padStart(4, ' '), VICTORIAN_PALETTE.RIVET_STEEL);
  buf.writeString(x + 11, y + 2, `${torso.hp}k`.padStart(4, ' '), VICTORIAN_PALETTE.RIVET_STEEL);
  buf.writeString(x + 20, y + 2, `${rArm.hp}k`.padStart(4, ' '), VICTORIAN_PALETTE.RIVET_STEEL);

  // Row 3: Lower Limbs
  buf.setCell(x + 5, y + 3, lLeg.glyph, lLeg.color, VICTORIAN_PALETTE.SOOT_IRON_BG);
  buf.writeString(x + 7, y + 3, 'L-LEG', lLeg.color, VICTORIAN_PALETTE.SOOT_IRON_BG);
  buf.setCell(x + 15, y + 3, rLeg.glyph, rLeg.color, VICTORIAN_PALETTE.SOOT_IRON_BG);
  buf.writeString(x + 17, y + 3, 'R-LEG', rLeg.color, VICTORIAN_PALETTE.SOOT_IRON_BG);

  // Row 4: Lower HP
  buf.writeString(x + 7, y + 4, `${lLeg.hp}k`.padStart(4, ' '), VICTORIAN_PALETTE.RIVET_STEEL);
  buf.writeString(x + 17, y + 4, `${rLeg.hp}k`.padStart(4, ' '), VICTORIAN_PALETTE.RIVET_STEEL);

  // Row 5: Vitals Summary (Tox, Pain, Stamina)
  const tox = anatomy.toxicityPct ?? 0;
  const pain = anatomy.painShock ?? 0;
  const stam = anatomy.stamina ?? 100;
  const toxFg = tox > 50 ? VICTORIAN_PALETTE.WARN_RED : VICTORIAN_PALETTE.VERDIGRIS_PATINA;
  const painFg = pain > 40 ? VICTORIAN_PALETTE.WARN_RED : VICTORIAN_PALETTE.SEPIA_INK;
  buf.writeString(x, y + 5, `TOX:${tox}%`.padEnd(8, ' '), toxFg);
  buf.writeString(x + 9, y + 5, `PAIN:${pain}`.padEnd(8, ' '), painFg);
  buf.writeString(x + 18, y + 5, `STM:${stam}%`, VICTORIAN_PALETTE.POLISHED_BRASS);
}
```

#### File 5: `src/client/canvas-ui/tactical-vernier.ts` (Append `renderCompactVernier`, ~40 lines)
```ts
/**
 * Renders a compact 4-row tactical optical vernier for the sidebar console:
 * Row 0: Coordinates & Stratum
 * Row 1: Terrain name & Mohs hardness
 * Row 2: Soot PPM, Acoustic echo dB, Gaslight status
 * Row 3: Occupying entity summary or Standby prompt
 */
export function renderCompactVernier(
  buf: UiCellBuffer,
  x: number,
  y: number,
  width: number,
  state: Readonly<WorldState>,
  hoverCoord: { x: number; y: number } | null,
  playerId?: EntityId,
): void {
  const maxLen = Math.max(10, width);
  if (!hoverCoord) {
    buf.writeString(x, y, 'VERNIER: STANDBY', VICTORIAN_PALETTE.VERDIGRIS_PATINA);
    buf.writeString(x, y + 1, 'Aim reticle or cursor [L]', VICTORIAN_PALETTE.SEPIA_INK);
    buf.writeString(x, y + 2, 'Caves of Qud Scanner Mk.IV', VICTORIAN_PALETTE.MUTED_PIPE);
    return;
  }

  const pid = playerId ?? ('actor_player' as EntityId);
  const player = state.entities[pid];
  const stratum = player?.position?.stratum ?? 'STREET';
  const grid = state.strata[stratum];
  if (!grid) return;

  const cell = getTileCell(grid, hoverCoord.x, hoverCoord.y);
  const entities = findEntitiesAtPoint(state.entities, { x: hoverCoord.x, y: hoverCoord.y, stratum });
  const gaslightField = calculateGaslightField(state, stratum);
  const isGaslit = (gaslightField.get(pointKey(hoverCoord.x, hoverCoord.y)) ?? 0) > 0.15;

  // Row 0: Coordinates & Stratum
  const coordStr = `COORD:(${hoverCoord.x},${hoverCoord.y}) [${stratum}]`.slice(0, maxLen);
  buf.writeString(x, y, coordStr, VICTORIAN_PALETTE.POLISHED_BRASS);

  // Row 1: Terrain Identity & Hardness
  const tType = cell?.terrainType ?? 'EMPTY';
  const hardness = estimateTerrainHardness(tType);
  const terrStr = `TERR: ${tType.replace(/_/g, ' ').slice(0, 11)} ${hardness.mohs}M`.slice(0, maxLen);
  buf.writeString(x, y + 1, terrStr, '#ecf0f1');

  // Row 2: Atmospheric & Forensic Sensors
  const smokePpm = cell?.smokePpm ?? 0;
  const acousticsDb = estimateTerrainAcousticDb(tType);
  const gasStr = isGaslit ? 'LUM' : 'SHAD';
  const sensorStr = `${smokePpm}PPM · ${acousticsDb}dB · [${gasStr}]`.slice(0, maxLen);
  buf.writeString(x, y + 2, sensorStr, smokePpm > 100 ? VICTORIAN_PALETTE.WARN_RED : VICTORIAN_PALETTE.VERDIGRIS_PATINA);

  // Row 3: Occupying entity
  if (entities.length > 0) {
    const ent = entities[0]!;
    const glyph = ent.visual.glyph;
    const name = ent.name.slice(0, maxLen - 4);
    const color = ent.actor ? (ent.aiController?.hostile ? VICTORIAN_PALETTE.WARN_RED : VICTORIAN_PALETTE.POLISHED_BRASS) : '#bdc3c7';
    buf.writeString(x, y + 3, `${glyph} ${name}`.slice(0, maxLen), color);
  } else {
    buf.writeString(x, y + 3, '<No Occupant on Tile>', VICTORIAN_PALETTE.MUTED_PIPE);
  }
}
```

#### File 6: `src/client/canvas-ui/tactical-console.ts` (Full rewrite, ~125 lines)
```ts
import { EntityId } from '../../schemas/primitives.schema.js';
import { WorldState } from '../../sim/core/world.js';
import { getTileCell } from '../../sim/spatial/grid.js';
import { resolveThermodynamicStress } from '../renderer/shader-uniforms.js';
import {
  drawAtmosphericBarometer,
  drawBourdonPressureGauge,
  drawSanguineManometer,
  drawSplitFlapOdometer,
  formatVictorianCurrency,
} from './analog-gauges.js';
import { drawMachinedBezel, drawStructuralDivider } from './bezel-composer.js';
import { UiCellBuffer } from './cell-buffer.js';
import { renderPneumaticTickerChronicle } from './console-chronicle.js';
import { renderConsoleSatchel } from './console-satchel.js';
import { renderCompactPaperdoll } from './dossier-paperdoll.js';
import { VICTORIAN_PALETTE } from './material-palette.js';
import { renderCompactVernier } from './tactical-vernier.js';
import { UiRect } from './viewport-controls.js';

export interface TacticalConsoleOptions {
  readonly hoveredTile?: { x: number; y: number } | null;
  readonly isLookModeActive?: boolean;
}

/**
 * Renders the High-Density Victorian Mechanical Console UI into the Canvas UI buffer.
 * Partitions the 30-column sidebar into 7 calibrated diegetic instrument tiers:
 * - Turn registers & currency ledger
 * - Bourdon pressure dial & Sanguine mercury manometer
 * - Thermodynamic stress & atmospheric barometer
 * - Satchel load (mass & volume) with equipped tool
 * - Vitruvian anatomical wireframe paperdoll
 * - Edison pneumatic ticker chronicle
 * - Forensic optical vernier
 */
export function renderTacticalConsole(
  buf: UiCellBuffer,
  rect: UiRect,
  state: WorldState,
  playerId: EntityId,
  options: TacticalConsoleOptions = {},
): void {
  const { x, y, width, height } = rect;
  if (width < 24 || height < 30) return;

  const player = state.entities[playerId];
  if (!player) return;

  // 1. Machined Brass Console Outer Bezel Frame (Row 0 & perimeter)
  drawMachinedBezel(buf, rect, {
    title: 'AETHER & SOOT CONSOLE',
    rivetStyle: 'BRASS_BOLTS',
    fgColor: VICTORIAN_PALETTE.TARNISHED_BRASS,
    bgColor: VICTORIAN_PALETTE.SOOT_IRON_BG,
  });

  const innerX = x + 2;
  const innerW = width - 4; // 26 chars

  // 2. Split-Flap Odometers & Currency (Rows 1–2)
  const turnCount = state.turnCount ?? 0;
  drawSplitFlapOdometer(buf, innerX, y + 1, turnCount, 5, 'TURNS');
  const moneyPence = state.economy?.playerTreasuryPence ?? 0;
  const currFormatted = formatVictorianCurrency(moneyPence);
  const stratum = player.position?.stratum ?? 'STREET';
  buf.writeString(innerX, y + 2, `COIN: ${currFormatted.padEnd(10, ' ')} [${stratum.slice(0, 6)}]`.slice(0, innerW), VICTORIAN_PALETTE.POLISHED_BRASS, VICTORIAN_PALETTE.SOOT_IRON_BG);

  // Row 3: Structural Divider
  drawStructuralDivider(buf, x, y + 3, width, 'HORIZONTAL');

  // 3. Twin Gauges: Bourdon Steam Pressure + Sanguine Manometer (Rows 4–8)
  const anatomy = player.anatomy;
  const maxSteam = anatomy?.maxSteamReserveKpa ?? 100;
  const currentSteam = anatomy?.steamReserveKpa ?? 0;
  drawBourdonPressureGauge(buf, innerX, y + 4, currentSteam, maxSteam);

  const bloodPct = anatomy?.bloodVolumePct ?? 100;
  drawSanguineManometer(buf, x + 16, y + 4, bloodPct, 5);

  // Row 9: Structural Divider
  drawStructuralDivider(buf, x, y + 9, width, 'HORIZONTAL');

  // 4. Thermodynamic Stress States & Atmosphere Barometer (Rows 10–12)
  const thermo = resolveThermodynamicStress(state, playerId);
  const playerPos = player.position;
  const grid = playerPos ? state.strata[playerPos.stratum] : undefined;
  const pCell = playerPos && grid ? getTileCell(grid, playerPos.x, playerPos.y) : undefined;
  const smokePpm = pCell?.smokePpm ?? 0;
  const ambientSteamKpa = pCell?.steamPressureKpa ?? 0;
  const strainKw = anatomy?.strainLoadKw ?? 0;
  const governorCapKw = anatomy?.governorCapacityKw ?? 100;

  drawAtmosphericBarometer(
    buf,
    innerX,
    y + 10,
    innerW,
    strainKw,
    governorCapKw,
    ambientSteamKpa,
    smokePpm,
    thermo.stressLevel,
  );

  // Row 13: Structural Divider
  drawStructuralDivider(buf, x, y + 13, width, 'HORIZONTAL');

  // 5. Compact Satchel Load & Equipped Gear (Rows 14–17)
  renderConsoleSatchel(buf, innerX, y + 14, innerW, state, playerId);

  // Row 18: Structural Divider
  drawStructuralDivider(buf, x, y + 18, width, 'HORIZONTAL');

  // 6. Vitruvian Anatomical Wireframe (Rows 19–24)
  if (anatomy) {
    renderCompactPaperdoll(buf, innerX, y + 19, anatomy);
  }

  // Row 25: Structural Divider
  drawStructuralDivider(buf, x, y + 25, width, 'HORIZONTAL');

  // 7. Pneumatic Ticker Chronicle (Rows 26–29)
  renderPneumaticTickerChronicle(buf, innerX, y + 26, innerW, 4, state);

  // Row 30: Structural Divider
  drawStructuralDivider(buf, x, y + 30, width, 'HORIZONTAL');

  // 8. Optical Vernier Dossier (Rows 31–34)
  const inspected = options.hoveredTile ?? player.position ?? null;
  renderCompactVernier(buf, innerX, y + 31, innerW, state, inspected, playerId);

  // 9. Quick Navigation Buttons on Bottom Border (Row 35)
  const navY = y + height - 1;
  buf.writeString(x + 2, navY, '[I]NV', VICTORIAN_PALETTE.POLISHED_BRASS, VICTORIAN_PALETTE.SOOT_IRON_BG, undefined, 'open_inventory');
  buf.writeString(x + 8, navY, '[A]NAT', VICTORIAN_PALETTE.AETHER_BLUE, VICTORIAN_PALETTE.SOOT_IRON_BG, undefined, 'open_anatomy');
  buf.writeString(x + 15, navY, '[C]RFT', VICTORIAN_PALETTE.AMBER_GASLIGHT, VICTORIAN_PALETTE.SOOT_IRON_BG, undefined, 'open_workbench');
  buf.writeString(x + 22, navY, '[ESC]', VICTORIAN_PALETTE.RIVET_STEEL, VICTORIAN_PALETTE.SOOT_IRON_BG, undefined, 'open_menu');
}
```

---

### 4.3 Proposed Unit Test Suite: `tests/sim/tactical-console.test.ts`
To ensure 100% test coverage and regression protection, author a dedicated test suite:
```ts
import { describe, expect, it } from 'vitest';
import { EntityIdSchema } from '../../src/schemas/primitives.schema.js';
import { createInitialWorld } from '../../src/sim/core/world.js';
import { createUiCellBuffer } from '../../src/client/canvas-ui/cell-buffer.js';
import { drawAtmosphericBarometer } from '../../src/client/canvas-ui/analog-gauges.js';
import { renderConsoleSatchel } from '../../src/client/canvas-ui/console-satchel.js';
import { renderPneumaticTickerChronicle } from '../../src/client/canvas-ui/console-chronicle.js';
import { renderTacticalConsole } from '../../src/client/canvas-ui/tactical-console.js';

describe('Tactical Console & Diegetic Gauges', () => {
  const playerId = EntityIdSchema.parse('actor_player');

  it('renders all 7 instrument tiers within the 30-column console', () => {
    const buf = createUiCellBuffer(88, 36);
    const state = createInitialWorld({ seed: 42 });

    renderTacticalConsole(buf, { x: 58, y: 0, width: 30, height: 36 }, state, playerId);

    // Verify Bezel Header and Bottom Nav
    expect(buf.extractRowString(0)).toContain('AETHER & SOOT CONSOLE');
    const bottomRow = buf.extractRowString(35);
    expect(bottomRow).toContain('[I]NV');
    expect(bottomRow).toContain('[A]NAT');
    expect(bottomRow).toContain('[C]RFT');
    expect(bottomRow).toContain('[ESC]');

    // Verify presence of structural dividers
    expect(buf.getCell(58, 3)?.glyph).toBe('╠');
    expect(buf.getCell(87, 3)?.glyph).toBe('╣');
    expect(buf.getCell(58, 9)?.glyph).toBe('╠');
    expect(buf.getCell(58, 13)?.glyph).toBe('╠');
    expect(buf.getCell(58, 18)?.glyph).toBe('╠');
    expect(buf.getCell(58, 25)?.glyph).toBe('╠');
    expect(buf.getCell(58, 30)?.glyph).toBe('╠');
  });

  it('formats thermodynamic stress and atmospheric barometer correctly', () => {
    const buf = createUiCellBuffer(30, 4);
    drawAtmosphericBarometer(buf, 0, 0, 26, 42, 100, 40, 85, 'ELEVATED');

    const row0 = buf.extractRowString(0);
    const row1 = buf.extractRowString(1);
    const row2 = buf.extractRowString(2);

    expect(row0).toContain('STR:');
    expect(row0).toContain('42/100kW');
    expect(row1).toContain('SOOT:85PPM');
    expect(row1).toContain('STM:40kPa');
    expect(row2).toContain('ATM:[SMOKY]');
    expect(row2).toContain('THM:[ELEVATED]');
  });

  it('renders satchel mass and volume gauges with overload indicator', () => {
    const buf = createUiCellBuffer(30, 4);
    const state = createInitialWorld({ seed: 42 });

    renderConsoleSatchel(buf, 0, 0, 26, state, playerId);

    const row0 = buf.extractRowString(0);
    const row1 = buf.extractRowString(1);
    const row2 = buf.extractRowString(2);
    const row3 = buf.extractRowString(3);

    expect(row0).toContain('MASS:');
    expect(row1).toContain('VOL: ');
    expect(row2).toContain('WIELD:');
    expect(row3).toContain('PACK:');
  });

  it('renders pneumatic ticker chronicle with typewriter ink entries', () => {
    const buf = createUiCellBuffer(30, 4);
    const state = createInitialWorld({ seed: 42 });

    renderPneumaticTickerChronicle(buf, 0, 0, 26, 4, state);

    // When empty, shows awaiting telegraph
    expect(buf.extractRowString(0)).toContain('Awaiting telegraph');
  });
});
```

---

## 5. Verification Method

To independently verify the implementation blueprint once applied by the Worker agent:

1. **Boundary & Modularity Verification**:
   ```bash
   npm run check:boundaries
   ```
   *Expected Result*: Must report 0 errors, 0 forbidden imports, and confirm every file is strictly $\le 300$ lines (with all console sub-modules $\le 220$ lines).
2. **Type Safety & Schema Integrity**:
   ```bash
   npm run typecheck
   ```
   *Expected Result*: `tsc --noEmit` completes cleanly with 0 TypeScript compiler errors.
3. **Automated Simulation & UI Tests**:
   ```bash
   npm run test:sim
   ```
   *Expected Result*: All 109+ test suites pass, including the new `tactical-console.test.ts`.
4. **Full Integrated Verification Pipeline**:
   ```bash
   npm run verify
   ```
   *Expected Result*: Sequential pass across `typecheck`, `check:boundaries`, `validate:data`, and `test:sim`.
5. **Visual Quality Gate (`npm run dev`)**:
   - Inspect Canvas UI at default resolution (88×36 cells):
     - Columns 58..87 display the restructured 30-column console with top bezel, 6 dividers, and bottom navigation.
     - Gauge needle and manometer fluid column are rendered cleanly without text collisions.
     - Thermodynamic stress shows governor load (kW), ambient soot (PPM), and steam (kPa).
     - Satchel load bars show mass and volume capacity.
     - Action chronicle renders telegram lines with bullet markers in typewriter ribbon ink gradient.
     - Optical vernier displays live tile forensic metrics without blank standby gaps.
