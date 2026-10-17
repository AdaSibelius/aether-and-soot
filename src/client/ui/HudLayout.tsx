import { GameCommand } from '../../schemas/commands.schema.js';
import { SimEvent } from '../../schemas/events.schema.js';
import { EntityIdSchema } from '../../schemas/primitives.schema.js';
import { WorldState } from '../../sim/core/world.js';
import { AnatomyDoll } from './AnatomyDoll.js';

export interface HudLayoutProps {
  readonly state: Readonly<WorldState>;
  readonly onCommand: (cmd: GameCommand) => void;
}

function formatEventMessage(ev: SimEvent): string {
  switch (ev.type) {
    case 'ENTITY_MOVED':
      return `[T${ev.turn}] Stepped to (${ev.to.x}, ${ev.to.y}) on ${ev.to.stratum} [${ev.apSpent} AP]`;
    case 'MOVEMENT_BLOCKED':
      return `[T${ev.turn}] Movement blocked (${ev.reason}) at (${ev.target.x}, ${ev.target.y})`;
    case 'STRATUM_CHANGED':
      return `[T${ev.turn}] Traversed portal: ${ev.fromStratum} -> ${ev.toStratum}`;
    case 'PORTAL_FAILED':
      return `[T${ev.turn}] Portal traversal failed: ${ev.reason}`;
    case 'ACTOR_WAITED':
      return `[T${ev.turn}] Artificer holds position and checks pressure gauges.`;
    case 'STEAM_VENTED':
      return `[T${ev.turn}] Vented ${ev.pressureReleasedKpa} kPa superheated steam!`;
    case 'MACRO_TICK_COMPLETED':
      return `[T${ev.turn}] === District Macro-Tick #${ev.macroTickIndex} Processed ===`;
  }
}

export function HudLayout({ state, onCommand }: HudLayoutProps) {
  const playerId = EntityIdSchema.parse('actor_player');
  const player = state.entities[playerId];
  const recentEvents = state.eventLog.slice(-8).reverse();

  return (
    <div class="hud-sidebar">
      <div class="panel-box">
        <div class="panel-header">AETHER &amp; SOOT // TELEMETRY</div>
        <div class="stat-row">
          <span>Stratum:</span>
          <span class="brass-text">{player?.position?.stratum ?? 'STREET'}</span>
        </div>
        <div class="stat-row">
          <span>Coordinates:</span>
          <span>
            ({player?.position?.x ?? 0}, {player?.position?.y ?? 0})
          </span>
        </div>
        <div class="stat-row">
          <span>Chronometer:</span>
          <span>
            Turn {state.turnCount} | Macro #{state.macroTickCount}
          </span>
        </div>
        <div class="stat-row">
          <span>Actor Energy:</span>
          <span>{player?.actor?.energy ?? 0} AP</span>
        </div>
      </div>

      <AnatomyDoll anatomy={player?.anatomy} />

      <div class="panel-box">
        <div class="panel-header">TACTICAL CONTROLS</div>
        <div class="button-grid">
          <button
            type="button"
            onClick={() => onCommand({ type: 'USE_PORTAL', actorId: playerId })}
          >
            [&gt;/&lt;] Traverse Portal
          </button>
          <button
            type="button"
            onClick={() => onCommand({ type: 'WAIT_TURN', actorId: playerId })}
          >
            [.] Wait Turn
          </button>
          <button
            type="button"
            onClick={() => {
              if (!player?.position) return;
              onCommand({
                type: 'VENT_STEAM',
                actorId: playerId,
                target: {
                  x: player.position.x,
                  y: player.position.y,
                  stratum: player.position.stratum,
                },
                pressureReleasedKpa: 45,
              });
            }}
          >
            [V] Vent Boiler Steam
          </button>
        </div>
      </div>

      <div class="panel-box log-box">
        <div class="panel-header">CHRONICLE LOG</div>
        {recentEvents.length === 0 ? (
          <div class="log-entry muted">Awaiting pneumatic actuation...</div>
        ) : (
          recentEvents.map((ev, idx) => (
            <div key={`${ev.turn}-${idx}`} class="log-entry">
              {formatEventMessage(ev)}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
