import { GameCommand } from '../../schemas/commands.schema.js';
import { EntityId } from '../../schemas/primitives.schema.js';
import { WorldState } from '../../sim/core/world.js';
import { FloatingTextCallout, FloatingTextOverlay } from '../renderer/floating-combat-text.js';
import { ModalWindowId } from './CharacterModalShell.js';
import { DialogueModal } from './DialogueModal.js';
import { LookCursorOverlay } from './LookCursorOverlay.js';

export interface PreactBridgeProps {
  readonly worldState: WorldState;
  readonly playerId: EntityId;
  readonly isLookModeActive: boolean;
  readonly lookCursor: { x: number; y: number } | null;
  readonly cameraOrigin: { x: number; y: number };
  readonly isSystemMenuOpen: boolean;
  readonly isCrtScanlinesEnabled: boolean;
  readonly useDiegeticCanvasUi: boolean;
  readonly activeDialogueNpcId: EntityId | null;
  readonly floatingItems?: readonly FloatingTextCallout[] | undefined;
  readonly onCommand: (cmd: GameCommand) => void;
  readonly onOpenModal: (window: ModalWindowId) => void;
  readonly onToggleLookMode: () => void;
  readonly onTalk: (targetId?: EntityId) => void;
  readonly onCloseDialogue?: (() => void) | undefined;
  readonly onOpenSystemMenu: () => void;
  readonly onCloseSystemMenu: () => void;
  readonly onToggleCrtScanlines: () => void;
  readonly onToggleUiMode?: (() => void) | undefined;
  readonly onNewSeed: (seed: number) => void;
  readonly onLoadWorld: (loaded: WorldState) => void;
  readonly onOpenCharacterCreator: () => void;
}

/**
 * Ultra-thin Preact bridge mounting only interactive interactive dialogs,
 * keyboard cursor overlays, and floating combat text callouts.
 * Replaces heavy HTML DOM CSS layouts with primary Canvas UI buffer.
 */
export function PreactBridge(props: PreactBridgeProps) {
  const {
    worldState,
    playerId,
    isLookModeActive,
    lookCursor,
    cameraOrigin,
    activeDialogueNpcId,
    floatingItems,
    onCommand,
    onOpenModal,
    onToggleLookMode,
    onTalk,
    onCloseDialogue,
  } = props;

  return (
    <div class="preact-bridge-layer" style={{ position: 'absolute', top: 0, left: 0, pointerEvents: 'none' }}>
      {/* 1. Tactical Look Cursor Overlay */}
      <div style={{ pointerEvents: 'auto' }}>
        <LookCursorOverlay
          isActive={isLookModeActive}
          cursor={lookCursor}
          cameraOrigin={cameraOrigin}
          state={worldState}
          actorId={playerId}
          onCommand={onCommand}
          onClose={onToggleLookMode}
          onTalk={onTalk}
        />
      </div>

      {/* 2. Floating Combat Damage / Text */}
      {floatingItems && floatingItems.length > 0 && (
        <FloatingTextOverlay items={floatingItems} cameraOrigin={cameraOrigin} />
      )}

      {/* 3. Interactive Dialogue Modal */}
      {activeDialogueNpcId && (
        <div style={{ pointerEvents: 'auto' }}>
          <DialogueModal
            state={worldState}
            actorId={playerId}
            targetNpcId={activeDialogueNpcId}
            onCommand={onCommand}
            onClose={() => (onCloseDialogue ?? (() => onTalk(undefined)))()}
            onOpenModal={(w) => {
              (onCloseDialogue ?? (() => onTalk(undefined)))();
              onOpenModal(w);
            }}
          />
        </div>
      )}
    </div>
  );
}
