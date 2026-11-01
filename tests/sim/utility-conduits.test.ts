import { describe, expect, it } from 'vitest';
import { EntityRecord } from '../../src/schemas/components.schema.js';
import { BlueprintIdSchema, EntityIdSchema } from '../../src/schemas/primitives.schema.js';
import { SeededRNG } from '../../src/sim/core/rng.js';
import { advanceWorldEnvironment } from '../../src/sim/core/simulation-pipeline.js';
import { createInitialWorld, WorldState } from '../../src/sim/core/world.js';
import { createStratumGrid } from '../../src/sim/spatial/grid.js';
import { advanceUtilityConduitTick } from '../../src/sim/systems/utility-simulation.system.js';

export function makeTestEntity(id: string, name: string, overrides: Partial<EntityRecord> = {}): EntityRecord {
  return {
    id: EntityIdSchema.parse(id),
    name,
    visual: { glyph: 'o', fgPrimary: '#FFF', fgSecondary: '#888', bgColor: '#000', shaderFlags: [] },
    ...overrides,
  };
}

export function createUtilityConduitTestWorld(): WorldState {
  const world = createInitialWorld({ seed: 42 });
  const streetGrid = createStratumGrid('STREET', 12, 12);
  const undercroftGrid = createStratumGrid('UNDERCROFT', 12, 12);

  return {
    ...world,
    currentDistrictId: BlueprintIdSchema.parse('district_spitalfields_soot_works'),
    strata: { STREET: streetGrid, UNDERCROFT: undercroftGrid },
    entities: { ...world.entities },
  };
}

describe('Utility Conduit Pressure Simulation', () => {
  it('equalizes pressure between boiler pressure vessel and connected conduit', () => {
    let state = createUtilityConduitTestWorld();
    const boilerId = EntityIdSchema.parse('boiler_core_1');
    const conduitId = EntityIdSchema.parse('steam_main_1');

    state = {
      ...state,
      entities: {
        ...state.entities,
        [boilerId]: makeTestEntity('boiler_core_1', 'Boiler Core', {
          pressureVessel: { currentPressureKpa: 80, maxPressureKpa: 150, ruptured: false },
        }),
        [conduitId]: makeTestEntity('steam_main_1', 'High Pressure Steam Main', {
          utilityConduit: {
            conduitType: 'HIGH_PRESSURE_STEAM_MAIN',
            networkId: 'steam_net_a',
            operatingPressureKpa: 20,
            maxPressureKpa: 120,
            ruptured: false,
            connectedEndpointEntityIds: [boilerId],
          },
        }),
      },
    };

    const res = advanceUtilityConduitTick(state);
    expect(res.state.entities[boilerId]?.pressureVessel?.currentPressureKpa).toBe(55);
    expect(res.state.entities[conduitId]?.utilityConduit?.operatingPressureKpa).toBe(45);
  });

  it('equalizes pressure between two interconnected conduits', () => {
    let state = createUtilityConduitTestWorld();
    const pipeAId = EntityIdSchema.parse('pipe_a');
    const pipeBId = EntityIdSchema.parse('pipe_b');

    state = {
      ...state,
      entities: {
        ...state.entities,
        [pipeAId]: makeTestEntity('pipe_a', 'Steam Pipe Alpha', {
          utilityConduit: {
            conduitType: 'HIGH_PRESSURE_STEAM_MAIN',
            networkId: 'steam_net_a',
            operatingPressureKpa: 60,
            maxPressureKpa: 100,
            ruptured: false,
            connectedEndpointEntityIds: [pipeBId],
          },
        }),
        [pipeBId]: makeTestEntity('pipe_b', 'Steam Pipe Beta', {
          utilityConduit: {
            conduitType: 'HIGH_PRESSURE_STEAM_MAIN',
            networkId: 'steam_net_a',
            operatingPressureKpa: 20,
            maxPressureKpa: 100,
            ruptured: false,
            connectedEndpointEntityIds: [],
          },
        }),
      },
    };

    const res = advanceUtilityConduitTick(state);
    expect(res.state.entities[pipeAId]?.utilityConduit?.operatingPressureKpa).toBe(40);
    expect(res.state.entities[pipeBId]?.utilityConduit?.operatingPressureKpa).toBe(40);
  });

  it('ruptures conduit on overpressure, venting steam and updating visual glyph', () => {
    let state = createUtilityConduitTestWorld();
    const conduitId = EntityIdSchema.parse('fragile_pipe');

    state = {
      ...state,
      entities: {
        ...state.entities,
        [conduitId]: makeTestEntity('fragile_pipe', 'Fragile Pipe', {
          position: { x: 4, y: 4, stratum: 'STREET', blocksMovement: false, blocksSight: false },
          utilityConduit: {
            conduitType: 'HIGH_PRESSURE_STEAM_MAIN',
            networkId: 'danger_net',
            operatingPressureKpa: 240,
            maxPressureKpa: 150,
            ruptured: false,
            connectedEndpointEntityIds: [],
          },
        }),
      },
    };

    const res = advanceUtilityConduitTick(state);
    const cond = res.state.entities[conduitId]?.utilityConduit;
    const visual = res.state.entities[conduitId]?.visual;

    expect(cond?.ruptured).toBe(true);
    expect(cond?.isRuptured).toBe(true);
    expect(cond?.operatingPressureKpa).toBe(0);
    expect(visual?.glyph).toBe('*');

    const cell = res.state.strata.STREET?.cells[4 * 12 + 4];
    expect(cell?.steamPressureKpa).toBeGreaterThan(0);

    const rupEvent = res.events.find((e) => e.type === 'CONDUIT_RUPTURED');
    expect(rupEvent).toBeDefined();
    if (rupEvent && rupEvent.type === 'CONDUIT_RUPTURED') {
      expect(rupEvent.ventedPressureKpa).toBe(240);
    }
  });

  it('runs automatically inside advanceWorldEnvironment Phase 1 pipeline', () => {
    let state = createUtilityConduitTestWorld();
    const rng = new SeededRNG(9999);
    const conduitId = EntityIdSchema.parse('pipeline_rupture_conduit');

    state = {
      ...state,
      entities: {
        ...state.entities,
        [conduitId]: makeTestEntity('pipeline_rupture_conduit', 'Burst Pipe', {
          position: { x: 2, y: 2, stratum: 'STREET', blocksMovement: false, blocksSight: false },
          utilityConduit: {
            conduitType: 'HIGH_PRESSURE_STEAM_MAIN',
            networkId: 'pipe_net',
            operatingPressureKpa: 220,
            maxPressureKpa: 100,
            ruptured: false,
            connectedEndpointEntityIds: [],
          },
        }),
      },
    };

    const res = advanceWorldEnvironment(state, rng, 1);
    expect(res.events.some((e) => e.type === 'CONDUIT_RUPTURED')).toBe(true);
    expect(res.state.entities[conduitId]?.utilityConduit?.ruptured).toBe(true);
  });
});
