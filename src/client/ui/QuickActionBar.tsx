import { GameCommand } from '../../schemas/commands.schema.js';
import { EntityId } from '../../schemas/primitives.schema.js';
import { WorldState } from '../../sim/core/world.js';
import { ModalWindowId } from './CharacterModalShell.js';

export interface QuickActionBarProps {
  readonly state: Readonly<WorldState>;
  readonly actorId: EntityId;
  readonly isLookModeActive?: boolean;
  readonly onToggleLookMode?: () => void;
  readonly onCommand: (cmd: GameCommand) => void;
  readonly onOpenModal: (window: ModalWindowId) => void;
  readonly onOpenSystemMenu: () => void;
  readonly onOpenCharacterCreator?: () => void;
}

export function QuickActionBar({
  state,
  actorId,
  isLookModeActive = false,
  onToggleLookMode,
  onCommand,
  onOpenModal,
  onOpenSystemMenu,
  onOpenCharacterCreator,
}: QuickActionBarProps) {
  const player = state.entities[actorId];
  const pos = player?.position;

  return (
    <div
      class="panel-box"
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '6px 10px',
        background: '#0d1316',
        border: '1px solid #2e4053',
        gap: '6px',
      }}
    >
      {/* Tactical Sim Actions */}
      <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
        <button
          type="button"
          onClick={() => onCommand({ type: 'WAIT_TURN', actorId })}
          style={{ padding: '3px 6px', fontSize: '10px' }}
          title="Wait 1 Turn [Space / .]"
        >
          [Space] Wait
        </button>
        <button
          type="button"
          onClick={() => onCommand({ type: 'PICK_UP_ITEM', actorId })}
          style={{ padding: '3px 6px', fontSize: '10px' }}
          title="Pick up item from ground [G]"
        >
          [G] Take
        </button>
        <button
          type="button"
          onClick={() => onCommand({ type: 'USE_PORTAL', actorId })}
          style={{ padding: '3px 6px', fontSize: '10px' }}
          title="Traverse vertical portal or transit gate [Enter / > / <]"
        >
          [&gt;/&lt;] Portal
        </button>
        <button
          type="button"
          onClick={() =>
            onCommand({
              type: 'REFILL_STEAM',
              actorId,
              pressureAddedKpa: 50,
            })
          }
          style={{ padding: '3px 6px', fontSize: '10px' }}
          title="Stoke boiler (+50 kPa) [R]"
        >
          [R] Stoke
        </button>
        <button
          type="button"
          onClick={() => {
            if (!pos) return;
            onCommand({
              type: 'VENT_STEAM',
              actorId,
              target: { x: pos.x, y: pos.y, stratum: pos.stratum },
              pressureReleasedKpa: 25,
            });
          }}
          style={{ padding: '3px 6px', fontSize: '10px' }}
          title="Vent high pressure steam [V]"
        >
          [V] Vent
        </button>
        {onToggleLookMode && (
          <button
            type="button"
            onClick={onToggleLookMode}
            style={{
              padding: '3px 6px',
              fontSize: '10px',
              color: isLookModeActive ? 'var(--brass-gold)' : undefined,
              borderColor: isLookModeActive ? 'var(--brass-gold)' : undefined,
            }}
            title="Toggle Keyboard Look / Target Mode [L]"
          >
            {isLookModeActive ? '[L] Looking...' : '[L] Look'}
          </button>
        )}
      </div>

      <div style={{ color: '#2e4053' }}>|</div>

      {/* Caves of Qud Modal Window Toggles */}
      <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
        <button
          type="button"
          onClick={() => onOpenModal('INVENTORY')}
          style={{ padding: '3px 6px', fontSize: '10px', color: 'var(--brass-gold)' }}
          title="Open Satchel / Inventory [I]"
        >
          [I] Satchel
        </button>
        <button
          type="button"
          onClick={() => onOpenModal('ANATOMY')}
          style={{ padding: '3px 6px', fontSize: '10px', color: 'var(--brass-gold)' }}
          title="Open Prosthetic Surgery & Anatomy [Shift+A]"
        >
          [A] Anatomy
        </button>
        <button
          type="button"
          onClick={() => onOpenModal('WORKBENCH')}
          style={{ padding: '3px 6px', fontSize: '10px', color: 'var(--brass-gold)' }}
          title="Open Artificer Workbench [C]"
        >
          [C] Bench
        </button>
        <button
          type="button"
          onClick={() => onOpenModal('EXCHANGE')}
          style={{ padding: '3px 6px', fontSize: '10px', color: 'var(--brass-gold)' }}
          title="Open Merchant Exchange & Factions [M]"
        >
          [M] Market
        </button>
        <button
          type="button"
          onClick={() => onOpenModal('ATLAS')}
          style={{ padding: '3px 6px', fontSize: '10px', color: 'var(--brass-gold)' }}
          title="Open World Atlas & Stratum Map [W]"
        >
          [W] Atlas
        </button>
        {onOpenCharacterCreator && (
          <button
            type="button"
            onClick={onOpenCharacterCreator}
            style={{ padding: '3px 6px', fontSize: '10px', color: '#2ecc71' }}
            title="Create New Character / Scenario [N]"
          >
            [N] New Char
          </button>
        )}
        <button
          type="button"
          onClick={onOpenSystemMenu}
          style={{ padding: '3px 6px', fontSize: '10px', color: '#95a5a6' }}
          title="System Engine Menu [Esc]"
        >
          [Esc] Menu
        </button>
      </div>
    </div>
  );
}
