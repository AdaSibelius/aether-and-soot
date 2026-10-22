import { SimEvent } from '../../schemas/events.schema.js';
import { EntityId, FactionId, Point3D } from '../../schemas/primitives.schema.js';
import { InitiateTurfSkirmishCommand } from '../../schemas/skirmish-commands.schema.js';
import { TurfSectorRecord } from '../../schemas/skirmish-records.schema.js';
import { STANDARD_ACTION_AP } from '../core/scheduler.js';
import { WorldState } from '../core/world.js';

export function getTurfAtPosition(state: WorldState, pos: Point3D): TurfSectorRecord | undefined {
  return Object.values(state.turf).find((t) => (
    t.stratum === pos.stratum &&
    pos.x >= t.bounds.xMin &&
    pos.x <= t.bounds.xMax &&
    pos.y >= t.bounds.yMin &&
    pos.y <= t.bounds.yMax
  ));
}

export function registerTurfSector(state: WorldState, turf: TurfSectorRecord): WorldState {
  return { ...state, turf: { ...state.turf, [turf.turfId]: turf } };
}

export function resolveInitiateTurfSkirmish(
  state: WorldState,
  cmd: InitiateTurfSkirmishCommand,
): { state: WorldState; apSpent: number; events: SimEvent[] } {
  const actor = state.entities[cmd.actorId];
  const turf = state.turf[cmd.turfId];
  const turn = state.turnCount + 1;
  if (!actor || !turf) return { state, apSpent: STANDARD_ACTION_AP, events: [] };

  const factionId: FactionId = actor.aiController?.factionId ?? 'UNDERCROFT_SYNDICATE';
  const updatedTurf: TurfSectorRecord = {
    ...turf,
    contested: true,
    lastSkirmishTurn: turn,
    controlScores: {
      ...turf.controlScores,
      [factionId]: (turf.controlScores[factionId] ?? 0) + 15,
    },
  };

  const centerPos: Point3D = {
    x: Math.floor((turf.bounds.xMin + turf.bounds.xMax) / 2),
    y: Math.floor((turf.bounds.yMin + turf.bounds.yMax) / 2),
    stratum: turf.stratum,
  };

  const events: SimEvent[] = [
    {
      type: 'TURF_CONTESTED',
      turn,
      turfId: turf.turfId,
      districtId: turf.districtId,
      controllingFactionId: turf.controllingFactionId,
      contestingFactionId: factionId,
      position: centerPos,
    },
    {
      type: 'ACTOR_TURF_STATE_CHANGED',
      turn,
      actorId: cmd.actorId,
      turfId: turf.turfId,
      contested: true,
      factionId,
    },
  ];

  return {
    state: { ...state, turf: { ...state.turf, [turf.turfId]: updatedTurf } },
    apSpent: STANDARD_ACTION_AP,
    events,
  };
}

export function processActorTurfMovement(
  state: WorldState,
  actorId: EntityId,
  oldPos: Point3D,
  newPos: Point3D,
): { state: WorldState; events: SimEvent[] } {
  const actor = state.entities[actorId];
  if (!actor) return { state, events: [] };
  const oldTurf = getTurfAtPosition(state, oldPos);
  const newTurf = getTurfAtPosition(state, newPos);
  if (oldTurf?.turfId === newTurf?.turfId && !newTurf?.contested) return { state, events: [] };

  const turn = state.turnCount + 1;
  const factionId = actor.aiController?.factionId;
  const events: SimEvent[] = [];
  let updatedTurfState = { ...state.turf };

  if (newTurf) {
    const isHostileToController = factionId && newTurf.controllingFactionId && factionId !== newTurf.controllingFactionId;
    const becomesContested = Boolean(isHostileToController || newTurf.contested);

    if (becomesContested && !newTurf.contested && factionId) {
      updatedTurfState[newTurf.turfId] = { ...newTurf, contested: true, lastSkirmishTurn: turn };
      events.push({
        type: 'TURF_CONTESTED',
        turn,
        turfId: newTurf.turfId,
        districtId: newTurf.districtId,
        controllingFactionId: newTurf.controllingFactionId,
        contestingFactionId: factionId,
        position: newPos,
      });
    }

    events.push({
      type: 'ACTOR_TURF_STATE_CHANGED',
      turn,
      actorId,
      turfId: newTurf.turfId,
      contested: becomesContested,
      factionId,
    });
  } else if (oldTurf) {
    events.push({
      type: 'ACTOR_TURF_STATE_CHANGED',
      turn,
      actorId,
      turfId: undefined,
      contested: false,
      factionId,
    });
  }

  return { state: { ...state, turf: updatedTurfState }, events };
}

export function processActorTurfCombat(
  state: WorldState,
  attackerId: EntityId,
  targetId: EntityId,
): { state: WorldState; events: SimEvent[] } {
  const attacker = state.entities[attackerId];
  const target = state.entities[targetId];
  if (!attacker?.position || !target?.position) return { state, events: [] };

  const turf = getTurfAtPosition(state, target.position);
  if (!turf) return { state, events: [] };

  const turn = state.turnCount + 1;
  const atkFaction: FactionId = attacker.aiController?.factionId ?? 'UNDERCROFT_SYNDICATE';
  const prevScore = turf.controlScores[atkFaction] ?? 0;
  const newScore = prevScore + 30;
  const updatedScores = { ...turf.controlScores, [atkFaction]: newScore };

  const events: SimEvent[] = [];
  let nextControlling = turf.controllingFactionId;

  if (newScore >= 60 && turf.controllingFactionId !== atkFaction) {
    events.push({
      type: 'TURF_CONTROL_CHANGED',
      turn,
      turfId: turf.turfId,
      districtId: turf.districtId,
      previousFactionId: turf.controllingFactionId,
      newFactionId: atkFaction,
    });
    nextControlling = atkFaction;
  } else if (!turf.contested) {
    events.push({
      type: 'TURF_CONTESTED',
      turn,
      turfId: turf.turfId,
      districtId: turf.districtId,
      controllingFactionId: turf.controllingFactionId,
      contestingFactionId: atkFaction,
      position: target.position,
    });
  }

  events.push({
    type: 'ACTOR_TURF_STATE_CHANGED',
    turn,
    actorId: attackerId,
    turfId: turf.turfId,
    contested: true,
    factionId: atkFaction,
  });

  const updatedTurf: TurfSectorRecord = {
    ...turf,
    contested: nextControlling === atkFaction ? false : true,
    controllingFactionId: nextControlling,
    controlScores: updatedScores,
    lastSkirmishTurn: turn,
  };

  return {
    state: { ...state, turf: { ...state.turf, [turf.turfId]: updatedTurf } },
    events,
  };
}

export function recordTacticalCoverManeuver(
  state: WorldState,
  actorId: EntityId,
  maneuverType: 'VENT_STEAM_COVER' | 'PORTAL_TACTICAL_ESCAPE',
  details?: string,
): { state: WorldState; events: SimEvent[] } {
  const actor = state.entities[actorId];
  const turn = state.turnCount + 1;
  const turf = actor?.position ? getTurfAtPosition(state, actor.position) : undefined;

  const event: SimEvent = {
    type: 'TACTICAL_MANEUVER_RECORDED',
    turn,
    actorId,
    maneuverType,
    turfId: turf?.turfId,
    details,
  };

  return { state, events: [event] };
}
