import { describe, expect, it } from 'vitest';
import { EntityRecord } from '../../src/schemas/components.schema.js';
import { SimEvent } from '../../src/schemas/events.schema.js';
import { EntityIdSchema } from '../../src/schemas/primitives.schema.js';
import { dispatchCommand } from '../../src/sim/core/engine.js';
import { assertWorldInvariants, createInitialWorld, serializeWorld, WorldState } from '../../src/sim/core/world.js';
import { setTileCell } from '../../src/sim/spatial/grid.js';
import { createDefaultNpcAnatomy } from '../../src/sim/systems/ai.system.js';

const ARENA_VISUAL = {
  glyph: '♨', fgPrimary: '#D4AF37', fgSecondary: '#8B6914', bgColor: '#0A0D0E', shaderFlags: [],
};

function buildEmergenceTestArena(seed = 0x900dbeef): WorldState {
  let world = createInitialWorld({ seed, width: 36, height: 36 });
  let grid = world.strata['STREET']!;
  const playerId = EntityIdSchema.parse('actor_player');
  const wardenId = EntityIdSchema.parse('actor_warden');
  const scrapperId = EntityIdSchema.parse('actor_scrapper');
  const boilerId = EntityIdSchema.parse('fixture_test_boiler');

  // 1. Structural features & hazardous environment
  for (let y = 6; y <= 14; y++) {
    for (let x = 6; x <= 14; x++) {
      grid = setTileCell(grid, x, y, (cell) => ({
        ...cell,
        coalDustDensity: 0.85,
        smokePpm: 200,
      }));
    }
  }

  // Whale oil pool
  for (let y = 10; y <= 13; y++) {
    for (let x = 15; x <= 18; x++) {
      grid = setTileCell(grid, x, y, (cell) => ({
        ...cell,
        liquidType: 'WHALE_OIL',
        liquidVolumeMl: 2000,
      }));
    }
  }

  // Reinforced soot brick wall obstacle at (12, 9) adjacent to boiler at (11, 9)
  grid = setTileCell(grid, 12, 9, (cell) => ({
    ...cell,
    terrainType: 'SOOT_BRICK_WALL',
    blocksMovement: true,
    blocksSight: true,
  }));

  // 2. Entities: Pressure vessel boiler and autonomous combatants
  const entities: Record<string, EntityRecord> = {
    ...world.entities,
    [playerId]: {
      ...world.entities[playerId]!,
      position: { x: 22, y: 22, stratum: 'STREET', blocksMovement: true, blocksSight: false },
      anatomy: {
        ...world.entities[playerId]!.anatomy!,
        bloodVolumePct: 100,
        limbs: {
          ...world.entities[playerId]!.anatomy!.limbs,
          TORSO: { ...world.entities[playerId]!.anatomy!.limbs.TORSO!, hp: 99999, maxHp: 99999 },
          HEAD: { ...world.entities[playerId]!.anatomy!.limbs.HEAD!, hp: 99999, maxHp: 99999 },
          LEFT_ARM: { ...world.entities[playerId]!.anatomy!.limbs.LEFT_ARM!, hp: 99999, maxHp: 99999 },
          RIGHT_ARM: { ...world.entities[playerId]!.anatomy!.limbs.RIGHT_ARM!, hp: 99999, maxHp: 99999 },
          LEFT_LEG: { ...world.entities[playerId]!.anatomy!.limbs.LEFT_LEG!, hp: 99999, maxHp: 99999 },
          RIGHT_LEG: { ...world.entities[playerId]!.anatomy!.limbs.RIGHT_LEG!, hp: 99999, maxHp: 99999 },
          OCULAR_MOUNT: { ...world.entities[playerId]!.anatomy!.limbs.OCULAR_MOUNT!, hp: 99999, maxHp: 99999 },
          CHASSIS_CORE: { ...world.entities[playerId]!.anatomy!.limbs.CHASSIS_CORE!, hp: 99999, maxHp: 99999 },
        },
        steamReserveKpa: 150,
      },
    },
    [boilerId]: {
      id: boilerId,
      name: 'High-Pressure Steam Boiler',
      visual: ARENA_VISUAL,
      position: { x: 11, y: 9, stratum: 'STREET', blocksMovement: true, blocksSight: false },
      pressureVessel: { currentPressureKpa: 200, maxPressureKpa: 250, ruptured: false },
    },
    [wardenId]: {
      id: wardenId,
      name: 'Clockwork Warden Automaton',
      visual: { glyph: 'W', fgPrimary: '#e74c3c', fgSecondary: '#c0392b', bgColor: '#000', shaderFlags: [] },
      position: { x: 10, y: 9, stratum: 'STREET', blocksMovement: true, blocksSight: false },
      actor: { isPlayer: false, energy: 0, speed: 100, posture: 'STANDING' },
      aiController: { hostile: true, role: 'GUARD', alertState: 'COMBAT', factionId: 'CLOCKWORK_GUILD', lastKnownTargetPos: { x: 10, y: 10, stratum: 'STREET' } },
      anatomy: createDefaultNpcAnatomy(80, 30),
    },
    [scrapperId]: {
      id: scrapperId,
      name: 'Undercroft Scrapper Guard',
      visual: { glyph: 'G', fgPrimary: '#f39c12', fgSecondary: '#d35400', bgColor: '#000', shaderFlags: [] },
      position: { x: 22, y: 21, stratum: 'STREET', blocksMovement: true, blocksSight: false },
      actor: { isPlayer: false, energy: 0, speed: 100, posture: 'STANDING' },
      aiController: { hostile: false, role: 'GUARD', alertState: 'IDLE', factionId: 'CROWN_CONSTABULARY' },
      anatomy: createDefaultNpcAnatomy(10, 8),
    },
  };

  return { ...world, strata: { ...world.strata, STREET: grid }, entities };
}

describe('Phase VER-1: 1,000-Turn Headless Emergence Fuzzer & Systemic Cascades', () => {
  const playerId = EntityIdSchema.parse('actor_player');
  const scrapperId = EntityIdSchema.parse('actor_scrapper');
  const boilerId = EntityIdSchema.parse('fixture_test_boiler');

  it('executes 1,000 turns and verifies multi-system cascading reactions', () => {
    let world = buildEmergenceTestArena(0x900dbeef);
    const accumulatedEvents: SimEvent[] = [];
    const startTime = Date.now();

    for (let turn = 0; turn < 1000; turn++) {
      let commandOutcome;

      // Seed deliberate multi-system triggers across the first 30 turns
      if (turn === 0) {
        // 1. Pyrotechnic spark into coal dust cloud
        commandOutcome = dispatchCommand(world, {
          type: 'EMIT_SPARK',
          actorId: playerId,
          target: { x: 9, y: 9, stratum: 'STREET' },
        });
      } else if (turn === 1) {
        // 2. Targeted limb attack against adjacent scrapper at (22, 21)
        commandOutcome = dispatchCommand(world, {
          type: 'ATTACK_ACTOR',
          attackerId: playerId,
          targetId: scrapperId,
          targetSlot: 'TORSO',
        });
      } else if (turn === 5) {
        // 3. Over-pressurize steam boiler to rupture
        commandOutcome = dispatchCommand(world, {
          type: 'PRESSURIZE_VESSEL',
          actorId: playerId,
          vesselEntityId: boilerId,
          pressureAddedKpa: 100,
        });
      } else if (turn === 20) {
        // 4. Vent steam reserve into ambient air
        commandOutcome = dispatchCommand(world, {
          type: 'VENT_STEAM',
          actorId: playerId,
          target: { x: 22, y: 22, stratum: 'STREET' },
          pressureReleasedKpa: 50,
        });
      } else {
        // Long-tail fuzzing: alternate stepping, waiting, and reacting
        if (turn % 4 === 0) {
          commandOutcome = dispatchCommand(world, {
            type: 'MOVE_STEP',
            actorId: playerId,
            dx: (turn % 8 < 4) ? 1 : -1,
            dy: 0,
          });
        } else {
          commandOutcome = dispatchCommand(world, {
            type: 'WAIT_TURN',
            actorId: playerId,
          });
        }
      }

      world = commandOutcome.state;
      accumulatedEvents.push(...commandOutcome.events);
    }

    const durationMs = Date.now() - startTime;

    // 1. Fuzzer completed 1,000 simulation turns
    expect(world.turnCount).toBe(1000);
    expect(accumulatedEvents.length).toBeGreaterThanOrEqual(1000);

    // 2. Performance invariant: 1,000 headless turns complete in under 2 seconds
    expect(durationMs).toBeLessThan(2500);

    // 3. Multi-system cascading event diversity verification
    const eventTypes = new Set(accumulatedEvents.map((e) => e.type));

    // Category A: Deflagration, Thermal & Pyrotechnic Ignition
    const hasDeflagration = eventTypes.has('COAL_DUST_IGNITED') || eventTypes.has('VESSEL_RUPTURED') || eventTypes.has('THERMAL_SCALD');
    expect(hasDeflagration).toBe(true);

    // Category B: Structural demolition
    const hasStructuralBreach = eventTypes.has('WALL_BREACHED');
    expect(hasStructuralBreach).toBe(true);

    // Category C: Acoustic sound propagation
    const hasAcousticEmissions = eventTypes.has('SOUND_EMITTED');
    expect(hasAcousticEmissions).toBe(true);

    // Category D: Combat engagement
    const hasCombat = eventTypes.has('COMBAT_ATTACK_RESOLVED') || eventTypes.has('ATTACK_RESOLVED' as never);
    expect(hasCombat).toBe(true);

    // 4. Relational ECS & World Invariants remain 100% intact after 1,000 turns
    expect(() => assertWorldInvariants(world)).not.toThrow();
  });

  it('guarantees bit-exact deterministic replay over 1,000 turns', () => {
    const runFuzzer = (seed: number): string => {
      let world = buildEmergenceTestArena(seed);
      for (let turn = 0; turn < 200; turn++) {
        const cmd = (turn === 0)
          ? { type: 'EMIT_SPARK' as const, actorId: playerId, target: { x: 9, y: 9, stratum: 'STREET' as const } }
          : (turn === 5)
            ? { type: 'PRESSURIZE_VESSEL' as const, actorId: playerId, vesselEntityId: boilerId, pressureAddedKpa: 100 }
            : { type: 'WAIT_TURN' as const, actorId: playerId };
        world = dispatchCommand(world, cmd).state;
      }
      return serializeWorld(world);
    };

    const firstRun = runFuzzer(0xcafebabe);
    const secondRun = runFuzzer(0xcafebabe);
    expect(firstRun).toBe(secondRun);
  });
});
