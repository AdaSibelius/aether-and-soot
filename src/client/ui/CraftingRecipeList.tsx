import { EntityRecord } from '../../schemas/components.schema.js';
import { CraftingRecipeBlueprint } from '../../schemas/blueprint.schema.js';

export type CraftFilter = 'ALL' | 'CRAFTABLE' | 'FIELD' | 'BENCH';

export interface CraftingRecipeListProps {
  readonly filteredRecipes: readonly CraftingRecipeBlueprint[];
  readonly selectedIdx: number;
  readonly filter: CraftFilter;
  readonly nearbyBench: EntityRecord | undefined;
  readonly currentSteam: number;
  readonly ingredientCounts: Readonly<Record<string, number>>;
  readonly onSelectRecipe: (idx: number) => void;
  readonly onSetFilter: (f: CraftFilter) => void;
}

export function CraftingRecipeList({
  filteredRecipes,
  selectedIdx,
  filter,
  nearbyBench,
  currentSteam,
  ingredientCounts,
  onSelectRecipe,
  onSetFilter,
}: CraftingRecipeListProps) {
  return (
    <div class="panel-box" style={{ display: 'flex', flexDirection: 'column' }}>
      <div class="panel-header" style={{ display: 'flex', justifyContent: 'space-between' }}>
        <span>SCHEMATIC BLUEPRINTS</span>
        <span class="muted" style={{ fontSize: '10px' }}>[W/S / 1–{filteredRecipes.length}]</span>
      </div>

      {/* Filter Pills */}
      <div style={{ display: 'flex', gap: '3px', margin: '4px 0 6px 0' }}>
        {(['ALL', 'CRAFTABLE', 'FIELD', 'BENCH'] as const).map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => onSetFilter(f)}
            style={{
              padding: '2px 5px',
              fontSize: '9px',
              background: filter === f ? 'var(--brass-gold)' : '#11171a',
              color: filter === f ? '#070a0c' : '#d5dbdb',
              border: '1px solid #2e4053',
            }}
          >
            {f === 'ALL' ? 'All' : f === 'CRAFTABLE' ? 'Craftable Now' : f === 'FIELD' ? 'Field' : 'Bench'}
          </button>
        ))}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', overflowY: 'auto', flex: 1 }}>
        {filteredRecipes.map((recipe, idx) => {
          const isSelected = idx === selectedIdx;
          const stationBadge = !recipe.requiresWorkbench
            ? { text: '[FIELD OK]', color: 'var(--ok-green)' }
            : nearbyBench
            ? { text: '[BENCH OK]', color: 'var(--ok-green)' }
            : { text: '[NEEDS BENCH]', color: 'var(--warn-red)' };
          const reqParts = recipe.ingredients.reduce((a: number, b: { count: number }) => a + b.count, 0);
          const ownedParts = recipe.ingredients.reduce(
            (a: number, b: { blueprintId: string; count: number }) => a + Math.min(b.count, ingredientCounts[b.blueprintId] ?? 0),
            0,
          );
          const reagentBadge =
            ownedParts >= reqParts
              ? { text: '[PARTS OK]', color: 'var(--ok-green)' }
              : { text: `[${ownedParts}/${reqParts} PARTS]`, color: 'var(--warn-red)' };

          return (
            <div
              key={recipe.id}
              onClick={() => onSelectRecipe(idx)}
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
                <div style={{ display: 'flex', gap: '3px' }}>
                  <span style={{ fontSize: '8px', color: stationBadge.color, border: `1px solid ${stationBadge.color}`, padding: '1px 3px' }}>
                    {stationBadge.text}
                  </span>
                  <span style={{ fontSize: '8px', color: reagentBadge.color, border: `1px solid ${reagentBadge.color}`, padding: '1px 3px' }}>
                    {reagentBadge.text}
                  </span>
                </div>
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
  );
}
