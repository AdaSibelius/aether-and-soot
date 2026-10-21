import { z } from 'zod';
import { EntityIdSchema, Point3DSchema } from './primitives.schema.js';
import { PostureSchema } from './components.schema.js';

export const PostureChangedEventSchema = z.object({
  type: z.literal('POSTURE_CHANGED'),
  turn: z.number().int().nonnegative(),
  actorId: EntityIdSchema,
  previousPosture: PostureSchema,
  newPosture: PostureSchema,
});
export type PostureChangedEvent = z.infer<typeof PostureChangedEventSchema>;

export const EntityKnockedBackEventSchema = z.object({
  type: z.literal('ENTITY_KNOCKED_BACK'),
  turn: z.number().int().nonnegative(),
  entityId: EntityIdSchema,
  startPosition: Point3DSchema,
  endPosition: Point3DSchema,
  distanceTraveled: z.number().int().nonnegative(),
  sourceEntityId: EntityIdSchema.optional(),
});
export type EntityKnockedBackEvent = z.infer<typeof EntityKnockedBackEventSchema>;

export const MomentumObstacleTypeSchema = z.enum([
  'WALL',
  'ENTITY',
  'WINDOW',
  'FURNITURE',
  'OTHER',
]);
export type MomentumObstacleType = z.infer<typeof MomentumObstacleTypeSchema>;

export const MomentumCollisionImpactEventSchema = z.object({
  type: z.literal('MOMENTUM_COLLISION_IMPACT'),
  turn: z.number().int().nonnegative(),
  primaryEntityId: EntityIdSchema,
  impactPosition: Point3DSchema,
  obstacleType: MomentumObstacleTypeSchema,
  collidedWithEntityId: EntityIdSchema.optional(),
  impactVelocity: z.number().nonnegative(),
  damageInflicted: z.number().nonnegative(),
});
export type MomentumCollisionImpactEvent = z.infer<typeof MomentumCollisionImpactEventSchema>;
