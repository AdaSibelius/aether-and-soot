import { EntityId, EntityIdSchema, Point3D } from '../../src/schemas/primitives.schema.js';
import { WorldState } from '../../src/sim/core/world.js';
import { findEntitiesAtPoint, getTileCell } from '../../src/sim/spatial/grid.js';
import { DIR_VECTORS } from './playtester-common.js';
import { LlmActionPayload } from './playtester-actions.js';
import { PlaytestScenario } from './playtester-scenarios.js';

export function generateMockAction(
  state: WorldState,
  playerId: EntityId = EntityIdSchema.parse('actor_player'),
  recentPositions?: ReadonlyArray<{ x: number; y: number }>,
  scenario?: PlaytestScenario,
): LlmActionPayload {
  const player = state.entities[playerId];
  if (!player?.position) return { action: 'WAIT' };
  const pos = player.position, grid = state.strata[pos.stratum];
  if (!grid) return { action: 'WAIT' };

  const invIds = player.inventory?.containedEntityIds ?? [];

  // Goal-conditioned scenario actions
  if (scenario === 'surgical') {
    const prosth = invIds.find((id) => state.entities[id]?.prostheticSpec);
    if (prosth && !player.anatomy?.limbs['LEFT_LEG']?.installedProstheticEntityId) {
      return { action: 'GRAFT_PROSTHETIC', prostheticId: prosth, slot: 'LEFT_LEG', reasoning: 'Surgical: Graft Strider Leg' };
    }
    const damaged = Object.entries(player.anatomy?.limbs ?? {}).find(([_, l]) => l.hp < l.maxHp);
    if (damaged) {
      return { action: 'FIELD_REPAIR_LIMB', slot: damaged[0] as 'HEAD' | 'TORSO' | 'LEFT_ARM' | 'RIGHT_ARM' | 'LEFT_LEG' | 'RIGHT_LEG', reasoning: 'Surgical: Repair damaged limb' };
    }
    const scrap = invIds.find((id) => (state.entities[id]?.item?.blueprintId ?? '').includes('plate') || (state.entities[id]?.name ?? '').toLowerCase().includes('scrap'));
    if (scrap) {
      return { action: 'SALVAGE_ITEM', itemId: scrap, reasoning: 'Surgical: Salvage scrap into gears' };
    }
    const boiler = Object.values(state.entities).find((e) => e.pressureVessel && !e.pressureVessel.ruptured && e.position?.stratum === pos.stratum && Math.abs((e.position?.x ?? 0) - pos.x) <= 1 && Math.abs((e.position?.y ?? 0) - pos.y) <= 1);
    if (boiler) {
      return { action: 'STOKE_BOILER', pressureKpa: 50, reasoning: 'Surgical: Stoke boiler' };
    }
  }

  if (scenario === 'sabotage') {
    const boiler = Object.values(state.entities).find((e) => e.pressureVessel && e.position?.stratum === pos.stratum && Math.abs((e.position?.x ?? 0) - pos.x) <= 1 && Math.abs((e.position?.y ?? 0) - pos.y) <= 1);
    if (boiler && !boiler.pressureVessel?.ruptured) {
      return { action: 'PRESSURIZE_VESSEL', vesselId: boiler.id, pressureKpa: 50, reasoning: 'Sabotage: Overpressurize boiler beyond 300 kPa' };
    }
    const merchant = Object.values(state.entities).find((e) => e.aiController?.role === 'MERCHANT' && e.position?.stratum === pos.stratum && Math.abs((e.position?.x ?? 0) - pos.x) <= 1 && Math.abs((e.position?.y ?? 0) - pos.y) <= 1);
    const coal = invIds.find((id) => (state.entities[id]?.item?.blueprintId ?? '').includes('anthracite') || (state.entities[id]?.name ?? '').toLowerCase().includes('coal'));
    if (merchant && coal) {
      return { action: 'SELL_TO_MERCHANT', merchantId: merchant.id, itemId: coal, quantity: 2, reasoning: 'Sabotage: Arbitrage high coal price' };
    }
  }

  if (scenario === 'safehouse_transit') {
    if (Object.keys(state.safehouses ?? {}).length === 0) {
      return { action: 'CLAIM_SAFEHOUSE', claimVault: true, reasoning: 'Safehouse: Claim vault deed' };
    }
    const coal = invIds.find((id) => (state.entities[id]?.item?.blueprintId ?? '').includes('anthracite') || (state.entities[id]?.name ?? '').toLowerCase().includes('coal'));
    if (coal && state.turnCount <= 10) {
      return { action: 'STOCK_PEDESTAL', commodity: 'ANTHRACITE_COAL', quantity: 2, askingPriceMarkupPct: 15, reasoning: 'Safehouse: Stock display pedestal' };
    }
    const monorail = Object.values(state.entities).find((e) => e.monorailCar && e.position?.stratum === pos.stratum && Math.abs((e.position?.x ?? 0) - pos.x) <= 1 && Math.abs((e.position?.y ?? 0) - pos.y) <= 1);
    if (monorail) {
      return { action: 'DISPATCH_MONORAIL', monorailId: monorail.id, destinationDistrictId: 'district_gilded_spire', reasoning: 'Transit: Dispatch inter-district monorail' };
    }
  }

  if (player.anatomy && state.turnCount % 5 === 0) {
    for (const [s, limb] of Object.entries(player.anatomy.limbs)) {
      const p = limb.installedProstheticEntityId ? state.entities[limb.installedProstheticEntityId] : undefined;
      if (p?.prostheticSpec?.activeAbility && (p.prostheticSpec.activeAbility.cooldownRemaining ?? 0) === 0 && ['HEAD', 'TORSO', 'LEFT_ARM', 'RIGHT_ARM', 'LEFT_LEG', 'RIGHT_LEG'].includes(s)) {
        return { action: 'ACTIVATE_PROSTHETIC', slot: s as 'HEAD' | 'TORSO' | 'LEFT_ARM' | 'RIGHT_ARM' | 'LEFT_LEG' | 'RIGHT_LEG', reasoning: 'Mock: Activate prosthetic' };
      }
    }
  }

  for (const ent of Object.values(state.entities)) {
    const isCorpse = ent.name.toLowerCase().includes('corpse') || ((ent.anatomy?.bloodVolumePct ?? 100) <= 0);
    if (isCorpse && ent.position && ent.position.stratum === pos.stratum && Math.abs(ent.position.x - pos.x) <= 1 && Math.abs(ent.position.y - pos.y) <= 1) {
      const tool = player.inventory?.containedEntityIds.find((id) => (state.entities[id]?.item?.blueprintId ?? '').includes('scalpel') || (state.entities[id]?.name ?? '').toLowerCase().includes('knife'));
      if (tool) return { action: 'HARVEST_CORPSE', corpseId: ent.id, toolId: tool, reasoning: 'Mock: Harvest corpse' };
    }
    if (ent.actor && !ent.actor.isPlayer && ent.aiController?.hostile && ent.position && ent.position.stratum === pos.stratum) {
      const dx = ent.position.x - pos.x, dy = ent.position.y - pos.y;
      if (Math.abs(dx) <= 1 && Math.abs(dy) <= 1) return { action: 'ATTACK', targetId: ent.id, limb: 'TORSO', reasoning: 'Mock: Attack' };
      if (Math.abs(dx) <= 4 && Math.abs(dy) <= 4 && (player.anatomy?.steamReserveKpa ?? 0) >= 30) return { action: 'VENT_STEAM', pressureKpa: 30, targetRelX: 0, targetRelY: 0, reasoning: 'Mock: Vent steam' };
    }
    if (ent.aiController?.role === 'MERCHANT' && ent.inventory?.containedEntityIds[0] && ent.position && ent.position.stratum === pos.stratum) {
      const dx = ent.position.x - pos.x, dy = ent.position.y - pos.y;
      if (Math.abs(dx) <= 1 && Math.abs(dy) <= 1) {
        return { action: 'BUY', merchantId: ent.id, itemId: ent.inventory.containedEntityIds[0], reasoning: 'Mock: Buy from merchant' };
      }
    }
  }

  if (findEntitiesAtPoint(state.entities, pos).some((e) => e.portal || e.districtGate)) return { action: 'USE_PORTAL', reasoning: 'Mock: Portal' };

  if ((player.anatomy?.bloodVolumePct ?? 100) < 85 && player.inventory) {
    const itm = player.inventory.containedEntityIds.find((id) => state.entities[id]?.item?.useEffect?.kind === 'RESTORE_BLOOD');
    if (itm) return { action: 'USE_ITEM', itemId: itm, reasoning: 'Mock: Heal' };
  }

  const validMoves: Array<{ dir: 'N' | 'S' | 'E' | 'W'; unvisited: boolean }> = [];
  for (const [dir, [dx, dy]] of Object.entries(DIR_VECTORS)) {
    if (dx !== 0 && dy !== 0) continue;
    const tx = pos.x + dx, ty = pos.y + dy, point: Point3D = { x: tx, y: ty, stratum: pos.stratum };
    const ents = findEntitiesAtPoint(state.entities, point), cell = getTileCell(grid, tx, ty);
    if (cell?.terrainType === 'WOODEN_DOOR_CLOSED') return { action: 'TOGGLE_DOOR', dx, dy, reasoning: 'Mock: Door' };
    if (!cell || cell.blocksMovement || ents.some((e) => e.position?.blocksMovement || e.trap?.armed)) continue;
    validMoves.push({ dir: dir as 'N' | 'S' | 'E' | 'W', unvisited: !recentPositions?.some((p) => p.x === tx && p.y === ty) });
  }
  const preferred = validMoves.find((m) => m.unvisited) ?? validMoves[0];
  return preferred ? { action: 'MOVE', dir: preferred.dir, reasoning: 'Mock: Move' } : { action: 'WAIT', reasoning: 'Mock: Wait' };
}
