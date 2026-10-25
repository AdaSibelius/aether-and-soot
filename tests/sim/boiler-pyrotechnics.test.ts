import { describe, expect, it } from 'vitest';
import { EntityIdSchema } from '../../src/schemas/primitives.schema.js';
import { dispatchCommand } from '../../src/sim/core/engine.js';
import { createInitialWorld } from '../../src/sim/core/world.js';
import { createEntityFromBlueprint } from '../../src/sim/data/item-catalog.js';
import { getTileCell, setTileCell } from '../../src/sim/spatial/grid.js';

const TEST_VISUAL = {
  glyph: '♨', fgPrimary: '#D4AF37', fgSecondary: '#8B6914', bgColor: '#0A0D0E', shaderFlags: [],
};

describe('Phase 25: Boiler Stoking, Pyrotechnics & Gas Hazards', () => {
  it('stokes steam reserve for free when adjacent to an unruptured boiler', () => {
    let world = createInitialWorld({ seed: 101, width: 10, height: 10 });
    const playerId = EntityIdSchema.parse('actor_player');
    const boilerId = EntityIdSchema.parse('fixture_test_boiler');
    const pPos = world.entities[playerId]!.position!;

    world = {
      ...world,
      entities: {
        ...world.entities,
        [playerId]: {
          ...world.entities[playerId]!,
          anatomy: { ...world.entities[playerId]!.anatomy!, steamReserveKpa: 0 },
        },
        [boilerId]: {
          id: boilerId,
          name: 'Bessemer Steam Vessel',
          visual: TEST_VISUAL,
          position: { x: pPos.x + 1, y: pPos.y, stratum: pPos.stratum, blocksMovement: true, blocksSight: false },
          pressureVessel: { currentPressureKpa: 100, maxPressureKpa: 250, ruptured: false },
        },
      },
    };

    expect(world.entities[playerId]!.anatomy!.steamReserveKpa).toBe(0);
    const result = dispatchCommand(world, { type: 'REFILL_STEAM', actorId: playerId, pressureAddedKpa: 50 });
    world = result.state;
    expect(world.entities[playerId]!.anatomy!.steamReserveKpa).toBe(50);
    const refillEvent = result.events.find((e) => e.type === 'STEAM_REFILLED');
    expect(refillEvent).toBeDefined();
    if (refillEvent && refillEvent.type === 'STEAM_REFILLED') {
      expect(refillEvent.stokedFromBoiler).toBe(true);
    }
  });

  it('consumes a steam canister from inventory for +60 kPa when away from boilers', () => {
    let world = createInitialWorld({ seed: 102, width: 10, height: 10 });
    const playerId = EntityIdSchema.parse('actor_player');
    const canisterId = EntityIdSchema.parse('item_canister_test');
    const canister = createEntityFromBlueprint('item_pressurized_steam_canister', canisterId, 1)!;

    world = {
      ...world,
      entities: {
        ...world.entities,
        [canisterId]: canister,
        [playerId]: {
          ...world.entities[playerId]!,
          anatomy: { ...world.entities[playerId]!.anatomy!, steamReserveKpa: 0 },
          inventory: {
            containedEntityIds: [...(world.entities[playerId]!.inventory?.containedEntityIds ?? []), canisterId], equippedSlots: {},
            currentMassGrams: 500, maxMassGrams: 20000, maxVolumeMl: 20000,
          },
        },
      },
    };

    const result = dispatchCommand(world, { type: 'REFILL_STEAM', actorId: playerId });
    world = result.state;
    expect(world.entities[playerId]!.anatomy!.steamReserveKpa).toBe(60);
    expect(world.entities[playerId]!.inventory!.containedEntityIds).not.toContain(canisterId);
    expect(world.entities[canisterId]).toBeUndefined();

    const refillEvent = result.events.find((e) => e.type === 'STEAM_REFILLED');
    expect(refillEvent).toBeDefined();
    if (refillEvent && refillEvent.type === 'STEAM_REFILLED') {
      expect(refillEvent.fuelBlueprintId).toBe('item_pressurized_steam_canister');
    }
  });

  it('fails to refill steam when player is isolated with empty pockets', () => {
    let world = createInitialWorld({ seed: 103, width: 10, height: 10 });
    const playerId = EntityIdSchema.parse('actor_player');

    const {
      [EntityIdSchema.parse('item_pneumatic_strider_leg')]: _l,
      [EntityIdSchema.parse('item_aetheric_monocle')]: _m,
      ...emptyPocketEntities
    } = world.entities;
    world = {
      ...world,
      entities: {
        ...emptyPocketEntities,
        [playerId]: {
          ...world.entities[playerId]!,
          anatomy: { ...world.entities[playerId]!.anatomy!, steamReserveKpa: 0 },
          inventory: {
            containedEntityIds: [], equippedSlots: {},
            currentMassGrams: 0, maxMassGrams: 20000, maxVolumeMl: 20000,
          },
        },
      },
    };

    const result = dispatchCommand(world, { type: 'REFILL_STEAM', actorId: playerId });
    expect(result.state.entities[playerId]!.anatomy!.steamReserveKpa).toBe(0);
    const failEvent = result.events.find((e) => e.type === 'STEAM_REFILL_FAILED');
    expect(failEvent).toBeDefined();
    if (failEvent && failEvent.type === 'STEAM_REFILL_FAILED') {
      expect(failEvent.reason).toContain('No adjacent boiler or fuel canister');
    }
  });

  it('vents steam to target tile, cooling core thermal heat and rejecting under 10 kPa', () => {
    let world = createInitialWorld({ seed: 104, width: 10, height: 10 });
    const playerId = EntityIdSchema.parse('actor_player');

    // Give player 5 kPa steam (under minimum threshold of 10)
    world = {
      ...world,
      entities: {
        ...world.entities,
        [playerId]: {
          ...world.entities[playerId]!,
          anatomy: { ...world.entities[playerId]!.anatomy!, steamReserveKpa: 5 },
          thermal: { coreHeatPct: 70 },
        },
      },
    };

    // Attempt vent with under 10 kPa -> fails
    const failResult = dispatchCommand(world, {
      type: 'VENT_STEAM', actorId: playerId, target: { x: 2, y: 2, stratum: 'STREET' }, pressureReleasedKpa: 15,
    });
    expect(failResult.events.some((e) => e.type === 'STEAM_VENT_FAILED')).toBe(true);

    // Give player 40 kPa steam and retry
    world = {
      ...world,
      entities: {
        ...world.entities,
        [playerId]: {
          ...world.entities[playerId]!,
          anatomy: { ...world.entities[playerId]!.anatomy!, steamReserveKpa: 40 },
          thermal: { coreHeatPct: 70 },
        },
      },
    };

    const ventResult = dispatchCommand(world, {
      type: 'VENT_STEAM', actorId: playerId, target: { x: 2, y: 2, stratum: 'STREET' }, pressureReleasedKpa: 25,
    });

    world = ventResult.state;
    expect(world.entities[playerId]!.anatomy!.steamReserveKpa).toBe(15);
    expect(world.entities[playerId]!.thermal!.coreHeatPct).toBe(60); // 70 - 10 = 60
    const targetCell = getTileCell(world.strata.STREET!, 2, 2);
    expect(targetCell!.steamPressureKpa).toBeGreaterThan(0);
  });

  it('sabotages boiler to rupture and ignites contiguous coal dust cloud with flint spark', () => {
    let world = createInitialWorld({ seed: 105, width: 10, height: 10 });
    const playerId = EntityIdSchema.parse('actor_player');
    const boilerId = EntityIdSchema.parse('boiler_sabotage_target');

    world = {
      ...world,
      entities: {
        ...world.entities,
        [boilerId]: {
          id: boilerId,
          name: 'Vulnerable Boiler',
          visual: TEST_VISUAL,
          position: { x: 2, y: 2, stratum: 'STREET', blocksMovement: true, blocksSight: false },
          pressureVessel: { currentPressureKpa: 150, maxPressureKpa: 200, ruptured: false },
        },
      },
    };

    // Sabotage valve (+120 kPa -> 270 kPa > 200 max) -> Ruptures!
    const sabotageRes = dispatchCommand(world, {
      type: 'PRESSURIZE_VESSEL', actorId: playerId, vesselEntityId: boilerId, pressureAddedKpa: 120,
    });

    world = sabotageRes.state;
    expect(world.entities[boilerId]!.pressureVessel!.ruptured).toBe(true);
    expect(world.entities[boilerId]!.pressureVessel!.currentPressureKpa).toBe(0);

    // Place coal dust cloud on (3, 3, STREET)
    world = {
      ...world,
      strata: {
        ...world.strata,
        STREET: setTileCell(world.strata.STREET!, 3, 3, (c) => ({ ...c, coalDustDensity: 0.6 })),
      },
    };

    const sparkRes = dispatchCommand(world, {
      type: 'EMIT_SPARK', actorId: playerId, target: { x: 3, y: 3, stratum: 'STREET' },
    });

    world = sparkRes.state;
    const dustEvent = sparkRes.events.find((e) => e.type === 'COAL_DUST_IGNITED');
    expect(dustEvent).toBeDefined();
    if (dustEvent && dustEvent.type === 'COAL_DUST_IGNITED') {
      expect(dustEvent.ignitedTileCount).toBeGreaterThan(0);
    }
    const burntCell = getTileCell(world.strata.STREET!, 3, 3);
    expect(burntCell!.coalDustDensity).toBe(0);
    expect(burntCell!.steamPressureKpa).toBeGreaterThan(0);
  });
});
