import { EntityRecord } from '../../schemas/components.schema.js';
import { LimbSlotId } from '../../schemas/primitives.schema.js';
import { humanizeIdentifier } from '../../sim/data/item-catalog.js';

export interface LimbSlotConfig {
  readonly slot: LimbSlotId;
  readonly name: string;
  readonly keyNum: string;
}

export interface LimbSlotCardProps {
  readonly config: LimbSlotConfig;
  readonly limb: { hp: number; maxHp: number; amputated: boolean } | undefined;
  readonly installed: EntityRecord | undefined;
  readonly isSelected: boolean;
  readonly onSelect: () => void;
  readonly graftReady?: boolean;
}

export function LimbSlotCard({
  config,
  limb,
  installed,
  isSelected,
  onSelect,
  graftReady = false,
}: LimbSlotCardProps) {
  const hpPct = limb ? Math.round((limb.hp / limb.maxHp) * 100) : 0;
  const slotHeader = humanizeIdentifier(config.slot);

  return (
    <div
      onClick={onSelect}
      style={{
        width: '135px',
        padding: '6px',
        background: isSelected ? '#1c2833' : '#0d1316',
        border: isSelected ? '1px solid var(--brass-gold)' : '1px solid #2e4053',
        cursor: 'pointer',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '10px' }}>
        <span class="copper-text">[{config.keyNum}] {slotHeader}</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
          {graftReady && (
            <span
              style={{
                fontSize: '8px',
                color: '#2ecc71',
                border: '1px solid #2ecc71',
                padding: '0 2px',
                borderRadius: '2px',
                fontWeight: 'bold',
              }}
            >
              [+1 GRAFT READY]
            </span>
          )}
          <span class={limb?.amputated ? 'warn-text' : 'ok-text'}>
            {limb?.amputated ? 'SEV' : `${limb?.hp ?? 0}HP`}
          </span>
        </div>
      </div>
      <div style={{ background: '#1c150c', height: '4px', border: '1px solid #4a1515', margin: '4px 0' }}>
        <div style={{ background: hpPct < 40 ? '#ec7063' : '#27ae60', width: `${hpPct}%`, height: '100%' }} />
      </div>
      <div style={{ fontSize: '9px', color: installed ? 'var(--brass-gold)' : '#7f8c8d', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {installed ? `⚙ ${installed.name}` : 'Natural Flesh'}
      </div>
    </div>
  );
}
