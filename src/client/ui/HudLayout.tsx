import { GameCommand } from '../../schemas/commands.schema.js';
import { EntityIdSchema } from '../../schemas/primitives.schema.js';
import { WorldState } from '../../sim/core/world.js';
import { resolveCatalogDisplayName } from '../projection/frame-adapter.js';
import { ModalWindowId } from './CharacterModalShell.js';
import { aggregateChronicleEvents } from './EventFormatter.js';
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
  const chronicleLines = aggregateChronicleEvents(state.eventLog, 5).reverse();

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
  const maxSteamKpa = player?.anatomy?.maxSteamReserveKpa ?? 100;
  const steamRatio = maxSteamKpa > 0 ? steamKpa / maxSteamKpa : 0;
  const strainKw = player?.anatomy?.strainLoadKw ?? 0;
  const governorCapKw = player?.anatomy?.governorCapacityKw ?? 100;
  const strainRatio = governorCapKw > 0 ? strainKw / governorCapKw : 0;

  const renderSegmentedBar = (ratio: number, totalChars = 14): string => {
    const clamped = Math.max(0, Math.min(1, ratio));
    const filled = Math.round(clamped * totalChars);
    return '█'.repeat(filled) + '░'.repeat(totalChars - filled);
  };

  return (
    <div class="hud-sidebar">
      {/* Tactical Telemetry */}
      <div class="panel-box">
        <div class="panel-header">
          <span>╔═[ TACTICAL TELEMETRY ]═╗</span>
          {onOpenSystemMenu && (
            <button
              type="button"
              onClick={onOpenSystemMenu}
              style={{ padding: '1px 5px', fontSize: '10px' }}
            >
              [Esc]
            </button>
          )}
        </div>
        <div class="stat-row">
          <span class="muted">District:</span>
          <span class="brass-text" style={{ fontSize: '11px', fontWeight: 'bold' }}>
            {resolveCatalogDisplayName('district', state.currentDistrictId ?? 'district_spitalfields_soot_works')}
          </span>
        </div>
        <div class="stat-row">
          <span class="muted">Stratum:</span>
          <span class="copper-text">{pos?.stratum ?? 'STREET'}</span>
        </div>
        <div class="stat-row">
          <span class="muted">Coordinates:</span>
          <span class="parchment">
            ({pos?.x ?? 0}, {pos?.y ?? 0})
          </span>
        </div>
        <div class="stat-row">
          <span class="muted">Chronometer:</span>
          <span>
            Turn {state.turnCount} <span class="muted">(Tick #{state.macroTickCount})</span>
          </span>
        </div>
      </div>

      {/* Vitals & Energy Reserves with CP437 Segmented Gauges */}
      <div class="panel-box">
        <div class="panel-header">
          <span>╔═[ VITALS &amp; RESERVES ]═╗</span>
          <span class="brass-text" style={{ fontSize: '10px' }}>{state.economy.playerTreasuryPence}d</span>
        </div>
        
        {/* Sanguine Volume Bar */}
        <div style={{ marginBottom: '4px' }}>
          <div class="stat-row" style={{ fontSize: '10px' }}>
            <span class="muted">Sanguine:</span>
            <span class={bloodPct < 40 ? 'warn-text' : 'ok-text'}>{bloodPct}%</span>
          </div>
          <div style={{ fontSize: '11px', letterSpacing: '0.04em', color: bloodPct < 40 ? 'var(--warn-red)' : 'var(--ok-green)' }}>
            [{renderSegmentedBar(bloodPct / 100, 16)}]
          </div>
        </div>

        {/* Boiler Pressure Bar */}
        <div style={{ marginBottom: '4px' }}>
          <div class="stat-row" style={{ fontSize: '10px' }}>
            <span class="muted">Boiler:</span>
            <span class="copper-text">{steamKpa} / {maxSteamKpa} kPa</span>
          </div>
          <div style={{ fontSize: '11px', letterSpacing: '0.04em', color: steamRatio >= 0.85 ? 'var(--warn-red)' : 'var(--oxidized-copper)' }}>
            [{renderSegmentedBar(steamRatio, 16)}]
          </div>
        </div>

        {/* Governor Strain Bar */}
        {strainKw > 0 && (
          <div style={{ marginBottom: '4px' }}>
            <div class="stat-row" style={{ fontSize: '10px' }}>
              <span class="muted">Governor Strain:</span>
              <span class="warn-text">{strainKw} / {governorCapKw} kW</span>
            </div>
            <div style={{ fontSize: '11px', letterSpacing: '0.04em', color: strainRatio >= 0.75 ? 'var(--warn-red)' : '#f39c12' }}>
              [{renderSegmentedBar(strainRatio, 16)}]
            </div>
          </div>
        )}
      </div>

      {/* Nearby Acoustic Proximity Radar */}
      <div class="panel-box">
        <div class="panel-header">╔═[ PROXIMITY RADAR ]═╗</div>
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
                        padding: '0 3px',
                        marginRight: '5px',
                        border: isHostile ? '1px solid var(--warn-red)' : '1px solid var(--brass-gold)',
                        color: isHostile ? 'var(--warn-red)' : 'var(--brass-gold)',
                        borderRadius: '1px',
                        flexShrink: 0,
                      }}
                    >
                      {ent.aiController.role}
                    </span>
                    <span style={{ color: isHostile ? 'var(--warn-red)' : '#d5dbdb', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
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

      {/* Action Chronicle Pneumatic Ticker */}
      <div class="panel-box log-box">
        <div class="panel-header">╔═[ PNEUMATIC CHRONICLE ]═╗</div>
        {chronicleLines.length === 0 ? (
          <div class="log-entry muted">Awaiting pneumatic actuation...</div>
        ) : (
          chronicleLines.map((line, idx) => (
            <div key={`chronicle-${idx}`} class="log-entry">
              <span style={{ color: '#d4af37', marginRight: '4px' }}>»</span>
              {line}
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
