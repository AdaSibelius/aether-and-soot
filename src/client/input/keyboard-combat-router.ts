import { GameCommand } from '../../schemas/commands.schema.js';
import { EntityId, LimbSlotId } from '../../schemas/primitives.schema.js';
import { WorldState } from '../../sim/core/world.js';
import { findActorAtStepTarget, findAdjacentHostileActor } from '../client-interactions.js';

export const SLOT_MAP: Record<string, LimbSlotId> = {
  '1': 'HEAD',
  '2': 'TORSO',
  '3': 'LEFT_ARM',
  '4': 'RIGHT_ARM',
  '5': 'LEFT_LEG',
  '6': 'RIGHT_LEG',
};

/**
 * Handles targeted attacks against limbs or center-of-mass ('1'-'6' and 'f'/'F')
 * while in tactical look mode.
 */
export function handleLookCombatKey(
  ev: KeyboardEvent,
  onLookAttack: (slot: LimbSlotId) => void,
): boolean {
  const slot = SLOT_MAP[ev.key];
  if (slot) {
    ev.preventDefault();
    onLookAttack(slot);
    return true;
  }
  if (ev.key === 'f' || ev.key === 'F') {
    ev.preventDefault();
    onLookAttack('TORSO');
    return true;
  }
  return false;
}

/**
 * Handles quick-target combat hotkeys outside look mode when an adjacent hostile is present.
 */
export function handleAdjacentCombatKey(
  ev: KeyboardEvent,
  worldState: Readonly<WorldState>,
  playerId: EntityId,
  onCommand: (cmd: GameCommand) => void,
): boolean {
  const adjHostile = findAdjacentHostileActor(worldState, playerId);
  if (!adjHostile) return false;

  const slot = SLOT_MAP[ev.key];
  if (slot) {
    ev.preventDefault();
    onCommand({ type: 'ATTACK_ACTOR', attackerId: playerId, targetId: adjHostile.id, targetSlot: slot });
    return true;
  }
  if (ev.key === 'f' || ev.key === 'F') {
    ev.preventDefault();
    onCommand({ type: 'ATTACK_ACTOR', attackerId: playerId, targetId: adjHostile.id, targetSlot: 'TORSO' });
    return true;
  }
  return false;
}

/**
 * Resolves movement step, bumping into hostile to attack, or bumping into friendly to talk.
 */
export function handleStepOrBumpAttack(
  dx: number,
  dy: number,
  worldState: Readonly<WorldState> | undefined,
  playerId: EntityId,
  onCommand: (cmd: GameCommand) => void,
  onTalk?: ((targetNpcId: EntityId) => void) | undefined,
): void {
  if (worldState) {
    const targetActor = findActorAtStepTarget(worldState, playerId, dx, dy);
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
  onCommand({ type: 'MOVE_STEP', actorId: playerId, dx, dy });
}

