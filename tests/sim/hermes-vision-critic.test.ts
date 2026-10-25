import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { createInitialWorld } from '../../src/sim/core/world.js';
import {
  parseVisionCriticArgs,
  runDeterministicLayoutAudit,
  runVisionCritic,
} from '../scripts/hermes-vision-critic.js';

describe('Phase UI-5: hermes-vision-critic pipeline', () => {
  it('parses CLI arguments correctly', () => {
    const config = parseVisionCriticArgs([
      'node',
      'hermes-vision-critic.ts',
      '--mock',
      '--model',
      'gemma4:12b-extended',
      '--output',
      'tests/artifacts/custom-vision.md',
    ]);

    expect(config.mock).toBe(true);
    expect(config.model).toBe('gemma4:12b-extended');
    expect(config.output).toBe('tests/artifacts/custom-vision.md');
  });

  it('runs deterministic layout audit across all 6 modals with zero defects', () => {
    const world = createInitialWorld({ seed: 42, width: 24, height: 24 });
    const audits = runDeterministicLayoutAudit(world);

    expect(audits.length).toBe(6);
    for (const audit of audits) {
      expect(audit.passed).toBe(true);
      expect(audit.clippingErrors).toEqual([]);
      expect(audit.unmappedGlyphs).toEqual([]);
      expect(audit.borderCollisions).toEqual([]);
    }
  });

  it('executes mock vision critic run and generates markdown audit artifact', async () => {
    const rootDir = process.cwd();
    const testOutputPath = 'tests/artifacts/test-vision-audit.md';
    const report = await runVisionCritic(
      {
        mock: true,
        model: 'gemma4:12b-extended',
        endpoint: 'http://localhost:11434/v1/chat/completions',
        output: testOutputPath,
      },
      rootDir,
    );

    expect(report.deterministicPassed).toBe(true);
    expect(report.visualScore).toBeGreaterThanOrEqual(90);
    expect(report.deterministicAudits.length).toBe(6);

    const fullPath = path.join(rootDir, testOutputPath);
    expect(fs.existsSync(fullPath)).toBe(true);

    const content = fs.readFileSync(fullPath, 'utf-8');
    expect(content).toContain('Deterministic Screen Boundary Audits');
    expect(content).toContain('WORKBENCH');
    expect(content).toContain('ATLAS');
    expect(content).toContain('EXCHANGE');
    expect(content).toContain('CODEX');
    expect(content).toContain('INVENTORY');
    expect(content).toContain('ANATOMY');

    // Clean up temporary test artifact
    fs.unlinkSync(fullPath);
  });
});
