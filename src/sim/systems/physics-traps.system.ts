import { EntityRecord } from '../../schemas/components.schema.js';
import { SimEvent } from '../../schemas/events.schema.js';
import { EntityId, Point3D } from '../../schemas/primitives.schema.js';
import { STANDARD_ACTION_AP } from '../core/scheduler.js';
import { WorldState } from '../core/world.js';
import { getTileCell, isWithinBounds, setTileCell } from '../spatial/grid.js';
import { resolveDamageLimb } from './anatomy.system.js';
import { resolveActorDefeatIfFatal } from './mortality.system.js';
import { resolveEmitSpark } from './pressure.system.js';
import { emitAcousticPulse } from './stealth-acoustics.system.js';

export interface PhysicsTrapResult {
  readonly state: WorldState;
  readonly events: SimEvent[];
  readonly apSpent: number;
}

/**
 * Breaches a SOOT_BRICK_WALL into a passable RUBBLE_PILE, enabling steam and entities to pass through.
 */
export function resolveBreachTile(
  state: WorldState,
  target: Point3D,
  turn: number,
  breachSource: 'EXPLOSION' | 'PILEDRIVER' = 'EXPLOSION',
): { readonly state: WorldState; readonly events: SimEvent[]; readonly breached: boolean } {
  const grid = state.strata[target.stratum];
  if (!grid || !isWithinBounds(grid, target.x, target.y)) return { state, events: [], breached: false };

  const cell = getTileCell(grid, target.x, target.y);
  if (!cell || cell.terrainType !== 'SOOT_BRICK_WALL') return { state, events: [], breached: false };

  const nextGrid = setTileCell(grid, target.x, target.y, (c) => ({
    ...c, terrainType: 'RUBBLE_PILE', blocksMovement: false, blocksSight: false,
  }));
  const breachEvent: SimEvent = { type: 'WALL_BREACHED', turn, target, breachSource };
  const nextState: WorldState = { ...state, strata: { ...state.strata, [target.stratum]: nextGrid } };
  const pulse = emitAcousticPulse(nextState, target, breachSource === 'EXPLOSION' ? 95 : 85, turn);

  return { state: pulse.state, events: [breachEvent, ...pulse.events], breached: true };
}

/**
 * Pushes an actor 1 tile; if pushed onto an ABYSS_DROP in SPIRE, plummets to STREET with leg trauma.
 */
export function resolveKnockbackAndGravityFall(
  state: WorldState,
  actorId: EntityId,
  dx: number,
  dy: number,
  turn: number,
): PhysicsTrapResult {
  const actor = state.entities[actorId];
  if (!actor?.position) return { state, events: [], apSpent: 0 };

  const currentStratum = actor.position.stratum;
  const grid = state.strata[currentStratum];
  if (!grid) return { state, events: [], apSpent: 0 };

  const nx = actor.position.x + dx;
  const ny = actor.position.y + dy;
  if (!isWithinBounds(grid, nx, ny)) return { state, events: [], apSpent: 0 };
  const destCell = getTileCell(grid, nx, ny);

  // Multi-strata gravity fall from SPIRE abyss chasm to STREET
  if (currentStratum === 'SPIRE' && destCell?.terrainType === 'ABYSS_DROP') {
    let workingState = state;
    const fallEvents: SimEvent[] = [];

    // Check for pneumatic leg shock absorption
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

    const updatedActor: EntityRecord = {
      ...actor,
      position: { ...actor.position, stratum: 'STREET', x: nx, y: ny },
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
      type: 'ACTOR_FELL_STRATUM', turn, actorId,
      fromStratum: 'SPIRE', toStratum: 'STREET', impactDamage: legDmg * 2,
    });

    const impactNoise = emitAcousticPulse(workingState, { x: nx, y: ny, stratum: 'STREET' }, 75, turn, actorId);
    return { state: impactNoise.state, events: [...fallEvents, ...impactNoise.events], apSpent: 0 };
  }

  // Normal displacement if walkable
  if (destCell && !destCell.blocksMovement) {
    const updatedActor: EntityRecord = { ...actor, position: { ...actor.position, x: nx, y: ny } };
    return {
      state: { ...state, entities: { ...state.entities, [actorId]: updatedActor } },
      events: [{ type: 'ENTITY_MOVED', turn, actorId, from: actor.position, to: { x: nx, y: ny, stratum: currentStratum }, apSpent: 0 }],
      apSpent: 0,
    };
  }

  return { state, events: [], apSpent: 0 };
}

/**
 * Triggers any armed clockwork traps located at the destination point when stepped on.
 */
export function resolveStepOnTraps(
  state: WorldState,
  actorId: EntityId,
  point: Point3D,
  turn: number,
): PhysicsTrapResult {
  let workingState = state;
  const trapEvents: SimEvent[] = [];

  const traps = Object.values(workingState.entities).filter(
    (e) => e.trap?.armed && e.position?.stratum === point.stratum && e.position.x === point.x && e.position.y === point.y,
  );

  for (const trapEnt of traps) {
    if (!trapEnt.trap) continue;
    const kind = trapEnt.trap.trapKind;
    const dmg = trapEnt.trap.damageMagnitude;

    workingState = {
      ...workingState,
      entities: { ...workingState.entities, [trapEnt.id]: { ...trapEnt, trap: { ...trapEnt.trap, armed: false } } },
    };

    trapEvents.push({
      type: 'TRAP_TRIGGERED', turn, trapEntityId: trapEnt.id, trapKind: kind, victimActorId: actorId, at: point,
    });

    if (kind === 'SPARK_TRIPWIRE') {
      const sparkRes = resolveEmitSpark(workingState, point);
      workingState = sparkRes.state;
      trapEvents.push(...sparkRes.events);
    } else if (kind === 'SPRING_JAW') {
      const jawRes = resolveDamageLimb(workingState, actorId, 'LEFT_LEG', dmg);
      workingState = jawRes.state;
      trapEvents.push(...jawRes.events);
    } else if (kind === 'STEAM_MINE') {
      const scaldDmg = resolveDamageLimb(workingState, actorId, 'TORSO', dmg);
      workingState = scaldDmg.state;
      trapEvents.push(...scaldDmg.events);
    }
  }

  return { state: workingState, events: trapEvents, apSpent: 0 };
}

/**
 * Command resolution for BREACH_TILE using an installed piledriver arm.
 */
export function resolveBreachCommand(
  state: WorldState,
  actorId: EntityId,
  target: Point3D,
): PhysicsTrapResult {
  const actor = state.entities[actorId];
  if (!actor?.position) return { state, events: [], apSpent: STANDARD_ACTION_AP };

  const hasPiledriver = Object.values(actor.anatomy?.limbs ?? {}).some((l) => {
    if (!l.installedProstheticEntityId) return false;
    const p = state.entities[l.installedProstheticEntityId];
    return p?.prostheticSpec?.blueprintId.includes('piledriver');
  });

  if (!hasPiledriver) return { state, events: [], apSpent: STANDARD_ACTION_AP };
  const dist = Math.max(Math.abs(actor.position.x - target.x), Math.abs(actor.position.y - target.y));
  if (dist > 1) return { state, events: [], apSpent: STANDARD_ACTION_AP };

  const res = resolveBreachTile(state, target, state.turnCount + 1, 'PILEDRIVER');
  return { state: res.state, events: res.events, apSpent: STANDARD_ACTION_AP };
}
