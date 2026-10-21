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
  NORTH: 'N', UP: 'N', SOUTH: 'S', DOWN: 'S', EAST: 'E', RIGHT: 'E', WEST: 'W', LEFT: 'W',
  NORTHEAST: 'NE', NORTHWEST: 'NW', SOUTHEAST: 'SE', SOUTHWEST: 'SW',
};

export function normalizeDirection(raw: string): string | undefined {
  const norm = raw.trim().toUpperCase().replace(/[^A-Z]/g, '');
  return DIR_VECTORS[norm] ? norm : CARDINAL_MAP[norm];
}

export const LlmActionPayloadSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('MOVE'), dir: z.enum(['N', 'S', 'E', 'W', 'NE', 'NW', 'SE', 'SW']), reasoning: z.string().optional() }),
  z.object({ action: z.literal('WAIT'), reasoning: z.string().optional() }),
  z.object({ action: z.literal('ATTACK'), targetId: z.string(), limb: z.enum(['HEAD', 'TORSO', 'LEFT_ARM', 'RIGHT_ARM', 'LEFT_LEG', 'RIGHT_LEG']).optional(), reasoning: z.string().optional() }),
  z.object({ action: z.literal('TOGGLE_DOOR'), dx: z.number().int().min(-1).max(1), dy: z.number().int().min(-1).max(1), reasoning: z.string().optional() }),
  z.object({ action: z.literal('VENT_STEAM'), pressureKpa: z.number().positive().default(50), targetRelX: z.number().int().default(0), targetRelY: z.number().int().default(0), reasoning: z.string().optional() }),
  z.object({ action: z.literal('USE_ITEM'), itemId: z.string(), reasoning: z.string().optional() }),
  z.object({ action: z.literal('BREACH_TILE'), dx: z.number().int().min(-1).max(1), dy: z.number().int().min(-1).max(1), reasoning: z.string().optional() }),
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
  const visibleThreats: string[] = [];
  const adjacentInteractables: string[] = [];

  for (let dy = -5; dy <= 5; dy++) {
    const rowHeader = dy >= 0 ? `+${dy}` : `${dy}`;
    let row = `${rowHeader.padStart(2, ' ')} `;
    for (let dx = -5; dx <= 5; dx++) {
      const tx = pos.x + dx;
      const ty = pos.y + dy;
      const isVis = visible.has(`${tx},${ty}`);
      if (dx === 0 && dy === 0) { row += ' @ '; continue; }
      if (!isVis) { row += ' ? '; continue; }
      const entities = findEntitiesAtPoint(state.entities, { x: tx, y: ty, stratum: pos.stratum });
      const cell = getTileCell(grid, tx, ty);
      const enemy = entities.find((e) => e.actor && !e.actor.isPlayer);
      const trap = entities.find((e) => e.trap?.armed);
      const boiler = entities.find((e) => e.pressureVessel);

      if (enemy) {
        row += enemy.aiController?.hostile ? ' G ' : ' N ';
        const alert = enemy.aiController?.alertState ?? 'IDLE';
        visibleThreats.push(`${enemy.name} (id: '${enemy.id}') at rel (${dx}, ${dy}) | Alert: ${alert}`);
      } else if (trap) row += ' ^ ';
      else if (boiler) row += ' B ';
      else if (cell?.terrainType === 'WOODEN_DOOR_CLOSED') row += ' + ';
      else if (cell?.terrainType === 'WOODEN_DOOR_OPEN') row += " ' ";
      else if ((cell?.steamPressureKpa ?? 0) >= 20 || (cell?.coalDustDensity ?? 0) >= 0.3) row += ' ~ ';
      else if (cell?.terrainType === 'SOOT_BRICK_WALL') row += ' # ';
      else if (cell?.terrainType === 'RUBBLE_PILE') row += ' , ';
      else if (cell?.terrainType === 'ABYSS_DROP') row += ' O ';
      else row += ' . ';

      if (Math.abs(dx) <= 1 && Math.abs(dy) <= 1 && (dx !== 0 || dy !== 0)) {
        if (cell?.terrainType === 'WOODEN_DOOR_CLOSED') adjacentInteractables.push(`Door (CLOSED) at (${dx}, ${dy}) -> Action: TOGGLE_DOOR`);
        if (cell?.terrainType === 'WOODEN_DOOR_OPEN') adjacentInteractables.push(`Door (OPEN) at (${dx}, ${dy})`);
        if (trap) adjacentInteractables.push(`Trap (${trap.trap?.trapKind}) at (${dx}, ${dy}) -> AVOID`);
        if (boiler) adjacentInteractables.push(`Boiler (${boiler.pressureVessel?.currentPressureKpa} kPa) at (${dx}, ${dy})`);
      }
    }
    fovRows += `${row}\n`;
  }

  const recentSounds = state.eventLog.slice(-15)
    .filter((e) => e.type === 'SOUND_EMITTED')
    .map((s) => `[Turn ${s.turn}] ${s.decibels} dB sound at (${s.origin.x - pos.x}, ${s.origin.y - pos.y})`)
    .slice(-3);

  const primaryObj = options?.primaryObjective ?? 'Explore the district, uncover unvisited tiles, and survive.';
  const secDir = options?.secondaryDirective ?? 'Interact with closed doors (+), avoid armed traps (^), and vent steam (~) to break line-of-sight when hostiles (G) approach.';
  const recentSteps = options?.recentPositions?.length ? options.recentPositions.map((p) => `(${p.x},${p.y})`).join(', ') : 'None';
  const feedbackBlock = options?.systemFeedback ? `[SYSTEM FEEDBACK]: ${options.systemFeedback}\n` : '';

  return `=== AETHER & SOOT [Turn ${state.turnCount} | Shift: ${shift}] ===
Primary Objective: ${primaryObj}
Secondary Directive: ${secDir}
[STRATUM]: ${pos.stratum} | [POS]: (${pos.x}, ${pos.y}) | [BLOOD]: ${blood}% | [STEAM]: ${steam}/${maxSteam} kPa
[Recent Steps: ${recentSteps}]
${feedbackBlock}[LOCAL SENSORY FOV (11x11 Grid, Relative Centered on '@')]:
${fovRows}[RECENT ACOUSTIC SOUNDS]:
${recentSounds.length > 0 ? recentSounds.join('\n') : 'None in range.'}
[VISIBLE THREATS]:
${visibleThreats.length > 0 ? visibleThreats.join('\n') : 'No visible threats.'}
[ADJACENT INTERACTABLES]:
${adjacentInteractables.length > 0 ? adjacentInteractables.join('\n') : 'None.'}`;
}

export function parseLlmResponseToCommand(raw: string, state: WorldState, playerId: EntityId = EntityIdSchema.parse('actor_player')): GameCommand {
  const fallback: GameCommand = { type: 'WAIT_TURN', actorId: playerId }, player = state.entities[playerId];
  if (!player?.position) return fallback;
  const pos = player.position;

  try {
    const cleaned = raw.replace(/```json/gi, '').replace(/```/g, '').trim();

    // 1. Structured JSON parsing
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (match) {
      let rawObj: any;
      try { rawObj = JSON.parse(match[0]); } catch { rawObj = JSON.parse(match[0].replace(/'/g, '"')); }
      if (rawObj && typeof rawObj === 'object') {
        const parsed = LlmActionPayloadSchema.safeParse(rawObj);
        if (parsed.success) {
          const p = parsed.data;
          if (p.action === 'MOVE') return { type: 'MOVE_STEP', actorId: playerId, dx: DIR_VECTORS[p.dir]![0], dy: DIR_VECTORS[p.dir]![1] };
          if (p.action === 'WAIT') return fallback;
          if (p.action === 'ATTACK') return { type: 'ATTACK_ACTOR', attackerId: playerId, targetId: EntityIdSchema.parse(p.targetId), targetSlot: (p.limb as LimbSlotId) ?? 'TORSO' };
          if (p.action === 'TOGGLE_DOOR') return { type: 'TOGGLE_DOOR', actorId: playerId, target: { x: pos.x + p.dx, y: pos.y + p.dy, stratum: pos.stratum } };
          if (p.action === 'VENT_STEAM') return { type: 'VENT_STEAM', actorId: playerId, target: { x: pos.x + p.targetRelX, y: pos.y + p.targetRelY, stratum: pos.stratum }, pressureReleasedKpa: p.pressureKpa };
          if (p.action === 'USE_ITEM') return { type: 'USE_ITEM', actorId: playerId, itemEntityId: EntityIdSchema.parse(p.itemId) };
          if (p.action === 'BREACH_TILE') return { type: 'BREACH_TILE', actorId: playerId, target: { x: pos.x + p.dx, y: pos.y + p.dy, stratum: pos.stratum } };
        }

        const actionStr = String(rawObj.action || '').toUpperCase();
        if (actionStr === 'TOGGLE_DOOR') {
          const tdx = Math.sign(Number(rawObj.dx ?? 0));
          const tdy = Math.sign(Number(rawObj.dy ?? 0));
          return { type: 'TOGGLE_DOOR', actorId: playerId, target: { x: pos.x + tdx, y: pos.y + tdy, stratum: pos.stratum } };
        }

        const dirStr = String(rawObj.dir || rawObj.direction || rawObj.heading || '');
        const normDir = normalizeDirection(dirStr);
        if (normDir && DIR_VECTORS[normDir]) {
          const [dx, dy] = DIR_VECTORS[normDir]!;
          return { type: 'MOVE_STEP', actorId: playerId, dx, dy };
        }

        if (actionStr === 'MOVE' || !actionStr) {
          if (rawObj.dx !== undefined || rawObj.dy !== undefined || rawObj.x !== undefined || rawObj.y !== undefined) {
            const rawDx = Number(rawObj.dx ?? rawObj.x ?? 0);
            const rawDy = Number(rawObj.dy ?? rawObj.y ?? 0);
            const dx = Math.abs(rawDx) <= 1 ? rawDx : Math.sign(rawDx - pos.x);
            const dy = Math.abs(rawDy) <= 1 ? rawDy : Math.sign(rawDy - pos.y);
            if (dx !== 0 || dy !== 0) return { type: 'MOVE_STEP', actorId: playerId, dx, dy };
          }
        }
      }
    }

    // 2. Resilient text fallbacks (e.g. "MOVE 0 1", "MOVE: 26,15", "MOVE: NORTH")
    const coordMatch = cleaned.match(/\bMOVE[^\d\-+]*?\(?\s*(-?\d+)[,\s:]+(-?\d+)\s*\)?/i);
    if (coordMatch) {
      const n1 = Number(coordMatch[1]);
      const n2 = Number(coordMatch[2]);
      const dx = Math.abs(n1) <= 1 && Math.abs(n2) <= 1 ? n1 : Math.sign(n1 - pos.x);
      const dy = Math.abs(n1) <= 1 && Math.abs(n2) <= 1 ? n2 : Math.sign(n2 - pos.y);
      if (dx !== 0 || dy !== 0) return { type: 'MOVE_STEP', actorId: playerId, dx, dy };
    }

    const textDirMatch = cleaned.match(/\bMOVE[^\w]*?["']?([A-Za-z]+)["']?/i);
    if (textDirMatch && textDirMatch[1]) {
      const norm = normalizeDirection(textDirMatch[1]);
      if (norm && DIR_VECTORS[norm]) {
        const [dx, dy] = DIR_VECTORS[norm]!;
        return { type: 'MOVE_STEP', actorId: playerId, dx, dy };
      }
    }

    if (/\b(VENT|STEAM)\b/i.test(cleaned)) {
      return { type: 'VENT_STEAM', actorId: playerId, target: { x: pos.x, y: pos.y, stratum: pos.stratum }, pressureReleasedKpa: 30 };
    }
  } catch {
    return fallback;
  }
  return fallback;
}

export function generateMockAction(
  state: WorldState,
  playerId: EntityId = EntityIdSchema.parse('actor_player'),
  recentPositions?: ReadonlyArray<{ x: number; y: number }>,
): LlmActionPayload {
  const player = state.entities[playerId];
  if (!player || !player.position) return { action: 'WAIT' };
  const pos = player.position;
  const grid = state.strata[pos.stratum];
  if (!grid) return { action: 'WAIT' };

  for (const ent of Object.values(state.entities)) {
    if (ent.actor && !ent.actor.isPlayer && ent.aiController?.hostile && ent.position && ent.position.stratum === pos.stratum) {
      const dx = ent.position.x - pos.x;
      const dy = ent.position.y - pos.y;
      if (Math.abs(dx) <= 1 && Math.abs(dy) <= 1) {
        return { action: 'ATTACK', targetId: ent.id, limb: 'TORSO', reasoning: 'Mock: Melee adjacent hostile guard' };
      }
      if (Math.abs(dx) <= 4 && Math.abs(dy) <= 4 && (player.anatomy?.steamReserveKpa ?? 0) >= 30) {
        return { action: 'VENT_STEAM', pressureKpa: 30, targetRelX: 0, targetRelY: 0, reasoning: 'Mock: Vent steam cloud for visual cover' };
      }
    }
  }

  const validMoves: Array<{ dir: 'N' | 'S' | 'E' | 'W'; unvisited: boolean }> = [];
  for (const [dir, [dx, dy]] of Object.entries(DIR_VECTORS)) {
    if (dx !== 0 && dy !== 0) continue;
    const tx = pos.x + dx;
    const ty = pos.y + dy;
    const point: Point3D = { x: tx, y: ty, stratum: pos.stratum };
    const ents = findEntitiesAtPoint(state.entities, point);
    const cell = getTileCell(grid, tx, ty);
    if (cell?.terrainType === 'WOODEN_DOOR_CLOSED') {
      return { action: 'TOGGLE_DOOR', dx, dy, reasoning: 'Mock: Open adjacent closed door' };
    }
    if (ents.some((e) => e.trap?.armed)) continue;
    if (cell && !cell.blocksMovement && !ents.some((e) => e.position?.blocksMovement)) {
      const wasRecent = recentPositions?.some((p) => p.x === tx && p.y === ty) ?? false;
      validMoves.push({ dir: dir as 'N' | 'S' | 'E' | 'W', unvisited: !wasRecent });
    }
  }
  const preferred = validMoves.find((m) => m.unvisited) ?? validMoves[0];
  if (preferred) {
    return { action: 'MOVE', dir: preferred.dir, reasoning: 'Mock: Advance to open tile' };
  }
  return { action: 'WAIT', reasoning: 'Mock: Stand ground' };
}
