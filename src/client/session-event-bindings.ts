import { GameCommand } from '../schemas/commands.schema.js';
import { CharacterCreationConfig } from '../schemas/character.schema.js';
import { EntityId } from '../schemas/primitives.schema.js';
import { WorldState } from '../sim/core/world.js';
import { handleGameKeydown } from './input/keyboard-router.js';
import { resolveTileFromMouse } from './input/mouse-router.js';
import { GlyphStageRenderer } from './renderer/glyph-stage.js';
import { handleDiegeticHitAction } from './canvas-ui/diegetic-screen-composer.js';
import { SystemMenuController } from './input/system-menu-controller.js';
import { ClientSessionState, setSessionModal, updateSessionHover } from './client-session-state.js';
import { resolveLookAttackCommand, resolveLookInteractCommand } from './client-interactions.js';

export interface SessionEventBindingDeps {
  readonly canvasHost: HTMLElement;
  readonly stageRenderer: GlyphStageRenderer;
  readonly session: ClientSessionState;
  readonly sysMenu: SystemMenuController;
  readonly getWorldState: () => WorldState;
  readonly playerId: EntityId;
  readonly handleCommand: (cmd: GameCommand) => void;
  readonly handleEmbark: (cfg: CharacterCreationConfig, seed: number) => void;
  readonly syncPresentation: (advanceTime?: boolean) => void;
  readonly cycleModal: (direction: 1 | -1) => void;
  readonly toggleLookMode: () => void;
  readonly moveLookCursor: (dx: number, dy: number) => void;
  readonly toggleAdjacentDoor: () => void;
  readonly handleTalk: (targetId?: EntityId) => void;
  readonly closeDialogue: () => void;
}

export function bindSessionEventListeners(deps: SessionEventBindingDeps): void {
  const {
    canvasHost, stageRenderer, session, sysMenu, getWorldState, playerId,
    handleCommand, handleEmbark, syncPresentation, cycleModal,
    toggleLookMode, moveLookCursor, toggleAdjacentDoor, handleTalk, closeDialogue,
  } = deps;

  const updateTileFromMouse = (ev: MouseEvent): void => {
    const coord = resolveTileFromMouse(ev, canvasHost, getWorldState(), playerId);
    if (updateSessionHover(session, coord)) syncPresentation(false);
  };

  canvasHost.addEventListener('mousemove', updateTileFromMouse);
  canvasHost.addEventListener('click', (ev: MouseEvent) => {
    updateTileFromMouse(ev);
    if (!session.useDiegeticCanvasUi) return;
    const hit = stageRenderer.resolveHitActionAt(ev.clientX, ev.clientY, canvasHost.getBoundingClientRect());
    if (!hit) return;
    const ws = getWorldState();
    handleDiegeticHitAction(hit, {
      onSelectProfession: (prof) => { session.embarkConfig = { ...session.embarkConfig, professionId: prof }; syncPresentation(); },
      onToggleTrait: (t) => {
        const has = session.embarkConfig.traitIds.includes(t);
        const traitIds = has ? session.embarkConfig.traitIds.filter((x) => x !== t) : session.embarkConfig.traitIds.length < 2 ? [...session.embarkConfig.traitIds, t] : session.embarkConfig.traitIds;
        session.embarkConfig = { ...session.embarkConfig, traitIds };
        syncPresentation();
      },
      onSelectScenario: (scen) => { session.embarkConfig = { ...session.embarkConfig, scenarioId: scen }; syncPresentation(); },
      onEmbark: () => { session.isCreatorOpen = false; handleEmbark(session.embarkConfig, ws.seed); },
      onOpenModal: (w) => { setSessionModal(session, w); syncPresentation(); },
      onOpenSystemMenu: () => { session.isSystemMenuOpen = true; syncPresentation(); },
      onDispatchCommand: handleCommand,
      modalNavState: session.modalNavState,
      onSystemMenuAction: sysMenu.handleAction,
      onNavigate: () => syncPresentation(false),
    }, ws, playerId);
  });

  window.addEventListener('keydown', (ev: KeyboardEvent) => {
    const ws = getWorldState();
    handleGameKeydown(ev, {
      ...session,
      playerId, worldState: ws,
      onNavigate: () => syncPresentation(false),
      onCreatorKey: (key) => {
        if (key === 'Enter') { session.isCreatorOpen = false; handleEmbark(session.embarkConfig, ws.seed); return true; }
        const profs = ['DISGRACED_CHIRURGEON', 'FOUNDRY_ARTIFICER', 'CLOCKWORK_VETERAN', 'AETHER_SMUGGLER'] as const;
        const pIdx = Number.parseInt(key, 10) - 1;
        if (pIdx >= 0 && pIdx < profs.length) { session.embarkConfig = { ...session.embarkConfig, professionId: profs[pIdx]! }; syncPresentation(false); return true; }
        return false;
      },
      onSystemMenuKey: sysMenu.handleKey,
      onToggleSystemMenu: () => { sysMenu.reset(); session.isSystemMenuOpen = !session.isSystemMenuOpen; syncPresentation(); },
      onCloseModal: () => { setSessionModal(session, null); syncPresentation(); },
      onCycleModal: cycleModal,
      onSetModal: (modal) => { setSessionModal(session, modal); syncPresentation(); },
      onToggleLookMode: toggleLookMode, onMoveLookCursor: moveLookCursor,
      onLookAttack: (slot) => {
        const cmd = resolveLookAttackCommand(ws, playerId, session.lookCursor, slot);
        if (cmd) handleCommand(cmd);
      },
      onLookInteract: () => {
        const cmd = resolveLookInteractCommand(ws, playerId, session.lookCursor);
        if (cmd) handleCommand(cmd);
      },
      onToggleDoor: toggleAdjacentDoor, onTalk: handleTalk, onCloseDialogue: closeDialogue,
      isDialogueOpen: session.activeDialogueNpcId !== null,
      onOpenCharacterCreator: () => { session.isCreatorOpen = true; syncPresentation(); },
      onCloseCharacterCreator: () => { session.isCreatorOpen = false; syncPresentation(); },
      currentPosture: ws.entities[playerId]?.actor?.posture ?? 'STANDING',
      onCommand: handleCommand,
    });
  });
}
