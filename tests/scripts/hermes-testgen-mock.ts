import path from 'node:path';

export function generateMockTestSuite(
  targetPath: string,
  rootDir: string,
  functions: string[] = [],
): string {
  const relImport = path
    .relative(path.dirname(path.join(rootDir, 'tests/sim/test.ts')), path.join(rootDir, targetPath))
    .replace(/\\/g, '/')
    .replace(/\.ts$/, '.js');
  const importPath = relImport.startsWith('.') ? relImport : './' + relImport;
  const fnNames = functions
    .map((f) => f.match(/^([A-Za-z0-9_]+)/)?.[1])
    .filter((s): s is string => Boolean(s));

  if (targetPath.includes('metabolism')) {
    return `import { describe, expect, it } from 'vitest';
import { EntityIdSchema } from '../../src/schemas/primitives.schema.js';
import { createInitialWorld } from '../../src/sim/core/world.js';
import { dispatchCommand } from '../../src/sim/core/engine.js';
import { projectWorldToVisualFrame } from '../../src/client/projection/frame-adapter.js';
import { advanceMetabolismTick } from '${importPath}';

describe('Deterministic Metabolism System Test', () => {
  it('triggers TOXICITY_OVERDOSE and inflicts penalties when toxicity crosses 80%', () => {
    // Given (Seeded World)
    const world = createInitialWorld({ seed: 42 });
    const playerId = EntityIdSchema.parse('actor_player');
    const player = world.entities[playerId];
    expect(player?.anatomy).toBeDefined();

    const primedWorld = {
      ...world,
      entities: {
        ...world.entities,
        [playerId]: {
          ...player!,
          anatomy: {
            ...player!.anatomy!,
            toxicityPct: 85,
            bloodVolumePct: 100,
          },
        },
      },
    };

    // When (Command Dispatched via command-router.ts)
    const result = dispatchCommand(primedWorld, { type: 'WAIT_TURN', actorId: playerId });

    // Then (ECS Component Delta + Domain Event Emitted + Frame Projection Verified)
    // 1. ECS Component Delta
    const updatedPlayer = result.state.entities[playerId];
    expect(updatedPlayer?.anatomy?.bloodVolumePct).toBeLessThan(100);
    // 2. Domain Event Emitted
    const overdoseEv = result.events.find((e) => e.type === 'TOXICITY_OVERDOSE');
    expect(overdoseEv).toBeDefined();
    // 3. Frame Projection Verified
    const frame = projectWorldToVisualFrame(result.state, playerId);
    expect(frame.activeStratum).toBeDefined();
  });
});
`;
  }

  if (targetPath.includes('portals')) {
    return `import { describe, expect, it } from 'vitest';
import { EntityIdSchema } from '../../src/schemas/primitives.schema.js';
import { createInitialWorld } from '../../src/sim/core/world.js';
import { dispatchCommand } from '../../src/sim/core/engine.js';
import { projectWorldToVisualFrame } from '../../src/client/projection/frame-adapter.js';
import { findPortalAtPoint } from '${importPath}';

describe('Auto-Generated System Test (${path.basename(targetPath)})', () => {
  it('executes Given -> When -> Then portal lifecycle', () => {
    // Given (Seeded World)
    const world = createInitialWorld({ seed: 42 });
    const playerId = EntityIdSchema.parse('actor_player');
    const player = world.entities[playerId];
    expect(player).toBeDefined();

    const origin = player?.position ?? { x: 24, y: 18, stratum: 'STREET' as const };
    const portalId = EntityIdSchema.parse('portal_undercroft_test');
    const primedWorld = {
      ...world,
      entities: {
        ...world.entities,
        [portalId]: {
          id: portalId,
          name: 'Undercroft Descent Stairs',
          visual: { glyph: '>', fgPrimary: '#D4AF37', fgSecondary: '#5D6D7E', bgColor: '#0A0D0E', shaderFlags: [] },
          position: { ...origin, blocksMovement: false, blocksSight: false },
          portal: {
            target: { x: origin.x, y: origin.y, stratum: 'UNDERCROFT' as const },
            apCost: 100,
            bidirectional: true,
            conductsGas: false,
            portalLabel: 'Undercroft Descent Stairs',
          },
        },
      },
    };

    const portal = findPortalAtPoint(primedWorld.entities, origin);
    expect(portal).toBeDefined();
    expect(portal?.portal?.target.stratum).toBe('UNDERCROFT');

    // When (Command Dispatched via command-router.ts)
    const result = dispatchCommand(primedWorld, { type: 'USE_PORTAL', actorId: playerId });

    // Then (ECS Component Delta + Domain Event Emitted + Frame Projection Verified)
    // 1. ECS Component Delta
    expect(result.state.entities[playerId]?.position?.stratum).toBe('UNDERCROFT');
    // 2. Domain Event Emitted
    expect(result.events.some((e) => e.type === 'STRATUM_CHANGED')).toBe(true);
    // 3. Frame Projection Verified
    const frame = projectWorldToVisualFrame(result.state, playerId);
    expect(frame.activeStratum).toBe('UNDERCROFT');
    expect(frame.cells.length).toBeGreaterThan(0);
  });
});
`;
  }

  const primaryFn = fnNames[0] ?? 'resolveInstallProsthetic';
  return `import { describe, expect, it } from 'vitest';
import { EntityIdSchema } from '../../src/schemas/primitives.schema.js';
import { createInitialWorld } from '../../src/sim/core/world.js';
import { dispatchCommand } from '../../src/sim/core/engine.js';
import { projectWorldToVisualFrame } from '../../src/client/projection/frame-adapter.js';
import { ${primaryFn} } from '${importPath}';

describe('Deterministic System Test (${path.basename(targetPath)})', () => {
  it('executes Given -> When -> Then lifecycle for domain operations', () => {
    // Given (Seeded World)
    const world = createInitialWorld({ seed: 42 });
    const playerId = EntityIdSchema.parse('actor_player');
    expect(world).toBeDefined();
    expect(typeof ${primaryFn}).toBe('function');

    // When (Command Dispatched via command-router.ts)
    const result = dispatchCommand(world, { type: 'WAIT_TURN', actorId: playerId });

    // Then (ECS Component Delta + Domain Event Emitted + Frame Projection Verified)
    // 1. ECS Component Delta
    expect(result.state.turnCount).toBe(world.turnCount + 1);
    expect(result.state.entities[playerId]).toBeDefined();
    // 2. Domain Event Emitted
    expect(result.events).toBeDefined();
    // 3. Frame Projection Verified
    const frame = projectWorldToVisualFrame(result.state, playerId);
    expect(frame.primaryStratum).toBeDefined();
  });
});
`;
}
