import { z } from 'zod';
import {
  BlueprintIdSchema,
  CommodityIdSchema,
  EntityIdSchema,
  FactionIdSchema,
  ItemCategorySchema,
  ItemUseEffectSchema,
  LimbSlotIdSchema,
  Point3DSchema,
  SocketTypeSchema,
  VisualGlyphSpecSchema,
} from './primitives.schema.js';
import { EquipmentSlotSchema, EquipmentSpecSchema } from './equipment.schema.js';

export const PositionComponentSchema = Point3DSchema.extend({
  blocksMovement: z.boolean().default(true),
  blocksSight: z.boolean().default(false),
});
export type PositionComponent = z.infer<typeof PositionComponentSchema>;

export const ActorEnergyComponentSchema = z.object({
  energy: z.number().int(),
  speed: z.number().int().min(10).default(100),
  isPlayer: z.boolean().default(false),
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

export const AnatomyComponentSchema = z.object({
  limbs: z.record(LimbSlotIdSchema, LimbStatusSchema),
  bloodVolumePct: z.number().min(0).max(100).default(100),
  steamReserveKpa: z.number().nonnegative().default(100),
  maxSteamReserveKpa: z.number().positive().default(100),
  unlockedRecipeIds: z.array(BlueprintIdSchema).default([]),
  governorCapacityKw: z.number().nonnegative().default(100),
  strainLoadKw: z.number().nonnegative().default(0),
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
  penceValue: z.number().int().nonnegative().optional(),
  surgicalQuality: z.number().min(0).max(100).optional(),
});
export type ItemComponent = z.infer<typeof ItemComponentSchema>;

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
  kind: z.enum(['BED', 'SURGICAL_TABLE', 'LOCKER', 'CRATE', 'BOOKSHELF']),
  label: z.string().min(1),
});
export type FurnitureComponent = z.infer<typeof FurnitureComponentSchema>;

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

import { ProfessionIdSchema, TraitIdSchema } from './character.schema.js';

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
  traits: z.array(TraitIdSchema).optional(),
  profession: ProfessionIdSchema.optional(),
  thermal: ThermalComponentSchema.optional(),
  schedule: NpcScheduleComponentSchema.optional(),
  tradePedestal: TradePedestalComponentSchema.optional(),
  trap: TrapComponentSchema.optional(),
});
export type EntityRecord = z.infer<typeof EntityComponentsSchema>;

