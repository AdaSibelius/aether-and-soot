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
import { projectWorldToVisualFrame, VisualGridFrame } from './projection/frame-adapter.js';
import { CELL_HEIGHT_PX, CELL_WIDTH_PX, GlyphStageRenderer } from './renderer/glyph-stage.js';
import { CharacterModalShell, ModalWindowId } from './ui/CharacterModalShell.js';
import { CharacterCreatorModal } from './ui/CharacterCreatorModal.js';
import { DialogueModal } from './ui/DialogueModal.js';
import { HudLayout } from './ui/HudLayout.js';
import { LookCursorOverlay } from './ui/LookCursorOverlay.js';
import { QuickActionBar } from './ui/QuickActionBar.js';
import { SystemMenuModal } from './ui/SystemMenuModal.js';

export interface DebugSimBridge {
  getState: () => Readonly<WorldState>;
  getVisualFrame: () => VisualGridFrame;
  dispatch: (cmd: GameCommand) => void;
  serialize: () => string;
}

declare global {
  interface Window { __DEBUG_SIM__?: DebugSimBridge; }
}

const MODAL_WINDOW_IDS: readonly ModalWindowId[] = ['INVENTORY', 'ANATOMY', 'WORKBENCH', 'EXCHANGE', 'ATLAS'];

async function bootstrapClient(): Promise<void> {
  const canvasHost = document.getElementById('canvas-stage');
  const hudHost = document.getElementById('hud-root');
  const actionBarHost = document.getElementById('action-bar-root');
  if (!canvasHost || !hudHost) throw new Error('Missing #canvas-stage or #hud-root mount elements');

  const createFreshWorld = (seed: number): WorldState => {
    const base = createInitialWorld({ seed });
    const withItems = spawnDistrictItems(generateVictorianDistrict(base).state).state;
    return spawnDistrictNpcs(withItems).state;
  };

  let worldState = createFreshWorld(0xcafebabe);
  const stageRenderer = await GlyphStageRenderer.create(canvasHost, 24, 20);
  const playerId = EntityIdSchema.parse('actor_player');
  canvasHost.style.position = 'relative';
  const overlayHost = document.createElement('div');
  canvasHost.appendChild(overlayHost);

  let activeModal: ModalWindowId | null = null;
  let hoveredTile: { x: number; y: number } | null = null;
  let isSystemMenuOpen = false;
  let isLookModeActive = false;
  let isCreatorOpen = false;
  let lookCursor: { x: number; y: number } | null = null;
  let activeDialogueNpcId: EntityId | null = null;

  const handleCommand = (cmd: GameCommand): void => {
    worldState = dispatchCommand(worldState, cmd).state;
    syncPresentation();
  };

  const handleEmbark = (cfg: CharacterCreationConfig, s: number): void => {
    worldState = applyCharacterCreation(createFreshWorld(s), cfg);
    syncPresentation();
  };

  const handleTalk = (targetId?: EntityId): void => {
    if (targetId) { activeDialogueNpcId = targetId; syncPresentation(); return; }
    const p = worldState.entities[playerId]?.position;
    if (!p) return;
    const adj = Object.values(worldState.entities).find(
      (e) => e.id !== playerId && e.actor && !e.actor.isPlayer && !e.aiController?.hostile && e.position
        && e.position.stratum === p.stratum && Math.max(Math.abs(e.position.x - p.x), Math.abs(e.position.y - p.y)) <= 1,
    );
    if (adj) { activeDialogueNpcId = adj.id; syncPresentation(); }
  };

  const cycleModal = (direction: 1 | -1): void => {
    if (!activeModal) return;
    const idx = MODAL_WINDOW_IDS.indexOf(activeModal);
    const nextIdx = (idx + direction + MODAL_WINDOW_IDS.length) % MODAL_WINDOW_IDS.length;
    activeModal = MODAL_WINDOW_IDS[nextIdx] ?? 'INVENTORY';
    syncPresentation();
  };

  const toggleLookMode = (): void => {
    isLookModeActive = !isLookModeActive;
    const p = worldState.entities[playerId]?.position;
    lookCursor = isLookModeActive ? (p ? { x: p.x, y: p.y } : { x: 12, y: 10 }) : null;
    hoveredTile = lookCursor;
    syncPresentation();
  };

  const moveLookCursor = (dx: number, dy: number): void => {
    if (!lookCursor) return;
    const p = worldState.entities[playerId]?.position;
    const grid = p ? worldState.strata[p.stratum] : undefined;
    lookCursor = {
      x: Math.max(0, Math.min((grid?.width ?? 48) - 1, lookCursor.x + dx)),
      y: Math.max(0, Math.min((grid?.height ?? 36) - 1, lookCursor.y + dy)),
    };
    hoveredTile = lookCursor;
    syncPresentation();
  };

  const lookAttack = (slot: LimbSlotId): void => {
    if (!lookCursor) return;
    const p = worldState.entities[playerId]?.position;
    if (!p) return;
    const target = Object.values(worldState.entities).find(
      (e) => e.id !== playerId && e.actor && e.position && e.position.stratum === p.stratum && e.position.x === lookCursor?.x && e.position.y === lookCursor?.y,
    );
    if (!target) return;
    const isAdj = Math.max(Math.abs(p.x - lookCursor.x), Math.abs(p.y - lookCursor.y)) <= 1;
    handleCommand(isAdj
      ? { type: 'ATTACK_ACTOR', attackerId: playerId, targetId: target.id, targetSlot: slot }
      : { type: 'FIRE_RANGED_WEAPON', actorId: playerId, targetId: target.id, targetSlot: slot });
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

  const syncPresentation = (): void => {
    const visualFrame = projectWorldToVisualFrame(worldState, playerId);
    stageRenderer.renderFrame(visualFrame);

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
          onToggleLookMode={toggleLookMode} onCommand={handleCommand}
          onOpenModal={(w) => { activeModal = w; syncPresentation(); }}
          onOpenSystemMenu={() => { isSystemMenuOpen = true; syncPresentation(); }}
          onOpenCharacterCreator={() => { isCreatorOpen = true; syncPresentation(); }}
        />,
        actionBarHost,
      );
    }

    render(
      <div>
        <HudLayout
          state={worldState} onCommand={handleCommand} hoveredTile={hoveredTile}
          onOpenModal={(w) => { activeModal = w; syncPresentation(); }}
          onOpenSystemMenu={() => { isSystemMenuOpen = true; syncPresentation(); }}
        />
        <CharacterModalShell
          state={worldState} actorId={playerId} activeWindow={activeModal}
          onClose={() => { activeModal = null; syncPresentation(); }}
          onSelectWindow={(w) => { activeModal = w; syncPresentation(); }}
          onCommand={handleCommand}
        />
        {activeDialogueNpcId && (
          <DialogueModal
            state={worldState} actorId={playerId} targetNpcId={activeDialogueNpcId}
            onCommand={handleCommand} onClose={() => { activeDialogueNpcId = null; syncPresentation(); }}
          />
        )}
        <SystemMenuModal
          state={worldState} isOpen={isSystemMenuOpen}
          onClose={() => { isSystemMenuOpen = false; syncPresentation(); }}
          onNewSeed={(s) => { worldState = createFreshWorld(s); syncPresentation(); }}
          onLoadWorld={(loaded) => { worldState = loaded; syncPresentation(); }}
          onOpenCharacterCreator={() => { isCreatorOpen = true; syncPresentation(); }}
        />
        <CharacterCreatorModal
          isOpen={isCreatorOpen} initialSeed={worldState.seed}
          onClose={() => { isCreatorOpen = false; syncPresentation(); }}
          onEmbark={handleEmbark}
        />
      </div>,
      hudHost,
    );
  };

  const updateTileFromMouse = (ev: MouseEvent): void => {
    const rect = canvasHost.getBoundingClientRect();
    const sx = Math.floor((ev.clientX - rect.left) / CELL_WIDTH_PX);
    const sy = Math.floor((ev.clientY - rect.top) / CELL_HEIGHT_PX);
    if (sx >= 0 && sx < 24 && sy >= 0 && sy < 20) {
      const frame = projectWorldToVisualFrame(worldState, playerId);
      const wx = frame.cameraOrigin.x + sx;
      const wy = frame.cameraOrigin.y + sy;
      if (!hoveredTile || hoveredTile.x !== wx || hoveredTile.y !== wy) {
        hoveredTile = { x: wx, y: wy };
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
      onToggleLookMode: toggleLookMode,
      onMoveLookCursor: moveLookCursor,
      onLookAttack: lookAttack,
      onLookInteract: lookInteract,
      onTalk: handleTalk,
      onOpenCharacterCreator: () => { isCreatorOpen = true; syncPresentation(); },
      onCommand: handleCommand,
    });
  });

  window.__DEBUG_SIM__ = {
    getState: () => worldState,
    getVisualFrame: () => projectWorldToVisualFrame(worldState, playerId),
    dispatch: handleCommand,
    serialize: () => serializeWorld(worldState),
  };

  syncPresentation();
}

void bootstrapClient();

