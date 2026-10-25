import { render } from 'preact';
import { GameCommand } from '../../schemas/commands.schema.js';
import { CharacterCreationConfig } from '../../schemas/character.schema.js';
import { EntityId } from '../../schemas/primitives.schema.js';
import { WorldState } from '../../sim/core/world.js';
import { CharacterModalShell, ModalWindowId } from './CharacterModalShell.js';
import { CharacterCreatorModal } from './CharacterCreatorModal.js';
import { DialogueModal } from './DialogueModal.js';
import { HudLayout } from './HudLayout.js';
import { LookCursorOverlay } from './LookCursorOverlay.js';
import { ModalTopBar } from './ModalTopBar.js';
import { QuickActionBar } from './QuickActionBar.js';
import { SystemMenuModal } from './SystemMenuModal.js';
import { resolveInspectedTileCoord } from '../client-interactions.js';
import { FloatingTextCallout, FloatingTextOverlay } from '../renderer/floating-combat-text.js';

export interface ClientMountHosts {
  readonly topBarHost: HTMLElement | null;
  readonly overlayHost: HTMLElement;
  readonly actionBarHost: HTMLElement | null;
  readonly hudHost: HTMLElement;
}

export interface ClientPresentationContext {
  readonly worldState: WorldState;
  readonly playerId: EntityId;
  readonly activeModal: ModalWindowId | null;
  readonly isSystemMenuOpen: boolean;
  readonly isLookModeActive: boolean;
  readonly isCreatorOpen: boolean;
  readonly isCrtScanlinesEnabled: boolean;
  readonly lookCursor: { x: number; y: number } | null;
  readonly mouseHoverCoord: { x: number; y: number } | null;
  readonly cameraOrigin: { x: number; y: number };
  readonly activeDialogueNpcId: EntityId | null;
  readonly floatingItems?: readonly FloatingTextCallout[];
  readonly onCommand: (cmd: GameCommand) => void;
  readonly onOpenModal: (window: ModalWindowId) => void;
  readonly onCloseModal: () => void;
  readonly onOpenSystemMenu: () => void;
  readonly onCloseSystemMenu: () => void;
  readonly onToggleLookMode: () => void;
  readonly onToggleDoor: () => void;
  readonly onTalk: (targetId?: EntityId) => void;
  readonly onNewSeed: (seed: number) => void;
  readonly onLoadWorld: (loaded: WorldState) => void;
  readonly onOpenCharacterCreator: () => void;
  readonly onCloseCharacterCreator: () => void;
  readonly onEmbark: (cfg: CharacterCreationConfig, seed: number) => void;
  readonly onToggleCrtScanlines: () => void;
  readonly useDiegeticCanvasUi?: boolean;
  readonly onToggleUiMode?: () => void;
}

export function renderClientPresentationViews(
  hosts: ClientMountHosts,
  ctx: ClientPresentationContext,
): void {
  const { topBarHost, overlayHost, actionBarHost, hudHost } = hosts;

  if (topBarHost) {
    render(
      <ModalTopBar
        activeModal={ctx.activeModal}
        onOpenModal={ctx.onOpenModal}
        onOpenSystemMenu={ctx.onOpenSystemMenu}
      />,
      topBarHost,
    );
  }

  render(
    <div>
      <LookCursorOverlay
        isActive={ctx.isLookModeActive}
        cursor={ctx.lookCursor}
        cameraOrigin={ctx.cameraOrigin}
        state={ctx.worldState}
        actorId={ctx.playerId}
        onCommand={ctx.onCommand}
        onClose={ctx.onToggleLookMode}
        onTalk={ctx.onTalk}
      />
      {ctx.floatingItems && ctx.floatingItems.length > 0 && (
        <FloatingTextOverlay items={ctx.floatingItems} cameraOrigin={ctx.cameraOrigin} />
      )}
    </div>,
    overlayHost,
  );

  if (actionBarHost) {
    render(
      <QuickActionBar
        state={ctx.worldState}
        actorId={ctx.playerId}
        isLookModeActive={ctx.isLookModeActive}
        onToggleLookMode={ctx.onToggleLookMode}
        onToggleDoor={ctx.onToggleDoor}
        onCommand={ctx.onCommand}
      />,
      actionBarHost,
    );
  }

  const inspectedTile = resolveInspectedTileCoord(
    ctx.isLookModeActive,
    ctx.lookCursor,
    ctx.mouseHoverCoord,
  );

  render(
    <div>
      <HudLayout
        state={ctx.worldState}
        onCommand={ctx.onCommand}
        hoveredTile={inspectedTile}
        isLookModeActive={ctx.isLookModeActive}
        onOpenModal={ctx.onOpenModal}
        onOpenSystemMenu={ctx.onOpenSystemMenu}
        onReEmbark={ctx.onOpenCharacterCreator}
      />
      {!ctx.useDiegeticCanvasUi && (
        <CharacterModalShell
          state={ctx.worldState}
          actorId={ctx.playerId}
          activeWindow={ctx.activeModal}
          onClose={ctx.onCloseModal}
          onSelectWindow={ctx.onOpenModal}
          onCommand={ctx.onCommand}
        />
      )}
      {ctx.activeDialogueNpcId && (
        <DialogueModal
          state={ctx.worldState}
          actorId={ctx.playerId}
          targetNpcId={ctx.activeDialogueNpcId}
          onCommand={ctx.onCommand}
          onClose={() => ctx.onTalk(undefined)}
          onOpenModal={(w) => {
            ctx.onTalk(undefined);
            ctx.onOpenModal(w);
          }}
        />
      )}
      <SystemMenuModal
        state={ctx.worldState}
        isOpen={ctx.isSystemMenuOpen}
        onClose={ctx.onCloseSystemMenu}
        onNewSeed={ctx.onNewSeed}
        onLoadWorld={ctx.onLoadWorld}
        onOpenCharacterCreator={ctx.onOpenCharacterCreator}
        crtScanlinesEnabled={ctx.isCrtScanlinesEnabled}
        onToggleCrtScanlines={ctx.onToggleCrtScanlines}
        useDiegeticCanvasUi={ctx.useDiegeticCanvasUi}
        onToggleUiMode={ctx.onToggleUiMode}
      />
      <CharacterCreatorModal
        isOpen={ctx.isCreatorOpen}
        initialSeed={ctx.worldState.seed}
        onClose={ctx.onCloseCharacterCreator}
        onEmbark={ctx.onEmbark}
      />
    </div>,
    hudHost,
  );
}
