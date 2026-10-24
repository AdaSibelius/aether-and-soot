import fs from 'node:fs';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  resolveModel,
  TIER_1_REASONING_MODEL,
  TIER_2_CODE_MODEL,
  TIER_3_FAST_MODEL,
  queryLocalOllama,
} from '../scripts/local-llm-config.js';
import {
  recordInferenceMetric,
  getInferenceLedgerSummary,
  clearInferenceLedger,
  InferenceLedgerEntrySchema,
} from '../scripts/local-llm-ledger.js';

describe('Local LLM Tier Routing & Inference Telemetry Ledger', () => {
  const originalEnv = { ...process.env };
  const testLedgerPath = path.resolve(__dirname, '../artifacts/test-routing-ledger.jsonl');

  beforeEach(() => {
    delete process.env['LLM_MODEL'];
    delete process.env['LLM_MODEL_TIER1'];
    delete process.env['LLM_MODEL_TIER2'];
    delete process.env['LLM_MODEL_TIER3'];
    clearInferenceLedger(testLedgerPath);
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    clearInferenceLedger(testLedgerPath);
    vi.restoreAllMocks();
  });

  describe('resolveModel() tier routing precedence', () => {
    it('resolves standard default models when no env vars are set', () => {
      expect(resolveModel('tier1')).toBe(TIER_1_REASONING_MODEL);
      expect(resolveModel('tier2')).toBe(TIER_2_CODE_MODEL);
      expect(resolveModel('tier3')).toBe(TIER_3_FAST_MODEL);
      expect(resolveModel('custom-arbitrary-model')).toBe('custom-arbitrary-model');
    });

    it('resolves per-tier environment overrides without collapsing other tiers', () => {
      process.env['LLM_MODEL_TIER1'] = 'mistral-large:custom';
      process.env['LLM_MODEL_TIER2'] = 'qwen2.5-coder:14b';
      process.env['LLM_MODEL_TIER3'] = 'phi4-mini:latest';

      expect(resolveModel('tier1')).toBe('mistral-large:custom');
      expect(resolveModel('tier2')).toBe('qwen2.5-coder:14b');
      expect(resolveModel('tier3')).toBe('phi4-mini:latest');
    });

    it('allows explicit override argument when LLM_MODEL is unset', () => {
      process.env['LLM_MODEL_TIER2'] = 'qwen-override';
      expect(resolveModel('tier2', 'explicit-cli-override')).toBe('explicit-cli-override');
    });

    it('enforces LLM_MODEL as an emergency universal override with console warning', () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      process.env['LLM_MODEL'] = 'universal-emergency-fallback';
      process.env['LLM_MODEL_TIER1'] = 'tier1-special';

      const resolvedTier1 = resolveModel('tier1');
      const resolvedTier2 = resolveModel('tier2', 'cli-arg');
      const resolvedTier3 = resolveModel('tier3');

      expect(resolvedTier1).toBe('universal-emergency-fallback');
      expect(resolvedTier2).toBe('universal-emergency-fallback');
      expect(resolvedTier3).toBe('universal-emergency-fallback');
      expect(warnSpy).toHaveBeenCalled();
      expect(warnSpy.mock.calls[0]?.[0]).toContain('Emergency universal override active');
    });
  });

  describe('Inference Telemetry Ledger', () => {
    it('validates and records structured metrics to ledger file', () => {
      const entry = recordInferenceMetric(
        {
          timestamp: new Date().toISOString(),
          task: 'test-gen-benchmark',
          tier: 'tier2',
          model: 'gemma4:12b-extended',
          prompt_tokens: 350,
          completion_tokens: 120,
          duration_ms: 1450,
          retry_count: 1,
          success: true,
          cache_hit: false,
        },
        testLedgerPath,
      );

      expect(entry.task).toBe('test-gen-benchmark');
      expect(fs.existsSync(testLedgerPath)).toBe(true);

      const summary = getInferenceLedgerSummary(testLedgerPath);
      expect(summary.totalEntries).toBe(1);
      expect(summary.totalPromptTokens).toBe(350);
      expect(summary.totalCompletionTokens).toBe(120);
      expect(summary.totalTokens).toBe(470);
      expect(summary.successRatePct).toBe(100);
      expect(summary.byTier['tier2']?.entries).toBe(1);
      expect(summary.byTier['tier2']?.totalTokens).toBe(470);
    });

    it('aggregates multi-tier metrics, failure rates, and latencies accurately', () => {
      recordInferenceMetric(
        {
          timestamp: new Date().toISOString(),
          task: 'scout-task',
          tier: 'tier2',
          model: 'gemma4:12b',
          prompt_tokens: 200,
          completion_tokens: 50,
          duration_ms: 500,
          retry_count: 0,
          success: true,
        },
        testLedgerPath,
      );

      recordInferenceMetric(
        {
          timestamp: new Date().toISOString(),
          task: 'critic-task',
          tier: 'tier1',
          model: 'lfm2.5:24b',
          prompt_tokens: 800,
          completion_tokens: 200,
          duration_ms: 2500,
          retry_count: 0,
          success: true,
        },
        testLedgerPath,
      );

      recordInferenceMetric(
        {
          timestamp: new Date().toISOString(),
          task: 'critic-failed-repair',
          tier: 'tier1',
          model: 'lfm2.5:24b',
          prompt_tokens: 800,
          completion_tokens: 0,
          duration_ms: 1000,
          retry_count: 2,
          success: false,
        },
        testLedgerPath,
      );

      const summary = getInferenceLedgerSummary(testLedgerPath);
      expect(summary.totalEntries).toBe(3);
      expect(summary.totalPromptTokens).toBe(1800);
      expect(summary.totalCompletionTokens).toBe(250);
      expect(summary.totalTokens).toBe(2050);
      expect(summary.successRatePct).toBe(67); // 2 of 3
      expect(summary.byTier['tier1']?.entries).toBe(2);
      expect(summary.byTier['tier1']?.successRatePct).toBe(50);
      expect(summary.byTier['tier2']?.entries).toBe(1);
      expect(summary.byTier['tier2']?.successRatePct).toBe(100);
    });

    it('rejects malformed entries violating schema', () => {
      expect(() => {
        InferenceLedgerEntrySchema.parse({
          timestamp: new Date().toISOString(),
          task: 'invalid-entry',
          tier: 'tier1',
          model: 'model',
          prompt_tokens: -10, // negative forbidden
          completion_tokens: 0,
          duration_ms: 100,
          retry_count: 0,
          success: true,
        });
      }).toThrow();
    });

    it('queryLocalOllama captures usage tokens and duration to custom ledger', async () => {
      const mockResponse = {
        choices: [{ message: { content: '{"status":"ok"}' } }],
        usage: { prompt_tokens: 125, completion_tokens: 42 },
      };

      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      } as Response);

      const result = await queryLocalOllama('test prompt', {
        endpoint: 'http://localhost:11434/v1/chat/completions',
        task: 'unit-test-query',
        tier: 'tier3',
        ledgerPath: testLedgerPath,
      });

      expect(result).toBe('{"status":"ok"}');
      const summary = getInferenceLedgerSummary(testLedgerPath);
      expect(summary.totalEntries).toBe(1);
      expect(summary.totalPromptTokens).toBe(125);
      expect(summary.totalCompletionTokens).toBe(42);
      expect(summary.byTier['tier3']?.entries).toBe(1);
    });
  });
});
