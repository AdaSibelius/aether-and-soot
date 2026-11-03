import fs from 'node:fs';
import path from 'node:path';
import { runPlaytestSession, PlaytestMetrics } from './llm-playtester.js';
import { PlaytestScenario } from './playtester-scenarios.js';
import {
  resolveModel,
  queryLocalOllama,
  resolveConnectionTelemetry,
} from './local-llm-config.js';
import { recordInferenceMetric } from './local-llm-ledger.js';
import {
  CriticAudit,
  CriticAuditSchema,
  CriticPrescription,
  CriticPrescriptionSchema,
  CriticSanityResult,
  TelemetryAnomaly,
  TelemetryAnomalySchema,
  verifyCriticSanity,
} from './critic-sanity.js';
import {
  CommandCoverage,
  auditCommandCoverage,
  auditModularityHotspots,
  buildHandoffPrompt,
  formatCriticReport,
} from './critic-report.js';
import { CriticConfig, parseCriticArgs } from './critic-config.js';
import {
  DOMAIN_TARGET_RULES,
  buildDomainPrescriptions,
  collectTelemetryAnomalies,
  resolvePhaseDomainTargetFiles,
} from './critic-domain-targets.js';

export {
  CriticAuditSchema, CriticPrescriptionSchema, TelemetryAnomalySchema, verifyCriticSanity,
  auditCommandCoverage, auditModularityHotspots, buildHandoffPrompt, formatCriticReport,
  parseCriticArgs, resolvePhaseDomainTargetFiles, buildDomainPrescriptions, DOMAIN_TARGET_RULES,
};
export type { CriticAudit, CriticPrescription, CriticSanityResult, TelemetryAnomaly, CommandCoverage, CriticConfig };

export async function runCritic(config: CriticConfig, rootDir: string): Promise<string> {
  const aggregatedHistogram: Record<string, number> = {};
  let totalTurns = 0;
  let totalProjectionLeaks = 0;

  if (!config.skipPlaytest) {
    const scenarios: PlaytestScenario[] = ['explore', 'combat', 'economy', 'transit'];
    console.log(`[hermes-critic] Executing 4-scenario playtest sweep (${scenarios.join(', ')})...`);
    for (const scenario of scenarios) {
      const res: PlaytestMetrics = await runPlaytestSession({
        mock: config.mock,
        maxTurns: 15,
        seed: 42,
        endpoint: config.endpoint,
        model: config.playtestModel ?? resolveModel('tier3'),
        reportPath: path.join(rootDir, 'tests/artifacts/playtest-report.md'),
        scenario,
      });
      totalTurns += res.turnsSurvived;
      totalProjectionLeaks += res.uiProjectionLeaks ?? 0;
      for (const [cmd, count] of Object.entries(res.commandHistogram ?? {})) {
        aggregatedHistogram[cmd] = (aggregatedHistogram[cmd] ?? 0) + count;
      }
    }
  }

  const coverage = auditCommandCoverage(rootDir, aggregatedHistogram);
  const hotspots = auditModularityHotspots(rootDir, 230);
  const roadmapPath = path.join(rootDir, 'ROADMAP.md');
  const nextPriority = fs.existsSync(roadmapPath)
    ? (fs.readFileSync(roadmapPath, 'utf-8').match(/^-\s*\[\s*\]\s*(.*)$/m)?.[1]?.trim() ?? 'All scheduled phases completed')
    : 'All scheduled phases completed';

  const phaseMatch = nextPriority.match(/Phase\s+(\d+)/i);
  const phaseNumber = phaseMatch?.[1] ? Number(phaseMatch[1]) : 51;

  const telemetry = await resolveConnectionTelemetry({
    mock: config.mock,
    endpoint: config.endpoint,
    model: config.model,
    temperature: 0.1,
    enforceJsonSchema: true,
  });

  const topNearCap = hotspots.find((h) => h.lines >= 240);
  const anomalies = collectTelemetryAnomalies({
    totalProjectionLeaks,
    unwiredCount: coverage.unwired.length,
    topNearCap,
  });

  let audit: CriticAudit | undefined;
  let sanityResult: CriticSanityResult | undefined;

  if (!config.mock && telemetry.llmExecutionMode === 'LIVE_INFERENCE') {
    try {
      const prompt = `Return JSON satisfying CriticAuditSchema for Phase ${phaseNumber}:\n` +
        `Active commands: ${coverage.active.join(',')}\n` +
        `Unwired commands: ${coverage.unwired.slice(0, 8).join(',')}\n` +
        `Next priority: ${nextPriority}\n` +
        `Near-cap files: ${hotspots.slice(0, 3).map((h) => `${h.file}:${h.lines}`).join(',')}\n` +
        `Required JSON format: { "phaseNumber": ${phaseNumber}, "telemetryAnomalies": [{ "metricKey": "unwiredCommands", "observedValue": "${coverage.unwired.length}", "expectedThreshold": "0", "severity": "P1_HIGH" }], "prescriptions": [{ "id": "P1", "category": "UNREACHABLE_MECHANIC", "title": "Phase ${phaseNumber}", "targetFiles": ["src/sim/core/engine.ts"], "affectedSchemas": ["domain-commands.schema.ts"], "implementationDirective": "Directive text", "verificationTestFile": "tests/sim/determinism.test.ts", "citedAnomalyMetricKey": "unwiredCommands" }] }`;

      const content = await queryLocalOllama(prompt, {
        model: config.model,
        endpoint: config.endpoint,
        systemPrompt: 'You are the lead architectural evaluator for Aether & Soot. Return ONLY valid JSON satisfying CriticAuditSchema. In each prescription, cite an exact metricKey from telemetryAnomalies in citedAnomalyMetricKey. Do not include markdown codeblocks or prose.',
        temperature: 0.1,
        enforceJsonSchema: true,
        task: 'hermes-critic',
        tier: 'tier1',
      });

      const parsedJson = JSON.parse(content);
      audit = CriticAuditSchema.parse(parsedJson);
      sanityResult = verifyCriticSanity(audit, rootDir);
    } catch {
      console.error('FATAL: Local LLM connection failed or schema invalid. Aborting to prevent paid token burn.');
      process.exit(1);
    }
  } else {
    recordInferenceMetric({
      timestamp: new Date().toISOString(),
      task: 'hermes-critic',
      tier: 'tier1',
      model: config.model,
      prompt_tokens: 0,
      completion_tokens: 0,
      duration_ms: 0,
      retry_count: 0,
      success: true,
      cache_hit: true,
    });
    const defaultVerificationTest = fs.existsSync(path.resolve(rootDir, 'tests/sim/determinism.test.ts'))
      ? 'tests/sim/determinism.test.ts'
      : 'tests/sim/hermes-critic.test.ts';

    audit = {
      phaseNumber,
      telemetryAnomalies: anomalies,
      prescriptions: buildDomainPrescriptions({
        phaseNumber,
        nextPriority,
        rootDir,
        unwiredCommands: coverage.unwired,
        topNearCapFile: topNearCap?.file,
        defaultVerificationTest,
      }),
    };
    sanityResult = verifyCriticSanity(audit, rootDir);
  }

  const topUnwired = coverage.unwired.slice(0, 4).map((c) => `\`${c}\``).join(', ') || 'all mapped';
  const nearCap = hotspots.find((h) => h.lines >= 245);
  const topHotspot = nearCap ? `\`${nearCap.file}\` (${nearCap.lines} lines)` : (hotspots[0] ? `\`${hotspots[0].file}\` (${hotspots[0].lines} lines)` : 'modular decoupling maintained');

  const leakPenalty = totalProjectionLeaks * 15;
  const unwiredPenalty = Math.min(25, coverage.unwired.length * 2);
  const hotspotPenalty = Math.min(15, hotspots.filter((h) => h.lines >= 240).length * 3);
  const score = audit?.score ?? Math.max(0, Math.min(100, 100 - leakPenalty - unwiredPenalty - hotspotPenalty));

  let report = formatCriticReport({
    score,
    hotspots,
    coverage,
    histogram: aggregatedHistogram,
    turnsSurvived: totalTurns,
    nextPriority,
    telemetry,
    audit,
    sanityResult,
  });

  if (!report.includes('## 6. Next-Phase Handoff Prompt')) {
    report = report.trim() + '\n\n' + buildHandoffPrompt(nextPriority, topHotspot, topUnwired) + '\n';
  }

  const outPath = path.resolve(rootDir, config.output);
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, report, 'utf-8');
  console.log(`[hermes-critic] Whole-game benchmark audit written to ${outPath}`);
  return report;
}

if (process.argv[1]?.endsWith('hermes-critic.ts')) {
  const root = path.resolve(import.meta.dirname, '../..');
  const config = parseCriticArgs(process.argv);
  runCritic(config, root).catch((err) => {
    console.error(`[hermes-critic] Error: ${err instanceof Error ? err.message : String(err)}`);
    process.exit(1);
  });
}
