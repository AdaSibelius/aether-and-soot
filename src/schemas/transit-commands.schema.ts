import { z } from 'zod';
import { BlueprintIdSchema, EntityIdSchema } from './primitives.schema.js';

export const BoardMonorailCommandSchema = z.object({
  type: z.literal('BOARD_MONORAIL'),
  actorId: EntityIdSchema,
  monorailEntityId: EntityIdSchema,
});
export type BoardMonorailCommand = z.infer<typeof BoardMonorailCommandSchema>;

export const LaunchMonorailCommandSchema = z.object({
  type: z.literal('LAUNCH_MONORAIL'),
  actorId: EntityIdSchema,
  monorailEntityId: EntityIdSchema,
  destinationDistrictId: BlueprintIdSchema,
});
export type LaunchMonorailCommand = z.infer<typeof LaunchMonorailCommandSchema>;

export const DescendCatacombsCommandSchema = z.object({
  type: z.literal('DESCEND_CATACOMBS'),
  actorId: EntityIdSchema,
  stairEntityId: EntityIdSchema,
});
export type DescendCatacombsCommand = z.infer<typeof DescendCatacombsCommandSchema>;
