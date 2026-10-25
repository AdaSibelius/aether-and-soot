import { deserializeWorld, serializeWorld, WorldState } from '../../sim/core/world.js';

const LOCAL_STORAGE_KEY = 'aether_soot_save';

export interface SystemMenuDeps {
  readonly getState: () => WorldState;
  readonly loadWorld: (world: WorldState) => void;
  readonly newSeed: (seed: number) => void;
  readonly close: () => void;
  readonly openCreator: () => void;
  readonly toggleCrt: () => void;
  readonly toggleUi: () => void;
  readonly refresh: () => void;
}

export interface SystemMenuController {
  reset(): void;
  seedText(): string;
  status(): string;
  handleAction(action: string): boolean;
  handleKey(key: string): boolean;
}

const errText = (err: unknown): string => (err instanceof Error ? err.message : String(err));

/** Client-side behaviour of the canvas system menu (save/load/export/import/seed/settings). */
export function createSystemMenuController(deps: SystemMenuDeps): SystemMenuController {
  let seedInput: string | null = null;
  let statusMsg = '';

  const say = (msg: string): void => { statusMsg = msg; deps.refresh(); };
  const finish = (): void => { seedInput = null; deps.close(); deps.refresh(); };
  const seedText = (): string => seedInput ?? String(deps.getState().seed);

  const adopt = (loaded: WorldState, verb: string): void => {
    deps.loadWorld(loaded);
    statusMsg = `${verb} world (Turn ${loaded.turnCount}, Seed ${loaded.seed}).`;
    finish();
  };

  const save = (): void => {
    try {
      const s = deps.getState();
      localStorage.setItem(LOCAL_STORAGE_KEY, serializeWorld(s));
      say(`Saved world state (Turn ${s.turnCount}) to LocalStorage.`);
    } catch (err: unknown) { say(`Save failed: ${errText(err)}`); }
  };

  const load = (): void => {
    try {
      const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (!raw) { say('No save file found in LocalStorage slot.'); return; }
      adopt(deserializeWorld(raw), 'Restored');
    } catch (err: unknown) { say(`Load failed: ${errText(err)}`); }
  };

  const exportJson = (): void => {
    try {
      const s = deps.getState();
      const url = URL.createObjectURL(new Blob([serializeWorld(s)], { type: 'application/json' }));
      const a = document.createElement('a');
      a.href = url;
      a.download = `aether_soot_t${s.turnCount}_s${s.seed}.json`;
      a.click();
      URL.revokeObjectURL(url);
      say('Exported JSON save file.');
    } catch (err: unknown) { say(`Export failed: ${errText(err)}`); }
  };

  const importJson = (): void => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = () => {
      const file = input.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        try { adopt(deserializeWorld(String(reader.result)), 'Imported'); }
        catch (err: unknown) { say(`Import failed: ${errText(err)}`); }
      };
      reader.readAsText(file);
    };
    input.click();
  };

  const generate = (seed: number): void => { deps.newSeed(seed); statusMsg = `Generated district from seed ${seed}.`; finish(); };

  const handleAction = (action: string): boolean => {
    switch (action) {
      case 'create': statusMsg = ''; finish(); deps.openCreator(); deps.refresh(); return true;
      case 'crt': deps.toggleCrt(); deps.refresh(); return true;
      case 'ui': deps.toggleUi(); deps.refresh(); return true;
      case 'generate': {
        const val = parseInt(seedText(), 10);
        if (Number.isNaN(val)) { say('Enter a numeric seed first.'); return true; }
        generate(val);
        return true;
      }
      case 'roll': generate(Math.floor(Math.random() * 0x7fffffff)); return true;
      case 'save': save(); return true;
      case 'load': load(); return true;
      case 'export': exportJson(); return true;
      case 'import': importJson(); return true;
      case 'resume': finish(); return true;
      default: return false;
    }
  };

  const KEY_ACTIONS: Readonly<Record<string, string>> = {
    n: 'create', c: 'crt', u: 'ui', r: 'roll', s: 'save', l: 'load', e: 'export', i: 'import', Enter: 'generate',
  };

  const handleKey = (key: string): boolean => {
    if (/^[0-9]$/.test(key)) {
      const cur = seedText() === String(deps.getState().seed) && seedInput === null ? '' : seedText();
      seedInput = (cur + key).slice(0, 10);
      deps.refresh();
      return true;
    }
    if (key === 'Backspace') { seedInput = seedText().slice(0, -1); deps.refresh(); return true; }
    const action = KEY_ACTIONS[key.length === 1 ? key.toLowerCase() : key];
    return action ? handleAction(action) : false;
  };

  return {
    reset: () => { seedInput = null; statusMsg = ''; },
    seedText,
    status: () => statusMsg,
    handleAction,
    handleKey,
  };
}
