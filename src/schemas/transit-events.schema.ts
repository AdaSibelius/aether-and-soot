import { z } from 'zod';
import { BlueprintIdSchema, EntityIdSchema } from './primitives.schema.js';

export const MonorailBoardedEventSchema = z.object({
  type: z.literal('MONORAIL_BOARDED'),
  turn: z.number().int().nonnegative(),
  actorId: EntityIdSchema,
  monorailEntityId: EntityIdSchema,
  passengersCount: z.number().int().positive(),
});
export type MonorailBoardedEvent = z.infer<typeof MonorailBoardedEventSchema>;

export const MonorailLaunchedEventSchema = z.object({
  type: z.literal('MONORAIL_LAUNCHED'),
  turn: z.number().int().nonnegative(),
  actorId: EntityIdSchema,
  monorailEntityId: EntityIdSchema,
  destinationDistrictId: BlueprintIdSchema,
  speedMph: z.number().nonnegative(),
  steamPressureKpa: z.number().nonnegative(),
});
export type MonorailLaunchedEvent = z.infer<typeof MonorailLaunchedEventSchema>;

export const MonorailArrivedEventSchema = z.object({
  type: z.literal('MONORAIL_ARRIVED'),
  turn: z.number().int().nonnegative(),
  monorailEntityId: EntityIdSchema,
  destinationDistrictId: BlueprintIdSchema,
  passengers: z.array(EntityIdSchema),
});
export type MonorailArrivedEvent = z.infer<typeof MonorailArrivedEventSchema>;

export const CatacombsDepthDescendedEventSchema = z.object({
  type: z.literal('CATACOMBS_DEPTH_DESCENDED'),
  turn: z.number().int().nonnegative(),
  actorId: EntityIdSchema,
  fromDepth: z.number().int().nonnegative(),
  toDepth: z.number().int().positive(),
  tierName: z.string(),
});
export type CatacombsDepthDescendedEvent = z.infer<typeof CatacombsDepthDescendedEventSchema>;

export const TransitActionFailedEventSchema2 = z.object({
  type: z.literal('MONORAIL_ACTION_FAILED'),
  turn: z.number().int().nonnegative(),
  actorId: EntityIdSchema,
  reason: z.string(),
});
export type MonorailActionFailedEvent = z.infer<typeof TransitActionFailedEventSchema2>;
