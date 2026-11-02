import { CharacterCreationConfig } from '../schemas/character.schema.js';
import { EntityId } from '../schemas/primitives.schema.js';
import { ModalNavState } from './input/modal-nav-router.js';
import { FloatingTextCallout } from './renderer/floating-combat-text.js';
import { VisualRenderMode } from './renderer/tileset-manager.js';
import { ModalWindowId } from './ui/CharacterModalShell.js';

export interface ClientSessionState {
  activeModal: ModalWindowId | null;
  mouseHoverCoord: { x: number; y: number } | null;
  isSystemMenuOpen: boolean;
  isLookModeActive: boolean;
  isCreatorOpen: boolean;
  isCrtScanlinesEnabled: boolean;
  lookCursor: { x: number; y: number } | null;
  activeDialogueNpcId: EntityId | null;
  useDiegeticCanvasUi: boolean;
  floatingCallouts: FloatingTextCallout[];
  modalNavState: ModalNavState;
  embarkConfig: CharacterCreationConfig;
  visualRenderMode?: VisualRenderMode;
}

export function createInitialSessionState(initialSeed: number): ClientSessionState {
  return {
    activeModal: null,
    mouseHoverCoord: null,
    isSystemMenuOpen: false,
    isLookModeActive: false,
    isCreatorOpen: false,
    isCrtScanlinesEnabled: true,
    lookCursor: null,
    activeDialogueNpcId: null,
    useDiegeticCanvasUi: true,
    floatingCallouts: [],
    modalNavState: { selectedIndex: 0 },
    embarkConfig: {
      professionId: 'DISGRACED_CHIRURGEON',
      traitIds: ['NIGHT_OPTICS', 'BOILER_HEART'],
      scenarioId: 'SPITALFIELDS_FOUNDRY_ROW',
      seed: initialSeed,
    },
    visualRenderMode: 'HYBRID_OVERLAY',
  };
}

export function pruneActiveCallouts(callouts: readonly FloatingTextCallout[], nowMs: number): FloatingTextCallout[] {
  return callouts.filter((c) => nowMs - c.createdAtMs <= c.durationMs);
}

export function toggleSessionLookMode(
  session: ClientSessionState,
  playerPos?: { x: number; y: number } | undefined,
): void {
  session.isLookModeActive = !session.isLookModeActive;
  session.lookCursor = session.isLookModeActive
    ? (playerPos ? { x: playerPos.x, y: playerPos.y } : { x: 12, y: 10 })
    : null;
}

export function updateSessionHover(
  session: ClientSessionState,
  coord: { x: number; y: number } | null,
): boolean {
  if (!coord) return false;
  if (!session.mouseHoverCoord || session.mouseHoverCoord.x !== coord.x || session.mouseHoverCoord.y !== coord.y) {
    session.mouseHoverCoord = coord;
    return true;
  }
  return false;
}

export function setSessionModal(session: ClientSessionState, modal: ModalWindowId | null): void {
  session.activeModal = modal;
  session.modalNavState.selectedIndex = 0;
}
