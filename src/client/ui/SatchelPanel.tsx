import { GameCommand } from '../../schemas/commands.schema.js';
import { EntityRecord } from '../../schemas/components.schema.js';
import { EntityId } from '../../schemas/primitives.schema.js';
import { WorldState } from '../../sim/core/world.js';
import { findEntitiesAtPoint } from '../../sim/spatial/grid.js';
import { computeCarriedVolumeMl, getCarryProfile } from '../../sim/systems/inventory-utils.js';

export interface SatchelPanelProps {
  readonly state: Readonly<WorldState>;
  readonly actorId: EntityId;
  readonly onCommand: (cmd: GameCommand) => void;
}

function describeItem(entity: EntityRecord): string {
  const qty = entity.item && entity.item.quantity > 1 ? ` x${entity.item.quantity}` : '';
  return `${entity.visual.glyph} ${entity.name}${qty}`;
}

/**
 * Read-only satchel view: carried items with Use/Drop actions and items on the current tile.
 * All mutations are dispatched as GameCommands (never mutates WorldState).
 */
export function SatchelPanel({ state, actorId, onCommand }: SatchelPanelProps) {
  const actor = state.entities[actorId];
  const inv = actor?.inventory;
  const pos = actor?.position;
  if (!actor || !inv || !pos) return null;

  const held = inv.containedEntityIds
    .map((id) => state.entities[id])
    .filter((e): e is EntityRecord => e !== undefined);
  const ground = findEntitiesAtPoint(state.entities, pos).filter(
    (e) => e.id !== actorId && getCarryProfile(e) !== undefined,
  );
  const volume = computeCarriedVolumeMl(state, inv);

  return (
    <div class="panel-box">
      <div class="panel-header">ARTIFICER'S SATCHEL</div>
      <div class="stat-row">
        <span>Volume:</span>
        <span>
          {volume} / {inv.maxVolumeMl} ml
        </span>
      </div>
      {held.length === 0 ? (
        <div class="log-entry muted">Satchel is empty.</div>
      ) : (
        held.map((item) => (
          <div key={item.id} class="stat-row">
            <span>{describeItem(item)}</span>
            <span>
              {item.item?.useEffect ? (
                <button
                  type="button"
                  onClick={() => onCommand({ type: 'USE_ITEM', actorId, itemEntityId: item.id })}
                >
                  Use
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
      {ground.map((item) => (
        <div key={item.id} class="stat-row">
          <span class="brass-text">Here: {describeItem(item)}</span>
          <button
            type="button"
            onClick={() => onCommand({ type: 'PICK_UP_ITEM', actorId, itemEntityId: item.id })}
          >
            [G] Take
          </button>
        </div>
      ))}
    </div>
  );
}
