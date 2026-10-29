import { BlueprintId, EntityId } from '../../schemas/primitives.schema.js';
import { WorldState } from '../../sim/core/world.js';
import { UiCellBuffer } from './cell-buffer.js';
import { drawIndustrialFrame } from './industrial-primitives.js';
import { VICTORIAN_PALETTE } from './material-palette.js';
import { countInventoryItem, renderBenchDossierPanel } from './bench-dossier-panel.js';
import { UiRect } from './viewport-controls.js';
import recipesData from '../../../data/items/recipes.json' with { type: 'json' };

export type BenchCategory = 'ALL' | 'WEAPONS' | 'PROSTHETICS' | 'STEAM' | 'ALCHEMY';

export interface ArtificerBenchRecipe {
  readonly id: string;
  readonly name: string;
  readonly description?: string;
  readonly steamCostKpa: number;
  readonly apCost?: number;
  readonly outputBlueprintId?: string;
  readonly outputQuantity?: number;
  readonly requiresWorkbench?: boolean;
  readonly stationType?: string;
  readonly ingredients?: readonly { readonly blueprintId: string; readonly count: number }[];
}

export interface ArtificerBenchOptions {
  readonly selectedRecipeId?: BlueprintId | string;
  readonly scrollOffset?: number;
  readonly activeCategory?: BenchCategory;
  readonly customRecipes?: readonly ArtificerBenchRecipe[];
}

const DEFAULT_BENCH_RECIPES: readonly ArtificerBenchRecipe[] = [
  ...(recipesData as readonly ArtificerBenchRecipe[]),
  {
    id: 'recipe_boiler_core_50kpa',
    name: 'Cast 50 kPa Internal Boiler Core',
    description: 'Reinforced 50 kPa boiler core forged with triple-riveted soot-iron plates.',
    steamCostKpa: 50,
    apCost: 150,
    outputBlueprintId: 'item_boiler_core_50kpa',
  },
];

const CATEGORIES: readonly BenchCategory[] = ['ALL', 'WEAPONS', 'PROSTHETICS', 'STEAM', 'ALCHEMY'];

function matchesCategory(recipe: ArtificerBenchRecipe, cat: BenchCategory): boolean {
  if (cat === 'ALL') return true;
  const out = (recipe.outputBlueprintId ?? '').toLowerCase();
  const id = recipe.id.toLowerCase();
  const name = recipe.name.toLowerCase();
  if (cat === 'PROSTHETICS') return out.startsWith('prosthetic') || id.includes('prosthetic') || name.includes('leg') || name.includes('arm');
  if (cat === 'ALCHEMY') return out.includes('tonic') || out.includes('salt') || out.includes('salve') || id.includes('coagulant') || id.includes('brew');
  if (cat === 'WEAPONS') return out.startsWith('weapon') || id.includes('blade') || id.includes('revolver') || id.includes('pistol') || id.includes('rifle');
  if (cat === 'STEAM') return out.includes('steam') || out.includes('boiler') || out.includes('canister') || recipe.steamCostKpa >= 20;
  return true;
}

export function renderArtificerBenchScreen(
  buf: UiCellBuffer,
  rect: UiRect,
  state: Readonly<WorldState>,
  options: ArtificerBenchOptions = {},
  playerId?: EntityId,
): void {
  const { selectedRecipeId, scrollOffset = 0, activeCategory = 'ALL', customRecipes } = options;
  const allRecipes = customRecipes ?? DEFAULT_BENCH_RECIPES;
  const filteredRecipes = allRecipes.filter((r) => matchesCategory(r, activeCategory));

  // 1. Reinforced heavy iron housing
  drawIndustrialFrame(buf, rect, {
    tier: 'PRIMARY_IRON',
    title: 'ARTIFICER WORKSTATION & HIGH-PRESSURE STEAM LATHE',
  });

  // 2. Faint CP437 gear & blueprint schematics in background
  for (let y = rect.y + 1; y < rect.y + rect.height - 1; y++) {
    for (let x = rect.x + 1; x < rect.x + rect.width - 1; x++) {
      if ((x * 7 + y * 13) % 29 === 0) {
        buf.setCell(x, y, '⚙', VICTORIAN_PALETTE.OXIDIZED_IRON, VICTORIAN_PALETTE.SOOT_IRON_BG);
      }
    }
  }

  // 3. Furnace / chimney smoke mask rows
  const bottomSmokeY = rect.y + rect.height - 3;
  for (let sx = rect.x + 2; sx < rect.x + rect.width - 2; sx++) {
    buf.setCell(sx, bottomSmokeY, '░', VICTORIAN_PALETTE.OXIDIZED_IRON, VICTORIAN_PALETTE.SOOT_IRON_BG, ['SMOKE_MASK_REGION']);
    buf.setCell(sx, bottomSmokeY + 1, '▒', '#261f18', VICTORIAN_PALETTE.SOOT_IRON_BG, ['SMOKE_MASK_REGION']);
  }

  const isWidescreen = rect.width >= 70;
  const player = playerId ? state.entities[playerId] : undefined;
  const playerSteam = player?.anatomy?.steamReserveKpa ?? 0;

  // 4. Header & Category Tabs
  const contentX = rect.x + 2;
  const leftWidth = isWidescreen ? 38 : rect.width - 4;
  const dividerX = rect.x + 41;
  const rightX = rect.x + 43;
  const rightWidth = rect.width - 45;

  if (isWidescreen) {
    let tabStr = '─[ BLUEPRINTS ]';
    for (const cat of CATEGORIES) {
      tabStr += ` [ ${cat} ]`;
    }
    buf.writeString(contentX, rect.y + 2, tabStr, VICTORIAN_PALETTE.TARNISHED_BRASS, VICTORIAN_PALETTE.SOOT_IRON_BG);
    buf.writeString(contentX, rect.y + 3, '─[ SCHEMATIC CATALOG ]────────────────', VICTORIAN_PALETTE.TARNISHED_BRASS, VICTORIAN_PALETTE.SOOT_IRON_BG);
    buf.writeString(rightX, rect.y + 3, '═[ SCHEMATIC DOSSIER ]═', VICTORIAN_PALETTE.TARNISHED_BRASS, VICTORIAN_PALETTE.SOOT_IRON_BG);

    for (let dy = rect.y + 3; dy < rect.y + rect.height - 2; dy++) {
      buf.setCell(dividerX, dy, '│', VICTORIAN_PALETTE.MUTED_PIPE, VICTORIAN_PALETTE.SOOT_IRON_BG);
    }
  } else {
    buf.writeString(contentX, rect.y + 2, '─[ HIGH-PRESSURE BLUEPRINTS ]──────────────────', VICTORIAN_PALETTE.TARNISHED_BRASS, VICTORIAN_PALETTE.SOOT_IRON_BG);
  }

  // 5. Recipe list (starts at rect.y + 4)
  const maxRecipeRows = Math.max(1, rect.height - 7);
  const activeRecipe = (selectedRecipeId ? filteredRecipes.find((r) => r.id === selectedRecipeId) : undefined) ?? filteredRecipes[0];

  for (let idx = 0; idx < maxRecipeRows; idx++) {
    const rIdx = scrollOffset + idx;
    const recipe = filteredRecipes[rIdx];
    if (!recipe) continue;

    const rowY = rect.y + 4 + idx;
    const isSelected = activeRecipe?.id === recipe.id;
    const isHighPressure = recipe.steamCostKpa >= 50;

    const hasSteam = playerSteam >= recipe.steamCostKpa;
    let hasIngredients = true;
    for (const ing of recipe.ingredients ?? []) {
      if (countInventoryItem(state, playerId, ing.blueprintId) < ing.count) {
        hasIngredients = false;
        break;
      }
    }
    const craftable = hasSteam && hasIngredients;

    const shaderFlags: string[] = [];
    if (isHighPressure && isSelected) {
      shaderFlags.push('TREMOR_JITTER');
    }
    if (isHighPressure) {
      shaderFlags.push('THERMO_CRITICAL_PULSE');
    }

    const prefix = isSelected ? '► ' : '  ';
    const statusIcon = isWidescreen ? (craftable ? '[+] ' : '[-] ') : '';
    const nameStr = recipe.name.length > 22 ? recipe.name.slice(0, 21) + '…' : recipe.name.padEnd(22, ' ');
    const pressureTag = `[${recipe.steamCostKpa.toString().padStart(2, ' ')} kPa]`;
    const line = `${prefix}${statusIcon}${nameStr} ${pressureTag}`;

    let lineFg: string = VICTORIAN_PALETTE.SEPIA_INK;
    if (isHighPressure) {
      lineFg = VICTORIAN_PALETTE.INCANDESCENT_RED;
    } else if (isSelected) {
      lineFg = VICTORIAN_PALETTE.AETHER_BLUE;
    }

    const lineBg = isSelected ? VICTORIAN_PALETTE.OXIDIZED_IRON : VICTORIAN_PALETTE.SOOT_IRON_BG;
    buf.writeString(contentX, rowY, line.slice(0, leftWidth), lineFg, lineBg, shaderFlags.length > 0 ? shaderFlags : undefined, `craft_recipe:${recipe.id}`);
  }

  // 6. Right Column (Schematic Dossier in widescreen)
  if (isWidescreen && activeRecipe) {
    renderBenchDossierPanel(buf, rect, rightX, rightWidth, state, playerId, activeRecipe, playerSteam);
  }

  // 7. Navigation Footer
  const footerY = rect.y + rect.height - 2;
  buf.writeString(contentX, footerY, '[←/→] Filter  [↑/↓] Select  [Enter] Craft  [Esc] Exit', VICTORIAN_PALETTE.MUTED_PIPE, VICTORIAN_PALETTE.SOOT_IRON_BG);
}
