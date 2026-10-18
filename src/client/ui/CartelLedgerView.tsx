import { useState } from 'preact/hooks';
import { GameCommand } from '../../schemas/commands.schema.js';
import { EntityRecord } from '../../schemas/components.schema.js';
import { CommodityId, EntityId, FactionId } from '../../schemas/primitives.schema.js';
import { DistrictEconomyLedger } from '../../sim/systems/economy.system.js';
import { matchesCommodity } from '../../sim/systems/trade-pricing.js';

export interface CartelLedgerViewProps {
  readonly economy: Readonly<DistrictEconomyLedger>;
  readonly actorId: EntityId;
  readonly entities?: Record<string, EntityRecord>;
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

export function CartelLedgerView({ economy, actorId, entities, onCommand }: CartelLedgerViewProps) {
  const actor = entities?.[actorId];
  const playerItems = (actor?.inventory?.containedEntityIds ?? [])
    .map((id) => entities?.[id])
    .filter((e): e is EntityRecord => Boolean(e?.item));

  const availableCommodities: Array<{ id: CommodityId; label: string; count: number }> = [];
  for (const { id, label } of COMMODITY_LABELS) {
    let count = 0;
    for (const it of playerItems) {
      if (matchesCommodity(it, id)) count += it.item?.quantity ?? 1;
    }
    if (count > 0) availableCommodities.push({ id, label, count });
  }

  const [selectedCommodity, setSelectedCommodity] = useState<CommodityId>(
    availableCommodities[0]?.id ?? 'ANTHRACITE_COAL',
  );
  const [markupPct, setMarkupPct] = useState<number>(25);

  const activeEntry = availableCommodities.find((c) => c.id === selectedCommodity);
  const canStock = Boolean(activeEntry && activeEntry.count > 0);

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
                <div key={fac.id} style={{ padding: '6px 8px', background: '#0d1316', border: '1px solid #1c2833' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px' }}>
                    <span class="brass-text" style={{ fontWeight: 'bold' }}>{fac.name}</span>
                    <span style={{ color: repColor, fontWeight: 'bold' }}>{discountText}</span>
                  </div>
                  <div style={{ fontSize: '10px', color: '#7f8c8d', marginTop: '2px' }}>{fac.role}</div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Storefront Pedestals */}
        <div class="panel-box" style={{ flex: 1 }}>
          <div class="panel-header" style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>ACTIVE STOREFRONT PEDESTALS</span>
            <span class="brass-text" style={{ fontSize: '11px' }}>Treasury: {economy.playerTreasuryPence}d</span>
          </div>

          {economy.storefrontListings.length === 0 ? (
            <div class="log-entry muted" style={{ fontSize: '11px' }}>No items currently exhibited on market pedestals.</div>
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

          {/* Inventory-Driven Pedestal Stocking Selector */}
          <div style={{ marginTop: '12px', padding: '8px', background: '#0e1418', border: '1px solid #1c2833' }}>
            <div style={{ fontSize: '11px', color: 'var(--brass-gold)', fontWeight: 'bold', marginBottom: '6px' }}>
              STOCK PEDESTAL FROM SATCHEL
            </div>
            {availableCommodities.length === 0 ? (
              <div class="muted" style={{ fontSize: '10px' }}>No raw trade commodities in satchel to exhibit on pedestals.</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                  <select
                    value={selectedCommodity}
                    onChange={(e) => setSelectedCommodity((e.target as HTMLSelectElement).value as CommodityId)}
                    style={{ flex: 1, padding: '4px', fontSize: '11px', background: '#0a0d0e', color: '#d5dbdb', border: '1px solid #2c3e50' }}
                  >
                    {availableCommodities.map((c) => (
                      <option key={c.id} value={c.id}>{c.label} ({c.count} in satchel)</option>
                    ))}
                  </select>
                  <div style={{ display: 'flex', gap: '4px' }}>
                    {[0, 25, 50].map((m) => (
                      <button
                        key={m}
                        type="button"
                        onClick={() => setMarkupPct(m)}
                        style={{
                          padding: '3px 6px', fontSize: '10px',
                          background: markupPct === m ? 'var(--brass-gold)' : '#1c2833',
                          color: markupPct === m ? '#0a0d0e' : '#d5dbdb',
                          border: '1px solid var(--brass-gold)',
                        }}
                      >
                        +{m}%
                      </button>
                    ))}
                  </div>
                </div>
                <button
                  type="button"
                  disabled={!canStock}
                  onClick={() => {
                    if (canStock) {
                      onCommand({
                        type: 'STOCK_PEDESTAL',
                        actorId,
                        commodity: selectedCommodity,
                        quantity: 1,
                        askingPriceMarkupPct: markupPct,
                      });
                    }
                  }}
                  style={{
                    padding: '5px', fontSize: '10px', fontWeight: 'bold',
                    background: canStock ? '#1c2833' : '#0d1316',
                    color: canStock ? 'var(--brass-gold)' : '#7f8c8d',
                    border: '1px solid var(--brass-gold)',
                    cursor: canStock ? 'pointer' : 'not-allowed',
                  }}
                >
                  [+] Exhibit 1x {activeEntry?.label ?? selectedCommodity} (+{markupPct}% Markup)
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Right Column: Commodity Market Quotes & In-World Sabotage Info */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        <div class="panel-box">
          <div class="panel-header">DISTRICT COMMODITY TICKER (S/D)</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {COMMODITY_LABELS.map(({ id, label }) => {
              const quote = economy.marketQuotes[id];
              if (!quote) return null;
              const isHigh = quote.currentPricePence > quote.basePricePence;

              return (
                <div key={id} style={{ padding: '6px 8px', background: '#0d1316', border: '1px solid #1c2833' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px' }}>
                    <span style={{ color: '#d5dbdb' }}>{label}</span>
                    <span class={isHigh ? 'warn-text' : 'ok-text'} style={{ fontWeight: 'bold' }}>{quote.currentPricePence}d</span>
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

        {/* In-World Economic Sabotage Information */}
        <div class="panel-box" style={{ background: '#0d1316', border: '1px solid #4a1515' }}>
          <div class="panel-header" style={{ color: '#ec7063' }}>IN-WORLD ECONOMIC INTERVENTION</div>
          <div style={{ fontSize: '10px', color: '#d5dbdb', lineHeight: '1.4' }}>
            District commodity supplies and market prices respond dynamically to physical events in the world.
            <br /><br />
            <span style={{ color: '#ec7063', fontWeight: 'bold' }}>Foundry Boiler Sabotage:</span> Overpressurizing or detonating a Foundry Boiler beyond its maximum capacity (300 kPa) violently releases scalding steam and disrupts fuel transport lines, triggering an in-world market supply shock (-60 Coal Supply, -15 Ironmongers Rep).
          </div>
        </div>
      </div>
    </div>
  );
}
