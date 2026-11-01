import { describe, expect, it } from 'vitest';
import { BlueprintIdSchema, EntityIdSchema } from '../../src/schemas/primitives.schema.js';
import { setTileCell } from '../../src/sim/spatial/grid.js';
import { advanceUtilityConduitTick } from '../../src/sim/systems/utility-simulation.system.js';
import { createUtilityConduitTestWorld, makeTestEntity } from './utility-conduits.test.js';

describe('Utility Shafts & Hydrology Channels', () => {
  it('transfers liquids and cargo down vertical cross-stratum shafts', () => {
    let state = createUtilityConduitTestWorld();
    const siphonId = EntityIdSchema.parse('shaft_siphon');
    const chuteId = EntityIdSchema.parse('shaft_chute');
    const itemId = EntityIdSchema.parse('item_cog');

    state = {
      ...state,
      strata: {
        ...state.strata,
        STREET: setTileCell(state.strata.STREET!, 5, 5, (c) => ({
          ...c,
          liquidType: 'SLUICE_SLUDGE',
          liquidVolumeMl: 1000,
        })),
      },
      entities: {
        ...state.entities,
        [siphonId]: makeTestEntity('shaft_siphon', 'Sewer Siphon', {
          crossStratumShaft: {
            shaftType: 'SEWER_SIPHON',
            upperStratum: 'STREET',
            lowerStratum: 'UNDERCROFT',
            upperCoord: { x: 5, y: 5 },
            lowerCoord: { x: 5, y: 5 },
            flowRateUnitsPerTick: 2,
            operational: true,
          },
        }),
        [chuteId]: makeTestEntity('shaft_chute', 'Gravity Chute', {
          crossStratumShaft: {
            shaftType: 'GRAVITY_CHUTE',
            upperStratum: 'STREET',
            lowerStratum: 'UNDERCROFT',
            upperCoord: { x: 2, y: 2 },
            lowerCoord: { x: 2, y: 2 },
            flowRateUnitsPerTick: 1,
            operational: true,
          },
        }),
        [itemId]: makeTestEntity('item_cog', 'Brass Cog', {
          position: { x: 2, y: 2, stratum: 'STREET', blocksMovement: false, blocksSight: false },
          item: {
            blueprintId: BlueprintIdSchema.parse('item_brass_cog'),
            category: 'MATERIAL',
            massGrams: 50,
            volumeMl: 25,
            stackable: true,
            quantity: 1,
          },
        }),
      },
    };

    const res = advanceUtilityConduitTick(state);
    const streetCell = res.state.strata.STREET?.cells[5 * 12 + 5];
    const underCell = res.state.strata.UNDERCROFT?.cells[5 * 12 + 5];

    expect(streetCell?.liquidVolumeMl).toBe(500);
    expect(underCell?.liquidType).toBe('SLUICE_SLUDGE');
    expect(underCell?.liquidVolumeMl).toBe(500);

    const cargoItem = res.state.entities[itemId];
    expect(cargoItem?.position?.stratum).toBe('UNDERCROFT');

    expect(res.events.some((e) => e.type === 'SHAFT_TRANSPORT_COMPLETED' && e.transportKind === 'FLUID')).toBe(true);
    expect(res.events.some((e) => e.type === 'SHAFT_TRANSPORT_COMPLETED' && e.transportKind === 'CARGO')).toBe(true);
  });

  it('transfers steam upwards via steam risers and cargo upwards via pneumatic lifts', () => {
    let state = createUtilityConduitTestWorld();
    const riserId = EntityIdSchema.parse('shaft_riser');
    const liftId = EntityIdSchema.parse('shaft_lift');
    const canisterId = EntityIdSchema.parse('item_canister');

    state = {
      ...state,
      strata: {
        ...state.strata,
        UNDERCROFT: setTileCell(state.strata.UNDERCROFT!, 6, 6, (c) => ({
          ...c,
          steamPressureKpa: 60,
        })),
      },
      entities: {
        ...state.entities,
        [riserId]: makeTestEntity('shaft_riser', 'Steam Riser', {
          crossStratumShaft: {
            shaftType: 'STEAM_RISER',
            upperStratum: 'STREET',
            lowerStratum: 'UNDERCROFT',
            upperCoord: { x: 6, y: 6 },
            lowerCoord: { x: 6, y: 6 },
            flowRateUnitsPerTick: 2,
            operational: true,
          },
        }),
        [liftId]: makeTestEntity('shaft_lift', 'Pneumatic Lift', {
          crossStratumShaft: {
            shaftType: 'PNEUMATIC_LIFT',
            upperStratum: 'STREET',
            lowerStratum: 'UNDERCROFT',
            upperCoord: { x: 8, y: 8 },
            lowerCoord: { x: 8, y: 8 },
            flowRateUnitsPerTick: 1,
            operational: true,
          },
        }),
        [canisterId]: makeTestEntity('item_canister', 'Aether Canister', {
          position: { x: 8, y: 8, stratum: 'UNDERCROFT', blocksMovement: false, blocksSight: false },
          item: {
            blueprintId: BlueprintIdSchema.parse('item_aether_canister'),
            category: 'CONSUMABLE',
            massGrams: 200,
            volumeMl: 100,
            stackable: true,
            quantity: 1,
          },
        }),
      },
    };

    const res = advanceUtilityConduitTick(state);
    const lowCell = res.state.strata.UNDERCROFT?.cells[6 * 12 + 6];
    const upCell = res.state.strata.STREET?.cells[6 * 12 + 6];

    expect(lowCell?.steamPressureKpa).toBe(20);
    expect(upCell?.steamPressureKpa).toBe(40);

    const liftedItem = res.state.entities[canisterId];
    expect(liftedItem?.position?.stratum).toBe('STREET');
  });

  it('drains liquids through open hydrology sluices into connected strata', () => {
    let state = createUtilityConduitTestWorld();
    const canalId = EntityIdSchema.parse('gutter_channel');

    state = {
      ...state,
      strata: {
        ...state.strata,
        STREET: setTileCell(state.strata.STREET!, 3, 3, (c) => ({
          ...c,
          liquidType: 'SLUICE_SLUDGE',
          liquidVolumeMl: 800,
        })),
      },
      entities: {
        ...state.entities,
        [canalId]: makeTestEntity('gutter_channel', 'Drainage Channel', {
          position: { x: 3, y: 3, stratum: 'STREET', blocksMovement: false, blocksSight: false },
          hydrologyChannel: {
            fluidType: 'SLUDGE',
            currentVolumeMl: 500,
            maxFlowRateMlPerTick: 400,
            sluiceOpen: true,
            drainsIntoStratum: 'UNDERCROFT',
          },
        }),
      },
    };

    const res = advanceUtilityConduitTick(state);
    const streetCell = res.state.strata.STREET?.cells[3 * 12 + 3];
    const underCell = res.state.strata.UNDERCROFT?.cells[3 * 12 + 3];

    expect(streetCell?.liquidVolumeMl).toBe(400);
    expect(underCell?.liquidType).toBe('SLUICE_SLUDGE');
    expect(underCell?.liquidVolumeMl).toBe(400);

    const drainEv = res.events.find((e) => e.type === 'HYDROLOGY_DRAINED');
    expect(drainEv).toBeDefined();
  });

  it('triggers localized flooding and visual change when closed sluice overflows', () => {
    let state = createUtilityConduitTestWorld();
    const floodId = EntityIdSchema.parse('blocked_basin');

    state = {
      ...state,
      entities: {
        ...state.entities,
        [floodId]: makeTestEntity('blocked_basin', 'Blocked Basin', {
          position: { x: 4, y: 4, stratum: 'STREET', blocksMovement: false, blocksSight: false },
          hydrologyChannel: {
            fluidType: 'ACID',
            currentVolumeMl: 29800,
            maxFlowRateMlPerTick: 500,
            sluiceOpen: false,
          },
        }),
      },
    };

    const res = advanceUtilityConduitTick(state);
    const updated = res.state.entities[floodId];

    expect(updated?.hydrologyChannel?.currentVolumeMl).toBe(30000);
    expect(updated?.visual?.glyph).toBe('■');

    const cell = res.state.strata.STREET?.cells[4 * 12 + 4];
    expect(cell?.liquidType).toBe('NITRIC_ACID');
    expect(cell?.liquidVolumeMl).toBeGreaterThan(0);

    const floodEv = res.events.find((e) => e.type === 'HYDROLOGY_FLOODING');
    expect(floodEv).toBeDefined();
  });
});
