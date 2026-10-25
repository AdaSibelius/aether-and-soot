import { GameCommand } from '../schemas/commands.schema.js';
import { CharacterCreationConfig } from '../schemas/character.schema.js';
import { EntityId, EntityIdSchema } from '../schemas/primitives.schema.js';
import { dispatchCommand } from '../sim/core/engine.js';
import { createInitialWorld, serializeWorld, WorldState } from '../sim/core/world.js';
import { generateVictorianDistrict } from '../sim/spatial/generator.js';
import { spawnDistrictNpcs } from '../sim/systems/ai.system.js';
import { spawnDistrictItems } from '../sim/systems/item-spawner.js';
import { applyCharacterCreation } from '../sim/systems/character-archetypes.js';
import { handleGameKeydown } from './input/keyboard-router.js';
import { resolveTileFromMouse } from './input/mouse-router.js';
import { projectWorldToVisualFrame } from './projection/frame-adapter.js';
import { GlyphStageRenderer, WIDESCREEN_GRID_HEIGHT, WIDESCREEN_GRID_WIDTH } from './renderer/glyph-stage.js';
import { ModalWindowId } from './ui/CharacterModalShell.js';
import { renderClientPresentationViews } from './ui/ClientPresentationView.js';
import { getSoundscapeManager } from './audio/soundscape-manager.js';
import {
  clampLookCursor,
  cycleModalWindow,
  findAdjacentDialogueNpc,
  findAdjacentDoorTarget,
  resolveInspectedTileCoord,
  resolveLookAttackCommand,
  resolveLookInteractCommand,
} from './client-interactions.js';
import { deriveFloatingCombatText, FloatingTextCallout } from './renderer/floating-combat-text.js';
import { getDefaultSaveStorageAdapter } from './persistence/save-adapter.js';
import { applyViewportScale, computeAspectLockedScale, DesktopWindowManager } from './renderer/desktop-window-manager.js';
import { composeDiegeticUiBuffer, handleDiegeticHitAction } from './canvas-ui/diegetic-screen-composer.js';
import { resolveThermodynamicStress } from './renderer/shader-uniforms.js';
import { ModalNavState, resolveModalRouterOptions } from './input/modal-nav-router.js';
import { createSystemMenuController } from './input/system-menu-controller.js';

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

  let activeModal: ModalWindowId | null = null;
  let mouseHoverCoord: { x: number; y: number } | null = null;
  let isSystemMenuOpen = false;
  let isLookModeActive = false;
  let isCreatorOpen = false;
  let isCrtScanlinesEnabled = true;
  let lookCursor: { x: number; y: number } | null = null;
  let activeDialogueNpcId: EntityId | null = null;
  let useDiegeticCanvasUi = true;
  let floatingCallouts: FloatingTextCallout[] = [];
  const modalNavState: ModalNavState = { selectedIndex: 0 };
  let embarkConfig: CharacterCreationConfig = {
    professionId: 'DISGRACED_CHIRURGEON',
    traitIds: ['NIGHT_OPTICS', 'BOILER_HEART'],
    scenarioId: 'SPITALFIELDS_FOUNDRY_ROW',
    seed: initialSeed,
  };

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
    if (newCallouts.length > 0) floatingCallouts = [...floatingCallouts, ...newCallouts];
    syncPresentation();
  };

  const handleEmbark = (cfg: CharacterCreationConfig, s: number): void => {
    worldState = applyCharacterCreation(createFreshWorld(s), cfg);
    syncPresentation();
  };

  const handleTalk = (targetId?: EntityId): void => {
    if (targetId) { activeDialogueNpcId = targetId; syncPresentation(); return; }
    const adjId = findAdjacentDialogueNpc(worldState, playerId);
    if (adjId) { activeDialogueNpcId = adjId; syncPresentation(); }
  };

  const closeDialogue = (): void => { activeDialogueNpcId = null; syncPresentation(false); };

  const sysMenu = createSystemMenuController({
    getState: () => worldState,
    loadWorld: (w) => { worldState = w; },
    newSeed: (s) => { worldState = createFreshWorld(s); },
    close: () => { isSystemMenuOpen = false; },
    openCreator: () => { isCreatorOpen = true; },
    toggleCrt: () => { isCrtScanlinesEnabled = !isCrtScanlinesEnabled; stageRenderer.setCrtScanlinesEnabled(isCrtScanlinesEnabled); },
    toggleUi: () => { useDiegeticCanvasUi = !useDiegeticCanvasUi; },
    refresh: () => syncPresentation(),
  });

  const cycleModal = (direction: 1 | -1): void => {
    if (!activeModal) return;
    activeModal = cycleModalWindow(activeModal, direction);
    syncPresentation();
  };

  const toggleLookMode = (): void => {
    isLookModeActive = !isLookModeActive;
    const p = worldState.entities[playerId]?.position;
    lookCursor = isLookModeActive ? (p ? { x: p.x, y: p.y } : { x: 12, y: 10 }) : null;
    syncPresentation();
  };

  const moveLookCursor = (dx: number, dy: number): void => {
    if (!lookCursor) return;
    const p = worldState.entities[playerId]?.position;
    const grid = p ? worldState.strata[p.stratum] : undefined;
    lookCursor = clampLookCursor(lookCursor, dx, dy, grid?.width ?? 48, grid?.height ?? 36);
    syncPresentation();
  };

  const toggleAdjacentDoor = (): void => {
    if (isLookModeActive) {
      const cmd = resolveLookInteractCommand(worldState, playerId, lookCursor);
      if (cmd) handleCommand(cmd);
      return;
    }
    const match = findAdjacentDoorTarget(worldState, playerId);
    if (match) handleCommand({ type: 'TOGGLE_DOOR', actorId: playerId, target: match });
  };

  const syncPresentation = (advanceTime = true): void => {
    const nowMs = Date.now();
    floatingCallouts = floatingCallouts.filter((c) => nowMs - c.createdAtMs <= c.durationMs);

    const visualFrame = projectWorldToVisualFrame(worldState, playerId, undefined, { width: WIDESCREEN_GRID_WIDTH, height: WIDESCREEN_GRID_HEIGHT });
    const inspectedTile = resolveInspectedTileCoord(isLookModeActive, lookCursor, mouseHoverCoord);
    const thermo = resolveThermodynamicStress(worldState, playerId);
    const modalOptions = resolveModalRouterOptions(activeModal, modalNavState, worldState, playerId);
    const uiBuffer = composeDiegeticUiBuffer({
      isCreatorOpen, embarkConfig, activeModal, useDiegeticCanvasUi,
      worldState, playerId, width: WIDESCREEN_GRID_WIDTH, height: WIDESCREEN_GRID_HEIGHT,
      inspectedTile, isLookModeActive, modalOptions,
      systemMenu: isSystemMenuOpen
        ? { seedInput: sysMenu.seedText(), statusMsg: sysMenu.status(), crtEnabled: isCrtScanlinesEnabled, diegeticUi: useDiegeticCanvasUi }
        : undefined,
    });

    stageRenderer.renderFrame(visualFrame, uiBuffer, (activeModal || isCreatorOpen || isSystemMenuOpen) ? 0 : thermo.stressValue, 16.67, advanceTime);

    renderClientPresentationViews({ topBarHost, overlayHost, actionBarHost, hudHost }, {
      worldState, playerId, activeModal, isSystemMenuOpen, isLookModeActive,
      isCreatorOpen, isCrtScanlinesEnabled, lookCursor, mouseHoverCoord,
      cameraOrigin: visualFrame.cameraOrigin, activeDialogueNpcId,
      floatingItems: floatingCallouts, useDiegeticCanvasUi,
      onToggleUiMode: () => { useDiegeticCanvasUi = !useDiegeticCanvasUi; syncPresentation(); },
      onCommand: handleCommand,
      onOpenModal: (w) => { activeModal = w; syncPresentation(); },
      onCloseModal: () => { activeModal = null; syncPresentation(); },
      onOpenSystemMenu: () => { isSystemMenuOpen = true; syncPresentation(); },
      onCloseSystemMenu: () => { isSystemMenuOpen = false; syncPresentation(); },
      onToggleLookMode: toggleLookMode, onToggleDoor: toggleAdjacentDoor, onTalk: handleTalk, onCloseDialogue: closeDialogue,
      onNewSeed: (s) => { worldState = createFreshWorld(s); syncPresentation(); },
      onLoadWorld: (loaded) => { worldState = loaded; syncPresentation(); },
      onOpenCharacterCreator: () => { isCreatorOpen = true; syncPresentation(); },
      onCloseCharacterCreator: () => { isCreatorOpen = false; syncPresentation(); },
      onEmbark: handleEmbark,
      onToggleCrtScanlines: () => {
        isCrtScanlinesEnabled = !isCrtScanlinesEnabled;
        stageRenderer.setCrtScanlinesEnabled(isCrtScanlinesEnabled);
        syncPresentation();
      },
    });

    if (floatingCallouts.length > 0 && typeof requestAnimationFrame !== 'undefined') {
      requestAnimationFrame(() => syncPresentation(false));
    }
  };

  const updateTileFromMouse = (ev: MouseEvent): void => {
    const coord = resolveTileFromMouse(ev, canvasHost, worldState, playerId);
    if (coord && (!mouseHoverCoord || mouseHoverCoord.x !== coord.x || mouseHoverCoord.y !== coord.y)) {
      mouseHoverCoord = coord;
      syncPresentation(false);
    }
  };

  canvasHost.addEventListener('mousemove', updateTileFromMouse);
  canvasHost.addEventListener('click', (ev: MouseEvent) => {
    updateTileFromMouse(ev);
    if (useDiegeticCanvasUi) {
      const hit = stageRenderer.resolveHitActionAt(ev.clientX, ev.clientY, canvasHost.getBoundingClientRect());
      if (hit) {
        handleDiegeticHitAction(hit, {
          onSelectProfession: (prof) => { embarkConfig = { ...embarkConfig, professionId: prof }; syncPresentation(); },
          onToggleTrait: (t) => {
            const has = embarkConfig.traitIds.includes(t);
            const traitIds = has ? embarkConfig.traitIds.filter((x) => x !== t) : embarkConfig.traitIds.length < 2 ? [...embarkConfig.traitIds, t] : embarkConfig.traitIds;
            embarkConfig = { ...embarkConfig, traitIds };
            syncPresentation();
          },
          onSelectScenario: (scen) => { embarkConfig = { ...embarkConfig, scenarioId: scen }; syncPresentation(); },
          onEmbark: () => { isCreatorOpen = false; handleEmbark(embarkConfig, worldState.seed); },
          onOpenModal: (w) => { activeModal = w; syncPresentation(); },
          onOpenSystemMenu: () => { isSystemMenuOpen = true; syncPresentation(); },
          onDispatchCommand: handleCommand,
          modalNavState,
          onSystemMenuAction: sysMenu.handleAction,
          onNavigate: () => syncPresentation(false),
        }, worldState, playerId);
      }
    }
  });

  window.addEventListener('keydown', (ev: KeyboardEvent) => {
    handleGameKeydown(ev, {
      playerId, isSystemMenuOpen, activeModal, isLookModeActive, isCreatorOpen,
      worldState, modalNavState, onNavigate: () => syncPresentation(false),
      onCreatorKey: (key) => {
        if (key === 'Enter') { isCreatorOpen = false; handleEmbark(embarkConfig, worldState.seed); return true; }
        const profs = ['DISGRACED_CHIRURGEON', 'FOUNDRY_ARTIFICER', 'CLOCKWORK_VETERAN', 'AETHER_SMUGGLER'] as const;
        const pIdx = Number.parseInt(key, 10) - 1;
        if (pIdx >= 0 && pIdx < profs.length) { embarkConfig = { ...embarkConfig, professionId: profs[pIdx]! }; syncPresentation(false); return true; }
        return false;
      },
      onSystemMenuKey: sysMenu.handleKey,
      onToggleSystemMenu: () => { sysMenu.reset(); isSystemMenuOpen = !isSystemMenuOpen; syncPresentation(); },
      onCloseModal: () => { activeModal = null; syncPresentation(); },
      onCycleModal: cycleModal,
      onSetModal: (modal) => { activeModal = modal; modalNavState.selectedIndex = 0; syncPresentation(); },
      onToggleLookMode: toggleLookMode, onMoveLookCursor: moveLookCursor,
      onLookAttack: (slot) => {
        const cmd = resolveLookAttackCommand(worldState, playerId, lookCursor, slot);
        if (cmd) handleCommand(cmd);
      },
      onLookInteract: () => {
        const cmd = resolveLookInteractCommand(worldState, playerId, lookCursor);
        if (cmd) handleCommand(cmd);
      },
      onToggleDoor: toggleAdjacentDoor, onTalk: handleTalk, onCloseDialogue: closeDialogue,
      isDialogueOpen: activeDialogueNpcId !== null,
      onOpenCharacterCreator: () => { isCreatorOpen = true; syncPresentation(); },
      onCloseCharacterCreator: () => { isCreatorOpen = false; syncPresentation(); },
      currentPosture: worldState.entities[playerId]?.actor?.posture ?? 'STANDING',
      onCommand: handleCommand,
    });
  });

  window.__DEBUG_SIM__ = {
    getState: () => worldState, dispatch: handleCommand,
    getVisualFrame: () => projectWorldToVisualFrame(worldState, playerId),
    serialize: () => serializeWorld(worldState), soundscape, saveAdapter, windowManager,
  };

  syncPresentation();
}
