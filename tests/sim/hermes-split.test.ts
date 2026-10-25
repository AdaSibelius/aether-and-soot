import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  extractFunctionBlock,
  listSplitCandidates,
  parseSplitArgs,
  performFileSplit,
  reconcileTargetImports,
  runSplit,
} from '../scripts/hermes-split.js';

describe('Hermes Modularity Ceiling Splitter (Phase 36)', () => {
  const rootDir = path.resolve(__dirname, '../..');

  it('parses CLI arguments with Tier 1 code model defaults', () => {
    const config = parseSplitArgs([
      'node', 'script.js',
      '--source', 'src/sim/systems/test.ts',
      '--target', 'src/sim/systems/test-sub.ts',
      '--extract', 'funcA,funcB',
      '--dry-run',
      '--mock',
    ]);
    expect(config.source).toBe('src/sim/systems/test.ts');
    expect(config.target).toBe('src/sim/systems/test-sub.ts');
    expect(config.extract).toEqual(['funcA', 'funcB']);
    expect(config.dryRun).toBe(true);
    expect(config.mock).toBe(true);
    expect(config.model).toMatch(/gemma4:12b-extended|hermes/);
  });

  it('extracts function blocks accurately using brace-depth tracking', () => {
    const sample = `
      import { A } from './a.js';
      export function targetFunc(x: number): string {
        const str = "{not a real brace}";
        if (x > 0) {
          return "positive";
        }
        return "zero";
      }
      export function keepFunc(): void {}
    `;

    const extracted = extractFunctionBlock(sample, 'targetFunc');
    expect(extracted).toBeDefined();
    expect(extracted?.block).toContain('export function targetFunc');
    expect(extracted?.block).toContain('return "zero";');
    expect(extracted?.block).not.toContain('keepFunc');
  });

  it('reconciles target imports based on referenced symbols', () => {
    const sourceImports = [
      "import { A, B } from './alpha.js';",
      "import { C } from './gamma.js';",
    ];
    const code = 'export function useA(x: A): void { console.log(x); }';
    const reconciled = reconcileTargetImports(sourceImports, code, './sub.ts');

    expect(reconciled).toHaveLength(1);
    expect(reconciled[0]).toBe("import { A } from './alpha.js';");
  });

  it('performs file split and generates barrel re-exports', () => {
    const source = `
import { Foo } from './foo.js';
export function toExtract(f: Foo): string { return 'done'; }
export function toKeep(): number { return 42; }
    `.trim();

    const result = performFileSplit(source, './extracted.ts', ['toExtract']);
    expect(result.extractedCount).toBe(1);
    expect(result.updatedSource).toContain("export { toExtract } from './extracted.js';");
    expect(result.updatedSource).toContain('toKeep');
    expect(result.updatedSource).not.toContain("return 'done';");
    expect(result.targetContent).toContain("import { Foo } from './foo.js';");
    expect(result.targetContent).toContain('export function toExtract');
  });

  it('executes a safe dry-run against economy.system.ts without modifying disk', async () => {
    const config = parseSplitArgs([
      'node', 'script.js',
      '--source', 'src/sim/systems/economy-macro.system.ts',
      '--target', 'src/sim/systems/economy-temp.system.ts',
      '--extract', 'advanceDistrictEconomyMacroTick',
      '--dry-run',
    ]);

    const result = await runSplit(config, rootDir);
    expect(result.sourceLinesBefore).toBeGreaterThan(80);
    expect(result.sourceLinesAfter).toBeLessThan(result.sourceLinesBefore);
    expect(result.extractedCount).toBe(1);
  });

  it('lists candidates with start and end line ranges', () => {
    const sample = `
      import { A } from './a.js';
      export function funcOne(): void {}
      export const funcTwo = () => {};
    `;
    const candidates = listSplitCandidates(sample);
    expect(candidates.some((c) => c.name === 'funcOne')).toBe(true);
    expect(candidates.some((c) => c.name === 'funcTwo')).toBe(true);
  });

  it('splits TSX Preact components and normalizes .js import specifiers', () => {
    const tsxSource = `
import { h } from 'preact';
import { LimbSlotCard } from './LimbSlotCard.js';

export function GraftSubPanel(props: { title: string }) {
  return <div><LimbSlotCard /></div>;
}

export function MainWindow() {
  return <div><GraftSubPanel title="test" /></div>;
}
    `.trim();

    const result = performFileSplit(tsxSource, './GraftSubPanel.tsx', ['GraftSubPanel']);
    expect(result.extractedCount).toBe(1);
    expect(result.updatedSource).toContain("export { GraftSubPanel } from './GraftSubPanel.js';");
    expect(result.updatedSource).toContain("import { GraftSubPanel } from './GraftSubPanel.js';");
    expect(result.targetContent).toContain("import { LimbSlotCard } from './LimbSlotCard.js';");
    expect(result.targetContent).toContain('export function GraftSubPanel');
  });
});
