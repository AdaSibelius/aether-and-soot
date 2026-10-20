import { EntityRecord } from '../../schemas/components.schema.js';
import { WorldState } from '../core/world.js';

/**
 * Checks whether an actor benefits from sterile surgical conditions.
 * Granted by having the DISGRACED_CHIRURGEON profession/trait or being
 * adjacent to a SURGICAL_TABLE furniture fixture.
 */
export function hasSurgicalBonus(state: WorldState, actor: EntityRecord): boolean {
  if (actor.profession === 'DISGRACED_CHIRURGEON') return true;
  if (actor.traits && (actor.traits as readonly string[]).includes('DISGRACED_CHIRURGEON')) return true;
  if (!actor.position) return false;
  const { x, y, stratum } = actor.position;
  return Object.values(state.entities).some((e) => {
    if (e.furniture?.kind !== 'SURGICAL_TABLE' || !e.position) return false;
    if (e.position.stratum !== stratum) return false;
    return Math.max(Math.abs(e.position.x - x), Math.abs(e.position.y - y)) <= 1;
  });
}

/**
 * Computes effective FOV bonus granted by installed optic prosthetics.
 */
export function computeProstheticFovBonus(state: Readonly<WorldState>, actor: EntityRecord): number {
  if (!actor.anatomy) return 0;
  let bonus = 0;
  for (const limb of Object.values(actor.anatomy.limbs)) {
    if (!limb?.installedProstheticEntityId) continue;
    const item = state.entities[limb.installedProstheticEntityId];
    if (item?.prostheticSpec) {
      bonus += item.prostheticSpec.fovRadiusBonus;
    }
  }
  return bonus;
}
