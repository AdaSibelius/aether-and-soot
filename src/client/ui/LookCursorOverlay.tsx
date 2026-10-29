import { GameCommand } from '../../schemas/commands.schema.js';
import { EntityId } from '../../schemas/primitives.schema.js';
import { WorldState } from '../../sim/core/world.js';
import { findEntitiesAtPoint, getTileCell } from '../../sim/spatial/grid.js';
import { CELL_HEIGHT_PX, CELL_WIDTH_PX, WIDESCREEN_GRID_HEIGHT, WIDESCREEN_GRID_WIDTH } from '../renderer/glyph-stage.js';
import { LookCursorTileCard } from './LookCursorTileCard.js';

export interface LookCursorOverlayProps {
  readonly isActive: boolean;
  readonly cursor: { x: number; y: number } | null;
  readonly cameraOrigin?: { readonly x: number; readonly y: number };
  readonly state: Readonly<WorldState>;
  readonly actorId: EntityId;
  readonly onCommand: (cmd: GameCommand) => void;
  readonly onClose: () => void;
  readonly onTalk?: (targetNpcId: EntityId) => void;
  readonly suppressDetailCard?: boolean;
}

export function LookCursorOverlay({
  isActive, cursor, cameraOrigin, state, actorId, onCommand, onClose, onTalk, suppressDetailCard = false,
}: LookCursorOverlayProps) {
  if (!isActive || !cursor) return null;

  const player = state.entities[actorId];
  const stratum = player?.position?.stratum ?? 'STREET';
  const grid = state.strata[stratum];

  const entitiesOnTile = findEntitiesAtPoint(state.entities, { x: cursor.x, y: cursor.y, stratum });
  const targetActor = entitiesOnTile.find((e) => e.id !== actorId && e.actor);
  const cell = grid ? getTileCell(grid, cursor.x, cursor.y) : undefined;
  const isDoor = cell?.terrainType === 'WOODEN_DOOR_CLOSED' || cell?.terrainType === 'WOODEN_DOOR_OPEN';
  const isGlassWindow = cell?.terrainType === 'GLASS_WINDOW';
  const isSmashedWindow = cell?.terrainType === 'SMASHED_WINDOW_FRAME';
  const furnitureEntity = entitiesOnTile.find((e) => e.furniture !== undefined);
  const vesselEntity = entitiesOnTile.find((e) => e.pressureVessel !== undefined);
  const hasCoalDust = !!cell && (cell.coalDustDensity >= 0.25 || cell.coalDustDensity >= 40);

  const dist = player?.position ? Math.max(Math.abs(player.position.x - cursor.x), Math.abs(player.position.y - cursor.y)) : 0;
  const isAdjacent = dist <= 1;

  const wieldedId = player?.inventory?.equippedSlots?.WIELD;
  const wieldedItem = wieldedId ? state.entities[wieldedId] : undefined;
  const wieldedSpec = wieldedItem?.item?.equipmentSpec ?? wieldedItem?.equipmentSpec;
  const canRangedShoot = !isAdjacent && !!wieldedSpec && wieldedSpec.rangedRange > 0 && dist <= wieldedSpec.rangedRange;

  const camX = cameraOrigin?.x ?? 0, camY = cameraOrigin?.y ?? 0;
  const screenX = cursor.x - camX, screenY = cursor.y - camY;
  const isCursorOnScreen = screenX >= 0 && screenX < WIDESCREEN_GRID_WIDTH && screenY >= 0 && screenY < WIDESCREEN_GRID_HEIGHT;
  const leftPx = screenX * CELL_WIDTH_PX, topPx = screenY * CELL_HEIGHT_PX;

  const pryingTool = player?.inventory?.containedEntityIds
    .map((id) => state.entities[id])
    .find((e) => e && (e.item?.toolQualities?.PRYING || e.name.toLowerCase().includes('crowbar') || e.name.toLowerCase().includes('wrench')));

  const surgicalTool = player?.inventory?.containedEntityIds
    .map((id) => state.entities[id])
    .find((e) => e && (e.item?.toolQualities?.SURGERY !== undefined || e.item?.surgicalQuality !== undefined || e.item?.blueprintId?.includes('scalpel') || e.name.toLowerCase().includes('scalpel')));

  const corpseEntity = entitiesOnTile.find((e) => e.name.toLowerCase().includes('corpse') || (e.anatomy && e.anatomy.bloodVolumePct <= 0 && !e.actor));

  return (
    <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, pointerEvents: 'none', overflow: 'hidden' }}>
      <div style={{
        position: 'absolute', top: '6px', left: '8px', right: '8px',
        background: 'rgba(7, 10, 12, 0.92)', border: '1px solid var(--brass-gold)',
        padding: '4px 8px', fontSize: '11px', display: 'flex', justifyContent: 'space-between',
        alignItems: 'center', zIndex: 50, pointerEvents: 'auto', boxShadow: '0 2px 8px rgba(0, 0, 0, 0.8)',
      }}>
        <div>
          <span style={{ color: 'var(--brass-gold)', fontWeight: 'bold' }}>[LOOK MODE]</span>{' '}
          <span>Cursor: ({cursor.x}, {cursor.y}) [{stratum}]</span>
          <span style={{ color: '#7f8c8d', marginLeft: '8px' }}>[WASD] Move | [1-6/F] Strike | [Enter/O] Door/Interact</span>
        </div>
        <button type="button" onClick={onClose} style={{ padding: '2px 6px', fontSize: '10px', background: '#2c1e1e', border: '1px solid #ec7063', color: '#ec7063', cursor: 'pointer' }}>
          [Esc / L] Exit
        </button>
      </div>

      {isCursorOnScreen && (
        <div style={{
          position: 'absolute', left: `${leftPx}px`, top: `${topPx}px`, width: `${CELL_WIDTH_PX}px`, height: `${CELL_HEIGHT_PX}px`,
          border: '2px solid var(--brass-gold)', boxShadow: '0 0 12px rgba(212, 175, 55, 0.95), inset 0 0 6px rgba(212, 175, 55, 0.4)',
          boxSizing: 'border-box', zIndex: 40,
        }} />
      )}

      {!suppressDetailCard && isCursorOnScreen && (targetActor || isDoor || isGlassWindow || isSmashedWindow || furnitureEntity || vesselEntity || hasCoalDust || entitiesOnTile.length > 0) && (
        <LookCursorTileCard
          cursor={cursor}
          stratum={stratum}
          actorId={actorId}
          targetActor={targetActor}
          isDoor={isDoor}
          isGlassWindow={isGlassWindow}
          isSmashedWindow={isSmashedWindow}
          furnitureEntity={furnitureEntity}
          vesselEntity={vesselEntity}
          corpseEntity={corpseEntity}
          entitiesOnTile={entitiesOnTile}
          cell={cell}
          hasCoalDust={hasCoalDust}
          isAdjacent={isAdjacent}
          canRangedShoot={canRangedShoot}
          dist={dist}
          wieldedSpec={wieldedSpec}
          pryingTool={pryingTool}
          surgicalTool={surgicalTool}
          onCommand={onCommand}
          onTalk={onTalk}
        />
      )}
    </div>
  );
}
