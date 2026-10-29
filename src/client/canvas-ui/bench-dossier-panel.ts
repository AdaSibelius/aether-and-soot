import { EntityId } from '../../schemas/primitives.schema.js';
import { WorldState } from '../../sim/core/world.js';
import { resolveCatalogDisplayName } from '../projection/frame-adapter.js';
import { UiCellBuffer } from './cell-buffer.js';
import { VICTORIAN_PALETTE } from './material-palette.js';
import { ArtificerBenchRecipe } from './artificer-bench-screen.js';

export function countInventoryItem(
  state: Readonly<WorldState>,
  playerId: EntityId | undefined,
  blueprintId: string,
): number {
  if (!playerId) return 0;
  const player = state.entities[playerId];
  const items = player?.inventory?.containedEntityIds ?? [];
  let count = 0;
  for (const itemId of items) {
    const itemEnt = state.entities[itemId];
    if (itemEnt?.item?.blueprintId === blueprintId) {
      count += itemEnt.item.quantity ?? 1;
    }
  }
  return count;
}

export function renderBenchDossierPanel(
  buf: UiCellBuffer,
  rect: { x: number; y: number; width: number; height: number },
  rightX: number,
  rightWidth: number,
  state: Readonly<WorldState>,
  playerId: EntityId | undefined,
  activeRecipe: ArtificerBenchRecipe,
  playerSteam: number,
): void {
  let dY = rect.y + 4;
  buf.writeString(rightX, dY, activeRecipe.name.slice(0, rightWidth), VICTORIAN_PALETTE.AMBER_GASLIGHT, VICTORIAN_PALETTE.SOOT_IRON_BG);
  dY += 2;

  const station = activeRecipe.stationType ?? (activeRecipe.requiresWorkbench ? 'ARTIFICER_BENCH' : 'FIELD_ASSEMBLY');
  buf.writeString(rightX, dY, `Station:   ${station}`, VICTORIAN_PALETTE.SEPIA_INK, VICTORIAN_PALETTE.SOOT_IRON_BG);
  dY++;

  const steamOk = playerSteam >= activeRecipe.steamCostKpa;
  const steamFg = steamOk ? VICTORIAN_PALETTE.AETHER_BLUE : VICTORIAN_PALETTE.INCANDESCENT_RED;
  buf.writeString(rightX, dY, `Pressure:  ${activeRecipe.steamCostKpa} kPa (${playerSteam} kPa avail)`, steamFg, VICTORIAN_PALETTE.SOOT_IRON_BG);
  dY++;

  buf.writeString(rightX, dY, `Action:    ${activeRecipe.apCost ?? 100} Action Points`, VICTORIAN_PALETTE.SEPIA_INK, VICTORIAN_PALETTE.SOOT_IRON_BG);
  dY += 2;

  buf.writeString(rightX, dY, '─[ REQUIRED COMPONENTS ]──────', VICTORIAN_PALETTE.TARNISHED_BRASS, VICTORIAN_PALETTE.SOOT_IRON_BG);
  dY++;

  let allIngOk = true;
  for (const ing of activeRecipe.ingredients ?? []) {
    const avail = countInventoryItem(state, playerId, ing.blueprintId);
    const isOk = avail >= ing.count;
    if (!isOk) allIngOk = false;
    const checkIcon = isOk ? '[✓]' : '[✗]';
    const checkFg = isOk ? VICTORIAN_PALETTE.AETHER_BLUE : VICTORIAN_PALETTE.INCANDESCENT_RED;
    const ingName = resolveCatalogDisplayName('item', ing.blueprintId);
    buf.writeString(rightX, dY, ` ${checkIcon} ${avail}/${ing.count} ${ingName}`.slice(0, rightWidth), checkFg, VICTORIAN_PALETTE.SOOT_IRON_BG);
    dY++;
  }

  if (activeRecipe.description) {
    dY++;
    buf.writeWrappedText({ x: rightX, y: dY, width: rightWidth, height: 4 }, activeRecipe.description, {
      fg: VICTORIAN_PALETTE.MUTED_PIPE,
      bg: VICTORIAN_PALETTE.SOOT_IRON_BG,
    });
    dY += 4;
  }

  dY = Math.max(dY, rect.y + rect.height - 4);
  if (steamOk && allIngOk) {
    buf.writeString(rightX, dY, '► [ ENTER / CLICK ] FABRICATE ITEM', VICTORIAN_PALETTE.AETHER_BLUE, VICTORIAN_PALETTE.OXIDIZED_IRON, ['AETHER_HALATION'], `craft_recipe:${activeRecipe.id}`);
  } else {
    buf.writeString(rightX, dY, '  [!] INSUFFICIENT STEAM OR PARTS', VICTORIAN_PALETTE.MUTED_PIPE, VICTORIAN_PALETTE.SOOT_IRON_BG);
  }
}
