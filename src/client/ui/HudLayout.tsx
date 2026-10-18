import { useState } from 'preact/hooks';
import { GameCommand } from '../../schemas/commands.schema.js';
import { EntityIdSchema } from '../../schemas/primitives.schema.js';
import { WorldState } from '../../sim/core/world.js';
import { AnatomyDoll } from './AnatomyDoll.js';
import { CraftingPanel } from './CraftingPanel.js';
import { formatEventMessage } from './EventFormatter.js';
import { InventoryPanel } from './InventoryPanel.js';
import { MarketLedger } from './MarketLedger.js';
import { TileInspectorPanel } from './TileInspectorPanel.js';

export type HudTab = 'TELEMETRY' | 'INVENTORY' | 'SURGERY' | 'WORKBENCH' | 'EXCHANGE';

export interface HudLayoutProps {
  readonly state: Readonly<WorldState>;
  readonly onCommand: (cmd: GameCommand) => void;
  readonly hoveredTile?: { x: number; y: number } | null;
  readonly activeTab?: HudTab;
  readonly onSelectTab?: (tab: HudTab) => void;
  readonly onOpenSystemMenu?: () => void;
}

export function HudLayout({
  state,
  onCommand,
  hoveredTile = null,
  activeTab: controlledTab,
  onSelectTab: controlledSelectTab,
  onOpenSystemMenu,
}: HudLayoutProps) {
  const [internalTab, setInternalTab] = useState<HudTab>('TELEMETRY');
  const activeTab = controlledTab ?? internalTab;
  const setTab = (tab: HudTab) => {
    if (controlledSelectTab) controlledSelectTab(tab);
    else setInternalTab(tab);
  };

  const playerId = EntityIdSchema.parse('actor_player');
  const player = state.entities[playerId];
  const recentEvents = state.eventLog.slice(-5).reverse();

  return (
    <div class="hud-sidebar">
      {/* Top Navigation Drawer Tabs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '4px' }}>
        {(
          [
            ['TELEMETRY', 'TEL'],
            ['INVENTORY', 'INV[I]'],
            ['SURGERY', 'SURG[A]'],
            ['WORKBENCH', 'BENCH[C]'],
            ['EXCHANGE', 'MKT[M]'],
          ] as const
        ).map(([tabId, label]) => (
          <button
            key={tabId}
            type="button"
            onClick={() => setTab(tabId)}
            style={{
              padding: '6px 2px',
              fontSize: '10px',
              textAlign: 'center',
              background: activeTab === tabId ? '#243342' : '#11171a',
              border: activeTab === tabId ? '1px solid var(--brass-gold)' : '1px solid #2e4053',
              color: activeTab === tabId ? 'var(--brass-gold)' : '#7f8c8d',
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Tab Panels */}
      {activeTab === 'TELEMETRY' && (
        <div class="panel-box">
          <div class="panel-header" style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>TELEMETRY OVERVIEW</span>
            {onOpenSystemMenu && (
              <button
                type="button"
                onClick={onOpenSystemMenu}
                style={{ padding: '1px 5px', fontSize: '10px' }}
              >
                [Esc] Menu
              </button>
            )}
          </div>
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
              Turn {state.turnCount} (Tick #{state.macroTickCount})
            </span>
          </div>
          <div class="stat-row">
            <span>Sanguine Volume:</span>
            <span>{player?.anatomy?.bloodVolumePct ?? 0}%</span>
          </div>
          <div class="stat-row">
            <span>Boiler Steam:</span>
            <span class="copper-text">{player?.anatomy?.steamReserveKpa ?? 0} kPa</span>
          </div>
          <div class="stat-row">
            <span>Cartel Treasury:</span>
            <span class="brass-text">{state.economy.playerTreasuryPence}d</span>
          </div>

          <div class="panel-header" style={{ marginTop: '8px' }}>TACTICAL ACTIONS</div>
          <div class="button-grid">
            <button
              type="button"
              onClick={() => onCommand({ type: 'USE_PORTAL', actorId: playerId })}
            >
              [&gt;/&lt;] Traverse Portal
            </button>
            <button
              type="button"
              onClick={() =>
                onCommand({
                  type: 'REFILL_STEAM',
                  actorId: playerId,
                  pressureAddedKpa: 50,
                })
              }
            >
              [R] Stoker Boiler (+50 kPa)
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
                  pressureReleasedKpa: 25,
                });
              }}
            >
              [V] Vent Boiler (25 kPa)
            </button>
            <button
              type="button"
              onClick={() => onCommand({ type: 'WAIT_TURN', actorId: playerId })}
            >
              [Space] Wait 1 Turn
            </button>
          </div>
        </div>
      )}

      {activeTab === 'INVENTORY' && (
        <InventoryPanel state={state} actorId={playerId} onCommand={onCommand} />
      )}

      {activeTab === 'SURGERY' && (
        <div class="panel-box">
          <div class="panel-header">PROSTHETIC SURGERY &amp; ANATOMY [A]</div>
          <AnatomyDoll anatomy={player?.anatomy} />
        </div>
      )}

      {activeTab === 'WORKBENCH' && (
        <CraftingPanel state={state} actorId={playerId} onCommand={onCommand} />
      )}

      {activeTab === 'EXCHANGE' && (
        <MarketLedger economy={state.economy} onCommand={onCommand} />
      )}

      {/* Canvas Tile Inspector */}
      <TileInspectorPanel
        state={state}
        actorId={playerId}
        tile={hoveredTile}
        onCommand={onCommand}
        onSelectTab={setTab}
      />

      {/* Action Chronicle Log */}
      <div class="panel-box log-box">
        <div class="panel-header">ACTION CHRONICLE</div>
        {recentEvents.length === 0 ? (
          <div class="log-entry muted">Awaiting pneumatic actuation...</div>
        ) : (
          recentEvents.map((ev, idx) => (
            <div key={`${ev.type}-${ev.turn}-${idx}`} class="log-entry">
              {formatEventMessage(ev)}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
