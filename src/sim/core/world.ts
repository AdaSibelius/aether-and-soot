import { z } from 'zod';
import { EntityComponentsSchema } from '../../schemas/components.schema.js';
import { SimEventSchema } from '../../schemas/events.schema.js';
import { BlueprintId, BlueprintIdSchema, StratumIdSchema } from '../../schemas/primitives.schema.js';
import { StratumGridSchema } from '../spatial/grid.js';
import { DistrictEconomyLedgerSchema,  } from '../systems/economy.system.js';
import { RNGStateSchema } from './rng.js';
import { FactionContractSchema } from '../../schemas/contracts.schema.js';
import { CodexEntryRecordSchema, SafehouseDeedRecordSchema } from '../../schemas/safehouse-records.schema.js';
import { EscortConvoyRecordSchema, GuildAuditRecordSchema, TurfSectorRecordSchema } from '../../schemas/skirmish-records.schema.js';

export const SavedDistrictSnapshotSchema = z.object({
  strata: z.object({
    UNDERCROFT: StratumGridSchema,
    STREET: StratumGridSchema,
    SPIRE: StratumGridSchema,
    CATACOMBS: StratumGridSchema.optional(),
  }),
  entities: z.record(z.string(), EntityComponentsSchema),
  lastSimulatedTurn: z.number().int().nonnegative().default(0),
  catacombDepths: z.record(z.string(), z.object({
    grid: StratumGridSchema,
    entities: z.record(z.string(), EntityComponentsSchema),
  })).optional(),
});
export type SavedDistrictSnapshot = z.infer<typeof SavedDistrictSnapshotSchema>;
export const DistrictStateSnapshotSchema = SavedDistrictSnapshotSchema;
export type DistrictStateSnapshot = SavedDistrictSnapshot;

export type ShiftPhase = 'DAWN_WHISTLE' | 'FOUNDRY_SHIFT' | 'GASLIGHT_CURFEW' | 'GRAVEYARD_WATCH';

export function getShiftPhase(turnCount: number): ShiftPhase {
  const cycleTurn = ((turnCount % 100) + 100) % 100;
  if (cycleTurn < 25) return 'DAWN_WHISTLE';
  if (cycleTurn < 50) return 'FOUNDRY_SHIFT';
  if (cycleTurn < 75) return 'GASLIGHT_CURFEW';
  return 'GRAVEYARD_WATCH';
}

export const WorldStateSchema = z.object({
  version: z.literal(1),
  seed: z.number().int(),
  rngState: RNGStateSchema,
  turnCount: z.number().int().nonnegative(),
  macroTickCount: z.number().int().nonnegative(),
  currentDistrictId: BlueprintIdSchema.default(
    'district_spitalfields_soot_works' as z.infer<typeof BlueprintIdSchema>,
  ),
  strata: z.record(StratumIdSchema, StratumGridSchema),
  entities: z.record(z.string(), EntityComponentsSchema),
  economy: DistrictEconomyLedgerSchema,
  contracts: z.array(FactionContractSchema).default([]),
  safehouses: z.record(z.string(), SafehouseDeedRecordSchema).default({}),
  codex: z.record(z.string(), CodexEntryRecordSchema).default({}),
  turf: z.record(z.string(), TurfSectorRecordSchema).default({}),
  convoys: z.record(z.string(), EscortConvoyRecordSchema).default({}),
  audits: z.record(z.string(), GuildAuditRecordSchema).default({}),
  eventLog: z.array(SimEventSchema),
  savedDistricts: z.record(z.string(), SavedDistrictSnapshotSchema).default({}),
  catacombDepths: z.record(z.string(), z.object({
    grid: StratumGridSchema,
    entities: z.record(z.string(), EntityComponentsSchema),
  })).default({}),
});
export type WorldState = z.infer<typeof WorldStateSchema>;

export interface CreateWorldConfig {
  seed: number;
  width?: number;
  height?: number;
  currentDistrictId?: BlueprintId;
}


import {
  migrateWorldState,
  WorldMigrationError,
} from './world-migration.js';

export function serializeWorld(state: WorldState): string {
  return JSON.stringify(state);
}

export function deserializeWorld(json: string): WorldState {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch (err) {
    throw new WorldMigrationError(
      'CORRUPTED_SAVE_PAYLOAD',
      `Malformed JSON in save payload: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
  return migrateWorldState(parsed);
}

export { createInitialWorld } from './world-factory.js';
export { assertWorldInvariants, validateWorldInvariants } from './invariants.js';
export { CURRENT_WORLD_VERSION, WorldMigrationError, migrateWorldState } from './world-migration.js';
