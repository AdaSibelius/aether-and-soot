import { GameCommand } from '../../schemas/commands.schema.js';
import { EntityId } from '../../schemas/primitives.schema.js';
import { WorldState } from '../../sim/core/world.js';
import { AnatomyWindow } from './AnatomyWindow.js';
import { CraftingWindow } from './CraftingWindow.js';
import { InventoryWindow } from './InventoryWindow.js';
import { TradeWindow } from './TradeWindow.js';

export type ModalWindowId = 'INVENTORY' | 'ANATOMY' | 'WORKBENCH' | 'EXCHANGE' | 'ATLAS';

export interface CharacterModalShellProps {
  readonly state: Readonly<WorldState>;
  readonly actorId: EntityId;
  readonly activeWindow: ModalWindowId | null;
  readonly onClose: () => void;
  readonly onSelectWindow: (window: ModalWindowId) => void;
  readonly onCommand: (cmd: GameCommand) => void;
}

const MODAL_TABS: readonly { id: ModalWindowId; label: string; shortcut: string }[] = [
  { id: 'INVENTORY', label: 'SATCHEL', shortcut: '[I]' },
  { id: 'ANATOMY', label: 'ANATOMY & SURGERY', shortcut: '[A]' },
  { id: 'WORKBENCH', label: 'ARTIFICER BENCH', shortcut: '[C]' },
  { id: 'EXCHANGE', label: 'EXCHANGE & FACTIONS', shortcut: '[M]' },
  { id: 'ATLAS', label: 'WORLD ATLAS', shortcut: '[W]' },
];

export function CharacterModalShell({
  state,
  actorId,
  activeWindow,
  onClose,
  onSelectWindow,
  onCommand,
}: CharacterModalShellProps) {
  if (!activeWindow) return null;

  const player = state.entities[actorId];

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(5, 7, 8, 0.88)',
        backdropFilter: 'blur(2px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 900,
        padding: '20px',
      }}
      onClick={onClose}
    >
      <div
        class="panel-box"
        style={{
          width: '880px',
          maxWidth: '95vw',
          height: '640px',
          maxHeight: '92vh',
          display: 'flex',
          flexDirection: 'column',
          border: '2px double var(--brass-gold)',
          background: '#090e11',
          boxShadow: '0 0 35px rgba(212, 175, 55, 0.25)',
          padding: 0,
          overflow: 'hidden',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Qud-Style Top Header & Tab Navigation */}
        <div
          style={{
            background: '#11181c',
            borderBottom: '1px solid var(--brass-gold)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '6px 12px',
          }}
        >
          <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
            <span style={{ fontSize: '11px', color: '#7f8c8d' }}>[Q &lt;&lt;]</span>
            {MODAL_TABS.map((tab) => {
              const isActive = activeWindow === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => onSelectWindow(tab.id)}
                  style={{
                    padding: '4px 10px',
                    fontSize: '11px',
                    fontWeight: isActive ? 'bold' : 'normal',
                    background: isActive ? '#243342' : 'transparent',
                    border: isActive ? '1px solid var(--brass-gold)' : '1px solid #2e4053',
                    color: isActive ? 'var(--brass-gold)' : '#95a5a6',
                    cursor: 'pointer',
                  }}
                >
                  {tab.label} <span style={{ opacity: 0.7 }}>{tab.shortcut}</span>
                </button>
              );
            })}
            <span style={{ fontSize: '11px', color: '#7f8c8d' }}>[&gt;&gt; E]</span>
          </div>

          <button
            type="button"
            onClick={onClose}
            style={{
              padding: '3px 8px',
              fontSize: '11px',
              background: '#2c1e1e',
              border: '1px solid #ec7063',
              color: '#ec7063',
              cursor: 'pointer',
            }}
          >
            [X] Close [Esc]
          </button>
        </div>

        {/* Modal Window Active Content Pane */}
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '14px',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          {activeWindow === 'INVENTORY' && (
            <InventoryWindow state={state} actorId={actorId} onCommand={onCommand} />
          )}

          {activeWindow === 'ANATOMY' && (
            <AnatomyWindow state={state} actorId={actorId} onCommand={onCommand} />
          )}

          {activeWindow === 'WORKBENCH' && (
            <CraftingWindow state={state} actorId={actorId} onCommand={onCommand} />
          )}

          {activeWindow === 'EXCHANGE' && (
            <TradeWindow state={state} actorId={actorId} onCommand={onCommand} />
          )}

          {activeWindow === 'ATLAS' && (
            <div class="panel-box" style={{ flex: 1 }}>
              <div class="panel-header">
                DISTRICT CARTOGRAPHY &amp; 3-STRATA CROSS-SECTION [W]
              </div>
              <div style={{ padding: '8px 0', lineHeight: '1.6' }}>
                <div class="stat-row">
                  <span>Current District:</span>
                  <span class="brass-text">
                    {state.currentDistrictId ?? 'district_spitalfields_sootworks'}
                  </span>
                </div>
                <div class="stat-row">
                  <span>Current Stratum:</span>
                  <span class="copper-text">{player?.position?.stratum ?? 'STREET'}</span>
                </div>
                <div class="stat-row">
                  <span>Vertical Architecture:</span>
                  <span>SPIRE (Catwalks) &gt; STREET (Cobblestone) &gt; UNDERCROFT (Sewers)</span>
                </div>
              </div>
              <div class="log-entry muted" style={{ marginTop: '16px' }}>
                Traverse district transit gates and vertical portals (&gt; / &lt;) to expand map coverage. Full interactive overworld map expands in Phase 17.
              </div>
            </div>
          )}
        </div>

        {/* Qud-Style Footer Keybind Legend */}
        <div
          style={{
            background: '#0d1316',
            borderTop: '1px solid #2e4053',
            padding: '6px 12px',
            fontSize: '10px',
            color: '#7f8c8d',
            display: 'flex',
            justifyContent: 'space-between',
          }}
        >
          <span>[Q / E or Tab] Cycle Windows &nbsp;|&nbsp; [Esc] Return to World Viewport</span>
          <span class="brass-text">Aether &amp; Soot — Victorian Roguelike Shell</span>
        </div>
      </div>
    </div>
  );
}
