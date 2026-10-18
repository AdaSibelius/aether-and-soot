import { render } from 'preact';
import { GameCommand } from '../schemas/commands.schema.js';
import { EntityIdSchema } from '../schemas/primitives.schema.js';
import { dispatchCommand } from '../sim/core/engine.js';
import { createInitialWorld, serializeWorld, WorldState } from '../sim/core/world.js';
import { setTileCell } from '../sim/spatial/grid.js';
import { projectWorldToVisualFrame, VisualGridFrame } from './projection/frame-adapter.js';
import { GlyphStageRenderer } from './renderer/glyph-stage.js';
import { HudLayout } from './ui/HudLayout.js';

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

function seedFoundryPillars(world: WorldState): WorldState {
  const streetGrid = world.strata.STREET;
  if (!streetGrid) {
    return world;
  }
  let updatedStreet = streetGrid;
  const pillars = [
    { x: 8, y: 8 },
    { x: 15, y: 8 },
    { x: 8, y: 15 },
    { x: 15, y: 15 },
  ];

  for (const p of pillars) {
    updatedStreet = setTileCell(updatedStreet, p.x, p.y, () => ({
      terrainType: 'SOOT_BRICK_WALL',
      blocksMovement: true,
      blocksSight: true,
      steamPressureKpa: 0,
      coalDustDensity: 0.4,
    }));
  }

  return {
    ...world,
    strata: {
      ...world.strata,
      STREET: updatedStreet,
    },
  };
}

async function bootstrapClient(): Promise<void> {
  const canvasHost = document.getElementById('canvas-stage');
  const hudHost = document.getElementById('hud-root');
  if (!canvasHost || !hudHost) {
    throw new Error('Missing #canvas-stage or #hud-root mount elements');
  }

  let worldState = seedFoundryPillars(createInitialWorld({ seed: 0xcafebabe, width: 24, height: 20 }));
  const stageRenderer = await GlyphStageRenderer.create(canvasHost, 24, 20);
  const playerId = EntityIdSchema.parse('actor_player');

  const syncPresentation = (): void => {
    const visualFrame = projectWorldToVisualFrame(worldState, playerId);
    stageRenderer.renderFrame(visualFrame);
    render(<HudLayout state={worldState} onCommand={handleCommand} />, hudHost);
  };

  const handleCommand = (cmd: GameCommand): void => {
    const result = dispatchCommand(worldState, cmd);
    worldState = result.state;
    syncPresentation();
  };

  window.addEventListener('keydown', (ev: KeyboardEvent) => {
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
