import { describe, expect, it } from 'vitest';
import { EntityRecord } from '../../src/schemas/components.schema.js';
import { FactionContract } from '../../src/schemas/contracts.schema.js';
import { EntityId, EntityIdSchema } from '../../src/schemas/primitives.schema.js';
import { dispatchCommand } from '../../src/sim/core/engine.js';
import { SeededRNG } from '../../src/sim/core/rng.js';
import { createInitialWorld } from '../../src/sim/core/world.js';
import { createEntityFromBlueprint } from '../../src/sim/data/item-catalog.js';
import { advanceNpcTurns, createDefaultNpcAnatomy } from '../../src/sim/systems/ai.system.js';

describe('Phase 20: Interactive NPC Dialogue, Procedural Faction Contracts, Chirurgeon Services & Companions', () => {
  const playerId = EntityIdSchema.parse('actor_player');
  const npcId = EntityIdSchema.parse('actor_npc_fixer');
  const chirurgeonId = EntityIdSchema.parse('actor_npc_chirurgeon');

  const makeNpcRecord = (
    id: EntityId,
    name: string,
    role: 'CITIZEN' | 'CHIRURGEON' | 'FIXER' | 'GUARD',
    hostile: boolean,
    x: number,
    y: number,
  ): EntityRecord => ({
    id,
    name,
    visual: { glyph: '@', fgPrimary: '#ffffff', fgSecondary: '#000000', bgColor: 'transparent', shaderFlags: ['NONE'] },
    actor: { isPlayer: false, energy: 100, speed: 100 },
    aiController: { factionId: 'CROWN_CONSTABULARY', role, hostile },
    position: { stratum: 'STREET', x, y, blocksMovement: true, blocksSight: false },
    anatomy: createDefaultNpcAnatomy(30, 20),
    inventory: { containedEntityIds: [], maxMassGrams: 50000, maxVolumeMl: 30000, currentMassGrams: 0 },
  });

  const setupWorldWithNpc = () => {
    let state = createInitialWorld({ seed: 42 });
    const pPos = state.entities[playerId]!.position!;

    const fixer = makeNpcRecord(npcId, 'Fixer Jasper', 'FIXER', false, pPos.x + 1, pPos.y);
    const chirurgeon = makeNpcRecord(chirurgeonId, 'Chirurgeon Vane', 'CHIRURGEON', false, pPos.x, pPos.y + 1);

    state = {
      ...state,
      entities: {
        ...state.entities,
        [npcId]: fixer,
        [chirurgeonId]: chirurgeon,
      },
      economy: {
        ...state.economy,
        playerTreasuryPence: 100,
        factionReputation: { ...state.economy.factionReputation, CROWN_CONSTABULARY: 0 },
      },
    };
    return state;
  };

  it('accepts and completes an item delivery contract, awarding pence and reputation', () => {
    let state = setupWorldWithNpc();
    const contract: FactionContract = {
      id: 'contract_deliver_1',
      issuerNpcId: npcId,
      factionId: 'CROWN_CONSTABULARY',
      title: 'Brass Gear Requisition',
      description: 'Deliver brass gears.',
      kind: 'DELIVER_ITEM',
      targetBlueprintOrEntityId: 'mat_brass_gears',
      rewardPence: 50,
      rewardReputation: 15,
      status: 'AVAILABLE',
    };
    state = { ...state, contracts: [contract] };

    // Accept contract
    const acceptRes = dispatchCommand(state, { type: 'ACCEPT_CONTRACT', actorId: playerId, contractId: 'contract_deliver_1' });
    expect(acceptRes.state.contracts[0]?.status).toBe('ACTIVE');
    expect(acceptRes.events.some((e) => e.type === 'CONTRACT_ACCEPTED')).toBe(true);
    state = acceptRes.state;

    // Try completing without item -> fails
    const failRes = dispatchCommand(state, { type: 'COMPLETE_CONTRACT', actorId: playerId, contractId: 'contract_deliver_1' });
    expect(failRes.state.contracts[0]?.status).toBe('ACTIVE');
    expect(failRes.events.some((e) => e.type === 'DIALOGUE_ACTION_FAILED')).toBe(true);

    // Give player the required brass gears
    const item = createEntityFromBlueprint('mat_brass_gears', EntityIdSchema.parse('item_gears_1'), 1)!;
    expect(item).toBeDefined();
    const player = state.entities[playerId]!;
    state = {
      ...state,
      entities: { ...state.entities, [item.id]: item },
    };
    state.entities[playerId] = {
      ...player,
      inventory: {
        containedEntityIds: [...(player.inventory?.containedEntityIds ?? []), item.id],
        maxMassGrams: player.inventory?.maxMassGrams ?? 50000,
        maxVolumeMl: player.inventory?.maxVolumeMl ?? 30000,
        currentMassGrams: player.inventory?.currentMassGrams ?? 0,
      },
    };

    // Complete contract
    const completeRes = dispatchCommand(state, { type: 'COMPLETE_CONTRACT', actorId: playerId, contractId: 'contract_deliver_1' });
    expect(completeRes.state.contracts[0]?.status).toBe('COMPLETED');
    expect(completeRes.state.economy.playerTreasuryPence).toBe(150);
    expect(completeRes.state.economy.factionReputation['CROWN_CONSTABULARY']).toBe(15);
    expect(completeRes.state.entities[playerId]?.inventory?.containedEntityIds.includes(item.id)).toBe(false);
    expect(completeRes.events.some((e) => e.type === 'CONTRACT_COMPLETED')).toBe(true);
  });

  it('completes a slay hostile contract when target entity is neutralized', () => {
    let state = setupWorldWithNpc();
    const targetHostileId = EntityIdSchema.parse('actor_thug_target');
    const pPos = state.entities[playerId]!.position!;
    const hostileThug = makeNpcRecord(targetHostileId, 'Anarchist Thug', 'GUARD', true, pPos.x + 3, pPos.y + 3);

    state = {
      ...state,
      entities: {
        ...state.entities,
        [targetHostileId]: hostileThug,
      },
      contracts: [
        {
          id: 'contract_slay_1',
          issuerNpcId: npcId,
          factionId: 'CROWN_CONSTABULARY',
          title: 'Eliminate Thug',
          description: 'Neutralize the anarchist thug.',
          kind: 'SLAY_HOSTILE',
          targetBlueprintOrEntityId: targetHostileId,
          rewardPence: 40,
          rewardReputation: 10,
          status: 'ACTIVE',
        },
      ],
    };

    // Target is still alive -> fail
    const failRes = dispatchCommand(state, { type: 'COMPLETE_CONTRACT', actorId: playerId, contractId: 'contract_slay_1' });
    expect(failRes.events.some((e) => e.type === 'DIALOGUE_ACTION_FAILED')).toBe(true);

    // Eliminate target
    const nextEntities = { ...state.entities };
    delete nextEntities[targetHostileId];
    state = { ...state, entities: nextEntities };

    // Complete contract
    const successRes = dispatchCommand(state, { type: 'COMPLETE_CONTRACT', actorId: playerId, contractId: 'contract_slay_1' });
    expect(successRes.state.contracts[0]?.status).toBe('COMPLETED');
    expect(successRes.state.economy.playerTreasuryPence).toBe(140);
  });

  it('pays chirurgeon to fully restore damaged limbs and replenish blood volume', () => {
    let state = setupWorldWithNpc();
    const playerAnatomy = state.entities[playerId]!.anatomy!;
    const headLimb = playerAnatomy.limbs.HEAD;
    expect(headLimb).toBeDefined();

    // Damage head limb and reduce blood volume, set treasury to 50
    state = {
      ...state,
      economy: { ...state.economy, playerTreasuryPence: 50 },
      entities: {
        ...state.entities,
        [playerId]: {
          ...state.entities[playerId]!,
          anatomy: {
            ...playerAnatomy,
            bloodVolumePct: 65,
            limbs: {
              ...playerAnatomy.limbs,
              HEAD: { ...headLimb!, hp: 5 },
            },
          },
        },
      },
    };

    const healRes = dispatchCommand(state, { type: 'PAY_CHIRURGEON_HEAL', actorId: playerId, chirurgeonId });
    expect(healRes.state.economy.playerTreasuryPence).toBe(15);
    const healedAnatomy = healRes.state.entities[playerId]!.anatomy!;
    expect(healedAnatomy.bloodVolumePct).toBe(100);
    expect(healedAnatomy.limbs.HEAD?.hp).toBe(healedAnatomy.limbs.HEAD?.maxHp);
    expect(healRes.events.some((e) => e.type === 'CHIRURGEON_HEAL_COMPLETED')).toBe(true);

    // Trying again with insufficient pence (15 < 35) fails
    const failRes = dispatchCommand(healRes.state, { type: 'PAY_CHIRURGEON_HEAL', actorId: playerId, chirurgeonId });
    expect(failRes.state.economy.playerTreasuryPence).toBe(15);
    expect(failRes.events.some((e) => e.type === 'DIALOGUE_ACTION_FAILED')).toBe(true);
  });

  it('hires companion and companion AI defends player and follows', () => {
    let state = setupWorldWithNpc();
    state = { ...state, economy: { ...state.economy, playerTreasuryPence: 70 } };

    // Hire companion
    const hireRes = dispatchCommand(state, { type: 'HIRE_COMPANION', actorId: playerId, npcId });
    expect(hireRes.state.economy.playerTreasuryPence).toBe(10);
    const hiredNpc = hireRes.state.entities[npcId]!;
    expect(hiredNpc.aiController?.companionOfActorId).toBe(playerId);
    expect(hireRes.events.some((e) => e.type === 'COMPANION_RECRUITED')).toBe(true);

    // Spawn a hostile enemy adjacent to companion
    const hostileId = EntityIdSchema.parse('actor_hostile_enemy');
    const compPos = hiredNpc.position!;
    const hostileThug = makeNpcRecord(hostileId, 'Hostile Enemy', 'GUARD', true, compPos.x + 1, compPos.y);

    const simState = {
      ...hireRes.state,
      entities: {
        ...hireRes.state.entities,
        [hostileId]: hostileThug,
      },
    };

    // Advance NPC turns: companion should attack the adjacent hostile enemy
    const rng = new SeededRNG(42);
    const advanced = advanceNpcTurns(simState, rng);
    expect(advanced.events.some((e) => e.type === 'COMBAT_ATTACK_RESOLVED' && e.attackerId === npcId && e.targetId === hostileId)).toBe(true);
  });
});
