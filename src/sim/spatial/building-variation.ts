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

  // 1. Randomized internal room partition variation
  const partitionJitter = rng.nextInt(-1, 1);
  if (partitionJitter !== 0 && rooms.length >= 2) {
    const r0 = rooms[0]!;
    const r1 = rooms[1]!;
    // If rooms share horizontal boundary, shift it
    if (r0.y2 === r1.y1 - 1 && r0.y2 + partitionJitter > r0.y1 + 1 && r1.y1 + partitionJitter < r1.y2 - 1) {
      rooms[0] = { ...r0, y2: r0.y2 + partitionJitter };
      rooms[1] = { ...r1, y1: r1.y1 + partitionJitter };
    }
  }

  // 2. Optional additional annex/alcove room (scaling room count up to 4-5)
  if (optionalExtraRoom && rng.nextFloat() > 0.3) {
    rooms.push(optionalExtraRoom);
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
