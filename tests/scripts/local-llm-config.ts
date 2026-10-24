import { recordInferenceMetric } from './local-llm-ledger.js';

export const DEFAULT_OLLAMA_ENDPOINT = 'http://localhost:11434/v1/chat/completions';

export const TIER_1_REASONING_MODEL = 'lfm2.5:24b';
export const TIER_2_CODE_MODEL = 'gemma4:12b-extended';
export const TIER_3_FAST_MODEL = 'hermes3:8b';

export type ModelTier = 'tier1' | 'tier2' | 'tier3';

export type LlmExecutionMode = 'LIVE_INFERENCE' | 'MOCK_FALLBACK';

export interface LlmConnectionTelemetry {
  readonly llmExecutionMode: LlmExecutionMode;
  readonly temperature: number;
  readonly enforceJsonSchema: boolean;
  readonly endpoint?: string;
  readonly model?: string;
  readonly isHealthy?: boolean;
}

export function resolveEndpoint(override?: string): string {
  return process.env['LLM_ENDPOINT'] || override || DEFAULT_OLLAMA_ENDPOINT;
}

export function resolveModel(tierOrFallback: ModelTier | string, override?: string): string {
  if (process.env['LLM_MODEL']) {
    console.warn(
      `[local-llm-config] WARNING: Emergency universal override active (LLM_MODEL="${process.env['LLM_MODEL']}"). All tier routing bypassed.`,
    );
    return process.env['LLM_MODEL'];
  }
  if (override) return override;

  if (tierOrFallback === 'tier1' || tierOrFallback === TIER_1_REASONING_MODEL) {
    return process.env['LLM_MODEL_TIER1'] || TIER_1_REASONING_MODEL;
  }
  if (tierOrFallback === 'tier2' || tierOrFallback === TIER_2_CODE_MODEL) {
    return process.env['LLM_MODEL_TIER2'] || TIER_2_CODE_MODEL;
  }
  if (tierOrFallback === 'tier3' || tierOrFallback === TIER_3_FAST_MODEL) {
    return process.env['LLM_MODEL_TIER3'] || TIER_3_FAST_MODEL;
  }
  return tierOrFallback;
}

export async function checkEndpointHealth(endpoint?: string, timeoutMs = 1500): Promise<boolean> {
  const target = resolveEndpoint(endpoint);
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    let probeUrl = target;
    try {
      const parsed = new URL(target);
      probeUrl = `${parsed.origin}/api/tags`;
    } catch {
      // Keep target
    }
    const res = await fetch(probeUrl, { method: 'GET', signal: controller.signal });
    clearTimeout(timer);
    return res.ok;
  } catch {
    return false;
  }
}

export function getConnectionTelemetry(opts: {
  mock?: boolean;
  isHealthy?: boolean;
  endpoint?: string;
  model?: string;
  temperature?: number;
  enforceJsonSchema?: boolean;
}): LlmConnectionTelemetry {
  const isLive = !opts.mock && (opts.isHealthy ?? false);
  return {
    llmExecutionMode: isLive ? 'LIVE_INFERENCE' : 'MOCK_FALLBACK',
    temperature: opts.temperature ?? 0.1,
    enforceJsonSchema: opts.enforceJsonSchema ?? true,
    ...(opts.endpoint ? { endpoint: opts.endpoint } : {}),
    ...(opts.model ? { model: opts.model } : {}),
    ...(opts.isHealthy !== undefined ? { isHealthy: opts.isHealthy } : {}),
  };
}

export async function resolveConnectionTelemetry(opts: {
  mock?: boolean;
  endpoint?: string;
  model?: string;
  temperature?: number;
  enforceJsonSchema?: boolean;
  healthTimeoutMs?: number;
}): Promise<LlmConnectionTelemetry> {
  const isHealthy = opts.mock ? false : await checkEndpointHealth(opts.endpoint, opts.healthTimeoutMs);
  return getConnectionTelemetry({ ...opts, isHealthy });
}

export interface OllamaQueryOptions {
  model?: string | undefined;
  systemPrompt?: string | undefined;
  temperature?: number | undefined;
  formatJson?: boolean | undefined;
  enforceJsonSchema?: boolean | undefined;
  jsonSchema?: Record<string, unknown> | undefined;
  timeoutMs?: number | undefined;
  endpoint?: string | undefined;
  task?: string | undefined;
  tier?: ModelTier | string | undefined;
  retryCount?: number | undefined;
  ledgerPath?: string | undefined;
  recordTelemetry?: boolean | undefined;
}

export async function queryLocalOllama(prompt: string, opts: OllamaQueryOptions = {}): Promise<string> {
  const endpoint = resolveEndpoint(opts.endpoint);
  const model = opts.model ?? resolveModel('tier3');
  const timeoutMs = opts.timeoutMs ?? Number(process.env['LLM_TIMEOUT_MS'] || '120000');
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  const messages: Array<{ role: 'system' | 'user'; content: string }> = [];
  messages.push({
    role: 'system',
    content: opts.systemPrompt ?? 'You are an AI assistant for Aether & Soot. Return clean markdown or JSON as requested without function-calling syntax.',
  });
  messages.push({ role: 'user', content: prompt });

  const startTime = Date.now();
  let promptTokens = 0;
  let completionTokens = 0;
  let success = false;

  try {
    let responseFormat: Record<string, unknown> | undefined;
    if (opts.jsonSchema) {
      responseFormat = {
        type: 'json_schema',
        json_schema: {
          name: opts.task ? opts.task.replace(/[^a-zA-Z0-9_]/g, '_') : 'response_schema',
          strict: true,
          schema: opts.jsonSchema,
        },
      };
    } else if (opts.formatJson || opts.enforceJsonSchema) {
      responseFormat = { type: 'json_object' };
    }

    const payload: Record<string, unknown> = {
      model,
      messages,
      temperature: opts.temperature ?? 0.1,
    };
    if (responseFormat) {
      payload['response_format'] = responseFormat;
      if (opts.jsonSchema) {
        payload['format'] = opts.jsonSchema;
      } else if (opts.formatJson || opts.enforceJsonSchema) {
        payload['format'] = 'json';
      }
    }

    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);

    const data = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
      message?: { content?: string };
      usage?: { prompt_tokens?: number; completion_tokens?: number };
      prompt_eval_count?: number;
      eval_count?: number;
    };

    promptTokens = data.usage?.prompt_tokens ?? data.prompt_eval_count ?? 0;
    completionTokens = data.usage?.completion_tokens ?? data.eval_count ?? 0;

    const content = data.choices?.[0]?.message?.content ?? data.message?.content ?? '';
    success = true;
    return content;
  } finally {
    clearTimeout(timer);
    const durationMs = Math.max(0, Date.now() - startTime);

    if (opts.recordTelemetry !== false) {
      try {
        recordInferenceMetric(
          {
            timestamp: new Date().toISOString(),
            task: opts.task ?? 'general-query',
            tier: opts.tier ?? 'tier3',
            model,
            prompt_tokens: promptTokens,
            completion_tokens: completionTokens,
            duration_ms: durationMs,
            retry_count: opts.retryCount ?? 0,
            success,
            cache_hit: false,
          },
          opts.ledgerPath,
        );
      } catch {
        // Telemetry write failure should not disrupt the caller
      }
    }
  }
}
