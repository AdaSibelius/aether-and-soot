import { GameCommand } from '../../schemas/commands.schema.js';
import { EntityId, LimbSlotId } from '../../schemas/primitives.schema.js';
import { WorldState } from '../../sim/core/world.js';
import { findActorAtStepTarget, findAdjacentHostileActor } from '../client-interactions.js';
import { ModalWindowId } from '../ui/CharacterModalShell.js';
import { handleModalNavigationKey, ModalNavState } from './modal-nav-router.js';

export interface KeyboardRouterParams {
  readonly playerId: EntityId;
  readonly isSystemMenuOpen: boolean;
  readonly activeModal: ModalWindowId | null;
  readonly isLookModeActive: boolean;
  readonly isCreatorOpen?: boolean;
  readonly worldState?: Readonly<WorldState>;
  readonly modalNavState?: ModalNavState;
  readonly onNavigate?: () => void;
  readonly onCreatorKey?: (key: string) => boolean;
  readonly onToggleSystemMenu: () => void;
  readonly onCloseModal: () => void;
  readonly onCycleModal: (direction: 1 | -1) => void;
  readonly onSetModal: (modal: ModalWindowId | null) => void;
  readonly onToggleLookMode: () => void;
  readonly onMoveLookCursor: (dx: number, dy: number) => void;
  readonly onLookAttack: (slot: LimbSlotId) => void;
  readonly onLookInteract: () => void;
  readonly onToggleDoor?: () => void;
  readonly onTalk?: (targetNpcId?: EntityId) => void;
  readonly onOpenCharacterCreator?: () => void;
  readonly onCloseCharacterCreator?: () => void;
  readonly currentPosture?: 'STANDING' | 'CROUCHED' | 'BRACED';
  readonly onTogglePosture?: () => void;
  readonly onCommand: (cmd: GameCommand) => void;
}

const SLOT_MAP: Record<string, LimbSlotId> = {
  '1': 'HEAD',
  '2': 'TORSO',
  '3': 'LEFT_ARM',
  '4': 'RIGHT_ARM',
  '5': 'LEFT_LEG',
  '6': 'RIGHT_LEG',
};

const MOVE_MAP: Record<string, { dx: number; dy: number }> = {
  ArrowUp: { dx: 0, dy: -1 },
  w: { dx: 0, dy: -1 },
  ArrowDown: { dx: 0, dy: 1 },
  s: { dx: 0, dy: 1 },
  ArrowLeft: { dx: -1, dy: 0 },
  a: { dx: -1, dy: 0 },
  ArrowRight: { dx: 1, dy: 0 },
  d: { dx: 1, dy: 0 },
};

export function handleGameKeydown(ev: KeyboardEvent, params: KeyboardRouterParams): void {
  const { playerId, isSystemMenuOpen, activeModal, isLookModeActive, onToggleSystemMenu,
    onCloseModal, onCycleModal, onSetModal, onToggleLookMode, onMoveLookCursor,
    onLookAttack, onLookInteract, onToggleDoor, onTalk, onOpenCharacterCreator, onCommand } = params;

  if (ev.key === 'Escape') {
    ev.preventDefault();
    if (params.isCreatorOpen && params.onCloseCharacterCreator) params.onCloseCharacterCreator();
    else if (activeModal !== null) onCloseModal();
    else if (isLookModeActive) onToggleLookMode();
    else onToggleSystemMenu();
    return;
  }

  if (isSystemMenuOpen) return;

  if (params.isCreatorOpen) {
    if (params.onCreatorKey?.(ev.key)) {
      ev.preventDefault();
    }
    return;
  }

  if (activeModal !== null) {
    if (ev.key === 'Tab') {
      ev.preventDefault();
      onCycleModal(ev.shiftKey ? -1 : 1);
      return;
    }
    if (ev.key === 'q' || ev.key === 'Q') {
      ev.preventDefault();
      onCycleModal(-1);
      return;
    }
    if (ev.key === 'e' || ev.key === 'E') {
      ev.preventDefault();
      onCycleModal(1);
      return;
    }

    // Modal internal list/item keyboard navigation first so WASD/Arrows work
    if (params.worldState && params.modalNavState) {
      const handled = handleModalNavigationKey(
        ev,
        activeModal,
        params.worldState,
        playerId,
        params.modalNavState,
        onCommand,
        params.onNavigate,
      );
      if (handled) return;
    }

    const modalKeyMap: Record<string, ModalWindowId> = {
      i: 'INVENTORY', I: 'INVENTORY',
      A: 'ANATOMY',
      c: 'WORKBENCH', C: 'WORKBENCH',
      m: 'EXCHANGE', M: 'EXCHANGE',
      W: 'ATLAS',
      k: 'CODEX', K: 'CODEX',
    };
    const targetModal = modalKeyMap[ev.key];
    if (targetModal) {
      ev.preventDefault();
      onSetModal(activeModal === targetModal ? null : targetModal);
      return;
    }
    return;
  }

  // Look Mode Controls
  if (isLookModeActive) {
    if (ev.key === 'l' || ev.key === 'L') {
      ev.preventDefault();
      onToggleLookMode();
      return;
    }
    const dir = MOVE_MAP[ev.key];
    if (dir) {
      ev.preventDefault();
      onMoveLookCursor(dir.dx, dir.dy);
      return;
    }
    const slot = SLOT_MAP[ev.key];
    if (slot) {
      ev.preventDefault();
      onLookAttack(slot);
      return;
    }
    if (ev.key === 'f' || ev.key === 'F') {
      ev.preventDefault();
      onLookAttack('TORSO');
      return;
    }
    if (ev.key === 'Enter' || ev.key === 'o' || ev.key === 'O') {
      ev.preventDefault();
      onLookInteract();
      return;
    }
    return;
  }

  // Quick-Target Combat Hotkeys outside Look Mode
  if (params.worldState) {
    const adjHostile = findAdjacentHostileActor(params.worldState, playerId);
    if (adjHostile) {
      const slot = SLOT_MAP[ev.key];
      if (slot) {
        ev.preventDefault();
        onCommand({ type: 'ATTACK_ACTOR', attackerId: playerId, targetId: adjHostile.id, targetSlot: slot });
        return;
      }
      if (ev.key === 'f' || ev.key === 'F') {
        ev.preventDefault();
        onCommand({ type: 'ATTACK_ACTOR', attackerId: playerId, targetId: adjHostile.id, targetSlot: 'TORSO' });
        return;
      }
    }
  }

  // Tactical Hotkeys to Open Modal Windows
  const openModalMap: Record<string, ModalWindowId> = {
    i: 'INVENTORY', I: 'INVENTORY',
    c: 'WORKBENCH', C: 'WORKBENCH',
    m: 'EXCHANGE', M: 'EXCHANGE',
    A: 'ANATOMY',
    W: 'ATLAS',
    k: 'CODEX', K: 'CODEX',
  };
  const toOpen = openModalMap[ev.key];
  if (toOpen) {
    ev.preventDefault();
    onSetModal(toOpen);
    return;
  }

  if (ev.key === 'l' || ev.key === 'L') {
    ev.preventDefault();
    onToggleLookMode();
    return;
  }
  if (ev.key === 't' || ev.key === 'T') {
    ev.preventDefault();
    onTalk?.();
    return;
  }
  if (ev.key === 'o' || ev.key === 'O') {
    ev.preventDefault();
    onToggleDoor?.();
    return;
  }

  // Standard Roguelike Movement, Bump-to-Attack & Actions
  const move = MOVE_MAP[ev.key];
  if (move) {
    ev.preventDefault();
    if (params.worldState) {
      const targetActor = findActorAtStepTarget(params.worldState, playerId, move.dx, move.dy);
      if (targetActor) {
        if (targetActor.aiController?.hostile) {
          onCommand({ type: 'ATTACK_ACTOR', attackerId: playerId, targetId: targetActor.id, targetSlot: 'TORSO' });
          return;
        }
        if (onTalk) {
          onTalk(targetActor.id);
          return;
        }
      }
    }
    onCommand({ type: 'MOVE_STEP', actorId: playerId, dx: move.dx, dy: move.dy });
    return;
  }

  if (ev.key === '>' || ev.key === '<' || ev.key === 'Enter') {
    ev.preventDefault();
    onCommand({ type: 'USE_PORTAL', actorId: playerId });
  } else if (ev.key === '.' || ev.key === ' ') {
    ev.preventDefault();
    onCommand({ type: 'WAIT_TURN', actorId: playerId });
  } else if (ev.key === 'g' || ev.key === ',') {
    ev.preventDefault();
    onCommand({ type: 'PICK_UP_ITEM', actorId: playerId });
  } else if (ev.key === 'z' || ev.key === 'Z') {
    ev.preventDefault();
    if (params.onTogglePosture) {
      params.onTogglePosture();
    } else {
      const cur = params.currentPosture ?? 'STANDING';
      const next = cur === 'STANDING' ? 'CROUCHED' : cur === 'CROUCHED' ? 'BRACED' : 'STANDING';
      onCommand({ type: 'SET_POSTURE', actorId: playerId, posture: next });
    }
  } else if ((ev.key === 'n' || ev.key === 'N') && onOpenCharacterCreator) {
    ev.preventDefault();
    onOpenCharacterCreator();
  }
}
