import { render } from 'preact';
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
import { CharacterModalShell, ModalWindowId } from './ui/CharacterModalShell.js';
import { CharacterCreatorModal } from './ui/CharacterCreatorModal.js';
import { DialogueModal } from './ui/DialogueModal.js';
import { HudLayout } from './ui/HudLayout.js';
import { LookCursorOverlay } from './ui/LookCursorOverlay.js';
import { ModalTopBar } from './ui/ModalTopBar.js';
import { QuickActionBar } from './ui/QuickActionBar.js';
import { SystemMenuModal } from './ui/SystemMenuModal.js';
import { getSoundscapeManager } from './audio/soundscape-manager.js';
import { clampLookCursor, cycleModalWindow, findAdjacentDialogueNpc, findAdjacentDoorTarget, findEntityAtLookCursor, resolveInspectedTileCoord } from './client-interactions.js';
import type { DebugSimBridge } from './client-debug-bridge.js';

declare global {
  interface Window { __DEBUG_SIM__?: DebugSimBridge; }
}

async function bootstrapClient(): Promise<void> {
  const canvasHost = document.getElementById('canvas-stage');
  const hudHost = document.getElementById('hud-root');
  const actionBarHost = document.getElementById('action-bar-root');
  const topBarHost = document.getElementById('top-bar-root');
  if (!canvasHost || !hudHost) throw new Error('Missing #canvas-stage or #hud-root mount elements');

  const createFreshWorld = (seed: number): WorldState =>
    spawnDistrictNpcs(spawnDistrictItems(generateVictorianDistrict(createInitialWorld({ seed })).state).state).state;

  let worldState = createFreshWorld(0xcafebabe);
  const stageRenderer = await GlyphStageRenderer.create(canvasHost, WIDESCREEN_GRID_WIDTH, WIDESCREEN_GRID_HEIGHT);
  const playerId = EntityIdSchema.parse('actor_player');
  canvasHost.style.position = 'relative';
  canvasHost.style.width = '1056px';
  canvasHost.style.maxWidth = '100%';
  canvasHost.style.height = '720px';
  const overlayHost = document.createElement('div');
  Object.assign(overlayHost.style, { position: 'absolute', top: '0', left: '0', width: '1056px', height: '720px', pointerEvents: 'none' });
  canvasHost.appendChild(overlayHost);

  let activeModal: ModalWindowId | null = null;
  let mouseHoverCoord: { x: number; y: number } | null = null;
  let isSystemMenuOpen = false;
  let isLookModeActive = false;
  let isCreatorOpen = false;
  let isCrtScanlinesEnabled = true;
  let lookCursor: { x: number; y: number } | null = null;
  let activeDialogueNpcId: EntityId | null = null;

  const soundscape = getSoundscapeManager();
  const handleCommand = (cmd: GameCommand): void => {
    soundscape.initOnUserGesture();
    const outcome = dispatchCommand(worldState, cmd);
    worldState = outcome.state;
    soundscape.processSimEvents(outcome.events);
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

  const syncPresentation = (): void => {
    const visualFrame = projectWorldToVisualFrame(worldState, playerId, undefined, {
      width: WIDESCREEN_GRID_WIDTH,
      height: WIDESCREEN_GRID_HEIGHT,
    });
    stageRenderer.renderFrame(visualFrame);

    if (topBarHost) {
      render(<ModalTopBar activeModal={activeModal} onOpenModal={(w) => { activeModal = w; syncPresentation(); }} onOpenSystemMenu={() => { isSystemMenuOpen = true; syncPresentation(); }} />, topBarHost);
    }

    render(
      <LookCursorOverlay
        isActive={isLookModeActive} cursor={lookCursor} cameraOrigin={visualFrame.cameraOrigin}
        state={worldState} actorId={playerId} onCommand={handleCommand} onClose={toggleLookMode} onTalk={handleTalk}
      />,
      overlayHost,
    );

    if (actionBarHost) {
      render(
        <QuickActionBar
          state={worldState} actorId={playerId} isLookModeActive={isLookModeActive}
          onToggleLookMode={toggleLookMode} onToggleDoor={toggleAdjacentDoor} onCommand={handleCommand}
        />,
        actionBarHost,
      );
    }

    const inspectedTile = resolveInspectedTileCoord(isLookModeActive, lookCursor, mouseHoverCoord);

    render(
      <div>
        <HudLayout
          state={worldState} onCommand={handleCommand} hoveredTile={inspectedTile}
          onOpenModal={(w) => { activeModal = w; syncPresentation(); }}
          onOpenSystemMenu={() => { isSystemMenuOpen = true; syncPresentation(); }}
          onReEmbark={() => { isCreatorOpen = true; syncPresentation(); }}
        />
        <CharacterModalShell
          state={worldState} actorId={playerId} activeWindow={activeModal}
          onClose={() => { activeModal = null; syncPresentation(); }}
          onSelectWindow={(w) => { activeModal = w; syncPresentation(); }} onCommand={handleCommand}
        />
        {activeDialogueNpcId && (
          <DialogueModal
            state={worldState} actorId={playerId} targetNpcId={activeDialogueNpcId}
            onCommand={handleCommand} onClose={() => { activeDialogueNpcId = null; syncPresentation(); }}
            onOpenModal={(w) => { activeDialogueNpcId = null; activeModal = w; syncPresentation(); }}
          />
        )}
        <SystemMenuModal
          state={worldState} isOpen={isSystemMenuOpen} onClose={() => { isSystemMenuOpen = false; syncPresentation(); }}
          onNewSeed={(s) => { worldState = createFreshWorld(s); syncPresentation(); }}
          onLoadWorld={(loaded) => { worldState = loaded; syncPresentation(); }}
          onOpenCharacterCreator={() => { isCreatorOpen = true; syncPresentation(); }}
          crtScanlinesEnabled={isCrtScanlinesEnabled} onToggleCrtScanlines={toggleCrtScanlines}
        />
        <CharacterCreatorModal
          isOpen={isCreatorOpen} initialSeed={worldState.seed}
          onClose={() => { isCreatorOpen = false; syncPresentation(); }} onEmbark={handleEmbark}
        />
      </div>,
      hudHost,
    );
  };

  const updateTileFromMouse = (ev: MouseEvent): void => {
    const rect = canvasHost.getBoundingClientRect();
    const sx = Math.floor((ev.clientX - rect.left) / CELL_WIDTH_PX), sy = Math.floor((ev.clientY - rect.top) / CELL_HEIGHT_PX);
    if (sx >= 0 && sx < WIDESCREEN_GRID_WIDTH && sy >= 0 && sy < WIDESCREEN_GRID_HEIGHT) {
      const frame = projectWorldToVisualFrame(worldState, playerId, undefined, { width: WIDESCREEN_GRID_WIDTH, height: WIDESCREEN_GRID_HEIGHT });
      const wx = frame.cameraOrigin.x + sx, wy = frame.cameraOrigin.y + sy;
      if (!mouseHoverCoord || mouseHoverCoord.x !== wx || mouseHoverCoord.y !== wy) {
        mouseHoverCoord = { x: wx, y: wy };
        syncPresentation();
      }
    }
  };

  canvasHost.addEventListener('mousemove', updateTileFromMouse);
  canvasHost.addEventListener('click', updateTileFromMouse);

  window.addEventListener('keydown', (ev: KeyboardEvent) => {
    handleGameKeydown(ev, {
      playerId, isSystemMenuOpen, activeModal, isLookModeActive,
      onToggleSystemMenu: () => { isSystemMenuOpen = !isSystemMenuOpen; syncPresentation(); },
      onCloseModal: () => { activeModal = null; syncPresentation(); },
      onCycleModal: cycleModal,
      onSetModal: (modal) => { activeModal = modal; syncPresentation(); },
      onToggleLookMode: toggleLookMode, onMoveLookCursor: moveLookCursor,
      onLookAttack: lookAttack, onLookInteract: lookInteract,
      onToggleDoor: toggleAdjacentDoor, onTalk: handleTalk,
      onOpenCharacterCreator: () => { isCreatorOpen = true; syncPresentation(); },
      onCommand: handleCommand,
    });
  });

  window.__DEBUG_SIM__ = {
    getState: () => worldState, dispatch: handleCommand,
    getVisualFrame: () => projectWorldToVisualFrame(worldState, playerId),
    serialize: () => serializeWorld(worldState),
    soundscape,
  };

  syncPresentation();
}

void bootstrapClient();

export type { DebugSimBridge } from './client-debug-bridge.js';
