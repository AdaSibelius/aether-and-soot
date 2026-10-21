import { EntityRecord } from '../../schemas/components.schema.js';
import { SimEvent } from '../../schemas/events.schema.js';
import { EntityId, Point3D } from '../../schemas/primitives.schema.js';
import { WorldState } from '../core/world.js';
import { setTileCell } from '../spatial/grid.js';
import { resolveDamageLimb } from './anatomy.system.js';
import { resolveActorDefeatIfFatal } from './mortality.system.js';
import { emitAcousticPulse } from './stealth-acoustics.system.js';

export interface TraumaResolutionResult {
  readonly state: WorldState;
  readonly events: SimEvent[];
}

export function handleWallImpact(
  state: WorldState,
  targetId: EntityId,
  impactPos: Point3D,
  remainingTiles: number,
  turn: number,
): TraumaResolutionResult {
  const events: SimEvent[] = [];
  const dmg = Math.max(6, remainingTiles * 6);
  const dmgRes = resolveDamageLimb(state, targetId, 'TORSO', dmg);
  let workingState = dmgRes.state;
  events.push(...dmgRes.events);

  const defeat = resolveActorDefeatIfFatal(workingState, targetId);
  workingState = defeat.state;
  events.push(...defeat.events);

  events.push({
    type: 'MOMENTUM_COLLISION_IMPACT',
    turn,
    primaryEntityId: targetId,
    impactPosition: impactPos,
    obstacleType: 'WALL',
    impactVelocity: remainingTiles,
    damageInflicted: dmg,
  });

  const pulse = emitAcousticPulse(workingState, impactPos, 65 + dmg, turn, targetId);
  return { state: pulse.state, events: [...events, ...pulse.events] };
}

export function handleEntityCollision(
  state: WorldState,
  targetId: EntityId,
  otherId: EntityId,
  impactPos: Point3D,
  remainingTiles: number,
  turn: number,
): TraumaResolutionResult {
  const events: SimEvent[] = [];
  const dmg = Math.max(4, remainingTiles * 4);

  const dmgT = resolveDamageLimb(state, targetId, 'TORSO', dmg);
  let workingState = dmgT.state;
  events.push(...dmgT.events);
  const defT = resolveActorDefeatIfFatal(workingState, targetId);
  workingState = defT.state;
  events.push(...defT.events);

  const dmgO = resolveDamageLimb(workingState, otherId, 'TORSO', dmg);
  workingState = dmgO.state;
  events.push(...dmgO.events);
  const defO = resolveActorDefeatIfFatal(workingState, otherId);
  workingState = defO.state;
  events.push(...defO.events);

  events.push({
    type: 'MOMENTUM_COLLISION_IMPACT',
    turn,
    primaryEntityId: targetId,
    impactPosition: impactPos,
    obstacleType: 'ENTITY',
    collidedWithEntityId: otherId,
    impactVelocity: remainingTiles,
    damageInflicted: dmg,
  });

  const pulse = emitAcousticPulse(workingState, impactPos, 60 + dmg, turn, targetId);
  return { state: pulse.state, events: [...events, ...pulse.events] };
}

export function handleWindowShatter(
  state: WorldState,
  targetId: EntityId,
  windowPos: Point3D,
  remainingTiles: number,
  turn: number,
): TraumaResolutionResult {
  const events: SimEvent[] = [];
  const grid = state.strata[windowPos.stratum];
  if (!grid) return { state, events };

  const nextGrid = setTileCell(grid, windowPos.x, windowPos.y, (c) => ({
    ...c,
    terrainType: 'SMASHED_WINDOW_FRAME',
    blocksMovement: false,
    blocksSight: false,
  }));
  let workingState: WorldState = { ...state, strata: { ...state.strata, [windowPos.stratum]: nextGrid } };

  events.push({
    type: 'TERRAIN_SMASHED',
    turn,
    actorId: targetId,
    target: windowPos,
    fromTerrain: 'GLASS_WINDOW',
    toTerrain: 'SMASHED_WINDOW_FRAME',
  });

  const glassPulse = emitAcousticPulse(workingState, windowPos, 85, turn, targetId);
  workingState = glassPulse.state;
  events.push(...glassPulse.events);

  const laceration = resolveDamageLimb(workingState, targetId, 'TORSO', 5);
  workingState = laceration.state;
  events.push(...laceration.events);

  events.push({
    type: 'MOMENTUM_COLLISION_IMPACT',
    turn,
    primaryEntityId: targetId,
    impactPosition: windowPos,
    obstacleType: 'WINDOW',
    impactVelocity: remainingTiles,
    damageInflicted: 5,
  });

  return { state: workingState, events };
}

export function handleAbyssGravityFall(
  state: WorldState,
  targetId: EntityId,
  nx: number,
  ny: number,
  turn: number,
): TraumaResolutionResult {
  const target = state.entities[targetId];
  if (!target) return { state, events: [] };

  const events: SimEvent[] = [];
  let legDmg = 20;
  let steamSpent = 0;
  const hasPneumaticLeg = Object.values(target.anatomy?.limbs ?? {}).some((l) => {
    if (!l.installedProstheticEntityId) return false;
    const p = state.entities[l.installedProstheticEntityId];
    return p?.prostheticSpec?.blueprintId.includes('pneumatic');
  });

  if (hasPneumaticLeg && (target.anatomy?.steamReserveKpa ?? 0) >= 15) {
    legDmg = 10;
    steamSpent = 15;
  }

  const updatedActor: EntityRecord = {
    ...target,
    position: { x: nx, y: ny, stratum: 'STREET', blocksMovement: true, blocksSight: false },
    anatomy: target.anatomy
      ? { ...target.anatomy, steamReserveKpa: Math.max(0, target.anatomy.steamReserveKpa - steamSpent) }
      : undefined,
  };
  let workingState: WorldState = { ...state, entities: { ...state.entities, [targetId]: updatedActor } };

  const lDmg = resolveDamageLimb(workingState, targetId, 'LEFT_LEG', legDmg);
  workingState = lDmg.state;
  events.push(...lDmg.events);

  const rDmg = resolveDamageLimb(workingState, targetId, 'RIGHT_LEG', legDmg);
  workingState = rDmg.state;
  events.push(...rDmg.events);

  const defeat = resolveActorDefeatIfFatal(workingState, targetId);
  workingState = defeat.state;
  events.push(...defeat.events);

  events.push({
    type: 'ACTOR_FELL_STRATUM',
    turn,
    actorId: targetId,
    fromStratum: 'SPIRE',
    toStratum: 'STREET',
    impactDamage: legDmg * 2,
  });

  const pulse = emitAcousticPulse(workingState, { x: nx, y: ny, stratum: 'STREET' }, 75, turn, targetId);
  return { state: pulse.state, events: [...events, ...pulse.events] };
}
