import { EntityId, EntityIdSchema } from '../../src/schemas/primitives.schema.js';
import { getShiftPhase, WorldState } from '../../src/sim/core/world.js';
import { computeActorFovRadius, computeVisibleTiles } from '../../src/sim/spatial/fov.js';
import { findEntitiesAtPoint, getTileCell } from '../../src/sim/spatial/grid.js';
import {
  LIMB_ENUM,
  STRUCTURE_ENUM,
  LlmActionPayloadSchema,
  LlmActionPayload,
} from './playtester-actions.js';
import { DIR_VECTORS, normalizeDirection } from './playtester-common.js';
import { parseLlmResponseToCommand } from './playtester-dispatcher.js';
import {
  auditClientProjection,
  ClientProjectionAudit,
  AuditProjectionOptions,
  ProjectionLeak,
} from './playtester-projection-audit.js';

export {
  LIMB_ENUM,
  STRUCTURE_ENUM,
  LlmActionPayloadSchema,
  DIR_VECTORS,
  normalizeDirection,
  parseLlmResponseToCommand,
  auditClientProjection,
};

export type { LlmActionPayload, ClientProjectionAudit, ProjectionLeak };

export interface LastTurnContextSummary {
  readonly stratum: string;
  readonly blood: number;
  readonly steam: number;
  readonly safehouses: string;
  readonly codexCount: number;
}

export interface ContextSerializationOptions extends AuditProjectionOptions {
  readonly recentPositions?: ReadonlyArray<{ x: number; y: number }> | undefined;
  readonly systemFeedback?: string | undefined;
  readonly primaryObjective?: string | undefined;
  readonly secondaryDirective?: string | undefined;
  readonly lastTurnContext?: LastTurnContextSummary | undefined;
  readonly rawFovGrid?: boolean | undefined;
}

const TERRAIN_GLYPH: Partial<Record<string, string>> = {
  SOOT_BRICK_WALL: ' # ', WOODEN_DOOR_OPEN: " ' ", RUBBLE_PILE: ' , ', ABYSS_DROP: ' O ',
  WROUGHT_IRON_FENCE: ' ▓ ', BRASS_STEAM_PIPE: ' ┼ ', GASLAMP_POST: ' ☼ ', TIMBER_PIER: ' ═ ',
  SLAG_MOUND: ' ▲ ', CANAL_SLUICE: ' ≈ ', GOTHIC_COLONNADE: ' Ω ',
  WALL_CROSS: ' ╬ ', WALL_VERTICAL: ' ║ ', WALL_HORIZONTAL: ' ═ ',
};

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

  // Attach client UI projection audit on every simulation tick
  const audit = auditClientProjection(state, playerId, options);
  (state as { clientProjectionAudit?: ClientProjectionAudit }).clientProjectionAudit = audit;

  const fovRadius = computeActorFovRadius(player, 8);
  const visible = computeVisibleTiles(grid, pos.x, pos.y, fovRadius);
  const shift = getShiftPhase(state.turnCount);
  const blood = player.anatomy?.bloodVolumePct ?? 100;
  const steam = player.anatomy?.steamReserveKpa ?? 0, maxSteam = player.anatomy?.maxSteamReserveKpa ?? 100;

  const visibleThreats: string[] = [];
  const adjacentInteractables: string[] = [];
  const visibleObstacles: Array<{ name: string; glyph: string; dx: number; dy: number }> = [];

  for (let dy = -5; dy <= 5; dy++) {
    for (let dx = -5; dx <= 5; dx++) {
      if (dx === 0 && dy === 0) continue;
      const tx = pos.x + dx, ty = pos.y + dy;
      if (!visible.has(`${tx},${ty}`)) continue;
      const entities = findEntitiesAtPoint(state.entities, { x: tx, y: ty, stratum: pos.stratum });
      const cell = getTileCell(grid, tx, ty);
      const enemy = entities.find((e) => e.actor && !e.actor.isPlayer);
      if (enemy) {
        visibleThreats.push(`${enemy.name} (id: '${enemy.id}') at (${dx}, ${dy}) | Alert: ${enemy.aiController?.alertState ?? 'IDLE'}`);
      } else if (entities.some((e) => e.trap?.armed)) {
        visibleObstacles.push({ name: 'TRAP', glyph: '^', dx, dy });
      } else if (entities.some((e) => e.landmark)) {
        visibleObstacles.push({ name: 'LANDMARK', glyph: 'L', dx, dy });
      } else if (entities.some((e) => e.pressureVessel)) {
        visibleObstacles.push({ name: 'BOILER', glyph: 'B', dx, dy });
      } else if (cell?.terrainType === 'WOODEN_DOOR_CLOSED') {
        visibleObstacles.push({ name: 'WOODEN_DOOR_CLOSED', glyph: '+', dx, dy });
        if (Math.abs(dx) <= 1 && Math.abs(dy) <= 1) adjacentInteractables.push(`Door (CLOSED) at (${dx}, ${dy}) -> TOGGLE_DOOR`);
      } else if (cell?.terrainType && TERRAIN_GLYPH[cell.terrainType]) {
        visibleObstacles.push({ name: cell.terrainType, glyph: TERRAIN_GLYPH[cell.terrainType]!.trim(), dx, dy });
      } else if ((cell?.steamPressureKpa ?? 0) >= 20 || (cell?.coalDustDensity ?? 0) >= 0.3) {
        visibleObstacles.push({ name: 'SMOG_CLOUD', glyph: '~', dx, dy });
      }
    }
  }

  const recentSounds = state.eventLog.slice(-15).filter((e) => e.type === 'SOUND_EMITTED')
    .map((s) => `[Turn ${s.turn}] ${s.decibels} dB sound at (${s.origin.x - pos.x}, ${s.origin.y - pos.y})`).slice(-3);

  const contextualCommands: string[] = [];
  const groundEntities = findEntitiesAtPoint(state.entities, pos);
  if (groundEntities.some((e) => e.portal || e.districtGate)) contextualCommands.push('{"action": "USE_PORTAL"}');
  if (groundEntities.some((e) => e.portal || (e.name ?? '').toLowerCase().includes('catacomb') || e.id.includes('catacomb'))) {
    contextualCommands.push('{"action": "DESCEND_CATACOMBS"}');
  }
  const groundItem = groundEntities.find((e) => e.item);
  if (groundItem) contextualCommands.push(`{"action": "PICK_UP", "itemId": "${groundItem.id}"}`);

  for (const ent of Object.values(state.entities)) {
    if (!ent.position || ent.position.stratum !== pos.stratum) continue;
    const dx = ent.position.x - pos.x, dy = ent.position.y - pos.y;
    if (Math.abs(dx) <= 1 && Math.abs(dy) <= 1) {
      if (ent.actor && !ent.actor.isPlayer && ent.aiController?.hostile && (dx !== 0 || dy !== 0)) contextualCommands.push(`{"action": "ATTACK", "targetId": "${ent.id}", "limb": "TORSO"}`);
      if (ent.aiController?.role === 'MERCHANT' && ent.inventory?.containedEntityIds[0]) contextualCommands.push(`{"action": "BUY", "merchantId": "${ent.id}", "itemId": "${ent.inventory.containedEntityIds[0]}"}`);
      if (ent.aiController?.role === 'CHIRURGEON') contextualCommands.push(`{"action": "PAY_CHIRURGEON_HEAL", "chirurgeonId": "${ent.id}"}`);
      if (ent.furniture && ['LOCKER', 'CRATE', 'BOOKSHELF'].includes(ent.furniture.kind) && (ent.inventory?.containedEntityIds.length ?? 0) > 0) contextualCommands.push(`{"action": "LOOT_CONTAINER", "containerId": "${ent.id}"}`);
      const isCorpse = ent.name.toLowerCase().includes('corpse') || ((ent.anatomy?.bloodVolumePct ?? 100) <= 0);
      if (isCorpse && player.inventory) {
        const tool = player.inventory.containedEntityIds.find((id) => (state.entities[id]?.item?.blueprintId ?? '').includes('scalpel') || (state.entities[id]?.name ?? '').toLowerCase().includes('knife'));
        if (tool) contextualCommands.push(`{"action": "HARVEST_CORPSE", "corpseId": "${ent.id}", "toolId": "${tool}"}`);
      }
      if (ent.pressureVessel && !ent.pressureVessel.ruptured) {
        contextualCommands.push(`{"action": "PRESSURIZE_VESSEL", "vesselId": "${ent.id}", "pressureKpa": 50}`);
        contextualCommands.push('{"action": "STOKE_BOILER", "pressureKpa": 50}');
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
  const salvageItem = invIds.find((id) => (state.entities[id]?.item?.blueprintId ?? '').includes('scrap') || (state.entities[id]?.name ?? '').toLowerCase().includes('scrap'));
  if (salvageItem) contextualCommands.push(`{"action": "SALVAGE_ITEM", "itemId": "${salvageItem}"}`);
  const prosthItem = invIds.find((id) => state.entities[id]?.prostheticSpec);
  if (prosthItem) {
    const spec = state.entities[prosthItem]?.prostheticSpec;
    if (spec) {
      contextualCommands.push(`{"action": "INSTALL_PROSTHETIC", "prostheticId": "${prosthItem}", "slot": "${spec.targetLimbSlot}"}`);
      contextualCommands.push(`{"action": "GRAFT_PROSTHETIC", "prostheticId": "${prosthItem}", "slot": "${spec.targetLimbSlot}"}`);
    }
  }
  const weaponEnt = invIds.find((id) => state.entities[id]?.equipmentSpec?.equipSlot === 'WIELD');
  const ammoEnt = invIds.find((id) => (state.entities[id]?.item?.blueprintId ?? '').includes('ammo') || (state.entities[id]?.name ?? '').toLowerCase().includes('ammo'));
  if (weaponEnt && ammoEnt) contextualCommands.push(`{"action": "LOAD_AMMO", "weaponId": "${weaponEnt}", "ammoId": "${ammoEnt}"}`);
  if (steam >= 20) contextualCommands.push('{"action": "VENT_STEAM", "pressureKpa": 30}');

  const safehouseList = Object.values(state.safehouses).map((s) => s.name).join(', ') || 'None';
  const codexCount = Object.keys(state.codex).length;
  if (codexCount > 0) contextualCommands.push('{"action": "CONSULT_CODEX"}');
  const hasSquadAllies = Object.values(state.entities).some((e) => e.actor && !e.actor.isPlayer && !e.aiController?.hostile && e.position?.stratum === pos.stratum);
  if (hasSquadAllies) contextualCommands.push('{"action": "EMIT_SQUAD_CALLOUT", "calloutKind": "ASSIST_TARGET"}');

  const damagedLimb = Object.entries(player.anatomy?.limbs ?? {}).find(([_, l]) => l.hp < l.maxHp);
  if (damagedLimb) contextualCommands.push(`{"action": "FIELD_REPAIR_LIMB", "slot": "${damagedLimb[0]}"}`);

  const primaryObj = options?.primaryObjective ?? 'Explore district and survive.';
  const secDir = options?.secondaryDirective ?? 'Interact with doors (+), avoid traps (^), vent steam (~).';
  const recentSteps = options?.recentPositions?.length ? options.recentPositions.map((p) => `(${p.x},${p.y})`).join(', ') : 'None';
  const feedbackBlock = options?.systemFeedback ? `[SYSTEM FEEDBACK]: ${options.systemFeedback}\n` : '';
  const auditBlock = `[CLIENT PROJECTION AUDIT]: Leaks Detected: ${audit.leakCount} (LookSync: ${audit.lookCursorSync.synchronized ? 'OK' : 'DESYNC'})\n`;

  let metadataBlock = '';
  if (options?.lastTurnContext && options.lastTurnContext.safehouses === safehouseList && options.lastTurnContext.codexCount === codexCount) {
    metadataBlock = `[METADATA DELTA]: Safehouses & Codex unchanged (${codexCount} entries)\n`;
  } else {
    metadataBlock = `[SAFEHOUSES]: ${safehouseList} | [CODEX]: ${codexCount} entries discovered\n`;
  }

  const sensoryRepresentation = visibleObstacles.length > 0
    ? visibleObstacles.map((o) => `${o.name} '${o.glyph}' at (${o.dx},${o.dy})`).join(', ')
    : 'Clear open terrain';

  return `=== AETHER & SOOT [Turn ${state.turnCount} | Shift: ${shift}] ===
Primary Objective: ${primaryObj} | Secondary Directive: ${secDir}
[STRATUM]: ${pos.stratum} | [POS]: (${pos.x}, ${pos.y}) | [BLOOD]: ${blood}% | [STEAM]: ${steam}/${maxSteam} kPa
${metadataBlock}[Recent Steps: ${recentSteps}]
${auditBlock}${feedbackBlock}[LOCAL SENSORY RADAR (Relative Coordinates dx, dy centered on '@')]:
Obstacles: ${sensoryRepresentation}
[RECENT ACOUSTIC SOUNDS]:\n${recentSounds.length > 0 ? recentSounds.join('\n') : 'None in range.'}
[VISIBLE THREATS]:\n${visibleThreats.length > 0 ? visibleThreats.join('\n') : 'No visible threats.'}
[ADJACENT INTERACTABLES]:\n${adjacentInteractables.length > 0 ? adjacentInteractables.join('\n') : 'None.'}
[AVAILABLE CONTEXTUAL COMMANDS]:
- Default: {"action": "MOVE", "dir": "N|S|E|W"} | {"action": "WAIT"}
${contextualCommands.length > 0 ? contextualCommands.map((c) => `- ${c}`).join('\n') : ''}`;
}

export { generateMockAction } from './playtester-mock.js';
