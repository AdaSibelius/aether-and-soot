import { GameCommand } from '../../schemas/commands.schema.js';
import { EntityId } from '../../schemas/primitives.schema.js';
import { WorldState } from '../../sim/core/world.js';
import { ModalWindowId } from './CharacterModalShell.js';

export interface QuickActionBarProps {
  readonly state: Readonly<WorldState>;
  readonly actorId: EntityId;
  readonly isLookModeActive?: boolean;
  readonly onToggleLookMode?: () => void;
  readonly onToggleDoor?: () => void;
  readonly onCommand: (cmd: GameCommand) => void;
  readonly onOpenModal?: (window: ModalWindowId) => void;
  readonly onOpenSystemMenu?: () => void;
  readonly onOpenCharacterCreator?: () => void;
}

export function QuickActionBar({
  state,
  actorId,
  isLookModeActive = false,
  onToggleLookMode,
  onToggleDoor,
  onCommand,
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
      {/* Tactical World Actions */}
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
        {onToggleDoor && (
          <button
            type="button"
            onClick={onToggleDoor}
            style={{ padding: '3px 6px', fontSize: '10px' }}
            title="Open or close adjacent door [O]"
          >
            [O] Door
          </button>
        )}
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

      <div style={{ fontSize: '10px', color: '#7f8c8d' }}>
        Tactical Actions
      </div>
    </div>
  );
}
