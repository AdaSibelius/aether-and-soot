import { EntityRecord } from '../../schemas/components.schema.js';
import { EntityId, EntityIdSchema, Point2D } from '../../schemas/primitives.schema.js';
import { createEntityFromBlueprint } from '../data/item-catalog.js';
import { SeededRNG } from '../core/rng.js';
import { placeArchitecturalFeature } from './architectural-features.js';
import { MultiRoomBuildingSpec, RoomZoneDefinition } from './interior-zoning.js';
import { StratumGrid } from './grid.js';

export function seedContainer(
  entities: Record<string, EntityRecord>,
  items: readonly { id: string; blueprintId: string; quantity: number }[],
): EntityRecord['inventory'] {
  const containedEntityIds: EntityId[] = [];
  let totalMass = 0;
  for (const it of items) {
    const eid = EntityIdSchema.parse(it.id);
    const created = createEntityFromBlueprint(it.blueprintId, eid, it.quantity);
    if (created) {
      entities[eid] = created;
      containedEntityIds.push(eid);
      totalMass += (created.item?.massGrams ?? 0) * (created.item?.quantity ?? 1);
    }
  }
  return { containedEntityIds, currentMassGrams: totalMass, maxMassGrams: 50000, maxVolumeMl: 50000 };
}

export interface VariedBuildingPlan {
  readonly spec: MultiRoomBuildingSpec;
  readonly chimneyPos?: Point2D;
  readonly exteriorPipePos?: Point2D;
}

/**
 * Parameterizes building footprints and interior zoning with SeededRNG room counts (2 to 5 rooms),
 * randomized internal partition splits, and exterior chimney/pipe attachments to prevent visual stamping.
 */
export function createVariedBuildingPlan(
  baseSpec: MultiRoomBuildingSpec,
  rng?: SeededRNG,
  optionalExtraRoom?: RoomZoneDefinition,
): VariedBuildingPlan {
  if (!rng) {
    return { spec: baseSpec };
  }

  const rooms: RoomZoneDefinition[] = [...baseSpec.rooms];
  let interiorDoors: Point2D[] = [...baseSpec.interiorDoors];

  // 1. Optional additional annex/alcove room (scaling room count up to 4-5)
  if (optionalExtraRoom && rng.nextFloat() > 0.3) {
    rooms.push(optionalExtraRoom);
  }

  // 2. Randomized internal room partition variation (shifts all rooms & interiorDoors on wallY in lockstep — AUD-01)
  const partitionJitter = rng.nextInt(-1, 1);
  if (partitionJitter !== 0 && rooms.length >= 2) {
    const r0 = rooms[0]!;
    const r1 = rooms[1]!;
    const wallYMin = Math.min(r0.y2, r1.y2) + 1;
    const wallYMax = Math.max(r0.y1, r1.y1) - 1;
    if (wallYMin === wallYMax) {
      const wallY = wallYMin;
      const canShift = rooms.every((r) => {
        if (r.y2 === wallY - 1) return r.y2 + partitionJitter > r.y1 + 1;
        if (r.y1 === wallY + 1) return r.y1 + partitionJitter < r.y2 - 1;
        return true;
      });
      if (canShift) {
        for (let i = 0; i < rooms.length; i++) {
          const r = rooms[i]!;
          if (r.y2 === wallY - 1) rooms[i] = { ...r, y2: r.y2 + partitionJitter };
          else if (r.y1 === wallY + 1) rooms[i] = { ...r, y1: r.y1 + partitionJitter };
        }
        const shiftedWallY = wallY + partitionJitter;
        interiorDoors = interiorDoors.map((d) => (d.y === wallY ? { x: d.x, y: shiftedWallY } : d));
      }
    }
  }

  // 3. Compute exterior attachment positions (chimney and steam pipe)
  const chimneyX = Math.min(baseSpec.x2 - 1, baseSpec.x1 + 1 + rng.nextInt(0, 2));
  const chimneyY = baseSpec.y1;
  const chimneyPos: Point2D = { x: chimneyX, y: chimneyY };

  const pipeX = baseSpec.x2;
  const pipeY = Math.min(baseSpec.y2 - 1, baseSpec.y1 + 2 + rng.nextInt(0, 2));
  const exteriorPipePos: Point2D = { x: pipeX, y: pipeY };

  return {
    spec: {
      ...baseSpec,
      rooms,
      interiorDoors,
    },
    chimneyPos,
    exteriorPipePos,
  };
}

/**
 * Applies architectural attachments (chimney flue, exterior steam pipe) to the stratum grid.
 */
export function applyBuildingAttachments(
  grid: StratumGrid,
  plan: VariedBuildingPlan,
): StratumGrid {
  let updated = grid;
  if (plan.exteriorPipePos) {
    updated = placeArchitecturalFeature(updated, plan.exteriorPipePos.x, plan.exteriorPipePos.y, 'BRASS_STEAM_PIPE');
  }
  return updated;
}
