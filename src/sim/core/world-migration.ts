import { WorldState, WorldStateSchema } from './world.js';

export const CURRENT_WORLD_VERSION = 1;

export type WorldMigrationErrorCode =
  | 'CORRUPTED_SAVE_PAYLOAD'
  | 'UNSUPPORTED_FUTURE_VERSION'
  | 'MIGRATION_FAILED';

export class WorldMigrationError extends Error {
  readonly code: WorldMigrationErrorCode;

  constructor(code: WorldMigrationErrorCode, message: string) {
    super(`[WorldMigrationError:${code}] ${message}`);
    this.name = 'WorldMigrationError';
    this.code = code;
  }
}

export type MigrationTransformer = (data: Record<string, unknown>) => Record<string, unknown>;

export interface MigrationStep {
  readonly fromVersion: number;
  readonly toVersion: number;
  readonly transform: MigrationTransformer;
}

/**
 * Transforms a v0 save (unversioned legacy save) into v1 format.
 * Guarantees version stamp and populates missing subsystem structures.
 */
export function migrateV0ToV1(raw: Record<string, unknown>): Record<string, unknown> {
  return {
    ...raw,
    version: 1,
    macroTickCount: typeof raw['macroTickCount'] === 'number' ? raw['macroTickCount'] : 0,
    currentDistrictId: raw['currentDistrictId'] ?? 'district_spitalfields_soot_works',
    contracts: Array.isArray(raw['contracts']) ? raw['contracts'] : [],
    safehouses: typeof raw['safehouses'] === 'object' && raw['safehouses'] !== null ? raw['safehouses'] : {},
    codex: typeof raw['codex'] === 'object' && raw['codex'] !== null ? raw['codex'] : {},
    turf: typeof raw['turf'] === 'object' && raw['turf'] !== null ? raw['turf'] : {},
    convoys: typeof raw['convoys'] === 'object' && raw['convoys'] !== null ? raw['convoys'] : {},
    audits: typeof raw['audits'] === 'object' && raw['audits'] !== null ? raw['audits'] : {},
    savedDistricts:
      typeof raw['savedDistricts'] === 'object' && raw['savedDistricts'] !== null ? raw['savedDistricts'] : {},
    eventLog: Array.isArray(raw['eventLog']) ? raw['eventLog'] : [],
  };
}

export const MIGRATION_PIPELINE: readonly MigrationStep[] = [
  { fromVersion: 0, toVersion: 1, transform: migrateV0ToV1 },
];

/**
 * Validates, migrates, and parses raw save-state payloads into the latest WorldState.
 * Supports legacy forward migration and guards against corrupt or future incompatible saves.
 */
export function migrateWorldState(raw: unknown): WorldState {
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new WorldMigrationError(
      'CORRUPTED_SAVE_PAYLOAD',
      'Save state payload must be a non-null JSON object.',
    );
  }

  const record = { ...(raw as Record<string, unknown>) };
  const rawVersion = record['version'];
  const version = typeof rawVersion === 'number' ? rawVersion : 0;

  if (
    rawVersion !== undefined &&
    (typeof rawVersion !== 'number' || !Number.isInteger(rawVersion) || rawVersion < 0)
  ) {
    throw new WorldMigrationError(
      'CORRUPTED_SAVE_PAYLOAD',
      `Invalid save state version: ${String(rawVersion)}`,
    );
  }

  if (version > CURRENT_WORLD_VERSION) {
    throw new WorldMigrationError(
      'UNSUPPORTED_FUTURE_VERSION',
      `Save state version ${version} is newer than supported version ${CURRENT_WORLD_VERSION}. Please update the client.`,
    );
  }

  let current = record;
  let currentVersion = version;

  for (const step of MIGRATION_PIPELINE) {
    if (currentVersion === step.fromVersion && currentVersion < CURRENT_WORLD_VERSION) {
      try {
        current = step.transform(current);
        currentVersion = step.toVersion;
      } catch (err) {
        throw new WorldMigrationError(
          'MIGRATION_FAILED',
          `Failed migrating save state from v${step.fromVersion} to v${step.toVersion}: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }
  }

  const parsed = WorldStateSchema.safeParse(current);
  if (!parsed.success) {
    throw new WorldMigrationError(
      'CORRUPTED_SAVE_PAYLOAD',
      `Save state schema validation failed: ${parsed.error.message}`,
    );
  }

  return parsed.data;
}
