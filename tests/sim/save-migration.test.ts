import { describe, expect, it } from 'vitest';
import { dispatchCommand } from '../../src/sim/core/engine.js';
import { assertWorldInvariants } from '../../src/sim/core/invariants.js';
import {
  createInitialWorld,
  deserializeWorld,
  serializeWorld,
  WorldState,
} from '../../src/sim/core/world.js';
import {
  CURRENT_WORLD_VERSION,
  migrateWorldState,
  WorldMigrationError,
} from '../../src/sim/core/world-migration.js';

describe('Phase ARCH-4.1: Save-State Version Migration Harness', () => {
  it('directly validates and deserializes current version (v1) save states', () => {
    const originalWorld = createInitialWorld({ seed: 401, width: 20, height: 20 });
    expect(originalWorld.version).toBe(CURRENT_WORLD_VERSION);

    const json = serializeWorld(originalWorld);
    const deserialized = deserializeWorld(json);

    expect(deserialized.version).toBe(CURRENT_WORLD_VERSION);
    expect(deserialized).toEqual(originalWorld);
    expect(() => assertWorldInvariants(deserialized)).not.toThrow();
  });

  it('migrates legacy v0 save payloads missing version and modern subsystem records to valid v1', () => {
    const initial = createInitialWorld({ seed: 402, width: 16, height: 16 });

    // Construct a synthetic v0 payload: omit version, safehouses, codex, turf, convoys, audits, savedDistricts
    const rawV0: Record<string, unknown> = {
      seed: initial.seed,
      rngState: initial.rngState,
      turnCount: initial.turnCount,
      strata: initial.strata,
      entities: initial.entities,
      economy: initial.economy,
      eventLog: initial.eventLog,
    };

    expect(rawV0['version']).toBeUndefined();
    expect(rawV0['safehouses']).toBeUndefined();

    const migrated: WorldState = migrateWorldState(rawV0);

    expect(migrated.version).toBe(1);
    expect(migrated.safehouses).toEqual({});
    expect(migrated.codex).toEqual({});
    expect(migrated.turf).toEqual({});
    expect(migrated.convoys).toEqual({});
    expect(migrated.audits).toEqual({});
    expect(migrated.savedDistricts).toEqual({});
    expect(migrated.macroTickCount).toBe(0);
    expect(migrated.currentDistrictId).toBe('district_spitalfields_soot_works');
    expect(() => assertWorldInvariants(migrated)).not.toThrow();

    // Verify migrated world is fully playable in the engine
    const turnResult = dispatchCommand(migrated, {
      type: 'WAIT_TURN',
      actorId: migrated.entities['actor_player']!.id,
    });
    expect(turnResult.resolution.status).toBe('applied');
    expect(turnResult.state.turnCount).toBe(migrated.turnCount + 1);
  });

  it('rejects unsupported future save-state versions with UNSUPPORTED_FUTURE_VERSION', () => {
    const futureSave = {
      version: CURRENT_WORLD_VERSION + 1,
      seed: 403,
      entities: {},
    };

    expect(() => migrateWorldState(futureSave)).toThrow(WorldMigrationError);

    try {
      migrateWorldState(futureSave);
    } catch (err) {
      expect(err).toBeInstanceOf(WorldMigrationError);
      const migErr = err as WorldMigrationError;
      expect(migErr.code).toBe('UNSUPPORTED_FUTURE_VERSION');
      expect(migErr.message).toContain('newer than supported version');
    }
  });

  it('rejects corrupted or non-object save payloads with CORRUPTED_SAVE_PAYLOAD', () => {
    const invalidInputs = [null, undefined, 'raw string', 12345, true, [1, 2, 3]];

    for (const input of invalidInputs) {
      expect(() => migrateWorldState(input)).toThrow(WorldMigrationError);
      try {
        migrateWorldState(input);
      } catch (err) {
        expect((err as WorldMigrationError).code).toBe('CORRUPTED_SAVE_PAYLOAD');
      }
    }
  });

  it('rejects invalid or non-integer version numbers with CORRUPTED_SAVE_PAYLOAD', () => {
    const invalidVersions = [-1, 1.5, NaN];

    for (const v of invalidVersions) {
      const payload = { version: v, seed: 100 };
      expect(() => migrateWorldState(payload)).toThrow(WorldMigrationError);
      try {
        migrateWorldState(payload);
      } catch (err) {
        expect((err as WorldMigrationError).code).toBe('CORRUPTED_SAVE_PAYLOAD');
      }
    }
  });

  it('handles malformed JSON in deserializeWorld with a typed WorldMigrationError', () => {
    const malformedJson = '{ "seed": 404, "version": ';

    expect(() => deserializeWorld(malformedJson)).toThrow(WorldMigrationError);
    try {
      deserializeWorld(malformedJson);
    } catch (err) {
      expect((err as WorldMigrationError).code).toBe('CORRUPTED_SAVE_PAYLOAD');
      expect((err as WorldMigrationError).message).toContain('Malformed JSON');
    }
  });

  it('preserves existing player state, inventory, and procedural entities across migration', () => {
    const initial = createInitialWorld({ seed: 405, width: 20, height: 20 });
    const pId = 'actor_player';
    const playerBefore = initial.entities[pId]!;

    const rawLegacy = {
      ...initial,
      version: undefined,
      safehouses: undefined,
      codex: undefined,
    };

    const migrated = migrateWorldState(rawLegacy);

    expect(migrated.entities[pId]).toEqual(playerBefore);
    expect(migrated.strata.STREET).toEqual(initial.strata.STREET);
    expect(migrated.seed).toBe(initial.seed);
  });
});
