import { GameCommand } from '../../schemas/commands.schema.js';
import { EntityRecord } from '../../schemas/components.schema.js';
import { EntityId } from '../../schemas/primitives.schema.js';
import { WorldState } from '../../sim/core/world.js';
import {
  getItemBlueprint,
  getProstheticBlueprint,
  humanizeIdentifier,
} from '../../sim/data/item-catalog.js';
import { ItemGlyphBadge } from './SatchelPanel.js';

export interface ItemDossierCardProps {
  readonly state: Readonly<WorldState>;
  readonly actorId: EntityId;
  readonly item: EntityRecord | null;
  readonly onCommand: (cmd: GameCommand) => void;
}

export function ItemDossierCard({ state, actorId, item, onCommand }: ItemDossierCardProps) {
  if (!item) {
    return (
      <div class="panel-box" style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        <div class="panel-header">MECHANICAL DOSSIER &amp; LORE</div>
        <div class="log-entry muted" style={{ marginTop: '20px', lineHeight: '1.6' }}>
          Select an item from the left pane (or press its assigned hotkey [a–z]) to inspect its engineering specifications, steam requirements, and actions.
        </div>
      </div>
    );
  }

  const prostheticBp = item.prostheticSpec
    ? getProstheticBlueprint(item.prostheticSpec.blueprintId)
    : undefined;
  const itemBp = item.item ? getItemBlueprint(item.item.blueprintId) : undefined;

  const description =
    itemBp?.description ??
    prostheticBp?.description ??
    'A standardized trade commodity forged in the smoke-veiled foundries of New London.';

  const category = item.item?.category ?? (item.prostheticSpec ? 'PROSTHETIC' : 'EQUIPMENT');
  const qty = item.item?.quantity ?? 1;
  const totalMass = item.item
    ? item.item.massGrams * qty
    : (item.prostheticSpec?.massGrams ?? 0);
  const totalVol = item.item
    ? item.item.volumeMl * qty
    : (item.prostheticSpec?.volumeMl ?? 0);

  const commodityQuote = item.item?.commodityId
    ? state.economy.marketQuotes[item.item.commodityId]
    : undefined;

  return (
    <div
      class="panel-box"
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        background: '#0d1316',
        border: '1px solid #2e4053',
      }}
    >
      <div class="panel-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <ItemGlyphBadge entity={item} />
          <span class="brass-text" style={{ fontWeight: 'bold' }}>
            {item.name} {qty > 1 ? `(x${qty})` : ''}
          </span>
        </div>
        <span
          style={{
            fontSize: '10px',
            color: '#7f8c8d',
            border: '1px solid #2e4053',
            padding: '1px 6px',
          }}
        >
          {humanizeIdentifier(category)}
        </span>
      </div>

      {/* Description & Lore */}
      <div
        style={{
          fontSize: '11px',
          lineHeight: '1.5',
          color: '#d5dbdb',
          margin: '8px 0 12px 0',
          fontStyle: 'italic',
        }}
      >
        "{description}"
      </div>

      {/* Metric Breakdown */}
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
              <span class="copper-text">
                {item.prostheticSpec.pressureRatingKpa} kPa
              </span>
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

      {/* Interactive Actions Grid */}
      <div
        style={{
          marginTop: 'auto',
          paddingTop: '12px',
          borderTop: '1px solid #1c2833',
          display: 'flex',
          gap: '6px',
          flexWrap: 'wrap',
        }}
      >
        {item.item?.useEffect && (
          <button
            type="button"
            onClick={() => onCommand({ type: 'USE_ITEM', actorId, itemEntityId: item.id })}
            style={{ padding: '4px 10px', fontSize: '11px', color: 'var(--ok-green)' }}
          >
            [U] Use Item
          </button>
        )}

        {item.item?.equipmentSpec && (
          <button
            type="button"
            onClick={() => onCommand({ type: 'EQUIP_ITEM', actorId, itemEntityId: item.id })}
            style={{ padding: '4px 10px', fontSize: '11px', color: 'var(--brass-gold)' }}
          >
            [E] Equip ({humanizeIdentifier(item.item.equipmentSpec.equipSlot)})
          </button>
        )}

        {item.prostheticSpec && (
          <button
            type="button"
            onClick={() =>
              onCommand({
                type: 'INSTALL_PROSTHETIC',
                actorId,
                prostheticEntityId: item.id,
                slot: item.prostheticSpec!.targetLimbSlot,
              })
            }
            style={{ padding: '4px 10px', fontSize: '11px', color: 'var(--brass-gold)' }}
          >
            [G] Graft to {humanizeIdentifier(item.prostheticSpec.targetLimbSlot)}
          </button>
        )}

        <button
          type="button"
          onClick={() =>
            onCommand({ type: 'DROP_ITEM', actorId, itemEntityId: item.id, quantity: 1 })
          }
          style={{ padding: '4px 10px', fontSize: '11px' }}
        >
          [D] Drop {qty > 1 ? '1' : ''}
        </button>

        {qty > 1 && (
          <button
            type="button"
            onClick={() =>
              onCommand({ type: 'DROP_ITEM', actorId, itemEntityId: item.id, quantity: qty })
            }
            style={{ padding: '4px 10px', fontSize: '11px' }}
          >
            Drop All ({qty})
          </button>
        )}

        <button
          type="button"
          onClick={() => onCommand({ type: 'SALVAGE_ITEM', actorId, itemEntityId: item.id })}
          style={{ padding: '4px 10px', fontSize: '11px', color: '#e67e22' }}
        >
          [S] Salvage Scrap
        </button>
      </div>
    </div>
  );
}
