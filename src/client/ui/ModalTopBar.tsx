import { ModalWindowId } from './CharacterModalShell.js';

export interface ModalTopBarProps {
  readonly activeModal?: ModalWindowId | null;
  readonly onOpenModal: (window: ModalWindowId) => void;
  readonly onOpenSystemMenu?: () => void;
}

const MODAL_TABS: readonly { id: ModalWindowId; label: string; key: string }[] = [
  { id: 'INVENTORY', label: 'Satchel', key: 'I' },
  { id: 'ANATOMY', label: 'Anatomy', key: 'A' },
  { id: 'WORKBENCH', label: 'Bench', key: 'C' },
  { id: 'EXCHANGE', label: 'Market', key: 'M' },
  { id: 'ATLAS', label: 'Atlas', key: 'W' },
  { id: 'CODEX', label: 'Codex', key: 'K' },
];

export function ModalTopBar({ activeModal, onOpenModal, onOpenSystemMenu }: ModalTopBarProps) {
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        background: '#07090a',
        border: '1px solid #2e4053',
        padding: '4px 8px',
        marginBottom: '6px',
        gap: '6px',
        flexWrap: 'wrap',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <span class="brass-text" style={{ fontWeight: 'bold', fontSize: '11px', letterSpacing: '0.06em' }}>
          AETHER &amp; SOOT
        </span>
      </div>

      <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
        {MODAL_TABS.map((tab) => {
          const isActive = activeModal === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => onOpenModal(tab.id)}
              style={{
                padding: '3px 7px',
                fontSize: '10px',
                color: isActive ? 'var(--brass-gold)' : '#d5dbdb',
                background: isActive ? '#1c2833' : '#11171a',
                border: isActive ? '1px solid var(--brass-gold)' : '1px solid #2e4053',
                cursor: 'pointer',
              }}
              title={`Open ${tab.label} [${tab.key}]`}
            >
              [{tab.key}] {tab.label}
            </button>
          );
        })}
        {onOpenSystemMenu && (
          <button
            type="button"
            onClick={onOpenSystemMenu}
            style={{
              padding: '3px 7px',
              fontSize: '10px',
              color: '#95a5a6',
              background: '#11171a',
              border: '1px solid #2e4053',
              cursor: 'pointer',
            }}
            title="Engine Settings & Save Archive [Esc]"
          >
            [Esc] Menu
          </button>
        )}
      </div>
    </div>
  );
}
