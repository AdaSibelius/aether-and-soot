import { z } from 'zod';
import { EntityIdSchema, Point3DSchema } from './primitives.schema.js';

export const ConduitRupturedEventSchema = z.object({
  type: z.literal('CONDUIT_RUPTURED'),
  turn: z.number().int().nonnegative(),
  conduitEntityId: EntityIdSchema,
  networkId: z.string(),
  origin: Point3DSchema,
  operatingPressureKpa: z.number().nonnegative(),
  maxPressureKpa: z.number().positive(),
  ventedPressureKpa: z.number().positive(),
});
export type ConduitRupturedEvent = z.infer<typeof ConduitRupturedEventSchema>;

export const ShaftTransportEventSchema = z.object({
  type: z.literal('SHAFT_TRANSPORT_COMPLETED'),
  turn: z.number().int().nonnegative(),
  shaftEntityId: EntityIdSchema,
  shaftType: z.string(),
  fromStratum: z.string(),
  toStratum: z.string(),
  transportKind: z.enum(['FLUID', 'CARGO', 'STEAM']),
  details: z.string(),
});
export type ShaftTransportEvent = z.infer<typeof ShaftTransportEventSchema>;

export const HydrologySluiceEventSchema = z.object({
  type: z.literal('HYDROLOGY_DRAINED'),
  turn: z.number().int().nonnegative(),
  channelEntityId: EntityIdSchema,
  at: Point3DSchema,
  fluidType: z.string(),
  volumeDrainedMl: z.number().nonnegative(),
  drainedIntoStratum: z.string().optional(),
});
export type HydrologySluiceEvent = z.infer<typeof HydrologySluiceEventSchema>;

export const HydrologyFloodingEventSchema = z.object({
  type: z.literal('HYDROLOGY_FLOODING'),
  turn: z.number().int().nonnegative(),
  channelEntityId: EntityIdSchema,
  at: Point3DSchema,
  fluidType: z.string(),
  volumeOverflowMl: z.number().nonnegative(),
});
export type HydrologyFloodingEvent = z.infer<typeof HydrologyFloodingEventSchema>;
