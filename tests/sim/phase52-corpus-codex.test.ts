import { describe, expect, it } from 'vitest';
import { EntityRecord } from '../../src/schemas/components.schema.js';
import { BlueprintIdSchema, EntityIdSchema } from '../../src/schemas/primitives.schema.js';
import { dispatchCommand } from '../../src/sim/core/engine.js';
import { SeededRNG } from '../../src/sim/core/rng.js';
import { createInitialWorld, WorldState } from '../../src/sim/core/world.js';
import { interpolateLoreTokens, selectDynamicBark } from '../../src/sim/data/corpora-catalog.js';
import { inspectLandmarkCodex } from '../../src/sim/spatial/generator.js';
import { setTileCell } from '../../src/sim/spatial/grid.js';
import { createDefaultNpcAnatomy } from '../../src/sim/systems/ai.system.js';
import { advanceThermodynamicsTick } from '../../src/sim/systems/thermo.system.js';

const V_STD = { glyph: '@', fgPrimary: '#D4AF37', fgSecondary: '#8B4513', bgColor: '#0A0D0E', shaderFlags: [] };

describe('Phase 52: Corpus Lore Injection & Naturalist Codex Engine', () => {
  const playerId = EntityIdSchema.parse('actor_player');
  const guardId = EntityIdSchema.parse('npc_guard_52');
  const automatonCorpseId = EntityIdSchema.parse('corpse_clockwork_warden_52');
  const scalpelId = EntityIdSchema.parse('tool_scalpel_52');

  function createBaseTestWorld(): WorldState {
    const world = createInitialWorld({ seed: 5252, width: 24, height: 24 });
    const guard: EntityRecord = {
      id: guardId,
      name: 'Constable Higgins',
      visual: V_STD,
      position: { x: 10, y: 5, stratum: 'STREET', blocksMovement: true, blocksSight: false },
      actor: { isPlayer: false, energy: 100, speed: 100 },
      anatomy: createDefaultNpcAnatomy(40, 20),
      aiController: { factionId: 'CROWN_CONSTABULARY', role: 'GUARD', hostile: false, alertState: 'IDLE' },
    };

    const scalpel: EntityRecord = {
      id: scalpelId,
      name: 'Fine Surgical Scalpel',
      visual: V_STD,
      item: { blueprintId: BlueprintIdSchema.parse('item_surgical_kit'), massGrams: 200, volumeMl: 100, stackable: false, quantity: 1, category: 'EQUIPMENT' },
    };

    const automatonCorpse: EntityRecord = {
      id: automatonCorpseId,
      name: 'Defeated Clockwork Warden Corpse',
      visual: V_STD,
      position: { x: 5, y: 5, stratum: 'STREET', blocksMovement: false, blocksSight: false },
      anatomy: { ...createDefaultNpcAnatomy(0, 0), bloodVolumePct: 0 },
    };

    const player = world.entities[playerId]!;
    return {
      ...world,
      entities: {
        ...world.entities,
        [guardId]: guard,
        [scalpelId]: scalpel,
        [automatonCorpseId]: automatonCorpse,
        [playerId]: {
          ...player,
          position: { x: 4, y: 5, stratum: 'STREET', blocksMovement: true, blocksSight: false },
          inventory: {
            containedEntityIds: [...(player.inventory?.containedEntityIds ?? []), scalpelId],
            equippedSlots: {},
            maxMassGrams: 30000,
            maxVolumeMl: 30000,
            currentMassGrams: (player.inventory?.currentMassGrams ?? 0) + 200,
          },
        },
      },
    };
  }

  it('1. interpolates lore tokens with district, shift, and faction vernacular', () => {
    const template = "Watch yer boots in {DISTRICT}, mate! The {FACTION} are on the prowl during {SHIFT} shift.";
    const result = interpolateLoreTokens(template, {
      districtId: 'district_spitalfields_soot_works',
      factionId: 'CROWN_CONSTABULARY',
      diurnalShift: 'NIGHT',
    });
    expect(result).toBe("Watch yer boots in Spitalfields Soot Works, mate! The Crown Constabulary are on the prowl during NIGHT shift.");
  });

  it('2. selects dynamic vernacular bark deterministically from corpora catalog', () => {
    const rng1 = new SeededRNG(12345);
    const rng2 = new SeededRNG(12345);

    const bark1 = selectDynamicBark('corpus_cockney_slang', 'TARGET_SIGHTED', rng1);
    const bark2 = selectDynamicBark('corpus_cockney_slang', 'TARGET_SIGHTED', rng2);

    expect(bark1).toBeDefined();
    expect(bark1?.templateText).toBe(bark2?.templateText);
    expect(bark1?.templateText.length).toBeGreaterThanOrEqual(10);
  });

  it('3. resolves EMIT_PROCEDURAL_BARK command and emits acoustic noise event', () => {
    const world = createBaseTestWorld();

    const res = dispatchCommand(world, {
      type: 'EMIT_PROCEDURAL_BARK',
      actorId: guardId,
      trigger: 'TARGET_SIGHTED',
      targetId: playerId,
    });

    expect(res.resolution.status).toBe('applied');
    const barkEvent = res.events.find((e) => e.type === 'PROCEDURAL_BARK_EMITTED');
    expect(barkEvent).toBeDefined();
    if (barkEvent && barkEvent.type === 'PROCEDURAL_BARK_EMITTED') {
      expect(barkEvent.actorId).toBe(guardId);
      expect(barkEvent.interpolatedText.length).toBeGreaterThan(0);
      expect(barkEvent.acousticNoiseDb).toBeGreaterThan(0);
      expect(barkEvent.position).toMatchObject({ x: 10, y: 5, stratum: 'STREET' });
    }
  });

  it('4. performs DISSECT_CORPSE_ANATOMY on automaton, discovering AUTOMATON codex and alerting witnesses', () => {
    const world = createBaseTestWorld();

    const res = dispatchCommand(world, {
      type: 'DISSECT_CORPSE_ANATOMY',
      actorId: playerId,
      corpseEntityId: automatonCorpseId,
      toolEntityId: scalpelId,
      targetSlot: 'TORSO',
    });

    expect(res.resolution.status).toBe('applied');
    expect(res.state.codex['codex_automaton_defeated_clockwork_warden_corpse_torso']).toBeDefined();

    const codexEvt = res.events.find((e) => e.type === 'CODEX_ENTRY_DISCOVERED');
    expect(codexEvt).toBeDefined();
    if (codexEvt && codexEvt.type === 'CODEX_ENTRY_DISCOVERED') {
      expect(codexEvt.category).toBe('AUTOMATON');
      expect(codexEvt.title).toContain('Clockwork Warden');
    }

    const desecrationEvt = res.events.find((e) => e.type === 'CORPSE_DESECRATION_WITNESSED');
    expect(desecrationEvt).toBeDefined();
    if (desecrationEvt && desecrationEvt.type === 'CORPSE_DESECRATION_WITNESSED') {
      expect(desecrationEvt.witnessId).toBe(guardId);
      expect(desecrationEvt.perpetratorId).toBe(playerId);
      expect(desecrationEvt.victimFactionId).toBe('CROWN_CONSTABULARY');
    }
  });

  it('5. discovers THERMODYNAMICS codex entry upon surviving >= 50 kPa superheated steam scald', () => {
    let world = createBaseTestWorld();
    const street = setTileCell(world.strata.STREET!, 4, 5, (c) => ({ ...c, steamPressureKpa: 120 }));
    world = { ...world, strata: { ...world.strata, STREET: street } };

    const thermoRes = advanceThermodynamicsTick(world);
    expect(thermoRes.state.codex['codex_thermo_superheated_scald']).toBeDefined();

    const codexEvt = thermoRes.events.find((e) => e.type === 'CODEX_ENTRY_DISCOVERED');
    expect(codexEvt).toBeDefined();
    if (codexEvt && codexEvt.type === 'CODEX_ENTRY_DISCOVERED') {
      expect(codexEvt.category).toBe('THERMODYNAMICS');
      expect(codexEvt.title).toBe('Superheated Steam Dynamics');
    }
  });

  it('6. discovers INFRASTRUCTURE codex entry via inspectLandmarkCodex', () => {
    const world = createBaseTestWorld();
    const res = inspectLandmarkCodex(world, playerId, 'hydraulic_canal_lock');

    expect(res.discovered).toBe(true);
    expect(res.state.codex['codex_landmark_hydraulic_canal_lock']).toBeDefined();
    expect(res.event).toBeDefined();
    if (res.event && res.event.type === 'CODEX_ENTRY_DISCOVERED') {
      expect(res.event.category).toBe('INFRASTRUCTURE');
      expect(res.event.title).toBe('Hydraulic Canal Lock');
    }
  });

  it('7. resolves ENFORCE_TURF_AUTHORITY command and deducts tariff pence', () => {
    let world = createBaseTestWorld();
    world = { ...world, economy: { ...world.economy, playerTreasuryPence: 100 } };

    const res = dispatchCommand(world, {
      type: 'ENFORCE_TURF_AUTHORITY',
      guardId,
      intruderId: playerId,
      turfId: 'turf_soot_central',
      action: 'DEMAND_TARIFF',
    });

    expect(res.resolution.status).toBe('applied');
    expect(res.state.economy.playerTreasuryPence).toBe(75);

    const tariffEvt = res.events.find((e) => e.type === 'TURF_TARIFF_ENFORCED');
    expect(tariffEvt).toBeDefined();
    if (tariffEvt && tariffEvt.type === 'TURF_TARIFF_ENFORCED') {
      expect(tariffEvt.tariffPenceCharged).toBe(25);
      expect(tariffEvt.refused).toBe(false);
    }
  });
});
