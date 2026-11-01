import { z } from 'zod';
import {
  BlueprintIdSchema,
  CausalConduitTypeSchema,
  ConduitEdgeIdSchema,
  StratumIdSchema,
} from './primitives.schema.js';

export const DistrictResourceReservoirSchema = z.object({
  steamHeadKpa: z.number().nonnegative(),
  anthraciteCoalTons: z.number().nonnegative(),
  carbolicTinctureLiters: z.number().nonnegative(),
  preservedRationsCrates: z.number().nonnegative(),
  miasmaSaturationPpm: z.number().nonnegative(),
  laborUnrestPct: z.number().min(0).max(100),
});
export type DistrictResourceReservoir = z.infer<typeof DistrictResourceReservoirSchema>;

export const DistrictCausalFlagsSchema = z.object({
  steamOutageActive: z.boolean().default(false),
  clinicStockoutActive: z.boolean().default(false),
  workerStrikeActive: z.boolean().default(false),
  sluiceFloodedActive: z.boolean().default(false),
});
export type DistrictCausalFlags = z.infer<typeof DistrictCausalFlagsSchema>;

export const CityGraphNodeSchema = z.object({
  districtId: BlueprintIdSchema,
  controllingFactionId: z.string().min(1),
  reservoirs: DistrictResourceReservoirSchema,
  flags: DistrictCausalFlagsSchema.default({}),
  lastUpdatedTurn: z.number().int().nonnegative(),
});
export type CityGraphNode = z.infer<typeof CityGraphNodeSchema>;

export const CausalConduitEdgeSchema = z.object({
  edgeId: ConduitEdgeIdSchema,
  conduitType: CausalConduitTypeSchema,
  fromDistrictId: BlueprintIdSchema,
  toDistrictId: BlueprintIdSchema,
  stratum: StratumIdSchema,
  capacityPerMacroTick: z.number().nonnegative(),
  integrityPct: z.number().min(0).max(100),
  valveOpen: z.boolean(),
  tollTariffPct: z.number().min(0).max(200),
});
export type CausalConduitEdge = z.infer<typeof CausalConduitEdgeSchema>;

export const CityGraphLedgerSchema = z.object({
  nodes: z.record(z.string(), CityGraphNodeSchema).default({}),
  edges: z.record(z.string(), CausalConduitEdgeSchema).default({}),
});
export type CityGraphLedger = z.infer<typeof CityGraphLedgerSchema>;
