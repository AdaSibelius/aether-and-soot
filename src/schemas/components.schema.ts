import { z } from 'zod';
import {
  BlueprintIdSchema,
  CommodityIdSchema,
  EntityIdSchema,
  ItemCategorySchema,
  ItemUseEffectSchema,
  LimbSlotIdSchema,
  LiquidTypeIdSchema,
  Point3DSchema,
  SocketTypeSchema,
  ToolQualityIdSchema,
  VisualGlyphSpecSchema,
} from './primitives.schema.js';
import { EquipmentSlotSchema, EquipmentSpecSchema } from './equipment.schema.js';
import {
  AiControllerComponent,
  AiControllerComponentSchema,
  CombatStatsComponent,
  CombatStatsComponentSchema,
  CrossStratumShaftComponent,
  CrossStratumShaftComponentSchema,
  DistrictGateComponent,
  DistrictGateComponentSchema,
  DistrictGraphNodeComponent,
  DistrictGraphNodeComponentSchema,
  FurnitureComponent,
  FurnitureComponentSchema,
  HydrologyChannelComponent,
  HydrologyChannelComponentSchema,
  LandmarkComponent,
  LandmarkComponentSchema,
  MonorailCarComponent,
  MonorailCarComponentSchema,
  NpcScheduleComponent,
  NpcScheduleComponentSchema,
  ThermalComponent,
  ThermalComponentSchema,
  TradePedestalComponent,
  TradePedestalComponentSchema,
  TrapComponent,
  TrapComponentSchema,
  UtilityConduitComponent,
  UtilityConduitComponentSchema,
  WitnessMemoryEntry,
  WitnessMemoryEntrySchema,
  WorkbenchComponent,
  WorkbenchComponentSchema,
} from './world-components.schema.js';

export const PositionComponentSchema = Point3DSchema.extend({
  blocksMovement: z.boolean().default(true),
  blocksSight: z.boolean().default(false),
});
export type PositionComponent = z.infer<typeof PositionComponentSchema>;

export const PostureSchema = z.enum(['STANDING', 'CROUCHED', 'BRACED']);
export type Posture = z.infer<typeof PostureSchema>;

export const ActorEnergyComponentSchema = z.object({
  energy: z.number().int(),
  speed: z.number().int().min(10).default(100),
  isPlayer: z.boolean().default(false),
  posture: PostureSchema.default('STANDING').optional(),
  squadId: z.string().optional(),
  grudgeTargetId: EntityIdSchema.optional(),
  witnessMemory: z.array(WitnessMemoryEntrySchema).default([]).optional(),
});
export type ActorEnergyComponent = z.infer<typeof ActorEnergyComponentSchema>;

export const PortalComponentSchema = z.object({
  target: Point3DSchema,
  bidirectional: z.boolean().default(true),
  conductsGas: z.boolean().default(true),
  apCost: z.number().int().positive().default(100),
  portalLabel: z.string().min(1),
});
export type PortalComponent = z.infer<typeof PortalComponentSchema>;

export const ActiveAbilitySchema = z.object({
  id: z.string().min(1),
  steamCost: z.number().nonnegative(),
  cooldownTurns: z.number().int().nonnegative(),
  cooldownRemaining: z.number().int().nonnegative().default(0),
});
export type ActiveAbility = z.infer<typeof ActiveAbilitySchema>;

export const ProstheticSpecComponentSchema = z.object({
  blueprintId: BlueprintIdSchema,
  targetLimbSlot: LimbSlotIdSchema,
  socketType: SocketTypeSchema,
  massGrams: z.number().int().positive(),
  volumeMl: z.number().int().positive(),
  steamConsumptionPerTurn: z.number().nonnegative().default(0),
  moveApModifier: z.number().int().default(0),
  fovRadiusBonus: z.number().int().default(0),
  pressureRatingKpa: z.number().positive(),
  noiseDb: z.number().int().nonnegative().default(0),
  activeAbility: ActiveAbilitySchema.optional(),
});
export type ProstheticSpecComponent = z.infer<typeof ProstheticSpecComponentSchema>;

export const PressureVesselComponentSchema = z.object({
  currentPressureKpa: z.number().nonnegative(),
  maxPressureKpa: z.number().positive(),
  ruptured: z.boolean().default(false),
});
export type PressureVesselComponent = z.infer<typeof PressureVesselComponentSchema>;

export const LimbStatusSchema = z.object({
  slot: LimbSlotIdSchema,
  hp: z.number().int().nonnegative(),
  maxHp: z.number().int().positive(),
  amputated: z.boolean().default(false),
  installedProstheticEntityId: EntityIdSchema.optional(),
});
export type LimbStatus = z.infer<typeof LimbStatusSchema>;

export const ActiveEffectSchema = z.object({
  effectId: z.string().min(1),
  durationTurns: z.number().int().nonnegative(),
  magnitude: z.number(),
});
export type ActiveEffect = z.infer<typeof ActiveEffectSchema>;

export const AnatomyComponentSchema = z.object({
  limbs: z.record(LimbSlotIdSchema, LimbStatusSchema),
  bloodVolumePct: z.number().min(0).max(100).default(100),
  steamReserveKpa: z.number().nonnegative().default(100),
  maxSteamReserveKpa: z.number().positive().default(100),
  unlockedRecipeIds: z.array(BlueprintIdSchema).default([]),
  governorCapacityKw: z.number().nonnegative().default(100),
  strainLoadKw: z.number().nonnegative().default(0),
  toxicityPct: z.number().min(0).max(100).default(0),
  painShock: z.number().min(0).max(100).default(0),
  stamina: z.number().min(0).max(100).default(100),
  activeEffects: z.array(ActiveEffectSchema).default([]),
});
export type AnatomyComponent = z.infer<typeof AnatomyComponentSchema>;

export const InventoryComponentSchema = z.object({
  containedEntityIds: z.array(EntityIdSchema).default([]),
  equippedSlots: z.record(EquipmentSlotSchema, EntityIdSchema).optional(),
  maxMassGrams: z.number().int().positive().default(25000),
  maxVolumeMl: z.number().int().positive().default(30000),
  currentMassGrams: z.number().int().nonnegative().default(0),
});
export type InventoryComponent = z.infer<typeof InventoryComponentSchema>;

/** Physical carryable item. `massGrams` and `volumeMl` are PER UNIT (multiply by `quantity`). */
export const ItemComponentSchema = z.object({
  blueprintId: BlueprintIdSchema,
  category: ItemCategorySchema,
  massGrams: z.number().int().positive(),
  volumeMl: z.number().int().positive(),
  quantity: z.number().int().positive().default(1),
  stackable: z.boolean().default(true),
  commodityId: CommodityIdSchema.optional(),
  useEffect: ItemUseEffectSchema.optional(),
  unlocksRecipeId: BlueprintIdSchema.optional(),
  equipmentSpec: EquipmentSpecSchema.optional(),
  toolQualities: z.record(ToolQualityIdSchema, z.number().int().positive()).optional(),
  coatedLiquid: z.object({ liquidType: LiquidTypeIdSchema, volumeMl: z.number().int().positive() }).optional(),
  penceValue: z.number().int().nonnegative().optional(),
  surgicalQuality: z.number().min(0).max(100).optional(),
});
export type ItemComponent = z.infer<typeof ItemComponentSchema>;

import { ProfessionIdSchema, TraitIdSchema } from './character.schema.js';

export {
  AiControllerComponentSchema,
  CombatStatsComponentSchema,
  CrossStratumShaftComponentSchema,
  DistrictGateComponentSchema,
  DistrictGraphNodeComponentSchema,
  FurnitureComponentSchema,
  HydrologyChannelComponentSchema,
  LandmarkComponentSchema,
  MonorailCarComponentSchema,
  NpcScheduleComponentSchema,
  ThermalComponentSchema,
  TradePedestalComponentSchema,
  TrapComponentSchema,
  UtilityConduitComponentSchema,
  WitnessMemoryEntrySchema,
  WorkbenchComponentSchema,
};
export type {
  AiControllerComponent,
  CombatStatsComponent,
  CrossStratumShaftComponent,
  DistrictGateComponent,
  DistrictGraphNodeComponent,
  FurnitureComponent,
  HydrologyChannelComponent,
  LandmarkComponent,
  MonorailCarComponent,
  NpcScheduleComponent,
  ThermalComponent,
  TradePedestalComponent,
  TrapComponent,
  UtilityConduitComponent,
  WitnessMemoryEntry,
  WorkbenchComponent,
};

export const EntityComponentsSchema = z.object({
  id: EntityIdSchema,
  name: z.string().min(1),
  visual: VisualGlyphSpecSchema,
  position: PositionComponentSchema.optional(),
  actor: ActorEnergyComponentSchema.optional(),
  portal: PortalComponentSchema.optional(),
  anatomy: AnatomyComponentSchema.optional(),
  inventory: InventoryComponentSchema.optional(),
  prostheticSpec: ProstheticSpecComponentSchema.optional(),
  pressureVessel: PressureVesselComponentSchema.optional(),
  item: ItemComponentSchema.optional(),
  equipmentSpec: EquipmentSpecSchema.optional(),
  districtGate: DistrictGateComponentSchema.optional(),
  workbench: WorkbenchComponentSchema.optional(),
  aiController: AiControllerComponentSchema.optional(),
  combatStats: CombatStatsComponentSchema.optional(),
  furniture: FurnitureComponentSchema.optional(),
  landmark: LandmarkComponentSchema.optional(),
  traits: z.array(TraitIdSchema).optional(),
  profession: ProfessionIdSchema.optional(),
  thermal: ThermalComponentSchema.optional(),
  schedule: NpcScheduleComponentSchema.optional(),
  tradePedestal: TradePedestalComponentSchema.optional(),
  trap: TrapComponentSchema.optional(),
  monorailCar: MonorailCarComponentSchema.optional(),
  utilityConduit: UtilityConduitComponentSchema.optional(),
  crossStratumShaft: CrossStratumShaftComponentSchema.optional(),
  hydrologyChannel: HydrologyChannelComponentSchema.optional(),
  districtGraphNode: DistrictGraphNodeComponentSchema.optional(),
});
export type EntityRecord = z.infer<typeof EntityComponentsSchema>;

