import { StratumId } from '../../schemas/primitives.schema.js';
import { getShiftPhase, WorldState } from '../../sim/core/world.js';
import { resolveCatalogDisplayName } from '../projection/frame-adapter.js';
import { UiCellBuffer } from './cell-buffer.js';
import { VICTORIAN_PALETTE } from './material-palette.js';

export const STRATUM_DEPTH_MAP: Record<StratumId, string> = {
  CATACOMBS: '-24.0m (Abyssal Catacombs)',
  UNDERCROFT: '-12.0m (Subterranean Undercroft)',
  STREET: '±0.0m (Cobblestone Grade)',
  SPIRE: '+45.0m (Pneumatic Towers)',
};

/**
 * Renders the right column district dossier, stratum selector tabs,
 * local atmospheric telemetry, and connecting transit gates on the metropolitan atlas.
 */
export function renderAtlasDossierPanel(
  buf: UiCellBuffer,
  rightX: number,
  rightWidth: number,
  rectY: number,
  state: Readonly<WorldState>,
  playerPos: { x: number; y: number; stratum: StratumId } | undefined,
  currentStratum: StratumId,
): void {
  buf.writeString(rightX, rectY + 2, '═[ DISTRICT DOSSIER ]═', VICTORIAN_PALETTE.TARNISHED_BRASS, VICTORIAN_PALETTE.SOOT_IRON_BG);

  let dY = rectY + 4;
  const currentDistrict = state.currentDistrictId ?? 'district_spitalfields_soot_works';
  const districtName = resolveCatalogDisplayName('district', currentDistrict);
  buf.writeString(rightX, dY, districtName.slice(0, rightWidth), VICTORIAN_PALETTE.AMBER_GASLIGHT, VICTORIAN_PALETTE.SOOT_IRON_BG);
  dY += 2;

  const depthStr = STRATUM_DEPTH_MAP[currentStratum] ?? currentStratum;
  buf.writeString(rightX, dY, `Stratum:  ${currentStratum} [↑/↓/1-4]`.slice(0, rightWidth), VICTORIAN_PALETTE.SEPIA_INK, VICTORIAN_PALETTE.SOOT_IRON_BG);
  dY++;
  const strataList: readonly StratumId[] = ['CATACOMBS', 'UNDERCROFT', 'STREET', 'SPIRE'];
  let sx = rightX;
  for (const st of strataList) {
    const isSt = st === currentStratum;
    const stLabel = `[${st.slice(0, 4)}]`;
    buf.writeString(sx, dY, stLabel, isSt ? VICTORIAN_PALETTE.AETHER_BLUE : VICTORIAN_PALETTE.MUTED_PIPE, VICTORIAN_PALETTE.SOOT_IRON_BG, undefined, `select_stratum:${st}`);
    sx += stLabel.length + 1;
  }
  dY++;
  buf.writeString(rightX, dY, `Altitude: ${depthStr}`.slice(0, rightWidth), VICTORIAN_PALETTE.MUTED_PIPE, VICTORIAN_PALETTE.SOOT_IRON_BG);
  dY++;
  buf.writeString(rightX, dY, `Position: [X:${playerPos?.x ?? 0}, Y:${playerPos?.y ?? 0}]`.slice(0, rightWidth), VICTORIAN_PALETTE.SEPIA_INK, VICTORIAN_PALETTE.SOOT_IRON_BG);
  dY++;

  const shiftPhase = getShiftPhase(state.turnCount);
  buf.writeString(rightX, dY, `Shift:    ${shiftPhase.replace('_', ' ')} (Turn ${state.turnCount})`.slice(0, rightWidth), VICTORIAN_PALETTE.AETHER_BLUE, VICTORIAN_PALETTE.SOOT_IRON_BG);
  dY += 2;

  // Environmental Telemetry at player coordinates
  buf.writeString(rightX, dY, '─[ LOCAL ATMOSPHERIC READINGS ]─'.slice(0, rightWidth), VICTORIAN_PALETTE.TARNISHED_BRASS, VICTORIAN_PALETTE.SOOT_IRON_BG);
  dY++;

  const grid = state.strata[currentStratum];
  const currentCell = grid && playerPos && playerPos.stratum === currentStratum
    ? grid.cells[playerPos.y * grid.width + playerPos.x]
    : undefined;

  const steamPressure = currentCell?.steamPressureKpa ?? 0;
  const coalDust = Math.round((currentCell?.coalDustDensity ?? 0) * 100);
  const smoke = currentCell?.smokePpm ?? 0;
  const zone = currentCell?.interiorZone ?? 'OPEN_STREET';

  buf.writeString(rightX, dY, `Ambient Steam:   ${steamPressure} kPa`.slice(0, rightWidth), VICTORIAN_PALETTE.SEPIA_INK, VICTORIAN_PALETTE.SOOT_IRON_BG);
  dY++;
  buf.writeString(rightX, dY, `Coal Dust Smog:  ${coalDust}% opacity`.slice(0, rightWidth), VICTORIAN_PALETTE.SEPIA_INK, VICTORIAN_PALETTE.SOOT_IRON_BG);
  dY++;
  buf.writeString(rightX, dY, `Combustion Smoke:${smoke} PPM`.slice(0, rightWidth), VICTORIAN_PALETTE.SEPIA_INK, VICTORIAN_PALETTE.SOOT_IRON_BG);
  dY++;
  buf.writeString(rightX, dY, `Zonal Boundary:  ${zone}`.slice(0, rightWidth), VICTORIAN_PALETTE.MUTED_PIPE, VICTORIAN_PALETTE.SOOT_IRON_BG);
  dY += 2;

  // Known Transit Portals on current stratum
  buf.writeString(rightX, dY, '─[ CONNECTING TRANSIT GATES ]─'.slice(0, rightWidth), VICTORIAN_PALETTE.TARNISHED_BRASS, VICTORIAN_PALETTE.SOOT_IRON_BG);
  dY++;

  const gatesOnStratum = Object.values(state.entities).filter(
    (e) => e.districtGate && e.position?.stratum === currentStratum,
  );

  if (gatesOnStratum.length > 0) {
    for (const g of gatesOnStratum.slice(0, 3)) {
      const destName = resolveCatalogDisplayName('district', g.districtGate!.targetDistrictId);
      buf.writeString(rightX, dY, `╬ Gate to ${destName}`.slice(0, rightWidth), VICTORIAN_PALETTE.TARNISHED_BRASS, VICTORIAN_PALETTE.SOOT_IRON_BG);
      dY++;
    }
  } else {
    buf.writeString(rightX, dY, 'No direct district gates on this stratum.'.slice(0, rightWidth), VICTORIAN_PALETTE.MUTED_PIPE, VICTORIAN_PALETTE.SOOT_IRON_BG);
    dY++;
  }
}
