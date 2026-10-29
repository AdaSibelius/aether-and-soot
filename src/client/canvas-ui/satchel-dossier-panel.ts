import { EntityId } from '../../schemas/primitives.schema.js';
import { WorldState } from '../../sim/core/world.js';
import { getAnyBlueprint } from '../../sim/data/item-catalog.js';
import { resolveCatalogDisplayName } from '../projection/frame-adapter.js';
import { UiCellBuffer } from './cell-buffer.js';
import { VICTORIAN_PALETTE } from './material-palette.js';
import { UiRect } from './viewport-controls.js';

export function renderSatchelDossierPanel(
  buf: UiCellBuffer,
  rect: UiRect,
  rightX: number,
  rightWidth: number,
  state: Readonly<WorldState>,
  activeItemId: EntityId | undefined,
): void {
  buf.writeString(rightX, rect.y + 2, '═[ GALVANOMETRIC DOSSIER ]═', VICTORIAN_PALETTE.TARNISHED_BRASS, VICTORIAN_PALETTE.SOOT_IRON_BG);

  let dY = rect.y + 4;
  if (activeItemId && state.entities[activeItemId]) {
    const activeEntity = state.entities[activeItemId]!;
    const activeComp = activeEntity.item;
    const bp = activeComp?.blueprintId ? getAnyBlueprint(activeComp.blueprintId) : undefined;
    const fullName = activeComp?.blueprintId
      ? resolveCatalogDisplayName('item', activeComp.blueprintId)
      : (activeEntity.name ?? activeItemId);

    buf.writeString(rightX, dY, fullName.slice(0, rightWidth), VICTORIAN_PALETTE.AMBER_GASLIGHT, VICTORIAN_PALETTE.SOOT_IRON_BG);
    dY += 2;

    const catLabel = activeComp?.category ?? 'COMMODITY';
    buf.writeString(rightX, dY, `Class:     ${catLabel}`, VICTORIAN_PALETTE.SEPIA_INK, VICTORIAN_PALETTE.SOOT_IRON_BG);
    dY++;

    const massOz = Math.max(1, Math.round((activeComp?.massGrams ?? 100) / 28.35));
    const volDrams = Math.max(1, Math.round((activeComp?.volumeMl ?? 250) / 3.55));
    buf.writeString(rightX, dY, `Mass/Vol:  ${massOz} oz Avdp │ ${volDrams} fl drams`, VICTORIAN_PALETTE.MUTED_PIPE, VICTORIAN_PALETTE.SOOT_IRON_BG);
    dY++;

    if (activeEntity.prostheticSpec) {
      const slot = activeEntity.prostheticSpec.targetLimbSlot;
      const rating = activeEntity.prostheticSpec.pressureRatingKpa;
      buf.writeString(rightX, dY, `Graft:     ${slot} (${rating} kPa max)`, VICTORIAN_PALETTE.AETHER_BLUE, VICTORIAN_PALETTE.SOOT_IRON_BG);
      dY++;
    }

    if (bp && 'toolQualities' in bp && bp.toolQualities) {
      const tools = Object.entries(bp.toolQualities).map(([k, v]) => `${k} ${v}`).join(', ');
      if (tools.length > 0) {
        buf.writeString(rightX, dY, `Tool Qual: ${tools}`.slice(0, rightWidth), VICTORIAN_PALETTE.AETHER_BLUE, VICTORIAN_PALETTE.SOOT_IRON_BG);
        dY++;
      }
    }

    dY++;
    buf.writeString(rightX, dY, '─[ FIELD SPECIFICATIONS ]─────────'.slice(0, rightWidth), VICTORIAN_PALETTE.TARNISHED_BRASS, VICTORIAN_PALETTE.SOOT_IRON_BG);
    dY++;

    const desc = (bp && 'description' in bp && typeof bp.description === 'string')
      ? bp.description
      : 'Standard Victorian industrial artificer component.';
    buf.writeWrappedText({ x: rightX, y: dY, width: rightWidth, height: 4 }, desc, {
      fg: VICTORIAN_PALETTE.SEPIA_INK,
      bg: VICTORIAN_PALETTE.SOOT_IRON_BG,
    });
    dY += 5;

    dY = Math.max(dY, rect.y + rect.height - 4);
    buf.writeString(rightX, dY, '► [ENTER] Use/Equip  │  [D] Drop', VICTORIAN_PALETTE.AETHER_BLUE, VICTORIAN_PALETTE.OXIDIZED_IRON, ['AETHER_HALATION'], `select_item:${activeItemId}`);
  } else {
    buf.writeString(rightX, dY, 'No item highlighted.', VICTORIAN_PALETTE.MUTED_PIPE, VICTORIAN_PALETTE.SOOT_IRON_BG);
    dY += 2;
    buf.writeString(rightX, dY, 'Select a compartment from the left', VICTORIAN_PALETTE.SEPIA_INK, VICTORIAN_PALETTE.SOOT_IRON_BG);
    dY++;
    buf.writeString(rightX, dY, 'satchel drawer to inspect stats.', VICTORIAN_PALETTE.SEPIA_INK, VICTORIAN_PALETTE.SOOT_IRON_BG);
  }
}
