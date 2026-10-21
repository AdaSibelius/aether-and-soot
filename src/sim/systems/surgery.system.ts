import { EntityRecord } from '../../schemas/components.schema.js';
import { SimEvent } from '../../schemas/events.schema.js';
import { EntityId, LimbSlotId } from '../../schemas/primitives.schema.js';
import { STANDARD_ACTION_AP } from '../core/scheduler.js';
import { WorldState } from '../core/world.js';
import { isActorFatal } from './mortality.system.js';

export interface SystemSurgeryResult {
  readonly state: WorldState;
  readonly events: SimEvent[];
  readonly apSpent: number;
}

type HarvestFailReason = Extract<SimEvent, { type: 'HARVEST_ACTION_FAILED' }>['reason'];

function failHarvest(
  state: WorldState,
  actorId: EntityId,
  corpseEntityId: EntityId,
  reason: HarvestFailReason,
): SystemSurgeryResult {
  return {
    state,
    apSpent: STANDARD_ACTION_AP,
    events: [{ type: 'HARVEST_ACTION_FAILED', turn: state.turnCount + 1, actorId, corpseEntityId, reason }],
  };
}

export function resolveHarvestCorpse(
  state: WorldState,
  actorId: EntityId,
  corpseEntityId: EntityId,
  toolEntityId: EntityId,
  slot?: LimbSlotId,
): SystemSurgeryResult {
  const actor = state.entities[actorId];
  const corpse = state.entities[corpseEntityId];
  const turn = state.turnCount + 1;
  if (!actor || !corpse) return failHarvest(state, actorId, corpseEntityId, 'CORPSE_NOT_FOUND');

  if (!actor.position || !corpse.position || actor.position.stratum !== corpse.position.stratum) {
    return failHarvest(state, actorId, corpseEntityId, 'TOO_DISTANT');
  }
  const dist = Math.max(Math.abs(actor.position.x - corpse.position.x), Math.abs(actor.position.y - corpse.position.y));
  if (dist > 1) {
    return failHarvest(state, actorId, corpseEntityId, 'TOO_DISTANT');
  }

  const dead = isActorFatal(corpse) || !corpse.actor || (corpse.anatomy && corpse.anatomy.bloodVolumePct <= 0) || corpse.name.toLowerCase().includes('corpse');
  if (!dead) {
    return failHarvest(state, actorId, corpseEntityId, 'NOT_DEAD');
  }

  const tool = state.entities[toolEntityId];
  const toolCarried = actor.inventory?.containedEntityIds.includes(toolEntityId) || actor.inventory?.equippedSlots?.WIELD === toolEntityId;
  const toolQuality = tool?.item?.toolQualities?.SURGERY !== undefined
    ? Math.min(100, tool.item.toolQualities.SURGERY * 35)
    : (tool?.item?.surgicalQuality ?? (
      tool?.item?.blueprintId.includes('scalpel') ? 90 :
      tool?.item?.blueprintId.includes('saw') ? 75 :
      tool?.item?.blueprintId.includes('wrench') ? 35 : undefined
    ));
  if (!tool || !toolCarried || toolQuality === undefined) {
    return failHarvest(state, actorId, corpseEntityId, 'LACKS_SURGICAL_TOOL');
  }

  if (!corpse.anatomy) return failHarvest(state, actorId, corpseEntityId, 'NO_PROSTHETIC');
  let targetSlot: LimbSlotId | undefined = slot;
  if (targetSlot) {
    const limb = corpse.anatomy.limbs[targetSlot];
    if (!limb?.installedProstheticEntityId) targetSlot = undefined;
  }
  if (!targetSlot) {
    for (const [s, limb] of Object.entries(corpse.anatomy.limbs)) {
      if (limb?.installedProstheticEntityId) {
        targetSlot = s as LimbSlotId;
        break;
      }
    }
  }
  if (!targetSlot) return failHarvest(state, actorId, corpseEntityId, 'NO_PROSTHETIC');

  const limb = corpse.anatomy.limbs[targetSlot]!;
  const prostheticId = limb.installedProstheticEntityId!;
  const prosthetic = state.entities[prostheticId];
  if (!prosthetic || !prosthetic.prostheticSpec) return failHarvest(state, actorId, corpseEntityId, 'NO_PROSTHETIC');

  const itemDamagePct = toolQuality < 40 ? 60 : toolQuality < 70 ? 35 : 5;
  const qualityLabel = toolQuality >= 70 ? 'FINE' : toolQuality >= 40 ? 'STANDARD' : 'CRUDE';

  const updatedProsthetic: EntityRecord = {
    ...prosthetic,
    prostheticSpec: {
      ...prosthetic.prostheticSpec,
      pressureRatingKpa: Math.max(15, Math.round(prosthetic.prostheticSpec.pressureRatingKpa * (1 - itemDamagePct / 100))),
    },
    position: undefined,
  };

  const { installedProstheticEntityId: _, ...cleanLimb } = limb;
  const updatedCorpse: EntityRecord = {
    ...corpse,
    anatomy: {
      ...corpse.anatomy,
      limbs: {
        ...corpse.anatomy.limbs,
        [targetSlot]: cleanLimb,
      },
    },
  };

  const mass = prosthetic.prostheticSpec.massGrams;
  let nextActor = actor;
  let finalProsthetic = updatedProsthetic;
  const nextEntities = { ...state.entities, [corpseEntityId]: updatedCorpse };

  if (actor.inventory && actor.inventory.currentMassGrams + mass <= actor.inventory.maxMassGrams) {
    nextActor = {
      ...actor,
      inventory: {
        ...actor.inventory,
        containedEntityIds: [...actor.inventory.containedEntityIds, prostheticId],
        currentMassGrams: actor.inventory.currentMassGrams + mass,
      },
    };
    nextEntities[actorId] = nextActor;
    nextEntities[prostheticId] = finalProsthetic;
  } else {
    finalProsthetic = {
      ...finalProsthetic,
      position: { ...actor.position, blocksMovement: false, blocksSight: false },
    };
    nextEntities[prostheticId] = finalProsthetic;
  }

  const events: SimEvent[] = [{
    type: 'CYBERNETIC_HARVESTED',
    turn,
    actorId,
    corpseEntityId,
    prostheticEntityId: prostheticId,
    prostheticBlueprintId: prosthetic.prostheticSpec.blueprintId,
    slot: targetSlot,
    itemDamagePct,
    toolQuality: qualityLabel,
  }];

  return {
    state: { ...state, entities: nextEntities },
    apSpent: 150,
    events,
  };
}
