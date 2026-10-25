import { EntityRecord } from '../../schemas/components.schema.js';
import { humanizeIdentifier } from '../../sim/data/item-catalog.js';

export interface ItemDossierStatsProps {
  readonly item: EntityRecord;
  readonly commodityQuote?: { readonly basePricePence: number } | undefined;
}

export function ItemDossierStats({ item, commodityQuote }: ItemDossierStatsProps) {
  const qty = item.item?.quantity ?? 1;
  const totalMass = item.item ? item.item.massGrams * qty : (item.prostheticSpec?.massGrams ?? 0);
  const totalVol = item.item ? item.item.volumeMl * qty : (item.prostheticSpec?.volumeMl ?? 0);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', fontSize: '11px' }}>
      <div class="stat-row">
        <span>Total Mass:</span>
        <span class="brass-text">
          {totalMass} g {qty > 1 ? `(${item.item?.massGrams} g/ea)` : ''}
        </span>
      </div>
      <div class="stat-row">
        <span>Total Volume:</span>
        <span class="copper-text">
          {totalVol} ml {qty > 1 ? `(${item.item?.volumeMl} ml/ea)` : ''}
        </span>
      </div>

      {commodityQuote !== undefined && (
        <div class="stat-row">
          <span>Market Quote:</span>
          <span class="brass-text">{commodityQuote.basePricePence * qty}d</span>
        </div>
      )}

      {/* Prosthetic Engineering Specs */}
      {item.prostheticSpec && (
        <>
          <div class="stat-row">
            <span>Target Limb Socket:</span>
            <span class="brass-text">{humanizeIdentifier(item.prostheticSpec.targetLimbSlot)}</span>
          </div>
          <div class="stat-row">
            <span>Socket Mechanism:</span>
            <span>{humanizeIdentifier(item.prostheticSpec.socketType)}</span>
          </div>
          <div class="stat-row">
            <span>Pressure Rating:</span>
            <span class="copper-text">{item.prostheticSpec.pressureRatingKpa} kPa</span>
          </div>
          {item.prostheticSpec.fovRadiusBonus > 0 && (
            <div class="stat-row">
              <span>Optical Lens Range:</span>
              <span class="ok-text">+{item.prostheticSpec.fovRadiusBonus} FOV</span>
            </div>
          )}
          {item.prostheticSpec.moveApModifier !== 0 && (
            <div class="stat-row">
              <span>Actuation Speed AP:</span>
              <span>{item.prostheticSpec.moveApModifier > 0 ? `+${item.prostheticSpec.moveApModifier}` : item.prostheticSpec.moveApModifier} AP</span>
            </div>
          )}
        </>
      )}

      {/* Consumable Effects */}
      {item.item?.useEffect && (
        <div class="stat-row">
          <span>Alchemical Effect:</span>
          <span class="ok-text">
            {item.item.useEffect.kind === 'RESTORE_BLOOD'
              ? `Coagulant Hemostasis (+${item.item.useEffect.magnitude}% Blood)`
              : `Pneumatic Injection (+${item.item.useEffect.magnitude} kPa Steam)`}
          </span>
        </div>
      )}
    </div>
  );
}
