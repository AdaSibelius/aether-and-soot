import { z } from 'zod';

export const LIMB_ENUM = z.enum(['HEAD', 'TORSO', 'LEFT_ARM', 'RIGHT_ARM', 'LEFT_LEG', 'RIGHT_LEG']);
export const STRUCTURE_ENUM = z.enum(['SURGICAL_TABLE', 'ARTIFICER_BENCH', 'STEAM_CHARGER', 'BARRICADE_WOOD', 'BARRICADE_IRON']);

export const LlmActionPayloadSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('MOVE'), dir: z.enum(['N', 'S', 'E', 'W', 'NE', 'NW', 'SE', 'SW']), reasoning: z.string().optional() }),
  z.object({ action: z.literal('WAIT'), reasoning: z.string().optional() }),
  z.object({ action: z.literal('ATTACK'), targetId: z.string(), limb: LIMB_ENUM.optional(), reasoning: z.string().optional() }),
  z.object({ action: z.literal('TOGGLE_DOOR'), dx: z.number().int().min(-1).max(1), dy: z.number().int().min(-1).max(1), reasoning: z.string().optional() }),
  z.object({ action: z.literal('VENT_STEAM'), pressureKpa: z.number().positive().default(50), targetRelX: z.number().int().default(0), targetRelY: z.number().int().default(0), reasoning: z.string().optional() }),
  z.object({ action: z.literal('USE_ITEM'), itemId: z.string(), reasoning: z.string().optional() }),
  z.object({ action: z.literal('BREACH_TILE'), dx: z.number().int().min(-1).max(1), dy: z.number().int().min(-1).max(1), reasoning: z.string().optional() }),
  z.object({ action: z.literal('USE_PORTAL'), reasoning: z.string().optional() }),
  z.object({ action: z.literal('BUY'), merchantId: z.string(), itemId: z.string(), quantity: z.number().int().positive().optional(), reasoning: z.string().optional() }),
  z.object({ action: z.literal('PICK_UP'), itemId: z.string().optional(), reasoning: z.string().optional() }),
  z.object({ action: z.literal('DROP_ITEM'), itemId: z.string(), quantity: z.number().int().positive().optional(), reasoning: z.string().optional() }),
  z.object({ action: z.literal('ACTIVATE_PROSTHETIC'), slot: LIMB_ENUM, targetRelX: z.number().int().optional(), targetRelY: z.number().int().optional(), reasoning: z.string().optional() }),
  z.object({ action: z.literal('HARVEST_CORPSE'), corpseId: z.string(), toolId: z.string(), slot: LIMB_ENUM.optional(), reasoning: z.string().optional() }),
  z.object({ action: z.literal('ACCEPT_CONTRACT'), contractId: z.string(), reasoning: z.string().optional() }),
  z.object({ action: z.literal('COMPLETE_CONTRACT'), contractId: z.string(), reasoning: z.string().optional() }),
  z.object({ action: z.literal('CRAFT_RECIPE'), recipeId: z.string(), reasoning: z.string().optional() }),
  z.object({ action: z.literal('DAMAGE_LIMB'), targetId: z.string(), slot: LIMB_ENUM, damage: z.number().int().positive(), reasoning: z.string().optional() }),
  z.object({ action: z.literal('HIRE_COMPANION'), npcId: z.string(), reasoning: z.string().optional() }),
  z.object({ action: z.literal('APPLY_MOMENTUM_VECTOR'), targetId: z.string(), dx: z.number().int(), dy: z.number().int(), distanceTiles: z.number().int().positive().default(2), massKg: z.number().positive().default(70), reasoning: z.string().optional() }),
  z.object({ action: z.literal('CLEAN_SPILL'), toolId: z.string(), targetRelX: z.number().int().default(0), targetRelY: z.number().int().default(0), reasoning: z.string().optional() }),
  z.object({ action: z.literal('COAT_WEAPON'), weaponId: z.string(), containerId: z.string(), reasoning: z.string().optional() }),
  z.object({ action: z.literal('CLAIM_WORKSHOP_DEED'), claimVault: z.boolean().optional(), reasoning: z.string().optional() }),
  z.object({ action: z.literal('BUILD_STRUCTURE'), structureType: STRUCTURE_ENUM, targetRelX: z.number().int().default(0), targetRelY: z.number().int().default(0), reasoning: z.string().optional() }),
  z.object({ action: z.literal('STORE_ITEM'), structureId: z.string(), itemId: z.string(), reasoning: z.string().optional() }),
  z.object({ action: z.literal('RETRIEVE_ITEM'), structureId: z.string(), itemId: z.string(), reasoning: z.string().optional() }),
  z.object({ action: z.literal('CONSULT_CODEX'), entryId: z.string().optional(), reasoning: z.string().optional() }),
  z.object({ action: z.literal('INITIATE_TURF_SKIRMISH'), turfId: z.string(), reasoning: z.string().optional() }),
  z.object({ action: z.literal('PREPARE_SUPPLY_CONVOY'), cargoItemId: z.string(), clientFactionId: z.string(), destinationDistrictId: z.string(), rewardPence: z.number().int().nonnegative().optional(), reasoning: z.string().optional() }),
  z.object({ action: z.literal('AUDIT_SAFEHOUSE_DEED'), inspectorId: z.string(), deedId: z.string(), reasoning: z.string().optional() }),
]);

export type LlmActionPayload = z.infer<typeof LlmActionPayloadSchema>;
