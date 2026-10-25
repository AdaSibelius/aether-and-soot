import { describe, expect, it } from 'vitest';
import { composeDiegeticUiBuffer, handleDiegeticHitAction } from '../../src/client/canvas-ui/diegetic-screen-composer.js';
import { handleGameKeydown } from '../../src/client/input/keyboard-router.js';
import {
  ANATOMY_SLOTS,
  ATLAS_STRATA,
  handleModalNavigationKey,
  ModalNavState,
  resolveModalRouterOptions,
} from '../../src/client/input/modal-nav-router.js';
import { GameCommand } from '../../src/schemas/commands.schema.js';
import { EntityIdSchema } from '../../src/schemas/primitives.schema.js';
import { createInitialWorld } from '../../src/sim/core/world.js';
import { generateVictorianDistrict } from '../../src/sim/spatial/generator.js';
import { spawnDistrictItems } from '../../src/sim/systems/item-spawner.js';

function makeKeyEvent(key: string): KeyboardEvent {
  return {
    key,
    shiftKey: false,
    preventDefault: () => {},
  } as unknown as KeyboardEvent;
}

describe('Diegetic Modal Navigation & Command Responsiveness', () => {
  const playerId = EntityIdSchema.parse('actor_player');

  it('propagates modalOptions into composeDiegeticUiBuffer and highlights selected Anatomy slot', () => {
    const state = generateVictorianDistrict(createInitialWorld({ seed: 42 })).state;
    const navState: ModalNavState = { selectedIndex: 4 }; // LEFT_ARM
    const modalOptions = resolveModalRouterOptions('ANATOMY', navState, state, playerId);
    expect(modalOptions.selectedLimbSlot).toBe('LEFT_ARM');

    const buf = composeDiegeticUiBuffer({
      isCreatorOpen: false,
      embarkConfig: {
        professionId: 'DISGRACED_CHIRURGEON',
        traitIds: ['NIGHT_OPTICS'],
        scenarioId: 'SPITALFIELDS_FOUNDRY_ROW',
      },
      activeModal: 'ANATOMY',
      useDiegeticCanvasUi: true,
      worldState: state,
      playerId,
      width: 88,
      height: 36,
      inspectedTile: null,
      isLookModeActive: false,
      modalOptions,
    });

    expect(buf).toBeDefined();
    let foundSelectedLeftArm = false;
    for (let r = 0; r < 36; r++) {
      if (buf!.extractRowString(r).includes('► LEFT_ARM')) {
        foundSelectedLeftArm = true;
        break;
      }
    }
    expect(foundSelectedLeftArm).toBe(true);
  });

  it('navigates across all 6 modal windows and invokes onNavigate callback', () => {
    const state = spawnDistrictItems(generateVictorianDistrict(createInitialWorld({ seed: 42 })).state).state;
    const commands: GameCommand[] = [];
    let navigateCount = 0;
    const onNavigate = () => {
      navigateCount += 1;
    };

    // 1. ANATOMY navigation
    const anatomyNav: ModalNavState = { selectedIndex: 0 };
    expect(
      handleModalNavigationKey(makeKeyEvent('ArrowDown'), 'ANATOMY', state, playerId, anatomyNav, (c) => commands.push(c), onNavigate),
    ).toBe(true);
    expect(anatomyNav.selectedIndex).toBe(1);
    expect(ANATOMY_SLOTS[anatomyNav.selectedIndex]).toBe('OCULAR_MOUNT');
    expect(navigateCount).toBe(1);

    // 2. WORKBENCH navigation & Enter craft dispatch
    const benchNav: ModalNavState = { selectedIndex: 0 };
    expect(
      handleModalNavigationKey(makeKeyEvent('ArrowDown'), 'WORKBENCH', state, playerId, benchNav, (c) => commands.push(c), onNavigate),
    ).toBe(true);
    expect(benchNav.selectedIndex).toBe(1);
    expect(
      handleModalNavigationKey(makeKeyEvent('Enter'), 'WORKBENCH', state, playerId, benchNav, (c) => commands.push(c), onNavigate),
    ).toBe(true);
    expect(commands.some((c) => c.type === 'CRAFT_RECIPE')).toBe(true);

    // 3. ATLAS stratum cycling
    const atlasNav: ModalNavState = { selectedIndex: 2 };
    expect(
      handleModalNavigationKey(makeKeyEvent('ArrowUp'), 'ATLAS', state, playerId, atlasNav, (c) => commands.push(c), onNavigate),
    ).toBe(true);
    expect(ATLAS_STRATA[atlasNav.selectedIndex]).toBe('UNDERCROFT');

    // 4. EXCHANGE sector cycling
    const exchangeNav: ModalNavState = { selectedIndex: 0 };
    expect(
      handleModalNavigationKey(makeKeyEvent('ArrowRight'), 'EXCHANGE', state, playerId, exchangeNav, (c) => commands.push(c), onNavigate),
    ).toBe(true);
    expect(exchangeNav.selectedIndex).toBe(1);

    // 5. CODEX entry & tab cycling
    const codexNav: ModalNavState = { selectedIndex: 0 };
    expect(
      handleModalNavigationKey(makeKeyEvent('ArrowDown'), 'CODEX', state, playerId, codexNav, (c) => commands.push(c), onNavigate),
    ).toBe(true);
    expect(codexNav.selectedIndex).toBe(1);
    expect(
      handleModalNavigationKey(makeKeyEvent('ArrowRight'), 'CODEX', state, playerId, codexNav, (c) => commands.push(c), onNavigate),
    ).toBe(true);
    expect(codexNav.selectedCodexCategory).toBe('AUTOMATON');
  });

  it('allows WASD navigation inside modals without closing or switching modals', () => {
    const state = generateVictorianDistrict(createInitialWorld({ seed: 42 })).state;
    const navState: ModalNavState = { selectedIndex: 1 };
    let modalChanged: string | null = 'ANATOMY';
    let navSynced = false;

    handleGameKeydown(makeKeyEvent('w'), {
      playerId,
      isSystemMenuOpen: false,
      activeModal: 'ANATOMY',
      isLookModeActive: false,
      worldState: state,
      modalNavState: navState,
      onNavigate: () => {
        navSynced = true;
      },
      onToggleSystemMenu: () => {},
      onCloseModal: () => {
        modalChanged = null;
      },
      onCycleModal: () => {},
      onSetModal: (m) => {
        modalChanged = m;
      },
      onToggleLookMode: () => {},
      onMoveLookCursor: () => {},
      onLookAttack: () => {},
      onLookInteract: () => {},
      onCommand: () => {},
    });

    expect(modalChanged).toBe('ANATOMY');
    expect(navState.selectedIndex).toBe(0);
    expect(navSynced).toBe(true);
  });

  it('updates selection state on first click and dispatches command on second click in handleDiegeticHitAction', () => {
    const state = createInitialWorld({ seed: 42 });
    const navState: ModalNavState = { selectedIndex: 0 };
    const dispatched: GameCommand[] = [];
    let navigated = false;

    const callbacks = {
      onSelectProfession: () => {},
      onToggleTrait: () => {},
      onSelectScenario: () => {},
      onEmbark: () => {},
      onOpenModal: () => {},
      onOpenSystemMenu: () => {},
      onDispatchCommand: (cmd: GameCommand) => dispatched.push(cmd),
      modalNavState: navState,
      onNavigate: () => {
        navigated = true;
      },
    };

    // First click on item selects it without dispatching USE_ITEM
    handleDiegeticHitAction('select_item:item_tonic_1', callbacks, state, playerId);
    expect(navState.selectedItemId).toBe('item_tonic_1');
    expect(navigated).toBe(true);
    expect(dispatched.length).toBe(0);

    // Second click on already-selected item dispatches USE_ITEM
    handleDiegeticHitAction('select_item:item_tonic_1', callbacks, state, playerId);
    expect(dispatched.length).toBe(1);
    expect(dispatched[0]?.type).toBe('USE_ITEM');
  });
});
