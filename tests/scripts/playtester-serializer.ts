import { z } from 'zod';
import { GameCommand } from '../../src/schemas/commands.schema.js';
import { EntityId, EntityIdSchema, LimbSlotId, Point3D } from '../../src/schemas/primitives.schema.js';
import { getShiftPhase, WorldState } from '../../src/sim/core/world.js';
import { computeActorFovRadius, computeVisibleTiles } from '../../src/sim/spatial/fov.js';
import { findEntitiesAtPoint, getTileCell } from '../../src/sim/spatial/grid.js';

export const DIR_VECTORS: Record<string, [number, number]> = {
  N: [0, -1], S: [0, 1], E: [1, 0], W: [-1, 0], NE: [1, -1], NW: [-1, -1], SE: [1, 1], SW: [-1, 1],
};

const CARDINAL_MAP: Record<string, string> = {
  NORTH: 'N', UP: 'N', SOUTH: 'S', DOWN: 'S', EAST: 'E', RIGHT: 'E', WEST: 'W', LEFT: 'W', NORTHEAST: 'NE', NORTHWEST: 'NW', SOUTHEAST: 'SE', SOUTHWEST: 'SW',
};

export function normalizeDirection(raw: string): string | undefined {
  const norm = raw.trim().toUpperCase().replace(/[^A-Z]/g, '');
  return DIR_VECTORS[norm] ? norm : CARDINAL_MAP[norm];
}

const LIMB_ENUM = z.enum(['HEAD', 'TORSO', 'LEFT_ARM', 'RIGHT_ARM', 'LEFT_LEG', 'RIGHT_LEG']);
export const LlmActionPayloadSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('MOVE'), dir: z.enum(['N', 'S', 'E', 'W', 'NE', 'NW', 'SE', 'SW']), reasoning: z.string().optional() }), z.object({ action: z.literal('WAIT'), reasoning: z.string().optional() }),
  z.object({ action: z.literal('ATTACK'), targetId: z.string(), limb: LIMB_ENUM.optional(), reasoning: z.string().optional() }), z.object({ action: z.literal('TOGGLE_DOOR'), dx: z.number().int().min(-1).max(1), dy: z.number().int().min(-1).max(1), reasoning: z.string().optional() }),
  z.object({ action: z.literal('VENT_STEAM'), pressureKpa: z.number().positive().default(50), targetRelX: z.number().int().default(0), targetRelY: z.number().int().default(0), reasoning: z.string().optional() }), z.object({ action: z.literal('USE_ITEM'), itemId: z.string(), reasoning: z.string().optional() }),
  z.object({ action: z.literal('BREACH_TILE'), dx: z.number().int().min(-1).max(1), dy: z.number().int().min(-1).max(1), reasoning: z.string().optional() }), z.object({ action: z.literal('USE_PORTAL'), reasoning: z.string().optional() }),
  z.object({ action: z.literal('BUY'), merchantId: z.string(), itemId: z.string(), quantity: z.number().int().positive().optional(), reasoning: z.string().optional() }), z.object({ action: z.literal('PICK_UP'), itemId: z.string().optional(), reasoning: z.string().optional() }),
  z.object({ action: z.literal('ACTIVATE_PROSTHETIC'), slot: LIMB_ENUM, targetRelX: z.number().int().optional(), targetRelY: z.number().int().optional(), reasoning: z.string().optional() }), z.object({ action: z.literal('HARVEST_CORPSE'), corpseId: z.string(), toolId: z.string(), slot: LIMB_ENUM.optional(), reasoning: z.string().optional() }),
]);
export type LlmActionPayload = z.infer<typeof LlmActionPayloadSchema>;

export interface ContextSerializationOptions {
  readonly recentPositions?: ReadonlyArray<{ x: number; y: number }> | undefined;
  readonly systemFeedback?: string | undefined;
  readonly primaryObjective?: string | undefined;
  readonly secondaryDirective?: string | undefined;
}

export function serializePlayerContext(
  state: WorldState,
  playerId: EntityId = EntityIdSchema.parse('actor_player'),
  options?: ContextSerializationOptions,
): string {
  const player = state.entities[playerId];
  if (!player?.position) return '[ERROR]: Player entity unavailable.';
  const pos = player.position;
  const grid = state.strata[pos.stratum];
  if (!grid) return '[ERROR]: Stratum grid unavailable.';

  const fovRadius = computeActorFovRadius(player, 8);
  const visible = computeVisibleTiles(grid, pos.x, pos.y, fovRadius);
  const shift = getShiftPhase(state.turnCount);
  const blood = player.anatomy?.bloodVolumePct ?? 100;
  const steam = player.anatomy?.steamReserveKpa ?? 0, maxSteam = player.anatomy?.maxSteamReserveKpa ?? 100;

  let fovRows = '   -5 -4 -3 -2 -1  0 +1 +2 +3 +4 +5\n';
  const visibleThreats: string[] = [], adjacentInteractables: string[] = [];

  for (let dy = -5; dy <= 5; dy++) {
    let row = `${(dy >= 0 ? `+${dy}` : `${dy}`).padStart(2, ' ')} `;
    for (let dx = -5; dx <= 5; dx++) {
      const tx = pos.x + dx, ty = pos.y + dy;
      if (dx === 0 && dy === 0) { row += ' @ '; continue; }
      if (!visible.has(`${tx},${ty}`)) { row += ' ? '; continue; }
      const entities = findEntitiesAtPoint(state.entities, { x: tx, y: ty, stratum: pos.stratum });
      const cell = getTileCell(grid, tx, ty);
      const enemy = entities.find((e) => e.actor && !e.actor.isPlayer);
      if (enemy) {
        row += enemy.aiController?.hostile ? ' G ' : ' N ';
        visibleThreats.push(`${enemy.name} (id: '${enemy.id}') at rel (${dx}, ${dy}) | Alert: ${enemy.aiController?.alertState ?? 'IDLE'}`);
      } else if (entities.some((e) => e.trap?.armed)) row += ' ^ ';
      else if (entities.some((e) => e.pressureVessel)) row += ' B ';
      else if (cell?.terrainType === 'WOODEN_DOOR_CLOSED') { row += ' + '; if (Math.abs(dx) <= 1 && Math.abs(dy) <= 1 && (dx !== 0 || dy !== 0)) adjacentInteractables.push(`Door (CLOSED) at (${dx}, ${dy}) -> TOGGLE_DOOR`); }
      else if (cell?.terrainType === 'WOODEN_DOOR_OPEN') row += " ' ";
      else if ((cell?.steamPressureKpa ?? 0) >= 20 || (cell?.coalDustDensity ?? 0) >= 0.3) row += ' ~ ';
      else if (cell?.terrainType === 'SOOT_BRICK_WALL') row += ' # ';
      else if (cell?.terrainType === 'RUBBLE_PILE') row += ' , ';
      else if (cell?.terrainType === 'ABYSS_DROP') row += ' O ';
      else row += ' . ';
    }
    fovRows += `${row}\n`;
  }

  const recentSounds = state.eventLog.slice(-15).filter((e) => e.type === 'SOUND_EMITTED')
    .map((s) => `[Turn ${s.turn}] ${s.decibels} dB sound at (${s.origin.x - pos.x}, ${s.origin.y - pos.y})`).slice(-3);

  const contextualCommands: string[] = [];
  const groundEntities = findEntitiesAtPoint(state.entities, pos);
  if (groundEntities.some((e) => e.portal || e.districtGate)) contextualCommands.push('{"action": "USE_PORTAL"}');
  const groundItem = groundEntities.find((e) => e.item);
  if (groundItem) contextualCommands.push(`{"action": "PICK_UP", "itemId": "${groundItem.id}"}`);

  for (const ent of Object.values(state.entities)) {
    if (!ent.position || ent.position.stratum !== pos.stratum) continue;
    const dx = ent.position.x - pos.x, dy = ent.position.y - pos.y;
    if (Math.abs(dx) <= 1 && Math.abs(dy) <= 1) {
      if (ent.actor && !ent.actor.isPlayer && ent.aiController?.hostile && (dx !== 0 || dy !== 0)) contextualCommands.push(`{"action": "ATTACK", "targetId": "${ent.id}", "limb": "TORSO"}`);
      if (ent.aiController?.role === 'MERCHANT' && ent.inventory?.containedEntityIds[0]) contextualCommands.push(`{"action": "BUY", "merchantId": "${ent.id}", "itemId": "${ent.inventory.containedEntityIds[0]}"}`);
      const isCorpse = ent.name.toLowerCase().includes('corpse') || ((ent.anatomy?.bloodVolumePct ?? 100) <= 0);
      if (isCorpse && player.inventory) {
        const tool = player.inventory.containedEntityIds.find((id) => (state.entities[id]?.item?.blueprintId ?? '').includes('scalpel') || (state.entities[id]?.name ?? '').toLowerCase().includes('knife'));
        if (tool) contextualCommands.push(`{"action": "HARVEST_CORPSE", "corpseId": "${ent.id}", "toolId": "${tool}"}`);
      }
    }
  }

  if (player.anatomy) {
    for (const [s, limb] of Object.entries(player.anatomy.limbs)) {
      const p = limb.installedProstheticEntityId ? state.entities[limb.installedProstheticEntityId] : undefined;
      if (p?.prostheticSpec?.activeAbility && (p.prostheticSpec.activeAbility.cooldownRemaining ?? 0) === 0 && ['HEAD', 'TORSO', 'LEFT_ARM', 'RIGHT_ARM', 'LEFT_LEG', 'RIGHT_LEG'].includes(s)) {
        contextualCommands.push(`{"action": "ACTIVATE_PROSTHETIC", "slot": "${s}"}`);
      }
    }
  }

  const consumable = player.inventory?.containedEntityIds.find((id) => state.entities[id]?.item?.useEffect);
  if (consumable) contextualCommands.push(`{"action": "USE_ITEM", "itemId": "${consumable}"}`);
  if (steam >= 20) contextualCommands.push('{"action": "VENT_STEAM", "pressureKpa": 30}');

  const primaryObj = options?.primaryObjective ?? 'Explore district and survive.';
  const secDir = options?.secondaryDirective ?? 'Interact with doors (+), avoid traps (^), vent steam (~).';
  const recentSteps = options?.recentPositions?.length ? options.recentPositions.map((p) => `(${p.x},${p.y})`).join(', ') : 'None';
  const feedbackBlock = options?.systemFeedback ? `[SYSTEM FEEDBACK]: ${options.systemFeedback}\n` : '';

  return `=== AETHER & SOOT [Turn ${state.turnCount} | Shift: ${shift}] ===
Primary Objective: ${primaryObj} | Secondary Directive: ${secDir}
[STRATUM]: ${pos.stratum} | [POS]: (${pos.x}, ${pos.y}) | [BLOOD]: ${blood}% | [STEAM]: ${steam}/${maxSteam} kPa
[Recent Steps: ${recentSteps}]
${feedbackBlock}[LOCAL SENSORY FOV (11x11 Grid, Relative Centered on '@')]:
${fovRows}[RECENT ACOUSTIC SOUNDS]:\n${recentSounds.length > 0 ? recentSounds.join('\n') : 'None in range.'}
[VISIBLE THREATS]:\n${visibleThreats.length > 0 ? visibleThreats.join('\n') : 'No visible threats.'}
[ADJACENT INTERACTABLES]:\n${adjacentInteractables.length > 0 ? adjacentInteractables.join('\n') : 'None.'}
[AVAILABLE CONTEXTUAL COMMANDS]:\n${contextualCommands.length > 0 ? contextualCommands.map((c) => `- ${c}`).join('\n') : '- {"action": "MOVE", "dir": "N|S|E|W"}\n- {"action": "WAIT"}'}`;
}

export function parseLlmResponseToCommand(raw: string, state: WorldState, playerId: EntityId = EntityIdSchema.parse('actor_player')): GameCommand {
  const fallback: GameCommand = { type: 'WAIT_TURN', actorId: playerId }, player = state.entities[playerId];
  if (!player?.position) return fallback;
  const pos = player.position;

  try {
    const cleaned = raw.replace(/```json/gi, '').replace(/```/g, '').trim();
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (match) {
      let rawObj: Record<string, unknown> | undefined;
      try { rawObj = JSON.parse(match[0]) as Record<string, unknown>; } catch {
        rawObj = JSON.parse(match[0].replace(/'/g, '"')) as Record<string, unknown>;
      }
      if (rawObj && typeof rawObj === 'object') {
        const actionStr = String(rawObj.action || '').toUpperCase();
        if (actionStr === 'TOGGLE_DOOR') return { type: 'TOGGLE_DOOR', actorId: playerId, target: { x: pos.x + Math.sign(Number(rawObj.dx ?? 0)), y: pos.y + Math.sign(Number(rawObj.dy ?? 0)), stratum: pos.stratum } };
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
            case 'PICK_UP': return { type: 'PICK_UP_ITEM', actorId: playerId, ...(p.itemId ? { itemEntityId: EntityIdSchema.parse(p.itemId) } : {}) };
            case 'ACTIVATE_PROSTHETIC': return { type: 'ACTIVATE_PROSTHETIC', actorId: playerId, slot: p.slot as LimbSlotId, ...(p.targetRelX !== undefined && p.targetRelY !== undefined ? { direction: { dx: Math.sign(p.targetRelX), dy: Math.sign(p.targetRelY) } } : {}) };
            case 'HARVEST_CORPSE': return { type: 'HARVEST_CORPSE', actorId: playerId, corpseEntityId: EntityIdSchema.parse(p.corpseId), toolEntityId: EntityIdSchema.parse(p.toolId), ...(p.slot ? { slot: p.slot as LimbSlotId } : {}) };
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
    if (/\b(VENT|STEAM)\b/i.test(cleaned)) return { type: 'VENT_STEAM', actorId: playerId, target: { x: pos.x, y: pos.y, stratum: pos.stratum }, pressureReleasedKpa: 30 };
    if (/\b(PORTAL|STAIRS|TRANSIT|ENTER)\b/i.test(cleaned)) return { type: 'USE_PORTAL', actorId: playerId };
    if (/\b(BUY|PURCHASE)\b/i.test(cleaned)) {
      const m = Object.values(state.entities).find((e) => e.aiController?.role === 'MERCHANT' && e.position?.stratum === pos.stratum && Math.abs(e.position.x - pos.x) <= 1 && Math.abs(e.position.y - pos.y) <= 1);
      if (m?.inventory?.containedEntityIds[0]) return { type: 'BUY_FROM_MERCHANT', actorId: playerId, merchantId: m.id, itemEntityId: m.inventory.containedEntityIds[0] };
    }
  } catch { return fallback; }
  return fallback;
}

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
