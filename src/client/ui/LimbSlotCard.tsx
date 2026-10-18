import { EntityRecord } from '../../schemas/components.schema.js';
import { LimbSlotId } from '../../schemas/primitives.schema.js';

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
}

export function LimbSlotCard({
  config,
  limb,
  installed,
  isSelected,
  onSelect,
}: LimbSlotCardProps) {
  const hpPct = limb ? Math.round((limb.hp / limb.maxHp) * 100) : 0;
  return (
    <div
      onClick={onSelect}
      style={{
        width: '130px',
        padding: '6px',
        background: isSelected ? '#1c2833' : '#0d1316',
        border: isSelected ? '1px solid var(--brass-gold)' : '1px solid #2e4053',
        cursor: 'pointer',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px' }}>
        <span class="copper-text">[{config.keyNum}] {config.slot}</span>
        <span class={limb?.amputated ? 'warn-text' : 'ok-text'}>
          {limb?.amputated ? 'SEV' : `${limb?.hp ?? 0}HP`}
        </span>
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
