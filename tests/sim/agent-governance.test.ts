import { describe, expect, it } from 'vitest';
import { auditAgentGovernance } from '../scripts/check-agent-governance.js';
import { ATLAS_GLYPHS } from '../../src/client/renderer/glyph-atlas.js';

describe('Phase GOV-2: Antigravity Agent Governance & Atlas Audit', () => {
  it('validates that .agents/rules/ has flat hierarchy and valid snake_case frontmatter', () => {
    const report = auditAgentGovernance(process.cwd());
    expect(report.rulesValid).toBe(true);
    expect(report.ruleChecks.length).toBeGreaterThanOrEqual(3);
    for (const rule of report.ruleChecks) {
      expect(rule.valid).toBe(true);
      expect(['glob', 'model_decision', 'always_on']).toContain(rule.trigger);
    }
  });

  it('validates that .agents/hooks.json conforms to Antigravity Go runtime schema', () => {
    const report = auditAgentGovernance(process.cwd());
    expect(report.hooksValid).toBe(true);
    expect(report.hookErrors).toEqual([]);
  });

  it('ensures ATLAS_GLYPHS includes essential UI navigation and punctuation glyphs', () => {
    const glyphSet = new Set(ATLAS_GLYPHS);
    const requiredGlyphs = ['…', '←', '→', '↑', '↓', 'Ω', '♦', '▬', '■', '□', '⚡', '⚠', '✓', '✗', '⚙', '☼'];
    for (const g of requiredGlyphs) {
      expect(glyphSet.has(g)).toBe(true);
    }
  });
});
