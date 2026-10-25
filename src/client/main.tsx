import { GlyphStageRenderer, WIDESCREEN_GRID_HEIGHT, WIDESCREEN_GRID_WIDTH } from './renderer/glyph-stage.js';
import { startClientSession } from './bootstrap-loop.js';
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

  const stageRenderer = await GlyphStageRenderer.create(canvasHost, WIDESCREEN_GRID_WIDTH, WIDESCREEN_GRID_HEIGHT);
  canvasHost.style.position = 'relative';
  const overlayHost = document.createElement('div');
  Object.assign(overlayHost.style, {
    position: 'absolute',
    top: '0',
    left: '0',
    width: '1056px',
    height: '720px',
    pointerEvents: 'none',
  });
  canvasHost.appendChild(overlayHost);

  const searchParams = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
  const seedParam = searchParams?.get('seed');
  const parsedSeed = seedParam ? Number.parseInt(seedParam, 10) : 0xcafebabe;
  const initialSeed = Number.isNaN(parsedSeed) ? 0xcafebabe : parsedSeed;

  startClientSession(
    { canvasHost, overlayHost, hudHost, actionBarHost, topBarHost },
    stageRenderer,
    initialSeed,
  );

  const modalParam = searchParams?.get('modal')?.toUpperCase();
  if (modalParam) {
    const keyMap: Record<string, string> = {
      INVENTORY: 'i',
      WORKBENCH: 'c',
      EXCHANGE: 'm',
      ANATOMY: 'A',
      ATLAS: 'W',
      CODEX: 'k',
    };
    const key = keyMap[modalParam];
    if (key) {
      window.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));
    }
  }

  if (searchParams?.get('look') === 'true') {
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'l', bubbles: true }));
  }

  if (searchParams?.get('creator') === 'true') {
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'N', bubbles: true }));
  }

  if (searchParams?.get('menu') === 'true') {
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  }
}

void bootstrapClient();

export type { DebugSimBridge } from './client-debug-bridge.js';
