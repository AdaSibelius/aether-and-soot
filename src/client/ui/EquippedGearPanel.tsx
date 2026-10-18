import { GameCommand } from '../../schemas/commands.schema.js';
import { EquipmentSlot } from '../../schemas/equipment.schema.js';
import { EntityId } from '../../schemas/primitives.schema.js';
import { WorldState } from '../../sim/core/world.js';
import { getEquipmentSpec } from '../../sim/systems/equipment.system.js';

export interface EquippedGearPanelProps {
  readonly state: Readonly<WorldState>;
  readonly actorId: EntityId;
  readonly onCommand: (cmd: GameCommand) => void;
}

const SLOTS: readonly { slot: EquipmentSlot; label: string }[] = [
  { slot: 'WIELD', label: 'Wielded Hand' },
  { slot: 'HEAD_WEAR', label: 'Head Gear' },
  { slot: 'TORSO_WEAR', label: 'Torso Armor' },
  { slot: 'BACK_WEAR', label: 'Back / Satchel' },
];

export function EquippedGearPanel({ state, actorId, onCommand }: EquippedGearPanelProps) {
  const actor = state.entities[actorId];
  const equippedSlots = actor?.inventory?.equippedSlots ?? {};

  return (
    <div class="panel-box" style={{ marginBottom: '10px' }}>
      <div class="panel-header" style={{ display: 'flex', justifyContent: 'space-between' }}>
        <span>EQUIPPED ATTIRE &amp; WEAPONRY</span>
        <span class="muted" style={{ fontSize: '10px' }}>Active Loadout</span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginTop: '6px' }}>
        {SLOTS.map(({ slot, label }) => {
          const itemId = equippedSlots[slot];
          const item = itemId ? state.entities[itemId] : undefined;
          const spec = getEquipmentSpec(item);

          let bonusDesc = '';
          if (spec) {
            const parts: string[] = [];
            if (spec.meleeDamageBonus) parts.push(`+${spec.meleeDamageBonus} Melee DMG`);
            if (spec.armorBonus) parts.push(`+${spec.armorBonus} Armor`);
            if (spec.storageVolumeBonusMl) parts.push(`+${spec.storageVolumeBonusMl}ml Vol`);
            if (spec.steamResistanceKpa) parts.push(`+${spec.steamResistanceKpa}kPa Steam Res`);
            if (spec.rangedRange) parts.push(`Rng ${spec.rangedRange}, ${spec.rangedDamage} DMG (${spec.rangedSteamCostKpa}kPa)`);
            bonusDesc = parts.join(' | ');
          }

          return (
            <div
              key={slot}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '3px 6px',
                background: item ? '#151c20' : 'rgba(0,0,0,0.2)',
                border: item ? '1px solid #34495e' : '1px dashed #212f3d',
                fontSize: '11px',
              }}
            >
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1px' }}>
                <span class="muted" style={{ fontSize: '9px', textTransform: 'uppercase' }}>
                  {label}
                </span>
                {item ? (
                  <span class="brass-text" style={{ fontWeight: 'bold' }}>
                    {item.visual.glyph} {item.name}
                  </span>
                ) : (
                  <span class="muted" style={{ fontStyle: 'italic' }}>&lt;Empty Slot&gt;</span>
                )}
                {bonusDesc && (
                  <span class="ok-text" style={{ fontSize: '9px' }}>
                    {bonusDesc}
                  </span>
                )}
              </div>

              {item && (
                <button
                  type="button"
                  onClick={() => onCommand({ type: 'UNEQUIP_ITEM', actorId, slot })}
                  style={{
                    padding: '2px 6px',
                    fontSize: '10px',
                    color: '#e74c3c',
                    borderColor: '#922b21',
                  }}
                >
                  Unequip
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
