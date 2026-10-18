import { useEffect, useState } from 'preact/hooks';
import { GameCommand } from '../../schemas/commands.schema.js';
import { EntityRecord } from '../../schemas/components.schema.js';
import { EntityId } from '../../schemas/primitives.schema.js';
import { RECIPE_CATALOG } from '../../sim/data/item-catalog.js';
import { WorldState } from '../../sim/core/world.js';

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

  const selectedRecipe = RECIPE_CATALOG[selectedIdx] ?? RECIPE_CATALOG[0];

  // Keyboard navigation for [1-9] recipe selection and [c] forge
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const num = parseInt(e.key, 10);
      if (!Number.isNaN(num) && num >= 1 && num <= RECIPE_CATALOG.length) {
        e.preventDefault();
        setSelectedIdx(num - 1);
        return;
      }

      if (e.key.toLowerCase() === 'c' && selectedRecipe) {
        const hasSteam = currentSteam >= selectedRecipe.steamCostKpa;
        const benchOk = !selectedRecipe.requiresWorkbench || Boolean(nearbyBench);
        const hasIngredients = selectedRecipe.ingredients.every(
          (ing) => (ingredientCounts[ing.blueprintId] ?? 0) >= ing.count,
        );
        if (hasSteam && benchOk && hasIngredients) {
          e.preventDefault();
          onCommand({ type: 'CRAFT_RECIPE', actorId, recipeId: selectedRecipe.id });
        }
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [selectedRecipe, currentSteam, nearbyBench, ingredientCounts, actorId, onCommand]);

  if (!actor || !pos || !inv || !selectedRecipe) return null;

  const hasSteam = currentSteam >= selectedRecipe.steamCostKpa;
  const benchOk = !selectedRecipe.requiresWorkbench || Boolean(nearbyBench);
  const hasIngredients = selectedRecipe.ingredients.every(
    (ing) => (ingredientCounts[ing.blueprintId] ?? 0) >= ing.count,
  );
  const canCraft = hasSteam && benchOk && hasIngredients;

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '14px', flex: 1 }}>
      {/* Left Column: Recipe Catalog with Readiness Badges */}
      <div class="panel-box" style={{ display: 'flex', flexDirection: 'column' }}>
        <div class="panel-header" style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span>SCHEMATIC BLUEPRINTS</span>
          <span class="muted" style={{ fontSize: '10px' }}>[1–{RECIPE_CATALOG.length}] select</span>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', overflowY: 'auto', flex: 1 }}>
          {RECIPE_CATALOG.map((recipe, idx) => {
            const isSelected = idx === selectedIdx;
            const rSteam = currentSteam >= recipe.steamCostKpa;
            const rBench = !recipe.requiresWorkbench || Boolean(nearbyBench);
            const rIng = recipe.ingredients.every(
              (ing) => (ingredientCounts[ing.blueprintId] ?? 0) >= ing.count,
            );
            const rReady = rSteam && rBench && rIng;

            const badge = rReady
              ? { text: 'READY', color: 'var(--ok-green)' }
              : !rBench
                ? { text: 'NEEDS BENCH', color: 'var(--brass-gold)' }
                : !rSteam
                  ? { text: 'LOW STEAM', color: 'var(--oxidized-copper)' }
                  : { text: 'MISSING PARTS', color: 'var(--warn-red)' };

            return (
              <div
                key={recipe.id}
                onClick={() => setSelectedIdx(idx)}
                style={{
                  padding: '6px 8px',
                  background: isSelected ? '#1c2833' : '#0d1316',
                  border: isSelected ? '1px solid var(--brass-gold)' : '1px solid #1c2833',
                  cursor: 'pointer',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '12px', color: isSelected ? 'var(--brass-gold)' : '#d5dbdb' }}>
                    <span class="copper-text" style={{ marginRight: '6px' }}>[{idx + 1}]</span>
                    {recipe.name}
                  </span>
                  <span style={{ fontSize: '9px', color: badge.color, border: `1px solid ${badge.color}`, padding: '1px 4px' }}>
                    {badge.text}
                  </span>
                </div>
                <div style={{ fontSize: '10px', color: '#7f8c8d', marginTop: '2px' }}>
                  {recipe.steamCostKpa} kPa &nbsp;|&nbsp; {recipe.requiresWorkbench ? 'Artificer Bench' : 'Field Craftable'}
                </div>
              </div>
            );
          })}
        </div>

        <div style={{ borderTop: '1px solid #2e4053', paddingTop: '8px', marginTop: 'auto' }}>
          <div class="stat-row" style={{ fontSize: '11px' }}>
            <span>Artificer Bench Status:</span>
            <span class={nearbyBench ? 'ok-text' : 'muted'}>
              {nearbyBench ? `Adjacent (${nearbyBench.workbench!.stationType})` : 'None in proximity'}
            </span>
          </div>
          <div class="stat-row" style={{ fontSize: '11px' }}>
            <span>Available Boiler Steam:</span>
            <span class="copper-text">{currentSteam} kPa</span>
          </div>
        </div>
      </div>

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
            [C] Forge Blueprint ({selectedRecipe.steamCostKpa} kPa)
          </button>
        </div>

        {/* Quick Scrap Salvaging */}
        <div class="panel-box" style={{ flex: 1, overflowY: 'auto' }}>
          <div class="panel-header">SALVAGE UNWANTED GEAR INTO BRASS</div>
          {heldItems.length === 0 ? (
            <div class="log-entry muted" style={{ fontSize: '10px' }}>Satchel holds no gear to salvage.</div>
          ) : (
            heldItems.map((item) => (
              <div key={item.id} class="stat-row" style={{ alignItems: 'center', fontSize: '11px' }}>
                <span>{item.visual.glyph} {item.name}</span>
                <button
                  type="button"
                  onClick={() => onCommand({ type: 'SALVAGE_ITEM', actorId, itemEntityId: item.id })}
                  style={{ padding: '2px 6px', fontSize: '10px', color: '#e67e22' }}
                >
                  Salvage
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
