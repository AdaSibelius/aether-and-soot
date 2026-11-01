import { GameCommand } from '../../schemas/commands.schema.js';
import { BlueprintIdSchema, EntityId } from '../../schemas/primitives.schema.js';
import { WorldState } from '../../sim/core/world.js';
import { ModalWindowId } from '../ui/CharacterModalShell.js';
import {
  ANATOMY_SLOTS,
  ATLAS_STRATA,
  CODEX_TABS,
  DEFAULT_CODEX_IDS,
  DEFAULT_SECTORS,
  ModalNavState,
  recipesData,
  resolveModalRouterOptions,
} from './modal-nav-resolver.js';

export {
  ANATOMY_SLOTS,
  ATLAS_STRATA,
  CODEX_TABS,
  DEFAULT_CODEX_IDS,
  DEFAULT_SECTORS,
  resolveModalRouterOptions,
} from './modal-nav-resolver.js';
export type { ModalNavState } from './modal-nav-resolver.js';

export interface ModalKeyEvent {
  readonly key: string;
  preventDefault(): void;
}

export function handleModalNavigationKey(
  ev: ModalKeyEvent,
  activeModal: ModalWindowId,
  state: Readonly<WorldState>,
  playerId: EntityId,
  navState: ModalNavState,
  onCommand: (cmd: GameCommand) => void,
  onNavigate?: () => void,
): boolean {
  const isUp = ev.key === 'ArrowUp' || ev.key === 'w';
  const isDown = ev.key === 'ArrowDown' || ev.key === 's';
  const isLeft = ev.key === 'ArrowLeft';
  const isRight = ev.key === 'ArrowRight';
  const isEnter = ev.key === 'Enter' || ev.key === ' ';

  if (activeModal === 'INVENTORY') {
    const items = state.entities[playerId]?.inventory?.containedEntityIds ?? [];
    if (isUp || isDown) {
      ev.preventDefault();
      navState.selectedItemId = undefined;
      navState.selectedIndex = isUp
        ? Math.max(0, navState.selectedIndex - 1)
        : Math.min(Math.max(0, items.length - 1), navState.selectedIndex + 1);
      onNavigate?.();
      return true;
    }
    const resolved = resolveModalRouterOptions('INVENTORY', navState, state, playerId).selectedItemId;
    if ((isEnter || ev.key === 'u' || ev.key === 'U') && resolved) {
      ev.preventDefault();
      onCommand({ type: 'USE_ITEM', actorId: playerId, itemEntityId: resolved });
      return true;
    }
    if ((ev.key === 'd' || ev.key === 'D') && resolved) {
      ev.preventDefault();
      onCommand({ type: 'DROP_ITEM', actorId: playerId, itemEntityId: resolved });
      return true;
    }
  }

  if (activeModal === 'ANATOMY') {
    if (isUp || isDown) {
      ev.preventDefault();
      navState.selectedLimbSlot = undefined;
      navState.selectedIndex = isUp
        ? Math.max(0, navState.selectedIndex - 1)
        : Math.min(ANATOMY_SLOTS.length - 1, navState.selectedIndex + 1);
      onNavigate?.();
      return true;
    }
    const numIdx = Number.parseInt(ev.key, 10) - 1;
    if (numIdx >= 0 && numIdx < ANATOMY_SLOTS.length) {
      ev.preventDefault();
      const slot = ANATOMY_SLOTS[numIdx]!;
      navState.selectedIndex = numIdx;
      navState.selectedLimbSlot = slot;
      onNavigate?.();
      const satchelIds = state.entities[playerId]?.inventory?.containedEntityIds ?? [];
      const graft = satchelIds.find((id) => state.entities[id]?.prostheticSpec?.targetLimbSlot === slot);
      if (graft) {
        onCommand({ type: 'INSTALL_PROSTHETIC', actorId: playerId, slot, prostheticEntityId: graft });
      }
      return true;
    }
    const slot = resolveModalRouterOptions('ANATOMY', navState, state, playerId).selectedLimbSlot ?? 'TORSO';
    if (isEnter) {
      ev.preventDefault();
      const satchelIds = state.entities[playerId]?.inventory?.containedEntityIds ?? [];
      const graft = satchelIds.find((id) => state.entities[id]?.prostheticSpec?.targetLimbSlot === slot);
      if (graft) {
        onCommand({ type: 'INSTALL_PROSTHETIC', actorId: playerId, slot, prostheticEntityId: graft });
        return true;
      }
    }
    if (ev.key === 'r' || ev.key === 'R') {
      ev.preventDefault();
      onCommand({ type: 'REMOVE_PROSTHETIC', actorId: playerId, slot });
      return true;
    }
  }

  if (activeModal === 'WORKBENCH') {
    if (isUp || isDown) {
      ev.preventDefault();
      navState.selectedRecipeId = undefined;
      navState.selectedIndex = isUp
        ? Math.max(0, navState.selectedIndex - 1)
        : Math.min(Math.max(0, recipesData.length - 1), navState.selectedIndex + 1);
      onNavigate?.();
      return true;
    }
    if (isEnter) {
      ev.preventDefault();
      const recId = resolveModalRouterOptions('WORKBENCH', navState, state, playerId).selectedRecipeId;
      if (recId) {
        onCommand({ type: 'CRAFT_RECIPE', actorId: playerId, recipeId: BlueprintIdSchema.parse(recId) });
        return true;
      }
    }
  }

  if (activeModal === 'EXCHANGE') {
    const sectors = state.turf && Object.keys(state.turf).length > 0
      ? Object.keys(state.turf)
      : DEFAULT_SECTORS;
    if (isUp || isDown || isLeft || isRight) {
      ev.preventDefault();
      navState.selectedSectorId = undefined;
      const delta = isUp || isLeft ? -1 : 1;
      navState.selectedIndex = (navState.selectedIndex + delta + sectors.length) % sectors.length;
      onNavigate?.();
      return true;
    }
  }

  if (activeModal === 'ATLAS') {
    if (isUp || isDown || isLeft || isRight) {
      ev.preventDefault();
      navState.selectedStratum = undefined;
      const delta = isUp || isLeft ? -1 : 1;
      navState.selectedIndex = (navState.selectedIndex + delta + ATLAS_STRATA.length) % ATLAS_STRATA.length;
      onNavigate?.();
      return true;
    }
    const numIdx = Number.parseInt(ev.key, 10) - 1;
    if (numIdx >= 0 && numIdx < ATLAS_STRATA.length) {
      ev.preventDefault();
      navState.selectedIndex = numIdx;
      navState.selectedStratum = ATLAS_STRATA[numIdx];
      onNavigate?.();
      return true;
    }
  }

  if (activeModal === 'CODEX') {
    const entries = state.codex && Object.keys(state.codex).length > 0 ? Object.keys(state.codex) : DEFAULT_CODEX_IDS;
    if (isUp || isDown) {
      ev.preventDefault();
      navState.selectedCodexEntryId = undefined;
      navState.selectedIndex = isUp
        ? Math.max(0, navState.selectedIndex - 1)
        : Math.min(Math.max(0, entries.length - 1), navState.selectedIndex + 1);
      onNavigate?.();
      return true;
    }
    if (isLeft || isRight) {
      ev.preventDefault();
      const curTab = navState.selectedCodexCategory ?? 'ALL';
      const tabIdx = CODEX_TABS.indexOf(curTab);
      const nextIdx = (tabIdx + (isLeft ? -1 : 1) + CODEX_TABS.length) % CODEX_TABS.length;
      navState.selectedCodexCategory = CODEX_TABS[nextIdx];
      onNavigate?.();
      return true;
    }
  }

  return false;
}
