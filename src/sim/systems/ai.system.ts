import { AnatomyComponent, EntityRecord } from '../../schemas/components.schema.js';
import { SimEvent } from '../../schemas/events.schema.js';
import {
  BlueprintIdSchema,
  EntityId,
  EntityIdSchema,
  LimbSlotId,
} from '../../schemas/primitives.schema.js';
import { SeededRNG } from '../core/rng.js';
import { STANDARD_ACTION_AP } from '../core/scheduler.js';
import { WorldState } from '../core/world.js';
import { createEntityFromBlueprint } from '../data/item-catalog.js';
import { computeVisibleTiles, isPointVisible } from '../spatial/fov.js';
import { resolveAttackActor } from './combat.system.js';
import { getCarryProfile, sortEntitiesById } from './inventory-utils.js';
import { resolveMoveStep } from './movement.system.js';

export const NPC_VISION_RADIUS = 8;
export const HOSTILE_REPUTATION_THRESHOLD = -30;

const TARGETABLE_SLOTS: readonly LimbSlotId[] = [
  'TORSO', 'LEFT_ARM', 'RIGHT_ARM', 'LEFT_LEG', 'RIGHT_LEG', 'HEAD',
];

/** Builds a 6-limb AnatomyComponent for an NPC or enemy. */
export function createDefaultNpcAnatomy(torsoHp = 45, limbHp = 25): AnatomyComponent {
  return {
    bloodVolumePct: 100,
    steamReserveKpa: 80,
    maxSteamReserveKpa: 100,
    limbs: {
      HEAD: { slot: 'HEAD', hp: limbHp, maxHp: limbHp, amputated: false },
      TORSO: { slot: 'TORSO', hp: torsoHp, maxHp: torsoHp, amputated: false },
      LEFT_ARM: { slot: 'LEFT_ARM', hp: limbHp, maxHp: limbHp, amputated: false },
      RIGHT_ARM: { slot: 'RIGHT_ARM', hp: limbHp, maxHp: limbHp, amputated: false },
      LEFT_LEG: { slot: 'LEFT_LEG', hp: limbHp, maxHp: limbHp, amputated: false },
      RIGHT_LEG: { slot: 'RIGHT_LEG', hp: limbHp, maxHp: limbHp, amputated: false },
    },
    unlockedRecipeIds: [],
  };
}

function buildNpcInventory(
  entities: Record<string, EntityRecord>,
  items: readonly { id: string; blueprintId: string; quantity: number }[],
): { containedIds: EntityId[]; totalMass: number } {
  const containedIds: EntityId[] = [];
  let totalMass = 0;
  for (const spec of items) {
    const eid = EntityIdSchema.parse(spec.id);
    const created = createEntityFromBlueprint(BlueprintIdSchema.parse(spec.blueprintId), eid, spec.quantity);
    if (!created) continue;
    entities[eid] = created;
    containedIds.push(eid);
    totalMass += getCarryProfile(created)?.massGrams ?? 0;
  }
  return { containedIds, totalMass };
}

/**
 * Deterministically populates a Victorian district with the 4 canonical NPC archetypes:
 * Clockwork Automaton Warden, Sump Scavenger, Foundry Stoker, and Guild Quartermaster.
 */
export function spawnDistrictNpcs(state: WorldState): {
  readonly state: WorldState;
  readonly spawnedNpcIds: readonly EntityId[];
} {
  const entities: Record<string, EntityRecord> = { ...state.entities };
  const wardenId = EntityIdSchema.parse('npc_clockwork_warden');
  const scavengerId = EntityIdSchema.parse('npc_sump_scavenger');
  const stokerId = EntityIdSchema.parse('npc_foundry_stoker');
  const merchantId = EntityIdSchema.parse('npc_guild_merchant');

  const wardenInv = buildNpcInventory(entities, [
    { id: 'loot_warden_gears', blueprintId: 'mat_brass_gears', quantity: 2 },
  ]);
  const scavengerInv = buildNpcInventory(entities, [
    { id: 'loot_scavenger_salt', blueprintId: 'mat_aether_salt', quantity: 2 },
  ]);
  const stokerInv = buildNpcInventory(entities, [
    { id: 'loot_stoker_coal', blueprintId: 'commodity_anthracite_briquette', quantity: 1 },
  ]);
  const merchantInv = buildNpcInventory(entities, [
    { id: 'loot_merchant_tonic', blueprintId: 'item_coagulant_tonic', quantity: 2 },
    { id: 'loot_merchant_canister', blueprintId: 'item_pressurized_steam_canister', quantity: 1 },
  ]);

  entities[wardenId] = {
    id: wardenId,
    name: 'Clockwork Automaton Warden',
    visual: { glyph: 'W', fgPrimary: '#2E86C1', fgSecondary: '#D4AF37', bgColor: '#0A0D0E', shaderFlags: ['SPARK_GLINT'] },
    position: { x: 10, y: 11, stratum: 'STREET', blocksMovement: true, blocksSight: false },
    actor: { energy: 0, speed: 100, isPlayer: false },
    aiController: { factionId: 'CROWN_CONSTABULARY', role: 'GUARD', hostile: false },
    combatStats: { meleeDamage: 14, accuracyPct: 88, armorReduction: 3 },
    anatomy: createDefaultNpcAnatomy(55, 30),
    inventory: { containedEntityIds: wardenInv.containedIds, maxMassGrams: 25000, maxVolumeMl: 30000, currentMassGrams: wardenInv.totalMass },
  };

  entities[scavengerId] = {
    id: scavengerId,
    name: 'Fleet Ditch Sump Scavenger',
    visual: { glyph: 's', fgPrimary: '#E74C3C', fgSecondary: '#922B21', bgColor: '#0A0D0E', shaderFlags: [] },
    position: { x: 11, y: 11, stratum: 'UNDERCROFT', blocksMovement: true, blocksSight: false },
    actor: { energy: 0, speed: 100, isPlayer: false },
    aiController: { factionId: 'UNDERCROFT_SYNDICATE', role: 'SCAVENGER', hostile: true },
    combatStats: { meleeDamage: 10, accuracyPct: 80, armorReduction: 0 },
    anatomy: createDefaultNpcAnatomy(30, 20),
    inventory: { containedEntityIds: scavengerInv.containedIds, maxMassGrams: 20000, maxVolumeMl: 20000, currentMassGrams: scavengerInv.totalMass },
  };

  entities[stokerId] = {
    id: stokerId,
    name: 'Spitalfields Foundry Stoker',
    visual: { glyph: 'f', fgPrimary: '#E67E22', fgSecondary: '#CD7F32', bgColor: '#0A0D0E', shaderFlags: [] },
    position: { x: 14, y: 13, stratum: 'STREET', blocksMovement: true, blocksSight: false },
    actor: { energy: 0, speed: 90, isPlayer: false },
    aiController: { factionId: 'IRONMONGERS_CARTEL', role: 'CITIZEN', hostile: false },
    combatStats: { meleeDamage: 12, accuracyPct: 82, armorReduction: 1 },
    anatomy: createDefaultNpcAnatomy(45, 25),
    inventory: { containedEntityIds: stokerInv.containedIds, maxMassGrams: 25000, maxVolumeMl: 25000, currentMassGrams: stokerInv.totalMass },
  };

  entities[merchantId] = {
    id: merchantId,
    name: 'Royal Exchange Quartermaster',
    visual: { glyph: 'M', fgPrimary: '#F4D03F', fgSecondary: '#D4AF37', bgColor: '#0A0D0E', shaderFlags: ['SPARK_GLINT'] },
    position: { x: 19, y: 19, stratum: 'STREET', blocksMovement: true, blocksSight: false },
    actor: { energy: 0, speed: 80, isPlayer: false },
    aiController: { factionId: 'CLOCKWORK_GUILD', role: 'MERCHANT', hostile: false },
    combatStats: { meleeDamage: 8, accuracyPct: 75, armorReduction: 1 },
    anatomy: createDefaultNpcAnatomy(40, 20),
    inventory: { containedEntityIds: merchantInv.containedIds, maxMassGrams: 30000, maxVolumeMl: 30000, currentMassGrams: merchantInv.totalMass },
  };

  return {
    state: { ...state, entities },
    spawnedNpcIds: [wardenId, scavengerId, stokerId, merchantId],
  };
}

/**
 * Advances energy and executes deterministic AI turns for all autonomous NPCs.
 */
export function advanceNpcTurns(
  state: WorldState,
  rng: SeededRNG,
): { readonly state: WorldState; readonly events: SimEvent[] } {
  const npcs = Object.values(state.entities)
    .filter((e) => e.aiController && e.actor && !e.actor.isPlayer && e.position)
    .sort(sortEntitiesById);

  if (npcs.length === 0) return { state, events: [] };

  let workingState = state;
  const events: SimEvent[] = [];

  for (const initialNpc of npcs) {
    const npc = workingState.entities[initialNpc.id];
    if (!npc?.actor || !npc.aiController || !npc.position) continue;

    const gainedEnergy = npc.actor.energy + npc.actor.speed;
    const rep = workingState.economy.factionReputation[npc.aiController.factionId] ?? 0;
    const isCompanion = Boolean(npc.aiController.companionOfActorId);
    const isHostile = !isCompanion && (npc.aiController.hostile || rep <= HOSTILE_REPUTATION_THRESHOLD);

    if (gainedEnergy < STANDARD_ACTION_AP) {
      workingState = {
        ...workingState,
        entities: {
          ...workingState.entities,
          [npc.id]: {
            ...npc,
            actor: { ...npc.actor, energy: gainedEnergy },
            aiController: { ...npc.aiController, hostile: isHostile },
          },
        },
      };
      continue;
    }

    const player = Object.values(workingState.entities).find((e) => e.actor?.isPlayer);
    const grid = workingState.strata[npc.position.stratum];
    let apSpent = STANDARD_ACTION_AP;

    if (isCompanion && player?.position && player.position.stratum === npc.position.stratum) {
      const adjacentHostile = Object.values(workingState.entities).find(
        (e) => e.actor && !e.actor.isPlayer && e.aiController?.hostile && e.position?.stratum === npc.position!.stratum
          && Math.max(Math.abs(e.position.x - npc.position!.x), Math.abs(e.position.y - npc.position!.y)) <= 1,
      );
      if (adjacentHostile) {
        const targetSlot = TARGETABLE_SLOTS[rng.nextInt(0, TARGETABLE_SLOTS.length - 1)] ?? 'TORSO';
        const atkRes = resolveAttackActor(workingState, npc.id, adjacentHostile.id, targetSlot, rng);
        workingState = atkRes.state;
        apSpent = atkRes.apSpent;
        events.push(...atkRes.events);
      } else if (Math.max(Math.abs(player.position.x - npc.position.x), Math.abs(player.position.y - npc.position.y)) > 1) {
        const moveRes = resolveMoveStep(
          workingState, npc.id,
          Math.sign(player.position.x - npc.position.x), Math.sign(player.position.y - npc.position.y),
        );
        workingState = moveRes.state;
        apSpent = moveRes.apSpent;
        events.push(...moveRes.events);
      }
    } else if (isHostile && player?.position && player.position.stratum === npc.position.stratum && grid) {
      const visible = computeVisibleTiles(grid, npc.position.x, npc.position.y, NPC_VISION_RADIUS);
      if (isPointVisible(visible, player.position)) {
        const dist = Math.max(
          Math.abs(player.position.x - npc.position.x),
          Math.abs(player.position.y - npc.position.y),
        );
        if (dist <= 1) {
          const targetSlot = TARGETABLE_SLOTS[rng.nextInt(0, TARGETABLE_SLOTS.length - 1)] ?? 'TORSO';
          const atkRes = resolveAttackActor(workingState, npc.id, player.id, targetSlot, rng);
          workingState = atkRes.state;
          apSpent = atkRes.apSpent;
          events.push(...atkRes.events);
        } else {
          const dx = Math.sign(player.position.x - npc.position.x);
          const dy = Math.sign(player.position.y - npc.position.y);
          const moveRes = resolveMoveStep(workingState, npc.id, dx, dy);
          workingState = moveRes.state;
          apSpent = moveRes.apSpent;
          events.push(...moveRes.events);
        }
      }
    }

    const afterNpc = workingState.entities[npc.id];
    if (afterNpc?.actor && afterNpc.aiController) {
      workingState = {
        ...workingState,
        entities: {
          ...workingState.entities,
          [npc.id]: {
            ...afterNpc,
            actor: { ...afterNpc.actor, energy: gainedEnergy - apSpent },
            aiController: { ...afterNpc.aiController, hostile: isHostile },
          },
        },
      };
    }
  }

  return { state: workingState, events };
}
