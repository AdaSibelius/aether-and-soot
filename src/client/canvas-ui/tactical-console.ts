import { EntityId } from '../../schemas/primitives.schema.js';
import { WorldState } from '../../sim/core/world.js';
import { resolveThermodynamicStress } from '../renderer/shader-uniforms.js';
import { drawBourdonPressureGauge, drawSanguineManometer, drawSplitFlapOdometer, formatVictorianCurrency } from './analog-gauges.js';
import { drawMachinedBezel, drawStructuralDivider } from './bezel-composer.js';
import { UiCellBuffer } from './cell-buffer.js';
import { renderDiegeticPaperdoll } from './dossier-paperdoll.js';
import { VICTORIAN_PALETTE } from './material-palette.js';
import { renderTacticalVernierDossier } from './tactical-vernier.js';
import { UiRect } from './viewport-controls.js';

export interface TacticalConsoleOptions {
  readonly hoveredTile?: { x: number; y: number } | null;
  readonly isLookModeActive?: boolean;
}

/**
 * Renders the High-Density Victorian Mechanical Console UI into the Canvas UI buffer.
 * Embeds Bourdon gauges, galvanic manometers, split-flap odometers, anatomical paperdoll,
 * and Caves of Qud-grade optical vernier tile scanner into the primary viewport.
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

  // 1. Machined Brass Console Bezel Frame
  drawMachinedBezel(buf, rect, {
    title: 'AETHER & SOOT CONSOLE',
    rivetStyle: 'BRASS_BOLTS',
    fgColor: VICTORIAN_PALETTE.TARNISHED_BRASS,
    bgColor: VICTORIAN_PALETTE.SOOT_IRON_BG,
  });

  // 2. Split-Flap Mechanical Odometers & Victorian Currency (Row 2..4)
  const turnCount = state.turnCount ?? 0;
  drawSplitFlapOdometer(buf, x + 2, y + 2, turnCount, 5, 'TURNS');

  const moneyPence = state.economy?.playerTreasuryPence ?? 0;
  const currFormatted = formatVictorianCurrency(moneyPence);
  buf.writeString(x + 2, y + 3, `COINAGE: ${currFormatted}`.slice(0, width - 4), VICTORIAN_PALETTE.POLISHED_BRASS ?? '#e6c875', VICTORIAN_PALETTE.SOOT_IRON_BG);

  // 3. Analog Gauges: Bourdon Steam Dial + Sanguine Fluid Manometer (Row 5..12)
  const anatomy = player.anatomy;
  const maxSteam = anatomy?.maxSteamReserveKpa ?? 100;
  const currentSteam = anatomy?.steamReserveKpa ?? 0;
  drawBourdonPressureGauge(buf, x + 2, y + 5, currentSteam, maxSteam);

  const bloodPct = anatomy?.bloodVolumePct ?? 100;
  drawSanguineManometer(buf, x + 15, y + 5, bloodPct, 7);

  // Divider below gauges
  drawStructuralDivider(buf, x, y + 13, width, 'HORIZONTAL');

  // 4. Anatomical Wireframe Paperdoll & Physical Status (Row 14..21)
  if (anatomy) {
    renderDiegeticPaperdoll(buf, x + 2, y + 14, anatomy);
  }

  // Compact status bar on Row 21 above divider
  const posture = (player.actor?.posture ?? 'STANDING').slice(0, 4);
  const stamina = anatomy?.stamina ?? 100;
  const thermo = resolveThermodynamicStress(state, playerId);
  const thermoShort = thermo.stressLevel.slice(0, 4);
  const statusLine = `PST:${posture} STM:${stamina}% THM:${thermoShort}`.slice(0, width - 4);
  buf.writeString(x + 2, y + 21, statusLine, VICTORIAN_PALETTE.TARNISHED_BRASS, VICTORIAN_PALETTE.SOOT_IRON_BG);

  // Divider below anatomy
  drawStructuralDivider(buf, x, y + 22, width, 'HORIZONTAL');

  // 5. Caves of Qud-grade Optical Vernier Dossier (Row 23..33)
  const inspected = (options.hoveredTile ?? player.position) ?? null;
  renderTacticalVernierDossier(
    buf,
    { x: x + 1, y: y + 23, width: width - 2, height: 11 },
    state,
    inspected,
    playerId,
  );

  // 6. Diegetic Quick Console Navigation Buttons on Bottom Border (Row 35)
  const navY = y + height - 1;
  buf.writeString(x + 2, navY, '[I]NV', VICTORIAN_PALETTE.POLISHED_BRASS ?? '#e6c875', VICTORIAN_PALETTE.SOOT_IRON_BG, undefined, 'open_inventory');
  buf.writeString(x + 8, navY, '[A]NAT', VICTORIAN_PALETTE.AETHER_BLUE, VICTORIAN_PALETTE.SOOT_IRON_BG, undefined, 'open_anatomy');
  buf.writeString(x + 15, navY, '[C]RFT', VICTORIAN_PALETTE.AMBER_GASLIGHT, VICTORIAN_PALETTE.SOOT_IRON_BG, undefined, 'open_workbench');
  buf.writeString(x + 22, navY, '[ESC]', VICTORIAN_PALETTE.RIVET_STEEL, VICTORIAN_PALETTE.SOOT_IRON_BG, undefined, 'open_menu');
}
