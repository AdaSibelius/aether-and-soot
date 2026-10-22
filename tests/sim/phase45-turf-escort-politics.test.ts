import { describe, expect, it } from 'vitest';
import { dispatchCommand } from '../../src/sim/core/engine.js';
import { createInitialWorld, deserializeWorld, serializeWorld } from '../../src/sim/core/world.js';
import { BlueprintIdSchema, EntityIdSchema, FactionId, Point3D } from '../../src/schemas/primitives.schema.js';
import { EntityRecord } from '../../src/schemas/components.schema.js';
import { registerTurfSector } from '../../src/sim/systems/skirmish-turf.system.js';
import { processRivalArtificerReaction } from '../../src/sim/systems/politics-audit.system.js';
import { parseLlmResponseToCommand } from '../scripts/playtester-serializer.js';

function createMockNpc(idStr: string, name: string, factionId: FactionId, pos: Point3D): EntityRecord {
  const id = EntityIdSchema.parse(idStr);
  return {
    id, name,
    visual: { glyph: name[0]!, fgPrimary: '#E74C3C', fgSecondary: '#C0392B', bgColor: '#0A0D0E', shaderFlags: [] },
    position: { ...pos, blocksMovement: true, blocksSight: false },
    actor: { energy: 100, speed: 100, isPlayer: false },
    aiController: { role: 'GUARD', hostile: true, alertState: 'COMBAT', factionId },
    anatomy: {
      limbs: {
        HEAD: { slot: 'HEAD', hp: 20, maxHp: 20, amputated: false },
        TORSO: { slot: 'TORSO', hp: 40, maxHp: 40, amputated: false },
        LEFT_ARM: { slot: 'LEFT_ARM', hp: 20, maxHp: 20, amputated: false },
        RIGHT_ARM: { slot: 'RIGHT_ARM', hp: 20, maxHp: 20, amputated: false },
        LEFT_LEG: { slot: 'LEFT_LEG', hp: 25, maxHp: 25, amputated: false },
        RIGHT_LEG: { slot: 'RIGHT_LEG', hp: 25, maxHp: 25, amputated: false },
      },
      steamReserveKpa: 0, maxSteamReserveKpa: 100, bloodVolumePct: 100,
      unlockedRecipeIds: [], governorCapacityKw: 100, strainLoadKw: 0,
      toxicityPct: 0, painShock: 0, stamina: 100, activeEffects: [],
    },
  };
}

describe('Phase 45: Dynamic Turf Skirmishes, Supply Escorts & Royal Society Politics', () => {
  it('P1: wires MOVE_STEP, ATTACK_ACTOR, VENT_STEAM, and USE_PORTAL into turf skirmishes and tactical maneuvers', () => {
    let state = createInitialWorld({ seed: 42 });
    const playerId = EntityIdSchema.parse('actor_player');
    const pPos = state.entities[playerId]!.position!;

    state = registerTurfSector(state, {
      turfId: 'turf_foundry_square',
      districtId: state.currentDistrictId,
      name: 'Foundry Square Commons',
      stratum: pPos.stratum,
      bounds: { xMin: pPos.x - 5, xMax: pPos.x - 1, yMin: pPos.y - 5, yMax: pPos.y + 5 },
      controllingFactionId: 'IRONMONGERS_CARTEL',
      contested: false,
      controlScores: { IRONMONGERS_CARTEL: 50 },
    });

    const enemy = createMockNpc('npc_turf_enemy', 'Syndicate Enforcer', 'UNDERCROFT_SYNDICATE', { x: pPos.x - 2, y: pPos.y, stratum: pPos.stratum });
    state = { ...state, entities: { ...state.entities, [enemy.id]: enemy } };

    // 1. Move step into turf
    const moveRes = dispatchCommand(state, { type: 'MOVE_STEP', actorId: playerId, dx: -1, dy: 0 });
    state = moveRes.state;
    expect(moveRes.events.find((e) => e.type === 'ACTOR_TURF_STATE_CHANGED')).toBeDefined();

    // 2. Attack enemy to shift turf control points
    const atk1 = dispatchCommand(state, { type: 'ATTACK_ACTOR', attackerId: playerId, targetId: enemy.id, targetSlot: 'TORSO' });
    state = atk1.state;
    expect(state.turf['turf_foundry_square']!.contested).toBe(true);

    const atk2 = dispatchCommand(state, { type: 'ATTACK_ACTOR', attackerId: playerId, targetId: enemy.id, targetSlot: 'TORSO' });
    state = atk2.state;
    expect(atk2.events.find((e) => e.type === 'TURF_CONTROL_CHANGED')).toBeDefined();
    expect(state.turf['turf_foundry_square']!.controllingFactionId).toBe('UNDERCROFT_SYNDICATE');

    // 3. Vent steam records tactical cover maneuver
    const ventRes = dispatchCommand(state, {
      type: 'VENT_STEAM', actorId: playerId, target: state.entities[playerId]!.position!,
      pressureReleasedKpa: 30, bypassReserveCheck: true,
    });
    const maneuverEv = ventRes.events.find((e) => e.type === 'TACTICAL_MANEUVER_RECORDED');
    expect(maneuverEv).toBeDefined();

    // 4. Use portal records tactical escape maneuver
    const portalRes = dispatchCommand(state, { type: 'USE_PORTAL', actorId: playerId });
    expect(portalRes.events.find((e) => e.type === 'TACTICAL_MANEUVER_RECORDED')).toBeDefined();
  });

  it('P2: handles end-to-end economic supply escort lifecycle (PREP -> ESCORT -> DELIVERY)', () => {
    let state = createInitialWorld({ seed: 101 });
    const playerId = EntityIdSchema.parse('actor_player');
    const pPos = state.entities[playerId]!.position!;
    const cargoId = EntityIdSchema.parse('item_convoy_munitions');
    const companion = createMockNpc('npc_escort_merc', 'Cartel Mercenary Guard', 'IRONMONGERS_CARTEL', { x: pPos.x + 1, y: pPos.y, stratum: pPos.stratum });

    state = {
      ...state,
      entities: {
        ...state.entities,
        [cargoId]: {
          id: cargoId, name: 'Pressurized Munitions Crate',
          visual: { glyph: '$', fgPrimary: '#F39C12', fgSecondary: '#D68910', bgColor: '#0A0D0E', shaderFlags: [] },
          item: {
            blueprintId: BlueprintIdSchema.parse('commodity_munitions'),
            category: 'MATERIAL', massGrams: 3000, volumeMl: 2500, stackable: false, quantity: 1,
          },
        },
        [companion.id]: companion,
        [playerId]: {
          ...state.entities[playerId]!,
          inventory: {
            ...state.entities[playerId]!.inventory!,
            containedEntityIds: [...state.entities[playerId]!.inventory!.containedEntityIds, cargoId],
          },
        },
      },
    };

    // 1. Prepare Convoy
    const prepRes = dispatchCommand(state, {
      type: 'PREPARE_SUPPLY_CONVOY', actorId: playerId, cargoItemId: cargoId,
      clientFactionId: 'IRONMONGERS_CARTEL', destinationDistrictId: state.currentDistrictId, rewardPence: 120,
    });
    state = prepRes.state;
    expect(prepRes.events.find((e) => e.type === 'CONVOY_PREPARATION_STARTED')).toBeDefined();

    // 2. Hire companion -> assigns escort
    const hireRes = dispatchCommand(state, { type: 'HIRE_COMPANION', actorId: playerId, npcId: companion.id });
    state = hireRes.state;
    expect(hireRes.events.find((e) => e.type === 'CONVOY_ESCORT_ASSIGNED')).toBeDefined();

    // 3. Drop cargo at destination -> confirms delivery
    const initialTreasury = state.economy.playerTreasuryPence;
    const dropRes = dispatchCommand(state, { type: 'DROP_ITEM', actorId: playerId, itemEntityId: cargoId });
    state = dropRes.state;
    const deliveryEv = dropRes.events.find((e) => e.type === 'CONVOY_DELIVERY_CONFIRMED');
    expect(deliveryEv).toBeDefined();
    if (deliveryEv && deliveryEv.type === 'CONVOY_DELIVERY_CONFIRMED') {
      expect(deliveryEv.success).toBe(true);
      expect(deliveryEv.escortSurvival).toBe(true);
      expect(state.economy.playerTreasuryPence).toBe(initialTreasury + 120);
    }
  });

  it('P3: executes Royal Society deed auditing and rival artificer reactions with NPC_GOAL_CHANGED telemetry', () => {
    let state = createInitialWorld({ seed: 777 });
    const playerId = EntityIdSchema.parse('actor_player');
    const pPos = state.entities[playerId]!.position!;
    const inspector = createMockNpc('npc_society_inspector', 'Guild Inspector Hemlock', 'CROWN_CONSTABULARY', { x: pPos.x + 1, y: pPos.y + 1, stratum: pPos.stratum });
    const rival = createMockNpc('npc_rival_artificer', 'Artificer Silas Vane', 'CLOCKWORK_GUILD', { x: pPos.x + 3, y: pPos.y + 3, stratum: pPos.stratum });

    state = { ...state, entities: { ...state.entities, [inspector.id]: inspector, [rival.id]: rival } };

    // 1. Claim deed
    const claimRes = dispatchCommand(state, { type: 'CLAIM_WORKSHOP_DEED', actorId: playerId });
    state = claimRes.state;
    const deedId = Object.keys(state.safehouses)[0]!;

    // 2. Initial compliant audit passes
    const audit1 = dispatchCommand(state, { type: 'AUDIT_SAFEHOUSE_DEED', actorId: playerId, inspectorId: inspector.id, deedId });
    state = audit1.state;
    const auditEv1 = audit1.events.find((e) => e.type === 'SAFEHOUSE_AUDIT_COMPLETED');
    expect(auditEv1).toBeDefined();
    if (auditEv1 && auditEv1.type === 'SAFEHOUSE_AUDIT_COMPLETED') {
      expect(auditEv1.passed).toBe(true);
      expect(auditEv1.factionReputationDelta).toBeGreaterThan(0);
    }

    // 3. Build hazardous structure -> citation issued
    const buildRes = dispatchCommand(state, {
      type: 'BUILD_STRUCTURE', actorId: playerId, structureType: 'STEAM_CHARGER',
      target: { x: pPos.x, y: pPos.y + 1, stratum: pPos.stratum },
    });
    state = buildRes.state;

    const audit2 = dispatchCommand(state, { type: 'AUDIT_SAFEHOUSE_DEED', actorId: playerId, inspectorId: inspector.id, deedId });
    state = audit2.state;
    const auditEv2 = audit2.events.find((e) => e.type === 'SAFEHOUSE_AUDIT_COMPLETED');
    expect(auditEv2).toBeDefined();
    if (auditEv2 && auditEv2.type === 'SAFEHOUSE_AUDIT_COMPLETED') {
      expect(auditEv2.passed).toBe(false);
      expect(auditEv2.infractions).toContain('UNREGISTERED_HIGH_PRESSURE_VESSEL');
    }

    // 4. Rival reaction
    const rivalRes = processRivalArtificerReaction(state, rival.id, deedId);
    state = rivalRes.state;
    const rivalGoalEv = rivalRes.events.find((e) => e.type === 'NPC_GOAL_CHANGED');
    expect(rivalGoalEv).toBeDefined();
    if (rivalGoalEv && rivalGoalEv.type === 'NPC_GOAL_CHANGED') {
      expect(rivalGoalEv.newGoal).toBe('ESPIONAGE_WORKSHOP');
    }
  });

  it('verifies complete serialization and LLM action parsing for Phase 45 systems', () => {
    let state = createInitialWorld({ seed: 555 });
    const playerId = EntityIdSchema.parse('actor_player');
    const pPos = state.entities[playerId]!.position!;

    state = registerTurfSector(state, {
      turfId: 'turf_docklands', districtId: state.currentDistrictId, name: 'Limehouse Cargo Docks',
      stratum: pPos.stratum, bounds: { xMin: 0, xMax: 10, yMin: 0, yMax: 10 },
      controllingFactionId: 'UNDERCROFT_SYNDICATE', contested: true, controlScores: { UNDERCROFT_SYNDICATE: 80 },
    });

    const serialized = serializeWorld(state);
    const restored = deserializeWorld(serialized);
    expect(restored.turf['turf_docklands']).toBeDefined();
    expect(restored.turf['turf_docklands']!.contested).toBe(true);

    const cmd1 = parseLlmResponseToCommand('{"action": "INITIATE_TURF_SKIRMISH", "turfId": "turf_docklands"}', state, playerId);
    expect(cmd1.type).toBe('INITIATE_TURF_SKIRMISH');

    const cmd2 = parseLlmResponseToCommand('{"action": "PREPARE_SUPPLY_CONVOY", "cargoItemId": "item_cargo_1", "clientFactionId": "IRONMONGERS_CARTEL", "destinationDistrictId": "district_spitalfields_soot_works"}', state, playerId);
    expect(cmd2.type).toBe('PREPARE_SUPPLY_CONVOY');

    const cmd3 = parseLlmResponseToCommand('{"action": "AUDIT_SAFEHOUSE_DEED", "inspectorId": "npc_insp", "deedId": "deed_street_1"}', state, playerId);
    expect(cmd3.type).toBe('AUDIT_SAFEHOUSE_DEED');
  });
});
