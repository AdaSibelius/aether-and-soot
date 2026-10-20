import { useEffect } from 'preact/hooks';
import { WorldState } from '../../sim/core/world.js';
import { isActorFatal } from '../../sim/systems/mortality.system.js';

export interface MorgueModalProps {
  state: WorldState;
  onReEmbark: () => void;
}

export function MorgueModal({ state, onReEmbark }: MorgueModalProps) {
  const player = state.entities['actor_player'];
  const isFatal = isActorFatal(player);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'n' || e.key === 'N' || e.key === 'Enter') {
        e.preventDefault();
        onReEmbark();
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onReEmbark]);

  if (!isFatal) return null;

  const anatomy = player?.anatomy;
  const torso = anatomy?.limbs.TORSO;
  const head = anatomy?.limbs.HEAD;
  const blood = anatomy?.bloodVolumePct ?? 0;

  // Determine fatal pathology
  const fatalCauses: string[] = [];
  if ((torso?.hp ?? 0) <= 0) fatalCauses.push('Catastrophic Thoracic Rupture / Crushed Torso');
  if ((head?.hp ?? 0) <= 0) fatalCauses.push('Fatal Cranial Trauma / Decapitation');
  if (blood <= 0) fatalCauses.push('Severe Acute Exsanguination (Total Blood Loss)');
  if (fatalCauses.length === 0) fatalCauses.push('Systemic Pneumatic Collapse');

  const carriedCount = player?.inventory?.containedEntityIds.length ?? 0;
  const installedCount = Object.values(anatomy?.limbs ?? {}).filter((l) => l?.installedProstheticEntityId).length;

  return (
    <div
      class="modal-backdrop"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(5, 7, 8, 0.92)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
        padding: '20px',
      }}
    >
      <div
        class="morgue-card"
        style={{
          width: '540px',
          maxWidth: '95vw',
          backgroundColor: '#0c0f12',
          border: '2px solid #922b21',
          boxShadow: '0 0 30px rgba(146, 43, 33, 0.45)',
          padding: '24px',
          color: '#d5dbdb',
          fontFamily: 'monospace',
          lineHeight: '1.4',
        }}
      >
        <div style={{ textAlign: 'center', borderBottom: '1px solid #78281f', paddingBottom: '12px' }}>
          <div style={{ color: '#e74c3c', fontSize: '11px', letterSpacing: '2px', fontWeight: 'bold' }}>
            HM CORONER'S COURT OF THE METROPOLIS
          </div>
          <div style={{ color: '#f5b7b1', fontSize: '16px', fontWeight: 'bold', margin: '4px 0' }}>
            INQUEST &amp; POST-MORTEM VERDICT
          </div>
          <div style={{ color: '#7f8c8d', fontSize: '11px' }}>
            Whitechapel Parish Morgue &bull; Necrological Registry
          </div>
        </div>

        <div style={{ margin: '16px 0', border: '1px solid #2c3e50', padding: '12px', background: '#080a0c' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
            <span style={{ color: '#85929e' }}>DECEASED:</span>
            <span style={{ color: '#f39c12', fontWeight: 'bold' }}>{player?.name ?? 'Unknown Automaton'}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
            <span style={{ color: '#85929e' }}>VOCATION:</span>
            <span style={{ color: '#d5dbdb' }}>{player?.profession ?? 'DISOWNED_APPRENTICE'}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
            <span style={{ color: '#85929e' }}>TIME OF DEMISE:</span>
            <span style={{ color: '#d5dbdb' }}>Turn {state.turnCount}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: '#85929e' }}>LOCATION:</span>
            <span style={{ color: '#d5dbdb' }}>
              {player?.position?.stratum ?? 'STREET'} ({player?.position?.x ?? 0}, {player?.position?.y ?? 0})
            </span>
          </div>
        </div>

        <div style={{ marginBottom: '16px' }}>
          <div style={{ color: '#e74c3c', fontSize: '12px', fontWeight: 'bold', marginBottom: '6px' }}>
            ANATOMICAL PATHOLOGY:
          </div>
          <div style={{ color: '#ec7063', fontSize: '12px', marginBottom: '8px' }}>
            {fatalCauses.join('; ')}
          </div>
          <div style={{ fontSize: '11px', color: '#7f8c8d' }}>
            Residual Haemoglobin: {blood}% &bull; Carried Artifacts: {carriedCount} &bull; Augmented Cybernetics: {installedCount}
          </div>
        </div>

        <div style={{ textAlign: 'center', marginTop: '20px', borderTop: '1px solid #78281f', paddingTop: '16px' }}>
          <button
            onClick={onReEmbark}
            style={{
              backgroundColor: '#922b21',
              color: '#ffffff',
              border: '1px solid #e74c3c',
              padding: '10px 20px',
              fontSize: '13px',
              fontFamily: 'monospace',
              fontWeight: 'bold',
              cursor: 'pointer',
              letterSpacing: '1px',
            }}
          >
            [New Character / Re-Embark (N)]
          </button>
        </div>
      </div>
    </div>
  );
}
