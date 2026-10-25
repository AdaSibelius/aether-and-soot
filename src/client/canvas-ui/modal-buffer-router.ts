import { EntityId, LimbSlotId } from '../../schemas/primitives.schema.js';
import { WorldState } from '../../sim/core/world.js';
import { ModalWindowId } from '../ui/CharacterModalShell.js';
import { renderArtificerBenchScreen } from './artificer-bench-screen.js';
import { createUiCellBuffer, UiCellBuffer } from './cell-buffer.js';
import { renderClockworkPaperdoll } from './diegetic-anatomy.js';
import { renderFactionContaminationMap } from './diegetic-cartography.js';
import { drawIndustrialFrame } from './industrial-primitives.js';
import { VICTORIAN_PALETTE } from './material-palette.js';
import { drawAsciiConduit } from './mechanical-conduits.js';
import { renderNaturalistLedgerScreen } from './naturalist-ledger-screen.js';
import { renderSatchelScreen } from './satchel-screen.js';

export interface ModalRouterOptions {
  readonly selectedLimbSlot?: LimbSlotId;
  readonly selectedItemId?: EntityId;
  readonly selectedRecipeId?: string;
  readonly selectedSectorId?: string;
  readonly scrollOffset?: number;
}

export function generateModalUiBuffer(
  modal: ModalWindowId,
  state: Readonly<WorldState>,
  playerId: EntityId,
  width = 48,
  height = 30,
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
        title: 'VITRUVIAN CLOCKWORK PAPERDOLL [A]',
      });
      const player = state.entities[playerId];
      const anatomy = player?.anatomy;
      const paperdollOpts: { selectedSlot?: LimbSlotId } = {};
      if (options.selectedLimbSlot) paperdollOpts.selectedSlot = options.selectedLimbSlot;
      renderClockworkPaperdoll(buf, mainRect.x + 3, mainRect.y + 3, anatomy, paperdollOpts);

      // Right-side diagnostic telemetry column
      const colX = mainRect.x + 23;
      buf.writeString(colX, mainRect.y + 2, '═[ LIMB TELEMETRY & GRAFTS ]═', VICTORIAN_PALETTE.TARNISHED_BRASS);
      const slots: readonly LimbSlotId[] = ['HEAD', 'TORSO', 'LEFT_ARM', 'RIGHT_ARM', 'LEFT_LEG', 'RIGHT_LEG'];
      let rowY = mainRect.y + 4;
      for (const slot of slots) {
        const limb = anatomy?.limbs[slot];
        const isSel = options.selectedLimbSlot === slot;
        const prefix = isSel ? '> ' : '  ';
        const hpText = limb ? `${limb.hp}/${limb.maxHp} HP` : 'N/A';
        const typeText = limb?.installedProstheticEntityId ? '[MECHANICAL]' : '[BIOLOGICAL]';
        const color = limb?.amputated
          ? VICTORIAN_PALETTE.INCANDESCENT_RED
          : limb?.installedProstheticEntityId
            ? VICTORIAN_PALETTE.AETHER_BLUE
            : VICTORIAN_PALETTE.SEPIA_INK;

        buf.writeString(colX, rowY, `${prefix}${slot.padEnd(9)} ${hpText.padStart(9)} ${typeText}`, color, undefined, undefined, `select_limb:${slot}`);
        rowY += 2;
      }
      break;
    }

    case 'WORKBENCH': {
      const benchOpts: { selectedRecipeId?: string; scrollOffset?: number } = {};
      if (options.selectedRecipeId) benchOpts.selectedRecipeId = options.selectedRecipeId;
      if (options.scrollOffset !== undefined) benchOpts.scrollOffset = options.scrollOffset;
      renderArtificerBenchScreen(buf, mainRect, state, benchOpts);
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
      drawIndustrialFrame(buf, mainRect, {
        tier: 'SECONDARY_BRASS',
        title: 'OVERWORLD CONDUITS & DISTRICT ATLAS [W]',
      });
      buf.writeString(mainRect.x + 2, mainRect.y + 2, 'MINIMAP CONDUIT TRACE', VICTORIAN_PALETTE.TARNISHED_BRASS);
      buf.writeString(mainRect.x + 24, mainRect.y + 2, 'DISTRICT DOSSIER', VICTORIAN_PALETTE.TARNISHED_BRASS);

      // Render diegetic conduit pipe connecting target point to dossier
      drawAsciiConduit(
        buf,
        { x: mainRect.x + 12, y: mainRect.y + 6 },
        { x: mainRect.x + 24, y: mainRect.y + 14 },
        { signalProgress: 0.65 },
      );

      buf.writeString(mainRect.x + 25, mainRect.y + 5, `District: ${state.currentDistrictId ?? 'Spitalfields'}`, VICTORIAN_PALETTE.SEPIA_INK);
      buf.writeString(mainRect.x + 25, mainRect.y + 7, `Stratum:  ${state.entities[playerId]?.position?.stratum ?? 'STREET'}`, VICTORIAN_PALETTE.SEPIA_INK);
      buf.writeString(mainRect.x + 25, mainRect.y + 9, `Turn:     ${state.turnCount}`, VICTORIAN_PALETTE.SEPIA_INK);
      buf.writeString(mainRect.x + 25, mainRect.y + 11, 'Conduit:  STEAM_MAIN (Pneumatic 92 kPa)', VICTORIAN_PALETTE.AETHER_BLUE, undefined, ['AETHER_HALATION']);
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
