import { z } from 'zod';
import {
  BlueprintIdSchema,
  CommodityIdSchema,
  EntityIdSchema,
  FactionIdSchema,
  LandmarkArchetypeIdSchema,
  Point2DSchema,
  Point3DSchema,
  StratumIdSchema,
} from './primitives.schema.js';

export const WitnessMemoryEntrySchema = z.object({
  perpetratorId: EntityIdSchema,
  crime: z.enum(['THEFT', 'ASSAULT', 'TRESPASS']),
  turn: z.number().int().nonnegative(),
});
export type WitnessMemoryEntry = z.infer<typeof WitnessMemoryEntrySchema>;

/** District gate linking this map position to another district in data/districts/. */
export const DistrictGateComponentSchema = z.object({
  targetDistrictId: BlueprintIdSchema,
  gateLabel: z.string().min(1),
  apCost: z.number().int().positive().default(100),
});
export type DistrictGateComponent = z.infer<typeof DistrictGateComponentSchema>;

/** Stationary crafting station (Artificer Bench or Alchemical Still) reducing steam cost. */
export const WorkbenchComponentSchema = z.object({
  stationType: z.enum(['ARTIFICER_BENCH', 'ALCHEMICAL_STILL']),
  bonusEfficiencyPct: z.number().min(0).max(90).default(0),
});
export type WorkbenchComponent = z.infer<typeof WorkbenchComponentSchema>;

/** Autonomous NPC behavior and faction affiliation controller. */
export const AiControllerComponentSchema = z.object({
  factionId: FactionIdSchema,
  role: z.enum(['GUARD', 'SCAVENGER', 'MERCHANT', 'CITIZEN', 'CHIRURGEON', 'FIXER']),
  hostile: z.boolean().default(false),
  companionOfActorId: EntityIdSchema.optional(),
  dialogueId: z.string().optional(),
  alertState: z.enum(['IDLE', 'INVESTIGATING', 'COMBAT']).default('IDLE'),
  lastKnownTargetPos: Point3DSchema.optional(),
  grudgeTargetId: EntityIdSchema.optional(),
  squadId: z.string().optional(),
  witnessMemory: z.array(WitnessMemoryEntrySchema).default([]).optional(),
});
export type AiControllerComponent = z.infer<typeof AiControllerComponentSchema>;

/** Melee combat parameters for targeted limb attacks. */
export const CombatStatsComponentSchema = z.object({
  meleeDamage: z.number().int().positive().default(12),
  accuracyPct: z.number().int().min(5).max(100).default(85),
  armorReduction: z.number().int().nonnegative().default(0),
});
export type CombatStatsComponent = z.infer<typeof CombatStatsComponentSchema>;

/** Interactive furniture fixture (e.g. Bed, Surgical Table, Locker, Crate). */
export const FurnitureComponentSchema = z.object({
  kind: z.enum([
    'BED',
    'SURGICAL_TABLE',
    'LOCKER',
    'CRATE',
    'BOOKSHELF',
    'ARTIFICER_BENCH',
    'STEAM_CHARGER',
    'BARRICADE_WOOD',
    'BARRICADE_IRON',
    'SAFE_VAULT',
    'SMELTING_FURNACE',
    'CLOCKTOWER_MECHANISM',
    'WATER_PUMP',
    'CANAL_LOCK_MECHANISM',
    'BOTANICAL_PLANTER',
    'MONORAIL_DEPOT_CONSOLE',
    'APOTHECARY_COUNTER',
  ]),
  label: z.string().min(1),
  durabilityHp: z.number().int().positive().optional(),
});
export type FurnitureComponent = z.infer<typeof FurnitureComponentSchema>;

/** Distinctive outdoor street landmark or architectural monument. */
export const LandmarkComponentSchema = z.object({
  kind: LandmarkArchetypeIdSchema,
  label: z.string().min(1),
  discovered: z.boolean().default(false),
});
export type LandmarkComponent = z.infer<typeof LandmarkComponentSchema>;

export const ThermalComponentSchema = z.object({
  coreHeatPct: z.number().min(0).max(100).default(50),
});
export type ThermalComponent = z.infer<typeof ThermalComponentSchema>;

export const NpcScheduleComponentSchema = z.object({
  workAnchor: Point3DSchema,
  restAnchor: Point3DSchema,
  currentGoal: z.enum(['WORK', 'REST', 'PATROL', 'SEEK_MEDICAL']).default('WORK'),
});
export type NpcScheduleComponent = z.infer<typeof NpcScheduleComponentSchema>;

export const TradePedestalComponentSchema = z.object({
  itemEntityId: EntityIdSchema.optional(),
  commodityId: CommodityIdSchema.optional(),
  pricePence: z.number().int().nonnegative().default(0),
});
export type TradePedestalComponent = z.infer<typeof TradePedestalComponentSchema>;

export const TrapComponentSchema = z.object({
  trapKind: z.enum(['SPARK_TRIPWIRE', 'STEAM_MINE', 'SPRING_JAW']),
  armed: z.boolean().default(true),
  damageMagnitude: z.number().int().nonnegative().default(20),
});
export type TrapComponent = z.infer<typeof TrapComponentSchema>;

/** Multi-tile pneumatic monorail car for district transit. */
export const MonorailCarComponentSchema = z.object({
  carId: z.string(),
  destinationDistrictId: BlueprintIdSchema,
  steamPressureKpa: z.number().nonnegative(),
  speedMph: z.number().nonnegative(),
  occupiedByActorIds: z.array(EntityIdSchema),
});
export type MonorailCarComponent = z.infer<typeof MonorailCarComponentSchema>;

/** Causal utility network conduit (steam main, hydraulic drainage, gas feed). */
export const UtilityConduitComponentSchema = z.object({
  conduitType: z.enum([
    'HIGH_PRESSURE_STEAM_MAIN',
    'HYDRAULIC_DRAINAGE',
    'PNEUMATIC_TRANSIT_TUBE',
    'COAL_GAS_FEED',
    'AETHER_CONDUIT',
  ]),
  networkId: z.string(),
  operatingPressureKpa: z.number().nonnegative().default(0),
  maxPressureKpa: z.number().positive().default(200),
  ruptured: z.boolean().default(false),
  connectedEndpointEntityIds: z.array(EntityIdSchema).default([]),
});
export type UtilityConduitComponent = z.infer<typeof UtilityConduitComponentSchema>;

/** Vertical shaft connecting two adjacent strata (lifts, sewer drops, steam risers). */
export const CrossStratumShaftComponentSchema = z.object({
  shaftType: z.enum([
    'PNEUMATIC_LIFT',
    'SEWER_SIPHON',
    'STEAM_RISER',
    'GRAVITY_CHUTE',
    'MONORAIL_ELEVATOR',
  ]),
  upperStratum: StratumIdSchema,
  lowerStratum: StratumIdSchema,
  upperCoord: Point2DSchema,
  lowerCoord: Point2DSchema,
  operational: z.boolean().default(true),
  flowRateUnitsPerTick: z.number().nonnegative().default(1),
});
export type CrossStratumShaftComponent = z.infer<typeof CrossStratumShaftComponentSchema>;

/** Hydrology canal sluice, gutter drain, or industrial runoff basin. */
export const HydrologyChannelComponentSchema = z.object({
  fluidType: z.enum(['WATER', 'SLUDGE', 'ACID', 'WHALE_OIL', 'SEWAGE']).default('WATER'),
  currentVolumeMl: z.number().nonnegative().default(1000),
  maxFlowRateMlPerTick: z.number().positive().default(500),
  sluiceOpen: z.boolean().default(true),
  drainsIntoStratum: StratumIdSchema.optional(),
});
export type HydrologyChannelComponent = z.infer<typeof HydrologyChannelComponentSchema>;

/** Causal city graph macro-node representing district and urban block hierarchy. */
export const DistrictGraphNodeComponentSchema = z.object({
  districtId: BlueprintIdSchema,
  stratum: StratumIdSchema,
  macroCellIndex: z.number().int().min(0).max(8).default(0),
  compassPortals: z.object({
    north: EntityIdSchema.optional(),
    south: EntityIdSchema.optional(),
    east: EntityIdSchema.optional(),
    west: EntityIdSchema.optional(),
  }).default({}),
  localHubEntityId: EntityIdSchema.optional(),
});
export type DistrictGraphNodeComponent = z.infer<typeof DistrictGraphNodeComponentSchema>;
