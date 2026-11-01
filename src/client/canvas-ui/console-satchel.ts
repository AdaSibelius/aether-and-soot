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
  const massFg = isMassOverload
    ? VICTORIAN_PALETTE.WARN_RED
    : massRatio > 0.75
      ? VICTORIAN_PALETTE.AMBER_GASLIGHT
      : VICTORIAN_PALETTE.AETHER_BLUE;
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
  const equippedHandId = inventory?.equippedSlots?.WIELD;
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
