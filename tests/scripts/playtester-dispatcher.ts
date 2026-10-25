import { GameCommand } from '../../src/schemas/commands.schema.js';
import {
  BlueprintIdSchema,
  CommodityIdSchema,
  EntityId,
  EntityIdSchema,
  FactionIdSchema,
  LimbSlotId,
} from '../../src/schemas/primitives.schema.js';
import { WorldState } from '../../src/sim/core/world.js';
import { DIR_VECTORS, normalizeDirection } from './playtester-common.js';
import { LlmActionPayloadSchema } from './playtester-actions.js';

export function parseLlmResponseToCommand(
  raw: string,
  state: WorldState,
  playerId: EntityId = EntityIdSchema.parse('actor_player'),
): GameCommand {
  const fallback: GameCommand = { type: 'WAIT_TURN', actorId: playerId };
  const player = state.entities[playerId];
  if (!player?.position) return fallback;
  const pos = player.position;

  try {
    const cleaned = raw.replace(/```json/gi, '').replace(/```/g, '').trim();
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (match) {
      let rawObj: Record<string, unknown> | undefined;
      try {
        rawObj = JSON.parse(match[0]) as Record<string, unknown>;
      } catch {
        rawObj = JSON.parse(match[0].replace(/'/g, '"')) as Record<string, unknown>;
      }
      if (rawObj && typeof rawObj === 'object') {
        const actionStr = String(rawObj.action || '').toUpperCase();
        if (actionStr === 'TOGGLE_DOOR') {
          return {
            type: 'TOGGLE_DOOR',
            actorId: playerId,
            target: {
              x: pos.x + Math.sign(Number(rawObj.dx ?? 0)),
              y: pos.y + Math.sign(Number(rawObj.dy ?? 0)),
              stratum: pos.stratum,
            },
          };
        }
        const parsed = LlmActionPayloadSchema.safeParse(rawObj);
        if (parsed.success) {
          const p = parsed.data;
          switch (p.action) {
            case 'MOVE': return { type: 'MOVE_STEP', actorId: playerId, dx: DIR_VECTORS[p.dir]![0], dy: DIR_VECTORS[p.dir]![1] };
            case 'WAIT': return fallback;
            case 'ATTACK': return { type: 'ATTACK_ACTOR', attackerId: playerId, targetId: EntityIdSchema.parse(p.targetId), targetSlot: (p.limb as LimbSlotId) ?? 'TORSO' };
            case 'TOGGLE_DOOR': return { type: 'TOGGLE_DOOR', actorId: playerId, target: { x: pos.x + p.dx, y: pos.y + p.dy, stratum: pos.stratum } };
            case 'VENT_STEAM': return { type: 'VENT_STEAM', actorId: playerId, target: { x: pos.x + p.targetRelX, y: pos.y + p.targetRelY, stratum: pos.stratum }, pressureReleasedKpa: p.pressureKpa };
            case 'USE_ITEM': return { type: 'USE_ITEM', actorId: playerId, itemEntityId: EntityIdSchema.parse(p.itemId) };
            case 'BREACH_TILE': return { type: 'BREACH_TILE', actorId: playerId, target: { x: pos.x + p.dx, y: pos.y + p.dy, stratum: pos.stratum } };
            case 'USE_PORTAL': return { type: 'USE_PORTAL', actorId: playerId };
            case 'BUY': return { type: 'BUY_FROM_MERCHANT', actorId: playerId, merchantId: EntityIdSchema.parse(p.merchantId), itemEntityId: EntityIdSchema.parse(p.itemId), ...(p.quantity ? { quantity: p.quantity } : {}) };
            case 'SELL_TO_MERCHANT': {
              const inv = player.inventory?.containedEntityIds ?? [];
              const resolvedItem = p.itemId
                ? EntityIdSchema.parse(p.itemId)
                : (inv.find((id) => (state.entities[id]?.item?.blueprintId ?? '').includes('coal') || (state.entities[id]?.name ?? '').toLowerCase().includes('coal')) ?? inv[0]);
              return {
                type: 'SELL_TO_MERCHANT',
                actorId: playerId,
                merchantId: EntityIdSchema.parse(p.merchantId),
                itemEntityId: resolvedItem ?? EntityIdSchema.parse('item_player_coal'),
                ...(p.quantity ? { quantity: p.quantity } : {}),
              };
            }
            case 'PICK_UP': return { type: 'PICK_UP_ITEM', actorId: playerId, ...(p.itemId ? { itemEntityId: EntityIdSchema.parse(p.itemId) } : {}) };
            case 'DROP_ITEM': return { type: 'DROP_ITEM', actorId: playerId, itemEntityId: EntityIdSchema.parse(p.itemId), ...(p.quantity ? { quantity: p.quantity } : {}) };
            case 'ACTIVATE_PROSTHETIC': return { type: 'ACTIVATE_PROSTHETIC', actorId: playerId, slot: p.slot as LimbSlotId, ...(p.targetRelX !== undefined && p.targetRelY !== undefined ? { direction: { dx: Math.sign(p.targetRelX), dy: Math.sign(p.targetRelY) } } : {}) };
            case 'HARVEST_CORPSE': return { type: 'HARVEST_CORPSE', actorId: playerId, corpseEntityId: EntityIdSchema.parse(p.corpseId), toolEntityId: EntityIdSchema.parse(p.toolId), ...(p.slot ? { slot: p.slot as LimbSlotId } : {}) };
            case 'ACCEPT_CONTRACT': return { type: 'ACCEPT_CONTRACT', actorId: playerId, contractId: EntityIdSchema.parse(p.contractId) };
            case 'COMPLETE_CONTRACT': return { type: 'COMPLETE_CONTRACT', actorId: playerId, contractId: EntityIdSchema.parse(p.contractId) };
            case 'CRAFT_RECIPE': return { type: 'CRAFT_RECIPE', actorId: playerId, recipeId: BlueprintIdSchema.parse(p.recipeId) };
            case 'SALVAGE_ITEM': return { type: 'SALVAGE_ITEM', actorId: playerId, itemEntityId: EntityIdSchema.parse(p.itemId) };
            case 'GRAFT_PROSTHETIC':
            case 'INSTALL_PROSTHETIC': return { type: 'INSTALL_PROSTHETIC', actorId: playerId, prostheticEntityId: EntityIdSchema.parse(p.prostheticId), slot: p.slot as LimbSlotId };
            case 'FIELD_REPAIR_LIMB':
            case 'REPAIR_LIMB': return { type: 'REPAIR_LIMB', actorId: playerId, slot: p.slot as LimbSlotId, ...(p.toolId ? { toolEntityId: EntityIdSchema.parse(p.toolId) } : {}) };
            case 'STOKE_BOILER': return { type: 'REFILL_STEAM', actorId: playerId, pressureAddedKpa: p.pressureKpa, bypassFuelRequirement: false };
            case 'PRESSURIZE_VESSEL': return { type: 'PRESSURIZE_VESSEL', actorId: playerId, vesselEntityId: EntityIdSchema.parse(p.vesselId), pressureAddedKpa: p.pressureKpa };
            case 'PRY_OBJECT':
            case 'PRY_OBSTACLE': return { type: 'PRY_OBSTACLE', actorId: playerId, target: { x: pos.x + p.targetRelX, y: pos.y + p.targetRelY, stratum: pos.stratum }, toolEntityId: EntityIdSchema.parse(p.toolId) };
            case 'CLAIM_SAFEHOUSE':
            case 'CLAIM_WORKSHOP_DEED': return { type: 'CLAIM_WORKSHOP_DEED', actorId: playerId, claimVault: p.claimVault ?? true };
            case 'STOCK_PEDESTAL': return { type: 'STOCK_PEDESTAL', actorId: playerId, commodity: CommodityIdSchema.parse(p.commodity ?? p.commodityId ?? 'ANTHRACITE_COAL'), quantity: p.quantity, askingPriceMarkupPct: p.askingPriceMarkupPct ?? 0 };
            case 'DISPATCH_MONORAIL':
            case 'LAUNCH_MONORAIL': return { type: 'LAUNCH_MONORAIL', actorId: playerId, monorailEntityId: EntityIdSchema.parse(p.monorailId ?? 'env_monorail_cab'), destinationDistrictId: BlueprintIdSchema.parse(p.destinationDistrictId ?? 'district_gilded_spire') };
            case 'BOARD_MONORAIL': return { type: 'BOARD_MONORAIL', actorId: playerId, monorailEntityId: EntityIdSchema.parse(p.monorailId) };
            case 'DAMAGE_LIMB': return { type: 'DAMAGE_LIMB', actorId: playerId, targetId: EntityIdSchema.parse(p.targetId), slot: p.slot as LimbSlotId, damage: p.damage };
            case 'HIRE_COMPANION': return { type: 'HIRE_COMPANION', actorId: playerId, npcId: EntityIdSchema.parse(p.npcId) };
            case 'APPLY_MOMENTUM_VECTOR': return { type: 'APPLY_MOMENTUM_VECTOR', targetId: EntityIdSchema.parse(p.targetId), dx: p.dx, dy: p.dy, distanceTiles: p.distanceTiles, massKg: p.massKg, sourceEntityId: playerId };
            case 'CLEAN_SPILL': return { type: 'CLEAN_SPILL', actorId: playerId, toolEntityId: EntityIdSchema.parse(p.toolId), target: { x: pos.x + p.targetRelX, y: pos.y + p.targetRelY, stratum: pos.stratum } };
            case 'COAT_WEAPON': return { type: 'COAT_WEAPON', actorId: playerId, weaponEntityId: EntityIdSchema.parse(p.weaponId), liquidContainerId: EntityIdSchema.parse(p.containerId) };
            case 'BUILD_STRUCTURE': return { type: 'BUILD_STRUCTURE', actorId: playerId, structureType: p.structureType, target: { x: pos.x + p.targetRelX, y: pos.y + p.targetRelY, stratum: pos.stratum } };
            case 'STORE_ITEM': return { type: 'STORE_ITEM_IN_STRUCTURE', actorId: playerId, structureEntityId: EntityIdSchema.parse(p.structureId), itemEntityId: EntityIdSchema.parse(p.itemId) };
            case 'RETRIEVE_ITEM': return { type: 'RETRIEVE_ITEM_FROM_STRUCTURE', actorId: playerId, structureEntityId: EntityIdSchema.parse(p.structureId), itemEntityId: EntityIdSchema.parse(p.itemId) };
            case 'CONSULT_CODEX': return { type: 'CONSULT_CODEX', actorId: playerId, entryId: p.entryId };
            case 'INITIATE_TURF_SKIRMISH': return { type: 'INITIATE_TURF_SKIRMISH', actorId: playerId, turfId: p.turfId };
            case 'PREPARE_SUPPLY_CONVOY': return { type: 'PREPARE_SUPPLY_CONVOY', actorId: playerId, cargoItemId: EntityIdSchema.parse(p.cargoItemId), clientFactionId: FactionIdSchema.parse(p.clientFactionId), destinationDistrictId: p.destinationDistrictId, ...(p.rewardPence !== undefined ? { rewardPence: p.rewardPence } : {}) };
            case 'AUDIT_SAFEHOUSE_DEED': return { type: 'AUDIT_SAFEHOUSE_DEED', actorId: playerId, inspectorId: EntityIdSchema.parse(p.inspectorId), deedId: p.deedId };
            case 'EMIT_SPARK': return { type: 'EMIT_SPARK', actorId: playerId, target: { x: pos.x + p.targetRelX, y: pos.y + p.targetRelY, stratum: pos.stratum } };
            case 'INSTALL_WEAPON_MOD': return { type: 'INSTALL_WEAPON_MOD', actorId: playerId, weaponEntityId: EntityIdSchema.parse(p.weaponId), modEntityId: EntityIdSchema.parse(p.modId) };
            case 'LOAD_AMMO': return { type: 'LOAD_AMMO', actorId: playerId, weaponEntityId: EntityIdSchema.parse(p.weaponId), ammoEntityId: EntityIdSchema.parse(p.ammoId) };
            case 'LOOT_CONTAINER': return { type: 'LOOT_CONTAINER', actorId: playerId, containerId: EntityIdSchema.parse(p.containerId), ...(p.itemId ? { itemId: EntityIdSchema.parse(p.itemId) } : {}) };
            case 'PAY_CHIRURGEON_HEAL': return { type: 'PAY_CHIRURGEON_HEAL', actorId: playerId, chirurgeonId: EntityIdSchema.parse(p.chirurgeonId) };
            case 'DESCEND_CATACOMBS': return { type: 'DESCEND_CATACOMBS', actorId: playerId, stairEntityId: EntityIdSchema.parse(p.stairEntityId ?? p.portalId ?? 'portal_catacombs') };
            case 'EMIT_SQUAD_CALLOUT': return { type: 'EMIT_SQUAD_CALLOUT', actorId: playerId, targetId: EntityIdSchema.parse(p.targetId ?? playerId), alertMessage: p.alertMessage ?? 'Intruder spotted! Rally to me!' };
          }
        }
        const normDir = normalizeDirection(String(rawObj.dir || rawObj.direction || ''));
        if (normDir && DIR_VECTORS[normDir]) return { type: 'MOVE_STEP', actorId: playerId, dx: DIR_VECTORS[normDir]![0], dy: DIR_VECTORS[normDir]![1] };
        if (rawObj.dx !== undefined || rawObj.dy !== undefined) {
          const dx = Math.sign(Number(rawObj.dx ?? 0)), dy = Math.sign(Number(rawObj.dy ?? 0));
          if (dx !== 0 || dy !== 0) return { type: 'MOVE_STEP', actorId: playerId, dx, dy };
        }
      }
    }

    const coordMatch = cleaned.match(/\bMOVE[^\d\-+]*?\(?\s*(-?\d+)[,\s:]+(-?\d+)\s*\)?/i);
    if (coordMatch) {
      const dx = Math.abs(Number(coordMatch[1])) <= 1 ? Number(coordMatch[1]) : Math.sign(Number(coordMatch[1]) - pos.x);
      const dy = Math.abs(Number(coordMatch[2])) <= 1 ? Number(coordMatch[2]) : Math.sign(Number(coordMatch[2]) - pos.y);
      if (dx !== 0 || dy !== 0) return { type: 'MOVE_STEP', actorId: playerId, dx, dy };
    }
    const textDirMatch = cleaned.match(/\bMOVE[^\w]*?["']?([A-Za-z]+)["']?/i);
    if (textDirMatch?.[1]) {
      const norm = normalizeDirection(textDirMatch[1]);
      if (norm && DIR_VECTORS[norm]) return { type: 'MOVE_STEP', actorId: playerId, dx: DIR_VECTORS[norm]![0], dy: DIR_VECTORS[norm]![1] };
    }
    if (/\b(STOKE|REFILL)\b/i.test(cleaned)) return { type: 'REFILL_STEAM', actorId: playerId, pressureAddedKpa: 50, bypassFuelRequirement: false };
    if (/\b(VENT|STEAM)\b/i.test(cleaned)) return { type: 'VENT_STEAM', actorId: playerId, target: { x: pos.x, y: pos.y, stratum: pos.stratum }, pressureReleasedKpa: 30 };
    if (/\b(PORTAL|STAIRS|TRANSIT|ENTER)\b/i.test(cleaned)) return { type: 'USE_PORTAL', actorId: playerId };
    if (/\b(BUY|PURCHASE)\b/i.test(cleaned)) {
      const m = Object.values(state.entities).find((e) => e.aiController?.role === 'MERCHANT' && e.position?.stratum === pos.stratum && Math.abs(e.position.x - pos.x) <= 1 && Math.abs(e.position.y - pos.y) <= 1);
      if (m?.inventory?.containedEntityIds[0]) return { type: 'BUY_FROM_MERCHANT', actorId: playerId, merchantId: m.id, itemEntityId: m.inventory.containedEntityIds[0] };
    }
    if (/\b(MONORAIL|DISPATCH|LAUNCH)\b/i.test(cleaned)) {
      return { type: 'LAUNCH_MONORAIL', actorId: playerId, monorailEntityId: EntityIdSchema.parse('env_monorail_cab'), destinationDistrictId: BlueprintIdSchema.parse('district_gilded_spire') };
    }
  } catch {
    return fallback;
  }
  return fallback;
}
