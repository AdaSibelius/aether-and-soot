import { afterEach, describe, expect, it, vi } from 'vitest';
import { createUiCellBuffer } from '../../src/client/canvas-ui/cell-buffer.js';
import { composeDiegeticUiBuffer, handleDiegeticHitAction } from '../../src/client/canvas-ui/diegetic-screen-composer.js';
import { renderSystemMenuScreen, SYSTEM_MENU_RECT } from '../../src/client/canvas-ui/system-menu-screen.js';
import { handleGameKeydown } from '../../src/client/input/keyboard-router.js';
import { createSystemMenuController, SystemMenuDeps } from '../../src/client/input/system-menu-controller.js';
import { EntityIdSchema } from '../../src/schemas/primitives.schema.js';
import { createInitialWorld, WorldState } from '../../src/sim/core/world.js';

const playerId = EntityIdSchema.parse('actor_player');

function makeHarness(world: WorldState) {
  const log: string[] = [];
  let current = world;
  const deps: SystemMenuDeps = {
    getState: () => current,
    loadWorld: (w) => { current = w; log.push('load'); },
    newSeed: (s) => { log.push(`seed:${s}`); },
    close: () => { log.push('close'); },
    openCreator: () => { log.push('creator'); },
    toggleCrt: () => { log.push('crt'); },
    toggleUi: () => { log.push('ui'); },
    refresh: () => {},
  };
  return { log, ctl: createSystemMenuController(deps), get world() { return current; } };
}

describe('Canvas-native system menu', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('renders title, all actions as sys: hit targets, and status text', () => {
    const buf = createUiCellBuffer(88, 36);
    renderSystemMenuScreen(buf, { seedInput: '42', statusMsg: 'Saved.', crtEnabled: true, diegeticUi: true });
    const text = Array.from({ length: 36 }, (_, r) => buf.extractRowString(r)).join('\n');
    expect(text).toContain('CHRONOS & ENGINE ARCHIVE');
    expect(text).toContain('Seed: [42_]');
    expect(text).toContain('Saved.');
    const hits = new Set<string>();
    for (let r = SYSTEM_MENU_RECT.y; r < SYSTEM_MENU_RECT.y + SYSTEM_MENU_RECT.height; r++) {
      for (let c = SYSTEM_MENU_RECT.x; c < SYSTEM_MENU_RECT.x + SYSTEM_MENU_RECT.width; c++) {
        const h = buf.resolveHitActionAt(c, r);
        if (h) hits.add(h);
      }
    }
    for (const a of ['create', 'crt', 'ui', 'generate', 'roll', 'save', 'load', 'export', 'import', 'resume']) {
      expect(hits.has(`sys:${a}`)).toBe(true);
    }
  });

  it('is composed instead of the console when systemMenu view is supplied', () => {
    const buf = composeDiegeticUiBuffer({
      isCreatorOpen: false,
      embarkConfig: { professionId: 'DISGRACED_CHIRURGEON', traitIds: [], scenarioId: 'SPITALFIELDS_FOUNDRY_ROW' },
      activeModal: null, useDiegeticCanvasUi: true, worldState: createInitialWorld({ seed: 1 }), playerId,
      width: 88, height: 36, inspectedTile: null, isLookModeActive: false,
      systemMenu: { seedInput: '1', statusMsg: '', crtEnabled: false, diegeticUi: true },
    });
    const text = Array.from({ length: 36 }, (_, r) => buf!.extractRowString(r)).join('\n');
    expect(text).toContain('CHRONOS & ENGINE ARCHIVE');
    expect(text).toContain('OFF');
  });

  it('edits the seed with digits/Backspace and generates on Enter', () => {
    const h = makeHarness(createInitialWorld({ seed: 7 }));
    expect(h.ctl.seedText()).toBe('7');
    h.ctl.handleKey('1'); h.ctl.handleKey('2'); h.ctl.handleKey('3');
    expect(h.ctl.seedText()).toBe('123');
    h.ctl.handleKey('Backspace');
    expect(h.ctl.seedText()).toBe('12');
    expect(h.ctl.handleKey('Enter')).toBe(true);
    expect(h.log).toEqual(['seed:12', 'close']);
  });

  it('routes hotkeys and clicks to creator, settings and resume', () => {
    const h = makeHarness(createInitialWorld({ seed: 7 }));
    expect(h.ctl.handleKey('n')).toBe(true);
    expect(h.ctl.handleKey('C')).toBe(true);
    expect(h.ctl.handleAction('resume')).toBe(true);
    expect(h.ctl.handleKey('z')).toBe(false);
    expect(h.log).toEqual(['close', 'creator', 'crt', 'close']);
  });

  it('saves and restores world state through LocalStorage', () => {
    const store = new Map<string, string>();
    vi.stubGlobal('localStorage', {
      setItem: (k: string, v: string) => { store.set(k, v); },
      getItem: (k: string) => store.get(k) ?? null,
    });
    const h = makeHarness({ ...createInitialWorld({ seed: 9 }), turnCount: 5 });
    h.ctl.handleKey('s');
    expect(h.ctl.status()).toContain('Turn 5');
    h.ctl.handleKey('l');
    expect(h.log).toContain('load');
    expect(h.world.turnCount).toBe(5);
    expect(h.ctl.status()).toContain('Restored');
  });

  it('keyboard router forwards keys to the menu and ignores gameplay input', () => {
    const keys: string[] = [];
    const cmds: unknown[] = [];
    handleGameKeydown({ key: 's', metaKey: false, ctrlKey: false, preventDefault: () => {} } as unknown as KeyboardEvent, {
      playerId, isSystemMenuOpen: true, activeModal: null, isLookModeActive: false,
      onSystemMenuKey: (k) => { keys.push(k); return true; },
      onToggleSystemMenu: () => {}, onCloseModal: () => {}, onCycleModal: () => {}, onSetModal: () => {},
      onToggleLookMode: () => {}, onMoveLookCursor: () => {}, onLookAttack: () => {}, onLookInteract: () => {},
      onCommand: (c) => { cmds.push(c); },
    });
    expect(keys).toEqual(['s']);
    expect(cmds.length).toBe(0);
  });

  it('dispatches sys: hit actions through handleDiegeticHitAction', () => {
    const seen: string[] = [];
    const ok = handleDiegeticHitAction('sys:save', {
      onSelectProfession: () => {}, onToggleTrait: () => {}, onSelectScenario: () => {}, onEmbark: () => {},
      onOpenModal: () => {}, onOpenSystemMenu: () => {}, onDispatchCommand: () => {},
      onSystemMenuAction: (a) => { seen.push(a); return true; },
    }, createInitialWorld({ seed: 1 }), playerId);
    expect(ok).toBe(true);
    expect(seen).toEqual(['save']);
  });
});
