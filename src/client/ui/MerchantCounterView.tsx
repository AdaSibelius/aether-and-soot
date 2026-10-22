import { GameCommand } from '../../schemas/commands.schema.js';
import { EntityRecord } from '../../schemas/components.schema.js';
import { EntityId } from '../../schemas/primitives.schema.js';
import { WorldState } from '../../sim/core/world.js';
import { computeBuyUnitPrice, computeSellUnitPrice } from '../../sim/systems/trade.system.js';

export interface MerchantCounterViewProps {
  readonly state: Readonly<WorldState>;
  readonly actorId: EntityId;
  readonly adjacentMerchant: EntityRecord;
  readonly treasury: number;
  readonly playerItems: readonly EntityRecord[];
  readonly discountPct: number;
  readonly onCommand: (cmd: GameCommand) => void;
}

export function MerchantCounterView({
  state,
  actorId,
  adjacentMerchant,
  treasury,
  playerItems,
  discountPct,
  onCommand,
}: MerchantCounterViewProps) {
  const merchantItems = (adjacentMerchant.inventory?.containedEntityIds ?? [])
    .map((id) => state.entities[id])
    .filter((e): e is EntityRecord => e !== undefined);

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1.1fr 1fr', gap: '14px', flex: 1 }}>
      {/* Left Column: Merchant's Stock (Buy) */}
      <div class="panel-box" style={{ display: 'flex', flexDirection: 'column' }}>
        <div class="panel-header" style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span>{adjacentMerchant.name.toUpperCase()} (STOCK)</span>
          <span style={{ fontSize: '10px', color: discountPct > 0 ? 'var(--ok-green)' : discountPct < 0 ? 'var(--warn-red)' : '#7f8c8d' }}>
            {discountPct > 0 ? `+${discountPct}% discount` : discountPct < 0 ? `${discountPct}% surcharge` : 'Par value'}
          </span>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '4px' }}>
          {merchantItems.length === 0 ? (
            <div class="log-entry muted">Merchant is out of stock.</div>
          ) : (
            merchantItems.map((item) => {
              const unitPrice = computeBuyUnitPrice(state, adjacentMerchant, item);
              const qty = item.item?.quantity ?? 1;
              const canAfford = treasury >= unitPrice;

              return (
                <div
                  key={item.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '5px 8px',
                    background: '#0d1316',
                    border: '1px solid #1c2833',
                    fontSize: '11px',
                  }}
                >
                  <span>
                    {item.visual.glyph} {item.name} {qty > 1 ? `(x${qty})` : ''}
                  </span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span class="brass-text">{unitPrice}d</span>
                    <button
                      type="button"
                      disabled={!canAfford}
                      onClick={() =>
                        onCommand({
                          type: 'BUY_FROM_MERCHANT',
                          actorId,
                          merchantId: adjacentMerchant.id,
                          itemEntityId: item.id,
                          quantity: 1,
                        })
                      }
                      style={{ padding: '2px 6px', fontSize: '10px', opacity: canAfford ? 1 : 0.4 }}
                    >
                      Buy
                    </button>
                  </span>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Right Column: Player's Satchel (Sell) */}
      <div class="panel-box" style={{ display: 'flex', flexDirection: 'column' }}>
        <div class="panel-header" style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span>YOUR SATCHEL (SELLABLE GOODS)</span>
          <span class="muted" style={{ fontSize: '10px' }}>{playerItems.length} items</span>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '4px' }}>
          {playerItems.length === 0 ? (
            <div class="log-entry muted">No items carried in satchel.</div>
          ) : (
            playerItems.map((item) => {
              const unitPrice = computeSellUnitPrice(state, adjacentMerchant, item);
              const qty = item.item?.quantity ?? 1;

              return (
                <div
                  key={item.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '5px 8px',
                    background: '#0d1316',
                    border: '1px solid #1c2833',
                    fontSize: '11px',
                  }}
                >
                  <span>
                    {item.visual.glyph} {item.name} {qty > 1 ? `(x${qty})` : ''}
                  </span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span class="copper-text">{unitPrice}d</span>
                    <button
                      type="button"
                      onClick={() =>
                        onCommand({
                          type: 'SELL_TO_MERCHANT',
                          actorId,
                          merchantId: adjacentMerchant.id,
                          itemEntityId: item.id,
                          quantity: 1,
                        })
                      }
                      style={{ padding: '2px 6px', fontSize: '10px' }}
                    >
                      Sell
                    </button>
                  </span>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
