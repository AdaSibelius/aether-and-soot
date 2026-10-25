import { SimEvent } from '../../schemas/events.schema.js';
import { EntityId, Point3D } from '../../schemas/primitives.schema.js';
import { WorldState } from '../core/world.js';
import { computeActorFovRadius, computeVisibleTiles, isPointVisible, pointKey } from '../spatial/fov.js';
import { getTileCell } from '../spatial/grid.js';
import { calculateGaslightField } from './gaslight.system.js';
import { computeProstheticFovBonus } from './surgical-context.js';

export { calculateGaslightField as computeDistrictLighting };

export interface SystemAcousticResult {
  readonly state: WorldState;
  readonly events: SimEvent[];
}

/**
 * Calculates step decibels produced by an actor moving cardinally.
 * Pneumatic prosthetics and encumbrance generate significant acoustic signatures.
 */
export function computeActorStepNoiseDb(
  state: Readonly<WorldState>,
  actorId: EntityId,
): number {
  const actor = state.entities[actorId];
  if (!actor) return 0;

  let totalDb = 5; // Base footstep whisper

  if (actor.anatomy) {
    for (const limb of Object.values(actor.anatomy.limbs)) {
      if (!limb?.installedProstheticEntityId) continue;
      const prosthetic = state.entities[limb.installedProstheticEntityId];
      if (prosthetic?.prostheticSpec) {
        totalDb += prosthetic.prostheticSpec.noiseDb;
      }
    }

    const leftLeg = actor.anatomy.limbs['LEFT_LEG'];
    const rightLeg = actor.anatomy.limbs['RIGHT_LEG'];
    if ((leftLeg?.amputated && !leftLeg.installedProstheticEntityId) ||
        (rightLeg?.amputated && !rightLeg.installedProstheticEntityId)) {
      totalDb += 10; // Dragging/stumbling limb
    }
  }

  if (actor.inventory && actor.inventory.currentMassGrams > actor.inventory.maxMassGrams) {
    totalDb += 10; // Overencumbered rattling gear
  }

  if (actor.actor?.posture === 'CROUCHED') {
    totalDb = Math.max(1, Math.floor(totalDb / 2));
  }

  return totalDb;
}

/**
 * Emits a deterministic acoustic pulse that alerts nearby autonomous NPCs
 * within decibel-determined hearing range to investigate the noise origin.
 */
export function emitAcousticPulse(
  state: WorldState,
  origin: Point3D,
  decibels: number,
  turn: number,
  sourceActorId?: EntityId,
): SystemAcousticResult {
  const soundEvent: SimEvent = {
    type: 'SOUND_EMITTED',
    turn,
    origin,
    decibels,
    ...(sourceActorId ? { sourceActorId } : {}),
  };

  const effectiveRange = Math.max(1, Math.floor(decibels / 8));
  let updatedEntities = state.entities;
  let hasModifications = false;

  for (const entity of Object.values(state.entities)) {
    if (!entity.aiController || !entity.actor || entity.actor.isPlayer || !entity.position) {
      continue;
    }
    if (entity.position.stratum !== origin.stratum) continue;
    if (sourceActorId && entity.id === sourceActorId) continue;

    const dist = Math.max(
      Math.abs(entity.position.x - origin.x),
      Math.abs(entity.position.y - origin.y),
    );

    if (dist <= effectiveRange) {
      if (!hasModifications) {
        updatedEntities = { ...state.entities };
        hasModifications = true;
      }
      updatedEntities[entity.id] = {
        ...entity,
        aiController: {
          ...entity.aiController,
          alertState: entity.aiController.alertState === 'COMBAT' ? 'COMBAT' : 'INVESTIGATING',
          lastKnownTargetPos: { x: origin.x, y: origin.y, stratum: origin.stratum },
        },
      };
    }
  }

  return {
    state: hasModifications ? { ...state, entities: updatedEntities } : state,
    events: [soundEvent],
  };
}

/**
 * Validates whether an observer actor has clear line-of-sight to a target actor,
 * considering distance, shadowcasting obstacles, steam/smog particulate opacity,
 * and observer OCULAR_MOUNT integrity (blindness).
 */
export function canActorSpotTarget(
  state: Readonly<WorldState>,
  observerId: EntityId,
  targetId: EntityId,
): boolean {
  const observer = state.entities[observerId];
  const target = state.entities[targetId];
  if (!observer?.position || !target?.position) return false;
  if (observer.position.stratum !== target.position.stratum) return false;

  const grid = state.strata[observer.position.stratum];
  if (!grid) return false;

  const baseRadius = observer.actor?.isPlayer ? 10 : 8;
  const bonusRadius = computeProstheticFovBonus(state, observer) +
    (observer.traits?.includes('NIGHT_OPTICS') ? 2 : 0);
  const rawVisionRadius = computeActorFovRadius(observer, baseRadius, bonusRadius);

  const gaslightField = calculateGaslightField(state as WorldState, observer.position.stratum);
  const targetGaslight = gaslightField.get(pointKey(target.position.x, target.position.y)) ?? 0;
  const targetCell = getTileCell(grid, target.position.x, target.position.y);
  const targetSmoke = targetCell?.smokePpm ?? 0;

  let visionModifier = 0;
  if (rawVisionRadius > 1) {
    if (targetGaslight > 0) visionModifier += 4;
    if (targetSmoke >= 50) visionModifier -= 3;
  }
  const visionRadius = Math.max(1, rawVisionRadius + visionModifier);

  const visibleTiles = computeVisibleTiles(
    grid,
    observer.position.x,
    observer.position.y,
    visionRadius,
  );

  if (!isPointVisible(visibleTiles, target.position)) return false;

  if (target.actor?.posture === 'CROUCHED') {
    const offsets: ReadonlyArray<readonly [number, number]> = [[-1, 0], [1, 0], [0, -1], [0, 1]];
    const hasLowCover = offsets.some(([dx, dy]) => {
      const cx = target.position!.x + dx;
      const cy = target.position!.y + dy;
      if (cx < 0 || cx >= grid.width || cy < 0 || cy >= grid.height) return false;
      const cell = grid.cells[cy * grid.width + cx];
      return cell?.terrainType === 'RUBBLE_PILE' || cell?.terrainType === 'SMASHED_WINDOW_FRAME';
    });
    const dist = Math.max(Math.abs(observer.position.x - target.position.x), Math.abs(observer.position.y - target.position.y));
    if (hasLowCover && dist > 3) return false;
  }

  return true;
}

export { canActorSpotTarget as evaluateStealthDetection };
