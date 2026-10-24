import { GameCommand } from '../../schemas/commands.schema.js';
import { EntityIdSchema } from '../../schemas/primitives.schema.js';
import { WorldState } from '../../sim/core/world.js';
import { resolveCatalogDisplayName } from '../projection/frame-adapter.js';
import { ModalWindowId } from './CharacterModalShell.js';
import { formatEventMessage } from './EventFormatter.js';
import { MorgueModal } from './MorgueModal.js';
import { TileInspectorPanel } from './TileInspectorPanel.js';

export interface HudLayoutProps {
  readonly state: Readonly<WorldState>;
  readonly onCommand: (cmd: GameCommand) => void;
  readonly hoveredTile?: { x: number; y: number } | null;
  readonly onOpenModal?: (window: ModalWindowId) => void;
  readonly onOpenSystemMenu?: () => void;
  readonly onReEmbark?: () => void;
}

export function HudLayout({
  state,
  onCommand,
  hoveredTile = null,
  onOpenModal,
  onOpenSystemMenu,
  onReEmbark,
}: HudLayoutProps) {
  const playerId = EntityIdSchema.parse('actor_player');
  const player = state.entities[playerId];
  const pos = player?.position;
  const recentEvents = state.eventLog.slice(-5).reverse();

  // Find nearby visible entities on the current stratum within Chebyshev radius 8
  const nearbyEntities = Object.values(state.entities)
    .filter((ent) => {
      if (!ent.position || !pos || ent.id === playerId) return false;
      if (ent.position.stratum !== pos.stratum) return false;
      const dist = Math.max(Math.abs(ent.position.x - pos.x), Math.abs(ent.position.y - pos.y));
      return dist <= 8;
    })
    .slice(0, 4);

  const bloodPct = Math.max(0, Math.min(100, player?.anatomy?.bloodVolumePct ?? 0));
  const steamKpa = player?.anatomy?.steamReserveKpa ?? 0;
  const steamPct = Math.max(0, Math.min(100, (steamKpa / 200) * 100));

  return (
    <div class="hud-sidebar">
      {/* District & Chronometer Header */}
      <div class="panel-box">
        <div class="panel-header" style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span>TACTICAL TELEMETRY</span>
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
          <span>District:</span>
          <span class="brass-text" style={{ fontSize: '11px' }}>
            {resolveCatalogDisplayName('district', state.currentDistrictId ?? 'district_spitalfields_soot_works')}
          </span>
        </div>
        <div class="stat-row">
          <span>Stratum:</span>
          <span class="copper-text">{pos?.stratum ?? 'STREET'}</span>
        </div>
        <div class="stat-row">
          <span>Position:</span>
          <span>
            ({pos?.x ?? 0}, {pos?.y ?? 0})
          </span>
        </div>
        <div class="stat-row">
          <span>Chronometer:</span>
          <span>
            Turn {state.turnCount} (Tick #{state.macroTickCount})
          </span>
        </div>
      </div>

      {/* Sanguine & Steam Reserves */}
      <div class="panel-box">
        <div class="panel-header">VITALS &amp; ENERGY RESERVES</div>
        <div style={{ marginBottom: '6px' }}>
          <div class="stat-row" style={{ fontSize: '11px' }}>
            <span>Sanguine Volume:</span>
            <span class={bloodPct < 40 ? 'warn-text' : 'ok-text'}>{bloodPct}%</span>
          </div>
          <div style={{ background: '#1a0d0d', height: '6px', border: '1px solid #4a1515' }}>
            <div
              style={{
                background: bloodPct < 40 ? '#ec7063' : '#e74c3c',
                width: `${bloodPct}%`,
                height: '100%',
              }}
            />
          </div>
        </div>

        <div style={{ marginBottom: '6px' }}>
          <div class="stat-row" style={{ fontSize: '11px' }}>
            <span>Boiler Pressure:</span>
            <span class="copper-text">{steamKpa} / 200 kPa</span>
          </div>
          <div style={{ background: '#1c150c', height: '6px', border: '1px solid #5a3c1e' }}>
            <div
              style={{
                background: '#cd7f32',
                width: `${steamPct}%`,
                height: '100%',
              }}
            />
          </div>
        </div>

        <div class="stat-row">
          <span>Cartel Treasury:</span>
          <span class="brass-text">{state.economy.playerTreasuryPence}d</span>
        </div>
      </div>

      {/* Nearby Detected Entities */}
      <div class="panel-box">
        <div class="panel-header">PROXIMITY RADAR</div>
        {nearbyEntities.length === 0 ? (
          <div class="log-entry muted">No acoustic signals in immediate proximity.</div>
        ) : (
          nearbyEntities.map((ent) => {
            const dx = Math.abs((ent.position?.x ?? 0) - (pos?.x ?? 0));
            const dy = Math.abs((ent.position?.y ?? 0) - (pos?.y ?? 0));
            const dist = Math.max(dx, dy);

            if (ent.aiController) {
              const actorName = ent.name ?? resolveCatalogDisplayName('actor', ent.id);
              const isHostile = Boolean(ent.aiController.hostile);
              return (
                <div key={ent.id} class="stat-row" style={{ fontSize: '11px', alignItems: 'center' }}>
                  <span style={{ display: 'flex', alignItems: 'center', overflow: 'hidden' }}>
                    <span
                      style={{
                        fontSize: '9px',
                        padding: '1px 4px',
                        marginRight: '6px',
                        border: isHostile ? '1px solid #ec7063' : '1px solid var(--brass-gold)',
                        color: isHostile ? '#ec7063' : 'var(--brass-gold)',
                        borderRadius: '2px',
                        flexShrink: 0,
                      }}
                    >
                      {ent.aiController.role}
                    </span>
                    <span style={{ color: isHostile ? '#ec7063' : '#d5dbdb', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {actorName}
                    </span>
                  </span>
                  <span class="muted" style={{ flexShrink: 0, marginLeft: '6px' }}>{dist}m</span>
                </div>
              );
            }

            const label = ent.item
              ? `Item: ${ent.name ?? resolveCatalogDisplayName('item', ent.item.blueprintId)}`
              : ent.portal
                ? `Portal: ${ent.portal.portalLabel}`
                : (ent.name ?? ent.landmark?.label ?? resolveCatalogDisplayName('landmark', ent.id));

            return (
              <div key={ent.id} class="stat-row" style={{ fontSize: '11px' }}>
                <span style={{ color: '#d5dbdb', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {label}
                </span>
                <span class="muted" style={{ flexShrink: 0, marginLeft: '6px' }}>{dist}m</span>
              </div>
            );
          })
        )}
      </div>

      {/* Canvas Tile Inspector */}
      <TileInspectorPanel
        state={state}
        actorId={playerId}
        tile={hoveredTile}
        onCommand={onCommand}
        onSelectTab={(tab) => {
          if (!onOpenModal) return;
          if (tab === 'EXCHANGE') onOpenModal('EXCHANGE');
          else if (tab === 'INVENTORY') onOpenModal('INVENTORY');
          else if (tab === 'SURGERY') onOpenModal('ANATOMY');
          else if (tab === 'WORKBENCH') onOpenModal('WORKBENCH');
        }}
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

      <MorgueModal
        state={state}
        onReEmbark={() => {
          if (onReEmbark) onReEmbark();
          else if (onOpenSystemMenu) onOpenSystemMenu();
        }}
      />
    </div>
  );
}
