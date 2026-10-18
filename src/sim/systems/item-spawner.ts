import { EntityRecord } from '../../schemas/components.schema.js';
import { EntityId, EntityIdSchema, Point2D, StratumIdSchema } from '../../schemas/primitives.schema.js';
import { SeededRNG } from '../core/rng.js';
import { WorldState } from '../core/world.js';
import { createItemEntity, ITEM_CATALOG } from '../data/item-catalog.js';
import { pointKey } from '../spatial/fov.js';

export const DEFAULT_ITEMS_PER_STRATUM = 4;

export interface SpawnDistrictItemsResult {
  readonly state: WorldState;
  readonly spawnedItemIds: readonly EntityId[];
}

/**
 * Deterministically scatters ground items across every stratum using the world's SeededRNG.
 * Items only land on walkable tiles not already occupied by another positioned entity,
 * and are chosen by `spawnWeight` from blueprints whose `spawnStrata` include that stratum.
 * Call once after `generateVictorianDistrict` (world-gen time, before turn 1).
 */
export function spawnDistrictItems(
  state: WorldState,
  itemsPerStratum = DEFAULT_ITEMS_PER_STRATUM,
): SpawnDistrictItemsResult {
  const rng = new SeededRNG(state.rngState);
  const entities: Record<string, EntityRecord> = { ...state.entities };
  const spawnedItemIds: EntityId[] = [];

  for (const stratum of StratumIdSchema.options) {
    const grid = state.strata[stratum];
    if (!grid) continue;

    const pool = ITEM_CATALOG.filter((bp) => bp.spawnWeight > 0 && bp.spawnStrata.includes(stratum));
    const totalWeight = pool.reduce((sum, bp) => sum + bp.spawnWeight, 0);
    if (pool.length === 0 || totalWeight <= 0) continue;

    const occupied = new Set<string>();
    for (const e of Object.values(entities)) {
      if (e.position?.stratum === stratum) occupied.add(pointKey(e.position.x, e.position.y));
    }

    const openTiles: Point2D[] = [];
    for (let y = 0; y < grid.height; y++) {
      for (let x = 0; x < grid.width; x++) {
        const cell = grid.cells[y * grid.width + x];
        if (cell && !cell.blocksMovement && !occupied.has(pointKey(x, y))) {
          openTiles.push({ x, y });
        }
      }
    }

    for (let n = 0; n < itemsPerStratum && openTiles.length > 0; n++) {
      const [tile] = openTiles.splice(rng.nextInt(0, openTiles.length - 1), 1);
      if (!tile) break;

      let roll = rng.nextInt(0, totalWeight - 1);
      const blueprint = pool.find((bp) => (roll -= bp.spawnWeight) < 0) ?? pool[0];
      if (!blueprint) break;

      const quantity = blueprint.stackable ? rng.nextInt(1, blueprint.spawnQuantityMax) : 1;
      const id = EntityIdSchema.parse(`item_${blueprint.id}_${stratum.toLowerCase()}_${n}`);
      entities[id] = createItemEntity(blueprint, id, quantity, { x: tile.x, y: tile.y, stratum });
      spawnedItemIds.push(id);
    }
  }

  return {
    state: { ...state, rngState: rng.getState(), entities },
    spawnedItemIds,
  };
}
