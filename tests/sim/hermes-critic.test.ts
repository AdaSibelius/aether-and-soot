import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  auditCommandCoverage,
  auditModularityHotspots,
  buildHandoffPrompt,
  parseCriticArgs,
  runCritic,
  CriticAudit,
  CriticAuditSchema,
  verifyCriticSanity,
} from '../scripts/hermes-critic.js';
import { checkEndpointHealth, getConnectionTelemetry } from '../scripts/local-llm-config.js';
import { writeReport } from '../scripts/playtest-report.js';

describe('Hermes Benchmark & Whole-Game Critic', () => {
  const rootDir = path.resolve(__dirname, '../..');

  it('parses CLI arguments correctly', () => {
    const config = parseCriticArgs([
      'node', 'script.js', '--skip-playtest', '--mock',
      '--model', 'gemma4:12b-extended', '--output', 'tests/artifacts/test-critic.md',
    ]);
    expect(config.skipPlaytest).toBe(true);
    expect(config.mock).toBe(true);
    expect(config.model).toBe('gemma4:12b-extended');
    expect(config.output).toBe('tests/artifacts/test-critic.md');
  });

  it('audits command coverage and partitions active, dormant, and unwired commands', () => {
    const coverage = auditCommandCoverage(rootDir, { MOVE_STEP: 10, ATTACK_ACTOR: 2 });
    expect(coverage.active).toContain('MOVE_STEP');
    expect(coverage.active).toContain('ATTACK_ACTOR');
    expect(coverage.dormant.length).toBeGreaterThan(0);
    expect(coverage.unwired.length).toBeGreaterThan(0);
  });

  it('scans modularity hotspots accurately against threshold in src only', () => {
    const hotspots = auditModularityHotspots(rootDir, 230);
    expect(Array.isArray(hotspots)).toBe(true);
    for (const h of hotspots) {
      expect(h.file.startsWith('src/')).toBe(true);
      expect(h.lines).toBeGreaterThanOrEqual(230);
    }
  });

  it('builds a copy-pasteable next-phase handoff prompt', () => {
    const prompt = buildHandoffPrompt('Phase 44', 'src/client/main.tsx (250 lines)', '`CLEAN_SPILL`');
    expect(prompt).toContain('## 6. Next-Phase Handoff Prompt');
    expect(prompt).toContain('Implement Phase 44');
    expect(prompt).toContain('src/client/main.tsx (250 lines)');
  });

  it('provides connection telemetry and endpoint health check with strict defaults', async () => {
    const mockTelemetry = getConnectionTelemetry({ mock: true });
    expect(mockTelemetry.llmExecutionMode).toBe('MOCK_FALLBACK');
    expect(mockTelemetry.temperature).toBe(0.1);
    expect(mockTelemetry.enforceJsonSchema).toBe(true);

    const liveTelemetry = getConnectionTelemetry({ mock: false, isHealthy: true });
    expect(liveTelemetry.llmExecutionMode).toBe('LIVE_INFERENCE');
    expect(liveTelemetry.temperature).toBe(0.1);

    const isHealthy = await checkEndpointHealth('http://127.0.0.1:99999/unreachable', 200);
    expect(isHealthy).toBe(false);
  });

  it('validates CriticAuditSchema structure and rejects non-conforming inputs', () => {
    const validAudit: CriticAudit = {
      phaseNumber: 50,
      telemetryAnomalies: [{ metricKey: 'steamCloudsDeployed', observedValue: 0, expectedThreshold: 5, severity: 'P1_HIGH' }],
      prescriptions: [{
        id: 'P1',
        category: 'UNREACHABLE_MECHANIC',
        title: 'Steam Hazard Deployment',
        targetFiles: ['src/sim/core/engine.ts'],
        affectedSchemas: ['src/schemas/commands.schema.ts'],
        implementationDirective: 'Fix steamCloudsDeployed anomaly by wiring steam vents.',
        verificationTestFile: 'tests/sim/determinism.test.ts',
        citedAnomalyMetricKey: 'steamCloudsDeployed',
      }],
    };
    expect(CriticAuditSchema.parse(validAudit).phaseNumber).toBe(50);
    expect(() => CriticAuditSchema.parse({ ...validAudit, phaseNumber: 50.5 })).toThrow();
    expect(() => CriticAuditSchema.parse({
      ...validAudit,
      telemetryAnomalies: [{ metricKey: 'k', observedValue: 0, expectedThreshold: 1, severity: 'INVALID' }],
    })).toThrow();
  });

  it('verifyCriticSanity accepts compliant prescriptions and quarantines non-existent file paths', () => {
    const audit: CriticAudit = {
      phaseNumber: 50,
      telemetryAnomalies: [{ metricKey: 'unwiredCommands', observedValue: 5, expectedThreshold: 0, severity: 'P1_HIGH' }],
      prescriptions: [
        {
          id: 'P1', category: 'SIM_BALANCE', title: 'Valid Tuning', targetFiles: ['src/sim/core/engine.ts'],
          affectedSchemas: [], implementationDirective: 'Address unwiredCommands anomaly in engine.',
          verificationTestFile: 'tests/sim/determinism.test.ts', citedAnomalyMetricKey: 'unwiredCommands',
        },
        {
          id: 'P2', category: 'MODULE_SPLIT', title: 'Hallucinated Path', targetFiles: ['src/sim/non_existent_file.ts'],
          affectedSchemas: [], implementationDirective: 'Address unwiredCommands anomaly in hallucinated file.',
          verificationTestFile: 'tests/sim/determinism.test.ts', citedAnomalyMetricKey: 'unwiredCommands',
        },
      ],
    };
    const res = verifyCriticSanity(audit, rootDir);
    expect(res.validPrescriptions).toHaveLength(1);
    expect(res.validPrescriptions[0]?.id).toBe('P1');
    expect(res.quarantinedPrescriptions).toHaveLength(1);
    expect(res.quarantinedPrescriptions[0]?.reason).toContain('non-existent file path');
  });

  it('verifyCriticSanity quarantines cross-boundary imports prohibited by check-boundaries.ts', () => {
    const audit: CriticAudit = {
      phaseNumber: 50,
      telemetryAnomalies: [{ metricKey: 'unwiredCommands', observedValue: 2, expectedThreshold: 0, severity: 'P1_HIGH' }],
      prescriptions: [{
        id: 'P1', category: 'UNREACHABLE_MECHANIC', title: 'Client Import In Sim', targetFiles: ['src/sim/core/engine.ts'],
        affectedSchemas: [], implementationDirective: "import { Something } from '../../client/ui/hud.js' to address unwiredCommands",
        verificationTestFile: 'tests/sim/determinism.test.ts', citedAnomalyMetricKey: 'unwiredCommands',
      }],
    };
    const res = verifyCriticSanity(audit, rootDir);
    expect(res.validPrescriptions).toHaveLength(0);
    expect(res.quarantinedPrescriptions).toHaveLength(1);
    expect(res.quarantinedPrescriptions[0]?.reason).toContain('cross-boundary violation');
  });

  it('verifyCriticSanity quarantines prescriptions failing to cite an anomaly or duplicating completed phases', () => {
    const audit: CriticAudit = {
      phaseNumber: 50,
      telemetryAnomalies: [{ metricKey: 'steamCloudsDeployed', observedValue: 0, expectedThreshold: 5, severity: 'P1_HIGH' }],
      prescriptions: [
        {
          id: 'P1', category: 'SIM_BALANCE', title: 'Uncited Hallucination', targetFiles: ['src/sim/core/engine.ts'],
          affectedSchemas: [], implementationDirective: 'Arbitrary refactoring without mentioning anomalies.',
          verificationTestFile: 'tests/sim/determinism.test.ts',
        },
        {
          id: 'P2', category: 'SIM_BALANCE', title: 'Phase 48 Multi-Room Building Prefab Engine Re-implementation', targetFiles: ['src/sim/core/engine.ts'],
          affectedSchemas: [], implementationDirective: 'Re-implement Phase 48 to address steamCloudsDeployed.',
          verificationTestFile: 'tests/sim/determinism.test.ts', citedAnomalyMetricKey: 'steamCloudsDeployed',
        },
      ],
    };
    const res = verifyCriticSanity(audit, rootDir);
    expect(res.validPrescriptions).toHaveLength(0);
    expect(res.quarantinedPrescriptions).toHaveLength(2);
    expect(res.quarantinedPrescriptions[0]?.reason).toContain('fails to cite a concrete anomaly');
    expect(res.quarantinedPrescriptions[1]?.reason).toContain('duplicates completed Phase');
  });

  it('records execution mode and telemetry in playtest and critic audit artifacts', async () => {
    const testCriticOut = path.join(rootDir, 'tests/artifacts/test-critic-audit.md');
    const config = parseCriticArgs(['node', 'script.js', '--mock', '--skip-playtest', '--output', testCriticOut]);
    const report = await runCritic(config, rootDir);

    expect(report).toContain('- **Execution Mode**: MOCK_FALLBACK (playtester-mock.ts)');
    expect(report).toContain('- **LLM Telemetry**: Mode: MOCK_FALLBACK | Temperature: 0.1 | Enforce JSON Schema: true');

    const testPlaytestOut = path.join(rootDir, 'tests/artifacts/test-playtest-report.md');
    writeReport(
      {
        mock: true, maxTurns: 10, seed: 42, endpoint: 'http://localhost:11434',
        model: 'test-model', reportPath: testPlaytestOut, scenario: 'explore',
      },
      {
        turnsSurvived: 10, totalDecibels: 0, alertTransitions: { investigating: 0, combat: 0 },
        steamCloudsDeployed: 0, trapsTriggered: 0, hostilesAttacked: 0, attackHits: 0, attackMisses: 0,
        damageDealt: 0, damageTaken: 0, itemsAcquired: 0, itemsUsed: 0, transitionsCompleted: 0,
        finalBloodPct: 100, uniqueTilesVisited: 5, commandHistogram: { MOVE: 10 },
      },
    );

    const playtestContent = fs.readFileSync(testPlaytestOut, 'utf-8');
    expect(playtestContent).toContain('playtester-mock.ts');
    expect(playtestContent).toContain('MOCK_FALLBACK');
    expect(playtestContent).toContain('- **LLM Telemetry**: Mode: MOCK_FALLBACK | Temperature: 0.1 | Enforce JSON Schema: true');

    if (fs.existsSync(testCriticOut)) fs.unlinkSync(testCriticOut);
    if (fs.existsSync(testPlaytestOut)) fs.unlinkSync(testPlaytestOut);
  });
});
