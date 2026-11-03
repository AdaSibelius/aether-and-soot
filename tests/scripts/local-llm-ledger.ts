import fs from 'node:fs';
import path from 'node:path';
import { z } from 'zod';

export const InferenceLedgerEntrySchema = z.object({
  timestamp: z.string(),
  task: z.string(),
  tier: z.string(),
  model: z.string(),
  prompt_tokens: z.number().int().nonnegative(),
  completion_tokens: z.number().int().nonnegative(),
  duration_ms: z.number().nonnegative(),
  retry_count: z.number().int().nonnegative(),
  success: z.boolean(),
  cache_hit: z.boolean().default(false),
});

export type InferenceLedgerInput = z.input<typeof InferenceLedgerEntrySchema>;
export type InferenceLedgerEntry = z.output<typeof InferenceLedgerEntrySchema>;

export const DEFAULT_LEDGER_PATH = path.resolve(
  import.meta.dirname,
  '../artifacts/inference-ledger.jsonl',
);

export function recordInferenceMetric(
  entry: InferenceLedgerInput,
  ledgerPath: string = DEFAULT_LEDGER_PATH,
): InferenceLedgerEntry {
  const validated = InferenceLedgerEntrySchema.parse(entry);
  const dir = path.dirname(ledgerPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.appendFileSync(ledgerPath, `${JSON.stringify(validated)}\n`, 'utf-8');
  return validated;
}

export function clearInferenceLedger(ledgerPath: string = DEFAULT_LEDGER_PATH): void {
  if (fs.existsSync(ledgerPath)) {
    fs.unlinkSync(ledgerPath);
  }
}

export interface TierSummary {
  readonly entries: number;
  readonly promptTokens: number;
  readonly completionTokens: number;
  readonly totalTokens: number;
  readonly successRatePct: number;
  readonly averageDurationMs: number;
  readonly estimatedCloudSavingsUsd: number;
}

export interface InferenceLedgerSummary {
  readonly totalEntries: number;
  readonly totalPromptTokens: number;
  readonly totalCompletionTokens: number;
  readonly totalTokens: number;
  readonly totalDurationMs: number;
  readonly averageDurationMs: number;
  readonly successRatePct: number;
  readonly estimatedCloudSavingsUsd: number;
  readonly byTier: Record<string, TierSummary>;
}

export function computeCloudSavings(promptTokens: number, completionTokens: number): number {
  const usd = (promptTokens * 3.0 + completionTokens * 15.0) / 1_000_000;
  return Math.round(usd * 100) / 100;
}

export function getInferenceLedgerSummary(
  ledgerPath: string = DEFAULT_LEDGER_PATH,
): InferenceLedgerSummary {
  if (!fs.existsSync(ledgerPath)) {
    return {
      totalEntries: 0,
      totalPromptTokens: 0,
      totalCompletionTokens: 0,
      totalTokens: 0,
      totalDurationMs: 0,
      averageDurationMs: 0,
      successRatePct: 0,
      estimatedCloudSavingsUsd: 0,
      byTier: {},
    };
  }

  const raw = fs.readFileSync(ledgerPath, 'utf-8');
  const lines = raw.split('\n').filter((l) => l.trim().length > 0);

  let totalPrompt = 0;
  let totalCompletion = 0;
  let totalDuration = 0;
  let successCount = 0;
  const byTier: Record<
    string,
    { entries: number; promptTokens: number; completionTokens: number; successes: number; duration: number }
  > = {};

  let validCount = 0;
  for (const line of lines) {
    const parseRes = InferenceLedgerEntrySchema.safeParse(JSON.parse(line));
    if (!parseRes.success) continue;
    const item = parseRes.data;

    validCount++;
    totalPrompt += item.prompt_tokens;
    totalCompletion += item.completion_tokens;
    totalDuration += item.duration_ms;
    if (item.success) successCount++;

    const tierStat = (byTier[item.tier] ??= {
      entries: 0,
      promptTokens: 0,
      completionTokens: 0,
      successes: 0,
      duration: 0,
    });
    tierStat.entries++;
    tierStat.promptTokens += item.prompt_tokens;
    tierStat.completionTokens += item.completion_tokens;
    tierStat.duration += item.duration_ms;
    if (item.success) tierStat.successes++;
  }

  const tierSummary: Record<string, TierSummary> = {};
  for (const [tier, stat] of Object.entries(byTier)) {
    tierSummary[tier] = {
      entries: stat.entries,
      promptTokens: stat.promptTokens,
      completionTokens: stat.completionTokens,
      totalTokens: stat.promptTokens + stat.completionTokens,
      successRatePct: stat.entries > 0 ? Math.round((stat.successes / stat.entries) * 100) : 0,
      averageDurationMs: stat.entries > 0 ? Math.round(stat.duration / stat.entries) : 0,
      estimatedCloudSavingsUsd: computeCloudSavings(stat.promptTokens, stat.completionTokens),
    };
  }

  return {
    totalEntries: validCount,
    totalPromptTokens: totalPrompt,
    totalCompletionTokens: totalCompletion,
    totalTokens: totalPrompt + totalCompletion,
    totalDurationMs: totalDuration,
    averageDurationMs: validCount > 0 ? Math.round(totalDuration / validCount) : 0,
    successRatePct: validCount > 0 ? Math.round((successCount / validCount) * 100) : 0,
    estimatedCloudSavingsUsd: computeCloudSavings(totalPrompt, totalCompletion),
    byTier: tierSummary,
  };
}

export function formatLedgerSummaryTable(summary: InferenceLedgerSummary): string {
  const t1 = summary.byTier['tier1'];
  const t2 = summary.byTier['tier2'];
  const t3 = summary.byTier['tier3'];
  const fmt = (n: number | undefined) => (n ?? 0).toLocaleString();
  const fmtUsd = (usd: number | undefined) => `$${(usd ?? 0).toFixed(2)}`;

  return `# Local LLM Inference Ledger & Token Audit

| Metric | Overall | Tier 1 (Reasoning) | Tier 2 (Code) | Tier 3 (Fast) |
|---|---|---|---|---|
| Total Inferences | ${fmt(summary.totalEntries)} | ${fmt(t1?.entries)} | ${fmt(t2?.entries)} | ${fmt(t3?.entries)} |
| Prompt Tokens | ${fmt(summary.totalPromptTokens)} | ${fmt(t1?.promptTokens)} | ${fmt(t2?.promptTokens)} | ${fmt(t3?.promptTokens)} |
| Completion Tokens | ${fmt(summary.totalCompletionTokens)} | ${fmt(t1?.completionTokens)} | ${fmt(t2?.completionTokens)} | ${fmt(t3?.completionTokens)} |
| Total Tokens | ${fmt(summary.totalTokens)} | ${fmt(t1?.totalTokens)} | ${fmt(t2?.totalTokens)} | ${fmt(t3?.totalTokens)} |
| Avg Duration | ${fmt(summary.averageDurationMs)} ms | ${fmt(t1?.averageDurationMs)} ms | ${fmt(t2?.averageDurationMs)} ms | ${fmt(t3?.averageDurationMs)} ms |
| Success Rate | ${summary.successRatePct}% | ${t1?.successRatePct ?? 0}% | ${t2?.successRatePct ?? 0}% | ${t3?.successRatePct ?? 0}% |
| Estimated Cloud Cost | ${fmtUsd(summary.estimatedCloudSavingsUsd)} | ${fmtUsd(t1?.estimatedCloudSavingsUsd)} | ${fmtUsd(t2?.estimatedCloudSavingsUsd)} | ${fmtUsd(t3?.estimatedCloudSavingsUsd)} |

> **Cloud API Cost Baseline:** Claude 3.5 Sonnet ($3.00 / 1M prompt tokens, $15.00 / 1M completion tokens).`;
}

if (process.argv[1] && (process.argv[1].endsWith('local-llm-ledger.ts') || process.argv[1].endsWith('local-llm-ledger.js'))) {
  const args = process.argv.slice(2);
  const ledgerIdx = args.indexOf('--ledger');
  const customPath = ledgerIdx !== -1 && args[ledgerIdx + 1] ? args[ledgerIdx + 1]! : undefined;
  if (args.includes('--clear')) {
    clearInferenceLedger(customPath);
    console.log('[local-llm-ledger] Cleared inference ledger.');
  } else if (args.includes('--json')) {
    console.log(JSON.stringify(getInferenceLedgerSummary(customPath), null, 2));
  } else {
    console.log(formatLedgerSummaryTable(getInferenceLedgerSummary(customPath)));
  }
}
