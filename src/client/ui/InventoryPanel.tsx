import { GameCommand } from '../../schemas/commands.schema.js';
import { EntityRecord } from '../../schemas/components.schema.js';
import { EntityId } from '../../schemas/primitives.schema.js';
import { WorldState } from '../../sim/core/world.js';
import { findEntitiesAtPoint } from '../../sim/spatial/grid.js';
import { computeCarriedVolumeMl, getCarryProfile } from '../../sim/systems/inventory-utils.js';

export interface InventoryPanelProps {
  readonly state: Readonly<WorldState>;
  readonly actorId: EntityId;
  readonly onCommand: (cmd: GameCommand) => void;
}

function describeItem(entity: EntityRecord): string {
  const qty = entity.item && entity.item.quantity > 1 ? ` x${entity.item.quantity}` : '';
  return `${entity.visual.glyph} ${entity.name}${qty}`;
}

export function InventoryPanel({ state, actorId, onCommand }: InventoryPanelProps) {
  const actor = state.entities[actorId];
  const inv = actor?.inventory;
  const pos = actor?.position;
  if (!actor || !inv || !pos) return null;

  const carried = inv.containedEntityIds
    .map((id) => state.entities[id])
    .filter((e): e is EntityRecord => e !== undefined);
  const ground = findEntitiesAtPoint(state.entities, pos).filter(
    (e) => e.id !== actorId && getCarryProfile(e) !== undefined,
  );

  const carriedVolume = computeCarriedVolumeMl(state, inv);
  const massPct = Math.min(100, Math.round((inv.currentMassGrams / inv.maxMassGrams) * 100));
  const volPct = Math.min(100, Math.round((carriedVolume / inv.maxVolumeMl) * 100));
  const isOverweight = inv.currentMassGrams > inv.maxMassGrams;

  return (
    <div class="panel-box">
      <div class="panel-header">ARTIFICER'S SATCHEL &amp; GEAR [I]</div>
      <div class="stat-row">
        <span>Mass Load:</span>
        <span class={isOverweight ? 'warn-text' : 'brass-text'}>
          {inv.currentMassGrams} / {inv.maxMassGrams} g ({massPct}%)
        </span>
      </div>
      <div class="stat-row">
        <span>Volume Load:</span>
        <span class="copper-text">
          {carriedVolume} / {inv.maxVolumeMl} ml ({volPct}%)
        </span>
      </div>

      <div class="panel-header" style={{ marginTop: '8px' }}>CARRIED ITEMS ({carried.length})</div>
      {carried.length === 0 ? (
        <div class="log-entry muted">No items carried.</div>
      ) : (
        carried.map((item) => (
          <div key={item.id} class="stat-row" style={{ alignItems: 'center' }}>
            <span>{describeItem(item)}</span>
            <span style={{ display: 'flex', gap: '4px' }}>
              {item.item?.useEffect ? (
                <button
                  type="button"
                  onClick={() => onCommand({ type: 'USE_ITEM', actorId, itemEntityId: item.id })}
                >
                  Use
                </button>
              ) : null}
              {item.prostheticSpec ? (
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
                >
                  Socket
                </button>
              ) : null}
              <button
                type="button"
                onClick={() =>
                  onCommand({ type: 'DROP_ITEM', actorId, itemEntityId: item.id, quantity: 1 })
                }
              >
                Drop
              </button>
            </span>
          </div>
        ))
      )}

      <div class="panel-header" style={{ marginTop: '8px' }}>SURROUNDING GROUND ITEMS</div>
      {ground.length === 0 ? (
        <div class="log-entry muted">No items on current tile.</div>
      ) : (
        ground.map((item) => (
          <div key={item.id} class="stat-row" style={{ alignItems: 'center' }}>
            <span class="brass-text">Floor: {describeItem(item)}</span>
            <button
              type="button"
              onClick={() => onCommand({ type: 'PICK_UP_ITEM', actorId, itemEntityId: item.id })}
            >
              [G] Take
            </button>
          </div>
        ))
      )}
    </div>
  );
}
