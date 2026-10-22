import { useState } from 'preact/hooks';
import { GameCommand } from '../../schemas/commands.schema.js';
import { EntityRecord } from '../../schemas/components.schema.js';
import { EntityId } from '../../schemas/primitives.schema.js';
import { WorldState } from '../../sim/core/world.js';
import { getAllDistrictDossiers, getDistrictDossier } from '../../sim/spatial/overworld-matrix.js';

export interface AtlasDossierViewProps {
  readonly state: Readonly<WorldState>;
  readonly actorId: EntityId;
  readonly onCommand: (cmd: GameCommand) => void;
  readonly adjacentGate?: EntityRecord | undefined;
}

export function AtlasDossierView({
  state,
  actorId,
  onCommand,
  adjacentGate,
}: AtlasDossierViewProps) {
  const currentDistrict = state.currentDistrictId ?? 'district_spitalfields_soot_works';
  const [selectedDistrictId, setSelectedDistrictId] = useState<string>(currentDistrict);

  const allDossiers = getAllDistrictDossiers();
  const activeDossier = getDistrictDossier(selectedDistrictId) ?? allDossiers[0];

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.3fr', gap: '10px', height: '100%', minHeight: 0 }}>
      {/* Left Column: District Selector */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', overflow: 'auto' }}>
        <div class="panel-header" style={{ margin: 0, border: 'none' }}>METROPOLIS DISTRICTS</div>
        {allDossiers.map((d) => {
          const isSelected = d.id === selectedDistrictId;
          const isCurrent = d.id === currentDistrict;
          const isVisited = Boolean(state.savedDistricts[d.id]);
          const canTravel = adjacentGate?.districtGate?.targetDistrictId === d.id;

          return (
            <div
              key={d.id}
              onClick={() => setSelectedDistrictId(d.id)}
              style={{
                padding: '6px 8px',
                background: isSelected ? '#16222f' : '#0d1316',
                border: isSelected ? '1px solid var(--brass-gold)' : '1px solid #1c2833',
                cursor: 'pointer',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span class={isSelected ? 'brass-text' : 'parchment-text'} style={{ fontWeight: 'bold', fontSize: '11px' }}>
                  {d.name}
                </span>
                {isCurrent && <span style={{ fontSize: '9px', color: 'var(--ok-green)', fontWeight: 'bold' }}>[@ HERE]</span>}
                {!isCurrent && isVisited && <span style={{ fontSize: '9px', color: '#5dade2' }}>[VISITED]</span>}
              </div>
              <div style={{ fontSize: '9px', color: '#7f8c8d', marginTop: '2px' }}>
                Stratum: <b>{d.dominantStratum}</b> | Cartel: {d.cartel}
              </div>
              {canTravel && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onCommand({ type: 'TRAVEL_DISTRICT', actorId, targetDistrictId: d.id });
                  }}
                  style={{ marginTop: '4px', padding: '2px 6px', fontSize: '9px', color: 'var(--brass-gold)' }}
                >
                  [Fast-Travel Transit Gate &gt;&gt;]
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* Right Column: Selected District Landmark Dossier */}
      {activeDossier && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', overflow: 'auto', background: '#090e11', padding: '8px', border: '1px solid #1c2833' }}>
          <div style={{ borderBottom: '1px solid #1c2833', paddingBottom: '4px' }}>
            <div class="brass-text" style={{ fontSize: '12px', fontWeight: 'bold' }}>{activeDossier.name}</div>
            <div style={{ fontSize: '10px', color: '#95a5a6', marginTop: '2px' }}>{activeDossier.description}</div>
            <div style={{ fontSize: '9px', color: '#7f8c8d', marginTop: '3px' }}>
              Smog: <b>{activeDossier.smog}</b> | Wealth: <b>x{activeDossier.wealthIndex}</b> | Natural Barriers: {activeDossier.naturalBarriers.join(', ')}
            </div>
          </div>

          <div class="panel-header" style={{ margin: '4px 0 0 0', border: 'none', fontSize: '10px' }}>KEY LANDMARK DOSSIERS</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {activeDossier.landmarks.map((lm) => (
              <div key={lm.id} style={{ padding: '6px', background: '#0e161a', border: '1px solid #17202a' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontWeight: 'bold', fontSize: '10px', color: '#d4af37' }}>{lm.name}</span>
                  <span style={{ fontSize: '8px', color: lm.status === 'OPERATIONAL' ? 'var(--ok-green)' : '#ec7063' }}>
                    [{lm.status}]
                  </span>
                </div>
                <div style={{ fontSize: '9px', color: '#7f8c8d', margin: '2px 0' }}>
                  Category: <b>{lm.category}</b> | Stratum: <b>{lm.stratum}</b>
                </div>
                <div style={{ fontSize: '9px', color: '#95a5a6' }}>{lm.description}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
