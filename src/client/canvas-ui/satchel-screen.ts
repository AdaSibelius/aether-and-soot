import { EntityId } from '../../schemas/primitives.schema.js';
import { WorldState } from '../../sim/core/world.js';
import { getAnyBlueprint } from '../../sim/data/item-catalog.js';
import { resolveCatalogDisplayName } from '../projection/frame-adapter.js';
import { UiCellBuffer } from './cell-buffer.js';
import { drawDiegeticGauge, drawIndustrialFrame } from './industrial-primitives.js';
import { VICTORIAN_PALETTE } from './material-palette.js';
import { UiRect } from './viewport-controls.js';

export interface SatchelScreenOptions {
  readonly selectedItemId?: EntityId;
  readonly scrollOffset?: number;
}

export function renderSatchelScreen(
  buf: UiCellBuffer,
  rect: UiRect,
  state: Readonly<WorldState>,
  playerId: EntityId,
  options: SatchelScreenOptions = {},
): void {
  const { selectedItemId, scrollOffset = 0 } = options;
  const player = state.entities[playerId];
  const anatomy = player?.anatomy;
  const inventory = player?.inventory;
  const containedIds = inventory?.containedEntityIds ?? [];

  // 1. Draw outer portable iron housing
  drawIndustrialFrame(buf, rect, {
    tier: 'PRIMARY_IRON',
    title: 'SATCHEL & PORTABLE GAUGES',
  });

  const contentX = rect.x + 2;
  const leftWidth = 38;
  const dividerX = rect.x + 41;
  const rightX = rect.x + 43;
  const rightWidth = Math.min(38, rect.width - 45);
  let curY = rect.y + 2;

  // 2. Twin Precision Instrument Gauges (Pressure & Blood)
  const currentSteam = anatomy?.steamReserveKpa ?? 0;
  const maxSteam = anatomy?.maxSteamReserveKpa ?? 100;
  drawDiegeticGauge(buf, contentX, curY, leftWidth, maxSteam > 0 ? currentSteam / maxSteam : 0, {
    label: 'STM',
    style: 'PRESSURE_COLUMN',
    currentVal: currentSteam,
    unit: ' kPa',
  });
  curY += 2;

  const bloodPct = anatomy?.bloodVolumePct ?? 100;
  drawDiegeticGauge(buf, contentX, curY, leftWidth, bloodPct / 100, {
    label: 'BLD',
    style: 'LIQUID_TUBE',
    currentVal: bloodPct,
    unit: '%',
  });
  curY += 2;

  // Brass vertical divider between left inventory & right item dossier
  for (let dy = rect.y + 2; dy < rect.y + rect.height - 2; dy++) {
    buf.setCell(dividerX, dy, '│', VICTORIAN_PALETTE.MUTED_PIPE, VICTORIAN_PALETTE.SOOT_IRON_BG);
  }

  // 3. Left Column: Compartmented Item Inventory
  buf.writeString(contentX, curY, '─[ PNEUMATIC COMPARTMENTS ]─────────', VICTORIAN_PALETTE.TARNISHED_BRASS, VICTORIAN_PALETTE.SOOT_IRON_BG);
  curY += 1;

  const maxDisplayRows = Math.max(1, rect.height - (curY - rect.y) - 3);
  const activeItemId = (selectedItemId && containedIds.includes(selectedItemId))
    ? selectedItemId
    : containedIds[0];

  if (containedIds.length === 0) {
    buf.writeString(contentX, curY, '  [··] <Satchel is Empty>', VICTORIAN_PALETTE.MUTED_PIPE, VICTORIAN_PALETTE.SOOT_IRON_BG);
    for (let idx = 1; idx < Math.min(4, maxDisplayRows); idx++) {
      buf.writeString(contentX, curY + idx, '  [··] <Empty Compartment>', '#261f18', VICTORIAN_PALETTE.SOOT_IRON_BG);
    }
  } else {
    for (let idx = 0; idx < maxDisplayRows; idx++) {
      const itemIdx = scrollOffset + idx;
      const itemId = containedIds[itemIdx];
      const rowY = curY + idx;

      if (!itemId) {
        if (idx < containedIds.length + 2) {
          buf.writeString(contentX, rowY, '  [··] <Empty Compartment>', '#261f18', VICTORIAN_PALETTE.SOOT_IRON_BG);
        }
        continue;
      }

      const itemEntity = state.entities[itemId];
      const itemComp = itemEntity?.item;
      const rawName = itemComp?.blueprintId
        ? resolveCatalogDisplayName('item', itemComp.blueprintId)
        : (itemEntity?.name ?? itemId);
      const name = rawName.length > 18 ? `${rawName.slice(0, 17)}…` : rawName.padEnd(18, ' ');
      const qty = (itemComp?.quantity ?? 1) > 1 ? ` x${itemComp?.quantity}` : '';
      const isSelected = activeItemId === itemId;

      const prefix = isSelected ? '► [' : '  [';
      const slotLetter = String.fromCharCode(65 + (itemIdx % 26));
      const badge = itemComp?.category === 'PROSTHETIC' ? '[#]' : itemComp?.category === 'CONSUMABLE' ? '(!)' : itemComp?.category === 'EQUIPMENT' ? '[=]' : '(*)';
      const line = `${prefix}${slotLetter}] ${badge} ${name}${qty.padStart(4, ' ')}`;
      const lineFg = isSelected ? VICTORIAN_PALETTE.AETHER_BLUE : VICTORIAN_PALETTE.SEPIA_INK;
      const lineBg = isSelected ? VICTORIAN_PALETTE.OXIDIZED_IRON : VICTORIAN_PALETTE.SOOT_IRON_BG;

      buf.writeString(contentX, rowY, line.slice(0, leftWidth), lineFg, lineBg, undefined, `select_item:${itemId}`);
    }
  }

  // 4. Right Column: Galvanometric Item Dossier
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

    const massKg = ((activeComp?.massGrams ?? 100) / 1000).toFixed(2);
    const volMl = activeComp?.volumeMl ?? 250;
    buf.writeString(rightX, dY, `Mass/Vol:  ${massKg} kg │ ${volMl} ml`, VICTORIAN_PALETTE.MUTED_PIPE, VICTORIAN_PALETTE.SOOT_IRON_BG);
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

  // 5. Bottom Navigation Footer
  const footerY = rect.y + rect.height - 2;
  const itemCount = containedIds.length;
  buf.writeString(contentX, footerY, `ITEMS: ${itemCount} │ LOCKS: OK │ [↑/↓] Select  [Enter] Use  [Esc] Exit`, VICTORIAN_PALETTE.TARNISHED_BRASS, VICTORIAN_PALETTE.SOOT_IRON_BG);
}
