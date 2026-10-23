import fs from 'node:fs';
import path from 'node:path';
import { z } from 'zod';

export const TelemetryAnomalySeveritySchema = z.enum(['P0_BLOCKER', 'P1_HIGH', 'P2_MEDIUM']);
export type TelemetryAnomalySeverity = z.infer<typeof TelemetryAnomalySeveritySchema>;

export const TelemetryAnomalySchema = z.object({
  metricKey: z.string().min(1),
  observedValue: z.union([z.number(), z.string()]),
  expectedThreshold: z.union([z.number(), z.string()]),
  severity: TelemetryAnomalySeveritySchema,
});
export type TelemetryAnomaly = z.infer<typeof TelemetryAnomalySchema>;

export const PrescriptionCategorySchema = z.enum([
  'UI_UX_FRICTION',
  'SIM_BALANCE',
  'UNREACHABLE_MECHANIC',
  'TEST_DEPTH',
  'MODULE_SPLIT',
]);
export type PrescriptionCategory = z.infer<typeof PrescriptionCategorySchema>;

export const CriticPrescriptionSchema = z.object({
  id: z.string().min(1),
  category: PrescriptionCategorySchema,
  title: z.string().min(1),
  targetFiles: z.array(z.string()),
  affectedSchemas: z.array(z.string()),
  implementationDirective: z.string().min(1),
  verificationTestFile: z.string().min(1),
  citedAnomalyMetricKey: z.string().optional(),
});
export type CriticPrescription = z.infer<typeof CriticPrescriptionSchema>;

export const CriticAuditSchema = z.object({
  phaseNumber: z.number().int(),
  telemetryAnomalies: z.array(TelemetryAnomalySchema),
  prescriptions: z.array(CriticPrescriptionSchema),
  score: z.number().optional(),
  summary: z.string().optional(),
  systemicAnalysis: z.string().optional(),
});
export type CriticAudit = z.infer<typeof CriticAuditSchema>;

export interface QuarantinedPrescription {
  readonly prescription: CriticPrescription;
  readonly reason: string;
}

export interface CriticSanityResult {
  readonly valid: boolean;
  readonly validPrescriptions: CriticPrescription[];
  readonly quarantinedPrescriptions: QuarantinedPrescription[];
  readonly anomalies: TelemetryAnomaly[];
}

export function parseCompletedPhases(repoRoot: string): Set<number> {
  const completed = new Set<number>();
  const statePath = path.resolve(repoRoot, 'STATE.md');
  if (fs.existsSync(statePath)) {
    const content = fs.readFileSync(statePath, 'utf-8');
    const commitMatches = content.matchAll(/(?:Implement|Completed)\s+Phase\s+(\d+)/gi);
    for (const m of commitMatches) {
      if (m[1]) completed.add(Number(m[1]));
    }
  }
  const roadmapPath = path.resolve(repoRoot, 'ROADMAP.md');
  if (fs.existsSync(roadmapPath)) {
    const content = fs.readFileSync(roadmapPath, 'utf-8');
    const checkedMatches = content.matchAll(/^-\s*\[x\]\s*\*\*Phase\s*(\d+):/gim);
    for (const m of checkedMatches) {
      if (m[1]) completed.add(Number(m[1]));
    }
  }
  return completed;
}

export function extractReportAnomalies(repoRoot: string, anomalies: TelemetryAnomaly[]): Set<string> {
  const keys = new Set<string>();
  for (const a of anomalies) {
    keys.add(a.metricKey.toLowerCase());
  }

  const reportPath = path.resolve(repoRoot, 'tests/artifacts/playtest-report.md');
  if (fs.existsSync(reportPath)) {
    const content = fs.readFileSync(reportPath, 'utf-8');
    const metricMatches = content.matchAll(/\|\s*\*\*([^*]+)\*\*\s*\|\s*([^|]+)\|/g);
    for (const m of metricMatches) {
      const metricName = m[1]?.trim();
      if (metricName && metricName !== 'Metric') {
        keys.add(metricName.toLowerCase());
        const camel = metricName
          .replace(/[^a-zA-Z0-9 ]/g, '')
          .split(/\s+/)
          .map((w, i) => (i === 0 ? w.toLowerCase() : w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()))
          .join('');
        if (camel) keys.add(camel.toLowerCase());
      }
    }
    const histogramMatches = content.matchAll(/\|\s*`([A-Z0-9_]+)`\s*\|\s*(\d+)\s*\|/g);
    for (const m of histogramMatches) {
      if (m[1]) keys.add(m[1].toLowerCase());
    }
  }
  return keys;
}

const FORBIDDEN_SIM_PATTERNS: ReadonlyArray<{ pattern: RegExp; reason: string }> = [
  { pattern: /import\s+.*from\s+['"].*client\//i, reason: 'src/sim/ must never import from src/client/' },
  { pattern: /from\s+['"]pixi\.js['"]/i, reason: 'src/sim/ must never import pixi.js' },
  { pattern: /from\s+['"]preact['"]/i, reason: 'src/sim/ must never import preact' },
  { pattern: /\bMath\.random\s*\(/i, reason: 'Use SeededRNG instead of Math.random() in src/sim/' },
  { pattern: /\bDate\.now\s*\(/i, reason: 'Date.now() is forbidden in deterministic src/sim/' },
  { pattern: /\bwindow\b|\bdocument\b/i, reason: 'Browser globals are forbidden in src/sim/' },
];

export function verifyCriticSanity(audit: CriticAudit, repoRoot: string): CriticSanityResult {
  const validPrescriptions: CriticPrescription[] = [];
  const quarantinedPrescriptions: QuarantinedPrescription[] = [];
  const completedPhases = parseCompletedPhases(repoRoot);
  const knownAnomalies = extractReportAnomalies(repoRoot, audit.telemetryAnomalies);

  for (const prescription of audit.prescriptions) {
    let quarantinedReason: string | undefined;

    // Check 1: Non-existent file paths in src/, data/, or tests/
    const allPaths = [...prescription.targetFiles, prescription.verificationTestFile];
    if (prescription.targetFiles.length === 0) {
      quarantinedReason = `Prescription '${prescription.id}' contains no target files`;
    } else {
      for (const f of allPaths) {
        const trimmed = f.trim();
        if (!trimmed.startsWith('src/') && !trimmed.startsWith('data/') && !trimmed.startsWith('tests/')) {
          quarantinedReason = `Prescription '${prescription.id}' references path outside src/, data/, tests/: ${trimmed}`;
          break;
        }
        const absPath = path.resolve(repoRoot, trimmed);
        if (!fs.existsSync(absPath)) {
          quarantinedReason = `Prescription '${prescription.id}' references non-existent file path: ${trimmed}`;
          break;
        }
      }
    }

    // Check 2: Proposing cross-boundary imports prohibited by check-boundaries.ts
    if (!quarantinedReason) {
      const combinedText = `${prescription.implementationDirective}\n${prescription.title}`;
      const targetsSimOrSchema = prescription.targetFiles.some(
        (f) => f.startsWith('src/sim/') || f.startsWith('src/schemas/'),
      );
      if (targetsSimOrSchema) {
        for (const rule of FORBIDDEN_SIM_PATTERNS) {
          if (rule.pattern.test(combinedText)) {
            quarantinedReason = `Prescription '${prescription.id}' proposes cross-boundary violation (${rule.reason})`;
            break;
          }
        }
      }
      if (!quarantinedReason && /import\s+.*client.*into\s+.*(sim|schemas)/i.test(combinedText)) {
        quarantinedReason = `Prescription '${prescription.id}' proposes cross-boundary import of client into simulation`;
      }
    }

    // Check 3: Failing to cite a concrete anomaly from playtest-report.md
    if (!quarantinedReason) {
      let citesAnomaly = false;
      if (prescription.citedAnomalyMetricKey && knownAnomalies.has(prescription.citedAnomalyMetricKey.toLowerCase())) {
        citesAnomaly = true;
      } else {
        const fullText = `${prescription.implementationDirective} ${prescription.title} ${prescription.id}`.toLowerCase();
        for (const k of knownAnomalies) {
          if (k.length >= 3 && fullText.includes(k)) {
            citesAnomaly = true;
            break;
          }
        }
      }
      if (!citesAnomaly) {
        quarantinedReason = `Prescription '${prescription.id}' fails to cite a concrete anomaly from playtest-report.md`;
      }
    }

    // Check 4: Duplicating a phase already marked completed in STATE.md
    if (!quarantinedReason) {
      if (completedPhases.has(audit.phaseNumber)) {
        quarantinedReason = `Prescription '${prescription.id}' duplicates completed Phase ${audit.phaseNumber} from STATE.md`;
      } else {
        const phaseMatch = `${prescription.title} ${prescription.implementationDirective}`.match(/Phase\s+(\d+)/i);
        if (phaseMatch?.[1]) {
          const referencedPhase = Number(phaseMatch[1]);
          if (completedPhases.has(referencedPhase)) {
            quarantinedReason = `Prescription '${prescription.id}' duplicates completed Phase ${referencedPhase} from STATE.md`;
          }
        }
      }
    }

    if (quarantinedReason) {
      quarantinedPrescriptions.push({ prescription, reason: quarantinedReason });
    } else {
      validPrescriptions.push(prescription);
    }
  }

  return {
    valid: quarantinedPrescriptions.length === 0 && validPrescriptions.length > 0,
    validPrescriptions,
    quarantinedPrescriptions,
    anomalies: audit.telemetryAnomalies,
  };
}
