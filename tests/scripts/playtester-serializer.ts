import { GameCommand } from '../../src/schemas/commands.schema.js';
import {
  BlueprintIdSchema,
  EntityId,
  EntityIdSchema,
  FactionIdSchema,
  LimbSlotId,
} from '../../src/schemas/primitives.schema.js';
import { getShiftPhase, WorldState } from '../../src/sim/core/world.js';
import { computeActorFovRadius, computeVisibleTiles } from '../../src/sim/spatial/fov.js';
import { findEntitiesAtPoint, getTileCell } from '../../src/sim/spatial/grid.js';
import {
  LIMB_ENUM,
  STRUCTURE_ENUM,
  LlmActionPayloadSchema,
  LlmActionPayload,
} from './playtester-actions.js';
export {
  LIMB_ENUM,
  STRUCTURE_ENUM,
  LlmActionPayloadSchema,
};
export type { LlmActionPayload };

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
  const invIds = player.inventory?.containedEntityIds ?? [];
  const prosthItem = invIds.find((id) => state.entities[id]?.prostheticSpec);
  if (prosthItem) {
    const spec = state.entities[prosthItem]?.prostheticSpec;
    if (spec) contextualCommands.push(`{"action": "INSTALL_PROSTHETIC", "prostheticId": "${prosthItem}", "slot": "${spec.targetLimbSlot}"}`);
  }
  const weaponEnt = invIds.find((id) => state.entities[id]?.equipmentSpec?.equipSlot === 'WIELD');
  const ammoEnt = invIds.find((id) => (state.entities[id]?.item?.blueprintId ?? '').includes('ammo') || (state.entities[id]?.name ?? '').toLowerCase().includes('ammo'));
  if (weaponEnt && ammoEnt) contextualCommands.push(`{"action": "LOAD_AMMO", "weaponId": "${weaponEnt}", "ammoId": "${ammoEnt}"}`);
  if (steam >= 20) contextualCommands.push('{"action": "VENT_STEAM", "pressureKpa": 30}');
  const safehouseList = Object.values(state.safehouses).map((s) => s.name).join(', ') || 'None';
  const codexCount = Object.keys(state.codex).length;
  if (codexCount > 0) contextualCommands.push('{"action": "CONSULT_CODEX"}');

  const primaryObj = options?.primaryObjective ?? 'Explore district and survive.';
  const secDir = options?.secondaryDirective ?? 'Interact with doors (+), avoid traps (^), vent steam (~).';
  const recentSteps = options?.recentPositions?.length ? options.recentPositions.map((p) => `(${p.x},${p.y})`).join(', ') : 'None';
  const feedbackBlock = options?.systemFeedback ? `[SYSTEM FEEDBACK]: ${options.systemFeedback}\n` : '';

  return `=== AETHER & SOOT [Turn ${state.turnCount} | Shift: ${shift}] ===
Primary Objective: ${primaryObj} | Secondary Directive: ${secDir}
[STRATUM]: ${pos.stratum} | [POS]: (${pos.x}, ${pos.y}) | [BLOOD]: ${blood}% | [STEAM]: ${steam}/${maxSteam} kPa
[SAFEHOUSES]: ${safehouseList} | [CODEX]: ${codexCount} entries discovered
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
            case 'ACCEPT_CONTRACT': return { type: 'ACCEPT_CONTRACT', actorId: playerId, contractId: EntityIdSchema.parse(p.contractId) };
            case 'APPLY_MOMENTUM_VECTOR': return { type: 'APPLY_MOMENTUM_VECTOR', targetId: EntityIdSchema.parse(p.targetId), dx: p.dx, dy: p.dy, distanceTiles: p.distanceTiles, massKg: p.massKg, sourceEntityId: playerId };
            case 'CLEAN_SPILL': return { type: 'CLEAN_SPILL', actorId: playerId, toolEntityId: EntityIdSchema.parse(p.toolId), target: { x: pos.x + p.targetRelX, y: pos.y + p.targetRelY, stratum: pos.stratum } };
            case 'COAT_WEAPON': return { type: 'COAT_WEAPON', actorId: playerId, weaponEntityId: EntityIdSchema.parse(p.weaponId), liquidContainerId: EntityIdSchema.parse(p.containerId) };
            case 'CLAIM_WORKSHOP_DEED': return { type: 'CLAIM_WORKSHOP_DEED', actorId: playerId, claimVault: p.claimVault };
            case 'BUILD_STRUCTURE': return { type: 'BUILD_STRUCTURE', actorId: playerId, structureType: p.structureType, target: { x: pos.x + p.targetRelX, y: pos.y + p.targetRelY, stratum: pos.stratum } };
            case 'STORE_ITEM': return { type: 'STORE_ITEM_IN_STRUCTURE', actorId: playerId, structureEntityId: EntityIdSchema.parse(p.structureId), itemEntityId: EntityIdSchema.parse(p.itemId) };
            case 'RETRIEVE_ITEM': return { type: 'RETRIEVE_ITEM_FROM_STRUCTURE', actorId: playerId, structureEntityId: EntityIdSchema.parse(p.structureId), itemEntityId: EntityIdSchema.parse(p.itemId) };
            case 'CONSULT_CODEX': return { type: 'CONSULT_CODEX', actorId: playerId, entryId: p.entryId };
            case 'DROP_ITEM': return { type: 'DROP_ITEM', actorId: playerId, itemEntityId: EntityIdSchema.parse(p.itemId), ...(p.quantity ? { quantity: p.quantity } : {}) };
            case 'CRAFT_RECIPE': return { type: 'CRAFT_RECIPE', actorId: playerId, recipeId: BlueprintIdSchema.parse(p.recipeId) };
            case 'COMPLETE_CONTRACT': return { type: 'COMPLETE_CONTRACT', actorId: playerId, contractId: EntityIdSchema.parse(p.contractId) };
            case 'DAMAGE_LIMB': return { type: 'DAMAGE_LIMB', actorId: playerId, targetId: EntityIdSchema.parse(p.targetId), slot: p.slot as LimbSlotId, damage: p.damage };
            case 'HIRE_COMPANION': return { type: 'HIRE_COMPANION', actorId: playerId, npcId: EntityIdSchema.parse(p.npcId) };
            case 'INITIATE_TURF_SKIRMISH': return { type: 'INITIATE_TURF_SKIRMISH', actorId: playerId, turfId: p.turfId };
            case 'PREPARE_SUPPLY_CONVOY': return { type: 'PREPARE_SUPPLY_CONVOY', actorId: playerId, cargoItemId: EntityIdSchema.parse(p.cargoItemId), clientFactionId: FactionIdSchema.parse(p.clientFactionId), destinationDistrictId: p.destinationDistrictId, ...(p.rewardPence !== undefined ? { rewardPence: p.rewardPence } : {}) };
            case 'AUDIT_SAFEHOUSE_DEED': return { type: 'AUDIT_SAFEHOUSE_DEED', actorId: playerId, inspectorId: EntityIdSchema.parse(p.inspectorId), deedId: p.deedId };
            case 'EMIT_SPARK': return { type: 'EMIT_SPARK', actorId: playerId, target: { x: pos.x + p.targetRelX, y: pos.y + p.targetRelY, stratum: pos.stratum } };
            case 'INSTALL_PROSTHETIC': return { type: 'INSTALL_PROSTHETIC', actorId: playerId, prostheticEntityId: EntityIdSchema.parse(p.prostheticId), slot: p.slot as LimbSlotId };
            case 'INSTALL_WEAPON_MOD': return { type: 'INSTALL_WEAPON_MOD', actorId: playerId, weaponEntityId: EntityIdSchema.parse(p.weaponId), modEntityId: EntityIdSchema.parse(p.modId) };
            case 'LOAD_AMMO': return { type: 'LOAD_AMMO', actorId: playerId, weaponEntityId: EntityIdSchema.parse(p.weaponId), ammoEntityId: EntityIdSchema.parse(p.ammoId) };
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

export { generateMockAction } from './playtester-mock.js';
