import { render } from 'preact';
import { GameCommand } from '../schemas/commands.schema.js';
import { EntityIdSchema, LimbSlotId } from '../schemas/primitives.schema.js';
import { dispatchCommand } from '../sim/core/engine.js';
import { createInitialWorld, serializeWorld, WorldState } from '../sim/core/world.js';
import { generateVictorianDistrict } from '../sim/spatial/generator.js';
import { getTileCell } from '../sim/spatial/grid.js';
import { spawnDistrictNpcs } from '../sim/systems/ai.system.js';
import { spawnDistrictItems } from '../sim/systems/item-spawner.js';
import { handleGameKeydown } from './input/keyboard-router.js';
import { projectWorldToVisualFrame, VisualGridFrame } from './projection/frame-adapter.js';
import { CELL_HEIGHT_PX, CELL_WIDTH_PX, GlyphStageRenderer } from './renderer/glyph-stage.js';
import { CharacterModalShell, ModalWindowId } from './ui/CharacterModalShell.js';
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
  interface Window {
    __DEBUG_SIM__?: DebugSimBridge;
  }
}

const MODAL_WINDOW_IDS: readonly ModalWindowId[] = ['INVENTORY', 'ANATOMY', 'WORKBENCH', 'EXCHANGE', 'ATLAS'];

async function bootstrapClient(): Promise<void> {
  const canvasHost = document.getElementById('canvas-stage');
  const hudHost = document.getElementById('hud-root');
  const actionBarHost = document.getElementById('action-bar-root');
  if (!canvasHost || !hudHost) {
    throw new Error('Missing #canvas-stage or #hud-root mount elements');
  }

  const createFreshWorld = (seed: number): WorldState => {
    const base = createInitialWorld({ seed, width: 24, height: 20 });
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
  let lookCursor: { x: number; y: number } | null = null;

  const handleCommand = (cmd: GameCommand): void => {
    const result = dispatchCommand(worldState, cmd);
    worldState = result.state;
    syncPresentation();
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
    if (isLookModeActive) {
      const p = worldState.entities[playerId]?.position;
      lookCursor = p ? { x: p.x, y: p.y } : { x: 12, y: 10 };
      hoveredTile = lookCursor;
    } else {
      lookCursor = null;
    }
    syncPresentation();
  };

  const moveLookCursor = (dx: number, dy: number): void => {
    if (!lookCursor) return;
    lookCursor = {
      x: Math.max(0, Math.min(23, lookCursor.x + dx)),
      y: Math.max(0, Math.min(19, lookCursor.y + dy)),
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
    if (target) {
      handleCommand({ type: 'ATTACK_ACTOR', attackerId: playerId, targetId: target.id, targetSlot: slot });
    }
  };

  const lookInteract = (): void => {
    if (!lookCursor) return;
    const p = worldState.entities[playerId]?.position;
    if (!p) return;
    const grid = worldState.strata[p.stratum];
    const cell = grid ? getTileCell(grid, lookCursor.x, lookCursor.y) : undefined;
    if (cell?.terrainType === 'WOODEN_DOOR_CLOSED' || cell?.terrainType === 'WOODEN_DOOR_OPEN') {
      handleCommand({ type: 'TOGGLE_DOOR', actorId: playerId, target: { x: lookCursor.x, y: lookCursor.y, stratum: p.stratum } });
      return;
    }
    handleCommand({ type: 'USE_PORTAL', actorId: playerId });
  };

  const syncPresentation = (): void => {
    const visualFrame = projectWorldToVisualFrame(worldState, playerId);
    stageRenderer.renderFrame(visualFrame);

    render(
      <LookCursorOverlay
        isActive={isLookModeActive}
        cursor={lookCursor}
        state={worldState}
        actorId={playerId}
        onCommand={handleCommand}
        onClose={toggleLookMode}
      />,
      overlayHost,
    );

    if (actionBarHost) {
      render(
        <QuickActionBar
          state={worldState}
          actorId={playerId}
          isLookModeActive={isLookModeActive}
          onToggleLookMode={toggleLookMode}
          onCommand={handleCommand}
          onOpenModal={(w) => { activeModal = w; syncPresentation(); }}
          onOpenSystemMenu={() => { isSystemMenuOpen = true; syncPresentation(); }}
        />,
        actionBarHost,
      );
    }

    render(
      <div>
        <HudLayout
          state={worldState}
          onCommand={handleCommand}
          hoveredTile={hoveredTile}
          onOpenModal={(w) => { activeModal = w; syncPresentation(); }}
          onOpenSystemMenu={() => { isSystemMenuOpen = true; syncPresentation(); }}
        />
        <CharacterModalShell
          state={worldState}
          actorId={playerId}
          activeWindow={activeModal}
          onClose={() => { activeModal = null; syncPresentation(); }}
          onSelectWindow={(w) => { activeModal = w; syncPresentation(); }}
          onCommand={handleCommand}
        />
        <SystemMenuModal
          state={worldState}
          isOpen={isSystemMenuOpen}
          onClose={() => { isSystemMenuOpen = false; syncPresentation(); }}
          onNewSeed={(seed) => { worldState = createFreshWorld(seed); syncPresentation(); }}
          onLoadWorld={(loaded) => { worldState = loaded; syncPresentation(); }}
        />
      </div>,
      hudHost,
    );
  };

  const updateTileFromMouse = (ev: MouseEvent): void => {
    const rect = canvasHost.getBoundingClientRect();
    const x = Math.floor((ev.clientX - rect.left) / CELL_WIDTH_PX);
    const y = Math.floor((ev.clientY - rect.top) / CELL_HEIGHT_PX);
    if (x >= 0 && x < 24 && y >= 0 && y < 20) {
      if (!hoveredTile || hoveredTile.x !== x || hoveredTile.y !== y) {
        hoveredTile = { x, y };
        syncPresentation();
      }
    }
  };

  canvasHost.addEventListener('mousemove', updateTileFromMouse);
  canvasHost.addEventListener('click', updateTileFromMouse);

  window.addEventListener('keydown', (ev: KeyboardEvent) => {
    handleGameKeydown(ev, {
      playerId,
      isSystemMenuOpen,
      activeModal,
      isLookModeActive,
      onToggleSystemMenu: () => { isSystemMenuOpen = !isSystemMenuOpen; syncPresentation(); },
      onCloseModal: () => { activeModal = null; syncPresentation(); },
      onCycleModal: cycleModal,
      onSetModal: (modal) => { activeModal = modal; syncPresentation(); },
      onToggleLookMode: toggleLookMode,
      onMoveLookCursor: moveLookCursor,
      onLookAttack: lookAttack,
      onLookInteract: lookInteract,
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
