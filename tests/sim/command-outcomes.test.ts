import { describe, expect, it } from 'vitest';
import { EntityRecord } from '../../src/schemas/components.schema.js';
import { EntityIdSchema, StratumId } from '../../src/schemas/primitives.schema.js';
import { dispatchCommand } from '../../src/sim/core/engine.js';
import { createInitialWorld, WorldState } from '../../src/sim/core/world.js';
import { setTileCell } from '../../src/sim/spatial/grid.js';
import { createDefaultNpcAnatomy } from '../../src/sim/systems/district-spawner.js';

describe('Phase C: Command Outcome Semantics & Input Rejection Rules', () => {
  const playerId = EntityIdSchema.parse('actor_player');
  const npcId = EntityIdSchema.parse('actor_patrol_guard');
  const streetStratum: StratumId = 'STREET';

  function createTestWorldWithNpc(): { world: WorldState; initialTurn: number } {
    let world = createInitialWorld({ seed: 777, width: 16, height: 16 });

    // Position player at (1, 1), adjacent to west wall (0, 1)
    const player = world.entities[playerId]!;
    const npc: EntityRecord = {
      id: npcId,
      name: 'Constabulary Patrolman',
      visual: { glyph: 'G', fgPrimary: '#3498DB', fgSecondary: '#2980B9', bgColor: '#0A0D0E', shaderFlags: [] },
      position: { x: 4, y: 1, stratum: streetStratum, blocksMovement: true, blocksSight: false },
      actor: { energy: 100, speed: 100, isPlayer: false },
      aiController: { factionId: 'CROWN_CONSTABULARY', role: 'GUARD', hostile: false, alertState: 'IDLE' },
      anatomy: createDefaultNpcAnatomy(),
    };

    world = {
      ...world,
      entities: {
        ...world.entities,
        [playerId]: {
          ...player,
          position: { x: 1, y: 1, stratum: streetStratum, blocksMovement: true, blocksSight: false },
          actor: { ...player.actor!, energy: 100, speed: 100 },
        },
        [npcId]: npc,
      },
    };

    return { world, initialTurn: world.turnCount };
  }

  it('rejects wall bump with 0 AP, advances turn count by 0, and causes 0 NPC movement', () => {
    const { world, initialTurn } = createTestWorldWithNpc();
    const initialNpcPos = { ...world.entities[npcId]!.position! };
    const initialPlayerEnergy = world.entities[playerId]!.actor!.energy;

    // Move West into border wall (0, 1)
    const res = dispatchCommand(world, {
      type: 'MOVE_STEP',
      actorId: playerId,
      dx: -1,
      dy: 0,
    });

    // 1. Emits MOVEMENT_BLOCKED with SOLID_TILE
    expect(res.events).toContainEqual(
      expect.objectContaining({
        type: 'MOVEMENT_BLOCKED',
        reason: 'SOLID_TILE',
        actorId: playerId,
      }),
    );

    // 2. Turn count does not advance
    expect(res.state.turnCount).toBe(initialTurn);

    // 3. Player AP / energy is untouched
    expect(res.state.entities[playerId]!.actor!.energy).toBe(initialPlayerEnergy);

    // 4. Player position is unchanged
    expect(res.state.entities[playerId]!.position).toEqual({
      x: 1,
      y: 1,
      stratum: streetStratum,
      blocksMovement: true,
      blocksSight: false,
    });

    // 5. NPC AI turns are bypassed (no free turns given)
    expect(res.state.entities[npcId]!.position).toEqual(initialNpcPos);
  });

  it('rejects out-of-bounds move step with 0 AP and pauses simulation clock', () => {
    const { world, initialTurn } = createTestWorldWithNpc();

    // Move North-West out of bounds by placing player at (0, 0) and moving -1, 0
    let oobWorld = {
      ...world,
      entities: {
        ...world.entities,
        [playerId]: {
          ...world.entities[playerId]!,
          position: { x: 0, y: 0, stratum: streetStratum, blocksMovement: true, blocksSight: false },
        },
      },
    };

    const res = dispatchCommand(oobWorld, {
      type: 'MOVE_STEP',
      actorId: playerId,
      dx: -1,
      dy: 0,
    });

    expect(res.events).toContainEqual(
      expect.objectContaining({
        type: 'MOVEMENT_BLOCKED',
        reason: 'OUT_OF_BOUNDS',
        actorId: playerId,
      }),
    );
    expect(res.state.turnCount).toBe(initialTurn);
  });

  it('opens closed door on bump, consuming standard 100 AP and advancing simulation turn clock', () => {
    const { world, initialTurn } = createTestWorldWithNpc();

    // Place a closed wooden door directly East of the player at (2, 1)
    const streetGrid = world.strata[streetStratum]!;
    const gridWithDoor = setTileCell(streetGrid, 2, 1, (prev) => ({
      ...prev,
      terrainType: 'WOODEN_DOOR_CLOSED',
      blocksMovement: true,
      blocksSight: true,
    }));

    const worldWithDoor: WorldState = {
      ...world,
      strata: {
        ...world.strata,
        [streetStratum]: gridWithDoor,
      },
    };

    // Step East into the closed door
    const res = dispatchCommand(worldWithDoor, {
      type: 'MOVE_STEP',
      actorId: playerId,
      dx: 1,
      dy: 0,
    });

    // 1. Emits DOOR_TOGGLED
    expect(res.events).toContainEqual(
      expect.objectContaining({
        type: 'DOOR_TOGGLED',
        newState: 'OPEN',
        actorId: playerId,
      }),
    );

    // 2. Door tile is opened
    const cell = res.state.strata[streetStratum]!.cells[1 * 16 + 2]!;
    expect(cell.terrainType).toBe('WOODEN_DOOR_OPEN');
    expect(cell.blocksMovement).toBe(false);

    // 3. Spends standard AP and advances turn count by 1
    expect(res.state.turnCount).toBe(initialTurn + 1);
  });

  it('rejects invalid item interaction without granting free turns to nearby enemies', () => {
    const { world, initialTurn } = createTestWorldWithNpc();
    const initialNpcPos = { ...world.entities[npcId]!.position! };
    const missingItemId = EntityIdSchema.parse('item_nonexistent_relic');

    // Attempt to drop an item not in player's inventory
    const res = dispatchCommand(world, {
      type: 'DROP_ITEM',
      actorId: playerId,
      itemEntityId: missingItemId,
    });

    expect(res.events).toContainEqual(
      expect.objectContaining({
        type: 'INVENTORY_ACTION_FAILED',
        reason: 'NOT_IN_INVENTORY',
        actorId: playerId,
      }),
    );

    // 0 AP consumed, turn count unchanged, 0 NPC action
    expect(res.state.turnCount).toBe(initialTurn);
    expect(res.state.entities[npcId]!.position).toEqual(initialNpcPos);
  });
});
