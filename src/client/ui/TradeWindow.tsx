import { useEffect, useState } from 'preact/hooks';
import { GameCommand } from '../../schemas/commands.schema.js';
import { EntityRecord } from '../../schemas/components.schema.js';
import { EntityId } from '../../schemas/primitives.schema.js';
import { WorldState } from '../../sim/core/world.js';
import { CartelLedgerView } from './CartelLedgerView.js';
import { MerchantCounterView } from './MerchantCounterView.js';

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
            <MerchantCounterView
              state={state}
              actorId={actorId}
              adjacentMerchant={adjacentMerchant}
              treasury={treasury}
              playerItems={playerItems}
              discountPct={discountPct}
              onCommand={onCommand}
            />
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
