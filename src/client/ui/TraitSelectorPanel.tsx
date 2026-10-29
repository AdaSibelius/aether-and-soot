import { TraitId } from '../../schemas/character.schema.js';
import { TRAITS } from '../../sim/systems/character-archetypes.js';

export interface TraitSelectorPanelProps {
  readonly selectedTraits: readonly TraitId[];
  readonly onToggleTrait: (tid: TraitId) => void;
}

export function TraitSelectorPanel({
  selectedTraits,
  onToggleTrait,
}: TraitSelectorPanelProps) {
  return (
    <div style={{ border: '1px solid #23303d', padding: '10px', background: '#0d1317' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', borderBottom: '1px solid #23303d', paddingBottom: '4px' }}>
        <span class="brass-text" style={{ fontWeight: 'bold' }}>2. TRAITS &amp; QUIRKS</span>
        <span style={{ fontSize: '10px', color: selectedTraits.length === 2 ? 'var(--brass-gold)' : '#8b949e' }}>
          {selectedTraits.length} / 2 Selected
        </span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        {(Object.keys(TRAITS) as TraitId[]).map((tid) => {
          const tr = TRAITS[tid];
          const isSelected = selectedTraits.includes(tid);
          return (
            <div
              key={tid}
              onClick={() => onToggleTrait(tid)}
              style={{
                padding: '6px 8px', cursor: 'pointer',
                background: isSelected ? 'rgba(46, 204, 113, 0.15)' : '#121920',
                border: isSelected ? '1px solid #2ecc71' : '1px solid #1c2630',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold' }}>
                <span style={{ color: isSelected ? '#2ecc71' : '#c5d1d9' }}>{tr.name}</span>
                <span>{isSelected ? '[✓]' : '[ ]'}</span>
              </div>
              <div style={{ fontSize: '10px', color: '#8b949e', marginTop: '2px' }}>{tr.description}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
