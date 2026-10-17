import { EntityRecord } from '../../schemas/components.schema.js';
import { Point3D } from '../../schemas/primitives.schema.js';
import { findEntitiesAtPoint } from './grid.js';

/**
 * Finds an active portal entity at the given 3D coordinate.
 */
export function findPortalAtPoint(
  entities: Readonly<Record<string, EntityRecord>>,
  point: Point3D,
): EntityRecord | undefined {
  const candidates = findEntitiesAtPoint(entities, point);
  return candidates.find((e) => e.portal !== undefined);
}
