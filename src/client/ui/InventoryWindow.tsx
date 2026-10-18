import { useEffect, useState } from 'preact/hooks';
import { GameCommand } from '../../schemas/commands.schema.js';
import { EntityRecord } from '../../schemas/components.schema.js';
import { EntityId } from '../../schemas/primitives.schema.js';
import { WorldState } from '../../sim/core/world.js';
import { findEntitiesAtPoint } from '../../sim/spatial/grid.js';
import { computeCarriedVolumeMl, getCarryProfile } from '../../sim/systems/inventory-utils.js';
import { EquippedGearPanel } from './EquippedGearPanel.js';
import { ItemDossierCard } from './ItemDossierCard.js';

export interface InventoryWindowProps {
  readonly state: Readonly<WorldState>;
  readonly actorId: EntityId;
  readonly onCommand: (cmd: GameCommand) => void;
}

const LETTERS = 'abcdefghijklmnopqrstuvwxyz';

export function InventoryWindow({ state, actorId, onCommand }: InventoryWindowProps) {
  const actor = state.entities[actorId];
  const inv = actor?.inventory;
  const pos = actor?.position;

  const carried = (inv?.containedEntityIds ?? [])
    .map((id) => state.entities[id])
    .filter((e): e is EntityRecord => e !== undefined);

  const ground = pos
    ? findEntitiesAtPoint(state.entities, pos).filter(
        (e) => e.id !== actorId && getCarryProfile(e) !== undefined,
      )
    : [];

  const [selectedId, setSelectedId] = useState<EntityId | null>(
    carried[0]?.id ?? ground[0]?.id ?? null,
  );

  const selectedItem =
    state.entities[selectedId ?? ''] ??
    carried[0] ??
    ground[0] ??
    null;

  const carriedVolume = inv ? computeCarriedVolumeMl(state, inv) : 0;
  const massPct = inv ? Math.min(100, Math.round((inv.currentMassGrams / inv.maxMassGrams) * 100)) : 0;
  const volPct = inv ? Math.min(100, Math.round((carriedVolume / inv.maxVolumeMl) * 100)) : 0;
  const isOverweight = inv ? inv.currentMassGrams > inv.maxMassGrams : false;

  // Map each carried item to a quick hotkey letter [a-z]
  const letterMap: Map<string, EntityRecord> = new Map();
  carried.forEach((item, idx) => {
    if (idx < LETTERS.length) {
      letterMap.set(LETTERS[idx]!, item);
    }
  });

  // Keyboard navigation for [a-z] item selection & [u, d, g, s] direct actions
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      // Ignore if typing in input or if meta keys are pressed
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const key = e.key.toLowerCase();

      // Quick select letter [a-z]
      const targetItem = letterMap.get(key);
      if (targetItem) {
        e.preventDefault();
        setSelectedId(targetItem.id);
        return;
      }

      // Actions on currently selected item
      if (!selectedItem) return;

      if (key === 'u' && selectedItem.item?.useEffect) {
        e.preventDefault();
        onCommand({ type: 'USE_ITEM', actorId, itemEntityId: selectedItem.id });
      } else if (key === 'd') {
        e.preventDefault();
        onCommand({ type: 'DROP_ITEM', actorId, itemEntityId: selectedItem.id, quantity: 1 });
      } else if (key === 'g' && selectedItem.prostheticSpec) {
        e.preventDefault();
        onCommand({
          type: 'INSTALL_PROSTHETIC',
          actorId,
          prostheticEntityId: selectedItem.id,
          slot: selectedItem.prostheticSpec.targetLimbSlot,
        });
      } else if (key === 'e' && selectedItem.item?.equipmentSpec) {
        e.preventDefault();
        onCommand({ type: 'EQUIP_ITEM', actorId, itemEntityId: selectedItem.id });
      } else if (key === 's') {
        e.preventDefault();
        onCommand({ type: 'SALVAGE_ITEM', actorId, itemEntityId: selectedItem.id });
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [letterMap, selectedItem, actorId, onCommand]);

  if (!actor || !inv || !pos) return null;

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '14px', flex: 1 }}>
      {/* Left Column: Categorized List & Encumbrance Meters */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        <EquippedGearPanel state={state} actorId={actorId} onCommand={onCommand} />
        {/* Encumbrance Gauges */}
        <div class="panel-box">
          <div class="panel-header">SATCHEL CAPACITY &amp; LOAD</div>
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

        {/* Carried Items with [a-z] Hotkeys */}
        <div class="panel-box" style={{ flex: 1, overflowY: 'auto' }}>
          <div class="panel-header" style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>CARRIED SATCHEL ITEMS</span>
            <span class="muted" style={{ fontSize: '10px' }}>[a–z] select</span>
          </div>

          {carried.length === 0 ? (
            <div class="log-entry muted">Satchel is currently empty.</div>
          ) : (
            carried.map((item, idx) => {
              const letter = LETTERS[idx] ?? ' ';
              const isSelected = selectedItem?.id === item.id;
              const qty = item.item && item.item.quantity > 1 ? ` x${item.item.quantity}` : '';

              return (
                <div
                  key={item.id}
                  onClick={() => setSelectedId(item.id)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '5px 8px',
                    margin: '2px 0',
                    cursor: 'pointer',
                    background: isSelected ? '#1c2833' : 'transparent',
                    border: isSelected ? '1px solid var(--brass-gold)' : '1px solid transparent',
                  }}
                >
                  <span style={{ fontSize: '12px', color: isSelected ? 'var(--brass-gold)' : '#d5dbdb' }}>
                    <span class="copper-text" style={{ marginRight: '6px' }}>[{letter}]</span>
                    {item.visual.glyph} {item.name}{qty}
                  </span>
                  <span class="muted" style={{ fontSize: '10px' }}>
                    {item.item ? `${item.item.massGrams * item.item.quantity}g` : `${item.prostheticSpec?.massGrams}g`}
                  </span>
                </div>
              );
            })
          )}

          {/* Ground Items on Current Tile */}
          <div class="panel-header" style={{ marginTop: '14px', borderTop: '1px solid #2e4053', paddingTop: '8px' }}>
            <span>GROUND AT FEET</span>
            <span class="muted" style={{ fontSize: '10px' }}>[G] Take</span>
          </div>
          {ground.length === 0 ? (
            <div class="log-entry muted">No items scattered on the floor.</div>
          ) : (
            ground.map((item) => (
              <div
                key={item.id}
                onClick={() => setSelectedId(item.id)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '4px 8px',
                  background: selectedItem?.id === item.id ? '#1c2833' : 'transparent',
                  border: selectedItem?.id === item.id ? '1px solid var(--brass-gold)' : '1px solid transparent',
                  cursor: 'pointer',
                }}
              >
                <span class="brass-text" style={{ fontSize: '11px' }}>
                  Floor: {item.visual.glyph} {item.name}
                </span>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onCommand({ type: 'PICK_UP_ITEM', actorId, itemEntityId: item.id });
                  }}
                  style={{ padding: '2px 6px', fontSize: '10px' }}
                >
                  [G] Take
                </button>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Right Column: Full Item Mechanical Dossier */}
      <ItemDossierCard state={state} actorId={actorId} item={selectedItem} onCommand={onCommand} />
    </div>
  );
}
