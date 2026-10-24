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
}

export interface InferenceLedgerSummary {
  readonly totalEntries: number;
  readonly totalPromptTokens: number;
  readonly totalCompletionTokens: number;
  readonly totalTokens: number;
  readonly totalDurationMs: number;
  readonly averageDurationMs: number;
  readonly successRatePct: number;
  readonly byTier: Record<string, TierSummary>;
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
    byTier: tierSummary,
  };
}
