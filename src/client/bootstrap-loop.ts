import { GameCommand } from '../schemas/commands.schema.js';
import { CharacterCreationConfig } from '../schemas/character.schema.js';
import { EntityId, EntityIdSchema, LimbSlotId } from '../schemas/primitives.schema.js';
import { dispatchCommand } from '../sim/core/engine.js';
import { createInitialWorld, serializeWorld, WorldState } from '../sim/core/world.js';
import { generateVictorianDistrict } from '../sim/spatial/generator.js';
import { getTileCell } from '../sim/spatial/grid.js';
import { spawnDistrictNpcs } from '../sim/systems/ai.system.js';
import { spawnDistrictItems } from '../sim/systems/item-spawner.js';
import { applyCharacterCreation } from '../sim/systems/character-archetypes.js';
import { handleGameKeydown } from './input/keyboard-router.js';
import { projectWorldToVisualFrame } from './projection/frame-adapter.js';
import { CELL_HEIGHT_PX, CELL_WIDTH_PX, GlyphStageRenderer, WIDESCREEN_GRID_HEIGHT, WIDESCREEN_GRID_WIDTH } from './renderer/glyph-stage.js';
import { ModalWindowId } from './ui/CharacterModalShell.js';
import { renderClientPresentationViews } from './ui/ClientPresentationView.js';
import { getSoundscapeManager } from './audio/soundscape-manager.js';
import { clampLookCursor, cycleModalWindow, findAdjacentDialogueNpc, findAdjacentDoorTarget, findEntityAtLookCursor, resolveDiegeticClickHit } from './client-interactions.js';
import { deriveFloatingCombatText, FloatingTextCallout } from './renderer/floating-combat-text.js';
import { getDefaultSaveStorageAdapter } from './persistence/save-adapter.js';
import { DesktopWindowManager } from './renderer/desktop-window-manager.js';
import { generateModalUiBuffer } from './canvas-ui/modal-buffer-router.js';
import { resolveThermodynamicStress } from './renderer/steampunk-shader.js';

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

export function startClientSession(
  mounts: ClientSessionMounts,
  stageRenderer: GlyphStageRenderer,
  initialSeed = 0xcafebabe,
): void {
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
  const modalNavState = { selectedIndex: 0 };

  const soundscape = getSoundscapeManager();
  const saveAdapter = getDefaultSaveStorageAdapter();
  const windowManager = new DesktopWindowManager({
    onSuspend: () => soundscape.suspend(),
    onResume: () => soundscape.resume(),
  });

  const handleCommand = (cmd: GameCommand): void => {
    soundscape.initOnUserGesture();
    const outcome = dispatchCommand(worldState, cmd);
    worldState = outcome.state;
    soundscape.processSimEvents(outcome.events);
    const newCallouts = deriveFloatingCombatText(outcome.events, worldState);
    if (newCallouts.length > 0) {
      floatingCallouts = [...floatingCallouts, ...newCallouts];
    }
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

  const lookAttack = (slot: LimbSlotId): void => {
    if (!lookCursor) return;
    const p = worldState.entities[playerId]?.position;
    if (!p) return;
    const target = findEntityAtLookCursor(worldState, p.stratum, lookCursor, playerId);
    if (!target) return;
    const isAdj = Math.max(Math.abs(p.x - lookCursor.x), Math.abs(p.y - lookCursor.y)) <= 1;
    handleCommand(isAdj ? { type: 'ATTACK_ACTOR', attackerId: playerId, targetId: target.id, targetSlot: slot } : { type: 'FIRE_RANGED_WEAPON', actorId: playerId, targetId: target.id, targetSlot: slot });
  };

  const lookInteract = (): void => {
    if (!lookCursor) return;
    const p = worldState.entities[playerId]?.position;
    if (!p) return;
    const grid = worldState.strata[p.stratum];
    const cell = grid ? getTileCell(grid, lookCursor.x, lookCursor.y) : undefined;
    if (cell?.terrainType === 'WOODEN_DOOR_CLOSED' || cell?.terrainType === 'WOODEN_DOOR_OPEN') {
      handleCommand({ type: 'TOGGLE_DOOR', actorId: playerId, target: { x: lookCursor.x, y: lookCursor.y, stratum: p.stratum } });
    } else {
      handleCommand({ type: 'USE_PORTAL', actorId: playerId });
    }
  };

  const toggleAdjacentDoor = (): void => {
    if (isLookModeActive) { lookInteract(); return; }
    const match = findAdjacentDoorTarget(worldState, playerId);
    if (match) handleCommand({ type: 'TOGGLE_DOOR', actorId: playerId, target: match });
  };

  const toggleCrtScanlines = (): void => {
    isCrtScanlinesEnabled = !isCrtScanlinesEnabled;
    stageRenderer.setCrtScanlinesEnabled(isCrtScanlinesEnabled);
    syncPresentation();
  };

  const toggleUiMode = (): void => {
    useDiegeticCanvasUi = !useDiegeticCanvasUi;
    syncPresentation();
  };

  const syncPresentation = (advanceTime = true): void => {
    const nowMs = Date.now();
    floatingCallouts = floatingCallouts.filter((c) => nowMs - c.createdAtMs <= c.durationMs);

    const visualFrame = projectWorldToVisualFrame(worldState, playerId, undefined, {
      width: WIDESCREEN_GRID_WIDTH,
      height: WIDESCREEN_GRID_HEIGHT,
    });
    const thermo = resolveThermodynamicStress(worldState, playerId);
    const effectiveThermoStress = activeModal ? 0 : thermo.stressValue;
    const uiBuffer = (activeModal && useDiegeticCanvasUi)
      ? generateModalUiBuffer(activeModal, worldState, playerId, WIDESCREEN_GRID_WIDTH, WIDESCREEN_GRID_HEIGHT)
      : undefined;

    stageRenderer.renderFrame(visualFrame, uiBuffer, effectiveThermoStress, 16.67, advanceTime);

    renderClientPresentationViews(
      { topBarHost, overlayHost, actionBarHost, hudHost },
      {
        worldState, playerId, activeModal, isSystemMenuOpen, isLookModeActive,
        isCreatorOpen, isCrtScanlinesEnabled, lookCursor, mouseHoverCoord,
        cameraOrigin: visualFrame.cameraOrigin, activeDialogueNpcId,
        floatingItems: floatingCallouts,
        useDiegeticCanvasUi,
        onToggleUiMode: toggleUiMode,
        onCommand: handleCommand,
        onOpenModal: (w) => { activeModal = w; syncPresentation(); },
        onCloseModal: () => { activeModal = null; syncPresentation(); },
        onOpenSystemMenu: () => { isSystemMenuOpen = true; syncPresentation(); },
        onCloseSystemMenu: () => { isSystemMenuOpen = false; syncPresentation(); },
        onToggleLookMode: toggleLookMode,
        onToggleDoor: toggleAdjacentDoor,
        onTalk: handleTalk,
        onNewSeed: (s) => { worldState = createFreshWorld(s); syncPresentation(); },
        onLoadWorld: (loaded) => { worldState = loaded; syncPresentation(); },
        onOpenCharacterCreator: () => { isCreatorOpen = true; syncPresentation(); },
        onCloseCharacterCreator: () => { isCreatorOpen = false; syncPresentation(); },
        onEmbark: handleEmbark,
        onToggleCrtScanlines: toggleCrtScanlines,
      },
    );

    if (floatingCallouts.length > 0 && typeof requestAnimationFrame !== 'undefined') {
      requestAnimationFrame(() => syncPresentation(false));
    }
  };

  const updateTileFromMouse = (ev: MouseEvent): void => {
    const rect = canvasHost.getBoundingClientRect();
    const sx = Math.floor((ev.clientX - rect.left) / CELL_WIDTH_PX);
    const sy = Math.floor((ev.clientY - rect.top) / CELL_HEIGHT_PX);
    if (sx >= 0 && sx < WIDESCREEN_GRID_WIDTH && sy >= 0 && sy < WIDESCREEN_GRID_HEIGHT) {
      const frame = projectWorldToVisualFrame(worldState, playerId, undefined, { width: WIDESCREEN_GRID_WIDTH, height: WIDESCREEN_GRID_HEIGHT });
      const wx = frame.cameraOrigin.x + sx;
      const wy = frame.cameraOrigin.y + sy;
      if (!mouseHoverCoord || mouseHoverCoord.x !== wx || mouseHoverCoord.y !== wy) {
        mouseHoverCoord = { x: wx, y: wy };
        syncPresentation(false);
      }
    }
  };

  canvasHost.addEventListener('mousemove', updateTileFromMouse);
  canvasHost.addEventListener('click', (ev: MouseEvent) => {
    updateTileFromMouse(ev);
    if (activeModal && useDiegeticCanvasUi) {
      const hit = stageRenderer.resolveHitActionAt(ev.clientX, ev.clientY, canvasHost.getBoundingClientRect());
      const cmd = resolveDiegeticClickHit(hit, worldState, playerId);
      if (cmd) handleCommand(cmd);
    }
  });

  window.addEventListener('keydown', (ev: KeyboardEvent) => {
    handleGameKeydown(ev, {
      playerId, isSystemMenuOpen, activeModal, isLookModeActive,
      worldState, modalNavState,
      onToggleSystemMenu: () => { isSystemMenuOpen = !isSystemMenuOpen; syncPresentation(); },
      onCloseModal: () => { activeModal = null; syncPresentation(); },
      onCycleModal: cycleModal,
      onSetModal: (modal) => { activeModal = modal; modalNavState.selectedIndex = 0; syncPresentation(); },
      onToggleLookMode: toggleLookMode, onMoveLookCursor: moveLookCursor,
      onLookAttack: lookAttack, onLookInteract: lookInteract,
      onToggleDoor: toggleAdjacentDoor, onTalk: handleTalk,
      onOpenCharacterCreator: () => { isCreatorOpen = true; syncPresentation(); },
      currentPosture: worldState.entities[playerId]?.actor?.posture ?? 'STANDING',
      onCommand: handleCommand,
    });
  });

  window.__DEBUG_SIM__ = {
    getState: () => worldState,
    dispatch: handleCommand,
    getVisualFrame: () => projectWorldToVisualFrame(worldState, playerId),
    serialize: () => serializeWorld(worldState),
    soundscape,
    saveAdapter,
    windowManager,
  };

  syncPresentation();
}
