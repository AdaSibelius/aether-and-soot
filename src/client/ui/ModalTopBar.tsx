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
        background: '#090e11',
        border: '1px solid #3d2f1f',
        padding: '3px 8px',
        gap: '6px',
        flexWrap: 'wrap',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
        <span style={{ color: '#d4af37', fontWeight: 'bold', fontSize: '11px', letterSpacing: '0.08em' }}>
          ╔═[ AETHER &amp; SOOT ]═╗
        </span>
      </div>

      <div style={{ display: 'flex', gap: '3px', flexWrap: 'wrap' }}>
        {MODAL_TABS.map((tab) => {
          const isActive = activeModal === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => onOpenModal(tab.id)}
              style={{
                padding: '2px 7px',
                fontSize: '10px',
                color: isActive ? '#050708' : '#d4af37',
                background: isActive ? '#d4af37' : '#11171a',
                border: isActive ? '1px solid #d4af37' : '1px solid #3d2f1f',
                fontWeight: isActive ? 'bold' : 'normal',
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
              padding: '2px 7px',
              fontSize: '10px',
              color: '#8b9b9c',
              background: '#11171a',
              border: '1px solid #3d2f1f',
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
