import { useState } from 'preact/hooks';
import { AtlasViewMode } from '../../schemas/atlas.schema.js';
import { GameCommand } from '../../schemas/commands.schema.js';
import { EntityId, StratumId } from '../../schemas/primitives.schema.js';
import { WorldState } from '../../sim/core/world.js';
import { resolveCatalogDisplayName } from '../projection/frame-adapter.js';
import { AtlasDossierView } from './AtlasDossierView.js';
import { AtlasMinimapView } from './AtlasMinimapView.js';
import { AtlasOverworldView } from './AtlasOverworldView.js';

export interface AtlasWindowProps {
  readonly state: Readonly<WorldState>;
  readonly actorId: EntityId;
  readonly onCommand: (cmd: GameCommand) => void;
}

const TABS: readonly { mode: AtlasViewMode; label: string }[] = [
  { mode: 'MINIMAP', label: '[1] Local Minimap' },
  { mode: 'TOPOGRAPHY', label: '[2] Topography' },
  { mode: 'WATERWAYS', label: '[3] Waterways' },
  { mode: 'FACTIONS', label: '[4] Factions' },
  { mode: 'MONORAILS', label: '[5] Monorails' },
  { mode: 'DOSSIERS', label: '[6] Dossiers' },
];

export function AtlasWindow({ state, actorId, onCommand }: AtlasWindowProps) {
  const player = state.entities[actorId];
  const playerPos = player?.position;
  const currentDistrict = state.currentDistrictId ?? 'district_spitalfields_soot_works';

  const [activeTab, setActiveTab] = useState<AtlasViewMode>('MINIMAP');
  const [selectedStratum, setSelectedStratum] = useState<StratumId>(playerPos?.stratum ?? 'STREET');

  // Detect if player is adjacent to any district transit gate
  const adjacentGate = playerPos
    ? Object.values(state.entities).find((e) => {
        if (!e.districtGate || !e.position || e.position.stratum !== playerPos.stratum) return false;
        return Math.max(Math.abs(e.position.x - playerPos.x), Math.abs(e.position.y - playerPos.y)) <= 1;
      })
    : undefined;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: '10px' }}>
      {/* Top Navigation Tabs */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #1c2833', paddingBottom: '6px' }}>
        <div style={{ display: 'flex', gap: '6px' }}>
          {TABS.map((t) => {
            const isActive = activeTab === t.mode;
            return (
              <button
                key={t.mode}
                type="button"
                onClick={() => setActiveTab(t.mode)}
                style={{
                  padding: '4px 10px',
                  fontSize: '11px',
                  fontWeight: isActive ? 'bold' : 'normal',
                  background: isActive ? '#1c2833' : 'transparent',
                  border: isActive ? '1px solid var(--brass-gold)' : '1px solid #2e4053',
                  color: isActive ? 'var(--brass-gold)' : '#7f8c8d',
                }}
              >
                {t.label}
              </button>
            );
          })}
        </div>
        <div style={{ fontSize: '10px', color: '#95a5a6' }}>
          Current: <span class="brass-text">{resolveCatalogDisplayName('district', currentDistrict)}</span>
        </div>
      </div>

      {/* Main Body Area */}
      <div style={{ flex: 1, minHeight: 0 }}>
        {activeTab === 'MINIMAP' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '14px', height: '100%' }}>
            <div class="panel-box" style={{ minHeight: 0 }}>
              <AtlasMinimapView
                state={state}
                selectedStratum={selectedStratum}
                onSelectStratum={setSelectedStratum}
                playerPos={playerPos}
                actorId={actorId}
              />
            </div>
            <div class="panel-box" style={{ minHeight: 0 }}>
              <AtlasDossierView
                state={state}
                actorId={actorId}
                onCommand={onCommand}
                adjacentGate={adjacentGate}
              />
            </div>
          </div>
        )}

        {(activeTab === 'TOPOGRAPHY' || activeTab === 'WATERWAYS' || activeTab === 'FACTIONS' || activeTab === 'MONORAILS') && (
          <div class="panel-box" style={{ height: '100%', minHeight: 0 }}>
            <AtlasOverworldView mode={activeTab} currentDistrictId={currentDistrict} />
          </div>
        )}

        {activeTab === 'DOSSIERS' && (
          <div class="panel-box" style={{ height: '100%', minHeight: 0 }}>
            <AtlasDossierView
              state={state}
              actorId={actorId}
              onCommand={onCommand}
              adjacentGate={adjacentGate}
            />
          </div>
        )}
      </div>
    </div>
  );
}
