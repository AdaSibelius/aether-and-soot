import { AnatomyComponent } from '../../schemas/components.schema.js';
import { LimbSlotId } from '../../schemas/primitives.schema.js';

export interface AnatomyDollProps {
  readonly anatomy: AnatomyComponent | undefined;
}

const LIMB_LABELS: ReadonlyArray<{ slot: LimbSlotId; label: string }> = [
  { slot: 'HEAD', label: 'Cranium' },
  { slot: 'OCULAR_MOUNT', label: 'Ocular Mount' },
  { slot: 'TORSO', label: 'Thorax' },
  { slot: 'CHASSIS_CORE', label: 'Boiler Core' },
  { slot: 'LEFT_ARM', label: 'L. Manipulator' },
  { slot: 'RIGHT_ARM', label: 'R. Manipulator' },
  { slot: 'LEFT_LEG', label: 'L. Strider' },
  { slot: 'RIGHT_LEG', label: 'R. Strider' },
];

export function AnatomyDoll({ anatomy }: AnatomyDollProps) {
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
          return (
            <div key={slot} class="limb-item">
              <span>{label}</span>
              <span class={limb.amputated ? 'warn-text' : 'ok-text'}>{statusText}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
