import { GameCommand } from '../../schemas/commands.schema.js';
import { EntityId, LimbSlotId } from '../../schemas/primitives.schema.js';
import { WorldState } from '../../sim/core/world.js';
import { ModalWindowId } from '../ui/CharacterModalShell.js';

export interface ModalNavState {
  selectedIndex: number;
}

export function handleModalNavigationKey(
  ev: KeyboardEvent,
  activeModal: ModalWindowId,
  state: Readonly<WorldState>,
  playerId: EntityId,
  navState: ModalNavState,
  onCommand: (cmd: GameCommand) => void,
): boolean {
  const isUp = ev.key === 'ArrowUp' || ev.key === 'w' || ev.key === 'W';
  const isDown = ev.key === 'ArrowDown' || ev.key === 's' || ev.key === 'S';
  const isEnter = ev.key === 'Enter' || ev.key === ' ';

  const slotMap: Record<string, LimbSlotId> = {
    '1': 'HEAD',
    '2': 'TORSO',
    '3': 'LEFT_ARM',
    '4': 'RIGHT_ARM',
    '5': 'LEFT_LEG',
    '6': 'RIGHT_LEG',
  };

  if (activeModal === 'INVENTORY') {
    const player = state.entities[playerId];
    const items = player?.inventory?.containedEntityIds ?? [];
    if (isUp) {
      ev.preventDefault();
      navState.selectedIndex = Math.max(0, navState.selectedIndex - 1);
      return true;
    }
    if (isDown) {
      ev.preventDefault();
      navState.selectedIndex = Math.min(Math.max(0, items.length - 1), navState.selectedIndex + 1);
      return true;
    }
    if (isEnter) {
      ev.preventDefault();
      const itemId = items[navState.selectedIndex];
      if (itemId) {
        onCommand({ type: 'USE_ITEM', actorId: playerId, itemEntityId: itemId });
        return true;
      }
    }
  }

  if (activeModal === 'ANATOMY') {
    const slot = slotMap[ev.key];
    if (slot) {
      ev.preventDefault();
      const player = state.entities[playerId];
      const satchelIds = player?.inventory?.containedEntityIds ?? [];
      const prostheticInSatchel = satchelIds.find((id) => {
        const ent = state.entities[id];
        return ent?.prostheticSpec?.targetLimbSlot === slot;
      });
      if (prostheticInSatchel) {
        onCommand({
          type: 'INSTALL_PROSTHETIC',
          actorId: playerId,
          slot,
          prostheticEntityId: prostheticInSatchel,
        });
      }
      return true;
    }
  }

  return false;
}
