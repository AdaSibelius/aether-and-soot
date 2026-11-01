import { describe, expect, it } from 'vitest';
import {
  CHUNK_SIZE_X,
  CHUNK_SIZE_Y,
  ChunkCoordinateSchema,
  ChunkLifecycleStateSchema,
  ChunkStreamingLedgerSchema,
  DormantChunkRecordSchema,
  formatChunkKey,
} from '../../src/schemas/chunk-streaming.schema.js';
import {
  BlueprintIdSchema,
  ChunkKeySchema,
  EntityIdSchema,
} from '../../src/schemas/primitives.schema.js';
import { CityGraphLedgerSchema } from '../../src/schemas/city-graph.schema.js';
import { EntityRecord } from '../../src/schemas/components.schema.js';
import {
  assertWorldInvariants,
  validateWorldInvariants,
} from '../../src/sim/core/invariants.js';
import {
  createInitialWorld,
  deserializeWorld,
  serializeWorld,
  WorldState,
} from '../../src/sim/core/world.js';

describe('Chunk Streaming Schemas & WorldState Integration', () => {
  it('enforces chunk dimension constants and coordinate schemas', () => {
    expect(CHUNK_SIZE_X).toBe(16);
    expect(CHUNK_SIZE_Y).toBe(12);

    const coord = ChunkCoordinateSchema.parse({
      districtId: 'district_spitalfields_soot_works',
      stratum: 'STREET',
      cx: 2,
      cy: 1,
    });
    expect(coord.cx).toBe(2);
    expect(coord.cy).toBe(1);

    expect(() =>
      ChunkCoordinateSchema.parse({
        districtId: 'district_spitalfields_soot_works',
        stratum: 'STREET',
        cx: -1,
        cy: 0,
      }),
    ).toThrow();

    const formattedKey = formatChunkKey(coord);
    expect(formattedKey).toBe('chunk:district_spitalfields_soot_works:STREET:2,1');
    expect(ChunkKeySchema.parse(formattedKey)).toBe(formattedKey);
  });

  it('validates lifecycle states and dormant chunk record schemas', () => {
    expect(ChunkLifecycleStateSchema.parse('ACTIVE')).toBe('ACTIVE');
    expect(ChunkLifecycleStateSchema.parse('DORMANT')).toBe('DORMANT');
    expect(ChunkLifecycleStateSchema.parse('UNGENERATED')).toBe('UNGENERATED');
    expect(() => ChunkLifecycleStateSchema.parse('UNKNOWN')).toThrow();

    const dormantRecord = DormantChunkRecordSchema.parse({
      chunkKey: 'chunk:district_limehouse:UNDERCROFT:0,0',
      coord: { districtId: 'district_limehouse', stratum: 'UNDERCROFT', cx: 0, cy: 0 },
      lastSimulatedTurn: 42,
      appliedCausalTick: 3,
      cells: [{ terrainType: 'COBBLESTONE_FLOOR', blocksMovement: false, blocksSight: false }],
      residentEntityIds: ['actor_dormant_sentry'],
    });

    expect(dormantRecord.appliedCausalTick).toBe(3);
    expect(dormantRecord.residentEntityIds).toContain('actor_dormant_sentry');

    expect(() =>
      DormantChunkRecordSchema.parse({ ...dormantRecord, appliedCausalTick: -1 }),
    ).toThrow();
  });

  it('verifies serializeWorld and deserializeWorld round-trip fidelity with cityGraph and chunkLedger', () => {
    const baseWorld = createInitialWorld({ seed: 888, width: 32, height: 24 });
    const dormantId = EntityIdSchema.parse('actor_dormant_automaton');

    const dormantEntity: EntityRecord = {
      id: dormantId,
      name: 'Mothballed Steam Automaton',
      visual: { glyph: 'A', fgPrimary: '#888888', fgSecondary: '#444444', bgColor: '#000000', shaderFlags: [] },
      position: { x: 4, y: 4, stratum: 'UNDERCROFT', blocksMovement: true, blocksSight: false },
    };

    const chunkKey = ChunkKeySchema.parse('chunk:district_spitalfields:UNDERCROFT:1,0');

    const worldWithLedgers: WorldState = {
      ...baseWorld,
      cityGraph: CityGraphLedgerSchema.parse({
        nodes: {
          district_spitalfields: {
            districtId: BlueprintIdSchema.parse('district_spitalfields'),
            controllingFactionId: 'CLOCKWORK_GUILD',
            reservoirs: { steamHeadKpa: 500, anthraciteCoalTons: 80, carbolicTinctureLiters: 15, preservedRationsCrates: 60, miasmaSaturationPpm: 5, laborUnrestPct: 20 },
            flags: { steamOutageActive: false, clinicStockoutActive: false, workerStrikeActive: false, sluiceFloodedActive: false },
            lastUpdatedTurn: 15,
          },
        },
        edges: {},
      }),
      chunkLedger: ChunkStreamingLedgerSchema.parse({
        activeWindowCenter: { districtId: 'district_spitalfields', stratum: 'STREET', cx: 0, cy: 0 },
        activeChunkKeys: ['chunk:district_spitalfields:STREET:0,0'],
        dormantChunks: {
          [chunkKey]: {
            chunkKey,
            coord: { districtId: 'district_spitalfields', stratum: 'UNDERCROFT', cx: 1, cy: 0 },
            lastSimulatedTurn: 10,
            appliedCausalTick: 1,
            cells: [],
            residentEntityIds: [dormantId],
          },
        },
        dormantEntities: { [dormantId]: dormantEntity },
      }),
    };

    expect(validateWorldInvariants(worldWithLedgers)).toEqual([]);
    expect(() => assertWorldInvariants(worldWithLedgers)).not.toThrow();

    const serialized = serializeWorld(worldWithLedgers);
    const deserialized = deserializeWorld(serialized);

    expect(deserialized.version).toBe(1);
    expect(deserialized.cityGraph).toEqual(worldWithLedgers.cityGraph);
    expect(deserialized.chunkLedger).toEqual(worldWithLedgers.chunkLedger);
    expect(deserialized.chunkLedger?.dormantEntities[dormantId]?.name).toBe(
      'Mothballed Steam Automaton',
    );
    expect(() => assertWorldInvariants(deserialized)).not.toThrow();
  });

  it('detects invariant violation when an entity is both active and dormant', () => {
    const world = createInitialWorld({ seed: 889 });
    const duplicateId = EntityIdSchema.parse('actor_player');

    const corruptedWorld: WorldState = {
      ...world,
      chunkLedger: {
        activeChunkKeys: [],
        dormantChunks: {},
        dormantEntities: {
          [duplicateId]: world.entities[duplicateId]!,
        },
      },
    };

    const violations = validateWorldInvariants(corruptedWorld);
    expect(
      violations.some((v) =>
        v.includes('exists simultaneously in active entities and dormantEntities'),
      ),
    ).toBe(true);
    expect(() => assertWorldInvariants(corruptedWorld)).toThrow(
      /exists simultaneously in active entities and dormantEntities/,
    );
  });

  it('detects invariant violation when dormant chunk references entity missing from dormantEntities', () => {
    const world = createInitialWorld({ seed: 890 });
    const missingId = EntityIdSchema.parse('actor_missing_phantom');
    const chunkKey = ChunkKeySchema.parse('chunk:district_limehouse:STREET:0,0');

    const corruptedWorld: WorldState = {
      ...world,
      chunkLedger: {
        activeChunkKeys: [],
        dormantChunks: {
          [chunkKey]: {
            chunkKey,
            coord: {
              districtId: BlueprintIdSchema.parse('district_limehouse'),
              stratum: 'STREET',
              cx: 0,
              cy: 0,
            },
            lastSimulatedTurn: 5,
            appliedCausalTick: 0,
            cells: [],
            residentEntityIds: [missingId],
          },
        },
        dormantEntities: {},
      },
    };

    const violations = validateWorldInvariants(corruptedWorld);
    expect(
      violations.some((v) =>
        v.includes('which is missing from dormantEntities'),
      ),
    ).toBe(true);
    expect(() => assertWorldInvariants(corruptedWorld)).toThrow(
      /which is missing from dormantEntities/,
    );
  });
});
