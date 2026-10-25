import { EntityId, LimbSlotId, StratumId } from '../../schemas/primitives.schema.js';
import { WorldState } from '../../sim/core/world.js';
import { ModalWindowId } from '../ui/CharacterModalShell.js';
import { renderArtificerBenchScreen } from './artificer-bench-screen.js';
import { renderAtlasScreen } from './atlas-screen.js';
import { createUiCellBuffer, UiCellBuffer } from './cell-buffer.js';
import { renderClockworkPaperdoll } from './diegetic-anatomy.js';
import { renderFactionContaminationMap } from './diegetic-cartography.js';
import { drawIndustrialFrame } from './industrial-primitives.js';
import { VICTORIAN_PALETTE } from './material-palette.js';
import { renderNaturalistLedgerScreen } from './naturalist-ledger-screen.js';
import { renderSatchelScreen } from './satchel-screen.js';

export interface ModalRouterOptions {
  readonly selectedLimbSlot?: LimbSlotId;
  readonly selectedItemId?: EntityId;
  readonly selectedRecipeId?: string;
  readonly selectedSectorId?: string;
  readonly selectedStratum?: StratumId;
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
      const paperdollOpts: { selectedSlot?: LimbSlotId } = {};
      if (options.selectedLimbSlot) paperdollOpts.selectedSlot = options.selectedLimbSlot;
      renderClockworkPaperdoll(buf, mainRect.x + 6, mainRect.y + 4, anatomy, paperdollOpts);

      // Right-side diagnostic telemetry column (placed cleanly with ample room)
      const colX = mainRect.x + 36;
      buf.writeString(colX, mainRect.y + 3, '═[ LIMB TELEMETRY & GRAFT STATUS ]═', VICTORIAN_PALETTE.TARNISHED_BRASS);
      const slots: readonly LimbSlotId[] = ['HEAD', 'TORSO', 'LEFT_ARM', 'RIGHT_ARM', 'LEFT_LEG', 'RIGHT_LEG'];
      let rowY = mainRect.y + 6;
      for (const slot of slots) {
        const limb = anatomy?.limbs[slot];
        const isSel = options.selectedLimbSlot === slot;
        const prefix = isSel ? '► ' : '  ';
        const hpText = limb ? `${limb.hp}/${limb.maxHp} HP` : 'N/A';
        const typeText = limb?.installedProstheticEntityId ? '[MECHANICAL GRAFT]' : '[BIOLOGICAL]';
        const color = limb?.amputated
          ? VICTORIAN_PALETTE.INCANDESCENT_RED
          : limb?.installedProstheticEntityId
            ? VICTORIAN_PALETTE.AETHER_BLUE
            : VICTORIAN_PALETTE.SEPIA_INK;

        buf.writeString(colX, rowY, `${prefix}${slot.padEnd(10)} ${hpText.padStart(10)} ${typeText}`, color, undefined, undefined, `select_limb:${slot}`);
        rowY += 2;
      }
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
      renderNaturalistLedgerScreen(buf, mainRect, state);
      break;
    }

    case 'ATLAS': {
      const atlasOpts: { selectedStratum?: StratumId } = {};
      if (options.selectedStratum) atlasOpts.selectedStratum = options.selectedStratum;
      renderAtlasScreen(buf, mainRect, state, playerId, atlasOpts);
      break;
    }
  }

  // Footer navigation hint
  buf.writeString(
    mainRect.x + 2,
    mainRect.y + mainRect.height - 1,
    '[Tab/Q/E] Switch Window  │  [Esc] Return to Streets',
    VICTORIAN_PALETTE.MUTED_PIPE,
    VICTORIAN_PALETTE.SOOT_IRON_BG,
  );

  return buf;
}
