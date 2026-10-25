import fs from 'node:fs';
import path from 'node:path';
import {
  BarkCorpusBlueprint,
  BarkCorpusBlueprintSchema,
  BarkEntry,
  BarkTriggerContext,
} from '../../schemas/blueprint.schema.js';
import { SimEvent } from '../../schemas/events.schema.js';
import { EntityId, FactionId, StratumId } from '../../schemas/primitives.schema.js';
import { SeededRNG } from '../core/rng.js';
import { WorldState } from '../core/world.js';
import { emitAcousticPulse } from '../systems/stealth-acoustics.system.js';

export interface BarkContext {
  readonly trigger: BarkTriggerContext;
  readonly factionId?: FactionId | undefined;
  readonly stratum?: StratumId | undefined;
  readonly districtId?: string | undefined;
  readonly shiftName?: string | undefined;
  readonly steamPressureKpa?: number | undefined;
  readonly reputation?: number | undefined;
}

let cachedCorpora: BarkCorpusBlueprint[] | undefined;

export function loadBarkCorpora(): readonly BarkCorpusBlueprint[] {
  if (cachedCorpora) return cachedCorpora;
  try {
    const filePath = path.resolve(process.cwd(), 'data/corpora/barks.json');
    if (fs.existsSync(filePath)) {
      const raw = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
      cachedCorpora = (Array.isArray(raw) ? raw : []).map((c) => BarkCorpusBlueprintSchema.parse(c));
      return cachedCorpora;
    }
  } catch {
    // Headless fallback
  }
  return [];
}

const FACTION_NAMES: Record<string, string> = {
  CROWN_CONSTABULARY: 'Crown Constabulary',
  DOCKWORKERS_UNION: 'Dockworkers Union',
  LUDDITE_RESISTANCE: 'Luddite Resistance',
  UNDERCROFT_SYNDICATE: 'Undercroft Syndicate',
  AETHER_GUILD: 'Aether Guild',
};

export function interpolateLoreTokens(
  template: string,
  tokens: Record<string, string | number | undefined>,
): string {
  return template.replace(/\{([A-Z_]+)\}/g, (match, key: string) => {
    if (tokens[key] !== undefined && tokens[key] !== null) {
      return String(tokens[key]);
    }
    if (key === 'DISTRICT' && tokens.districtId) {
      const raw = String(tokens.districtId).replace(/^district_/, '').replace(/_/g, ' ');
      return raw.replace(/\b\w/g, (c) => c.toUpperCase());
    }
    if (key === 'FACTION' && tokens.factionId) {
      return FACTION_NAMES[String(tokens.factionId)] ?? String(tokens.factionId).replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
    }
    if (key === 'SHIFT') {
      const shift = tokens.diurnalShift ?? tokens.shiftName;
      if (shift) return String(shift);
    }
    if (key === 'PRESSURE') {
      const p = tokens.steamPressureKpa ?? tokens.pressure;
      if (p !== undefined) return `${p} kPa`;
    }
    return match;
  });
}

export function selectDynamicBark(
  corpusOrId: BarkCorpusBlueprint | string,
  contextOrTrigger: BarkContext | BarkTriggerContext,
  rng: SeededRNG,
): BarkEntry | undefined {
  const corpus = typeof corpusOrId === 'string'
    ? loadBarkCorpora().find((c) => c.id === corpusOrId)
    : corpusOrId;
  if (!corpus) return undefined;

  const context: BarkContext = typeof contextOrTrigger === 'string'
    ? { trigger: contextOrTrigger }
    : contextOrTrigger;

  const matches = corpus.entries.filter((entry) => {
    if (entry.trigger !== context.trigger) return false;
    if (entry.factionId && context.factionId && entry.factionId !== context.factionId) return false;
    if (entry.stratumRestriction && context.stratum && entry.stratumRestriction !== context.stratum) return false;
    if (entry.minimumReputation !== undefined && (context.reputation ?? 0) < entry.minimumReputation) return false;
    return true;
  });

  const candidates = matches.length > 0
    ? matches
    : corpus.entries.filter((e) => e.trigger === context.trigger);

  if (candidates.length === 0) return undefined;
  const idx = Math.floor(rng.nextFloat() * candidates.length);
  return candidates[idx] ?? candidates[0];
}

export function emitProceduralBark(
  state: WorldState,
  actorId: EntityId,
  trigger: BarkTriggerContext,
  rng: SeededRNG,
  _targetId?: EntityId,
): { state: WorldState; events: SimEvent[]; apSpent: number } {
  const actor = state.entities[actorId];
  if (!actor || !actor.position) {
    return { state, events: [], apSpent: 0 };
  }

  const corpora = loadBarkCorpora();
  const factionId = actor.aiController?.factionId;
  const dialect = actor.actor?.isPlayer
    ? 'COCKNEY_SLANG'
    : factionId === 'CROWN_CONSTABULARY'
      ? 'CONSTABULARY_FORMAL'
      : factionId === 'UNDERCROFT_SYNDICATE'
        ? 'SYNDICATE_THIEVES_CANT'
        : factionId === 'CLOCKWORK_GUILD'
          ? 'ROYAL_SOCIETY_ACADEMIC'
          : 'COCKNEY_SLANG';

  const corpus = corpora.find((c) => c.dialect === dialect) ?? corpora[0];
  const grid = state.strata[actor.position.stratum];
  const cell = grid ? grid.cells[actor.position.y * grid.width + actor.position.x] : undefined;

  const context: BarkContext = {
    trigger,
    factionId,
    stratum: actor.position.stratum,
    districtId: state.currentDistrictId,
    shiftName: state.turnCount % 100 < 50 ? 'DAWN' : 'DUSK',
    steamPressureKpa: cell?.steamPressureKpa ?? actor.anatomy?.steamReserveKpa ?? 0,
    reputation: factionId ? (state.economy.factionReputation[factionId] ?? 0) : 0,
  };

  const bark = corpus ? selectDynamicBark(corpus, context, rng) : undefined;
  const rawText = bark?.templateText ?? `${actor.name} gestures emphatically.`;
  const interpolatedText = interpolateLoreTokens(rawText, {
    DISTRICT: state.currentDistrictId.replace(/^district_/, '').replace(/_/g, ' ').toUpperCase(),
    SHIFT: context.shiftName,
    FACTION: factionId?.replace(/_/g, ' ') ?? 'MUNICIPALITY',
    PRESSURE: Math.round(context.steamPressureKpa ?? 0),
    ACTOR: actor.name,
  });

  const noiseDb = 35;
  const turn = state.turnCount + 1;
  const barkEvent: SimEvent = {
    type: 'PROCEDURAL_BARK_EMITTED',
    turn,
    actorId,
    actorName: actor.name,
    trigger,
    interpolatedText,
    acousticNoiseDb: noiseDb,
    position: { ...actor.position },
  };

  const acousticRes = emitAcousticPulse(state, actor.position, noiseDb, turn, actorId);
  return {
    state: acousticRes.state,
    events: [barkEvent, ...acousticRes.events],
    apSpent: 25,
  };
}
