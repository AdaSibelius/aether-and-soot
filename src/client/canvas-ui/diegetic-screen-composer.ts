import { CharacterCreationConfig, ProfessionId, ScenarioId, TraitId } from '../../schemas/character.schema.js';
import { GameCommand } from '../../schemas/commands.schema.js';
import { EntityId } from '../../schemas/primitives.schema.js';
import { WorldState } from '../../sim/core/world.js';
import { resolveDiegeticClickHit } from '../client-interactions.js';
import { ModalWindowId } from '../ui/CharacterModalShell.js';
import { createUiCellBuffer, UiCellBuffer } from './cell-buffer.js';
import { renderEmbarkationScreen } from './embarkation-screen.js';
import { generateModalUiBuffer } from './modal-buffer-router.js';
import { renderTacticalConsole } from './tactical-console.js';

export interface DiegeticComposerParams {
  readonly isCreatorOpen: boolean;
  readonly embarkConfig: CharacterCreationConfig;
  readonly activeModal: ModalWindowId | null;
  readonly useDiegeticCanvasUi: boolean;
  readonly worldState: WorldState;
  readonly playerId: EntityId;
  readonly width: number;
  readonly height: number;
  readonly inspectedTile: { x: number; y: number } | null;
  readonly isLookModeActive: boolean;
}

export interface DiegeticHitCallbacks {
  readonly onSelectProfession: (prof: ProfessionId) => void;
  readonly onToggleTrait: (trait: TraitId) => void;
  readonly onSelectScenario: (scen: ScenarioId) => void;
  readonly onEmbark: () => void;
  readonly onOpenModal: (w: ModalWindowId) => void;
  readonly onOpenSystemMenu: () => void;
  readonly onDispatchCommand: (cmd: GameCommand) => void;
}

/**
 * Composes the primary Canvas UI buffer based on game session mode:
 * - Full-screen Embarkation Registry book when creating character
 * - Full-screen modal buffer when inventory/workbench/anatomy is active
 * - High-density mechanical sidebar console during normal exploration
 */
export function composeDiegeticUiBuffer(params: DiegeticComposerParams): UiCellBuffer | undefined {
  if (!params.useDiegeticCanvasUi) return undefined;

  if (params.isCreatorOpen) {
    const buf = createUiCellBuffer(params.width, params.height);
    renderEmbarkationScreen(
      buf,
      { x: 2, y: 1, width: params.width - 4, height: params.height - 2 },
      { config: params.embarkConfig },
    );
    return buf;
  }

  if (params.activeModal) {
    return generateModalUiBuffer(
      params.activeModal,
      params.worldState,
      params.playerId,
      params.width,
      params.height,
    );
  }

  // Tactical Gameplay Console with transparent tactical viewport area
  const buf = createUiCellBuffer(params.width, params.height, {
    glyph: ' ',
    fg: '#000000',
    bg: 'transparent',
  });
  renderTacticalConsole(
    buf,
    { x: 60, y: 0, width: 28, height: params.height },
    params.worldState,
    params.playerId,
    {
      hoveredTile: params.inspectedTile,
      isLookModeActive: params.isLookModeActive,
    },
  );
  return buf;
}

/**
 * Routes interactive click hit actions to character creation, modal navigation, or sim commands.
 */
export function handleDiegeticHitAction(
  hit: string,
  callbacks: DiegeticHitCallbacks,
  state: WorldState,
  playerId: EntityId,
): boolean {
  if (hit.startsWith('select_prof:')) {
    callbacks.onSelectProfession(hit.replace('select_prof:', '') as ProfessionId);
    return true;
  }
  if (hit.startsWith('toggle_trait:')) {
    callbacks.onToggleTrait(hit.replace('toggle_trait:', '') as TraitId);
    return true;
  }
  if (hit.startsWith('select_scen:')) {
    callbacks.onSelectScenario(hit.replace('select_scen:', '') as ScenarioId);
    return true;
  }
  if (hit === 'embark_action') {
    callbacks.onEmbark();
    return true;
  }
  if (hit === 'open_inventory') {
    callbacks.onOpenModal('INVENTORY');
    return true;
  }
  if (hit === 'open_anatomy') {
    callbacks.onOpenModal('ANATOMY');
    return true;
  }
  if (hit === 'open_workbench') {
    callbacks.onOpenModal('WORKBENCH');
    return true;
  }
  if (hit === 'open_menu') {
    callbacks.onOpenSystemMenu();
    return true;
  }

  const cmd = resolveDiegeticClickHit(hit, state, playerId);
  if (cmd) {
    callbacks.onDispatchCommand(cmd);
    return true;
  }
  return false;
}
