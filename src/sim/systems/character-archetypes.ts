import { CharacterCreationConfig } from '../../schemas/character.schema.js';
import { EntityRecord } from '../../schemas/components.schema.js';
import { BlueprintIdSchema, EntityId, EntityIdSchema, FactionId, StratumId } from '../../schemas/primitives.schema.js';
import { createEntityFromBlueprint } from '../data/item-catalog.js';
import { computeVisibleTiles } from '../spatial/fov.js';
import { markExploredTiles } from '../spatial/grid.js';
import { WorldState } from '../core/world.js';
import { getCarryProfile } from './inventory-utils.js';
import { PROFESSIONS, SCENARIOS } from './character-archetype-defs.js';

const ALL_FACTIONS: readonly FactionId[] = ['IRONMONGERS_CARTEL', 'CLOCKWORK_GUILD', 'UNDERCROFT_SYNDICATE', 'CROWN_CONSTABULARY'];

/** Pure simulation function that applies CDDA-style character creation to WorldState. */
export function applyCharacterCreation(state: WorldState, config: CharacterCreationConfig): WorldState {
  const playerId = EntityIdSchema.parse('actor_player');
  const basePlayer = state.entities[playerId];
  if (!basePlayer || !basePlayer.anatomy || !basePlayer.inventory || !basePlayer.actor) return state;

  const prof = PROFESSIONS[config.professionId];
  const traits = config.traitIds ?? [];
  const scenario = SCENARIOS[config.scenarioId];

  let nextEntities: Record<string, EntityRecord> = { ...state.entities };
  const nextContainedIds: EntityId[] = [];
  let currentMassGrams = 0;

  // 1. Starting Items
  prof.startingItems.forEach((spec, idx) => {
    const eid = EntityIdSchema.parse(`item_start_${prof.id.toLowerCase()}_${idx}`);
    const item = createEntityFromBlueprint(BlueprintIdSchema.parse(spec.blueprintId), eid, spec.quantity);
    if (item) {
      nextEntities[eid] = item;
      nextContainedIds.push(eid);
      currentMassGrams += getCarryProfile(item)?.massGrams ?? 0;
    }
  });

  if (prof.id === 'AETHER_SMUGGLER') {
    const ocularId = EntityIdSchema.parse('item_start_ocular_monocle');
    const monocle = createEntityFromBlueprint(BlueprintIdSchema.parse('prosthetic_clockwork_ocular_lens'), ocularId, 1);
    if (monocle) {
      nextEntities[ocularId] = monocle;
      nextContainedIds.push(ocularId);
      currentMassGrams += getCarryProfile(monocle)?.massGrams ?? 0;
    }
  }

  // 2. Anatomy & Grafted Prosthetics
  let limbs = { ...basePlayer.anatomy.limbs };
  if (prof.preGraftedSlot && prof.preGraftedBlueprintId) {
    const graftedLimb = limbs[prof.preGraftedSlot];
    if (graftedLimb) {
      const gId = EntityIdSchema.parse('item_grafted_strider_leg');
      const gItem = createEntityFromBlueprint(BlueprintIdSchema.parse(prof.preGraftedBlueprintId), gId, 1);
      if (gItem) {
        nextEntities[gId] = gItem;
        limbs[prof.preGraftedSlot] = {
          ...graftedLimb,
          amputated: true,
          installedProstheticEntityId: gId,
        };
      }
    }
  }

  const baseSteam = prof.maxSteamKpa ?? 100;
  const steamBonus = traits.includes('BOILER_HEART') ? 40 : 0;
  const totalMaxSteam = baseSteam + steamBonus;

  const unlockedRecipes = Array.from(
    new Set([
      ...basePlayer.anatomy.unlockedRecipeIds,
      ...prof.unlockedRecipes.map((r) => BlueprintIdSchema.parse(r)),
    ]),
  );

  // 3. Inventory Capacities
  const massBonus = traits.includes('PACK_MULE') ? 10000 : 0;
  const volBonus = traits.includes('PACK_MULE') ? 12000 : 0;

  // 4. Combat Stats
  const baseDmg = prof.meleeDamage ?? 12;
  const dmgBonus = traits.includes('IRON_FISTS') ? 4 : 0;
  const accBonus = traits.includes('IRON_FISTS') ? 10 : 0;

  // 5. Scenario Positioning
  const activeStratum: StratumId = scenario.stratum;
  const grid = state.strata[activeStratum];
  const cx = grid ? Math.floor(grid.width / 2) : 12;
  const cy = grid ? Math.floor(grid.height / 2) : 10;

  const updatedPlayer: EntityRecord = {
    ...basePlayer,
    name: config.name || 'Artificer Thorne',
    profession: config.professionId,
    traits,
    position: { x: cx, y: cy, stratum: activeStratum, blocksMovement: true, blocksSight: false },
    actor: { ...basePlayer.actor, speed: prof.speed ?? 100 },
    combatStats: { meleeDamage: baseDmg + dmgBonus, accuracyPct: 85 + accBonus, armorReduction: 0 },
    anatomy: {
      ...basePlayer.anatomy,
      limbs,
      steamReserveKpa: totalMaxSteam,
      maxSteamReserveKpa: totalMaxSteam,
      unlockedRecipeIds: unlockedRecipes,
    },
    inventory: {
      containedEntityIds: nextContainedIds,
      maxMassGrams: 25000 + massBonus,
      maxVolumeMl: 30000 + volBonus,
      currentMassGrams,
    },
  };
  nextEntities[playerId] = updatedPlayer;

  // 6. Economy: Starting Pence & Faction Reputations
  const cartelBonusPence = traits.includes('CARTEL_CONNECTIONS') ? 50 : 0;
  const finalPence = 100 + prof.bonusPence + cartelBonusPence;

  const nextReps: Partial<Record<FactionId, number>> = { ...state.economy.factionReputation };
  for (const faction of ALL_FACTIONS) {
    let rep = (nextReps[faction] ?? 0) + (prof.reputation[faction] ?? 0);
    if (traits.includes('CARTEL_CONNECTIONS')) rep += 10;
    nextReps[faction] = Math.max(-100, Math.min(100, rep));
  }

  // 7. Stratum Exploration at Scenario Spawn
  const updatedStrata = { ...state.strata };
  if (grid) {
    const fovRadius = traits.includes('NIGHT_OPTICS') ? 12 : 10;
    const visible = computeVisibleTiles(grid, cx, cy, fovRadius);
    updatedStrata[activeStratum] = markExploredTiles(grid, visible);
  }

  return {
    ...state,
    currentDistrictId: scenario.districtId,
    strata: updatedStrata,
    entities: nextEntities,
    economy: {
      ...state.economy,
      playerTreasuryPence: finalPence,
      factionReputation: nextReps,
    },
  };
}

export { PROFESSIONS, TRAITS, SCENARIOS, type ProfessionDefinition, type TraitDefinition } from './character-archetype-defs.js';
