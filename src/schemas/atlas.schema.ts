import { z } from 'zod';
import { BlueprintIdSchema, Point2DSchema, StratumIdSchema } from './primitives.schema.js';

export const AtlasViewModeSchema = z.enum([
  'MINIMAP',
  'TOPOGRAPHY',
  'WATERWAYS',
  'FACTIONS',
  'MONORAILS',
  'DOSSIERS',
]);
export type AtlasViewMode = z.infer<typeof AtlasViewModeSchema>;

export const OverworldBarrierTypeSchema = z.enum([
  'THAMES_CANAL',
  'VIADUCT',
  'TOLL_PERIMETER_WALL',
  'SEWER_DROP',
]);
export type OverworldBarrierType = z.infer<typeof OverworldBarrierTypeSchema>;

export const OverworldBarrierSchema = z.object({
  id: z.string().min(1),
  barrierType: OverworldBarrierTypeSchema,
  name: z.string().min(1),
  fromDistrictId: BlueprintIdSchema,
  toDistrictId: BlueprintIdSchema,
  description: z.string().min(1),
  glyph: z.string().min(1),
  passable: z.boolean(),
  tollPence: z.number().int().nonnegative().optional(),
});
export type OverworldBarrier = z.infer<typeof OverworldBarrierSchema>;

export const LandmarkCategorySchema = z.enum([
  'BOILER_PLANT',
  'SURGICAL_CLINIC',
  'CLOCKTOWER',
  'MONORAIL_DEPOT',
  'CANAL_LOCK',
  'SAFEHOUSE_VAULT',
  'CATACOMB_DESCENT',
  'WHARF_PIER',
  'SPIRE_GREENHOUSE',
]);
export type LandmarkCategory = z.infer<typeof LandmarkCategorySchema>;

export const DistrictLandmarkDossierSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  stratum: StratumIdSchema,
  category: LandmarkCategorySchema,
  description: z.string().min(1),
  coords: Point2DSchema.optional(),
  controllingFactionId: z.string().min(1),
  status: z.enum(['OPERATIONAL', 'CONTESTED', 'SUBMERGED', 'DERELICT', 'RESTRICTED']),
});
export type DistrictLandmarkDossier = z.infer<typeof DistrictLandmarkDossierSchema>;

export const DistrictDossierSchema = z.object({
  id: BlueprintIdSchema,
  name: z.string().min(1),
  dominantStratum: StratumIdSchema,
  cartel: z.string().min(1),
  controllingFactionId: z.string().min(1),
  smog: z.string().min(1),
  wealthIndex: z.number().positive(),
  description: z.string().min(1),
  macroCoords: z.object({ col: z.number().int(), row: z.number().int() }),
  naturalBarriers: z.array(z.string()),
  connectedDistrictIds: z.array(BlueprintIdSchema),
  transitTypes: z.array(z.enum(['STREET_GATE', 'MONORAIL_LINE', 'CANAL_SLUICE_FERRY', 'SEWER_SIPHON'])),
  landmarks: z.array(DistrictLandmarkDossierSchema),
});
export type DistrictDossier = z.infer<typeof DistrictDossierSchema>;

export const FactionInfluenceRecordSchema = z.object({
  factionId: z.string().min(1),
  factionName: z.string().min(1),
  color: z.string().min(1),
  influencePct: z.number().min(0).max(100),
  dominantDistricts: z.array(BlueprintIdSchema),
  territoryDescription: z.string().min(1),
});
export type FactionInfluenceRecord = z.infer<typeof FactionInfluenceRecordSchema>;

export const TransitMonorailRouteSchema = z.object({
  routeId: z.string().min(1),
  name: z.string().min(1),
  fromDistrictId: BlueprintIdSchema,
  toDistrictId: BlueprintIdSchema,
  stationName: z.string().min(1),
  pressureOperatingKpa: z.number().positive(),
  status: z.enum(['ACTIVE', 'DISRUPTED', 'UNDER_MAINTENANCE']),
});
export type TransitMonorailRoute = z.infer<typeof TransitMonorailRouteSchema>;

export const MacroTopographyCellSchema = z.object({
  x: z.number().int(),
  y: z.number().int(),
  glyph: z.string(),
  districtId: BlueprintIdSchema.optional(),
  elevationMeters: z.number(),
  feature: z.enum(['WATER', 'CANAL_LOCK', 'WALL', 'VIADUCT', 'RAIL', 'DISTRICT_CORE', 'OPEN_GROUND']),
  fgColor: z.string(),
  label: z.string().optional(),
});
export type MacroTopographyCell = z.infer<typeof MacroTopographyCellSchema>;
