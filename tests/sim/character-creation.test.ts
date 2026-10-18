import { describe, expect, it } from 'vitest';
import { BlueprintIdSchema, EntityIdSchema } from '../../src/schemas/primitives.schema.js';
import { dispatchCommand } from '../../src/sim/core/engine.js';
import { createInitialWorld } from '../../src/sim/core/world.js';
import { applyCharacterCreation } from '../../src/sim/systems/character-archetypes.js';

describe('Phase 21: CDDA-Style Character Creation Modal (Professions, Traits & Scenarios)', () => {
  const playerId = EntityIdSchema.parse('actor_player');

  it('configures DISGRACED_CHIRURGEON with medical tonics, reputation, recipes and extra pence', () => {
    const base = createInitialWorld({ seed: 101 });
    const state = applyCharacterCreation(base, {
      name: 'Dr. Alistair Finch',
      professionId: 'DISGRACED_CHIRURGEON',
      traitIds: [],
      scenarioId: 'SPITALFIELDS_FOUNDRY_ROW',
    });

    const player = state.entities[playerId]!;
    expect(player.name).toBe('Dr. Alistair Finch');
    expect(player.profession).toBe('DISGRACED_CHIRURGEON');
    expect(state.economy.playerTreasuryPence).toBe(130);
    expect(state.economy.factionReputation['UNDERCROFT_SYNDICATE']).toBe(20);

    // Starting items in inventory
    const itemIds = player.inventory?.containedEntityIds ?? [];
    const blueprints: readonly (string | undefined)[] = itemIds.map((id) => state.entities[id]?.item?.blueprintId);
    expect(blueprints.includes('item_coagulant_tonic')).toBe(true);
    expect(blueprints.includes('mat_vulcanized_rubber')).toBe(true);

    // Unlocked recipes
    expect(player.anatomy?.unlockedRecipeIds.includes(BlueprintIdSchema.parse('recipe_coagulant_tonic'))).toBe(true);
  });

  it('configures FOUNDRY_ARTIFICER with 150 kPa steam reserve, workshop materials and mechanical schematics', () => {
    const base = createInitialWorld({ seed: 102 });
    const state = applyCharacterCreation(base, {
      professionId: 'FOUNDRY_ARTIFICER',
      traitIds: [],
      scenarioId: 'SPITALFIELDS_FOUNDRY_ROW',
    });

    const player = state.entities[playerId]!;
    expect(player.profession).toBe('FOUNDRY_ARTIFICER');
    expect(player.anatomy?.maxSteamReserveKpa).toBe(150);
    expect(player.anatomy?.steamReserveKpa).toBe(150);
    expect(state.economy.factionReputation['IRONMONGERS_CARTEL']).toBe(30);

    const blueprints: readonly (string | undefined)[] = (player.inventory?.containedEntityIds ?? []).map((id) => state.entities[id]?.item?.blueprintId);
    expect(blueprints.includes('mat_brass_gears')).toBe(true);
    expect(blueprints.includes('commodity_anthracite_briquette')).toBe(true);
    expect(player.anatomy?.unlockedRecipeIds.includes(BlueprintIdSchema.parse('recipe_steam_canister'))).toBe(true);
    expect(player.anatomy?.unlockedRecipeIds.includes(BlueprintIdSchema.parse('recipe_pneumatic_leg_mk1'))).toBe(true);
  });

  it('configures CLOCKWORK_VETERAN with pre-grafted Pneumatic Strider Leg and 16 base melee damage', () => {
    const base = createInitialWorld({ seed: 103 });
    const state = applyCharacterCreation(base, {
      professionId: 'CLOCKWORK_VETERAN',
      traitIds: [],
      scenarioId: 'SPITALFIELDS_FOUNDRY_ROW',
    });

    const player = state.entities[playerId]!;
    expect(player.combatStats?.meleeDamage).toBe(16);
    expect(state.economy.factionReputation['CROWN_CONSTABULARY']).toBe(25);

    const leftLeg = player.anatomy?.limbs.LEFT_LEG;
    expect(leftLeg?.amputated).toBe(true);
    expect(leftLeg?.installedProstheticEntityId).toBeDefined();

    const prosthetic = state.entities[leftLeg!.installedProstheticEntityId!];
    expect(prosthetic?.prostheticSpec?.blueprintId).toBe('prosthetic_pneumatic_leg_mk1');
  });

  it('configures AETHER_SMUGGLER with speed 115, aether salt, and black-market standing', () => {
    const base = createInitialWorld({ seed: 104 });
    const state = applyCharacterCreation(base, {
      professionId: 'AETHER_SMUGGLER',
      traitIds: [],
      scenarioId: 'SPITALFIELDS_FOUNDRY_ROW',
    });

    const player = state.entities[playerId]!;
    expect(player.actor?.speed).toBe(115);
    expect(state.economy.factionReputation['CLOCKWORK_GUILD']).toBe(40);
    expect(state.economy.factionReputation['UNDERCROFT_SYNDICATE']).toBe(25);

    const itemIds = player.inventory?.containedEntityIds ?? [];
    const blueprints: readonly (string | undefined)[] = itemIds.map(
      (id) => state.entities[id]?.item?.blueprintId ?? state.entities[id]?.prostheticSpec?.blueprintId,
    );
    expect(blueprints.includes('mat_aether_salt')).toBe(true);
    expect(blueprints.includes('prosthetic_clockwork_ocular_lens')).toBe(true);
  });

  it('applies PACK_MULE and IRON_FISTS trait bonuses to inventory and combat stats', () => {
    const base = createInitialWorld({ seed: 105 });
    const state = applyCharacterCreation(base, {
      professionId: 'FOUNDRY_ARTIFICER',
      traitIds: ['PACK_MULE', 'IRON_FISTS'],
      scenarioId: 'SPITALFIELDS_FOUNDRY_ROW',
    });

    const player = state.entities[playerId]!;
    expect(player.traits).toEqual(['PACK_MULE', 'IRON_FISTS']);
    // Base 25000g + 10000g, 30000ml + 12000ml
    expect(player.inventory?.maxMassGrams).toBe(35000);
    expect(player.inventory?.maxVolumeMl).toBe(42000);

    // Base 12 + 4 = 16 melee damage, 85 + 10 = 95 accuracy
    expect(player.combatStats?.meleeDamage).toBe(16);
    expect(player.combatStats?.accuracyPct).toBe(95);
  });

  it('applies BOILER_HEART passive regen on WAIT_TURN and CARTEL_CONNECTIONS treasury/reputation', () => {
    const base = createInitialWorld({ seed: 106 });
    let state = applyCharacterCreation(base, {
      professionId: 'DISGRACED_CHIRURGEON',
      traitIds: ['BOILER_HEART', 'CARTEL_CONNECTIONS'],
      scenarioId: 'SPITALFIELDS_FOUNDRY_ROW',
    });

    const player = state.entities[playerId]!;
    // 100 base + 30 chirurgeon + 50 cartel connections = 180
    expect(state.economy.playerTreasuryPence).toBe(180);
    // 100 base + 40 boiler heart = 140 max steam
    expect(player.anatomy?.maxSteamReserveKpa).toBe(140);
    // All cartels get +10 rep (Ironmongers 10+10=20, Constabulary 5+10=15, Undercroft 0+20+10=30)
    expect(state.economy.factionReputation['IRONMONGERS_CARTEL']).toBe(20);
    expect(state.economy.factionReputation['CROWN_CONSTABULARY']).toBe(15);
    expect(state.economy.factionReputation['UNDERCROFT_SYNDICATE']).toBe(30);

    // Deplete steam to 100 and wait turn: BOILER_HEART should restore 5 kPa
    state = {
      ...state,
      entities: {
        ...state.entities,
        [playerId]: {
          ...player,
          anatomy: { ...player.anatomy!, steamReserveKpa: 100 },
        },
      },
    };
    const waited = dispatchCommand(state, { type: 'WAIT_TURN', actorId: playerId });
    expect(waited.state.entities[playerId]?.anatomy?.steamReserveKpa).toBe(105);
  });

  it('spawns player in BELGRAVIA_SKY_WALK (SPIRE) and FLEET_DITCH_SUMP (UNDERCROFT) scenarios', () => {
    const base = createInitialWorld({ seed: 107 });

    const spireState = applyCharacterCreation(base, {
      professionId: 'CLOCKWORK_VETERAN',
      traitIds: ['NIGHT_OPTICS'],
      scenarioId: 'BELGRAVIA_SKY_WALK',
    });
    expect(spireState.currentDistrictId).toBe('district_belgravia_brass_spires');
    expect(spireState.entities[playerId]?.position?.stratum).toBe('SPIRE');
    const spireGrid = spireState.strata.SPIRE!;
    const pos = spireState.entities[playerId]!.position!;
    expect(spireGrid.cells[pos.y * spireGrid.width + pos.x]?.explored).toBe(true);

    const undercroftState = applyCharacterCreation(base, {
      professionId: 'AETHER_SMUGGLER',
      traitIds: [],
      scenarioId: 'FLEET_DITCH_SUMP',
    });
    expect(undercroftState.currentDistrictId).toBe('district_fleet_ditch_undercroft');
    expect(undercroftState.entities[playerId]?.position?.stratum).toBe('UNDERCROFT');
  });
});
