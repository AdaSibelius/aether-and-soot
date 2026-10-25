import { GameCommand } from '../../schemas/commands.schema.js';
import { EntityRecord } from '../../schemas/components.schema.js';
import { EntityId, LimbSlotId } from '../../schemas/primitives.schema.js';

export interface LookCursorLimbSelectorProps {
  readonly actorId: EntityId;
  readonly targetActor: EntityRecord;
  readonly isAdjacent: boolean;
  readonly canRangedShoot: boolean;
  readonly dist: number;
  readonly wieldedSpec?: { readonly rangedRange: number; readonly rangedSteamCostKpa?: number } | undefined;
  readonly onCommand: (cmd: GameCommand) => void;
  readonly onTalk?: ((targetNpcId: EntityId) => void) | undefined;
}

export const LIMB_TARGETS: readonly { slot: LimbSlotId; key: string; label: string }[] = [
  { slot: 'HEAD', key: '1', label: 'Head [1]' },
  { slot: 'TORSO', key: '2', label: 'Torso [2]' },
  { slot: 'LEFT_ARM', key: '3', label: 'L-Arm [3]' },
  { slot: 'RIGHT_ARM', key: '4', label: 'R-Arm [4]' },
  { slot: 'LEFT_LEG', key: '5', label: 'L-Leg [5]' },
  { slot: 'RIGHT_LEG', key: '6', label: 'R-Leg [6]' },
];

export function LookCursorLimbSelector({
  actorId,
  targetActor,
  isAdjacent,
  canRangedShoot,
  dist,
  wieldedSpec,
  onCommand,
  onTalk,
}: LookCursorLimbSelectorProps) {
  if (isAdjacent) {
    return (
      <>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '3px', marginTop: '4px' }}>
          {LIMB_TARGETS.map((t) => (
            <button
              key={t.slot}
              type="button"
              onClick={() => onCommand({ type: 'ATTACK_ACTOR', attackerId: actorId, targetId: targetActor.id, targetSlot: t.slot })}
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
    );
  }

  if (canRangedShoot) {
    return (
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
    );
  }

  return (
    <div style={{ color: '#7f8c8d', fontSize: '9px' }}>
      {wieldedSpec?.rangedRange ? `Out of range (${dist}/${wieldedSpec.rangedRange})` : 'Step adjacent to strike limbs.'}
    </div>
  );
}
