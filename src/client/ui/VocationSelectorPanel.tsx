import { ProfessionId } from '../../schemas/character.schema.js';
import { formatBlueprintTooltip, humanizeIdentifier, resolveBlueprintDisplayName } from '../../sim/data/item-catalog.js';
import { ProfessionDefinition, PROFESSIONS } from '../../sim/systems/character-archetype-defs.js';

export interface VocationSelectorPanelProps {
  readonly selectedProf: ProfessionId;
  readonly profDef: ProfessionDefinition;
  readonly onSelectProf: (pid: ProfessionId) => void;
}

export function VocationSelectorPanel({
  selectedProf,
  profDef,
  onSelectProf,
}: VocationSelectorPanelProps) {
  return (
    <div style={{ border: '1px solid #23303d', padding: '10px', background: '#0d1317' }}>
      <div class="brass-text" style={{ fontWeight: 'bold', marginBottom: '8px', borderBottom: '1px solid #23303d', paddingBottom: '4px' }}>
        1. CHOOSE PROFESSION
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        {(Object.keys(PROFESSIONS) as ProfessionId[]).map((pid) => {
          const p = PROFESSIONS[pid];
          const isSelected = selectedProf === pid;
          return (
            <button
              key={pid}
              type="button"
              onClick={() => onSelectProf(pid)}
              style={{
                textAlign: 'left', padding: '6px 8px',
                background: isSelected ? 'rgba(212, 175, 55, 0.2)' : '#121920',
                border: isSelected ? '1px solid var(--brass-gold)' : '1px solid #1c2630',
                color: isSelected ? 'var(--brass-gold)' : '#c5d1d9',
              }}
            >
              <div style={{ fontWeight: 'bold' }}>{p.name}</div>
              <div style={{ fontSize: '10px', color: '#8b949e', marginTop: '2px' }}>{p.description}</div>
            </button>
          );
        })}
      </div>

      <div style={{ marginTop: '10px', padding: '6px', background: '#10171e', border: '1px dashed #23303d', fontSize: '10px' }}>
        <div class="brass-text" style={{ fontWeight: 'bold' }}>Starting Loadout:</div>
        <ul style={{ margin: '4px 0 0 16px', padding: 0 }}>
          {profDef.startingItems.map((it) => (
            <li key={it.blueprintId} title={formatBlueprintTooltip(it.blueprintId)} style={{ cursor: 'help' }}>
              {resolveBlueprintDisplayName(it.blueprintId)} (x{it.quantity})
            </li>
          ))}
          {profDef.preGraftedBlueprintId && (
            <li
              style={{ color: 'var(--brass-gold)', cursor: 'help' }}
              title={formatBlueprintTooltip(profDef.preGraftedBlueprintId)}
            >
              Pre-Grafted: {resolveBlueprintDisplayName(profDef.preGraftedBlueprintId)} ({humanizeIdentifier(profDef.preGraftedSlot ?? '')})
            </li>
          )}
          {profDef.bonusPence > 0 && <li>+{profDef.bonusPence} Pence Treasury</li>}
        </ul>
      </div>
    </div>
  );
}
