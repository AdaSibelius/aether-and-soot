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
  canvasHost.style.width = '1056px';
  canvasHost.style.maxWidth = '100%';
  canvasHost.style.height = '720px';
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

  startClientSession(
    { canvasHost, overlayHost, hudHost, actionBarHost, topBarHost },
    stageRenderer,
  );
}

void bootstrapClient();

export type { DebugSimBridge } from './client-debug-bridge.js';
