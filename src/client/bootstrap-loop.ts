import { GameCommand } from '../schemas/commands.schema.js';
import { CharacterCreationConfig } from '../schemas/character.schema.js';
import { EntityId, EntityIdSchema } from '../schemas/primitives.schema.js';
import { dispatchCommand } from '../sim/core/engine.js';
import { createInitialWorld, serializeWorld, WorldState } from '../sim/core/world.js';
import { generateVictorianDistrict } from '../sim/spatial/generator.js';
import { spawnDistrictNpcs } from '../sim/systems/ai.system.js';
import { spawnDistrictItems } from '../sim/systems/item-spawner.js';
import { applyCharacterCreation } from '../sim/systems/character-archetypes.js';
import { projectWorldToVisualFrame } from './projection/frame-adapter.js';
import { GlyphStageRenderer, WIDESCREEN_GRID_HEIGHT, WIDESCREEN_GRID_WIDTH } from './renderer/glyph-stage.js';
import { renderClientPresentationViews } from './ui/ClientPresentationView.js';
import { getSoundscapeManager } from './audio/soundscape-manager.js';
import {
  clampLookCursor,
  cycleModalWindow,
  findAdjacentDialogueNpc,
  findAdjacentDoorTarget,
  resolveInspectedTileCoord,
  resolveLookInteractCommand,
} from './client-interactions.js';
import { deriveFloatingCombatText } from './renderer/floating-combat-text.js';
import { getDefaultSaveStorageAdapter } from './persistence/save-adapter.js';
import { applyViewportScale, computeAspectLockedScale, DesktopWindowManager } from './renderer/desktop-window-manager.js';
import { composeDiegeticUiBuffer } from './canvas-ui/diegetic-screen-composer.js';
import { resolveThermodynamicStress } from './renderer/shader-uniforms.js';
import { resolveModalRouterOptions } from './input/modal-nav-router.js';
import { createSystemMenuController } from './input/system-menu-controller.js';
import {
  createInitialSessionState,
  pruneActiveCallouts,
  setSessionModal,
  toggleSessionLookMode,
} from './client-session-state.js';
import { bindSessionEventListeners } from './session-event-bindings.js';

export interface ClientSessionMounts {
  readonly canvasHost: HTMLElement;
  readonly overlayHost: HTMLElement;
  readonly hudHost: HTMLElement;
  readonly actionBarHost: HTMLElement | null;
  readonly topBarHost: HTMLElement | null;
}

export function createFreshWorld(seed: number): WorldState {
  return spawnDistrictNpcs(spawnDistrictItems(generateVictorianDistrict(createInitialWorld({ seed })).state).state).state;
}

export function startClientSession(mounts: ClientSessionMounts, stageRenderer: GlyphStageRenderer, initialSeed = 0xcafebabe): void {
  const { canvasHost, overlayHost, hudHost, actionBarHost, topBarHost } = mounts;
  const playerId = EntityIdSchema.parse('actor_player');
  let worldState = createFreshWorld(initialSeed);
  const session = createInitialSessionState(initialSeed);

  const soundscape = getSoundscapeManager();
  const saveAdapter = getDefaultSaveStorageAdapter();
  const scaleTargets = { canvasHost, overlayHost, appCanvas: stageRenderer.getCanvas() };
  const windowManager = new DesktopWindowManager({
    onSuspend: () => soundscape.suspend(),
    onResume: () => soundscape.resume(),
    onResize: (m) => applyViewportScale(scaleTargets, m),
  });
  if (typeof window !== 'undefined') {
    applyViewportScale(scaleTargets, computeAspectLockedScale({ windowWidth: window.innerWidth, windowHeight: window.innerHeight }));
  }

  const handleCommand = (cmd: GameCommand): void => {
    soundscape.initOnUserGesture();
    const outcome = dispatchCommand(worldState, cmd);
    worldState = outcome.state;
    soundscape.processSimEvents(outcome.events);
    const newCallouts = deriveFloatingCombatText(outcome.events, worldState);
    if (newCallouts.length > 0) session.floatingCallouts = [...session.floatingCallouts, ...newCallouts];
    syncPresentation();
  };

  const handleEmbark = (cfg: CharacterCreationConfig, s: number): void => {
    worldState = applyCharacterCreation(createFreshWorld(s), cfg);
    syncPresentation();
  };

  const handleTalk = (targetId?: EntityId): void => {
    if (targetId) { session.activeDialogueNpcId = targetId; syncPresentation(); return; }
    const adjId = findAdjacentDialogueNpc(worldState, playerId);
    if (adjId) { session.activeDialogueNpcId = adjId; syncPresentation(); }
  };

  const closeDialogue = (): void => { session.activeDialogueNpcId = null; syncPresentation(false); };

  const sysMenu = createSystemMenuController({
    getState: () => worldState,
    loadWorld: (w) => { worldState = w; },
    newSeed: (s) => { worldState = createFreshWorld(s); },
    close: () => { session.isSystemMenuOpen = false; },
    openCreator: () => { session.isCreatorOpen = true; },
    toggleCrt: () => { session.isCrtScanlinesEnabled = !session.isCrtScanlinesEnabled; stageRenderer.setCrtScanlinesEnabled(session.isCrtScanlinesEnabled); },
    toggleUi: () => { session.useDiegeticCanvasUi = !session.useDiegeticCanvasUi; },
    refresh: () => syncPresentation(),
  });

  const cycleModal = (direction: 1 | -1): void => {
    if (!session.activeModal) return;
    session.activeModal = cycleModalWindow(session.activeModal, direction);
    syncPresentation();
  };

  const toggleLookMode = (): void => {
    toggleSessionLookMode(session, worldState.entities[playerId]?.position);
    syncPresentation();
  };

  const moveLookCursor = (dx: number, dy: number): void => {
    if (!session.lookCursor) return;
    const p = worldState.entities[playerId]?.position;
    const grid = p ? worldState.strata[p.stratum] : undefined;
    session.lookCursor = clampLookCursor(session.lookCursor, dx, dy, grid?.width ?? 48, grid?.height ?? 36);
    syncPresentation();
  };

  const toggleAdjacentDoor = (): void => {
    if (session.isLookModeActive) {
      const cmd = resolveLookInteractCommand(worldState, playerId, session.lookCursor);
      if (cmd) handleCommand(cmd);
      return;
    }
    const match = findAdjacentDoorTarget(worldState, playerId);
    if (match) handleCommand({ type: 'TOGGLE_DOOR', actorId: playerId, target: match });
  };

  const syncPresentation = (advanceTime = true): void => {
    session.floatingCallouts = pruneActiveCallouts(session.floatingCallouts, Date.now());

    const visualFrame = projectWorldToVisualFrame(worldState, playerId, undefined, { width: WIDESCREEN_GRID_WIDTH, height: WIDESCREEN_GRID_HEIGHT, tacticalWidth: session.useDiegeticCanvasUi ? WIDESCREEN_GRID_WIDTH - 30 : WIDESCREEN_GRID_WIDTH });
    const inspectedTile = resolveInspectedTileCoord(session.isLookModeActive, session.lookCursor, session.mouseHoverCoord);
    const thermo = resolveThermodynamicStress(worldState, playerId);
    const modalOptions = resolveModalRouterOptions(session.activeModal, session.modalNavState, worldState, playerId);
    const uiBuffer = composeDiegeticUiBuffer({
      ...session,
      worldState, playerId, width: WIDESCREEN_GRID_WIDTH, height: WIDESCREEN_GRID_HEIGHT,
      inspectedTile, modalOptions,
      systemMenu: session.isSystemMenuOpen
        ? { seedInput: sysMenu.seedText(), statusMsg: sysMenu.status(), crtEnabled: session.isCrtScanlinesEnabled, diegeticUi: session.useDiegeticCanvasUi }
        : undefined,
    });

    stageRenderer.renderFrame(visualFrame, uiBuffer, (session.activeModal || session.isCreatorOpen || session.isSystemMenuOpen) ? 0 : thermo.stressValue, 16.67, advanceTime);

    renderClientPresentationViews({ topBarHost, overlayHost, actionBarHost, hudHost }, {
      ...session,
      worldState, playerId,
      cameraOrigin: visualFrame.cameraOrigin,
      floatingItems: session.floatingCallouts,
      onToggleUiMode: () => { session.useDiegeticCanvasUi = !session.useDiegeticCanvasUi; syncPresentation(); },
      onCommand: handleCommand,
      onOpenModal: (w) => { setSessionModal(session, w); syncPresentation(); },
      onCloseModal: () => { setSessionModal(session, null); syncPresentation(); },
      onOpenSystemMenu: () => { session.isSystemMenuOpen = true; syncPresentation(); },
      onCloseSystemMenu: () => { session.isSystemMenuOpen = false; syncPresentation(); },
      onToggleLookMode: toggleLookMode, onToggleDoor: toggleAdjacentDoor, onTalk: handleTalk, onCloseDialogue: closeDialogue,
      onNewSeed: (s) => { worldState = createFreshWorld(s); syncPresentation(); },
      onLoadWorld: (loaded) => { worldState = loaded; syncPresentation(); },
      onOpenCharacterCreator: () => { session.isCreatorOpen = true; syncPresentation(); },
      onCloseCharacterCreator: () => { session.isCreatorOpen = false; syncPresentation(); },
      onEmbark: handleEmbark,
      onToggleCrtScanlines: () => {
        session.isCrtScanlinesEnabled = !session.isCrtScanlinesEnabled;
        stageRenderer.setCrtScanlinesEnabled(session.isCrtScanlinesEnabled);
        syncPresentation();
      },
    });

    if (session.floatingCallouts.length > 0 && typeof requestAnimationFrame !== 'undefined') {
      requestAnimationFrame(() => syncPresentation(false));
    }
  };

  bindSessionEventListeners({
    canvasHost, stageRenderer, session, sysMenu,
    getWorldState: () => worldState, playerId,
    handleCommand, handleEmbark, syncPresentation,
    cycleModal, toggleLookMode, moveLookCursor, toggleAdjacentDoor, handleTalk, closeDialogue,
  });

  window.__DEBUG_SIM__ = {
    getState: () => worldState, dispatch: handleCommand,
    getVisualFrame: () => projectWorldToVisualFrame(worldState, playerId),
    serialize: () => serializeWorld(worldState), soundscape, saveAdapter, windowManager,
  };

  syncPresentation();
}
