import { ProfessionId, ScenarioDefinition, ScenarioId, TraitId } from '../../schemas/character.schema.js';
import { BlueprintIdSchema, FactionId, LimbSlotId } from '../../schemas/primitives.schema.js';

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
