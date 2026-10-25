import { EntityRecord } from '../../schemas/components.schema.js';
import { SimEvent } from '../../schemas/events.schema.js';
import { EntityId, LimbSlotId } from '../../schemas/primitives.schema.js';
import { SeededRNG } from '../core/rng.js';
import { STANDARD_ACTION_AP } from '../core/scheduler.js';
import { WorldState } from '../core/world.js';
import { computeVisibleTiles, isPointVisible } from '../spatial/fov.js';
import { resolveDamageLimb } from './anatomy.system.js';
import { getEquipmentSpec } from './equipment.system.js';
import { resolveActorDefeatIfFatal } from './mortality.system.js';
import { processCrimeWitnesses } from './squad-witness.system.js';
import { emitAcousticPulse } from './stealth-acoustics.system.js';

function failBallistics(state: WorldState, actorId: EntityId, reason: string) {
  return {
    state,
    apSpent: STANDARD_ACTION_AP,
    events: [{
      type: 'EQUIPMENT_ACTION_FAILED' as const,
      turn: state.turnCount + 1,
      actorId,
      reason,
    }],
  };
}

/**
 * Fires a ranged weapon (e.g. pneumatic harpoon rifle) from actor to target limb.
 * Consumes compressed steam, performs LOS and range checks, rolls accuracy, and damages limb.
 */
export function resolveFireRangedWeapon(
  state: WorldState,
  actorId: EntityId,
  targetId: EntityId,
  targetSlot: LimbSlotId,
  rng: SeededRNG,
): { state: WorldState; events: SimEvent[]; apSpent: number } {
  const actor = state.entities[actorId];
  if (!actor?.position || !actor.inventory || !actor.anatomy) {
    return failBallistics(state, actorId, 'Actor cannot fire ranged weapons.');
  }

  const wieldedId = actor.inventory.equippedSlots?.['WIELD'];
  if (!wieldedId) {
    return failBallistics(state, actorId, 'No weapon wielded in hand.');
  }

  const wieldedItem = state.entities[wieldedId];
  if (!wieldedItem) {
    return failBallistics(state, actorId, 'Wielded item not found.');
  }
  const spec = getEquipmentSpec(wieldedItem);
  if (!spec || spec.rangedRange <= 0) {
    return failBallistics(state, actorId, 'Wielded item is not a ranged weapon.');
  }

  const target = state.entities[targetId];
  if (!target?.position || !target.anatomy) {
    return failBallistics(state, actorId, 'Invalid target entity.');
  }

  if (actor.position.stratum !== target.position.stratum) {
    return failBallistics(state, actorId, 'Target is on a different stratum.');
  }

  const dx = Math.abs(actor.position.x - target.position.x);
  const dy = Math.abs(actor.position.y - target.position.y);
  const distance = Math.max(dx, dy);

  if (distance === 0) {
    return failBallistics(state, actorId, 'Cannot target yourself.');
  }

  if (distance > spec.rangedRange) {
    return failBallistics(state, actorId, `Target is out of range (${distance} > ${spec.rangedRange}).`);
  }

  const grid = state.strata[actor.position.stratum];
  if (!grid) {
    return failBallistics(state, actorId, 'Stratum grid not found.');
  }

  const visibleTiles = computeVisibleTiles(grid, actor.position.x, actor.position.y, spec.rangedRange);
  if (!isPointVisible(visibleTiles, target.position)) {
    return failBallistics(state, actorId, 'Line of sight to target is blocked.');
  }

  if (actor.anatomy.steamReserveKpa < spec.rangedSteamCostKpa) {
    return failBallistics(
      state,
      actorId,
      `Insufficient steam pressure (${actor.anatomy.steamReserveKpa.toFixed(0)}/${spec.rangedSteamCostKpa} kPa needed).`,
    );
  }

  // Deduct steam cost
  const nextSteam = Math.max(0, actor.anatomy.steamReserveKpa - spec.rangedSteamCostKpa);
  let nextState: WorldState = {
    ...state,
    entities: {
      ...state.entities,
      [actorId]: {
        ...actor,
        anatomy: {
          ...actor.anatomy,
          steamReserveKpa: nextSteam,
        },
      },
    },
  };

  const hitRoll = rng.nextFloat();
  const hit = hitRoll < 0.85;
  const turn = state.turnCount + 1;

  // Consume loaded ammo if present and calculate ammo bonus damage
  let ammoBonusDamage = 0;
  const loadedAmmo = wieldedItem.equipmentSpec?.loadedAmmo;
  if (loadedAmmo && loadedAmmo.count > 0) {
    if (loadedAmmo.blueprintId.includes('flechette')) ammoBonusDamage += 6;
    if (loadedAmmo.blueprintId.includes('incendiary') || loadedAmmo.blueprintId.includes('phosphor')) ammoBonusDamage += 10;

    const nextCount = loadedAmmo.count - 1;
    const updatedLoaded = nextCount > 0 ? { ...loadedAmmo, count: nextCount } : undefined;
    const updatedWep: EntityRecord = {
      ...wieldedItem,
      equipmentSpec: { ...spec, loadedAmmo: updatedLoaded },
      item: wieldedItem.item ? { ...wieldedItem.item, equipmentSpec: { ...spec, loadedAmmo: updatedLoaded } } : undefined,
    };
    nextState = { ...nextState, entities: { ...nextState.entities, [wieldedId]: updatedWep } };
  }

  const isSilenced = wieldedItem.equipmentSpec?.installedModBlueprintIds?.some(
    (id) => id.includes('baffler') || id.includes('silencer'),
  );
  const shotNoiseDb = isSilenced ? 50 : 75;
  const acoustic = emitAcousticPulse(nextState, actor.position, shotNoiseDb, turn, actorId);
  nextState = acoustic.state;

  const witnessEvents: SimEvent[] = [];
  if (actor.actor?.isPlayer && target.aiController) {
    const factionId = target.aiController.factionId;
    const witnessRes = processCrimeWitnesses(nextState, actorId, factionId, 'ASSAULT');
    nextState = witnessRes.state;
    witnessEvents.push(...witnessRes.events);
  }

  if (!hit) {
    const remainingHp = Object.values(target.anatomy.limbs)
      .reduce((sum, l) => sum + (l && !l.amputated ? l.hp : 0), 0);

    return {
      state: nextState,
      apSpent: STANDARD_ACTION_AP,
      events: [...witnessEvents, {
        type: 'RANGED_ATTACK_RESOLVED',
        turn,
        attackerId: actorId,
        targetId,
        targetSlot,
        weaponName: wieldedItem?.name ?? 'Ranged Weapon',
        hit: false,
        damageDealt: 0,
        remainingTargetHp: remainingHp,
        steamSpentKpa: spec.rangedSteamCostKpa,
      }, ...acoustic.events],
    };
  }

  const targetArmor = target.combatStats?.armorReduction ?? 0;
  const damageDealt = Math.max(1, spec.rangedDamage + ammoBonusDamage - targetArmor);
  const dmgRes = resolveDamageLimb(nextState, targetId, targetSlot, damageDealt);
  nextState = dmgRes.state;

  const defeatRes = resolveActorDefeatIfFatal(nextState, targetId, actorId);
  nextState = defeatRes.state;

  const updatedTarget = nextState.entities[targetId];
  const remainingHp = updatedTarget?.anatomy
    ? Object.values(updatedTarget.anatomy.limbs).reduce((sum, l) => sum + (l && !l.amputated ? l.hp : 0), 0)
    : 0;

  const attackEvent: SimEvent = {
    type: 'RANGED_ATTACK_RESOLVED',
    turn,
    attackerId: actorId,
    targetId,
    targetSlot,
    weaponName: wieldedItem?.name ?? 'Ranged Weapon',
    hit: true,
    damageDealt,
    remainingTargetHp: remainingHp,
    steamSpentKpa: spec.rangedSteamCostKpa,
  };

  return {
    state: nextState,
    apSpent: STANDARD_ACTION_AP,
    events: [...witnessEvents, attackEvent, ...dmgRes.events, ...defeatRes.events, ...acoustic.events],
  };
}
