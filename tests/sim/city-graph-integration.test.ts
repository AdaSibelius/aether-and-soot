import { describe, expect, it } from 'vitest';
import { BlueprintIdSchema, ChunkKeySchema, ConduitEdgeIdSchema, EntityIdSchema } from '../../src/schemas/primitives.schema.js';
import { createInitialWorld } from '../../src/sim/core/world.js';
import { dispatchCommand } from '../../src/sim/core/engine.js';
import { SeededRNG } from '../../src/sim/core/rng.js';
import { advanceCityGraphMacroTick } from '../../src/sim/systems/city-causal.system.js';
import {
  projectChunkStreamingSummary,
  projectDistrictCausalSummary,
  projectDistrictConduits,
} from '../../src/client/projection/city-graph-projection.js';
import {
  parseLlmResponseToCommand,
  serializePlayerContext,
} from '../scripts/playtester-serializer.js';

describe('Causal City Graph Integration, Command Routing & Telemetry', () => {
  const playerId = EntityIdSchema.parse('actor_player');
  const steamEdgeId = ConduitEdgeIdSchema.parse('edge_spitalfields_belgravia_steam');

  it('routes MODULATE_CAUSAL_CONDUIT through dispatchCommand and executes valve modulation', () => {
    let world = createInitialWorld({ seed: 777 });
    expect(world.cityGraph?.edges[steamEdgeId]?.valveOpen).toBe(true);

    // 1. Close valve via dispatchCommand
    const closeRes = dispatchCommand(world, {
      type: 'MODULATE_CAUSAL_CONDUIT',
      actorId: playerId,
      edgeId: steamEdgeId,
      action: 'CLOSE_VALVE',
    });

    expect(closeRes.state.cityGraph?.edges[steamEdgeId]?.valveOpen).toBe(false);
    expect(closeRes.events.some((e) => e.type === 'CAUSAL_CONDUIT_MODULATED')).toBe(true);
    world = closeRes.state;

    // 2. Advance macro-tick: Belgravia consumes steam but receives 0 from closed conduit
    const rng = new SeededRNG(12345);
    const macroRes = advanceCityGraphMacroTick(world, rng, world.turnCount + 10);
    const belgravia = macroRes.state.cityGraph?.nodes['district_belgravia_brass_spires'];

    expect(belgravia).toBeDefined();
    expect(belgravia!.reservoirs.steamHeadKpa).toBeLessThan(80);
    expect(belgravia!.flags.steamOutageActive).toBe(true);
    expect(macroRes.events.some((e) => e.type === 'DISTRICT_CAUSAL_CASCADE_TRIGGERED')).toBe(true);

    // 3. Re-open valve and verify restoration
    const openRes = dispatchCommand(macroRes.state, {
      type: 'MODULATE_CAUSAL_CONDUIT',
      actorId: playerId,
      edgeId: steamEdgeId,
      action: 'OPEN_VALVE',
    });
    expect(openRes.state.cityGraph?.edges[steamEdgeId]?.valveOpen).toBe(true);
  });

  it('executes conduit sabotage and progressive repair via dispatchCommand', () => {
    let world = createInitialWorld({ seed: 888 });

    // Sabotage
    const sabRes = dispatchCommand(world, {
      type: 'MODULATE_CAUSAL_CONDUIT',
      actorId: playerId,
      edgeId: steamEdgeId,
      action: 'SABOTAGE_CONDUIT',
    });
    expect(sabRes.state.cityGraph?.edges[steamEdgeId]?.integrityPct).toBe(0);
    world = sabRes.state;

    // Repair (+50% integrity)
    const repRes = dispatchCommand(world, {
      type: 'MODULATE_CAUSAL_CONDUIT',
      actorId: playerId,
      edgeId: steamEdgeId,
      action: 'REPAIR_CONDUIT',
    });
    expect(repRes.state.cityGraph?.edges[steamEdgeId]?.integrityPct).toBe(50);
  });

  it('projects district causal reservoirs, active alerts, and conduit summaries to client read models', () => {
    const world = createInitialWorld({ seed: 999 });

    // Initial projection
    const initialSummary = projectDistrictCausalSummary(world.cityGraph, 'district_spitalfields_soot_works');
    expect(initialSummary).toBeDefined();
    expect(initialSummary!.steamKpa).toBe(500);
    expect(initialSummary!.activeAlerts).toHaveLength(0);

    const conduits = projectDistrictConduits(world.cityGraph, 'district_spitalfields_soot_works');
    expect(conduits.length).toBeGreaterThanOrEqual(2);
    expect(conduits.some((c) => c.edgeId === steamEdgeId)).toBe(true);

    // Chunk streaming projection (empty fallback vs populated)
    const emptyChunkSummary = projectChunkStreamingSummary(world.chunkLedger);
    expect(emptyChunkSummary.activeCount).toBe(0);
    expect(emptyChunkSummary.centerLabel).toBe('N/A');

    const chunkLedger = {
      activeWindowCenter: { districtId: BlueprintIdSchema.parse('district_spitalfields_soot_works'), stratum: 'STREET' as const, cx: 1, cy: 1 },
      activeChunkKeys: [ChunkKeySchema.parse('chunk_district_spitalfields_soot_works_STREET_1_1')],
      dormantChunks: {},
      dormantEntities: {},
    };
    const populatedWorld = { ...world, chunkLedger };
    const chunkSummary = projectChunkStreamingSummary(populatedWorld.chunkLedger);
    expect(chunkSummary.activeCount).toBe(1);
    expect(chunkSummary.dormantCount).toBe(0);
    expect(chunkSummary.centerLabel).toContain('STREET');
  });

  it('serializes conduit options in playtester and parses LLM conduit and P2 commands', () => {
    const world = createInitialWorld({ seed: 1010 });

    // Serializer surfaces conduit command
    const contextStr = serializePlayerContext(world, playerId);
    expect(contextStr).toContain('MODULATE_CAUSAL_CONDUIT');

    // Dispatcher parses MODULATE_CAUSAL_CONDUIT payload
    const parsedConduit = parseLlmResponseToCommand(
      JSON.stringify({
        action: 'MODULATE_CAUSAL_CONDUIT',
        edgeId: 'edge_spitalfields_belgravia_steam',
        conduitAction: 'CLOSE_VALVE',
      }),
      world,
      playerId,
    );
    expect(parsedConduit.type).toBe('MODULATE_CAUSAL_CONDUIT');
    if (parsedConduit.type === 'MODULATE_CAUSAL_CONDUIT') {
      expect(parsedConduit.action).toBe('CLOSE_VALVE');
      expect(parsedConduit.edgeId).toBe(steamEdgeId);
    }

    // P2 unwired commands round-trip
    const parsedBed = parseLlmResponseToCommand('{"action": "REST_AT_BED"}', world, playerId);
    expect(parsedBed.type).toBe('REST_AT_BED');

    const parsedCrime = parseLlmResponseToCommand(
      '{"action": "REPORT_CRIME", "perpetratorId": "actor_jack", "crime": "THEFT"}',
      world,
      playerId,
    );
    expect(parsedCrime.type).toBe('REPORT_CRIME');

    const parsedProsth = parseLlmResponseToCommand(
      '{"action": "REMOVE_PROSTHETIC", "slot": "LEFT_ARM"}',
      world,
      playerId,
    );
    expect(parsedProsth.type).toBe('REMOVE_PROSTHETIC');

    const parsedPosture = parseLlmResponseToCommand(
      '{"action": "SET_POSTURE", "posture": "CROUCHED"}',
      world,
      playerId,
    );
    expect(parsedPosture.type).toBe('SET_POSTURE');
  });
});
