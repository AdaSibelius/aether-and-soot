import { SimEvent } from '../../schemas/events.schema.js';
import { EntityId, FactionId } from '../../schemas/primitives.schema.js';
import { AuditSafehouseDeedCommand } from '../../schemas/skirmish-commands.schema.js';
import { GuildAuditRecord } from '../../schemas/skirmish-records.schema.js';
import { STANDARD_ACTION_AP } from '../core/scheduler.js';
import { WorldState } from '../core/world.js';

export function resolveAuditSafehouseDeed(
  state: WorldState,
  cmd: AuditSafehouseDeedCommand,
): { state: WorldState; apSpent: number; events: SimEvent[] } {
  const deed = state.safehouses[cmd.deedId];
  const inspector = state.entities[cmd.inspectorId];
  const turn = state.turnCount + 1;

  if (!deed || !inspector) {
    return { state, apSpent: STANDARD_ACTION_AP, events: [] };
  }

  const infractions: string[] = [];
  for (const entity of Object.values(state.entities)) {
    if (!entity.position || entity.position.stratum !== deed.stratum) continue;
    const { x, y } = entity.position;
    if (x >= deed.bounds.xMin && x <= deed.bounds.xMax && y >= deed.bounds.yMin && y <= deed.bounds.yMax) {
      if (entity.pressureVessel && (entity.pressureVessel.currentPressureKpa ?? 0) > 150) {
        infractions.push('UNREGISTERED_HIGH_PRESSURE_VESSEL');
      }
      if (entity.trap?.armed) {
        infractions.push('ILLEGAL_COMBAT_TRAP');
      }
      if (entity.furniture?.kind === 'BARRICADE_IRON') {
        infractions.push('UNLICENSED_FORTIFICATION');
      }
    }
  }

  const passed = infractions.length === 0;
  const auditId = `audit_${turn}_${cmd.deedId}`;
  const repDelta = passed ? 10 : -15;
  const ministryFaction: FactionId = 'CROWN_CONSTABULARY';
  const curRep = state.economy.factionReputation[ministryFaction] ?? 0;
  const nextRep = Math.max(-100, Math.min(100, curRep + repDelta));

  const auditRecord: GuildAuditRecord = {
    auditId,
    inspectorId: cmd.inspectorId,
    deedId: cmd.deedId,
    status: passed ? 'PASSED' : 'CITATION_ISSUED',
    infractions,
    scheduledTurn: deed.claimedTurn,
    resolvedTurn: turn,
  };

  const nextGoal = passed ? 'PATROL' : 'REPORT_UNSAFE_WORKSHOP';
  const events: SimEvent[] = [
    {
      type: 'NPC_GOAL_CHANGED',
      turn,
      npcId: cmd.inspectorId,
      role: inspector.aiController?.role ?? 'INSPECTOR',
      previousGoal: 'AUDIT_SAFEHOUSE_DEED',
      newGoal: nextGoal,
      targetId: cmd.deedId,
      factionId: ministryFaction,
    },
    {
      type: 'SAFEHOUSE_AUDIT_COMPLETED',
      turn,
      auditId,
      inspectorId: cmd.inspectorId,
      deedId: cmd.deedId,
      passed,
      infractions,
      factionReputationDelta: repDelta,
    },
  ];

  const updatedInspector = {
    ...inspector,
    aiController: inspector.aiController ? {
      ...inspector.aiController,
      alertState: passed ? ('IDLE' as const) : ('INVESTIGATING' as const),
    } : undefined,
  };

  return {
    state: {
      ...state,
      entities: { ...state.entities, [cmd.inspectorId]: updatedInspector },
      audits: { ...state.audits, [auditId]: auditRecord },
      economy: {
        ...state.economy,
        factionReputation: {
          ...state.economy.factionReputation,
          [ministryFaction]: nextRep,
        },
      },
    },
    apSpent: STANDARD_ACTION_AP,
    events,
  };
}

export function processRivalArtificerReaction(
  state: WorldState,
  rivalId: EntityId,
  deedId: string,
): { state: WorldState; events: SimEvent[] } {
  const rival = state.entities[rivalId];
  if (!rival) return { state, events: [] };

  const turn = state.turnCount + 1;
  const clockworkFaction: FactionId = 'CLOCKWORK_GUILD';
  const curRep = state.economy.factionReputation[clockworkFaction] ?? 0;
  const nextRep = Math.max(-100, Math.min(100, curRep - 8));

  const events: SimEvent[] = [
    {
      type: 'NPC_GOAL_CHANGED',
      turn,
      npcId: rivalId,
      role: 'RIVAL_ARTIFICER',
      previousGoal: 'WORK',
      newGoal: 'ESPIONAGE_WORKSHOP',
      targetId: deedId,
      factionId: clockworkFaction,
    },
  ];

  return {
    state: {
      ...state,
      economy: {
        ...state.economy,
        factionReputation: {
          ...state.economy.factionReputation,
          [clockworkFaction]: nextRep,
        },
      },
    },
    events,
  };
}

export function checkAutonomousInspectors(
  state: WorldState,
): { state: WorldState; events: SimEvent[] } {
  const deeds = Object.values(state.safehouses);
  if (deeds.length === 0) return { state, events: [] };

  const targetDeed = deeds[0]!;
  const inspector = Object.values(state.entities).find((e) => (
    e.aiController?.role === 'GUARD' || e.name.toLowerCase().includes('inspector')
  ));
  if (!inspector) return { state, events: [] };

  const turn = state.turnCount + 1;
  const events: SimEvent[] = [
    {
      type: 'NPC_GOAL_CHANGED',
      turn,
      npcId: inspector.id,
      role: 'ROYAL_SOCIETY_INSPECTOR',
      previousGoal: 'PATROL',
      newGoal: 'AUDIT_SAFEHOUSE_DEED',
      targetId: targetDeed.deedId,
      factionId: 'CROWN_CONSTABULARY',
    },
  ];

  return { state, events };
}
