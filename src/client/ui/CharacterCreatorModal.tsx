import { useState } from 'preact/hooks';
import { CharacterCreationConfig, ProfessionId, ScenarioId, TraitId } from '../../schemas/character.schema.js';
import { PROFESSIONS, SCENARIOS, TRAITS } from '../../sim/systems/character-archetypes.js';

export interface CharacterCreatorModalProps {
  readonly isOpen: boolean;
  readonly initialSeed?: number;
  readonly onClose: () => void;
  readonly onEmbark: (config: CharacterCreationConfig, seed: number) => void;
}

export function CharacterCreatorModal({
  isOpen,
  initialSeed = 0xcafebabe,
  onClose,
  onEmbark,
}: CharacterCreatorModalProps) {
  if (!isOpen) return null;

  const [name, setName] = useState('Artificer Thorne');
  const [selectedProf, setSelectedProf] = useState<ProfessionId>('DISGRACED_CHIRURGEON');
  const [selectedTraits, setSelectedTraits] = useState<TraitId[]>(['NIGHT_OPTICS', 'BOILER_HEART']);
  const [selectedScenario, setSelectedScenario] = useState<ScenarioId>('SPITALFIELDS_FOUNDRY_ROW');
  const [seed, setSeed] = useState<number>(initialSeed);

  const toggleTrait = (tid: TraitId) => {
    if (selectedTraits.includes(tid)) {
      setSelectedTraits(selectedTraits.filter((t) => t !== tid));
    } else if (selectedTraits.length < 2) {
      setSelectedTraits([...selectedTraits, tid]);
    }
  };

  const profDef = PROFESSIONS[selectedProf];
  const scenDef = SCENARIOS[selectedScenario];

  const handleEmbark = () => {
    onEmbark(
      {
        name: name.trim() || 'Artificer Thorne',
        professionId: selectedProf,
        traitIds: selectedTraits,
        scenarioId: selectedScenario,
        seed,
      },
      seed,
    );
    onClose();
  };

  return (
    <div
      style={{
        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
        backgroundColor: 'rgba(5, 8, 10, 0.92)', display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 1200, padding: '16px', boxSizing: 'border-box',
      }}
      onClick={onClose}
    >
      <div
        class="panel-box"
        style={{
          width: '920px', maxWidth: '96vw', maxHeight: '92vh', overflowY: 'auto',
          border: '2px solid var(--brass-gold)', background: '#0a0e11',
          boxShadow: '0 0 35px rgba(212, 175, 55, 0.35)', padding: '14px',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div class="panel-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
          <span style={{ fontSize: '13px', fontWeight: 'bold' }}>CHARACTER DOSSIER &amp; STARTING SCENARIO ARCHIVE</span>
          <button type="button" onClick={onClose} style={{ padding: '2px 8px' }}>[X]</button>
        </div>

        {/* 3-Column CDDA Layout */}
        <div style={{ display: 'grid', gridTemplateColumns: '1.1fr 1fr 1.1fr', gap: '12px', fontSize: '11px' }}>
          
          {/* Column 1: Profession */}
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
                    onClick={() => setSelectedProf(pid)}
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
                  <li key={it.blueprintId}>{it.blueprintId} (x{it.quantity})</li>
                ))}
                {profDef.preGraftedBlueprintId && (
                  <li style={{ color: 'var(--brass-gold)' }}>Pre-Grafted: {profDef.preGraftedBlueprintId} ({profDef.preGraftedSlot})</li>
                )}
                {profDef.bonusPence > 0 && <li>+{profDef.bonusPence} Pence Treasury</li>}
              </ul>
            </div>
          </div>

          {/* Column 2: Traits */}
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
                    onClick={() => toggleTrait(tid)}
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

          {/* Column 3: Scenario & Embark */}
          <div style={{ border: '1px solid #23303d', padding: '10px', background: '#0d1317', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
            <div>
              <div class="brass-text" style={{ fontWeight: 'bold', marginBottom: '8px', borderBottom: '1px solid #23303d', paddingBottom: '4px' }}>
                3. STARTING SCENARIO
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '10px' }}>
                {(Object.keys(SCENARIOS) as ScenarioId[]).map((sid) => {
                  const s = SCENARIOS[sid];
                  const isSelected = selectedScenario === sid;
                  return (
                    <button
                      key={sid}
                      type="button"
                      onClick={() => setSelectedScenario(sid)}
                      style={{
                        textAlign: 'left', padding: '6px 8px',
                        background: isSelected ? 'rgba(52, 152, 219, 0.2)' : '#121920',
                        border: isSelected ? '1px solid #3498db' : '1px solid #1c2630',
                        color: isSelected ? '#3498db' : '#c5d1d9',
                      }}
                    >
                      <div style={{ fontWeight: 'bold' }}>{s.name} ({s.stratum})</div>
                      <div style={{ fontSize: '10px', color: '#8b949e', marginTop: '2px' }}>{s.description}</div>
                    </button>
                  );
                })}
              </div>

              {/* Character Name & Seed Inputs */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '10px' }}>
                <div>
                  <div style={{ color: '#8b949e', fontSize: '10px', marginBottom: '2px' }}>Character Name:</div>
                  <input
                    type="text"
                    value={name}
                    onInput={(e) => setName((e.target as HTMLInputElement).value)}
                    style={{ width: '100%', boxSizing: 'border-box', background: '#121920', border: '1px solid #23303d', color: '#c5d1d9', padding: '4px 6px' }}
                  />
                </div>
                <div>
                  <div style={{ color: '#8b949e', fontSize: '10px', marginBottom: '2px' }}>World Seed:</div>
                  <div style={{ display: 'flex', gap: '4px' }}>
                    <input
                      type="number"
                      value={seed}
                      onInput={(e) => setSeed(parseInt((e.target as HTMLInputElement).value, 10) || 0)}
                      style={{ flex: 1, background: '#121920', border: '1px solid #23303d', color: 'var(--brass-gold)', padding: '4px 6px' }}
                    />
                    <button
                      type="button"
                      onClick={() => setSeed(Math.floor(Math.random() * 0x7fffffff))}
                      style={{ padding: '2px 8px' }}
                    >
                      Roll
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <div style={{ marginTop: '14px' }}>
              <div style={{ fontSize: '10px', color: '#8b949e', marginBottom: '3px' }}>
                Starting in: <span style={{ color: 'var(--brass-gold)' }}>{scenDef.name} [{scenDef.stratum}]</span>
              </div>
              <div style={{ fontSize: '10px', color: '#8b949e', marginBottom: '6px' }}>
                Treasury: <span style={{ color: 'var(--brass-gold)' }}>{100 + profDef.bonusPence + (selectedTraits.includes('CARTEL_CONNECTIONS') ? 50 : 0)}d Crown Pence</span>
              </div>
              <button
                type="button"
                onClick={handleEmbark}
                style={{
                  width: '100%', padding: '10px 0', fontSize: '12px', fontWeight: 'bold',
                  background: 'var(--brass-gold)', color: '#000000', border: 'none', cursor: 'pointer',
                  boxShadow: '0 0 10px rgba(212, 175, 55, 0.4)',
                }}
              >
                [ Embark into London ]
              </button>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
