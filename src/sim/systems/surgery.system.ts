import { EntityRecord } from '../../schemas/components.schema.js';
import { SimEvent } from '../../schemas/events.schema.js';
import { EntityId, LimbSlotId } from '../../schemas/primitives.schema.js';
import { DissectCorpseAnatomyCommand } from '../../schemas/lore-commands.schema.js';
import { STANDARD_ACTION_AP } from '../core/scheduler.js';
import { WorldState } from '../core/world.js';
import { discoverCodexEntry } from './codex.system.js';
import { isActorFatal } from './mortality.system.js';
import { processCrimeWitnesses } from './squad-witness.system.js';

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

  let workingState: WorldState = { ...state, entities: nextEntities };
  if (actor.actor?.isPlayer) {
    const victimFaction = corpse.aiController?.factionId ?? 'CROWN_CONSTABULARY';
    const witnessRes = processCrimeWitnesses(workingState, actorId, victimFaction, 'THEFT');
    workingState = witnessRes.state;
    events.push(...witnessRes.events);
  }

  return {
    state: workingState,
    apSpent: 150,
    events,
  };
}

export function resolveDissectCorpseAnatomy(
  state: WorldState,
  cmd: DissectCorpseAnatomyCommand,
): SystemSurgeryResult {
  const { actorId, corpseEntityId, toolEntityId, targetSlot } = cmd;
  const actor = state.entities[actorId];
  const corpse = state.entities[corpseEntityId];
  if (!actor || !corpse) return failHarvest(state, actorId, corpseEntityId, 'CORPSE_NOT_FOUND');
  if (!actor.position || !corpse.position || actor.position.stratum !== corpse.position.stratum) {
    return failHarvest(state, actorId, corpseEntityId, 'TOO_DISTANT');
  }
  const dist = Math.max(Math.abs(actor.position.x - corpse.position.x), Math.abs(actor.position.y - corpse.position.y));
  if (dist > 1) return failHarvest(state, actorId, corpseEntityId, 'TOO_DISTANT');

  const dead = isActorFatal(corpse) || !corpse.actor || (corpse.anatomy && corpse.anatomy.bloodVolumePct <= 0) || corpse.name.toLowerCase().includes('corpse');
  if (!dead) return failHarvest(state, actorId, corpseEntityId, 'NOT_DEAD');

  const tool = state.entities[toolEntityId];
  const toolCarried = actor.inventory?.containedEntityIds.includes(toolEntityId) || actor.inventory?.equippedSlots?.WIELD === toolEntityId;
  if (!tool || !toolCarried) return failHarvest(state, actorId, corpseEntityId, 'LACKS_SURGICAL_TOOL');

  const events: SimEvent[] = [];
  let workingState = state;

  const isAutomaton = corpse.name.toLowerCase().includes('automaton') || corpse.name.toLowerCase().includes('warden') || corpse.name.toLowerCase().includes('clockwork');
  if (isAutomaton) {
    const codexRes = discoverCodexEntry(workingState, actorId, {
      id: `codex_automaton_${corpse.name.toLowerCase().replace(/[^a-z0-9]+/g, '_')}_${targetSlot.toLowerCase()}`,
      category: 'AUTOMATON',
      title: `${corpse.name} ${targetSlot} Autopsy`,
      description: `Forensic anatomical dissection of ${corpse.name}'s ${targetSlot} revealed complex gear trains and clockwork escapements.`,
      tags: ['AUTOMATON', 'DISSECTION', 'ANATOMY', targetSlot],
    });
    workingState = codexRes.state;
    if (codexRes.event) events.push(codexRes.event);
  }

  // Desecration witnessed check
  if (actor.actor?.isPlayer) {
    const victimFaction = corpse.aiController?.factionId ?? 'CROWN_CONSTABULARY';
    const witnessRes = processCrimeWitnesses(workingState, actorId, victimFaction, 'THEFT');
    workingState = witnessRes.state;
    events.push(...witnessRes.events);

    const reportEvt = witnessRes.events.find((e) => e.type === 'WITNESS_CRIME_REPORTED');
    if (reportEvt && reportEvt.type === 'WITNESS_CRIME_REPORTED') {
      events.push({
        type: 'CORPSE_DESECRATION_WITNESSED',
        turn: workingState.turnCount,
        witnessId: reportEvt.witnessId,
        perpetratorId: actorId,
        corpseEntityId,
        victimFactionId: victimFaction,
        reputationPenalty: -15,
      });
    }
  }

  return {
    state: workingState,
    events,
    apSpent: 150,
  };
}
