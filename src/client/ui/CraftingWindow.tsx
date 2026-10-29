import { useEffect, useState } from 'preact/hooks';
import { GameCommand } from '../../schemas/commands.schema.js';
import { EntityRecord } from '../../schemas/components.schema.js';
import { EntityId } from '../../schemas/primitives.schema.js';
import { RECIPE_CATALOG } from '../../sim/data/item-catalog.js';
import { WorldState } from '../../sim/core/world.js';
import { CraftFilter, CraftingRecipeList } from './CraftingRecipeList.js';

export interface CraftingWindowProps {
  readonly state: Readonly<WorldState>;
  readonly actorId: EntityId;
  readonly onCommand: (cmd: GameCommand) => void;
}

export function CraftingWindow({ state, actorId, onCommand }: CraftingWindowProps) {
  const actor = state.entities[actorId];
  const pos = actor?.position;
  const inv = actor?.inventory;
  const currentSteam = actor?.anatomy?.steamReserveKpa ?? 0;

  const [selectedIdx, setSelectedIdx] = useState<number>(0);
  const [filter, setFilter] = useState<CraftFilter>('ALL');
  const [confirmingItemId, setConfirmingItemId] = useState<string | null>(null);

  // Check workbench adjacency
  const nearbyBench = pos
    ? Object.values(state.entities).find((e) => {
        if (!e.workbench || !e.position || e.position.stratum !== pos.stratum) return false;
        return Math.max(Math.abs(e.position.x - pos.x), Math.abs(e.position.y - pos.y)) <= 1;
      })
    : undefined;

  // Calculate held ingredient counts
  const heldItems = (inv?.containedEntityIds ?? [])
    .map((id) => state.entities[id])
    .filter((e): e is EntityRecord => e !== undefined);

  const ingredientCounts: Record<string, number> = {};
  for (const item of heldItems) {
    const bp = item.item?.blueprintId ?? item.prostheticSpec?.blueprintId;
    if (bp) {
      ingredientCounts[bp] = (ingredientCounts[bp] ?? 0) + (item.item?.quantity ?? 1);
    }
  }

  const filteredRecipes = RECIPE_CATALOG.filter((recipe) => {
    const isUnlocked = !recipe.requiresManual || (actor?.anatomy?.unlockedRecipeIds ?? []).includes(recipe.id);
    const canCraft = isUnlocked && currentSteam >= recipe.steamCostKpa && (!recipe.requiresWorkbench || Boolean(nearbyBench))
      && recipe.ingredients.every((ing) => (ingredientCounts[ing.blueprintId] ?? 0) >= ing.count);
    return filter === 'CRAFTABLE' ? canCraft : filter === 'FIELD' ? !recipe.requiresWorkbench : filter === 'BENCH' ? recipe.requiresWorkbench : true;
  });

  const selectedRecipe = filteredRecipes[selectedIdx] ?? filteredRecipes[0] ?? RECIPE_CATALOG[0];

  // Keyboard navigation for list scrolling [W/S / Arrow keys], [1-9] recipe selection, and [c] forge
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === 'ArrowUp' || e.key.toLowerCase() === 'w') { e.preventDefault(); setSelectedIdx((p) => Math.max(0, p - 1)); return; }
      if (e.key === 'ArrowDown' || e.key.toLowerCase() === 's') { e.preventDefault(); setSelectedIdx((p) => Math.min(filteredRecipes.length - 1, p + 1)); return; }
      const num = parseInt(e.key, 10);
      if (!Number.isNaN(num) && num >= 1 && num <= filteredRecipes.length) { e.preventDefault(); setSelectedIdx(num - 1); return; }

      if (e.key.toLowerCase() === 'c' && selectedRecipe) {
        const isUnlocked = !selectedRecipe.requiresManual || (actor?.anatomy?.unlockedRecipeIds ?? []).includes(selectedRecipe.id);
        const hasSteam = currentSteam >= selectedRecipe.steamCostKpa;
        const benchOk = !selectedRecipe.requiresWorkbench || Boolean(nearbyBench);
        const hasIngredients = selectedRecipe.ingredients.every((ing) => (ingredientCounts[ing.blueprintId] ?? 0) >= ing.count);
        if (isUnlocked && hasSteam && benchOk && hasIngredients) {
          e.preventDefault();
          onCommand({ type: 'CRAFT_RECIPE', actorId, recipeId: selectedRecipe.id });
        }
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [selectedRecipe, filteredRecipes.length, currentSteam, nearbyBench, ingredientCounts, actorId, onCommand, actor?.anatomy?.unlockedRecipeIds]);

  if (!actor || !pos || !inv || !selectedRecipe) return null;

  const isSelectedUnlocked = !selectedRecipe.requiresManual || (actor.anatomy?.unlockedRecipeIds ?? []).includes(selectedRecipe.id);
  const hasSteam = currentSteam >= selectedRecipe.steamCostKpa;
  const benchOk = !selectedRecipe.requiresWorkbench || Boolean(nearbyBench);
  const hasIngredients = selectedRecipe.ingredients.every(
    (ing) => (ingredientCounts[ing.blueprintId] ?? 0) >= ing.count,
  );
  const canCraft = isSelectedUnlocked && hasSteam && benchOk && hasIngredients;

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '14px', flex: 1 }}>
      {/* Left Column: Recipe Catalog with Readiness Badges */}
      <CraftingRecipeList
        filteredRecipes={filteredRecipes}
        selectedIdx={selectedIdx}
        filter={filter}
        nearbyBench={nearbyBench}
        currentSteam={currentSteam}
        ingredientCounts={ingredientCounts}
        onSelectRecipe={setSelectedIdx}
        onSetFilter={(f) => { setFilter(f); setSelectedIdx(0); }}
      />

      {/* Right Column: Active Blueprint Schematic & Quick Salvage */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        <div class="panel-box" style={{ background: '#0d1316', border: '1px solid #2e4053' }}>
          <div class="panel-header" style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span class="brass-text">{selectedRecipe.name}</span>
            <span class="muted" style={{ fontSize: '10px' }}>{selectedRecipe.steamCostKpa} kPa Steam</span>
          </div>
          <div style={{ fontSize: '11px', color: '#d5dbdb', fontStyle: 'italic', margin: '6px 0 10px 0' }}>
            "{selectedRecipe.description}"
          </div>

          <div class="panel-header" style={{ fontSize: '11px' }}>REQUIRED INGREDIENTS</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '11px', marginBottom: '12px' }}>
            {selectedRecipe.ingredients.map((ing) => {
              const owned = ingredientCounts[ing.blueprintId] ?? 0;
              const ok = owned >= ing.count;
              const cleanName = ing.blueprintId.replace(/^mat_|^item_/, '').replace(/_/g, ' ');
              return (
                <div key={ing.blueprintId} class="stat-row">
                  <span>{cleanName}:</span>
                  <span class={ok ? 'ok-text' : 'warn-text'}>
                    {owned} / {ing.count} {ok ? '✓' : '✗'}
                  </span>
                </div>
              );
            })}
          </div>

          <button
            type="button"
            disabled={!canCraft}
            onClick={() => onCommand({ type: 'CRAFT_RECIPE', actorId, recipeId: selectedRecipe.id })}
            style={{
              width: '100%',
              padding: '6px 10px',
              fontSize: '12px',
              fontWeight: 'bold',
              textAlign: 'center',
              color: canCraft ? 'var(--brass-gold)' : '#7f8c8d',
              background: canCraft ? '#243342' : '#11171a',
              border: canCraft ? '1px solid var(--brass-gold)' : '1px solid #2e4053',
              cursor: canCraft ? 'pointer' : 'not-allowed',
            }}
          >
            [C] {isSelectedUnlocked ? `Forge Blueprint (${selectedRecipe.steamCostKpa} kPa)` : 'Locked (Schematic Manual Required)'}
          </button>
        </div>

        {/* Quick Scrap Salvaging */}
        <div class="panel-box" style={{ flex: 1, overflowY: 'auto' }}>
          <div class="panel-header">SALVAGE UNWANTED GEAR INTO BRASS</div>
          {heldItems.length === 0 ? (
            <div class="log-entry muted" style={{ fontSize: '10px' }}>Satchel holds no gear to salvage.</div>
          ) : (
            heldItems.map((item) => {
              const isRare = Boolean(item.prostheticSpec || item.item?.category === 'EQUIPMENT');
              const yieldText = isRare || item.item?.category === 'COMMODITY' || item.item?.blueprintId === 'mat_cast_iron_plate'
                ? '2x Brass (0 kPa)' : '1x Rubber (0 kPa)';
              const isConfirming = confirmingItemId === item.id;
              return (
                <div key={item.id} class="stat-row" style={{ alignItems: 'center', fontSize: '11px' }}>
                  <span>{item.visual.glyph} {item.name} <span class="muted" style={{ fontSize: '9px' }}>[{yieldText}]</span></span>
                  <button
                    type="button"
                    onClick={() => {
                      if (isRare && !isConfirming) {
                        setConfirmingItemId(item.id);
                        return;
                      }
                      setConfirmingItemId(null);
                      onCommand({ type: 'SALVAGE_ITEM', actorId, itemEntityId: item.id });
                    }}
                    style={{
                      padding: '2px 5px', fontSize: '9px',
                      color: isConfirming ? 'var(--warn-red)' : '#e67e22',
                      borderColor: isConfirming ? 'var(--warn-red)' : undefined,
                    }}
                  >
                    {isConfirming ? '[Confirm Salvage?]' : 'Salvage'}
                  </button>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
