import { EntityId, LimbSlotId, StratumId } from '../../schemas/primitives.schema.js';
import { WorldState } from '../../sim/core/world.js';
import { ModalRouterOptions } from '../canvas-ui/modal-buffer-router.js';
import { NaturalistTab } from '../canvas-ui/naturalist-ledger-screen.js';
import { ModalWindowId } from '../ui/CharacterModalShell.js';
import recipesData from '../../../data/items/recipes.json' with { type: 'json' };
export { recipesData };

export interface ModalNavState {
  selectedIndex: number;
  selectedLimbSlot?: LimbSlotId | undefined;
  selectedItemId?: EntityId | undefined;
  selectedRecipeId?: string | undefined;
  selectedSectorId?: string | undefined;
  selectedStratum?: StratumId | undefined;
  selectedCodexEntryId?: string | undefined;
  selectedCodexCategory?: NaturalistTab | undefined;
}

export const ANATOMY_SLOTS: readonly LimbSlotId[] = [
  'HEAD',
  'OCULAR_MOUNT',
  'TORSO',
  'CHASSIS_CORE',
  'LEFT_ARM',
  'RIGHT_ARM',
  'LEFT_LEG',
  'RIGHT_LEG',
];

export const ATLAS_STRATA: readonly StratumId[] = ['CATACOMBS', 'UNDERCROFT', 'STREET', 'SPIRE'];
export const CODEX_TABS: readonly NaturalistTab[] = ['ALL', 'AUTOMATON', 'SCHEMATIC', 'REACTION'];
export const DEFAULT_SECTORS = ['sector_spitalfields', 'sector_limehouse', 'sector_whitechapel', 'sector_belgravia'];
export const DEFAULT_CODEX_IDS = ['codex_clockwork_automaton', 'codex_ocular_hound', 'codex_aether_aeroponic', 'codex_boiler_core'];

export function resolveModalRouterOptions(
  modal: ModalWindowId | null,
  navState: ModalNavState,
  state: Readonly<WorldState>,
  playerId: EntityId,
): ModalRouterOptions {
  if (!modal) return {};
  const player = state.entities[playerId];
  switch (modal) {
    case 'INVENTORY': {
      const items = player?.inventory?.containedEntityIds ?? [];
      const idx = Math.max(0, Math.min(Math.max(0, items.length - 1), navState.selectedIndex));
      const selectedItemId = navState.selectedItemId && items.includes(navState.selectedItemId) ? navState.selectedItemId : items[idx];
      return selectedItemId ? { selectedItemId } : {};
    }
    case 'ANATOMY': {
      const idx = Math.max(0, Math.min(ANATOMY_SLOTS.length - 1, navState.selectedIndex));
      return { selectedLimbSlot: navState.selectedLimbSlot ?? ANATOMY_SLOTS[idx] ?? 'TORSO' };
    }
    case 'WORKBENCH': {
      const idx = Math.max(0, Math.min(Math.max(0, recipesData.length - 1), navState.selectedIndex));
      const selectedRecipeId = navState.selectedRecipeId ?? recipesData[idx]?.id;
      return selectedRecipeId ? { selectedRecipeId } : {};
    }
    case 'EXCHANGE': {
      const sectors = state.turf && Object.keys(state.turf).length > 0 ? Object.keys(state.turf) : DEFAULT_SECTORS;
      const idx = Math.max(0, Math.min(sectors.length - 1, navState.selectedIndex));
      const selectedSectorId = navState.selectedSectorId ?? sectors[idx];
      return selectedSectorId ? { selectedSectorId } : {};
    }
    case 'ATLAS': {
      const defaultIdx = Math.max(0, ATLAS_STRATA.indexOf(player?.position?.stratum ?? 'STREET'));
      const idx = navState.selectedStratum ? ATLAS_STRATA.indexOf(navState.selectedStratum) : (navState.selectedIndex > 0 ? Math.min(ATLAS_STRATA.length - 1, navState.selectedIndex) : defaultIdx);
      return { selectedStratum: navState.selectedStratum ?? ATLAS_STRATA[idx] ?? 'STREET' };
    }
    case 'CODEX': {
      const entries = state.codex && Object.keys(state.codex).length > 0 ? Object.keys(state.codex) : DEFAULT_CODEX_IDS;
      const idx = Math.max(0, Math.min(entries.length - 1, navState.selectedIndex));
      const selectedCodexEntryId = navState.selectedCodexEntryId ?? entries[idx];
      return {
        ...(selectedCodexEntryId ? { selectedCodexEntryId } : {}),
        ...(navState.selectedCodexCategory ? { selectedCodexCategory: navState.selectedCodexCategory } : {}),
      };
    }
    default:
      return {};
  }
}
