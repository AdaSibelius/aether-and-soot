import { SimEvent } from '../../schemas/events.schema.js';
import { WorldState } from '../../sim/core/world.js';
import { CELL_HEIGHT_PX, CELL_WIDTH_PX, WIDESCREEN_GRID_HEIGHT, WIDESCREEN_GRID_WIDTH } from './glyph-stage.js';

export interface FloatingTextCallout {
  readonly id: string;
  readonly text: string;
  readonly color: string;
  readonly worldX: number;
  readonly worldY: number;
  readonly createdAtMs: number;
  readonly durationMs: number;
}

let calloutCounter = 0;

export function deriveFloatingCombatText(
  events: readonly SimEvent[],
  state: Readonly<WorldState>,
  nowMs = Date.now(),
): FloatingTextCallout[] {
  const callouts: FloatingTextCallout[] = [];

  for (const ev of events) {
    if (ev.type === 'COMBAT_ATTACK_RESOLVED' || ev.type === 'RANGED_ATTACK_RESOLVED') {
      const targetPos = state.entities[ev.targetId]?.position;
      if (targetPos) {
        if (ev.hit) {
          callouts.push({
            id: `callout-${++calloutCounter}`,
            text: `-${ev.damageDealt} [${ev.targetSlot}]`,
            color: '#e74c3c',
            worldX: targetPos.x,
            worldY: targetPos.y,
            createdAtMs: nowMs,
            durationMs: 1400,
          });
        } else {
          callouts.push({
            id: `callout-${++calloutCounter}`,
            text: 'MISS',
            color: '#7f6b55',
            worldX: targetPos.x,
            worldY: targetPos.y,
            createdAtMs: nowMs,
            durationMs: 1000,
          });
        }
      }
    } else if (ev.type === 'LIMB_AMPUTATED') {
      const targetPos = state.entities[ev.targetId]?.position;
      if (targetPos) {
        callouts.push({
          id: `callout-${++calloutCounter}`,
          text: `AMPUTATED [${ev.slot}]!`,
          color: '#ff2222',
          worldX: targetPos.x,
          worldY: targetPos.y,
          createdAtMs: nowMs + 100,
          durationMs: 1600,
        });
      }
    } else if (ev.type === 'THERMAL_SCALD') {
      const actorPos = state.entities[ev.targetId]?.position;
      if (actorPos) {
        callouts.push({
          id: `callout-${++calloutCounter}`,
          text: `-${ev.damage} SCALD!`,
          color: '#e67e22',
          worldX: actorPos.x,
          worldY: actorPos.y,
          createdAtMs: nowMs,
          durationMs: 1300,
        });
      }
    } else if (ev.type === 'WALL_BREACHED') {
      callouts.push({
        id: `callout-${++calloutCounter}`,
        text: 'WALL BREACHED!',
        color: '#d4af37',
        worldX: ev.target.x,
        worldY: ev.target.y,
        createdAtMs: nowMs,
        durationMs: 1500,
      });
    } else if (ev.type === 'VESSEL_RUPTURED') {
      callouts.push({
        id: `callout-${++calloutCounter}`,
        text: 'BOILER RUPTURE!',
        color: '#e74c3c',
        worldX: ev.origin.x,
        worldY: ev.origin.y,
        createdAtMs: nowMs,
        durationMs: 1800,
      });
    } else if (ev.type === 'COAL_DUST_IGNITED') {
      callouts.push({
        id: `callout-${++calloutCounter}`,
        text: 'DEFLAGRATION!',
        color: '#e67e22',
        worldX: ev.epicenter.x,
        worldY: ev.epicenter.y,
        createdAtMs: nowMs,
        durationMs: 1400,
      });
    } else if (ev.type === 'DOOR_TOGGLED') {
      callouts.push({
        id: `callout-${++calloutCounter}`,
        text: ev.newState === 'OPEN' ? '[DOOR OPEN]' : '[DOOR CLOSED]',
        color: '#bdc3c7',
        worldX: ev.at.x,
        worldY: ev.at.y,
        createdAtMs: nowMs,
        durationMs: 900,
      });
    }
  }

  return callouts;
}

export interface FloatingTextOverlayProps {
  readonly items: readonly FloatingTextCallout[];
  readonly cameraOrigin: { readonly x: number; readonly y: number };
  readonly offsetX?: number;
  readonly offsetY?: number;
  readonly nowMs?: number;
}

export function FloatingTextOverlay({
  items,
  cameraOrigin,
  offsetX = 0,
  offsetY = 0,
  nowMs = Date.now(),
}: FloatingTextOverlayProps) {
  if (items.length === 0) return null;

  return (
    <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none' }}>
      {items.map((item) => {
        const elapsed = nowMs - item.createdAtMs;
        if (elapsed < 0 || elapsed > item.durationMs) return null;

        const progress = elapsed / item.durationMs;
        const driftPx = Math.round(progress * 24);
        const opacity = progress > 0.7 ? Math.max(0, 1 - (progress - 0.7) / 0.3) : 1;

        const screenX = (item.worldX - cameraOrigin.x + offsetX) * CELL_WIDTH_PX;
        const screenY = (item.worldY - cameraOrigin.y + offsetY) * CELL_HEIGHT_PX;

        if (screenX < 0 || screenX >= WIDESCREEN_GRID_WIDTH * CELL_WIDTH_PX) return null;
        if (screenY < 0 || screenY >= WIDESCREEN_GRID_HEIGHT * CELL_HEIGHT_PX) return null;

        return (
          <div
            key={item.id}
            style={{
              position: 'absolute',
              left: `${screenX}px`,
              top: `${Math.max(0, screenY - driftPx)}px`,
              color: item.color,
              fontSize: '11px',
              fontWeight: 'bold',
              fontFamily: '"JetBrains Mono", monospace',
              textShadow: '0 0 3px #000, 1px 1px 0 #000, -1px -1px 0 #000',
              pointerEvents: 'none',
              opacity,
              zIndex: 35,
              whiteSpace: 'nowrap',
              transform: 'translateX(-30%)',
            }}
          >
            {item.text}
          </div>
        );
      })}
    </div>
  );
}
