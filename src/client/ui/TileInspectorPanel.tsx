import { GameCommand } from '../../schemas/commands.schema.js';
import { EntityId, LimbSlotId } from '../../schemas/primitives.schema.js';
import { findEntitiesAtPoint, getTileCell } from '../../sim/spatial/grid.js';
import { WorldState } from '../../sim/core/world.js';

export interface TileInspectorPanelProps {
  readonly state: Readonly<WorldState>;
  readonly actorId: EntityId;
  readonly tile: { x: number; y: number } | null;
  readonly onCommand: (cmd: GameCommand) => void;
  readonly onSelectTab?: (tab: 'TELEMETRY' | 'INVENTORY' | 'SURGERY' | 'WORKBENCH' | 'EXCHANGE') => void;
}

export function TileInspectorPanel({
  state,
  actorId,
  tile,
  onCommand,
  onSelectTab,
}: TileInspectorPanelProps) {
  const player = state.entities[actorId];
  const stratum = player?.position?.stratum ?? 'STREET';
  const grid = state.strata[stratum];

  if (!tile || !player?.position || !grid) {
    return (
      <div class="panel-box">
        <div class="panel-header">CANVAS TILE INSPECTOR</div>
        <div class="log-entry muted">Hover or click canvas tiles to inspect terrain, steam kPa, and actors.</div>
      </div>
    );
  }

  const cell = getTileCell(grid, tile.x, tile.y);
  const entitiesOnTile = findEntitiesAtPoint(state.entities, {
    x: tile.x,
    y: tile.y,
    stratum,
  });

  const isAdjacent =
    Math.max(Math.abs(player.position.x - tile.x), Math.abs(player.position.y - tile.y)) <= 1;

  const isDoor =
    cell?.terrainType === 'WOODEN_DOOR_CLOSED' || cell?.terrainType === 'WOODEN_DOOR_OPEN';
  const isDoorClosed = cell?.terrainType === 'WOODEN_DOOR_CLOSED';

  return (
    <div class="panel-box">
      <div class="panel-header">CANVAS TILE INSPECTOR</div>
      <div class="stat-row">
        <span>Target Coordinate:</span>
        <span class="brass-text">
          ({tile.x}, {tile.y}) [{stratum}]
        </span>
      </div>
      <div class="stat-row">
        <span>Terrain &amp; Architecture:</span>
        <span>{cell?.terrainType ?? 'VOID'}</span>
      </div>
      <div class="stat-row">
        <span>Atmospheric Steam:</span>
        <span class="copper-text">{cell?.steamPressureKpa ?? 0} kPa</span>
      </div>
      <div class="stat-row">
        <span>Particulate Coal Dust:</span>
        <span>{cell?.coalDustDensity ?? 0} units</span>
      </div>

      <div class="panel-header" style={{ marginTop: '8px' }}>ENTITIES PRESENT ({entitiesOnTile.length})</div>
      {entitiesOnTile.length === 0 ? (
        <div class="log-entry muted">Empty cobblestones.</div>
      ) : (
        entitiesOnTile.map((e) => (
          <div key={e.id} style={{ borderBottom: '1px dashed #1c2833', padding: '4px 0' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span class="brass-text" style={{ fontWeight: 'bold' }}>
                {e.visual.glyph} {e.name}
              </span>
              <span class="muted">{e.aiController?.role ?? (e.actor ? 'ACTOR' : 'OBJECT')}</span>
            </div>
            {e.anatomy && (
              <div style={{ fontSize: '10px', color: '#7f8c8d' }}>
                Torso: {e.anatomy.limbs.TORSO?.hp ?? 0}/{e.anatomy.limbs.TORSO?.maxHp ?? 0} HP | Blood: {e.anatomy.bloodVolumePct}%
              </div>
            )}
            {e.furniture && (
              <div style={{ fontSize: '10px', color: '#7f8c8d' }}>
                Fixture: {e.furniture.kind} {e.inventory ? `(${e.inventory.containedEntityIds.length} items)` : ''}
              </div>
            )}
            {isAdjacent && e.furniture && ['LOCKER', 'CRATE', 'BOOKSHELF'].includes(e.furniture.kind) && (
              <div style={{ marginTop: '4px' }}>
                <button
                  type="button"
                  style={{ fontSize: '10px', padding: '2px 4px', color: 'var(--brass-gold)' }}
                  onClick={() => onCommand({ type: 'LOOT_CONTAINER', actorId, containerId: e.id })}
                >
                  [Loot {e.furniture.kind} ({e.inventory?.containedEntityIds.length ?? 0})]
                </button>
              </div>
            )}
            {/* Tactical context actions if adjacent */}
            {isAdjacent && e.id !== actorId && e.actor && (
              <div style={{ marginTop: '4px', display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                {(['TORSO', 'HEAD', 'LEFT_LEG'] as LimbSlotId[]).map((slot) => (
                  <button
                    key={slot}
                    type="button"
                    style={{ fontSize: '10px', padding: '2px 4px' }}
                    onClick={() =>
                      onCommand({
                        type: 'ATTACK_ACTOR',
                        attackerId: actorId,
                        targetId: e.id,
                        targetSlot: slot,
                      })
                    }
                  >
                    Strike {slot}
                  </button>
                ))}
                {e.aiController?.role === 'MERCHANT' && onSelectTab && (
                  <button
                    key="trade"
                    type="button"
                    style={{ fontSize: '10px', padding: '2px 4px' }}
                    onClick={() => onSelectTab('EXCHANGE')}
                  >
                    [M] Trade
                  </button>
                )}
              </div>
            )}
          </div>
        ))
      )}

      {/* Door toggle context button if adjacent and door present */}
      {isAdjacent && isDoor && (
        <div style={{ marginTop: '6px' }}>
          <button
            type="button"
            onClick={() =>
              onCommand({
                type: 'TOGGLE_DOOR',
                actorId,
                target: { x: tile.x, y: tile.y, stratum },
              })
            }
          >
            {isDoorClosed ? 'Open Door' : 'Close Door'}
          </button>
        </div>
      )}
    </div>
  );
}
