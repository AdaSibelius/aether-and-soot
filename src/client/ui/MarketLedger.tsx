import { GameCommand } from '../../schemas/commands.schema.js';
import { CommodityId, EntityIdSchema, FactionId } from '../../schemas/primitives.schema.js';
import { DistrictEconomyLedger } from '../../sim/systems/economy.system.js';

export interface MarketLedgerProps {
  readonly economy: Readonly<DistrictEconomyLedger>;
  readonly onCommand: (cmd: GameCommand) => void;
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

export function MarketLedger({ economy, onCommand }: MarketLedgerProps) {
  const playerId = EntityIdSchema.parse('actor_player');

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
    </div>
  );
}
