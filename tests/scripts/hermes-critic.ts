import fs from 'node:fs';
import path from 'node:path';
import { runPlaytestSession, PlaytestMetrics } from './llm-playtester.js';
import { PlaytestScenario } from './playtester-scenarios.js';
import {
  resolveEndpoint,
  resolveModel,
  queryLocalOllama,
  resolveConnectionTelemetry,
} from './local-llm-config.js';
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

export {
  CriticAuditSchema,
  CriticPrescriptionSchema,
  TelemetryAnomalySchema,
  verifyCriticSanity,
  auditCommandCoverage,
  auditModularityHotspots,
  buildHandoffPrompt,
  formatCriticReport,
};

export type {
  CriticAudit,
  CriticPrescription,
  CriticSanityResult,
  TelemetryAnomaly,
  CommandCoverage,
};

export interface CriticConfig {
  readonly skipPlaytest: boolean;
  readonly model: string;
  readonly endpoint: string;
  readonly mock: boolean;
  readonly output: string;
}

export function parseCriticArgs(argv: string[]): CriticConfig {
  const args = argv.slice(2);
  const getArg = (flag: string) => {
    const idx = args.indexOf(flag);
    return idx !== -1 && args[idx + 1] ? args[idx + 1] : undefined;
  };
  return {
    skipPlaytest: args.includes('--skip-playtest'),
    mock: args.includes('--mock'),
    model: getArg('--model') ?? resolveModel('tier1'),
    endpoint: getArg('--endpoint') ?? resolveEndpoint(),
    output: getArg('--output') ?? 'tests/artifacts/critic-audit.md',
  };
}

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
        model: resolveModel('tier3'),
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
    ? (fs.readFileSync(roadmapPath, 'utf-8').match(/^-\s*\[\s*\]\s*(.*)$/m)?.[1]?.trim() ?? 'Phase 50')
    : 'Phase 50';

  const phaseMatch = nextPriority.match(/Phase\s+(\d+)/i);
  const phaseNumber = phaseMatch?.[1] ? Number(phaseMatch[1]) : 50;

  const telemetry = await resolveConnectionTelemetry({
    mock: config.mock,
    endpoint: config.endpoint,
    model: config.model,
    temperature: 0.1,
    enforceJsonSchema: true,
  });

  const anomalies: TelemetryAnomaly[] = [];
  if (totalProjectionLeaks > 0) {
    anomalies.push({ metricKey: 'uiProjectionLeaks', observedValue: totalProjectionLeaks, expectedThreshold: 0, severity: 'P0_BLOCKER' });
  }
  if (coverage.unwired.length > 0) {
    anomalies.push({ metricKey: 'unwiredCommands', observedValue: coverage.unwired.length, expectedThreshold: 0, severity: 'P1_HIGH' });
  }
  const topNearCap = hotspots.find((h) => h.lines >= 240);
  if (topNearCap) {
    anomalies.push({ metricKey: 'modularityHotspot', observedValue: `${topNearCap.file}:${topNearCap.lines}`, expectedThreshold: '230 lines', severity: 'P2_MEDIUM' });
  }

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
      });

      const parsedJson = JSON.parse(content);
      audit = CriticAuditSchema.parse(parsedJson);
      sanityResult = verifyCriticSanity(audit, rootDir);
    } catch {
      console.error('FATAL: Local LLM connection failed or schema invalid. Aborting to prevent paid token burn.');
      process.exit(1);
    }
  } else {
    const defaultVerificationTest = fs.existsSync(path.resolve(rootDir, 'tests/sim/determinism.test.ts'))
      ? 'tests/sim/determinism.test.ts'
      : 'tests/sim/hermes-critic.test.ts';

    audit = {
      phaseNumber,
      telemetryAnomalies: anomalies,
      prescriptions: [
        {
          id: 'P1',
          category: 'UNREACHABLE_MECHANIC',
          title: `${nextPriority.split(':')[0]?.replace(/\*+/g, '').trim() || 'Next Roadmap Phase'}`,
          targetFiles: hotspots.slice(0, 1).map((h) => h.file).concat('src/sim/core/engine.ts').filter((f) => fs.existsSync(path.resolve(rootDir, f))),
          affectedSchemas: ['src/schemas/commands.schema.ts'],
          implementationDirective: `Focus core systems development on ${nextPriority} resolving unwiredCommands and telemetry anomalies.`,
          verificationTestFile: defaultVerificationTest,
          citedAnomalyMetricKey: 'unwiredCommands',
        },
        {
          id: 'P2',
          category: 'SIM_BALANCE',
          title: 'Expand Playtest Serializer Command Surface',
          targetFiles: ['tests/scripts/playtester-serializer.ts'],
          affectedSchemas: ['src/schemas/commands.schema.ts'],
          implementationDirective: `Wire unwired commands (${coverage.unwired.slice(0, 4).join(', ')}) to reduce unwiredCommands count.`,
          verificationTestFile: defaultVerificationTest,
          citedAnomalyMetricKey: 'unwiredCommands',
        },
        {
          id: 'P3',
          category: 'MODULE_SPLIT',
          title: 'Modularity Guard & File Splitting',
          targetFiles: [topNearCap?.file ?? 'src/sim/core/engine.ts'],
          affectedSchemas: [],
          implementationDirective: `Monitor and pre-split near-cap modules like ${topNearCap?.file ?? 'engine'} to resolve modularityHotspot anomaly.`,
          verificationTestFile: defaultVerificationTest,
          citedAnomalyMetricKey: 'modularityHotspot',
        },
      ],
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
