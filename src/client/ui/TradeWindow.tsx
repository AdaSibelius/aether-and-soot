import { useEffect, useState } from 'preact/hooks';
import { GameCommand } from '../../schemas/commands.schema.js';
import { EntityRecord } from '../../schemas/components.schema.js';
import { EntityId } from '../../schemas/primitives.schema.js';
import { WorldState } from '../../sim/core/world.js';
import { computeBuyUnitPrice, computeSellUnitPrice } from '../../sim/systems/trade.system.js';
import { CartelLedgerView } from './CartelLedgerView.js';

export interface TradeWindowProps {
  readonly state: Readonly<WorldState>;
  readonly actorId: EntityId;
  readonly onCommand: (cmd: GameCommand) => void;
}

export function TradeWindow({ state, actorId, onCommand }: TradeWindowProps) {
  const actor = state.entities[actorId];
  const pos = actor?.position;
  const playerInv = actor?.inventory;
  const treasury = state.economy.playerTreasuryPence;

  // Find adjacent merchant
  const adjacentMerchant = pos
    ? Object.values(state.entities).find((e) => {
        if (!e.aiController || e.aiController.role !== 'MERCHANT' || !e.position) return false;
        if (e.position.stratum !== pos.stratum) return false;
        return Math.max(Math.abs(e.position.x - pos.x), Math.abs(e.position.y - pos.y)) <= 1;
      })
    : undefined;

  const [activeSubTab, setActiveSubTab] = useState<'COUNTER' | 'LEDGER'>(
    adjacentMerchant ? 'COUNTER' : 'LEDGER',
  );

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key.toLowerCase() === 't') {
        e.preventDefault();
        setActiveSubTab((prev) => (prev === 'COUNTER' ? 'LEDGER' : 'COUNTER'));
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  if (!actor || !pos || !playerInv) return null;

  const merchantItems = (adjacentMerchant?.inventory?.containedEntityIds ?? [])
    .map((id) => state.entities[id])
    .filter((e): e is EntityRecord => e !== undefined);

  const playerItems = playerInv.containedEntityIds
    .map((id) => state.entities[id])
    .filter((e): e is EntityRecord => e !== undefined);

  const factionId = adjacentMerchant?.aiController?.factionId;
  const factionRep = factionId ? (state.economy.factionReputation[factionId] ?? 0) : 0;
  const discountPct = factionRep > 0
    ? Math.min(25, Math.round((factionRep / 100) * 25))
    : factionRep < 0
      ? -Math.min(50, Math.round((-factionRep / 100) * 50))
      : 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, gap: '10px' }}>
      {/* Sub-Header Tabs */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #2e4053', paddingBottom: '6px' }}>
        <div style={{ display: 'flex', gap: '6px' }}>
          <button
            type="button"
            onClick={() => setActiveSubTab('COUNTER')}
            style={{
              padding: '4px 10px',
              fontSize: '11px',
              background: activeSubTab === 'COUNTER' ? '#243342' : 'transparent',
              border: activeSubTab === 'COUNTER' ? '1px solid var(--brass-gold)' : '1px solid #2e4053',
              color: activeSubTab === 'COUNTER' ? 'var(--brass-gold)' : '#7f8c8d',
            }}
          >
            [T] Merchant Counter {adjacentMerchant ? `(${adjacentMerchant.name})` : '(No Merchant)'}
          </button>
          <button
            type="button"
            onClick={() => setActiveSubTab('LEDGER')}
            style={{
              padding: '4px 10px',
              fontSize: '11px',
              background: activeSubTab === 'LEDGER' ? '#243342' : 'transparent',
              border: activeSubTab === 'LEDGER' ? '1px solid var(--brass-gold)' : '1px solid #2e4053',
              color: activeSubTab === 'LEDGER' ? 'var(--brass-gold)' : '#7f8c8d',
            }}
          >
            Cartel &amp; Commodity Ledger
          </button>
        </div>

        <div class="brass-text" style={{ fontSize: '12px' }}>
          Cartel Treasury: {treasury}d (Pence)
        </div>
      </div>

      {/* Sub-Tab 1: Dual-Column Merchant Exchange Counter */}
      {activeSubTab === 'COUNTER' && (
        <>
          {!adjacentMerchant ? (
            <div class="panel-box" style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
              <div class="panel-header" style={{ width: '100%', textAlign: 'center' }}>NO GUILD MERCHANT IN PROXIMITY</div>
              <div class="muted" style={{ fontSize: '11px', margin: '14px 0', textAlign: 'center', maxWidth: '420px', lineHeight: '1.6' }}>
                You must be standing directly adjacent to a Guild Merchant or Market Stallkeeper to conduct transactions. Explore the Street or Market Hall to locate a trader.
              </div>
              <button
                type="button"
                onClick={() => setActiveSubTab('LEDGER')}
                style={{ padding: '6px 12px', fontSize: '11px' }}
              >
                View District Cartel &amp; Commodity Ledger &gt;&gt;
              </button>
            </div>
          ) : (
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
          )}
        </>
      )}

      {/* Sub-Tab 2: Victorian Cartel & Commodity Ledger */}
      {activeSubTab === 'LEDGER' && (
        <CartelLedgerView economy={state.economy} actorId={actorId} entities={state.entities} onCommand={onCommand} />
      )}
    </div>
  );
}
