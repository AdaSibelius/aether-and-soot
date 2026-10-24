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

export function CraftingPanel({ state, actorId, onCommand }: CraftingPanelProps) {
  const actor = state.entities[actorId];
  const pos = actor?.position;
  const inv = actor?.inventory;
  const currentSteam = actor?.anatomy?.steamReserveKpa ?? 0;
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

      <div class="panel-header" style={{ marginTop: '8px' }}>SCHEMATICS &amp; FORMULAS</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {RECIPE_CATALOG.map((recipe) => {
          const hasSteam = currentSteam >= recipe.steamCostKpa;
          const benchOk = !recipe.requiresWorkbench || Boolean(nearbyBench);
          const hasIngredients = recipe.ingredients.every(
            (ing) => (ingredientCounts[ing.blueprintId] ?? 0) >= ing.count,
          );
          const canCraft = hasSteam && benchOk && hasIngredients;

          return (
            <div
              key={recipe.id}
              style={{
                border: '1px solid #1c2833',
                padding: '6px',
                background: '#0d1316',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span class="brass-text" style={{ fontWeight: 'bold' }}>{recipe.name}</span>
                <span class="muted">{recipe.steamCostKpa} kPa</span>
              </div>
              <div class="muted" style={{ fontSize: '10px', margin: '2px 0 4px 0' }}>
                {recipe.description}
              </div>
              <div style={{ fontSize: '10px' }}>
                {recipe.ingredients.map((ing) => {
                  const available = ingredientCounts[ing.blueprintId] ?? 0;
                  const ok = available >= ing.count;
                  return (
                    <span
                      key={ing.blueprintId}
                      class={ok ? 'ok-text' : 'warn-text'}
                      style={{ marginRight: '8px' }}
                    >
                      {resolveCatalogDisplayName('item', ing.blueprintId)}: {available}/{ing.count}
                    </span>
                  );
                })}
              </div>
              <div style={{ marginTop: '4px', textAlign: 'right' }}>
                <button
                  type="button"
                  disabled={!canCraft}
                  style={{ opacity: canCraft ? 1 : 0.5 }}
                  onClick={() =>
                    onCommand({ type: 'CRAFT_RECIPE', actorId, recipeId: recipe.id as any })
                  }
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
        heldItems.map((item) => (
          <div key={item.id} class="stat-row" style={{ alignItems: 'center' }}>
            <span>{item.name}</span>
            <button
              type="button"
              onClick={() => onCommand({ type: 'SALVAGE_ITEM', actorId, itemEntityId: item.id })}
            >
              Salvage
            </button>
          </div>
        ))
      )}
    </div>
  );
}
