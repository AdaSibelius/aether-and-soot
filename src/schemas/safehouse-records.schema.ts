import { z } from 'zod';
import { EntityIdSchema, StratumIdSchema } from './primitives.schema.js';
import { CodexCategorySchema } from './safehouse-events.schema.js';

export const SafehouseDeedRecordSchema = z.object({
  deedId: z.string(),
  name: z.string(),
  ownerId: EntityIdSchema,
  stratum: StratumIdSchema,
  bounds: z.object({
    xMin: z.number().int(),
    xMax: z.number().int(),
    yMin: z.number().int(),
    yMax: z.number().int(),
  }),
  isVault: z.boolean().default(false),
  claimedTurn: z.number().int().nonnegative(),
});
export type SafehouseDeedRecord = z.infer<typeof SafehouseDeedRecordSchema>;

export const CodexEntryRecordSchema = z.object({
  id: z.string(),
  category: CodexCategorySchema,
  title: z.string(),
  description: z.string(),
  discoveredTurn: z.number().int().nonnegative(),
  tags: z.array(z.string()).default([]),
});
export type CodexEntryRecord = z.infer<typeof CodexEntryRecordSchema>;
