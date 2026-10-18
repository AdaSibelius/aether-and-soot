import { GameCommand } from '../../schemas/commands.schema.js';
import { EntityId, LimbSlotId } from '../../schemas/primitives.schema.js';
import { WorldState } from '../../sim/core/world.js';
import { findEntitiesAtPoint, getTileCell } from '../../sim/spatial/grid.js';
import { CELL_HEIGHT_PX, CELL_WIDTH_PX } from '../renderer/glyph-stage.js';

export interface LookCursorOverlayProps {
  readonly isActive: boolean;
  readonly cursor: { x: number; y: number } | null;
  readonly state: Readonly<WorldState>;
  readonly actorId: EntityId;
  readonly onCommand: (cmd: GameCommand) => void;
  readonly onClose: () => void;
}

const LIMB_TARGETS: readonly { slot: LimbSlotId; key: string; label: string }[] = [
  { slot: 'HEAD', key: '1', label: 'Head [1]' },
  { slot: 'TORSO', key: '2', label: 'Torso [2]' },
  { slot: 'LEFT_ARM', key: '3', label: 'L-Arm [3]' },
  { slot: 'RIGHT_ARM', key: '4', label: 'R-Arm [4]' },
  { slot: 'LEFT_LEG', key: '5', label: 'L-Leg [5]' },
  { slot: 'RIGHT_LEG', key: '6', label: 'R-Leg [6]' },
];

export function LookCursorOverlay({
  isActive,
  cursor,
  state,
  actorId,
  onCommand,
  onClose,
}: LookCursorOverlayProps) {
  if (!isActive || !cursor) return null;

  const player = state.entities[actorId];
  const stratum = player?.position?.stratum ?? 'STREET';
  const grid = state.strata[stratum];

  const entitiesOnTile = findEntitiesAtPoint(state.entities, {
    x: cursor.x,
    y: cursor.y,
    stratum,
  });

  const targetActor = entitiesOnTile.find((e) => e.id !== actorId && e.actor);
  const cell = grid ? getTileCell(grid, cursor.x, cursor.y) : undefined;
  const isDoor = cell?.terrainType === 'WOODEN_DOOR_CLOSED' || cell?.terrainType === 'WOODEN_DOOR_OPEN';

  const isAdjacent = player?.position
    ? Math.max(Math.abs(player.position.x - cursor.x), Math.abs(player.position.y - cursor.y)) <= 1
    : false;

  const leftPx = cursor.x * CELL_WIDTH_PX;
  const topPx = cursor.y * CELL_HEIGHT_PX;

  return (
    <div
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        pointerEvents: 'none',
        overflow: 'hidden',
      }}
    >
      {/* Top HUD Status Bar */}
      <div
        style={{
          position: 'absolute',
          top: '6px',
          left: '8px',
          right: '8px',
          background: 'rgba(7, 10, 12, 0.92)',
          border: '1px solid var(--brass-gold)',
          padding: '4px 8px',
          fontSize: '11px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          zIndex: 50,
          pointerEvents: 'auto',
          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.8)',
        }}
      >
        <div>
          <span style={{ color: 'var(--brass-gold)', fontWeight: 'bold' }}>[LOOK MODE]</span>{' '}
          <span>Cursor: ({cursor.x}, {cursor.y}) [{stratum}]</span>
          <span style={{ color: '#7f8c8d', marginLeft: '8px' }}>
            [WASD / Arrows] Move &nbsp;|&nbsp; [1-6 / F] Strike Limb &nbsp;|&nbsp; [Enter] Interact
          </span>
        </div>
        <button
          type="button"
          onClick={onClose}
          style={{ padding: '2px 6px', fontSize: '10px', background: '#2c1e1e', border: '1px solid #ec7063', color: '#ec7063', cursor: 'pointer' }}
        >
          [Esc / L] Exit
        </button>
      </div>

      {/* Brass Reticle Box */}
      <div
        style={{
          position: 'absolute',
          left: `${leftPx}px`,
          top: `${topPx}px`,
          width: `${CELL_WIDTH_PX}px`,
          height: `${CELL_HEIGHT_PX}px`,
          border: '2px solid var(--brass-gold)',
          boxShadow: '0 0 12px rgba(212, 175, 55, 0.95), inset 0 0 6px rgba(212, 175, 55, 0.4)',
          boxSizing: 'border-box',
          zIndex: 40,
        }}
      />

      {/* Floating Target Dossier Badge */}
      {(targetActor || isDoor || entitiesOnTile.length > 0) && (
        <div
          style={{
            position: 'absolute',
            left: `${Math.min(Math.max(8, leftPx - 40), 24 * CELL_WIDTH_PX - 220)}px`,
            top: `${topPx > 200 ? topPx - 80 : topPx + CELL_HEIGHT_PX + 6}px`,
            width: '200px',
            background: 'rgba(9, 14, 17, 0.95)',
            border: '1px solid var(--brass-gold)',
            padding: '6px 8px',
            fontSize: '10px',
            zIndex: 45,
            pointerEvents: 'auto',
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.9)',
          }}
        >
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
              {isAdjacent ? (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '3px', marginTop: '4px' }}>
                  {LIMB_TARGETS.map((t) => (
                    <button
                      key={t.slot}
                      type="button"
                      onClick={() =>
                        onCommand({
                          type: 'ATTACK_ACTOR',
                          attackerId: actorId,
                          targetId: targetActor.id,
                          targetSlot: t.slot,
                        })
                      }
                      style={{ padding: '2px 4px', fontSize: '9px', textAlign: 'center' }}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              ) : (
                <div style={{ color: '#7f8c8d', fontSize: '9px' }}>
                  Step adjacent to strike limbs in melee.
                </div>
              )}
            </div>
          ) : isDoor ? (
            <div>
              <div class="brass-text" style={{ fontWeight: 'bold' }}>
                {cell?.terrainType === 'WOODEN_DOOR_CLOSED' ? '+ Closed Wooden Door' : '/ Open Wooden Door'}
              </div>
              <div style={{ color: '#7f8c8d', marginTop: '2px' }}>
                {isAdjacent ? 'Press [Enter] to toggle door' : 'Step adjacent to open/close'}
              </div>
            </div>
          ) : (
            <div>
              <div class="brass-text" style={{ fontWeight: 'bold' }}>
                {entitiesOnTile[0]?.visual.glyph} {entitiesOnTile[0]?.name}
              </div>
              <div style={{ color: '#7f8c8d', marginTop: '2px' }}>
                {entitiesOnTile[0]?.portal ? 'Press [Enter] to traverse portal' : 'Objects on tile'}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
