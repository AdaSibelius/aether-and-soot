import { useState } from 'preact/hooks';
import { GameCommand } from '../../schemas/commands.schema.js';
import { EntityRecord } from '../../schemas/components.schema.js';
import { EntityId } from '../../schemas/primitives.schema.js';
import { RECIPE_CATALOG } from '../../sim/data/item-catalog.js';
import { WorldState } from '../../sim/core/world.js';
import { resolveCatalogDisplayName } from '../projection/frame-adapter.js';

export interface CraftingPanelProps {
  readonly state: Readonly<WorldState>;
  readonly actorId: EntityId;
  readonly onCommand: (cmd: GameCommand) => void;
}

export type CraftPanelFilter = 'ALL' | 'CRAFTABLE' | 'FIELD' | 'BENCH';

export function CraftingPanel({ state, actorId, onCommand }: CraftingPanelProps) {
  const actor = state.entities[actorId];
  const pos = actor?.position;
  const inv = actor?.inventory;
  const currentSteam = actor?.anatomy?.steamReserveKpa ?? 0;
  const [filter, setFilter] = useState<CraftPanelFilter>('ALL');
  const [confirmingItemId, setConfirmingItemId] = useState<string | null>(null);

  if (!actor || !pos || !inv) return null;

  // Check workbench adjacency
  const nearbyBench = Object.values(state.entities).find((e) => {
    if (!e.workbench || !e.position || e.position.stratum !== pos.stratum) return false;
    return Math.max(Math.abs(e.position.x - pos.x), Math.abs(e.position.y - pos.y)) <= 1;
  });

  // Calculate available ingredient quantities in inventory
  const heldItems = inv.containedEntityIds
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
    const isUnlocked = !recipe.requiresManual || (actor.anatomy?.unlockedRecipeIds ?? []).includes(recipe.id);
    const canCraft = isUnlocked && currentSteam >= recipe.steamCostKpa && (!recipe.requiresWorkbench || Boolean(nearbyBench))
      && recipe.ingredients.every((ing) => (ingredientCounts[ing.blueprintId] ?? 0) >= ing.count);
    return filter === 'CRAFTABLE' ? canCraft : filter === 'FIELD' ? !recipe.requiresWorkbench : filter === 'BENCH' ? recipe.requiresWorkbench : true;
  });

  return (
    <div class="panel-box">
      <div class="panel-header">ARTIFICER'S WORKBENCH [C]</div>
      <div class="stat-row">
        <span>Station Status:</span>
        <span class={nearbyBench ? 'ok-text' : 'muted'}>
          {nearbyBench ? `Adjacent (${nearbyBench.workbench!.stationType})` : 'Field (No Bench)'}
        </span>
      </div>
      <div class="stat-row">
        <span>Steam Reserve:</span>
        <span class="copper-text">{currentSteam} kPa</span>
      </div>

      <div class="panel-header" style={{ marginTop: '8px', display: 'flex', justifyContent: 'space-between' }}>
        <span>SCHEMATICS &amp; FORMULAS</span>
      </div>

      {/* Filter Pills */}
      <div style={{ display: 'flex', gap: '3px', margin: '4px 0 6px 0' }}>
        {(['ALL', 'CRAFTABLE', 'FIELD', 'BENCH'] as const).map((f) => (
          <button key={f} type="button" onClick={() => setFilter(f)}
            style={{ padding: '2px 5px', fontSize: '9px', background: filter === f ? 'var(--brass-gold)' : '#11171a', color: filter === f ? '#070a0c' : '#d5dbdb', border: '1px solid #2e4053' }}>
            {f === 'ALL' ? 'All' : f === 'CRAFTABLE' ? 'Craftable Now' : f === 'FIELD' ? 'Field' : 'Bench'}
          </button>
        ))}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {filteredRecipes.map((recipe) => {
          const hasSteam = currentSteam >= recipe.steamCostKpa;
          const benchOk = !recipe.requiresWorkbench || Boolean(nearbyBench);
          const hasIngredients = recipe.ingredients.every(
            (ing) => (ingredientCounts[ing.blueprintId] ?? 0) >= ing.count,
          );
          const canCraft = hasSteam && benchOk && hasIngredients;

          const stationBadge = !recipe.requiresWorkbench ? { text: '[FIELD OK]', color: 'var(--ok-green)' }
            : nearbyBench ? { text: '[BENCH OK]', color: 'var(--ok-green)' } : { text: '[NEEDS BENCH]', color: 'var(--warn-red)' };
          const reqParts = recipe.ingredients.reduce((a, b) => a + b.count, 0);
          const ownedParts = recipe.ingredients.reduce((a, b) => a + Math.min(b.count, ingredientCounts[b.blueprintId] ?? 0), 0);
          const reagentBadge = ownedParts >= reqParts ? { text: '[PARTS OK]', color: 'var(--ok-green)' } : { text: `[${ownedParts}/${reqParts} PARTS]`, color: 'var(--warn-red)' };

          return (
            <div key={recipe.id} style={{ border: '1px solid #1c2833', padding: '6px', background: '#0d1316' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span class="brass-text" style={{ fontWeight: 'bold' }}>{recipe.name}</span>
                <div style={{ display: 'flex', gap: '3px' }}>
                  <span style={{ fontSize: '8px', color: stationBadge.color, border: `1px solid ${stationBadge.color}`, padding: '1px 3px' }}>{stationBadge.text}</span>
                  <span style={{ fontSize: '8px', color: reagentBadge.color, border: `1px solid ${reagentBadge.color}`, padding: '1px 3px' }}>{reagentBadge.text}</span>
                </div>
              </div>
              <div class="muted" style={{ fontSize: '10px', margin: '2px 0 4px 0' }}>
                {recipe.description} ({recipe.steamCostKpa} kPa)
              </div>
              <div style={{ fontSize: '10px' }}>
                {recipe.ingredients.map((ing) => {
                  const available = ingredientCounts[ing.blueprintId] ?? 0;
                  const ok = available >= ing.count;
                  return (
                    <span key={ing.blueprintId} class={ok ? 'ok-text' : 'warn-text'} style={{ marginRight: '8px' }}>
                      {resolveCatalogDisplayName('item', ing.blueprintId)}: {available}/{ing.count}
                    </span>
                  );
                })}
              </div>
              <div style={{ marginTop: '4px', textAlign: 'right' }}>
                <button
                  type="button"
                  disabled={!canCraft}
                  style={{ opacity: canCraft ? 1 : 0.5, padding: '2px 6px', fontSize: '10px' }}
                  onClick={() => onCommand({ type: 'CRAFT_RECIPE', actorId, recipeId: recipe.id as any })}
                >
                  [Craft]
                </button>
              </div>
            </div>
          );
        })}
      </div>

      <div class="panel-header" style={{ marginTop: '10px' }}>SALVAGE &amp; DISASSEMBLY</div>
      {heldItems.length === 0 ? (
        <div class="log-entry muted">No items to salvage.</div>
      ) : (
        heldItems.map((item) => {
          const isRare = Boolean(item.prostheticSpec || item.item?.category === 'EQUIPMENT');
          const yieldText = isRare || item.item?.category === 'COMMODITY' || item.item?.blueprintId === 'mat_cast_iron_plate'
            ? '2x Brass (0 kPa)' : '1x Rubber (0 kPa)';
          const isConfirming = confirmingItemId === item.id;

          return (
            <div key={item.id} class="stat-row" style={{ alignItems: 'center' }}>
              <span>{item.name} <span class="muted" style={{ fontSize: '9px' }}>[{yieldText}]</span></span>
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
                style={{ padding: '2px 6px', fontSize: '10px', color: isConfirming ? 'var(--warn-red)' : undefined }}
              >
                {isConfirming ? '[Confirm Salvage?]' : 'Salvage'}
              </button>
            </div>
          );
        })
      )}
    </div>
  );
}
