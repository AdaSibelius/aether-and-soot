import { describe, expect, it } from 'vitest';
import { EntityIdSchema } from '../../src/schemas/primitives.schema.js';
import { createInitialWorld } from '../../src/sim/core/world.js';
import { dispatchCommand } from '../../src/sim/core/engine.js';
import { findPortalAtPoint } from '../../src/sim/spatial/portals.js';
import { projectWorldToVisualFrame } from '../../src/client/projection/frame-adapter.js';

describe('Deterministic Portals System Test: Multi-Stratum Traversal (portals.ts)', () => {
  const playerId = EntityIdSchema.parse('actor_player');

  it('traverses from STREET down to UNDERCROFT stratum via stairs portal', () => {
    // Given (Seeded World)
    const world = createInitialWorld({ seed: 42 });
    const player = world.entities[playerId];
    expect(player?.position).toBeDefined();

    const origin = player!.position!;
    const portal = findPortalAtPoint(world.entities, origin);
    expect(portal).toBeDefined();
    expect(portal?.portal?.target.stratum).toBe('UNDERCROFT');

    // When (Command Dispatched via command-router.ts)
    const result = dispatchCommand(world, { type: 'USE_PORTAL', actorId: playerId });

    // Then (ECS Component Delta + Domain Event Emitted + Frame Projection Verified)
    // 1. ECS Component Delta
    const nextPlayer = result.state.entities[playerId];
    expect(nextPlayer?.position?.stratum).toBe('UNDERCROFT');
    expect(nextPlayer?.position?.x).toBe(portal!.portal!.target.x);
    expect(nextPlayer?.position?.y).toBe(portal!.portal!.target.y);

    // 2. Domain Event Emitted
    const stratumEv = result.events.find((e) => e.type === 'STRATUM_CHANGED');
    expect(stratumEv).toBeDefined();
    if (stratumEv && stratumEv.type === 'STRATUM_CHANGED') {
      expect(stratumEv.fromStratum).toBe('STREET');
      expect(stratumEv.toStratum).toBe('UNDERCROFT');
    }

    // 3. Frame Projection Verified
    const frame = projectWorldToVisualFrame(result.state, playerId);
    expect(frame.activeStratum).toBe('UNDERCROFT');
    expect(frame.cells.length).toBeGreaterThan(0);
  });

  it('traverses from STREET up to SPIRE stratum via steam catwalk elevator', () => {
    // Given (Seeded World)
    const world = createInitialWorld({ seed: 101 });
    const player = world.entities[playerId];
    expect(player?.position).toBeDefined();

    // Move player to custom hoist location away from default manhole
    const hoistPos = { x: 5, y: 5, stratum: 'STREET' as const, blocksMovement: false, blocksSight: false };
    const spirePortalId = EntityIdSchema.parse('portal_street_to_spire');
    const worldWithSpire = {
      ...world,
      entities: {
        ...world.entities,
        [playerId]: {
          ...player!,
          position: hoistPos,
        },
        [spirePortalId]: {
          id: spirePortalId,
          name: 'Pneumatic Spire Hoist',
          visual: { glyph: '^', fgPrimary: '#D4AF37', fgSecondary: '#5D6D7E', bgColor: '#0A0D0E', shaderFlags: [] },
          position: hoistPos,
          portal: {
            target: { x: 18, y: 16, stratum: 'SPIRE' as const },
            apCost: 100,
            bidirectional: true,
            conductsGas: false,
            portalLabel: 'Pneumatic Spire Hoist',
          },
        },
      },
    };

    const portal = findPortalAtPoint(worldWithSpire.entities, hoistPos);
    expect(portal?.portal?.target.stratum).toBe('SPIRE');

    // When (Command Dispatched via command-router.ts)
    const result = dispatchCommand(worldWithSpire, { type: 'USE_PORTAL', actorId: playerId });

    // Then (ECS Component Delta + Domain Event Emitted + Frame Projection Verified)
    // 1. ECS Component Delta
    expect(result.state.entities[playerId]?.position?.stratum).toBe('SPIRE');
    expect(result.state.entities[playerId]?.position?.x).toBe(18);

    // 2. Domain Event Emitted
    expect(result.events.some((e) => e.type === 'STRATUM_CHANGED' && e.toStratum === 'SPIRE')).toBe(true);

    // 3. Frame Projection Verified
    const frame = projectWorldToVisualFrame(result.state, playerId);
    expect(frame.activeStratum).toBe('SPIRE');
  });

  it('traverses back from UNDERCROFT up to STREET', () => {
    // Given (Seeded World)
    const world = createInitialWorld({ seed: 777 });
    const player = world.entities[playerId];
    expect(player?.position).toBeDefined();

    const underPos = { x: 14, y: 14, stratum: 'UNDERCROFT' as const, blocksMovement: false, blocksSight: false };
    const returnPortalId = EntityIdSchema.parse('portal_undercroft_return');
    const underWorld = {
      ...world,
      entities: {
        ...world.entities,
        [playerId]: {
          ...player!,
          position: underPos,
        },
        [returnPortalId]: {
          id: returnPortalId,
          name: 'Iron Ladder to Surface',
          visual: { glyph: '<', fgPrimary: '#D4AF37', fgSecondary: '#5D6D7E', bgColor: '#0A0D0E', shaderFlags: [] },
          position: underPos,
          portal: {
            target: { x: 20, y: 20, stratum: 'STREET' as const },
            apCost: 100,
            bidirectional: true,
            conductsGas: false,
            portalLabel: 'Iron Ladder to Surface',
          },
        },
      },
    };

    // When (Command Dispatched via command-router.ts)
    const result = dispatchCommand(underWorld, { type: 'USE_PORTAL', actorId: playerId });

    // Then (ECS Component Delta + Domain Event Emitted + Frame Projection Verified)
    expect(result.state.entities[playerId]?.position?.stratum).toBe('STREET');
    expect(result.events.some((e) => e.type === 'STRATUM_CHANGED' && e.toStratum === 'STREET')).toBe(true);
    const frame = projectWorldToVisualFrame(result.state, playerId);
    expect(frame.activeStratum).toBe('STREET');
  });

  it('fails portal traversal when destination tile is occupied by a blocking entity', () => {
    // Given (Seeded World)
    const world = createInitialWorld({ seed: 55 });
    const player = world.entities[playerId]!;
    const origin = player.position!;
    const dest = { x: 24, y: 18, stratum: 'UNDERCROFT' as const };

    const blockerId = EntityIdSchema.parse('enemy_blocker');
    const worldWithBlocker = {
      ...world,
      entities: {
        ...world.entities,
        [blockerId]: {
          id: blockerId,
          name: 'Sentry Automaton',
          visual: { glyph: 'A', fgPrimary: '#E74C3C', fgSecondary: '#922B21', bgColor: '#0A0D0E', shaderFlags: [] },
          position: { ...dest, blocksMovement: true, blocksSight: false },
          actor: { factionId: 'FACTION_ANARCHIST', isPlayer: false, energy: 100, speed: 100 },
        },
      },
    };

    // When (Command Dispatched via command-router.ts)
    const result = dispatchCommand(worldWithBlocker, { type: 'USE_PORTAL', actorId: playerId });

    // Then (ECS Component Delta + Domain Event Emitted + Frame Projection Verified)
    // 1. ECS Component Delta (Stratum unchanged)
    expect(result.state.entities[playerId]?.position?.stratum).toBe(origin.stratum);
    // 2. Domain Event Emitted
    const failedEv = result.events.find((e) => e.type === 'PORTAL_FAILED');
    expect(failedEv).toBeDefined();
    if (failedEv && failedEv.type === 'PORTAL_FAILED') {
      expect(failedEv.reason).toBe('DESTINATION_BLOCKED');
    }
    // 3. Frame Projection Verified
    const frame = projectWorldToVisualFrame(result.state, playerId);
    expect(frame.activeStratum).toBe(origin.stratum);
  });
});
