import { EntityRecord } from '../../schemas/components.schema.js';
import { EntityId } from '../../schemas/primitives.schema.js';
import { StratumGrid } from './grid.js';
import { WorldState } from '../core/world.js';

export type CatacombDepthsMap = Record<string, { grid: StratumGrid; entities: Record<string, EntityRecord> }>;

export function snapshotFloor(
  state: WorldState,
  depth: number,
  actorId: EntityId,
): CatacombDepthsMap {
  const depths: CatacombDepthsMap = { ...(state.catacombDepths ?? {}) };
  if (depth > 0 && state.strata.CATACOMBS) {
    const currentFloorEntities: Record<string, EntityRecord> = {};
    for (const [id, ent] of Object.entries(state.entities)) {
      if (ent.position?.stratum === 'CATACOMBS' && id !== actorId) {
        currentFloorEntities[id] = ent;
      }
    }
    depths[String(depth)] = {
      grid: state.strata.CATACOMBS,
      entities: currentFloorEntities,
    };
  }
  return depths;
}

export function filterNonCatacombsEntities(
  entities: Record<string, EntityRecord>,
): Record<string, EntityRecord> {
  const remaining: Record<string, EntityRecord> = {};
  for (const [id, ent] of Object.entries(entities)) {
    if (ent.position?.stratum !== 'CATACOMBS') {
      remaining[id] = ent;
    }
  }
  return remaining;
}
