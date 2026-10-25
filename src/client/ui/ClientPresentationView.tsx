import { render } from 'preact';
import { GameCommand } from '../../schemas/commands.schema.js';
import { CharacterCreationConfig } from '../../schemas/character.schema.js';
import { EntityId } from '../../schemas/primitives.schema.js';
import { WorldState } from '../../sim/core/world.js';
import { CharacterModalShell, ModalWindowId } from './CharacterModalShell.js';
import { CharacterCreatorModal } from './CharacterCreatorModal.js';
import { HudLayout } from './HudLayout.js';
import { LookCursorOverlay } from './LookCursorOverlay.js';
import { ModalTopBar } from './ModalTopBar.js';
import { QuickActionBar } from './QuickActionBar.js';
import { resolveInspectedTileCoord } from '../client-interactions.js';
import { FloatingTextCallout, FloatingTextOverlay } from '../renderer/floating-combat-text.js';
import { PreactBridge } from './PreactBridge.js';

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
  const isDiegetic = ctx.useDiegeticCanvasUi ?? true;

  if (isDiegetic) {
    if (topBarHost) render(null, topBarHost);
    if (actionBarHost) render(null, actionBarHost);
    render(null, hudHost);

    render(
      <PreactBridge
        worldState={ctx.worldState}
        playerId={ctx.playerId}
        isLookModeActive={ctx.isLookModeActive}
        lookCursor={ctx.lookCursor}
        cameraOrigin={ctx.cameraOrigin}
        isSystemMenuOpen={ctx.isSystemMenuOpen}
        isCrtScanlinesEnabled={ctx.isCrtScanlinesEnabled}
        useDiegeticCanvasUi={isDiegetic}
        activeDialogueNpcId={ctx.activeDialogueNpcId}
        floatingItems={ctx.floatingItems}
        onCommand={ctx.onCommand}
        onOpenModal={ctx.onOpenModal}
        onToggleLookMode={ctx.onToggleLookMode}
        onTalk={ctx.onTalk}
        onOpenSystemMenu={ctx.onOpenSystemMenu}
        onCloseSystemMenu={ctx.onCloseSystemMenu}
        onToggleCrtScanlines={ctx.onToggleCrtScanlines}
        onToggleUiMode={ctx.onToggleUiMode}
        onNewSeed={ctx.onNewSeed}
        onLoadWorld={ctx.onLoadWorld}
        onOpenCharacterCreator={ctx.onOpenCharacterCreator}
      />,
      overlayHost,
    );
    return;
  }

  // Fallback: Legacy HTML DOM Layout
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
      <CharacterModalShell
        state={ctx.worldState}
        actorId={ctx.playerId}
        activeWindow={ctx.activeModal}
        onClose={ctx.onCloseModal}
        onSelectWindow={ctx.onOpenModal}
        onCommand={ctx.onCommand}
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
