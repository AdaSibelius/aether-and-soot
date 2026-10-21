import { describe, expect, it } from 'vitest';
import { BlueprintIdSchema, EntityIdSchema } from '../../src/schemas/primitives.schema.js';
import { dispatchCommand } from '../../src/sim/core/engine.js';
import { createInitialWorld, WorldState } from '../../src/sim/core/world.js';
import { generateCatacombsFloor, getCatacombsTierName } from '../../src/sim/spatial/catacombs.js';
import { createMonorailCarEntity } from '../../src/sim/systems/monorail.system.js';

describe('Phase 43: Catacombs & Derelict Pneumatic Monorail', () => {
  it('generates procedural Catacombs floors with scaling depth tiers and miasmas', () => {
    const floorD1 = generateCatacombsFloor(12345, 24, 24, 1);
    expect(floorD1.grid.stratum).toBe('CATACOMBS');
    expect(floorD1.tierName).toBe('Chalk Catacombs');
    expect(floorD1.stairsUp).toBeDefined();
    expect(floorD1.stairsDown).toBeDefined();

    const floorD5 = generateCatacombsFloor(12345, 24, 24, 5);
    expect(floorD5.tierName).toBe('Sunken Ossuary');

    const floorD8 = generateCatacombsFloor(12345, 24, 24, 8);
    expect(floorD8.tierName).toBe('Clockwork Vaults');
    expect(getCatacombsTierName(12)).toBe('Abyssal Cog-Core');

    // Verify relics and traps exist on generated floors
    const relics = Object.values(floorD1.entities).filter((e) => e.item);
    expect(relics.length).toBeGreaterThan(0);
    const traps = Object.values(floorD1.entities).filter((e) => e.trap);
    expect(traps.length).toBeGreaterThan(0);
  });

  it('handles DESCEND_CATACOMBS command and causal events', () => {
    let state = createInitialWorld({ seed: 42 });
    const playerId = EntityIdSchema.parse('actor_player');
    const player = state.entities[playerId]!;

    // Place descent stairs right next to player
    const stairId = EntityIdSchema.parse('stairs_undercroft_to_catacombs');
    state = {
      ...state,
      entities: {
        ...state.entities,
        [stairId]: {
          id: stairId,
          name: 'Derelict Descent Shaft',
          visual: { glyph: '>', fgPrimary: '#E74C3C', fgSecondary: '#922B21', bgColor: '#0A0D0E', shaderFlags: [] },
          position: { x: player.position!.x, y: player.position!.y, stratum: 'STREET', blocksMovement: false, blocksSight: false },
        },
      },
    };

    const res = dispatchCommand(state, {
      type: 'DESCEND_CATACOMBS',
      actorId: playerId,
      stairEntityId: stairId,
    });

    expect(res.events.some((e) => e.type === 'CATACOMBS_DEPTH_DESCENDED')).toBe(true);
    const updatedPlayer = res.state.entities[playerId];
    expect(updatedPlayer?.position?.stratum).toBe('CATACOMBS');
    expect(updatedPlayer?.position?.depthLevel).toBe(1);

    // Descend deeper from depth 1 to depth 2
    const downStair = Object.values(res.state.entities).find(
      (e) => e.id === 'stairs_catacombs_down_d1',
    );
    expect(downStair).toBeDefined();

    // Move player adjacent to down stair
    const atStairsState: WorldState = {
      ...res.state,
      entities: {
        ...res.state.entities,
        [playerId]: { ...updatedPlayer!, position: { ...downStair!.position!, blocksMovement: true, blocksSight: false } },
      },
    };

    const res2 = dispatchCommand(atStairsState, {
      type: 'DESCEND_CATACOMBS',
      actorId: playerId,
      stairEntityId: downStair!.id,
    });

    expect(res2.events.some((e) => e.type === 'CATACOMBS_DEPTH_DESCENDED')).toBe(true);
    const deeperPlayer = res2.state.entities[playerId];
    expect(deeperPlayer?.position?.depthLevel).toBe(2);
  });

  it('manages monorail boarding, disembarking, steam validation, and launch transit', () => {
    let state = createInitialWorld({ seed: 99 });
    const playerId = EntityIdSchema.parse('actor_player');
    const player = state.entities[playerId]!;

    const carEntityId = EntityIdSchema.parse('monorail_test_car_1');
    const carEntity = createMonorailCarEntity(
      'monorail_test_car_1',
      { x: player.position!.x + 1, y: player.position!.y, stratum: player.position!.stratum },
      BlueprintIdSchema.parse('district_fleet_ditch_undercroft'),
      50,
    );
    state = { ...state, entities: { ...state.entities, [carEntityId]: carEntity } };

    // Board monorail
    const boardRes = dispatchCommand(state, {
      type: 'BOARD_MONORAIL',
      actorId: playerId,
      monorailEntityId: carEntityId,
    });
    expect(boardRes.events.some((e) => e.type === 'MONORAIL_BOARDED')).toBe(true);
    expect(boardRes.state.entities[carEntityId]?.monorailCar?.occupiedByActorIds).toContain(playerId);

    // Launch monorail to valid district
    const launchRes = dispatchCommand(boardRes.state, {
      type: 'LAUNCH_MONORAIL',
      actorId: playerId,
      monorailEntityId: carEntityId,
      destinationDistrictId: BlueprintIdSchema.parse('district_fleet_ditch_undercroft'),
    });

    expect(launchRes.events.some((e) => e.type === 'MONORAIL_LAUNCHED')).toBe(true);
    expect(launchRes.events.some((e) => e.type === 'MONORAIL_ARRIVED')).toBe(true);
    expect(launchRes.state.currentDistrictId).toBe('district_fleet_ditch_undercroft');
    expect(launchRes.state.entities[playerId]).toBeDefined();

    // Disembark
    const disembarkRes = dispatchCommand(launchRes.state, {
      type: 'BOARD_MONORAIL',
      actorId: playerId,
      monorailEntityId: carEntityId,
    });
    expect(disembarkRes.state.entities[carEntityId]?.monorailCar?.occupiedByActorIds).not.toContain(playerId);
  });

  it('rejects monorail launch when steam pressure is depleted', () => {
    let state = createInitialWorld({ seed: 77 });
    const playerId = EntityIdSchema.parse('actor_player');
    const carEntityId = EntityIdSchema.parse('monorail_depleted_car');
    const carEntity = createMonorailCarEntity(
      'monorail_depleted_car',
      { x: 10, y: 10, stratum: 'STREET' },
      BlueprintIdSchema.parse('district_fleet_ditch_undercroft'),
      5, // Insufficient steam (< 15 kPa)
    );
    // Force passenger aboard
    carEntity.monorailCar!.occupiedByActorIds.push(playerId);
    state = {
      ...state,
      entities: { ...state.entities, [carEntityId]: carEntity },
    };

    const res = dispatchCommand(state, {
      type: 'LAUNCH_MONORAIL',
      actorId: playerId,
      monorailEntityId: carEntityId,
      destinationDistrictId: BlueprintIdSchema.parse('district_fleet_ditch_undercroft'),
    });

    expect(res.events.some((e) => e.type === 'MONORAIL_ACTION_FAILED')).toBe(true);
  });
});
