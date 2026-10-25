import { EntityId } from '../../schemas/primitives.schema.js';
import { WorldState } from '../../sim/core/world.js';
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

  // 1. Draw outer portable iron housing
  drawIndustrialFrame(buf, rect, {
    tier: 'PRIMARY_IRON',
    title: 'SATCHEL & PORTABLE GAUGES',
  });

  const contentX = rect.x + 2;
  const contentWidth = rect.width - 4;
  let curY = rect.y + 2;

  // 2. Twin Precision Instrument Gauges (Pressure & Blood)
  const currentSteam = anatomy?.steamReserveKpa ?? 0;
  const maxSteam = anatomy?.maxSteamReserveKpa ?? 100;
  const steamRatio = maxSteam > 0 ? currentSteam / maxSteam : 0;
  drawDiegeticGauge(buf, contentX, curY, contentWidth, steamRatio, {
    label: 'STM',
    style: 'PRESSURE_COLUMN',
    currentVal: currentSteam,
    unit: ' kPa',
  });
  curY += 2;

  const bloodPct = anatomy?.bloodVolumePct ?? 100;
  drawDiegeticGauge(buf, contentX, curY, contentWidth, bloodPct / 100, {
    label: 'BLD',
    style: 'LIQUID_TUBE',
    currentVal: bloodPct,
    unit: '%',
  });
  curY += 2;

  // 3. Compartmented item inventory drawer
  buf.writeString(contentX, curY, '─[ PNEUMATIC COMPARTMENTS ]────────────────────', VICTORIAN_PALETTE.MUTED_PIPE, VICTORIAN_PALETTE.SOOT_IRON_BG);
  curY += 1;

  const containedIds = inventory?.containedEntityIds ?? [];
  const maxDisplayRows = Math.max(1, rect.height - (curY - rect.y) - 2);

  for (let idx = 0; idx < maxDisplayRows; idx++) {
    const itemIdx = scrollOffset + idx;
    const itemId = containedIds[itemIdx];
    const rowY = curY + idx;

    if (!itemId) {
      // Empty compartment slot
      buf.writeString(contentX, rowY, `  [··] <Empty Compartment>`, VICTORIAN_PALETTE.MUTED_PIPE, VICTORIAN_PALETTE.SOOT_IRON_BG);
      continue;
    }

    const itemEntity = state.entities[itemId];
    const itemComp = itemEntity?.item;
    const name = itemComp?.blueprintId ? itemComp.blueprintId.replace(/^(item_|mat_|prosthetic_)/, '').replace(/_/g, ' ') : itemId;
    const qty = (itemComp?.quantity ?? 1) > 1 ? ` x${itemComp?.quantity}` : '';
    const mass = itemComp?.massGrams ? ` ${(itemComp.massGrams / 1000).toFixed(1)}kg` : '';
    const isSelected = selectedItemId === itemId;

    const prefix = isSelected ? '► [' : '  [';
    const slotLetter = String.fromCharCode(65 + (itemIdx % 26));
    const badge = itemComp ? (itemComp.category === 'PROSTHETIC' ? '[#]' : itemComp.category === 'CONSUMABLE' ? '(!)' : itemComp.category === 'EQUIPMENT' ? '[=]' : '(*)') : '[·]';
    const line = `${prefix}${slotLetter}] ${badge} ${name.padEnd(20, ' ')}${qty.padStart(5, ' ')}${mass.padStart(8, ' ')}`;
    const lineFg = isSelected ? VICTORIAN_PALETTE.AETHER_BLUE : VICTORIAN_PALETTE.SEPIA_INK;
    const lineBg = isSelected ? VICTORIAN_PALETTE.OXIDIZED_IRON : VICTORIAN_PALETTE.SOOT_IRON_BG;
    const hitKey = `select_item:${itemId}`;

    buf.writeString(contentX, rowY, line.slice(0, contentWidth), lineFg, lineBg, undefined, hitKey);
  }

  // Bottom mass telemetry footer
  const footerY = rect.y + rect.height - 2;
  const itemCount = containedIds.length;
  buf.writeString(contentX, footerY, `ITEMS: ${itemCount} | BRASS LOCKS: OK`, VICTORIAN_PALETTE.TARNISHED_BRASS, VICTORIAN_PALETTE.SOOT_IRON_BG);
}
