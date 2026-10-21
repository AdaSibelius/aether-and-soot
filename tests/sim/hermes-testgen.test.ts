import path from 'node:path';
import fs from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  extractModuleSignatures,
  generateMockTestSuite,
  parseTestgenArgs,
  runTestgen,
  validateTypedBoundaries,
} from '../scripts/hermes-testgen.js';

describe('Hermes Unit Test Generator (Phase 33)', () => {
  const rootDir = path.resolve(__dirname, '../..');

  it('parses CLI arguments with Tier 1 code model defaults', () => {
    const config = parseTestgenArgs(['node', 'script.js', '--target', 'src/sim/spatial/portals.ts', '--output', 'tests/sim/test-out.test.ts', '--mock']);
    expect(config.target).toBe('src/sim/spatial/portals.ts');
    expect(config.output).toBe('tests/sim/test-out.test.ts');
    expect(config.mock).toBe(true);
    expect(config.model).toMatch(/gemma4:12b-extended|hermes/);
  });

  it('extracts module signatures and imports deterministically', () => {
    const portalsPath = path.join(rootDir, 'src/sim/spatial/portals.ts');
    const { functions, imports } = extractModuleSignatures(portalsPath);

    expect(functions.length).toBeGreaterThanOrEqual(1);
    expect(functions.some((f) => f.includes('findPortalAtPoint'))).toBe(true);
    expect(imports.length).toBeGreaterThanOrEqual(1);
  });

  it('enforces Rule 2.3 untyped code rejection', () => {
    const dirtyCode = `
      export function bad(x: any): void {
        const y = x as unknown as string;
        // @ts-ignore
        console.log(y);
      }
    `;
    const check = validateTypedBoundaries(dirtyCode);
    expect(check.valid).toBe(false);
    expect(check.violations.length).toBe(3);

    const cleanCode = `
      export function good(x: string): number {
        return x.length;
      }
    `;
    expect(validateTypedBoundaries(cleanCode).valid).toBe(true);
  });

  it('generates a valid deterministic test template for portals', () => {
    const template = generateMockTestSuite('src/sim/spatial/portals.ts', rootDir);
    expect(template).toContain("import { describe, expect, it } from 'vitest'");
    expect(template).toContain('createInitialWorld({ seed: 42 })');
    expect(template).toContain('findPortalAtPoint');
    expect(template).not.toContain('any');
  });

  it('runs testgen in mock mode, producing a test that passes vitest run', async () => {
    const tempOutput = 'tests/sim/auto-portals-testgen.test.ts';
    const config = parseTestgenArgs([
      'node', 'script.js',
      '--target', 'src/sim/spatial/portals.ts',
      '--output', tempOutput,
      '--mock',
    ]);

    const result = await runTestgen(config, rootDir);
    expect(result.success).toBe(true);

    const fullTemp = path.join(rootDir, tempOutput);
    expect(fs.existsSync(fullTemp)).toBe(true);
    // Cleanup generated temp test
    fs.unlinkSync(fullTemp);
  });
});
