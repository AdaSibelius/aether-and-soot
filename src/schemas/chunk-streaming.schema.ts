import { z } from 'zod';
import {
  BlueprintIdSchema,
  ChunkKey,
  ChunkKeySchema,
  EntityIdSchema,
  StratumIdSchema,
} from './primitives.schema.js';
import { EntityComponentsSchema } from './components.schema.js';
import { TileCellSchema } from '../sim/spatial/grid.js';

export const CHUNK_SIZE_X = 16;
export const CHUNK_SIZE_Y = 12;

export const ChunkCoordinateSchema = z.object({
  districtId: BlueprintIdSchema,
  stratum: StratumIdSchema,
  cx: z.number().int().nonnegative(),
  cy: z.number().int().nonnegative(),
});
export type ChunkCoordinate = z.infer<typeof ChunkCoordinateSchema>;

export const ChunkLifecycleStateSchema = z.enum(['ACTIVE', 'DORMANT', 'UNGENERATED']);
export type ChunkLifecycleState = z.infer<typeof ChunkLifecycleStateSchema>;

export const DormantChunkRecordSchema = z.object({
  chunkKey: ChunkKeySchema,
  coord: ChunkCoordinateSchema,
  lastSimulatedTurn: z.number().int().nonnegative(),
  appliedCausalTick: z.number().int().nonnegative(),
  cells: z.array(TileCellSchema),
  residentEntityIds: z.array(EntityIdSchema),
});
export type DormantChunkRecord = z.infer<typeof DormantChunkRecordSchema>;

export const ChunkStreamingLedgerSchema = z.object({
  activeWindowCenter: ChunkCoordinateSchema.optional(),
  activeChunkKeys: z.array(ChunkKeySchema).default([]),
  dormantChunks: z.record(z.string(), DormantChunkRecordSchema).default({}),
  dormantEntities: z.record(z.string(), EntityComponentsSchema).default({}),
});
export type ChunkStreamingLedger = z.infer<typeof ChunkStreamingLedgerSchema>;

export function formatChunkKey(coord: ChunkCoordinate): ChunkKey {
  return ChunkKeySchema.parse(`chunk:${coord.districtId}:${coord.stratum}:${coord.cx},${coord.cy}`);
}
