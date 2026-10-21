import { EntityRecord } from '../../schemas/components.schema.js';
import { SimEvent } from '../../schemas/events.schema.js';
import { EntityId, Point3D } from '../../schemas/primitives.schema.js';
import { WorldState } from '../core/world.js';
import { findEntitiesAtPoint, getTileCell, isWithinBounds } from '../spatial/grid.js';
import { resolveDamageLimb } from './anatomy.system.js';
import { resolveBreachTile, resolveKnockbackAndGravityFall } from './physics-traps.system.js';
import { emitAcousticPulse } from './stealth-acoustics.system.js';

export interface AbilityEffectResult {
  readonly state: WorldState;
  readonly events: SimEvent[];
}

export function executeProstheticAbility(
  state: WorldState,
  actor: EntityRecord,
  abilityId: string,
  turn: number,
  dir: { dx: number; dy: number },
  target?: Point3D,
  targetEntityId?: EntityId,
): AbilityEffectResult {
  let workingState = state;
  const events: SimEvent[] = [];
  const upperId = abilityId.toUpperCase();
  if (!actor.position) return { state, events };
  const { stratum, x, y } = actor.position;

  if (upperId.includes('THERMAL') || upperId.includes('OCULAR')) {
    const pulse = emitAcousticPulse(workingState, actor.position, 15, turn, actor.id);
    workingState = pulse.state;
    events.push(...pulse.events);
  } else if (upperId.includes('DASH') || upperId.includes('PNEUMATIC')) {
    const grid = workingState.strata[stratum];
    if (grid) {
      let destX = x;
      let destY = y;
      for (let step = 1; step <= 2; step++) {
        const tx = x + dir.dx * step;
        const ty = y + dir.dy * step;
        if (!isWithinBounds(grid, tx, ty)) break;
        const cell = getTileCell(grid, tx, ty);
        if (cell?.blocksMovement) break;
        const blocked = findEntitiesAtPoint(workingState.entities, { stratum, x: tx, y: ty }).some((e) => e.position?.blocksMovement);
        if (blocked) break;
        destX = tx;
        destY = ty;
      }
      if (destX !== x || destY !== y) {
        workingState = {
          ...workingState,
          entities: {
            ...workingState.entities,
            [actor.id]: {
              ...workingState.entities[actor.id]!,
              position: { ...actor.position, x: destX, y: destY },
            },
          },
        };
        events.push({ type: 'ENTITY_MOVED', turn, actorId: actor.id, from: { x, y, stratum }, to: { x: destX, y: destY, stratum }, apSpent: 0 });
      }
    }
  } else if (upperId.includes('RAM') || upperId.includes('BREACH')) {
    const tx = x + dir.dx;
    const ty = y + dir.dy;
    const targetPos: Point3D = target ?? { stratum, x: tx, y: ty };
    const breachRes = resolveBreachTile(workingState, targetPos, turn, 'PILEDRIVER');
    if (breachRes.breached) {
      workingState = breachRes.state;
      events.push(...breachRes.events);
    }
    const targetEnt = targetEntityId
      ? workingState.entities[targetEntityId]
      : findEntitiesAtPoint(workingState.entities, targetPos).find((e) => e.actor && e.id !== actor.id);
    if (targetEnt) {
      const kbRes = resolveKnockbackAndGravityFall(workingState, targetEnt.id, dir.dx, dir.dy, turn);
      workingState = kbRes.state;
      events.push(...kbRes.events);
      const dmgRes = resolveDamageLimb(workingState, targetEnt.id, 'TORSO', 20);
      workingState = dmgRes.state;
      events.push(...dmgRes.events);
    }
  }

  return { state: workingState, events };
}
