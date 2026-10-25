import { z } from 'zod';
import { EntityIdSchema, Point3DSchema } from './primitives.schema.js';

export const HazardTypeSchema = z.enum([
  'SOOT_CLOUD',
  'ACID_DRIP',
  'WHALE_OIL_CASCADE',
  'BOOBY_TRAP',
  'GASLIGHT_BURST',
]);
export type HazardType = z.infer<typeof HazardTypeSchema>;

export const HazardTriggeredEventSchema = z.object({
  type: z.literal('HAZARD_TRIGGERED'),
  turn: z.number().int().nonnegative(),
  hazardType: HazardTypeSchema,
  at: Point3DSchema,
  actorId: EntityIdSchema.optional(),
  severity: z.enum(['MINOR', 'MODERATE', 'SEVERE']),
  message: z.string().min(1),
});
export type HazardTriggeredEvent = z.infer<typeof HazardTriggeredEventSchema>;
