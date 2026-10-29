import { describe, expect, it } from 'vitest';
import { BlueprintIdSchema, EntityIdSchema } from '../../src/schemas/primitives.schema.js';
import { dispatchCommand } from '../../src/sim/core/engine.js';
import { createInitialWorld, deserializeWorld, serializeWorld } from '../../src/sim/core/world.js';
import { generateVictorianDistrict } from '../../src/sim/spatial/generator.js';

describe('TSK-P2-02 & DEF-GEN-05: Catacombs Multi-Depth & Stratum Persistence', () => {
  it('preserves dropped items and floor geometry across descent, ascent, and district transit', () => {
    const gen = generateVictorianDistrict(createInitialWorld({ seed: 42, width: 24, height: 24 }));
    let state = gen.state;
    const playerId = EntityIdSchema.parse('actor_player');
    const player = state.entities[playerId]!;

    // 1. Find naturally generated descent shaft in Undercroft
    const stairId = EntityIdSchema.parse('stairs_undercroft_to_catacombs');
    const stair = state.entities[stairId];
    expect(stair).toBeDefined();

    state = {
      ...state,
      entities: {
        ...state.entities,
        [playerId]: {
          ...player,
          position: { ...stair!.position!, blocksMovement: true, blocksSight: false },
        },
      },
    };

    // 2. Descend to Depth 1
    const d1Res = dispatchCommand(state, {
      type: 'DESCEND_CATACOMBS',
      actorId: playerId,
      stairEntityId: stairId,
    });
    expect(d1Res.events.some((e) => e.type === 'CATACOMBS_DEPTH_DESCENDED')).toBe(true);
    state = d1Res.state;
    expect(state.entities[playerId]?.position?.stratum).toBe('CATACOMBS');
    expect(state.entities[playerId]?.position?.depthLevel).toBe(1);

    // Record a unique floor tile on Depth 1
    const d1Grid = state.strata.CATACOMBS!;
    expect(d1Grid).toBeDefined();

    // 3. Drop carried item on Depth 1
    const carriedItemId = state.entities[playerId]!.inventory!.containedEntityIds[0]!;
    expect(carriedItemId).toBeDefined();

    const dropRes = dispatchCommand(state, {
      type: 'DROP_ITEM',
      actorId: playerId,
      itemEntityId: carriedItemId,
      quantity: 1,
    });
    state = dropRes.state;

    const dropEv = dropRes.events.find((e) => e.type === 'ITEM_DROPPED');
    expect(dropEv).toBeDefined();
    const droppedEntityId = dropEv && dropEv.type === 'ITEM_DROPPED' ? dropEv.itemEntityId : ('' as any);
    expect(state.entities[droppedEntityId]).toBeDefined();
    expect(state.entities[droppedEntityId]!.position?.stratum).toBe('CATACOMBS');
    expect(state.entities[droppedEntityId]!.position?.depthLevel).toBe(1);
    const droppedPos = { ...state.entities[droppedEntityId]!.position! };

    // 4. Find Depth 1 descent stairs and descend to Depth 2
    const downStairD1 = Object.values(state.entities).find(
      (e) => e.id === 'stairs_catacombs_down_d1',
    );
    expect(downStairD1).toBeDefined();

    // Move player adjacent to down stairs
    state = {
      ...state,
      entities: {
        ...state.entities,
        [playerId]: {
          ...state.entities[playerId]!,
          position: { ...downStairD1!.position!, blocksMovement: true, blocksSight: false },
        },
      },
    };

    const d2Res = dispatchCommand(state, {
      type: 'DESCEND_CATACOMBS',
      actorId: playerId,
      stairEntityId: downStairD1!.id,
    });
    expect(d2Res.events.some((e) => e.type === 'CATACOMBS_DEPTH_DESCENDED')).toBe(true);
    state = d2Res.state;
    expect(state.entities[playerId]?.position?.depthLevel).toBe(2);

    // Verify catacombDepths snapshot cached Depth 1
    expect(state.catacombDepths['1']).toBeDefined();
    expect(state.catacombDepths['1']!.entities[droppedEntityId]).toBeDefined();

    // 5. Find Depth 2 ascent stairs and ascend back to Depth 1
    const upStairD2 = Object.values(state.entities).find(
      (e) => e.id === 'stairs_catacombs_up_d2',
    );
    expect(upStairD2).toBeDefined();

    state = {
      ...state,
      entities: {
        ...state.entities,
        [playerId]: {
          ...state.entities[playerId]!,
          position: { ...upStairD2!.position!, blocksMovement: true, blocksSight: false },
        },
      },
    };

    const ascendRes = dispatchCommand(state, {
      type: 'ASCEND_CATACOMBS',
      actorId: playerId,
      stairEntityId: upStairD2!.id,
    });
    expect(ascendRes.events.some((e) => e.type === 'CATACOMBS_DEPTH_ASCENDED')).toBe(true);
    state = ascendRes.state;

    // Player returned to Depth 1
    expect(state.entities[playerId]?.position?.depthLevel).toBe(1);
    expect(state.entities[playerId]?.position?.stratum).toBe('CATACOMBS');

    // Dropped item is STILL there with identical coordinates
    expect(state.entities[droppedEntityId]).toBeDefined();
    expect(state.entities[droppedEntityId]!.position?.x).toBe(droppedPos.x);
    expect(state.entities[droppedEntityId]!.position?.y).toBe(droppedPos.y);

    // 6. Test inter-district travel persistence:
    // Move player back up to Street near transit gate
    const westGate = Object.values(state.entities).find((e) => e.districtGate);
    expect(westGate).toBeDefined();

    state = {
      ...state,
      entities: {
        ...state.entities,
        [playerId]: {
          ...state.entities[playerId]!,
          position: { ...westGate!.position!, blocksMovement: true, blocksSight: false },
        },
      },
    };

    const targetDistrict = westGate!.districtGate!.targetDistrictId;
    const travelRes = dispatchCommand(state, {
      type: 'TRAVEL_DISTRICT',
      actorId: playerId,
      targetDistrictId: targetDistrict,
    });
    expect(travelRes.events.some((e) => e.type === 'DISTRICT_TRAVELED')).toBe(true);
    state = travelRes.state;

    // Verify departing district saved catacombDepths in savedDistricts snapshot
    const savedDistrict = state.savedDistricts['district_spitalfields_soot_works'];
    expect(savedDistrict).toBeDefined();
    expect(savedDistrict!.catacombDepths).toBeDefined();
    expect(savedDistrict!.catacombDepths!['1']?.entities[droppedEntityId]).toBeDefined();

    // 7. Travel back to Spitalfields
    const returnGate = Object.values(state.entities).find(
      (e) => e.districtGate && e.districtGate.targetDistrictId === 'district_spitalfields_soot_works',
    );
    expect(returnGate).toBeDefined();

    state = {
      ...state,
      entities: {
        ...state.entities,
        [playerId]: {
          ...state.entities[playerId]!,
          position: { ...returnGate!.position!, blocksMovement: true, blocksSight: false },
        },
      },
    };

    const returnRes = dispatchCommand(state, {
      type: 'TRAVEL_DISTRICT',
      actorId: playerId,
      targetDistrictId: BlueprintIdSchema.parse('district_spitalfields_soot_works'),
    });
    expect(returnRes.events.some((e) => e.type === 'DISTRICT_TRAVELED')).toBe(true);
    state = returnRes.state;

    // Restored Spitalfields retains catacombDepths!
    expect(state.catacombDepths['1']?.entities[droppedEntityId]).toBeDefined();

    // 8. Serialization roundtrip preserves catacombDepths
    const serialized = serializeWorld(state);
    const deserialized = deserializeWorld(serialized);
    expect(deserialized.catacombDepths['1']?.entities[droppedEntityId]).toBeDefined();
  });
});
