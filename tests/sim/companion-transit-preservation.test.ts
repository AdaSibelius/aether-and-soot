import { describe, expect, it } from 'vitest';
import { EntityRecord } from '../../src/schemas/components.schema.js';
import { BlueprintIdSchema, EntityIdSchema } from '../../src/schemas/primitives.schema.js';
import { createEntityFromBlueprint } from '../../src/sim/data/item-catalog.js';
import { createDefaultNpcAnatomy } from '../../src/sim/systems/ai.system.js';
import { createInitialWorld, WorldState } from '../../src/sim/core/world.js';
import { createStratumGrid } from '../../src/sim/spatial/grid.js';
import { resolveTravelDistrict } from '../../src/sim/systems/transit.system.js';

function createTransitTestWorld(): WorldState {
  const world = createInitialWorld({ seed: 42 });
  const streetGrid = createStratumGrid('STREET', 20, 20);
  const undercroftGrid = createStratumGrid('UNDERCROFT', 20, 20);
  const spireGrid = createStratumGrid('SPIRE', 20, 20);
  const playerId = EntityIdSchema.parse('actor_player');
  const player = world.entities[playerId];

  return {
    ...world,
    currentDistrictId: BlueprintIdSchema.parse('district_spitalfields_soot_works'),
    strata: {
      STREET: streetGrid,
      UNDERCROFT: undercroftGrid,
      SPIRE: spireGrid,
    },
    entities: {
      ...world.entities,
      [playerId]: {
        ...player!,
        position: { x: 5, y: 5, stratum: 'STREET', blocksMovement: true, blocksSight: false },
      },
    },
  };
}

describe('Companion & Escort Walking Transit Preservation', () => {
  it('preserves companion, inventory, and prosthetics during district travel', () => {
    let state = createTransitTestWorld();
    const playerId = EntityIdSchema.parse('actor_player');
    const targetDistrict = BlueprintIdSchema.parse('district_whitechapel_ward');

    const gateId = EntityIdSchema.parse('gate_test_whitechapel');
    const gateEntity: EntityRecord = {
      id: gateId,
      name: 'District Gate to Whitechapel',
      visual: { glyph: '∩', fgPrimary: '#D4AF37', fgSecondary: '#9A7D0A', bgColor: '#1A1D20', shaderFlags: [] },
      position: { x: 6, y: 5, stratum: 'STREET', blocksMovement: false, blocksSight: false },
      districtGate: {
        targetDistrictId: targetDistrict,
        gateLabel: 'To Whitechapel',
        apCost: 100,
      },
    };

    const companionId = EntityIdSchema.parse('npc_companion_edward');
    const itemId = EntityIdSchema.parse('item_carried_flask');
    const prostheticId = EntityIdSchema.parse('prosthetic_brass_arm');

    const carriedItem = createEntityFromBlueprint('mat_brass_gears', itemId, 2)!;
    const installedProsthetic = createEntityFromBlueprint('prosthetic_pneumatic_leg_mk1', prostheticId, 1)!;

    const companionAnatomy = createDefaultNpcAnatomy(30, 20);
    companionAnatomy.limbs.LEFT_LEG = {
      slot: 'LEFT_LEG',
      hp: 30,
      maxHp: 30,
      amputated: false,
      installedProstheticEntityId: prostheticId,
    };

    const companionNpc: EntityRecord = {
      id: companionId,
      name: 'Edward the Automaton Guide',
      visual: { glyph: '@', fgPrimary: '#5DADE2', fgSecondary: '#2874A6', bgColor: '#000000', shaderFlags: [] },
      position: { x: 4, y: 5, stratum: 'STREET', blocksMovement: true, blocksSight: false },
      actor: { isPlayer: false, energy: 100, speed: 100 },
      aiController: {
        factionId: 'IRONMONGERS_CARTEL',
        role: 'GUARD',
        hostile: false,
        alertState: 'IDLE',
        companionOfActorId: playerId,
      },
      inventory: { containedEntityIds: [itemId], maxMassGrams: 20000, maxVolumeMl: 20000, currentMassGrams: 100 },
      anatomy: companionAnatomy,
    };

    state = {
      ...state,
      entities: {
        ...state.entities,
        [gateId]: gateEntity,
        [companionId]: companionNpc,
        [itemId]: carriedItem,
        [prostheticId]: installedProsthetic,
      },
    };

    const res = resolveTravelDistrict(state, playerId, targetDistrict);
    expect(res.state.currentDistrictId).toBe(targetDistrict);
    expect(res.state.entities[companionId]).toBeDefined();
    expect(res.state.entities[itemId]).toBeDefined();
    expect(res.state.entities[prostheticId]).toBeDefined();

    const movedPlayer = res.state.entities[playerId];
    const movedCompanion = res.state.entities[companionId];
    expect(movedPlayer?.position?.stratum).toBe('STREET');
    expect(movedCompanion?.position?.stratum).toBe('STREET');

    const dist = Math.max(
      Math.abs(movedCompanion!.position!.x - movedPlayer!.position!.x),
      Math.abs(movedCompanion!.position!.y - movedPlayer!.position!.y),
    );
    expect(dist).toBeLessThanOrEqual(1);

    const compEvent = res.events.find((e) => e.type === 'COMPANION_TRANSIT_PRESERVED');
    expect(compEvent).toBeDefined();
    if (compEvent && compEvent.type === 'COMPANION_TRANSIT_PRESERVED') {
      expect(compEvent.companionEntityId).toBe(companionId);
      expect(compEvent.toDistrictId).toBe(targetDistrict);
    }
  });
});
