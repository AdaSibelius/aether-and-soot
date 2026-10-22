import { SimEvent } from '../../schemas/events.schema.js';
import { EntityId } from '../../schemas/primitives.schema.js';
import { ConsultCodexCommand } from '../../schemas/safehouse-commands.schema.js';
import { CodexCategory, NpcCodexReactionEvent } from '../../schemas/safehouse-events.schema.js';
import { CodexEntryRecord } from '../../schemas/safehouse-records.schema.js';
import { STANDARD_ACTION_AP } from '../core/scheduler.js';
import { WorldState } from '../core/world.js';

export function discoverCodexEntry(
  state: WorldState,
  actorId: EntityId,
  entry: {
    id: string;
    category: CodexCategory;
    title: string;
    description: string;
    tags?: string[];
  },
): { state: WorldState; discovered: boolean; event?: SimEvent } {
  if (state.codex[entry.id]) {
    return { state, discovered: false };
  }

  const turn = state.turnCount + 1;
  const record: CodexEntryRecord = {
    id: entry.id,
    category: entry.category,
    title: entry.title,
    description: entry.description,
    discoveredTurn: turn,
    tags: entry.tags ?? [],
  };

  const updatedCodex = { ...state.codex, [entry.id]: record };
  const event: SimEvent = {
    type: 'CODEX_ENTRY_DISCOVERED',
    turn,
    actorId,
    entryId: entry.id,
    category: entry.category,
    title: entry.title,
    description: entry.description,
  };

  return {
    state: { ...state, codex: updatedCodex },
    discovered: true,
    event,
  };
}

export function resolveConsultCodex(
  state: WorldState,
  cmd: ConsultCodexCommand,
): { state: WorldState; apSpent: number; events: SimEvent[] } {
  const actor = state.entities[cmd.actorId];
  const turn = state.turnCount + 1;
  const events: SimEvent[] = [];

  const totalEntries = Object.keys(state.codex).length;
  events.push({
    type: 'CODEX_CONSULTED',
    turn,
    actorId: cmd.actorId,
    entryId: cmd.entryId,
    totalDiscovered: totalEntries,
  });

  if (actor?.position) {
    const { x, y, stratum } = actor.position;
    for (const entity of Object.values(state.entities)) {
      if (entity.id === cmd.actorId || !entity.actor || !entity.position) continue;
      if (entity.position.stratum !== stratum) continue;
      const dist = Math.max(Math.abs(entity.position.x - x), Math.abs(entity.position.y - y));
      if (dist > 3) continue;

      const ai = entity.aiController;
      if (!ai) continue;

      const reactions: NpcCodexReactionEvent[] = [];

      for (const entry of Object.values(state.codex)) {
        if (entry.category === 'AUTOMATON' && (ai.role === 'CHIRURGEON' || ai.role === 'CITIZEN')) {
          reactions.push({
            type: 'NPC_CODEX_REACTION',
            turn,
            npcId: entity.id,
            actorId: cmd.actorId,
            reactionType: 'CURIOSITY',
            entryId: entry.id,
            dialogueText: `${entity.name} leans in with wide eyes: "By the Royal Society... where did you dissect this ${entry.title} automaton?"`,
          });
          break;
        } else if (entry.category === 'AUTOMATON' && (ai.hostile || ai.role === 'GUARD') && entry.tags.includes('FORBIDDEN')) {
          reactions.push({
            type: 'NPC_CODEX_REACTION',
            turn,
            npcId: entity.id,
            actorId: cmd.actorId,
            reactionType: 'HOSTILITY',
            entryId: entry.id,
            dialogueText: `${entity.name} draws their cudgel: "Unregistered cogwork diagrams! You harbor outlaw clockwork!"`,
          });
          break;
        } else if (entry.category === 'SCHEMATIC' && ai.role === 'MERCHANT') {
          reactions.push({
            type: 'NPC_CODEX_REACTION',
            turn,
            npcId: entity.id,
            actorId: cmd.actorId,
            reactionType: 'TRADE',
            entryId: entry.id,
            dialogueText: `${entity.name} taps the parchment: "A schematic for ${entry.title}! I will offer a handsome barter for a copy of these prints."`,
          });
          break;
        } else if (entry.category === 'REACTION' && ai.role === 'FIXER') {
          reactions.push({
            type: 'NPC_CODEX_REACTION',
            turn,
            npcId: entity.id,
            actorId: cmd.actorId,
            reactionType: 'TRADE',
            entryId: entry.id,
            dialogueText: `${entity.name} whispers: "That alchemical mixture, ${entry.title}... the Black Smoke syndicate pays double for recipes like that."`,
          });
          break;
        }
      }

      events.push(...reactions);
    }
  }

  return {
    state,
    apSpent: STANDARD_ACTION_AP,
    events,
  };
}
