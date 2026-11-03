import fs from 'node:fs';
import path from 'node:path';
import type { CriticPrescription, TelemetryAnomaly } from './critic-sanity.js';

export interface DomainTargetRule {
  readonly domain: string;
  readonly keywords: readonly string[];
  readonly candidateFiles: readonly string[];
}

export const DOMAIN_TARGET_RULES: readonly DomainTargetRule[] = [
  {
    domain: 'GOVERNANCE_TOOLING',
    keywords: ['state machine', 'governance', 'tooling', 'devops'],
    candidateFiles: ['tests/scripts/update-state.ts', 'src/schemas/project-state.schema.ts'],
  },
  {
    domain: 'ECONOMY_SUPPLY',
    keywords: ['supply', 'commodity', 'scarcity', 'cascade'],
    candidateFiles: ['src/sim/systems/economy.system.ts', 'src/sim/systems/trade.system.ts'],
  },
  {
    domain: 'CHRONICLE_WITNESS',
    keywords: ['chronicle', 'rumor', 'witness'],
    candidateFiles: ['src/sim/systems/squad-witness.system.ts', 'src/sim/systems/dialogue-quest.system.ts'],
  },
  {
    domain: 'FORENSIC_CLUES',
    keywords: ['clue', 'investigation', 'journal', 'forensic'],
    candidateFiles: ['src/sim/systems/surgery.system.ts', 'src/sim/systems/stealth-acoustics.system.ts'],
  },
  {
    domain: 'TOPOGRAPHY_ATLAS',
    keywords: ['conduit', 'graph', 'topography', 'atlas'],
    candidateFiles: ['src/sim/spatial/generator.ts', 'src/sim/spatial/overworld-matrix.ts'],
  },
  {
    domain: 'PREFABS_LANDMARKS',
    keywords: ['landmark', 'prefab'],
    candidateFiles: ['src/sim/spatial/building-prefabs.ts', 'src/sim/spatial/generator.ts'],
  },
];

export const FALLBACK_DOMAIN_FILES: readonly string[] = [
  'src/sim/core/simulation-pipeline.ts',
  'src/sim/core/engine.ts',
];

export function resolvePhaseDomainTargetFiles(
  phaseOrPriority: number | string,
  titleOrRootDir?: string,
  optionalRootDir?: string,
): string[] {
  let text = '';
  let rootDir = '';

  if (typeof phaseOrPriority === 'number') {
    text = `Phase ${phaseOrPriority}: ${titleOrRootDir ?? ''}`.toLowerCase();
    rootDir = optionalRootDir ?? path.resolve(import.meta.dirname, '../..');
  } else {
    text = phaseOrPriority.toLowerCase();
    rootDir = titleOrRootDir ?? path.resolve(import.meta.dirname, '../..');
  }

  let candidateFiles: readonly string[] = FALLBACK_DOMAIN_FILES;
  for (const rule of DOMAIN_TARGET_RULES) {
    if (rule.keywords.some((kw) => text.includes(kw))) {
      candidateFiles = rule.candidateFiles;
      break;
    }
  }

  const existing = candidateFiles.filter((f) => fs.existsSync(path.resolve(rootDir, f)));
  return existing.length > 0 ? existing : ['src/sim/core/engine.ts'];
}

export function collectTelemetryAnomalies(params: {
  totalProjectionLeaks: number;
  unwiredCount: number;
  topNearCap?: { file: string; lines: number } | undefined;
}): TelemetryAnomaly[] {
  const anomalies: TelemetryAnomaly[] = [];
  if (params.totalProjectionLeaks > 0) {
    anomalies.push({
      metricKey: 'uiProjectionLeaks',
      observedValue: params.totalProjectionLeaks,
      expectedThreshold: 0,
      severity: 'P0_BLOCKER',
    });
  }
  if (params.unwiredCount > 0) {
    anomalies.push({
      metricKey: 'unwiredCommands',
      observedValue: params.unwiredCount,
      expectedThreshold: 0,
      severity: 'P1_HIGH',
    });
  }
  if (params.topNearCap) {
    anomalies.push({
      metricKey: 'modularityHotspot',
      observedValue: `${params.topNearCap.file}:${params.topNearCap.lines}`,
      expectedThreshold: '230 lines',
      severity: 'P2_MEDIUM',
    });
  }
  return anomalies;
}

export interface DomainPrescriptionContext {
  readonly phaseNumber: number;
  readonly nextPriority: string;
  readonly rootDir: string;
  readonly unwiredCommands: readonly string[];
  readonly topNearCapFile?: string | undefined;
  readonly defaultVerificationTest: string;
}

export function buildDomainPrescriptions(ctx: DomainPrescriptionContext): CriticPrescription[] {
  return [
    {
      id: 'P1',
      category: 'UNREACHABLE_MECHANIC',
      title: `${ctx.nextPriority.split(':')[0]?.replace(/\*+/g, '').trim() || 'Next Roadmap Phase'}`,
      targetFiles: resolvePhaseDomainTargetFiles(ctx.nextPriority, ctx.rootDir),
      affectedSchemas: ['src/schemas/commands.schema.ts'],
      implementationDirective: `Focus core systems development on ${ctx.nextPriority} resolving unwiredCommands and telemetry anomalies.`,
      verificationTestFile: ctx.defaultVerificationTest,
      citedAnomalyMetricKey: 'unwiredCommands',
    },
    {
      id: 'P2',
      category: 'SIM_BALANCE',
      title: 'Expand Playtest Serializer Command Surface',
      targetFiles: ['tests/scripts/playtester-serializer.ts'],
      affectedSchemas: ['src/schemas/commands.schema.ts'],
      implementationDirective: `Wire unwired commands (${ctx.unwiredCommands.slice(0, 4).join(', ')}) to reduce unwiredCommands count.`,
      verificationTestFile: ctx.defaultVerificationTest,
      citedAnomalyMetricKey: 'unwiredCommands',
    },
    {
      id: 'P3',
      category: 'MODULE_SPLIT',
      title: 'Modularity Guard & File Splitting',
      targetFiles: [ctx.topNearCapFile ?? 'src/sim/core/engine.ts'],
      affectedSchemas: [],
      implementationDirective: `Monitor and pre-split near-cap modules like ${ctx.topNearCapFile ?? 'engine'} to resolve modularityHotspot anomaly.`,
      verificationTestFile: ctx.defaultVerificationTest,
      citedAnomalyMetricKey: 'modularityHotspot',
    },
  ];
}
