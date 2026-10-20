import { describe, expect, it } from 'vitest';
import { BlueprintIdSchema, EntityIdSchema } from '../../src/schemas/primitives.schema.js';
import { dispatchCommand } from '../../src/sim/core/engine.js';
import { createInitialWorld } from '../../src/sim/core/world.js';
import { generateVictorianDistrict } from '../../src/sim/spatial/generator.js';
import { VALID_DISTRICT_IDS } from '../../src/sim/systems/transit.system.js';

describe('Phase 26: Procedural Overworld City Grid & Distinct District Biomes', () => {
  it('validates that the Victorian Overworld contains all 5 distinct districts', () => {
    expect(VALID_DISTRICT_IDS.size).toBe(5);
    expect(VALID_DISTRICT_IDS.has('district_spitalfields_soot_works')).toBe(true);
    expect(VALID_DISTRICT_IDS.has('district_fleet_ditch_undercroft')).toBe(true);
    expect(VALID_DISTRICT_IDS.has('district_belgravia_brass_spires')).toBe(true);
    expect(VALID_DISTRICT_IDS.has('district_whitechapel_ward')).toBe(true);
    expect(VALID_DISTRICT_IDS.has('district_limehouse_docks')).toBe(true);
  });

  it('populates unvisited districts with live NPCs, loot, and distinct biomes upon arrival', () => {
    const baseWorld = createInitialWorld({ seed: 201, width: 24, height: 24 });
    const { state: initialWorld } = generateVictorianDistrict(baseWorld);
    const playerId = EntityIdSchema.parse('actor_player');

    // Place player adjacent to West Gate (which connects to district_fleet_ditch_undercroft)
    const westGate = Object.values(initialWorld.entities).find(
      (e) => e.districtGate?.targetDistrictId === 'district_fleet_ditch_undercroft',
    );
    expect(westGate).toBeDefined();

    let world = {
      ...initialWorld,
      entities: {
        ...initialWorld.entities,
        [playerId]: {
          ...initialWorld.entities[playerId]!,
          position: { ...westGate!.position!, x: westGate!.position!.x + 1 },
        },
      },
    };

    // Travel to Fleet Ditch
    const travelRes = dispatchCommand(world, {
      type: 'TRAVEL_DISTRICT',
      actorId: playerId,
      targetDistrictId: BlueprintIdSchema.parse('district_fleet_ditch_undercroft'),
    });

    world = travelRes.state;
    expect(world.currentDistrictId).toBe('district_fleet_ditch_undercroft');
    expect(world.savedDistricts['district_spitalfields_soot_works']).toBeDefined();

    // Verify unvisited district was automatically populated with live NPCs and ground items
    const npcs = Object.values(world.entities).filter((e) => e.actor && !e.actor.isPlayer);
    expect(npcs.length).toBeGreaterThan(0);
    const merchants = npcs.filter((e) => e.aiController?.role === 'MERCHANT');
    expect(merchants.length).toBeGreaterThan(0);

    const items = Object.values(world.entities).filter((e) => e.item !== undefined);
    expect(items.length).toBeGreaterThan(0);
  });

  it('transitions to the connected district when standing on a DISTRICT_GATE and using USE_PORTAL', () => {
    const baseWorld = createInitialWorld({ seed: 202, width: 24, height: 24 });
    const { state: initialWorld } = generateVictorianDistrict(baseWorld);
    const playerId = EntityIdSchema.parse('actor_player');

    const westGate = Object.values(initialWorld.entities).find(
      (e) => e.districtGate?.targetDistrictId === 'district_fleet_ditch_undercroft',
    );
    expect(westGate).toBeDefined();

    // Position player directly ON the gate tile
    let world = {
      ...initialWorld,
      entities: {
        ...initialWorld.entities,
        [playerId]: {
          ...initialWorld.entities[playerId]!,
          position: { ...westGate!.position! },
        },
      },
    };

    // Dispatch USE_PORTAL while standing directly on the District Gate
    const portalRes = dispatchCommand(world, {
      type: 'USE_PORTAL',
      actorId: playerId,
    });

    world = portalRes.state;
    expect(world.currentDistrictId).toBe('district_fleet_ditch_undercroft');
    const districtEvent = portalRes.events.find((e) => e.type === 'DISTRICT_TRAVELED');
    expect(districtEvent).toBeDefined();
    if (districtEvent && districtEvent.type === 'DISTRICT_TRAVELED') {
      expect(districtEvent.toDistrictId).toBe('district_fleet_ditch_undercroft');
    }
  });

  it('preserves cached district state when traveling back and forth across the city graph', () => {
    const baseWorld = createInitialWorld({ seed: 203, width: 24, height: 24 });
    const { state: initialWorld } = generateVictorianDistrict(baseWorld);
    const playerId = EntityIdSchema.parse('actor_player');

    const eastGate = Object.values(initialWorld.entities).find(
      (e) => e.districtGate?.targetDistrictId === 'district_belgravia_brass_spires',
    );
    expect(eastGate).toBeDefined();

    let world = {
      ...initialWorld,
      entities: {
        ...initialWorld.entities,
        [playerId]: {
          ...initialWorld.entities[playerId]!,
          position: { ...eastGate!.position!, x: eastGate!.position!.x - 1 },
        },
      },
    };

    // Travel to Belgravia Spires
    world = dispatchCommand(world, {
      type: 'TRAVEL_DISTRICT',
      actorId: playerId,
      targetDistrictId: BlueprintIdSchema.parse('district_belgravia_brass_spires'),
    }).state;
    expect(world.currentDistrictId).toBe('district_belgravia_brass_spires');

    const belgraviaNpcCount = Object.values(world.entities).filter((e) => e.actor && !e.actor.isPlayer).length;
    expect(belgraviaNpcCount).toBeGreaterThan(0);

    // Find return gate to Spitalfields
    const returnGate = Object.values(world.entities).find(
      (e) => e.districtGate?.targetDistrictId === 'district_spitalfields_soot_works',
    );
    expect(returnGate).toBeDefined();

    // Move player adjacent to return gate
    world = {
      ...world,
      entities: {
        ...world.entities,
        [playerId]: {
          ...world.entities[playerId]!,
          position: { ...returnGate!.position!, x: returnGate!.position!.x - 1 },
        },
      },
    };

    // Travel back to Spitalfields
    world = dispatchCommand(world, {
      type: 'TRAVEL_DISTRICT',
      actorId: playerId,
      targetDistrictId: BlueprintIdSchema.parse('district_spitalfields_soot_works'),
    }).state;
    expect(world.currentDistrictId).toBe('district_spitalfields_soot_works');

    // Both districts are cached in savedDistricts
    expect(world.savedDistricts['district_belgravia_brass_spires']).toBeDefined();
    expect(world.savedDistricts['district_spitalfields_soot_works']).toBeDefined();

    // Re-travel to Belgravia: restores cached entities without duplicate NPC spawning
    const reEnterGate = Object.values(world.entities).find(
      (e) => e.districtGate?.targetDistrictId === 'district_belgravia_brass_spires',
    );
    world = {
      ...world,
      entities: {
        ...world.entities,
        [playerId]: {
          ...world.entities[playerId]!,
          position: { ...reEnterGate!.position!, x: reEnterGate!.position!.x - 1 },
        },
      },
    };

    world = dispatchCommand(world, {
      type: 'TRAVEL_DISTRICT',
      actorId: playerId,
      targetDistrictId: BlueprintIdSchema.parse('district_belgravia_brass_spires'),
    }).state;

    const reEnteredNpcCount = Object.values(world.entities).filter((e) => e.actor && !e.actor.isPlayer).length;
    expect(reEnteredNpcCount).toBe(belgraviaNpcCount);
  });

  it('traverses the full overworld chain from Spitalfields to Limehouse Steam-Docks', () => {
    const baseWorld = createInitialWorld({ seed: 204, width: 24, height: 24 });
    const { state: initialWorld } = generateVictorianDistrict(baseWorld);
    const playerId = EntityIdSchema.parse('actor_player');

    // 1. Spitalfields -> Fleet Ditch
    const fleetGate = Object.values(initialWorld.entities).find(
      (e) => e.districtGate?.targetDistrictId === 'district_fleet_ditch_undercroft',
    )!;
    let world = {
      ...initialWorld,
      entities: {
        ...initialWorld.entities,
        [playerId]: { ...initialWorld.entities[playerId]!, position: { ...fleetGate.position!, x: fleetGate.position!.x + 1 } },
      },
    };
    world = dispatchCommand(world, {
      type: 'TRAVEL_DISTRICT', actorId: playerId, targetDistrictId: BlueprintIdSchema.parse('district_fleet_ditch_undercroft'),
    }).state;
    expect(world.currentDistrictId).toBe('district_fleet_ditch_undercroft');

    // 2. Fleet Ditch -> Whitechapel
    const whitechapelGate = Object.values(world.entities).find(
      (e) => e.districtGate?.targetDistrictId === 'district_whitechapel_ward',
    )!;
    world = {
      ...world,
      entities: {
        ...world.entities,
        [playerId]: { ...world.entities[playerId]!, position: { ...whitechapelGate.position!, x: whitechapelGate.position!.x + 1 } },
      },
    };
    world = dispatchCommand(world, {
      type: 'TRAVEL_DISTRICT', actorId: playerId, targetDistrictId: BlueprintIdSchema.parse('district_whitechapel_ward'),
    }).state;
    expect(world.currentDistrictId).toBe('district_whitechapel_ward');

    // 3. Whitechapel -> Limehouse Steam-Docks
    const limehouseGate = Object.values(world.entities).find(
      (e) => e.districtGate?.targetDistrictId === 'district_limehouse_docks',
    )!;
    world = {
      ...world,
      entities: {
        ...world.entities,
        [playerId]: { ...world.entities[playerId]!, position: { ...limehouseGate.position!, x: limehouseGate.position!.x - 1 } },
      },
    };
    world = dispatchCommand(world, {
      type: 'TRAVEL_DISTRICT', actorId: playerId, targetDistrictId: BlueprintIdSchema.parse('district_limehouse_docks'),
    }).state;
    expect(world.currentDistrictId).toBe('district_limehouse_docks');

    const limehouseNpcs = Object.values(world.entities).filter((e) => e.actor && !e.actor.isPlayer);
    expect(limehouseNpcs.length).toBeGreaterThan(0);
  });
});
