import { CharacterCreationConfig, ProfessionId, ScenarioDefinition, ScenarioId, TraitId } from '../../schemas/character.schema.js';
import { EntityRecord } from '../../schemas/components.schema.js';
import { BlueprintIdSchema, EntityId, EntityIdSchema, FactionId, LimbSlotId, StratumId } from '../../schemas/primitives.schema.js';
import { createEntityFromBlueprint } from '../data/item-catalog.js';
import { computeVisibleTiles } from '../spatial/fov.js';
import { markExploredTiles } from '../spatial/grid.js';
import { WorldState } from '../core/world.js';
import { getCarryProfile } from './inventory-utils.js';

export interface ProfessionDefinition {
  readonly id: ProfessionId;
  readonly name: string;
  readonly description: string;
  readonly startingItems: readonly { readonly blueprintId: string; readonly quantity: number }[];
  readonly reputation: Partial<Record<FactionId, number>>;
  readonly bonusPence: number;
  readonly unlockedRecipes: readonly string[];
  readonly speed?: number;
  readonly meleeDamage?: number;
  readonly maxSteamKpa?: number;
  readonly preGraftedSlot?: LimbSlotId;
  readonly preGraftedBlueprintId?: string;
}

export interface TraitDefinition {
  readonly id: TraitId;
  readonly name: string;
  readonly description: string;
}

export const PROFESSIONS: Record<ProfessionId, ProfessionDefinition> = {
  DISGRACED_CHIRURGEON: {
    id: 'DISGRACED_CHIRURGEON',
    name: 'Disgraced Street Chirurgeon',
    description: 'Struck from the Royal College for unsanctioned anatomical grafts. Expert at field triage and blood coagulants.',
    startingItems: [{ blueprintId: 'item_coagulant_tonic', quantity: 2 }, { blueprintId: 'mat_vulcanized_rubber', quantity: 2 }],
    reputation: { UNDERCROFT_SYNDICATE: 20 },
    bonusPence: 30,
    unlockedRecipes: ['recipe_coagulant_tonic', 'recipe_clockwork_ocular_lens'],
  },
  FOUNDRY_ARTIFICER: {
    id: 'FOUNDRY_ARTIFICER',
    name: 'Foundry Master Artificer',
    description: 'Seasoned machinist from Spitalfields blast furnaces with an industrial tolerance for high-pressure steam.',
    startingItems: [{ blueprintId: 'mat_brass_gears', quantity: 3 }, { blueprintId: 'commodity_anthracite_briquette', quantity: 2 }],
    reputation: { IRONMONGERS_CARTEL: 20 },
    bonusPence: 0,
    maxSteamKpa: 150,
    unlockedRecipes: ['recipe_steam_canister', 'recipe_pneumatic_leg_mk1', 'recipe_phosphor_bronze_ingot'],
  },
  CLOCKWORK_VETERAN: {
    id: 'CLOCKWORK_VETERAN',
    name: 'Clockwork War Veteran',
    description: 'Decorated survivor discharged with an iron will, a pre-grafted Pneumatic Strider Leg, and heavy combat training.',
    startingItems: [{ blueprintId: 'mat_cast_iron_plate', quantity: 2 }, { blueprintId: 'item_pressurized_steam_canister', quantity: 1 }],
    reputation: { CROWN_CONSTABULARY: 20 },
    bonusPence: 10,
    meleeDamage: 16,
    preGraftedSlot: 'LEFT_LEG',
    preGraftedBlueprintId: 'prosthetic_pneumatic_leg_mk1',
    unlockedRecipes: [],
  },
  AETHER_SMUGGLER: {
    id: 'AETHER_SMUGGLER',
    name: 'Undercroft Aether Smuggler',
    description: 'Fleet-footed courier moving contraband through London sewer flues. Quick on their feet and connected to black markets.',
    startingItems: [{ blueprintId: 'mat_aether_salt', quantity: 4 }, { blueprintId: 'mat_vulcanized_rubber', quantity: 1 }],
    reputation: { CLOCKWORK_GUILD: 25, UNDERCROFT_SYNDICATE: 25 },
    bonusPence: 20,
    speed: 115,
    unlockedRecipes: [],
  },
};

export const TRAITS: Record<TraitId, TraitDefinition> = {
  NIGHT_OPTICS: { id: 'NIGHT_OPTICS', name: 'Night Optics', description: 'Augmented pupil dilation reveals outlines through thick London soot (+2 base FOV radius).' },
  BOILER_HEART: { id: 'BOILER_HEART', name: 'Boiler Heart', description: 'Reinforced copper heart valves sustain higher operating pressure (+40 max steam kPa, +5 kPa passive regen on wait).' },
  PACK_MULE: { id: 'PACK_MULE', name: 'Pack Mule', description: 'Back braced with pneumatic stays for heavy hauling (+10,000g max carry mass, +12,000ml volume).' },
  IRON_FISTS: { id: 'IRON_FISTS', name: 'Iron Fists', description: 'Brutish bare-knuckle pugilism tempered on London docks (+4 melee damage, +10% attack accuracy).' },
  CARTEL_CONNECTIONS: { id: 'CARTEL_CONNECTIONS', name: 'Cartel Connections', description: 'Well-bribed dockmasters and fences grant immediate trust (+50 starting pence, +10 rep with all cartels).' },
  TINKER_SAVANT: { id: 'TINKER_SAVANT', name: 'Tinker Savant', description: 'Ingenious steam routing cuts workshop waste (-25% crafting steam cost).' },
};

export const SCENARIOS: Record<ScenarioId, ScenarioDefinition> = {
  SPITALFIELDS_FOUNDRY_ROW: {
    id: 'SPITALFIELDS_FOUNDRY_ROW',
    name: 'Spitalfields Foundry Row',
    description: 'Industrial street level surrounded by ironworks, steam boilers, and cartel storefronts.',
    districtId: BlueprintIdSchema.parse('district_spitalfields_soot_works'),
    stratum: 'STREET',
  },
  BELGRAVIA_SKY_WALK: {
    id: 'BELGRAVIA_SKY_WALK',
    name: 'Belgravia Sky-Walk',
    description: 'High-altitude brass promenades, clockwork guild halls, and aristocratic spires.',
    districtId: BlueprintIdSchema.parse('district_belgravia_brass_spires'),
    stratum: 'SPIRE',
  },
  FLEET_DITCH_SUMP: {
    id: 'FLEET_DITCH_SUMP',
    name: 'Fleet Ditch Flooded Sump',
    description: 'Subterranean brick vaults, poisonous smog pools, and sump scavenger outposts.',
    districtId: BlueprintIdSchema.parse('district_fleet_ditch_undercroft'),
    stratum: 'UNDERCROFT',
  },
};

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
