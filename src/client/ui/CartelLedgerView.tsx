import { GameCommand } from '../../schemas/commands.schema.js';
import { CommodityId, EntityId, FactionId } from '../../schemas/primitives.schema.js';
import { DistrictEconomyLedger } from '../../sim/systems/economy.system.js';

export interface CartelLedgerViewProps {
  readonly economy: Readonly<DistrictEconomyLedger>;
  readonly actorId: EntityId;
  readonly onCommand: (cmd: GameCommand) => void;
}

const COMMODITY_LABELS: ReadonlyArray<{ id: CommodityId; label: string }> = [
  { id: 'ANTHRACITE_COAL', label: 'Anthracite Coal' },
  { id: 'PHOSPHOR_BRONZE', label: 'Phosphor-Bronze' },
  { id: 'AETHER_VIAL', label: 'Refined Aether' },
  { id: 'CLOCKWORK_MAINSPRING', label: 'Clockwork Mainspring' },
];

const FACTION_DESCRIPTIONS: ReadonlyArray<{
  id: FactionId;
  name: string;
  role: string;
}> = [
  { id: 'IRONMONGERS_CARTEL', name: 'Ironmongers Cartel', role: 'Controls coal foundries & smelting' },
  { id: 'CLOCKWORK_GUILD', name: 'Clockwork Guild', role: 'Artificers, gears & pneumatic limbs' },
  { id: 'UNDERCROFT_SYNDICATE', name: 'Undercroft Syndicate', role: 'Smugglers of aether & sump salvage' },
  { id: 'CROWN_CONSTABULARY', name: 'Crown Constabulary', role: 'District law enforcement & guards' },
];

export function CartelLedgerView({ economy, actorId, onCommand }: CartelLedgerViewProps) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '14px', flex: 1 }}>
      {/* Left Column: Cartel Standing & Storefront Pedestals */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        <div class="panel-box">
          <div class="panel-header">VICTORIAN CARTELS &amp; REPUTATION</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {FACTION_DESCRIPTIONS.map((fac) => {
              const rep = economy.factionReputation[fac.id] ?? 0;
              const repColor = rep > 0 ? 'var(--ok-green)' : rep < 0 ? 'var(--warn-red)' : '#d5dbdb';
              const discountText =
                rep > 0
                  ? `+${rep} (${Math.round((rep / 100) * 25)}% trade discount)`
                  : rep < 0
                    ? `${rep} (${Math.round((-rep / 100) * 50)}% cartel surcharge)`
                    : '0 (Neutral)';

              return (
                <div
                  key={fac.id}
                  style={{
                    padding: '6px 8px',
                    background: '#0d1316',
                    border: '1px solid #1c2833',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px' }}>
                    <span class="brass-text" style={{ fontWeight: 'bold' }}>{fac.name}</span>
                    <span style={{ color: repColor, fontWeight: 'bold' }}>{discountText}</span>
                  </div>
                  <div style={{ fontSize: '10px', color: '#7f8c8d', marginTop: '2px' }}>
                    {fac.role}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Storefront Pedestals */}
        <div class="panel-box" style={{ flex: 1 }}>
          <div class="panel-header" style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>ACTIVE STOREFRONT PEDESTALS</span>
            <span class="brass-text" style={{ fontSize: '11px' }}>
              Treasury: {economy.playerTreasuryPence}d
            </span>
          </div>

          {economy.storefrontListings.length === 0 ? (
            <div class="log-entry muted" style={{ fontSize: '11px' }}>
              No items currently exhibited on market pedestals.
            </div>
          ) : (
            economy.storefrontListings.map((listing, idx) => (
              <div key={`${listing.commodity}-${idx}`} class="stat-row" style={{ fontSize: '11px' }}>
                <span>{listing.commodity}: {listing.quantity} units</span>
                <span class="brass-text">
                  {listing.askingPriceMarkupPct >= 0 ? `+${listing.askingPriceMarkupPct}%` : `${listing.askingPriceMarkupPct}%`} markup
                </span>
              </div>
            ))
          )}

          <div style={{ marginTop: '12px', display: 'flex', gap: '6px' }}>
            <button
              type="button"
              onClick={() =>
                onCommand({
                  type: 'STOCK_PEDESTAL',
                  actorId,
                  commodity: 'ANTHRACITE_COAL',
                  quantity: 3,
                  askingPriceMarkupPct: 15,
                })
              }
              style={{ fontSize: '10px', padding: '4px 8px' }}
            >
              [+] List 3x Anthracite (+15% Markup)
            </button>
          </div>
        </div>
      </div>

      {/* Right Column: Commodity Market Quotes & Supply Shocks */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        <div class="panel-box">
          <div class="panel-header">DISTRICT COMMODITY TICKER (S/D)</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {COMMODITY_LABELS.map(({ id, label }) => {
              const quote = economy.marketQuotes[id];
              if (!quote) return null;
              const isHigh = quote.currentPricePence > quote.basePricePence;

              return (
                <div
                  key={id}
                  style={{
                    padding: '6px 8px',
                    background: '#0d1316',
                    border: '1px solid #1c2833',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px' }}>
                    <span style={{ color: '#d5dbdb' }}>{label}</span>
                    <span class={isHigh ? 'warn-text' : 'ok-text'} style={{ fontWeight: 'bold' }}>
                      {quote.currentPricePence}d
                    </span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: '#7f8c8d', marginTop: '2px' }}>
                    <span>Base: {quote.basePricePence}d</span>
                    <span>Supply: {quote.supplyUnits} | Demand: {quote.demandUnits}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Economic Sabotage */}
        <div class="panel-box" style={{ background: '#0d1316', border: '1px solid #4a1515' }}>
          <div class="panel-header" style={{ color: '#ec7063' }}>ECONOMIC SABOTAGE &amp; INTERVENTION</div>
          <div style={{ fontSize: '10px', color: '#d5dbdb', marginBottom: '8px' }}>
            Disrupt supply lines to trigger commodity price spikes at the expense of cartel reputation.
          </div>
          <button
            type="button"
            onClick={() =>
              onCommand({
                type: 'TRIGGER_SUPPLY_SHOCK',
                actorId,
                commodity: 'ANTHRACITE_COAL',
                supplyDelta: -60,
                factionAffected: 'IRONMONGERS_CARTEL',
                reputationDelta: -15,
              })
            }
            style={{ width: '100%', padding: '5px', fontSize: '11px', color: '#ec7063', background: '#2c1515', border: '1px solid #ec7063' }}
          >
            [!] Sabotage Coal Convoy (-60 Coal Supply, -15 Ironmongers Rep)
          </button>
        </div>
      </div>
    </div>
  );
}
