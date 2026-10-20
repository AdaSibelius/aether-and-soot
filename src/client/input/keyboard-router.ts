import { GameCommand } from '../../schemas/commands.schema.js';
import { EntityId, LimbSlotId } from '../../schemas/primitives.schema.js';
import { ModalWindowId } from '../ui/CharacterModalShell.js';

export interface KeyboardRouterParams {
  readonly playerId: EntityId;
  readonly isSystemMenuOpen: boolean;
  readonly activeModal: ModalWindowId | null;
  readonly isLookModeActive: boolean;
  readonly onToggleSystemMenu: () => void;
  readonly onCloseModal: () => void;
  readonly onCycleModal: (direction: 1 | -1) => void;
  readonly onSetModal: (modal: ModalWindowId | null) => void;
  readonly onToggleLookMode: () => void;
  readonly onMoveLookCursor: (dx: number, dy: number) => void;
  readonly onLookAttack: (slot: LimbSlotId) => void;
  readonly onLookInteract: () => void;
  readonly onToggleDoor?: () => void;
  readonly onTalk?: () => void;
  readonly onOpenCharacterCreator?: () => void;
  readonly onCommand: (cmd: GameCommand) => void;
}

export function handleGameKeydown(ev: KeyboardEvent, params: KeyboardRouterParams): void {
  const {
    playerId,
    isSystemMenuOpen,
    activeModal,
    isLookModeActive,
    onToggleSystemMenu,
    onCloseModal,
    onCycleModal,
    onSetModal,
    onToggleLookMode,
    onMoveLookCursor,
    onLookAttack,
    onLookInteract,
    onToggleDoor,
    onTalk,
    onOpenCharacterCreator,
    onCommand,
  } = params;

  if (ev.key === 'Escape') {
    ev.preventDefault();
    if (activeModal !== null) onCloseModal();
    else if (isLookModeActive) onToggleLookMode();
    else onToggleSystemMenu();
    return;
  }

  if (isSystemMenuOpen) return;

  if (activeModal !== null) {
    if (ev.key === 'Tab') {
      ev.preventDefault();
      onCycleModal(ev.shiftKey ? -1 : 1);
    } else if (ev.key === 'q' || ev.key === 'Q') {
      ev.preventDefault();
      onCycleModal(-1);
    } else if (ev.key === 'e' || ev.key === 'E') {
      ev.preventDefault();
      onCycleModal(1);
    } else if (ev.key === 'i' || ev.key === 'I') {
      ev.preventDefault();
      onSetModal(activeModal === 'INVENTORY' ? null : 'INVENTORY');
    } else if (ev.key === 'c' || ev.key === 'C') {
      ev.preventDefault();
      onSetModal(activeModal === 'WORKBENCH' ? null : 'WORKBENCH');
    } else if (ev.key === 'm' || ev.key === 'M') {
      ev.preventDefault();
      onSetModal(activeModal === 'EXCHANGE' ? null : 'EXCHANGE');
    } else if (ev.key === 'w' || ev.key === 'W') {
      ev.preventDefault();
      onSetModal(activeModal === 'ATLAS' ? null : 'ATLAS');
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
    const lookMoveMap: Record<string, { dx: number; dy: number }> = {
      ArrowUp: { dx: 0, dy: -1 },
      w: { dx: 0, dy: -1 },
      W: { dx: 0, dy: -1 },
      ArrowDown: { dx: 0, dy: 1 },
      s: { dx: 0, dy: 1 },
      S: { dx: 0, dy: 1 },
      ArrowLeft: { dx: -1, dy: 0 },
      a: { dx: -1, dy: 0 },
      A: { dx: -1, dy: 0 },
      ArrowRight: { dx: 1, dy: 0 },
      d: { dx: 1, dy: 0 },
      D: { dx: 1, dy: 0 },
    };
    const dir = lookMoveMap[ev.key];
    if (dir) {
      ev.preventDefault();
      onMoveLookCursor(dir.dx, dir.dy);
      return;
    }
    const slotMap: Record<string, LimbSlotId> = {
      '1': 'HEAD',
      '2': 'TORSO',
      '3': 'LEFT_ARM',
      '4': 'RIGHT_ARM',
      '5': 'LEFT_LEG',
      '6': 'RIGHT_LEG',
    };
    const slot = slotMap[ev.key];
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

  // Tactical Hotkeys to Open Modal Windows
  if (ev.key === 'i' || ev.key === 'I') {
    ev.preventDefault();
    onSetModal('INVENTORY');
    return;
  }
  if (ev.key === 'c' || ev.key === 'C') {
    ev.preventDefault();
    onSetModal('WORKBENCH');
    return;
  }
  if (ev.key === 'm' || ev.key === 'M') {
    ev.preventDefault();
    onSetModal('EXCHANGE');
    return;
  }
  if (ev.key === 'A') {
    ev.preventDefault();
    onSetModal('ANATOMY');
    return;
  }
  if (ev.key === 'W') {
    ev.preventDefault();
    onSetModal('ATLAS');
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

  // Standard Roguelike Movement & Actions
  const keyMap: Record<string, { dx: number; dy: number }> = {
    ArrowUp: { dx: 0, dy: -1 },
    w: { dx: 0, dy: -1 },
    ArrowDown: { dx: 0, dy: 1 },
    s: { dx: 0, dy: 1 },
    ArrowLeft: { dx: -1, dy: 0 },
    a: { dx: -1, dy: 0 },
    ArrowRight: { dx: 1, dy: 0 },
    d: { dx: 1, dy: 0 },
  };

  const move = keyMap[ev.key];
  if (move) {
    ev.preventDefault();
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
  } else if ((ev.key === 'n' || ev.key === 'N') && onOpenCharacterCreator) {
    ev.preventDefault();
    onOpenCharacterCreator();
  }
}
