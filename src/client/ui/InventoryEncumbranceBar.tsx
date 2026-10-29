import { InventoryComponent } from '../../schemas/components.schema.js';

export interface InventoryEncumbranceBarProps {
  readonly inv: InventoryComponent;
  readonly carriedVolume: number;
  readonly treasuryPence: number;
}

export function InventoryEncumbranceBar({
  inv,
  carriedVolume,
  treasuryPence,
}: InventoryEncumbranceBarProps) {
  const massPct = Math.min(100, Math.round((inv.currentMassGrams / inv.maxMassGrams) * 100));
  const volPct = Math.min(100, Math.round((carriedVolume / inv.maxVolumeMl) * 100));
  const isOverweight = inv.currentMassGrams > inv.maxMassGrams;

  return (
    <div class="panel-box">
      <div class="panel-header" style={{ display: 'flex', justifyContent: 'space-between' }}>
        <span>SATCHEL CAPACITY &amp; LOAD</span>
        <span class="brass-text">Treasury: {treasuryPence}d</span>
      </div>
      <div style={{ marginBottom: '6px' }}>
        <div class="stat-row" style={{ fontSize: '11px' }}>
          <span>Carried Mass:</span>
          <span class={isOverweight ? 'warn-text' : 'brass-text'}>
            {inv.currentMassGrams} / {inv.maxMassGrams} g ({massPct}%)
          </span>
        </div>
        <div style={{ background: '#1c150c', height: '5px', border: '1px solid #5a3c1e' }}>
          <div
            style={{
              background: isOverweight ? '#ec7063' : 'var(--brass-gold)',
              width: `${massPct}%`,
              height: '100%',
            }}
          />
        </div>
      </div>

      <div>
        <div class="stat-row" style={{ fontSize: '11px' }}>
          <span>Carried Volume:</span>
          <span class="copper-text">
            {carriedVolume} / {inv.maxVolumeMl} ml ({volPct}%)
          </span>
        </div>
        <div style={{ background: '#1c150c', height: '5px', border: '1px solid #5a3c1e' }}>
          <div
            style={{
              background: 'var(--oxidized-copper)',
              width: `${volPct}%`,
              height: '100%',
            }}
          />
        </div>
      </div>
    </div>
  );
}
