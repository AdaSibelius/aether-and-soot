import { EntityId, EntityIdSchema, Point3D } from '../../src/schemas/primitives.schema.js';
import { WorldState } from '../../src/sim/core/world.js';
import { findEntitiesAtPoint, getTileCell } from '../../src/sim/spatial/grid.js';
import { DIR_VECTORS, LlmActionPayload } from './playtester-serializer.js';

export function generateMockAction(
  state: WorldState,
  playerId: EntityId = EntityIdSchema.parse('actor_player'),
  recentPositions?: ReadonlyArray<{ x: number; y: number }>,
): LlmActionPayload {
  const player = state.entities[playerId];
  if (!player?.position) return { action: 'WAIT' };
  const pos = player.position, grid = state.strata[pos.stratum];
  if (!grid) return { action: 'WAIT' };

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
