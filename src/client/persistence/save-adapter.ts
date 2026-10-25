import { deserializeWorld, serializeWorld, WorldState } from '../../sim/core/world.js';

export interface SaveMetadata {
  readonly slot: string;
  readonly timestamp: number;
  readonly turnCount: number;
  readonly seed: number;
  readonly districtId: string;
}

export interface SaveStorageAdapter {
  readonly adapterType: 'LOCAL_STORAGE' | 'NATIVE_FILESYSTEM' | 'IN_MEMORY';
  saveWorld(slot: string, world: WorldState): Promise<SaveMetadata>;
  loadWorld(slot: string): Promise<WorldState | null>;
  listSaves(): Promise<readonly SaveMetadata[]>;
  deleteSave(slot: string): Promise<boolean>;
  exportJson(world: WorldState): string;
  importJson(json: string): WorldState;
}

export class InMemorySaveAdapter implements SaveStorageAdapter {
  public readonly adapterType = 'IN_MEMORY';
  private readonly records = new Map<string, { json: string; meta: SaveMetadata }>();

  public async saveWorld(slot: string, world: WorldState): Promise<SaveMetadata> {
    const json = this.exportJson(world);
    const meta: SaveMetadata = {
      slot,
      timestamp: Date.now ? Date.now() : 0,
      turnCount: world.turnCount,
      seed: world.seed,
      districtId: world.currentDistrictId ?? 'district_spitalfields_soot_works',
    };
    this.records.set(slot, { json, meta });
    return meta;
  }

  public async loadWorld(slot: string): Promise<WorldState | null> {
    const record = this.records.get(slot);
    if (!record) return null;
    return this.importJson(record.json);
  }

  public async listSaves(): Promise<readonly SaveMetadata[]> {
    return Array.from(this.records.values()).map((r) => r.meta);
  }

  public async deleteSave(slot: string): Promise<boolean> {
    return this.records.delete(slot);
  }

  public exportJson(world: WorldState): string { return serializeWorld(world); }
  public importJson(json: string): WorldState { return deserializeWorld(json); }
}

const STORAGE_PREFIX = 'aether_soot_save_';
const INDEX_KEY = 'aether_soot_save_index';

export class LocalStorageSaveAdapter implements SaveStorageAdapter {
  public readonly adapterType = 'LOCAL_STORAGE';

  public async saveWorld(slot: string, world: WorldState): Promise<SaveMetadata> {
    const json = this.exportJson(world);
    const meta: SaveMetadata = {
      slot,
      timestamp: (typeof Date !== 'undefined' && Date.now) ? Date.now() : 0,
      turnCount: world.turnCount,
      seed: world.seed,
      districtId: world.currentDistrictId ?? 'district_spitalfields_soot_works',
    };

    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(`${STORAGE_PREFIX}${slot}`, json);
      const index = this.getIndex();
      index[slot] = meta;
      localStorage.setItem(INDEX_KEY, JSON.stringify(index));
    }
    return meta;
  }

  public async loadWorld(slot: string): Promise<WorldState | null> {
    if (typeof localStorage === 'undefined') return null;
    const raw = localStorage.getItem(`${STORAGE_PREFIX}${slot}`);
    if (!raw) return null;
    return this.importJson(raw);
  }

  public async listSaves(): Promise<readonly SaveMetadata[]> {
    if (typeof localStorage === 'undefined') return [];
    const index = this.getIndex();
    return Object.values(index);
  }

  public async deleteSave(slot: string): Promise<boolean> {
    if (typeof localStorage === 'undefined') return false;
    localStorage.removeItem(`${STORAGE_PREFIX}${slot}`);
    const index = this.getIndex();
    delete index[slot];
    localStorage.setItem(INDEX_KEY, JSON.stringify(index));
    return true;
  }

  public exportJson(world: WorldState): string { return serializeWorld(world); }
  public importJson(json: string): WorldState { return deserializeWorld(json); }

  private getIndex(): Record<string, SaveMetadata> {
    try {
      const raw = localStorage.getItem(INDEX_KEY);
      return raw ? (JSON.parse(raw) as Record<string, SaveMetadata>) : {};
    } catch {
      return {};
    }
  }
}

let defaultAdapter: SaveStorageAdapter | null = null;

export function createSaveStorageAdapter(
  preferredType?: 'LOCAL_STORAGE' | 'NATIVE_FILESYSTEM' | 'IN_MEMORY',
): SaveStorageAdapter {
  if (preferredType === 'IN_MEMORY' || typeof localStorage === 'undefined') {
    return new InMemorySaveAdapter();
  }
  return new LocalStorageSaveAdapter();
}

export function getDefaultSaveStorageAdapter(): SaveStorageAdapter {
  if (!defaultAdapter) {
    defaultAdapter = createSaveStorageAdapter();
  }
  return defaultAdapter;
}
