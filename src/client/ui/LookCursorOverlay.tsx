import { GameCommand } from '../../schemas/commands.schema.js';
import { EntityId, LimbSlotId } from '../../schemas/primitives.schema.js';
import { WorldState } from '../../sim/core/world.js';
import { findEntitiesAtPoint, getTileCell } from '../../sim/spatial/grid.js';
import { CELL_HEIGHT_PX, CELL_WIDTH_PX } from '../renderer/glyph-stage.js';

export interface LookCursorOverlayProps {
  readonly isActive: boolean;
  readonly cursor: { x: number; y: number } | null;
  readonly cameraOrigin?: { readonly x: number; readonly y: number };
  readonly state: Readonly<WorldState>;
  readonly actorId: EntityId;
  readonly onCommand: (cmd: GameCommand) => void;
  readonly onClose: () => void;
  readonly onTalk?: (targetNpcId: EntityId) => void;
}

const LIMB_TARGETS: readonly { slot: LimbSlotId; key: string; label: string }[] = [
  { slot: 'HEAD', key: '1', label: 'Head [1]' }, { slot: 'TORSO', key: '2', label: 'Torso [2]' },
  { slot: 'LEFT_ARM', key: '3', label: 'L-Arm [3]' }, { slot: 'RIGHT_ARM', key: '4', label: 'R-Arm [4]' },
  { slot: 'LEFT_LEG', key: '5', label: 'L-Leg [5]' }, { slot: 'RIGHT_LEG', key: '6', label: 'R-Leg [6]' },
];

export function LookCursorOverlay({
  isActive, cursor, cameraOrigin, state, actorId, onCommand, onClose, onTalk,
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

  const dist = player?.position ? Math.max(Math.abs(player.position.x - cursor.x), Math.abs(player.position.y - cursor.y)) : 0;
  const isAdjacent = dist <= 1;

  const wieldedId = player?.inventory?.equippedSlots?.WIELD;
  const wieldedItem = wieldedId ? state.entities[wieldedId] : undefined;
  const wieldedSpec = wieldedItem?.item?.equipmentSpec ?? wieldedItem?.equipmentSpec;
  const canRangedShoot = !isAdjacent && !!wieldedSpec && wieldedSpec.rangedRange > 0 && dist <= wieldedSpec.rangedRange;

  const camX = cameraOrigin?.x ?? 0, camY = cameraOrigin?.y ?? 0;
  const screenX = cursor.x - camX, screenY = cursor.y - camY;
  const isCursorOnScreen = screenX >= 0 && screenX < 24 && screenY >= 0 && screenY < 20;
  const leftPx = screenX * CELL_WIDTH_PX, topPx = screenY * CELL_HEIGHT_PX;

  return (
    <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, pointerEvents: 'none', overflow: 'hidden' }}>
      {/* Top HUD Status Bar */}
      <div style={{
        position: 'absolute', top: '6px', left: '8px', right: '8px',
        background: 'rgba(7, 10, 12, 0.92)', border: '1px solid var(--brass-gold)',
        padding: '4px 8px', fontSize: '11px', display: 'flex', justifyContent: 'space-between',
        alignItems: 'center', zIndex: 50, pointerEvents: 'auto', boxShadow: '0 2px 8px rgba(0, 0, 0, 0.8)',
      }}>
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
      {isCursorOnScreen && (
        <div style={{
          position: 'absolute', left: `${leftPx}px`, top: `${topPx}px`,
          width: `${CELL_WIDTH_PX}px`, height: `${CELL_HEIGHT_PX}px`,
          border: '2px solid var(--brass-gold)',
          boxShadow: '0 0 12px rgba(212, 175, 55, 0.95), inset 0 0 6px rgba(212, 175, 55, 0.4)',
          boxSizing: 'border-box', zIndex: 40,
        }} />
      )}

      {/* Floating Target Dossier Badge */}
      {isCursorOnScreen && (targetActor || isDoor || isGlassWindow || isSmashedWindow || furnitureEntity || entitiesOnTile.length > 0) && (
        <div style={{
          position: 'absolute', left: `${Math.min(Math.max(8, leftPx - 40), 24 * CELL_WIDTH_PX - 220)}px`,
          top: `${topPx > 200 ? topPx - 80 : topPx + CELL_HEIGHT_PX + 6}px`, width: '200px',
          background: 'rgba(9, 14, 17, 0.95)', border: '1px solid var(--brass-gold)',
          padding: '6px 8px', fontSize: '10px', zIndex: 45, pointerEvents: 'auto',
          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.9)',
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
              {isAdjacent ? (
                <>
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
                  {!targetActor.aiController?.hostile && onTalk && (
                    <button
                      type="button"
                      onClick={() => onTalk(targetActor.id)}
                      style={{ padding: '2px 4px', fontSize: '9px', textAlign: 'center', width: '100%', marginTop: '3px', color: 'var(--brass-gold)', border: '1px solid var(--brass-gold)', cursor: 'pointer' }}
                    >
                      [Talk (T)]
                    </button>
                  )}
                </>
              ) : canRangedShoot ? (
                <>
                  <div style={{ color: '#e67e22', fontSize: '9px', marginTop: '2px' }}>
                    Fire ({dist} tiles | {wieldedSpec?.rangedSteamCostKpa}kPa):
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '3px', marginTop: '2px' }}>
                    {LIMB_TARGETS.map((t) => (
                      <button
                        key={t.slot}
                        type="button"
                        onClick={() => onCommand({ type: 'FIRE_RANGED_WEAPON', actorId, targetId: targetActor.id, targetSlot: t.slot })}
                        style={{ padding: '2px 4px', fontSize: '9px', textAlign: 'center', color: '#e67e22' }}
                      >
                        {t.label}
                      </button>
                    ))}
                  </div>
                </>
              ) : (
                <div style={{ color: '#7f8c8d', fontSize: '9px' }}>
                  {wieldedSpec?.rangedRange ? `Out of range (${dist}/${wieldedSpec.rangedRange})` : 'Step adjacent to strike limbs.'}
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
          ) : isGlassWindow ? (
            <div>
              <div class="brass-text" style={{ fontWeight: 'bold' }}>⊞ Glass Window</div>
              <div style={{ color: '#7f8c8d', margin: '2px 0 6px 0' }}>Blocks movement, allows line of sight.</div>
              {isAdjacent && (
                <button
                  type="button"
                  onClick={() =>
                    onCommand({
                      type: 'SMASH_TERRAIN',
                      actorId,
                      target: { x: cursor.x, y: cursor.y, stratum },
                    })
                  }
                  style={{ padding: '3px 6px', fontSize: '10px', background: '#3b2219', border: '1px solid #e67e22', color: '#e67e22', cursor: 'pointer', width: '100%' }}
                >
                  [Smash Window]
                </button>
              )}
            </div>
          ) : isSmashedWindow ? (
            <div>
              <div class="muted" style={{ fontWeight: 'bold' }}>% Smashed Window Frame</div>
              <div style={{ color: '#7f8c8d', marginTop: '2px' }}>Shattered glass. Walkable aperture.</div>
            </div>
          ) : furnitureEntity ? (
            <div>
              <div class="brass-text" style={{ fontWeight: 'bold' }}>
                {furnitureEntity.visual.glyph} {furnitureEntity.name}
              </div>
              <div style={{ color: '#7f8c8d', margin: '2px 0 4px 0' }}>
                Type: {furnitureEntity.furniture?.kind}
                {furnitureEntity.inventory && ` (${furnitureEntity.inventory.containedEntityIds.length} items)`}
              </div>
              {(furnitureEntity.furniture?.kind === 'BED' || furnitureEntity.furniture?.kind === 'SURGICAL_TABLE') && isAdjacent && (
                <button
                  type="button"
                  onClick={() => onCommand({ type: 'REST_AT_BED', actorId })}
                  style={{ padding: '3px 6px', fontSize: '10px', background: '#1c2833', border: '1px solid var(--brass-gold)', color: 'var(--brass-gold)', cursor: 'pointer', width: '100%' }}
                >
                  [Rest / Recuperate]
                </button>
              )}
              {Boolean(furnitureEntity.furniture && ['LOCKER', 'CRATE', 'BOOKSHELF'].includes(furnitureEntity.furniture.kind)) && isAdjacent && (
                <button
                  type="button"
                  onClick={() => onCommand({ type: 'LOOT_CONTAINER', actorId, containerId: furnitureEntity.id })}
                  style={{ padding: '3px 6px', fontSize: '10px', background: '#1c2833', border: '1px solid var(--brass-gold)', color: 'var(--brass-gold)', cursor: 'pointer', width: '100%' }}
                >
                  [Loot Container ({furnitureEntity.inventory?.containedEntityIds.length ?? 0})]
                </button>
              )}
            </div>
          ) : (
            <div>
              <div class="brass-text" style={{ fontWeight: 'bold' }}>
                {entitiesOnTile[0]?.visual.glyph ?? '.'} {entitiesOnTile[0]?.name ?? cell?.terrainType ?? 'Empty Space'}
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
