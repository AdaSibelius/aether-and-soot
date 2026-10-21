import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  extractHandledCases,
  findMissingEvents,
  generateMockCase,
  injectCasesIntoFormatter,
  parseChroniclerArgs,
  runChronicler,
} from '../scripts/hermes-chronicler.js';

describe('Hermes SimEvent Chronicler (Phase 34)', () => {
  const rootDir = path.resolve(__dirname, '../..');

  it('parses CLI arguments with Tier 2 fast model defaults', () => {
    const config = parseChroniclerArgs(['node', 'script.js', '--target', 'custom/Path.ts', '--dry-run', '--mock']);
    expect(config.target).toBe('custom/Path.ts');
    expect(config.dryRun).toBe(true);
    expect(config.mock).toBe(true);
    expect(config.model).toMatch(/hermes3:8b|hermes-agent/);
  });

  it('extracts handled cases and finds unhandled events accurately', () => {
    const mockFormatter = `
      switch (ev.type) {
        case 'ENTITY_MOVED':
          return 'moved';
        case 'LIMB_DAMAGED':
          return 'damaged';
      }
    `;
    const handled = extractHandledCases(mockFormatter);
    expect(handled.has('ENTITY_MOVED')).toBe(true);
    expect(handled.has('LIMB_DAMAGED')).toBe(true);
    expect(handled.has('STEAM_VENTED')).toBe(false);

    const missing = findMissingEvents(['ENTITY_MOVED', 'LIMB_DAMAGED', 'STEAM_VENTED'], handled);
    expect(missing).toEqual(['STEAM_VENTED']);
  });

  it('generates a valid Victorian mock case string', () => {
    const generated = generateMockCase('PNEUMATIC_LIFT_ARRIVED');
    expect(generated).toContain("case 'PNEUMATIC_LIFT_ARRIVED':");
    expect(generated).toContain('[T${ev.turn}] Victorian chronicle: Pneumatic Lift Arrived');
  });

  it('injects new cases cleanly into existing formatter structure', () => {
    const original = `export function formatEventMessage(ev: SimEvent): string {\n  switch (ev.type) {\n    case 'EVENT_A':\n      return 'a';\n  }\n}`;
    const newCase = `    case 'EVENT_B':\n      return 'b';`;
    const updated = injectCasesIntoFormatter(original, [newCase]);

    expect(updated).toContain("case 'EVENT_A':");
    expect(updated).toContain("case 'EVENT_B':");
    expect(updated.indexOf("case 'EVENT_B':")).toBeGreaterThan(updated.indexOf("case 'EVENT_A':"));
  });

  it('runs chronicler in dry-run mode against real EventFormatter without throwing', async () => {
    const config = parseChroniclerArgs(['node', 'script.js', '--mock', '--dry-run']);
    const result = await runChronicler(config, rootDir);
    expect(result.missing).toBeDefined();
    expect(result.injectedCount).toBe(0);
  });
});
