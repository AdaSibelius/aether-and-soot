import { GameCommand } from '../../schemas/commands.schema.js';
import { EntityRecord } from '../../schemas/components.schema.js';
import { EntityId, StratumId } from '../../schemas/primitives.schema.js';
import { TileCell } from '../../sim/spatial/grid.js';
import { LookCursorLimbSelector } from './LookCursorLimbSelector.js';

export interface LookCursorTileCardProps {
  readonly cursor: { x: number; y: number };
  readonly stratum: StratumId;
  readonly actorId: EntityId;
  readonly targetActor: EntityRecord | undefined;
  readonly isDoor: boolean;
  readonly isGlassWindow: boolean;
  readonly isSmashedWindow: boolean;
  readonly furnitureEntity: EntityRecord | undefined;
  readonly vesselEntity: EntityRecord | undefined;
  readonly corpseEntity: EntityRecord | undefined;
  readonly entitiesOnTile: readonly EntityRecord[];
  readonly cell: TileCell | undefined;
  readonly hasCoalDust: boolean;
  readonly isAdjacent: boolean;
  readonly canRangedShoot: boolean;
  readonly dist: number;
  readonly wieldedSpec: { readonly rangedRange: number } | undefined;
  readonly pryingTool: EntityRecord | undefined;
  readonly surgicalTool: EntityRecord | undefined;
  readonly onCommand: (cmd: GameCommand) => void;
  readonly onTalk?: ((targetNpcId: EntityId) => void) | undefined;
}

export function LookCursorTileCard({
  cursor, stratum, actorId, targetActor, isDoor, isGlassWindow, isSmashedWindow,
  furnitureEntity, vesselEntity, corpseEntity, entitiesOnTile, cell, hasCoalDust,
  isAdjacent, canRangedShoot, dist, wieldedSpec, pryingTool, surgicalTool, onCommand, onTalk,
}: LookCursorTileCardProps) {
  return (
    <div style={{
      position: 'absolute', right: '10px', bottom: '10px', width: '220px',
      background: 'rgba(9, 14, 17, 0.95)', border: '1px solid var(--brass-gold)',
      padding: '6px 8px', fontSize: '10px', zIndex: 45, pointerEvents: 'auto', boxShadow: '0 4px 12px rgba(0, 0, 0, 0.9)',
    }}>
      {targetActor ? (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold' }}>
            <span style={{ color: targetActor.aiController?.hostile ? 'var(--warn-red)' : 'var(--brass-gold)' }}>
              {targetActor.visual.glyph} {targetActor.name}
            </span>
            <span class="muted">{isAdjacent ? '[ADJACENT]' : '[DISTANT]'}</span>
          </div>
          {targetActor.anatomy && (
            <div style={{ color: '#95a5a6', margin: '3px 0' }}>
              Torso: {targetActor.anatomy.limbs.TORSO?.hp ?? 0} HP | Blood: {targetActor.anatomy.bloodVolumePct}%
            </div>
          )}
          <LookCursorLimbSelector
            actorId={actorId}
            targetActor={targetActor}
            isAdjacent={isAdjacent}
            canRangedShoot={canRangedShoot}
            dist={dist}
            wieldedSpec={wieldedSpec}
            onCommand={onCommand}
            onTalk={onTalk}
          />
        </div>
      ) : isDoor ? (
        <div>
          <div class="brass-text" style={{ fontWeight: 'bold' }}>{cell?.terrainType === 'WOODEN_DOOR_CLOSED' ? '+ Closed Wooden Door' : '/ Open Wooden Door'}</div>
          <div style={{ color: '#7f8c8d', marginTop: '2px' }}>{isAdjacent ? 'Press [Enter] to toggle door' : 'Step adjacent to open/close'}</div>
          {isAdjacent && pryingTool && cell?.terrainType === 'WOODEN_DOOR_CLOSED' && (
            <button type="button" onClick={() => onCommand({ type: 'PRY_OBSTACLE', actorId, target: { x: cursor.x, y: cursor.y, stratum }, toolEntityId: pryingTool.id })}
              style={{ padding: '3px 6px', fontSize: '10px', background: '#1c2833', border: '1px solid var(--brass-gold)', color: 'var(--brass-gold)', cursor: 'pointer', width: '100%', marginTop: '3px' }}>
              [Pry Obstacle]
            </button>
          )}
        </div>
      ) : isGlassWindow ? (
        <div>
          <div class="brass-text" style={{ fontWeight: 'bold' }}>⊞ Glass Window</div>
          <div style={{ color: '#7f8c8d', margin: '2px 0 6px 0' }}>Blocks movement, allows line of sight.</div>
          {isAdjacent && (
            <button type="button" onClick={() => onCommand({ type: 'SMASH_TERRAIN', actorId, target: { x: cursor.x, y: cursor.y, stratum } })}
              style={{ padding: '3px 6px', fontSize: '10px', background: '#3b2219', border: '1px solid #e67e22', color: '#e67e22', cursor: 'pointer', width: '100%' }}>
              [Smash Window]
            </button>
          )}
        </div>
      ) : isSmashedWindow ? (
        <div>
          <div class="muted" style={{ fontWeight: 'bold' }}>% Smashed Window Frame</div>
          <div style={{ color: '#7f8c8d', marginTop: '2px' }}>Shattered glass. Walkable aperture.</div>
        </div>
      ) : vesselEntity ? (
        <div>
          <div class="brass-text" style={{ fontWeight: 'bold' }}>{vesselEntity.visual.glyph} {vesselEntity.name}</div>
          <div style={{ color: '#7f8c8d', margin: '2px 0 4px 0' }}>
            Pressure: {vesselEntity.pressureVessel?.currentPressureKpa}/{vesselEntity.pressureVessel?.maxPressureKpa} kPa {vesselEntity.pressureVessel?.ruptured ? '(RUPTURED)' : ''}
          </div>
          {isAdjacent && !vesselEntity.pressureVessel?.ruptured && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', marginTop: '4px' }}>
              <button type="button" onClick={() => onCommand({ type: 'REFILL_STEAM', actorId, pressureAddedKpa: 50 })}
                style={{ padding: '3px 6px', fontSize: '10px', background: '#1c2833', border: '1px solid var(--brass-gold)', color: 'var(--brass-gold)', cursor: 'pointer', width: '100%' }}>
                [Stoke Steam (+50 kPa)]
              </button>
              <button type="button" onClick={() => onCommand({ type: 'PRESSURIZE_VESSEL', actorId, vesselEntityId: vesselEntity.id, pressureAddedKpa: 120 })}
                style={{ padding: '3px 6px', fontSize: '10px', background: '#3b2219', border: '1px solid #e67e22', color: '#e67e22', cursor: 'pointer', width: '100%' }}>
                [Sabotage Valve (+120 kPa)]
              </button>
            </div>
          )}
        </div>
      ) : furnitureEntity ? (
        <div>
          <div class="brass-text" style={{ fontWeight: 'bold' }}>{furnitureEntity.visual.glyph} {furnitureEntity.name}</div>
          <div style={{ color: '#7f8c8d', margin: '2px 0 4px 0' }}>
            Type: {furnitureEntity.furniture?.kind} {furnitureEntity.inventory && `(${furnitureEntity.inventory.containedEntityIds.length} items)`}
          </div>
          {(furnitureEntity.furniture?.kind === 'BED' || furnitureEntity.furniture?.kind === 'SURGICAL_TABLE') && isAdjacent && (
            <button type="button" onClick={() => onCommand({ type: 'REST_AT_BED', actorId })}
              style={{ padding: '3px 6px', fontSize: '10px', background: '#1c2833', border: '1px solid var(--brass-gold)', color: 'var(--brass-gold)', cursor: 'pointer', width: '100%' }}>
              [Rest / Recuperate]
            </button>
          )}
          {Boolean(furnitureEntity.furniture && ['LOCKER', 'CRATE', 'BOOKSHELF'].includes(furnitureEntity.furniture.kind)) && isAdjacent && (
            <button type="button" onClick={() => onCommand({ type: 'LOOT_CONTAINER', actorId, containerId: furnitureEntity.id })}
              style={{ padding: '3px 6px', fontSize: '10px', background: '#1c2833', border: '1px solid var(--brass-gold)', color: 'var(--brass-gold)', cursor: 'pointer', width: '100%' }}>
              [Loot Container ({furnitureEntity.inventory?.containedEntityIds.length ?? 0})]
            </button>
          )}
        </div>
      ) : corpseEntity ? (
        <div>
          <div class="brass-text" style={{ fontWeight: 'bold' }}>{corpseEntity.visual.glyph} {corpseEntity.name}</div>
          <div style={{ color: '#7f8c8d', margin: '2px 0 4px 0' }}>Fallen remains.</div>
          {isAdjacent && surgicalTool && (
            <button type="button" onClick={() => onCommand({ type: 'HARVEST_CORPSE', actorId, corpseEntityId: corpseEntity.id, toolEntityId: surgicalTool.id })}
              style={{ padding: '3px 6px', fontSize: '10px', background: '#3b2219', border: '1px solid #e67e22', color: '#e67e22', cursor: 'pointer', width: '100%', marginTop: '3px' }}>
              [Harvest Cybernetics]
            </button>
          )}
        </div>
      ) : (
        <div>
          <div class="brass-text" style={{ fontWeight: 'bold' }}>{entitiesOnTile[0]?.visual.glyph ?? '.'} {entitiesOnTile[0]?.name ?? cell?.terrainType ?? 'Empty Space'}</div>
          <div style={{ color: '#7f8c8d', marginTop: '2px' }}>
            {entitiesOnTile[0]?.portal ? 'Press [Enter] to traverse portal' : hasCoalDust ? 'Coal dust cloud hovering.' : 'Objects on tile'}
          </div>
          {isAdjacent && pryingTool && (cell?.terrainType === 'IRON_GRATE' || cell?.terrainType === 'DISTRICT_GATE') && (
            <button type="button" onClick={() => onCommand({ type: 'PRY_OBSTACLE', actorId, target: { x: cursor.x, y: cursor.y, stratum }, toolEntityId: pryingTool.id })}
              style={{ padding: '3px 6px', fontSize: '10px', background: '#1c2833', border: '1px solid var(--brass-gold)', color: 'var(--brass-gold)', cursor: 'pointer', width: '100%', marginTop: '3px' }}>
              [Pry Obstacle]
            </button>
          )}
          {hasCoalDust && (
            <button type="button" onClick={() => onCommand({ type: 'EMIT_SPARK', actorId, target: { x: cursor.x, y: cursor.y, stratum } })}
              style={{ padding: '3px 6px', fontSize: '10px', background: '#3b2219', border: '1px solid #e67e22', color: '#e67e22', cursor: 'pointer', width: '100%', marginTop: '4px' }}>
              [Strike Flint Spark]
            </button>
          )}
        </div>
      )}
    </div>
  );
}
