import { render } from 'preact';
import { GameCommand } from '../schemas/commands.schema.js';
import { EntityIdSchema } from '../schemas/primitives.schema.js';
import { dispatchCommand } from '../sim/core/engine.js';
import { createInitialWorld, serializeWorld, WorldState } from '../sim/core/world.js';
import { generateVictorianDistrict } from '../sim/spatial/generator.js';
import { spawnDistrictNpcs } from '../sim/systems/ai.system.js';
import { spawnDistrictItems } from '../sim/systems/item-spawner.js';
import { projectWorldToVisualFrame, VisualGridFrame } from './projection/frame-adapter.js';
import { CELL_HEIGHT_PX, CELL_WIDTH_PX, GlyphStageRenderer } from './renderer/glyph-stage.js';
import { HudLayout, HudTab } from './ui/HudLayout.js';
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

async function bootstrapClient(): Promise<void> {
  const canvasHost = document.getElementById('canvas-stage');
  const hudHost = document.getElementById('hud-root');
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

  let currentTab: HudTab = 'TELEMETRY';
  let hoveredTile: { x: number; y: number } | null = null;
  let isSystemMenuOpen = false;

  const syncPresentation = (): void => {
    const visualFrame = projectWorldToVisualFrame(worldState, playerId);
    stageRenderer.renderFrame(visualFrame);
    render(
      <div>
        <HudLayout
          state={worldState}
          onCommand={handleCommand}
          hoveredTile={hoveredTile}
          activeTab={currentTab}
          onSelectTab={(tab) => {
            currentTab = tab;
            syncPresentation();
          }}
          onOpenSystemMenu={() => {
            isSystemMenuOpen = true;
            syncPresentation();
          }}
        />
        <SystemMenuModal
          state={worldState}
          isOpen={isSystemMenuOpen}
          onClose={() => {
            isSystemMenuOpen = false;
            syncPresentation();
          }}
          onNewSeed={(seed) => {
            worldState = createFreshWorld(seed);
            syncPresentation();
          }}
          onLoadWorld={(loaded) => {
            worldState = loaded;
            syncPresentation();
          }}
        />
      </div>,
      hudHost,
    );
  };

  const handleCommand = (cmd: GameCommand): void => {
    const result = dispatchCommand(worldState, cmd);
    worldState = result.state;
    syncPresentation();
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
    if (ev.key === 'Escape') {
      ev.preventDefault();
      isSystemMenuOpen = !isSystemMenuOpen;
      syncPresentation();
      return;
    }

    if (isSystemMenuOpen) return;

    if (ev.key === 'i' || ev.key === 'I') {
      ev.preventDefault();
      currentTab = currentTab === 'INVENTORY' ? 'TELEMETRY' : 'INVENTORY';
      syncPresentation();
      return;
    }
    if (ev.key === 'c' || ev.key === 'C') {
      ev.preventDefault();
      currentTab = currentTab === 'WORKBENCH' ? 'TELEMETRY' : 'WORKBENCH';
      syncPresentation();
      return;
    }
    if (ev.key === 'm' || ev.key === 'M') {
      ev.preventDefault();
      currentTab = currentTab === 'EXCHANGE' ? 'TELEMETRY' : 'EXCHANGE';
      syncPresentation();
      return;
    }
    if (ev.key === 'A') {
      ev.preventDefault();
      currentTab = currentTab === 'SURGERY' ? 'TELEMETRY' : 'SURGERY';
      syncPresentation();
      return;
    }

    const keyMap: Record<string, { dx: number; dy: number }> = {
      ArrowUp: { dx: 0, dy: -1 },
      w: { dx: 0, dy: -1 },
      ArrowDown: { dx: 0, dy: 1 },
      s: { dx: 0, dy: 1 },
      ArrowLeft: { dx: -1, dy: 0 },
      a: { dx: -1, dy: 0 },
      ArrowRight: { dx: 1, dy: 0 },
      d: { dx: 1, dy: 0 },
    };

    const move = keyMap[ev.key];
    if (move) {
      ev.preventDefault();
      handleCommand({ type: 'MOVE_STEP', actorId: playerId, dx: move.dx, dy: move.dy });
      return;
    }

    if (ev.key === '>' || ev.key === '<' || ev.key === 'Enter') {
      ev.preventDefault();
      handleCommand({ type: 'USE_PORTAL', actorId: playerId });
    } else if (ev.key === '.' || ev.key === ' ') {
      ev.preventDefault();
      handleCommand({ type: 'WAIT_TURN', actorId: playerId });
    } else if (ev.key === 'g' || ev.key === ',') {
      ev.preventDefault();
      handleCommand({ type: 'PICK_UP_ITEM', actorId: playerId });
    }
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
