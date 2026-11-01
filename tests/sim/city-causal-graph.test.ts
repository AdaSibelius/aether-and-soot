import { describe, expect, it } from 'vitest';
import { ConduitEdgeIdSchema, EntityIdSchema } from '../../src/schemas/primitives.schema.js';
import { DistrictCausalCascadeTriggeredEvent } from '../../src/schemas/events.schema.js';
import { SeededRNG } from '../../src/sim/core/rng.js';
import { createInitialWorld } from '../../src/sim/core/world.js';
import { advanceTurnSchedule } from '../../src/sim/core/scheduler.js';
import {
  computeEffectiveConduitFlow,
  createInitialCityGraphLedger,
  getDownstreamConduits,
  getUpstreamConduits,
} from '../../src/sim/spatial/city-graph.js';
import {
  advanceCityGraphMacroTick,
  resolveModulateCausalConduit,
} from '../../src/sim/systems/city-causal.system.js';

describe('Causal City Graph Topology, Conduit Modulation & Macro-Tick Cascades', () => {
  const edgeBelgraviaSteamId = ConduitEdgeIdSchema.parse('edge_spitalfields_belgravia_steam');
  const playerId = EntityIdSchema.parse('actor_player');

  it('initializes canonical city graph ledger with district dossiers and conduits', () => {
    const graph = createInitialCityGraphLedger();

    expect(graph.nodes['district_spitalfields_soot_works']?.reservoirs.steamHeadKpa).toBe(500);
    expect(graph.nodes['district_whitechapel_ward']?.reservoirs.carbolicTinctureLiters).toBe(250);
    expect(graph.nodes['district_limehouse_docks']?.reservoirs.preservedRationsCrates).toBe(400);
    expect(graph.nodes['district_fleet_ditch_undercroft']?.reservoirs.miasmaSaturationPpm).toBe(60);
    expect(graph.nodes['district_belgravia_brass_spires']?.reservoirs.steamHeadKpa).toBe(110);

    const upstreamBelgravia = getUpstreamConduits(graph, 'district_belgravia_brass_spires');
    expect(upstreamBelgravia.some((e) => e.edgeId === edgeBelgraviaSteamId)).toBe(true);

    const downstreamSpitalfields = getDownstreamConduits(graph, 'district_spitalfields_soot_works');
    expect(downstreamSpitalfields.length).toBeGreaterThanOrEqual(2);

    const edge = graph.edges[edgeBelgraviaSteamId]!;
    expect(computeEffectiveConduitFlow(edge)).toBe(80);
    expect(computeEffectiveConduitFlow({ ...edge, valveOpen: false })).toBe(0);
    expect(computeEffectiveConduitFlow({ ...edge, integrityPct: 0 })).toBe(0);
  });

  it('modulates causal conduit valve and integrity with typed events', () => {
    const world = createInitialWorld({ seed: 555 });
    expect(world.cityGraph).toBeDefined();

    // 1. Close Valve
    const closeRes = resolveModulateCausalConduit(world, playerId, edgeBelgraviaSteamId, 'CLOSE_VALVE');
    expect(closeRes.state.cityGraph?.edges[edgeBelgraviaSteamId]?.valveOpen).toBe(false);
    expect(closeRes.events[0]?.type).toBe('CAUSAL_CONDUIT_MODULATED');
    expect(closeRes.apSpent).toBe(50);

    // 2. Sabotage Conduit
    const sabotageRes = resolveModulateCausalConduit(closeRes.state, playerId, edgeBelgraviaSteamId, 'SABOTAGE_CONDUIT');
    expect(sabotageRes.state.cityGraph?.edges[edgeBelgraviaSteamId]?.integrityPct).toBe(0);
    expect(sabotageRes.apSpent).toBe(100);

    // 3. Repair Conduit
    const repairRes = resolveModulateCausalConduit(sabotageRes.state, playerId, edgeBelgraviaSteamId, 'REPAIR_CONDUIT');
    expect(repairRes.state.cityGraph?.edges[edgeBelgraviaSteamId]?.integrityPct).toBe(50);

    // 4. Open Valve
    const openRes = resolveModulateCausalConduit(repairRes.state, playerId, edgeBelgraviaSteamId, 'OPEN_VALVE');
    expect(openRes.state.cityGraph?.edges[edgeBelgraviaSteamId]?.valveOpen).toBe(true);
  });

  it('triggers downstream steamOutageActive cascade in Belgravia when Spitalfields conduit is closed', () => {
    const world = createInitialWorld({ seed: 666 });
    const rng = new SeededRNG(666);

    // Baseline: With valve open, steam propagates from Spitalfields and Belgravia remains above 80 kPa
    const baselineTick = advanceCityGraphMacroTick(world, rng, 100);
    const baselineBelgravia = baselineTick.state.cityGraph?.nodes['district_belgravia_brass_spires'];
    expect(baselineBelgravia?.reservoirs.steamHeadKpa).toBeGreaterThanOrEqual(80);
    expect(baselineBelgravia?.flags.steamOutageActive).toBe(false);

    // Close Spitalfields -> Belgravia steam conduit
    const modulated = resolveModulateCausalConduit(world, playerId, edgeBelgraviaSteamId, 'CLOSE_VALVE');

    // Macro-tick simulation: Belgravia receives 0 steam and consumes 40 kPa, dropping below 80 kPa
    const cascadeTick = advanceCityGraphMacroTick(modulated.state, rng, 100);
    const starvedBelgravia = cascadeTick.state.cityGraph?.nodes['district_belgravia_brass_spires'];

    expect(starvedBelgravia).toBeDefined();
    expect(starvedBelgravia?.reservoirs.steamHeadKpa).toBeLessThan(80);
    expect(starvedBelgravia?.flags.steamOutageActive).toBe(true);

    const cascadeEvent = cascadeTick.events.find(
      (e): e is DistrictCausalCascadeTriggeredEvent =>
        e.type === 'DISTRICT_CAUSAL_CASCADE_TRIGGERED' && e.cascadeType === 'STEAM_OUTAGE',
    );
    expect(cascadeEvent).toBeDefined();
    expect(cascadeEvent?.districtId).toBe('district_belgravia_brass_spires');
  });

  it('triggers steamOutageActive and depressurizes active district utility conduits via scheduler', () => {
    const world = createInitialWorld({ seed: 777 });
    const rng = new SeededRNG(777);

    // Set current district to Belgravia Spires and add a steam conduit entity
    const conduitEntityId = EntityIdSchema.parse('entity_belgravia_main_steam');
    const worldInBelgravia = {
      ...world,
      currentDistrictId: 'district_belgravia_brass_spires' as typeof world.currentDistrictId,
      entities: {
        ...world.entities,
        [conduitEntityId]: {
          id: conduitEntityId,
          name: 'Belgravia Spire Steam Main',
          visual: { glyph: '=', fgPrimary: '#D4AF37', fgSecondary: '#8B4513', bgColor: '#0A0D0E', shaderFlags: [] },
          utilityConduit: {
            conduitType: 'HIGH_PRESSURE_STEAM_MAIN' as const,
            networkId: 'net_belgravia_steam',
            operatingPressureKpa: 160,
            maxPressureKpa: 250,
            ruptured: false,
            connectedEndpointEntityIds: [],
          },
        },
      },
    };

    // Close the arterial valve
    const modulated = resolveModulateCausalConduit(worldInBelgravia, playerId, edgeBelgraviaSteamId, 'CLOSE_VALVE');

    // Advance 100 turns crossing the macro-tick threshold
    const scheduleRes = advanceTurnSchedule(modulated.state, playerId, 100, [], rng, 100);

    const updatedBelgraviaNode = scheduleRes.state.cityGraph?.nodes['district_belgravia_brass_spires'];
    expect(updatedBelgraviaNode?.flags.steamOutageActive).toBe(true);

    // Verify active district high-pressure steam conduit was depressurized to 0 kPa
    const conduit = scheduleRes.state.entities[conduitEntityId]?.utilityConduit;
    expect(conduit).toBeDefined();
    expect(conduit?.operatingPressureKpa).toBe(0);
  });
});
