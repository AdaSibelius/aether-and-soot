import { EntityRecord } from '../../schemas/components.schema.js';
import { SimEvent } from '../../schemas/events.schema.js';
import { EntityIdSchema } from '../../schemas/primitives.schema.js';
import { WorldState } from '../core/world.js';
import { findBlockingEntityAtPoint, getTileCell, isWithinBounds, StratumGrid } from '../spatial/grid.js';
import { resolveDamageLimb } from './anatomy.system.js';
import { resolveActorDefeatIfFatal } from './mortality.system.js';
import { emitAcousticPulse } from './stealth-acoustics.system.js';

export interface AbyssFallResult {
  readonly state: WorldState;
  readonly events: SimEvent[];
}

/**
 * Searches Chebyshev radius 1-2 around (nx, ny) for the nearest walkable, unblocked cell on STREET.
 */
function findNearestWalkableLanding(
  state: WorldState,
  grid: StratumGrid,
  cx: number,
  cy: number,
): { x: number; y: number } | null {
  if (isWithinBounds(grid, cx, cy)) {
    const cell = getTileCell(grid, cx, cy);
    if (cell && !cell.blocksMovement && !findBlockingEntityAtPoint(state.entities, { x: cx, y: cy, stratum: 'STREET' })) {
      return { x: cx, y: cy };
    }
  }

  for (let r = 1; r <= 2; r++) {
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
        const tx = cx + dx;
        const ty = cy + dy;
        if (!isWithinBounds(grid, tx, ty)) continue;
        const cell = getTileCell(grid, tx, ty);
        if (cell && !cell.blocksMovement && !findBlockingEntityAtPoint(state.entities, { x: tx, y: ty, stratum: 'STREET' })) {
          return { x: tx, y: ty };
        }
      }
    }
  }

  return null;
}

/**
 * Resolves gravity fall from SPIRE abyss chasm to STREET with impact landing validation.
 */
export function resolveAbyssGravityFall(
  state: WorldState,
  actor: EntityRecord,
  nx: number,
  ny: number,
  turn: number,
): AbyssFallResult {
  const actorId = actor.id;
  const streetGrid = state.strata.STREET;
  if (!streetGrid) return { state, events: [] };

  const landing = findNearestWalkableLanding(state, streetGrid, nx, ny);
  let workingState = state;
  const fallEvents: SimEvent[] = [];

  let legDmg = 20;
  let steamSpent = 0;
  const hasPneumaticLeg = Object.values(actor.anatomy?.limbs ?? {}).some((l) => {
    if (!l.installedProstheticEntityId) return false;
    const p = workingState.entities[l.installedProstheticEntityId];
    return p?.prostheticSpec?.blueprintId.includes('pneumatic');
  });

  if (hasPneumaticLeg && (actor.anatomy?.steamReserveKpa ?? 0) >= 15) {
    legDmg = 10;
    steamSpent = 15;
  }

  if (landing) {
    const updatedActor: EntityRecord = {
      ...actor,
      position: { x: landing.x, y: landing.y, stratum: 'STREET', blocksMovement: true, blocksSight: false },
      anatomy: actor.anatomy
        ? { ...actor.anatomy, steamReserveKpa: Math.max(0, actor.anatomy.steamReserveKpa - steamSpent) }
        : undefined,
    };
    workingState = { ...workingState, entities: { ...workingState.entities, [actorId]: updatedActor } };

    const lDmg = resolveDamageLimb(workingState, actorId, 'LEFT_LEG', legDmg);
    workingState = lDmg.state;
    fallEvents.push(...lDmg.events);

    const rDmg = resolveDamageLimb(workingState, actorId, 'RIGHT_LEG', legDmg);
    workingState = rDmg.state;
    fallEvents.push(...rDmg.events);

    const defeat = resolveActorDefeatIfFatal(workingState, actorId);
    workingState = defeat.state;
    fallEvents.push(...defeat.events);

    fallEvents.unshift({
      type: 'ACTOR_FELL_STRATUM',
      turn,
      actorId,
      fromStratum: 'SPIRE',
      toStratum: 'STREET',
      impactDamage: legDmg * 2,
    });

    const impactNoise = emitAcousticPulse(workingState, { x: landing.x, y: landing.y, stratum: 'STREET' }, 75, turn, actorId);
    return { state: impactNoise.state, events: [...fallEvents, ...impactNoise.events] };
  }

  // Lethal impact if no valid landing cell
  const updatedActor: EntityRecord = {
    ...actor,
    position: { x: nx, y: ny, stratum: 'STREET', blocksMovement: false, blocksSight: false },
    anatomy: actor.anatomy ? { ...actor.anatomy, bloodVolumePct: 0 } : undefined,
  };
  workingState = { ...workingState, entities: { ...workingState.entities, [actorId]: updatedActor } };

  const lethalTorso = resolveDamageLimb(workingState, actorId, 'TORSO', 999);
  workingState = lethalTorso.state;
  fallEvents.push(...lethalTorso.events);

  const defeat = resolveActorDefeatIfFatal(workingState, actorId);
  workingState = defeat.state;
  fallEvents.push(...defeat.events);

  const corpseDropId = EntityIdSchema.parse(`corpse_${actorId}_t${turn}`);
  if (!workingState.entities[corpseDropId]) {
    const corpseEntity: EntityRecord = {
      id: corpseDropId,
      name: `Mangled Corpse of ${actor.name}`,
      visual: { glyph: '%', fgPrimary: '#99A3A4', fgSecondary: '#5D6D7E', bgColor: '#0A0D0E', shaderFlags: [] },
      position: { x: nx, y: ny, stratum: 'STREET', blocksMovement: false, blocksSight: false },
      anatomy: actor.anatomy ? { ...actor.anatomy, bloodVolumePct: 0 } : undefined,
    };
    workingState = { ...workingState, entities: { ...workingState.entities, [corpseDropId]: corpseEntity } };
  }

  fallEvents.unshift({
    type: 'ACTOR_FELL_STRATUM',
    turn,
    actorId,
    fromStratum: 'SPIRE',
    toStratum: 'STREET',
    impactDamage: 999,
  });

  const impactNoise = emitAcousticPulse(workingState, { x: nx, y: ny, stratum: 'STREET' }, 90, turn, actorId);
  return { state: impactNoise.state, events: [...fallEvents, ...impactNoise.events] };
}
