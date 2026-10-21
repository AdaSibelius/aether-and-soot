import { EntityRecord } from '../../schemas/components.schema.js';
import { SimEvent } from '../../schemas/events.schema.js';
import { EntityId, Point3D } from '../../schemas/primitives.schema.js';
import { WorldState } from '../core/world.js';
import { getTileCell, isWithinBounds, setTileCell } from '../spatial/grid.js';
import { resolveDamageLimb } from './anatomy.system.js';
import { resolveActorDefeatIfFatal } from './mortality.system.js';

export {
  resolveCleanSpill,
  resolveCoatWeapon,
  resolveThrowFlask,
  type LiquidResult,
} from './liquid-flasks.system.js';

/** Resolves stepping onto surface liquid pools (bleeding trails, slip hazards, acid corrosion). */
export function resolveStepOnLiquids(
  state: WorldState,
  actorId: EntityId,
  origin: Point3D,
  dest: Point3D,
  turn: number,
): { state: WorldState; events: SimEvent[]; apSpent: number } {
  const actor = state.entities[actorId];
  if (!actor) return { state, events: [], apSpent: 0 };

  let workingState = state;
  const events: SimEvent[] = [];

  // 1. Bleeding Trail: drops blood pool at origin when injured
  const isBleeding = (actor.anatomy?.bloodVolumePct ?? 100) < 100;
  if (isBleeding) {
    const oGrid = workingState.strata[origin.stratum];
    if (oGrid && isWithinBounds(oGrid, origin.x, origin.y)) {
      const oCell = getTileCell(oGrid, origin.x, origin.y);
      if (oCell && !oCell.blocksMovement) {
        const nextVol = (oCell.liquidType === 'BLOOD' ? (oCell.liquidVolumeMl ?? 0) : 0) + 150;
        const nextGrid = setTileCell(oGrid, origin.x, origin.y, (c) => ({
          ...c,
          liquidType: 'BLOOD',
          liquidVolumeMl: nextVol,
        }));
        workingState = { ...workingState, strata: { ...workingState.strata, [origin.stratum]: nextGrid } };
        events.push({
          type: 'LIQUID_SPILLED',
          turn,
          target: origin,
          liquidType: 'BLOOD',
          volumeMl: 150,
          sourceActorId: actorId,
        });
      }
    }
  }

  // 2. Destination Liquid Interaction
  const dGrid = workingState.strata[dest.stratum];
  if (!dGrid || !isWithinBounds(dGrid, dest.x, dest.y)) {
    return { state: workingState, events, apSpent: 0 };
  }

  const dCell = getTileCell(dGrid, dest.x, dest.y);
  if (!dCell) return { state: workingState, events, apSpent: 0 };

  // Slip hazard on sludge or deep whale oil
  if (dCell.liquidType === 'SLUICE_SLUDGE' || (dCell.liquidType === 'WHALE_OIL' && (dCell.liquidVolumeMl ?? 0) >= 200)) {
    events.push({ type: 'SURFACE_SLIPPED', turn, actorId, liquidType: dCell.liquidType, at: dest });
    if (actor.actor && actor.actor.posture !== 'CROUCHED') {
      const updatedActor: EntityRecord = { ...actor, actor: { ...actor.actor, posture: 'CROUCHED' } };
      workingState = { ...workingState, entities: { ...workingState.entities, [actorId]: updatedActor } };
      events.push({
        type: 'POSTURE_CHANGED',
        turn,
        actorId,
        previousPosture: actor.actor.posture ?? 'STANDING',
        newPosture: 'CROUCHED',
      });
    }
  }

  // Acid corrosion on nitric acid
  if (dCell.liquidType === 'NITRIC_ACID' && (dCell.liquidVolumeMl ?? 0) > 0) {
    const lDmg = resolveDamageLimb(workingState, actorId, 'LEFT_LEG', 4);
    workingState = lDmg.state;
    events.push(...lDmg.events);

    const rDmg = resolveDamageLimb(workingState, actorId, 'RIGHT_LEG', 4);
    workingState = rDmg.state;
    events.push(...rDmg.events);

    const defeat = resolveActorDefeatIfFatal(workingState, actorId);
    workingState = defeat.state;
    events.push(...defeat.events);

    events.push({ type: 'ACID_CORROSION_TICK', turn, targetId: actorId, damageInflicted: 8, at: dest });
  }

  return { state: workingState, events, apSpent: 0 };
}
