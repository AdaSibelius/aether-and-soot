import { useState } from 'preact/hooks';
import { GameCommand } from '../../schemas/commands.schema.js';
import { EntityId } from '../../schemas/primitives.schema.js';
import { WorldState } from '../../sim/core/world.js';

export interface CodexWindowProps {
  readonly state: Readonly<WorldState>;
  readonly actorId: EntityId;
  readonly onCommand: (cmd: GameCommand) => void;
}

export function CodexWindow({ state, actorId, onCommand }: CodexWindowProps) {
  const [selectedCategory, setSelectedCategory] = useState<'ALL' | 'AUTOMATON' | 'SCHEMATIC' | 'REACTION'>('ALL');
  const [selectedEntryId, setSelectedEntryId] = useState<string | null>(null);

  const entries = Object.values(state.codex);
  const filtered = selectedCategory === 'ALL'
    ? entries
    : entries.filter((e) => e.category === selectedCategory);

  const selectedEntry = entries.find((e) => e.id === selectedEntryId) ?? filtered[0];
  const safehouseList = Object.values(state.safehouses);

  const handleConsult = (entryId?: string) => {
    onCommand({ type: 'CONSULT_CODEX', actorId, entryId });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: '12px' }}>
      {/* Safehouse & Compendium Overview */}
      <div style={{ display: 'flex', justifyContent: 'space-between', background: '#111a1f', padding: '10px 14px', border: '1px solid #2e4053' }}>
        <div>
          <span style={{ color: '#d4af37', fontWeight: 'bold' }}>ROYAL SOCIETY NATURALIST'S COMPENDIUM</span>
          <div style={{ fontSize: '11px', color: '#7f8c8d' }}>
            Documenting Mechanical Taxonomies, Aetheric Blueprints &amp; Alchemical Phenomena
          </div>
        </div>
        <div style={{ textAlign: 'right', fontSize: '11px', color: '#bdc3c7' }}>
          <div>Discovered: <strong style={{ color: '#2ecc71' }}>{entries.length}</strong> Entries</div>
          <div>Freehold Deeds: <strong style={{ color: '#f39c12' }}>{safehouseList.length}</strong> Safehouses</div>
        </div>
      </div>

      {/* Category Filter Tabs */}
      <div style={{ display: 'flex', gap: '8px', borderBottom: '1px solid #2e4053', paddingBottom: '6px' }}>
        {(['ALL', 'AUTOMATON', 'SCHEMATIC', 'REACTION'] as const).map((cat) => (
          <button
            key={cat}
            onClick={() => setSelectedCategory(cat)}
            style={{
              background: selectedCategory === cat ? '#2c3e50' : '#151d21',
              color: selectedCategory === cat ? '#f4d03f' : '#95a5a6',
              border: `1px solid ${selectedCategory === cat ? '#d4af37' : '#2e4053'}`,
              padding: '4px 10px',
              fontSize: '11px',
              cursor: 'pointer',
            }}
          >
            {cat} {cat !== 'ALL' && `(${entries.filter((e) => e.category === cat).length})`}
          </button>
        ))}
      </div>

      {/* Main Content: Split List and Details */}
      <div style={{ display: 'flex', flex: 1, gap: '12px', minHeight: '260px' }}>
        {/* Entries List */}
        <div style={{ flex: 1, background: '#0e1417', border: '1px solid #2e4053', overflowY: 'auto', padding: '8px' }}>
          {filtered.length === 0 ? (
            <div style={{ padding: '24px 12px', textAlign: 'center', color: '#7f8c8d', fontSize: '12px' }}>
              No observations cataloged under this taxonomy.
              <div style={{ marginTop: '6px', fontSize: '10px' }}>
                Dissect automatons, transcribe workshop prints, or observe chemical spill combustion to register entries.
              </div>
            </div>
          ) : (
            filtered.map((item) => (
              <div
                key={item.id}
                onClick={() => setSelectedEntryId(item.id)}
                style={{
                  padding: '8px 10px',
                  marginBottom: '6px',
                  background: selectedEntry?.id === item.id ? '#1a252f' : '#141c20',
                  border: `1px solid ${selectedEntry?.id === item.id ? '#3498db' : '#23313d'}`,
                  cursor: 'pointer',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <div>
                  <div style={{ color: '#ecf0f1', fontSize: '12px', fontWeight: 'bold' }}>{item.title}</div>
                  <div style={{ fontSize: '10px', color: '#7f8c8d' }}>Turn {item.discoveredTurn} • {item.category}</div>
                </div>
                <span
                  style={{
                    fontSize: '9px',
                    padding: '2px 6px',
                    borderRadius: '3px',
                    background: item.category === 'AUTOMATON' ? '#922b21' : item.category === 'SCHEMATIC' ? '#b7950b' : '#1e8449',
                    color: '#ffffff',
                  }}
                >
                  {item.category}
                </span>
              </div>
            ))
          )}
        </div>

        {/* Selected Entry Dossier */}
        <div style={{ flex: 1.2, background: '#121a1e', border: '1px solid #2e4053', padding: '12px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          {selectedEntry ? (
            <div>
              <div style={{ borderBottom: '1px solid #2e4053', paddingBottom: '8px', marginBottom: '10px' }}>
                <span style={{ fontSize: '10px', color: '#d4af37', textTransform: 'uppercase' }}>Royal Society Taxon Record</span>
                <h3 style={{ margin: '4px 0', color: '#f39c12' }}>{selectedEntry.title}</h3>
                <div style={{ fontSize: '11px', color: '#95a5a6' }}>ID: {selectedEntry.id} | Turn Discovered: {selectedEntry.discoveredTurn}</div>
              </div>
              <p style={{ fontSize: '12px', color: '#bdc3c7', lineHeight: '1.5', whiteSpace: 'pre-wrap' }}>
                {selectedEntry.description}
              </p>
              {selectedEntry.tags.length > 0 && (
                <div style={{ marginTop: '12px', display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                  {selectedEntry.tags.map((t) => (
                    <span key={t} style={{ fontSize: '9px', background: '#2c3e50', color: '#ecf0f1', padding: '2px 6px' }}>
                      #{t}
                    </span>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div style={{ color: '#7f8c8d', fontSize: '12px', textAlign: 'center', marginTop: '60px' }}>
              Select an entry to view Naturalist field dissection diagrams and operational logs.
            </div>
          )}

          {selectedEntry && (
            <button
              onClick={() => handleConsult(selectedEntry.id)}
              style={{
                marginTop: '12px',
                background: '#d4af37',
                color: '#0d1316',
                border: 'none',
                padding: '8px 12px',
                fontWeight: 'bold',
                cursor: 'pointer',
                fontSize: '11px',
              }}
            >
              Consult Royal Society Compendium (Trigger NPC Reactions)
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
