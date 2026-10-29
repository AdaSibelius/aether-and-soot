import { EntityId, LimbSlotId, StratumId } from '../../schemas/primitives.schema.js';
import { WorldState } from '../../sim/core/world.js';
import { ModalWindowId } from '../ui/CharacterModalShell.js';
import { renderArtificerBenchScreen } from './artificer-bench-screen.js';
import { renderAtlasScreen } from './atlas-screen.js';
import { createUiCellBuffer, UiCellBuffer } from './cell-buffer.js';
import { renderDiegeticPaperdoll } from './dossier-paperdoll.js';
import { renderFactionContaminationMap } from './diegetic-cartography.js';
import { drawIndustrialFrame } from './industrial-primitives.js';
import { VICTORIAN_PALETTE } from './material-palette.js';
import { NaturalistLedgerOptions, NaturalistTab, renderNaturalistLedgerScreen } from './naturalist-ledger-screen.js';
import { renderSatchelScreen } from './satchel-screen.js';

export interface ModalRouterOptions {
  readonly selectedLimbSlot?: LimbSlotId;
  readonly selectedItemId?: EntityId;
  readonly selectedRecipeId?: string;
  readonly selectedSectorId?: string;
  readonly selectedStratum?: StratumId;
  readonly selectedCodexEntryId?: string;
  readonly selectedCodexCategory?: NaturalistTab;
  readonly scrollOffset?: number;
}

export function generateModalUiBuffer(
  modal: ModalWindowId,
  state: Readonly<WorldState>,
  playerId: EntityId,
  width = 88,
  height = 36,
  options: ModalRouterOptions = {},
): UiCellBuffer {
  const buf = createUiCellBuffer(width, height);
  const mainRect = { x: 2, y: 1, width: width - 4, height: height - 2 };

  switch (modal) {
    case 'INVENTORY': {
      const satchelOpts: { selectedItemId?: EntityId; scrollOffset?: number } = {};
      if (options.selectedItemId) satchelOpts.selectedItemId = options.selectedItemId;
      if (options.scrollOffset !== undefined) satchelOpts.scrollOffset = options.scrollOffset;
      renderSatchelScreen(buf, mainRect, state, playerId, satchelOpts);
      break;
    }

    case 'ANATOMY': {
      drawIndustrialFrame(buf, mainRect, {
        tier: 'PRIMARY_IRON',
        title: 'VITRUVIAN CLOCKWORK PAPERDOLL & GRAFT BAY [A]',
      });
      const player = state.entities[playerId];
      const anatomy = player?.anatomy;
      renderDiegeticPaperdoll(buf, mainRect.x + 4, mainRect.y + 4, { anatomy });

      // Right-side diagnostic telemetry column (placed cleanly with ample room)
      const colX = mainRect.x + 36;
      buf.writeString(colX, mainRect.y + 2, '═[ LIMB TELEMETRY & GRAFT STATUS ]═', VICTORIAN_PALETTE.TARNISHED_BRASS);
      const slots: readonly LimbSlotId[] = [
        'HEAD',
        'OCULAR_MOUNT',
        'TORSO',
        'CHASSIS_CORE',
        'LEFT_ARM',
        'RIGHT_ARM',
        'LEFT_LEG',
        'RIGHT_LEG',
      ];
      let rowY = mainRect.y + 4;
      for (const slot of slots) {
        const limb = anatomy?.limbs[slot];
        const isSel = (options.selectedLimbSlot ?? 'TORSO') === slot;
        const prefix = isSel ? '► ' : '  ';
        const hpText = limb ? `${limb.hp}/${limb.maxHp} HP` : 'N/A';
        const typeText = limb?.installedProstheticEntityId ? '[MECHANICAL GRAFT]' : '[BIOLOGICAL]';
        const color = limb?.amputated
          ? VICTORIAN_PALETTE.INCANDESCENT_RED
          : limb?.installedProstheticEntityId
            ? VICTORIAN_PALETTE.AETHER_BLUE
            : isSel
              ? VICTORIAN_PALETTE.AMBER_GASLIGHT
              : VICTORIAN_PALETTE.SEPIA_INK;

        buf.writeString(colX, rowY, `${prefix}${slot.padEnd(12)} ${hpText.padStart(10)} ${typeText}`, color, isSel ? VICTORIAN_PALETTE.OXIDIZED_IRON : undefined, undefined, `select_limb:${slot}`);
        rowY += 2;
      }

      const strainHp = Math.round((anatomy?.strainLoadKw ?? 0) * 1.34);
      const governorHp = Math.round((anatomy?.governorCapacityKw ?? 100) * 1.34);
      buf.writeString(colX, mainRect.y + 22, '─[ BOILER GOVERNOR & CYBERNETICS ]──', VICTORIAN_PALETTE.TARNISHED_BRASS);
      buf.writeString(colX, mainRect.y + 24, `Governor: ${governorHp} HP │ Load: ${strainHp} HP (${Math.round(governorHp > 0 ? (strainHp / governorHp) * 100 : 0)}%)`, VICTORIAN_PALETTE.AMBER_GASLIGHT);
      buf.writeString(colX, mainRect.y + 26, '[Click/Key] Target limb │ [Enter] Graft', VICTORIAN_PALETTE.MUTED_PIPE);
      break;
    }

    case 'WORKBENCH': {
      const benchOpts: { selectedRecipeId?: string; scrollOffset?: number } = {};
      if (options.selectedRecipeId) benchOpts.selectedRecipeId = options.selectedRecipeId;
      if (options.scrollOffset !== undefined) benchOpts.scrollOffset = options.scrollOffset;
      renderArtificerBenchScreen(buf, mainRect, state, benchOpts, playerId);
      break;
    }

    case 'EXCHANGE': {
      renderFactionContaminationMap(buf, mainRect, state, options.selectedSectorId);
      break;
    }

    case 'CODEX': {
      const codexOpts: NaturalistLedgerOptions = {
        ...(options.selectedCodexEntryId ? { selectedEntryId: options.selectedCodexEntryId } : {}),
        ...(options.selectedCodexCategory ? { selectedCategory: options.selectedCodexCategory } : {}),
        ...(options.scrollOffset !== undefined ? { scrollOffset: options.scrollOffset } : {}),
      };
      renderNaturalistLedgerScreen(buf, mainRect, state, codexOpts);
      break;
    }

    case 'ATLAS': {
      const atlasOpts: { selectedStratum?: StratumId } = {};
      if (options.selectedStratum) atlasOpts.selectedStratum = options.selectedStratum;
      renderAtlasScreen(buf, mainRect, state, playerId, atlasOpts);
      break;
    }
  }

  // Footer navigation hint (placed at height - 2 so bottom border frame at height - 1 is preserved)
  buf.writeString(
    mainRect.x + 2,
    mainRect.y + mainRect.height - 2,
    '[Tab/Q/E] Switch Window  │  [Esc] Return to Streets',
    VICTORIAN_PALETTE.MUTED_PIPE,
    VICTORIAN_PALETTE.SOOT_IRON_BG,
  );

  return buf;
}
