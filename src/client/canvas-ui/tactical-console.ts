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
  buf.writeString(
    innerX,
    y + 2,
    `COIN: ${currFormatted.padEnd(10, ' ')} [${stratum.slice(0, 6)}]`.slice(0, innerW),
    VICTORIAN_PALETTE.POLISHED_BRASS,
    VICTORIAN_PALETTE.SOOT_IRON_BG,
  );

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
