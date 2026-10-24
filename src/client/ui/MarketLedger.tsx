import { useState } from 'preact/hooks';
import { GameCommand } from '../../schemas/commands.schema.js';
import { CommodityId, EntityIdSchema, FactionId } from '../../schemas/primitives.schema.js';
import { FactionContract } from '../../schemas/contracts.schema.js';
import { DistrictEconomyLedger } from '../../sim/systems/economy.system.js';

export interface MarketLedgerProps {
  readonly economy: Readonly<DistrictEconomyLedger>;
  readonly contracts?: readonly FactionContract[];
  readonly onCommand: (cmd: GameCommand) => void;
  readonly onFilterContracts?: (category: 'ALL' | 'SABOTAGE_ESCORT') => void;
}

const COMMODITY_LABELS: ReadonlyArray<{ id: CommodityId; label: string }> = [
  { id: 'ANTHRACITE_COAL', label: 'Anthracite Coal' },
  { id: 'PHOSPHOR_BRONZE', label: 'Phosphor-Bronze' },
  { id: 'AETHER_VIAL', label: 'Refined Aether' },
  { id: 'CLOCKWORK_MAINSPRING', label: 'Mainspring' },
];

const FACTION_LABELS: ReadonlyArray<{ id: FactionId; label: string }> = [
  { id: 'IRONMONGERS_CARTEL', label: 'Ironmongers Cartel' },
  { id: 'CLOCKWORK_GUILD', label: 'Clockwork Guild' },
  { id: 'UNDERCROFT_SYNDICATE', label: 'Undercroft Syndicate' },
  { id: 'CROWN_CONSTABULARY', label: 'Crown Constabulary' },
];

export function MarketLedger({ economy, contracts, onCommand, onFilterContracts }: MarketLedgerProps) {
  const playerId = EntityIdSchema.parse('actor_player');
  const [filterSabotageEscort, setFilterSabotageEscort] = useState(false);

  const sabotageEscortContracts = (contracts ?? []).filter(
    (c) => c.kind === 'PRESSURIZE_BOILER' || c.kind === 'SLAY_HOSTILE',
  );

  const activeShocks = COMMODITY_LABELS.map(({ id, label }) => {
    const q = economy.marketQuotes[id];
    if (!q) return null;
    const priceDelta = q.currentPricePence - q.basePricePence;
    const supplyDeficit = 100 - q.supplyUnits;
    if (priceDelta !== 0 || supplyDeficit > 0) {
      return { id, label, current: q.currentPricePence, delta: priceDelta, supply: q.supplyUnits, deficit: supplyDeficit };
    }
    return null;
  }).filter(Boolean);

  return (
    <div class="panel-box">
      <div class="panel-header">EXCHANGE &amp; STOREFRONT LEDGER</div>
      <div class="stat-row">
        <span>Storefront Treasury:</span>
        <span class="brass-text">{economy.playerTreasuryPence} d (Pence)</span>
      </div>

      <div class="sub-header">COMMODITY TICKER (S/D)</div>
      {COMMODITY_LABELS.map(({ id, label }) => {
        const quote = economy.marketQuotes[id];
        if (!quote) return null;
        const isHigh = quote.currentPricePence > quote.basePricePence;
        return (
          <div key={id} class="stat-row">
            <span>{label}</span>
            <span class={isHigh ? 'warn-text' : 'ok-text'}>
              {quote.currentPricePence}d ({quote.supplyUnits}/{quote.demandUnits})
            </span>
          </div>
        );
      })}

      <div class="sub-header">FACTION STANDING</div>
      {FACTION_LABELS.map(({ id, label }) => {
        const rep = economy.factionReputation[id] ?? 0;
        return (
          <div key={id} class="stat-row">
            <span>{label}</span>
            <span class={rep < 0 ? 'warn-text' : 'copper-text'}>
              {rep >= 0 ? `+${rep}` : rep}
            </span>
          </div>
        );
      })}

      <div class="button-grid" style={{ marginTop: '6px' }}>
        <button
          type="button"
          onClick={() =>
            onCommand({
              type: 'STOCK_PEDESTAL',
              actorId: playerId,
              commodity: 'ANTHRACITE_COAL',
              quantity: 3,
              askingPriceMarkupPct: 15,
            })
          }
        >
          [M] List 3x Anthracite on Pedestal (+15%)
        </button>
        <button
          type="button"
          onClick={() =>
            onCommand({
              type: 'TRIGGER_SUPPLY_SHOCK',
              actorId: playerId,
              commodity: 'ANTHRACITE_COAL',
              supplyDelta: -60,
              factionAffected: 'IRONMONGERS_CARTEL',
              reputationDelta: -15,
            })
          }
        >
          [!] Sabotage Coal Train (-60 Supply)
        </button>
      </div>

      {/* In-World Economic Intervention Panel */}
      <div class="panel-box" style={{ background: '#0d1316', border: '1px solid #4a1515', marginTop: '10px' }}>
        <div class="panel-header" style={{ color: '#ec7063', display: 'flex', justifyContent: 'space-between' }}>
          <span>IN-WORLD ECONOMIC INTERVENTION</span>
          <span style={{ fontSize: '9px', color: activeShocks.length > 0 ? 'var(--warn-red)' : 'var(--ok-green)' }}>
            {activeShocks.length > 0 ? `[${activeShocks.length} ACTIVE SHOCKS]` : '[MARKET STABLE]'}
          </span>
        </div>

        {/* Live District Supply Shock Ticker */}
        <div style={{ margin: '6px 0', padding: '4px', background: '#1c1010', border: '1px solid #78281f', fontSize: '10px' }}>
          <div style={{ color: 'var(--brass-gold)', fontWeight: 'bold', marginBottom: '3px' }}>
            DISTRICT SUPPLY SHOCK TICKER:
          </div>
          {activeShocks.length === 0 ? (
            <div class="muted">No supply deficits or active embargo shocks in district.</div>
          ) : (
            activeShocks.map((s) => (
              <div key={s!.id} style={{ display: 'flex', justifyContent: 'space-between', color: '#f5b7b1' }}>
                <span>{s!.label}:</span>
                <span>{s!.current}d ({s!.delta >= 0 ? `+${s!.delta}d` : `${s!.delta}d`}, {s!.supply}u supply)</span>
              </div>
            ))
          )}
        </div>

        <div style={{ fontSize: '10px', color: '#d5dbdb', lineHeight: '1.4', margin: '4px 0' }}>
          Overpressurizing boilers or hijacking freight directly influences district commodity prices and cartel allegiances.
        </div>

        <button
          type="button"
          onClick={() => {
            const next = !filterSabotageEscort;
            setFilterSabotageEscort(next);
            onFilterContracts?.(next ? 'SABOTAGE_ESCORT' : 'ALL');
          }}
          style={{
            width: '100%',
            padding: '5px',
            fontSize: '10px',
            marginTop: '4px',
            color: filterSabotageEscort ? '#070a0c' : '#ec7063',
            background: filterSabotageEscort ? '#ec7063' : '#2c1e1e',
            border: '1px solid #ec7063',
            cursor: 'pointer',
          }}
        >
          {filterSabotageEscort
            ? `[Active Filter: Sabotage & Escort Contracts Only (${sabotageEscortContracts.length})]`
            : `[Filter Cartel Sabotage & Escort Contracts (${sabotageEscortContracts.length})]`}
        </button>
      </div>
    </div>
  );
}
