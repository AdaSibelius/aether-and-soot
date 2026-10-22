import { SimEvent } from '../../schemas/events.schema.js';
import { EntityId, FactionId, Point3D } from '../../schemas/primitives.schema.js';
import { PrepareSupplyConvoyCommand } from '../../schemas/skirmish-commands.schema.js';
import { EscortConvoyRecord } from '../../schemas/skirmish-records.schema.js';
import { STANDARD_ACTION_AP } from '../core/scheduler.js';
import { WorldState } from '../core/world.js';

export function resolvePrepareSupplyConvoy(
  state: WorldState,
  cmd: PrepareSupplyConvoyCommand,
): { state: WorldState; apSpent: number; events: SimEvent[] } {
  const actor = state.entities[cmd.actorId];
  const item = state.entities[cmd.cargoItemId];
  const turn = state.turnCount + 1;

  if (!actor || !item) {
    return { state, apSpent: STANDARD_ACTION_AP, events: [] };
  }

  const convoyId = `convoy_${cmd.clientFactionId}_${turn}_${cmd.cargoItemId}`;
  const record: EscortConvoyRecord = {
    convoyId,
    clientFactionId: cmd.clientFactionId,
    destinationDistrictId: cmd.destinationDistrictId,
    destinationPos: cmd.destinationPos,
    cargoItemId: cmd.cargoItemId,
    stage: 'PREPARATION',
    escortCompanionIds: [],
    rewardPence: cmd.rewardPence ?? 60,
    startedTurn: turn,
  };

  const events: SimEvent[] = [
    {
      type: 'CONVOY_PREPARATION_STARTED',
      turn,
      convoyId,
      actorId: cmd.actorId,
      cargoItemId: cmd.cargoItemId,
      clientFactionId: cmd.clientFactionId,
    },
  ];

  return {
    state: { ...state, convoys: { ...state.convoys, [convoyId]: record } },
    apSpent: STANDARD_ACTION_AP,
    events,
  };
}

export function processCraftSupplyConvoyPrep(
  state: WorldState,
  actorId: EntityId,
  recipeId: string,
  cargoItemId: EntityId,
  clientFactionId: FactionId = 'IRONMONGERS_CARTEL',
): { state: WorldState; events: SimEvent[] } {
  const turn = state.turnCount + 1;
  const convoyId = `convoy_craft_${turn}_${cargoItemId}`;
  const record: EscortConvoyRecord = {
    convoyId,
    clientFactionId,
    destinationDistrictId: state.currentDistrictId,
    cargoItemId,
    stage: 'PREPARATION',
    escortCompanionIds: [],
    rewardPence: 75,
    startedTurn: turn,
  };

  const events: SimEvent[] = [
    {
      type: 'CONVOY_PREPARATION_STARTED',
      turn,
      convoyId,
      actorId,
      cargoItemId,
      recipeId,
      clientFactionId,
    },
  ];

  return {
    state: { ...state, convoys: { ...state.convoys, [convoyId]: record } },
    events,
  };
}

export function processCompanionEscortAssignment(
  state: WorldState,
  _actorId: EntityId,
  companionId: EntityId,
): { state: WorldState; events: SimEvent[] } {
  const companion = state.entities[companionId];
  if (!companion) return { state, events: [] };

  const turn = state.turnCount + 1;
  const activeConvoy = Object.values(state.convoys).find(
    (c) => c.stage === 'PREPARATION' || c.stage === 'ESCORT_ASSIGNED',
  );
  if (!activeConvoy) return { state, events: [] };

  const updatedConvoy: EscortConvoyRecord = {
    ...activeConvoy,
    stage: 'ESCORT_ASSIGNED',
    escortCompanionIds: [...new Set([...activeConvoy.escortCompanionIds, companionId])],
  };

  const role = companion.aiController?.role ?? 'ESCORT_GUARD';
  const events: SimEvent[] = [
    {
      type: 'CONVOY_ESCORT_ASSIGNED',
      turn,
      convoyId: activeConvoy.convoyId,
      companionId,
      role,
    },
  ];

  return {
    state: { ...state, convoys: { ...state.convoys, [activeConvoy.convoyId]: updatedConvoy } },
    events,
  };
}

export function processDropItemDelivery(
  state: WorldState,
  actorId: EntityId,
  itemEntityId: EntityId,
  dropPos: Point3D,
): { state: WorldState; events: SimEvent[] } {
  const matchingConvoy = Object.values(state.convoys).find(
    (c) => c.cargoItemId === itemEntityId && (c.stage === 'PREPARATION' || c.stage === 'ESCORT_ASSIGNED' || c.stage === 'IN_TRANSIT'),
  );
  if (!matchingConvoy) return { state, events: [] };

  const turn = state.turnCount + 1;
  const allCompanionsAlive = matchingConvoy.escortCompanionIds.every((cid) => {
    const comp = state.entities[cid];
    if (!comp?.anatomy) return true;
    return (comp.anatomy.limbs.TORSO?.hp ?? 0) > 0 && comp.anatomy.bloodVolumePct > 0;
  });

  const updatedConvoy: EscortConvoyRecord = {
    ...matchingConvoy,
    stage: 'DELIVERED',
    completedTurn: turn,
  };

  const curRep = state.economy.factionReputation[matchingConvoy.clientFactionId] ?? 0;
  const bonusRep = allCompanionsAlive ? 20 : 10;
  const newRep = Math.min(100, curRep + bonusRep);
  const updatedTreasury = state.economy.playerTreasuryPence + matchingConvoy.rewardPence;

  const events: SimEvent[] = [
    {
      type: 'CONVOY_DELIVERY_CONFIRMED',
      turn,
      convoyId: matchingConvoy.convoyId,
      actorId,
      cargoItemId: itemEntityId,
      targetLocation: dropPos,
      success: true,
      rewardPence: matchingConvoy.rewardPence,
      escortSurvival: allCompanionsAlive,
    },
  ];

  return {
    state: {
      ...state,
      economy: {
        ...state.economy,
        playerTreasuryPence: updatedTreasury,
        factionReputation: {
          ...state.economy.factionReputation,
          [matchingConvoy.clientFactionId]: newRep,
        },
      },
      convoys: { ...state.convoys, [matchingConvoy.convoyId]: updatedConvoy },
    },
    events,
  };
}
