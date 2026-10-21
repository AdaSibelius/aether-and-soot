import { EntityRecord } from '../../schemas/components.schema.js';
import { SimEvent } from '../../schemas/events.schema.js';
import { EntityId, FactionId, StratumId } from '../../schemas/primitives.schema.js';
import { WorldState } from '../core/world.js';
import { canActorSpotTarget } from './stealth-acoustics.system.js';

export interface SquadWitnessResult {
  readonly state: WorldState;
  readonly events: SimEvent[];
}

const CRIME_REPUTATION_PENALTIES: Record<'THEFT' | 'ASSAULT' | 'TRESPASS', number> = {
  THEFT: -20,
  ASSAULT: -15,
  TRESPASS: -10,
};

export const SQUAD_CALLOUT_NOISE_DB = 90;
export const SQUAD_CALLOUT_HEARING_THRESHOLD_DB = 25;

export function isLocationOccludedBySmog(state: WorldState, pos: { x: number; y: number; stratum: StratumId }): boolean {
  const grid = state.strata[pos.stratum];
  if (!grid) return false;
  const cell = grid.cells[pos.y * grid.width + pos.x];
  if (!cell) return false;
  return (cell.smokePpm !== undefined && cell.smokePpm >= 100) || cell.steamPressureKpa >= 50 || cell.coalDustDensity >= 0.3;
}

function recordGrudgeAndMemory(
  entity: EntityRecord,
  perpetratorId: EntityId,
  perpPos: { x: number; y: number; stratum: StratumId },
  crime: 'THEFT' | 'ASSAULT' | 'TRESPASS',
  turn: number,
): { updated: EntityRecord; grudgeEvent: SimEvent } {
  const ai = entity.aiController!;
  const updated: EntityRecord = {
    ...entity,
    aiController: {
      ...ai,
      hostile: true,
      alertState: 'COMBAT',
      grudgeTargetId: perpetratorId,
      lastKnownTargetPos: { ...perpPos },
      witnessMemory: [...(ai.witnessMemory ?? []), { perpetratorId, crime, turn }],
    },
  };
  const grudgeEvent: SimEvent = {
    type: 'GRUDGE_ACQUIRED',
    turn,
    holderId: entity.id,
    targetId: perpetratorId,
    reason: `Witnessed ${crime}`,
  };
  return { updated, grudgeEvent };
}

export function resolveReportCrime(
  state: WorldState,
  witnessId: EntityId,
  perpetratorId: EntityId,
  crime: 'THEFT' | 'ASSAULT' | 'TRESPASS',
): SquadWitnessResult {
  const witness = state.entities[witnessId];
  const perp = state.entities[perpetratorId];
  if (!witness?.position || !witness.aiController || !perp?.position) return { state, events: [] };

  const turn = state.turnCount + 1;
  const factionId = witness.aiController.factionId;
  const penalty = CRIME_REPUTATION_PENALTIES[crime];
  const currentRep = state.economy.factionReputation[factionId] ?? 0;
  const newRep = Math.max(-100, Math.min(100, currentRep + penalty));

  const { updated, grudgeEvent } = recordGrudgeAndMemory(witness, perpetratorId, perp.position, crime, turn);
  const events: SimEvent[] = [
    { type: 'WITNESS_CRIME_REPORTED', turn, witnessId, perpetratorId, crime, factionId, reputationPenalty: penalty },
    grudgeEvent,
  ];

  let nextState: WorldState = {
    ...state,
    economy: { ...state.economy, factionReputation: { ...state.economy.factionReputation, [factionId]: newRep } },
    entities: { ...state.entities, [witnessId]: updated },
  };

  if (witness.aiController.squadId) {
    const callout = resolveEmitSquadCallout(nextState, witnessId, perpetratorId, `Halt! Criminal witnessed: ${crime}!`);
    nextState = callout.state;
    events.push(...callout.events);
  }

  return { state: nextState, events };
}

export function processCrimeWitnesses(
  state: WorldState,
  perpetratorId: EntityId,
  victimFactionId: FactionId,
  crime: 'THEFT' | 'ASSAULT' | 'TRESPASS',
): SquadWitnessResult {
  const perp = state.entities[perpetratorId];
  if (!perp?.position || isLocationOccludedBySmog(state, perp.position)) return { state, events: [] };

  const witnessCandidates = Object.values(state.entities)
    .filter((e) => e.id !== perpetratorId && e.aiController?.factionId === victimFactionId && e.position?.stratum === perp.position!.stratum && e.actor && !e.actor.isPlayer)
    .sort((a, b) => (b.aiController?.role === 'GUARD' ? 1 : 0) - (a.aiController?.role === 'GUARD' ? 1 : 0));

  let workingState = state;
  const allEvents: SimEvent[] = [];
  let reported = false;

  for (const candidate of witnessCandidates) {
    if (!candidate.position || isLocationOccludedBySmog(workingState, candidate.position) || !canActorSpotTarget(workingState, candidate.id, perpetratorId)) continue;

    if (!reported) {
      const repRes = resolveReportCrime(workingState, candidate.id, perpetratorId, crime);
      workingState = repRes.state;
      allEvents.push(...repRes.events);
      reported = true;
    } else {
      const turn = workingState.turnCount + 1;
      const candEnt = workingState.entities[candidate.id];
      if (candEnt?.aiController) {
        const { updated, grudgeEvent } = recordGrudgeAndMemory(candEnt, perpetratorId, perp.position, crime, turn);
        workingState = { ...workingState, entities: { ...workingState.entities, [candidate.id]: updated } };
        allEvents.push(grudgeEvent);
        if (candEnt.aiController.squadId) {
          const callout = resolveEmitSquadCallout(workingState, candidate.id, perpetratorId, `Halt! Criminal witnessed: ${crime}!`);
          workingState = callout.state;
          allEvents.push(...callout.events);
        }
      }
    }
  }

  return { state: workingState, events: allEvents };
}

export function resolveEmitSquadCallout(
  state: WorldState,
  callerId: EntityId,
  targetId: EntityId,
  alertMessage: string,
): SquadWitnessResult {
  const caller = state.entities[callerId];
  const target = state.entities[targetId];
  if (!caller?.position || !target?.position) return { state, events: [] };

  const turn = state.turnCount + 1;
  const squadId = caller.aiController?.squadId ?? caller.actor?.squadId ?? 'squad_alpha';
  const callerFaction = caller.aiController?.factionId;
  const events: SimEvent[] = [
    { type: 'SQUAD_CALLOUT_EMITTED', turn, callerId, targetId, squadId, noiseDb: SQUAD_CALLOUT_NOISE_DB, calloutMessage: alertMessage },
  ];

  let nextEntities = { ...state.entities };
  for (const entity of Object.values(state.entities)) {
    if (entity.id === callerId || !entity.aiController || !entity.actor || entity.actor.isPlayer || !entity.position || entity.position.stratum !== caller.position.stratum) continue;
    const isSameSquad = entity.aiController.squadId === squadId;
    const isSameFaction = callerFaction && entity.aiController.factionId === callerFaction;
    if (!isSameSquad && !isSameFaction) continue;

    const dist = Math.max(Math.abs(entity.position.x - caller.position.x), Math.abs(entity.position.y - caller.position.y));
    if (SQUAD_CALLOUT_NOISE_DB - dist * 6 < SQUAD_CALLOUT_HEARING_THRESHOLD_DB) continue;

    nextEntities[entity.id] = {
      ...entity,
      aiController: { ...entity.aiController, hostile: true, alertState: 'COMBAT', grudgeTargetId: targetId, lastKnownTargetPos: { ...target.position } },
    };
    events.push(
      { type: 'SQUADMATE_RALLIED', turn, squadmateId: entity.id, callerId, targetId, squadId },
      { type: 'GRUDGE_ACQUIRED', turn, holderId: entity.id, targetId, reason: 'Rallied by squad callout' },
    );
  }

  return { state: { ...state, entities: nextEntities }, events };
}
