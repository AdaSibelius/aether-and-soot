import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

export interface ScaffoldConfig {
  readonly domain: string;
  readonly command: string;
  readonly event: string;
  readonly dryRun: boolean;
  readonly mock: boolean;
}

export function parseScaffoldArgs(argv: readonly string[]): ScaffoldConfig {
  const args = argv.slice(2);
  let domain = 'sample';
  let command = 'SAMPLE_ACTION';
  let event = 'SAMPLE_RESOLVED';
  let dryRun = false;
  let mock = false;

  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === '--domain' && args[i + 1]) domain = args[++i]?.toLowerCase().trim() ?? domain;
    else if (a === '--command' && args[i + 1]) command = args[++i]?.toUpperCase().trim() ?? command;
    else if (a === '--event' && args[i + 1]) event = args[++i]?.toUpperCase().trim() ?? event;
    else if (a === '--dry-run') dryRun = true;
    else if (a === '--mock') mock = true;
  }
  return { domain, command, event, dryRun, mock };
}

export function toPascalCase(snakeStr: string): string {
  return snakeStr
    .toLowerCase()
    .split(/[-_]/)
    .filter(Boolean)
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
    .join('');
}

export function generateScaffoldCode(config: ScaffoldConfig): {
  commandSchemaRel: string;
  commandSchemaCode: string;
  eventSchemaRel: string;
  eventSchemaCode: string;
  systemRel: string;
  systemCode: string;
  testRel: string;
  testCode: string;
} {
  const pascalDomain = toPascalCase(config.domain);
  const pascalCmd = `${toPascalCase(config.command)}Command`;
  const pascalEv = `${toPascalCase(config.event)}Event`;

  const commandSchemaRel = `src/schemas/${config.domain}-commands.schema.ts`;
  const commandSchemaCode = `import { z } from 'zod';
import { EntityIdSchema, Point3DSchema } from './primitives.schema.js';

export const ${pascalCmd}Schema = z.object({
  type: z.literal('${config.command}'),
  actorId: EntityIdSchema,
  target: Point3DSchema.optional(),
});
export type ${pascalCmd} = z.infer<typeof ${pascalCmd}Schema>;
`;

  const eventSchemaRel = `src/schemas/${config.domain}-events.schema.ts`;
  const eventSchemaCode = `import { z } from 'zod';
import { EntityIdSchema, Point3DSchema } from './primitives.schema.js';

export const ${pascalEv}Schema = z.object({
  type: z.literal('${config.event}'),
  turn: z.number().int().nonnegative(),
  actorId: EntityIdSchema,
  target: Point3DSchema.optional(),
});
export type ${pascalEv} = z.infer<typeof ${pascalEv}Schema>;
`;

  const systemRel = `src/sim/systems/${config.domain}.system.ts`;
  const systemCode = `import { SimEvent } from '../../schemas/events.schema.js';
import { EntityId, Point3D } from '../../schemas/primitives.schema.js';
import { STANDARD_ACTION_AP } from '../core/scheduler.js';
import { WorldState } from '../core/world.js';

export interface ${pascalDomain}ResolutionResult {
  readonly state: WorldState;
  readonly events: SimEvent[];
  readonly apSpent: number;
}

export function resolve${toPascalCase(config.command)}(
  state: WorldState,
  _actorId: EntityId,
  _target?: Point3D,
): ${pascalDomain}ResolutionResult {
  return {
    state,
    apSpent: STANDARD_ACTION_AP,
    events: [],
  };
}
`;

  const testRel = `tests/sim/${config.domain}.test.ts`;
  const testCode = `import { describe, expect, it } from 'vitest';
import { EntityIdSchema } from '../../src/schemas/primitives.schema.js';
import { createInitialWorld } from '../../src/sim/core/world-factory.js';
import { resolve${toPascalCase(config.command)} } from '../../src/sim/systems/${config.domain}.system.js';

describe('${pascalDomain} Mechanic System', () => {
  it('resolves ${config.command} with standard AP expenditure', () => {
    const world = createInitialWorld({ seed: 42 });
    const playerId = world.entities['player']?.id ?? EntityIdSchema.parse('player');
    const res = resolve${toPascalCase(config.command)}(world, playerId);
    expect(res.apSpent).toBe(100);
    expect(res.state).toBeDefined();
  });
});
`;

  return {
    commandSchemaRel,
    commandSchemaCode,
    eventSchemaRel,
    eventSchemaCode,
    systemRel,
    systemCode,
    testRel,
    testCode,
  };
}

export async function runScaffold(config: ScaffoldConfig, rootDir: string): Promise<void> {
  const code = generateScaffoldCode(config);

  console.log(`[scaffold-mechanic] Domain: ${config.domain}`);
  console.log(`  - Command Schema: ${code.commandSchemaRel} (${config.command})`);
  console.log(`  - Event Schema: ${code.eventSchemaRel} (${config.event})`);
  console.log(`  - Domain System: ${code.systemRel}`);
  console.log(`  - Vitest Suite: ${code.testRel}`);

  if (config.dryRun) {
    console.log('[scaffold-mechanic] Dry-run complete. No files created.');
    return;
  }

  const writeIfMissing = (rel: string, content: string) => {
    const full = path.resolve(rootDir, rel);
    if (!fs.existsSync(full)) {
      fs.mkdirSync(path.dirname(full), { recursive: true });
      fs.writeFileSync(full, content, 'utf-8');
      console.log(`[scaffold-mechanic] Created ${rel}`);
    } else {
      console.log(`[scaffold-mechanic] ${rel} already exists, skipping.`);
    }
  };

  writeIfMissing(code.commandSchemaRel, code.commandSchemaCode);
  writeIfMissing(code.eventSchemaRel, code.eventSchemaCode);
  writeIfMissing(code.systemRel, code.systemCode);
  writeIfMissing(code.testRel, code.testCode);

  try {
    execSync('npx tsc --noEmit && tsx tests/scripts/check-boundaries.ts', { cwd: rootDir, stdio: 'pipe' });
    console.log('[scaffold-mechanic] Verified 0 boundary and compiler errors.');
  } catch (err) {
    console.warn(`[scaffold-mechanic] Verification warning: ${err instanceof Error ? err.message : String(err)}`);
  }
}

if (process.argv[1]?.endsWith('scaffold-mechanic.ts')) {
  const config = parseScaffoldArgs(process.argv);
  const root = path.resolve(import.meta.dirname, '../..');
  runScaffold(config, root).catch((err) => {
    console.error(`[scaffold-mechanic] Error: ${err instanceof Error ? err.message : String(err)}`);
    process.exit(1);
  });
}
