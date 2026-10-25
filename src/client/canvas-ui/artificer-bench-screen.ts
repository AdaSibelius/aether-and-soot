import { BlueprintId } from '../../schemas/primitives.schema.js';
import { WorldState } from '../../sim/core/world.js';
import { UiCellBuffer } from './cell-buffer.js';
import { drawIndustrialFrame } from './industrial-primitives.js';
import { VICTORIAN_PALETTE } from './material-palette.js';
import { UiRect } from './viewport-controls.js';
import recipesData from '../../../data/items/recipes.json' with { type: 'json' };

export interface ArtificerBenchRecipe {
  readonly id: string;
  readonly name: string;
  readonly steamCostKpa: number;
  readonly apCost?: number;
  readonly outputBlueprintId?: string;
}

export interface ArtificerBenchOptions {
  readonly selectedRecipeId?: BlueprintId | string;
  readonly scrollOffset?: number;
  readonly customRecipes?: readonly ArtificerBenchRecipe[];
}

const DEFAULT_BENCH_RECIPES: readonly ArtificerBenchRecipe[] = [
  ...recipesData.map((r) => ({
    id: r.id,
    name: r.name,
    steamCostKpa: r.steamCostKpa,
    apCost: r.apCost,
    outputBlueprintId: r.outputBlueprintId,
  })),
  {
    id: 'recipe_boiler_core_50kpa',
    name: 'Cast 50 kPa Internal Boiler Core',
    steamCostKpa: 50,
    apCost: 150,
    outputBlueprintId: 'item_boiler_core_50kpa',
  },
];

export function renderArtificerBenchScreen(
  buf: UiCellBuffer,
  rect: UiRect,
  _state: Readonly<WorldState>,
  options: ArtificerBenchOptions = {},
): void {
  const { selectedRecipeId, scrollOffset = 0, customRecipes } = options;
  const recipes = customRecipes ?? DEFAULT_BENCH_RECIPES;

  // 1. Reinforced heavy iron housing
  drawIndustrialFrame(buf, rect, {
    tier: 'PRIMARY_IRON',
    title: 'ARTIFICER WORKSTATION & STEAM LATHE',
  });

  // 2. Faint CP437 gear & blueprint schematics in empty background regions
  for (let y = rect.y + 1; y < rect.y + rect.height - 1; y++) {
    for (let x = rect.x + 1; x < rect.x + rect.width - 1; x++) {
      if ((x * 7 + y * 13) % 29 === 0) {
        buf.setCell(x, y, '⚙', VICTORIAN_PALETTE.OXIDIZED_IRON, VICTORIAN_PALETTE.SOOT_IRON_BG);
      } else if ((x * 5 + y * 11) % 37 === 0) {
        buf.setCell(x, y, '┼', '#1c242b', VICTORIAN_PALETTE.SOOT_IRON_BG);
      } else if ((x * 3 + y * 17) % 43 === 0) {
        buf.setCell(x, y, '─', '#1c242b', VICTORIAN_PALETTE.SOOT_IRON_BG);
      }
    }
  }

  // 3. Tag bottom furnace/chimney rows with localized SMOKE_MASK_REGION flags
  const bottomSmokeY = rect.y + rect.height - 3;
  for (let sx = rect.x + 2; sx < rect.x + rect.width - 2; sx++) {
    buf.setCell(sx, bottomSmokeY, '░', VICTORIAN_PALETTE.OXIDIZED_IRON, VICTORIAN_PALETTE.SOOT_IRON_BG, ['SMOKE_MASK_REGION']);
    buf.setCell(sx, bottomSmokeY + 1, '▒', '#261f18', VICTORIAN_PALETTE.SOOT_IRON_BG, ['SMOKE_MASK_REGION']);
  }

  // 4. Header & Recipe blueprint roster
  const contentX = rect.x + 2;
  const contentWidth = rect.width - 4;
  let curY = rect.y + 2;

  buf.writeString(contentX, curY, '─[ HIGH-PRESSURE BLUEPRINTS ]──────────────────', VICTORIAN_PALETTE.TARNISHED_BRASS, VICTORIAN_PALETTE.SOOT_IRON_BG);
  curY += 2;

  const maxRecipeRows = Math.max(1, rect.height - (curY - rect.y) - 4);

  for (let idx = 0; idx < maxRecipeRows; idx++) {
    const rIdx = scrollOffset + idx;
    const recipe = recipes[rIdx];
    if (!recipe) continue;

    const isSelected = selectedRecipeId === recipe.id;
    const isHighPressure = recipe.steamCostKpa >= 50;
    const rowY = curY + idx;

    // High pressure recipes (>= 50 kPa) trigger mechanical shudder (TREMOR_JITTER)
    const shaderFlags: string[] = [];
    if (isHighPressure && isSelected) {
      shaderFlags.push('TREMOR_JITTER');
    }
    if (isHighPressure) {
      shaderFlags.push('THERMO_CRITICAL_PULSE');
    }

    const prefix = isSelected ? '► [CRAFT] ' : '  [BLUEP] ';
    const pressureTag = `[${recipe.steamCostKpa.toString().padStart(2, ' ')} kPa]`;
    const namePart = recipe.name.padEnd(30, ' ');
    const line = `${prefix}${namePart} ${pressureTag}`;

    let lineFg: string = VICTORIAN_PALETTE.SEPIA_INK;
    if (isHighPressure) {
      lineFg = VICTORIAN_PALETTE.INCANDESCENT_RED;
    } else if (isSelected) {
      lineFg = VICTORIAN_PALETTE.AETHER_BLUE;
    }

    const lineBg = isSelected ? VICTORIAN_PALETTE.OXIDIZED_IRON : VICTORIAN_PALETTE.SOOT_IRON_BG;
    const hitKey = `craft_recipe:${recipe.id}`;

    buf.writeString(contentX, rowY, line.slice(0, contentWidth), lineFg, lineBg, shaderFlags.length > 0 ? shaderFlags : undefined, hitKey);
  }

  // Status footer
  const footerY = rect.y + rect.height - 2;
  buf.writeString(contentX, footerY, 'PNEUMATIC CHUCK: ENGAGED | FURNACE: 50 kPa READY', VICTORIAN_PALETTE.AMBER_GASLIGHT, VICTORIAN_PALETTE.SOOT_IRON_BG);
}
