import { AnatomyComponent } from '../../schemas/components.schema.js';
import { LimbSlotId } from '../../schemas/primitives.schema.js';

export interface AnatomyDollProps {
  readonly anatomy: AnatomyComponent | undefined;
  readonly carriedProstheticSlots?: ReadonlySet<LimbSlotId>;
}

const LIMB_LABELS: ReadonlyArray<{ slot: LimbSlotId; label: string }> = [
  { slot: 'HEAD', label: 'Head' },
  { slot: 'OCULAR_MOUNT', label: 'Ocular Mount' },
  { slot: 'TORSO', label: 'Torso' },
  { slot: 'CHASSIS_CORE', label: 'Boiler Core' },
  { slot: 'LEFT_ARM', label: 'Left Arm' },
  { slot: 'RIGHT_ARM', label: 'Right Arm' },
  { slot: 'LEFT_LEG', label: 'Left Leg' },
  { slot: 'RIGHT_LEG', label: 'Right Leg' },
];

export function AnatomyDoll({ anatomy, carriedProstheticSlots }: AnatomyDollProps) {
  if (!anatomy) {
    return <div class="panel-box">No Anatomical Telemetry</div>;
  }

  return (
    <div class="panel-box">
      <div class="panel-header">ANATOMY &amp; PNEUMATICS</div>
      <div class="stat-row">
        <span>Steam Reserve:</span>
        <span class="brass-text">
          {anatomy.steamReserveKpa} / {anatomy.maxSteamReserveKpa} kPa
        </span>
      </div>
      <div class="stat-row">
        <span>Sanguine Volume:</span>
        <span class="copper-text">{anatomy.bloodVolumePct}%</span>
      </div>
      <div class="limb-list">
        {LIMB_LABELS.map(({ slot, label }) => {
          const limb = anatomy.limbs[slot];
          if (!limb) return null;
          const statusText = limb.amputated
            ? limb.installedProstheticEntityId
              ? 'PROSTHETIC'
              : 'SEVERED'
            : `${limb.hp}/${limb.maxHp} HP`;
          const isGraftReady = carriedProstheticSlots?.has(slot);
          return (
            <div key={slot} class="limb-item" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>{label}</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                {isGraftReady && (
                  <span style={{ fontSize: '8px', color: '#2ecc71', border: '1px solid #2ecc71', padding: '0 2px', borderRadius: '2px', fontWeight: 'bold' }}>
                    [+1 GRAFT READY]
                  </span>
                )}
                <span class={limb.amputated ? 'warn-text' : 'ok-text'}>{statusText}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
