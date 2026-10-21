import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  auditCommandCoverage,
  auditModularityHotspots,
  parseCriticArgs,
  runCritic,
} from '../scripts/hermes-critic.js';

describe('Hermes Benchmark & Whole-Game Critic', () => {
  const rootDir = path.resolve(__dirname, '../..');

  it('parses CLI arguments correctly', () => {
    const config = parseCriticArgs([
      'node', 'script.js',
      '--skip-playtest',
      '--mock',
      '--model', 'gemma4:12b-extended',
      '--output', 'tests/artifacts/test-critic.md',
    ]);
    expect(config.skipPlaytest).toBe(true);
    expect(config.mock).toBe(true);
    expect(config.model).toBe('gemma4:12b-extended');
    expect(config.output).toBe('tests/artifacts/test-critic.md');
  });

  it('audits command coverage and partitions active, dormant, and unwired commands', () => {
    const fakeHistogram = {
      MOVE_STEP: 10,
      ATTACK_ACTOR: 2,
    };
    const coverage = auditCommandCoverage(rootDir, fakeHistogram);
    expect(coverage.active).toContain('MOVE_STEP');
    expect(coverage.active).toContain('ATTACK_ACTOR');
    expect(coverage.dormant.length).toBeGreaterThan(0);
    expect(coverage.unwired.length).toBeGreaterThan(0);
  });

  it('scans modularity hotspots accurately against threshold', () => {
    const hotspots = auditModularityHotspots(rootDir, 230);
    expect(Array.isArray(hotspots)).toBe(true);
    for (const h of hotspots) {
      expect(h.lines).toBeGreaterThanOrEqual(230);
    }
  });

  it('executes runCritic in mock mode and generates all 5 mandatory sections', async () => {
    const testOut = path.join(rootDir, 'tests/artifacts/test-critic-audit.md');
    const config = parseCriticArgs(['node', 'script.js', '--mock', '--skip-playtest', '--output', testOut]);

    const report = await runCritic(config, rootDir);
    expect(fs.existsSync(testOut)).toBe(true);
    expect(report).toContain('## 1. Whole-Game Emergence & Readiness Score');
    expect(report).toContain('## 2. Architectural & Modularity Health');
    expect(report).toContain('## 3. Command Coverage & Dead-Mechanic Audit');
    expect(report).toContain('## 4. Systemic Depth & NPC Agency Critique');
    expect(report).toContain('## 5. Self-Directed Prescriptions for Next Phase');

    if (fs.existsSync(testOut)) fs.unlinkSync(testOut);
  });
});
