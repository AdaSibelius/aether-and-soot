# Handoff Report: Milestone 1 (Features 3, 4, 5) — Token Ledger, Projection Leak Locality & Diagnostic Probes

## 1. Observation

### 1.1 Target Scripts & Current Line Counts
Auditing line counts across target scripts (`split('\n').length` / POSIX `wc -l + 1`):
| File | Current Lines | Target Line Limit | Hard Modularity Ceiling | Status |
|---|---|---|---|---|
| `tests/scripts/local-llm-ledger.ts` | 142 | <= 250 | 300 | Clean |
| `package.json` | 53 | N/A | N/A | Clean |
| `tests/scripts/projection-cell-scanner.ts` | 42 | <= 250 | 300 | Clean |
| `tests/scripts/playtester-projection-audit.ts` | 207 | <= 250 | 300 | Clean |
| `tests/scripts/critic-report.ts` | 194 | <= 250 | 300 | Clean |
| `tests/scripts/local-llm-config.ts` | 211 | <= 250 | 300 | Clean |
| `tests/scripts/llm-playtester.ts` | 238 | <= 250 | 300 | Near-Cap Alert |
| `tests/scripts/hermes-critic.ts` | 243 | <= 250 | 300 | Near-Cap (Pre-split by M1 Worker 1) |

### 1.2 Verification Pipeline Baseline
Running `npm run verify` (`tsc --noEmit`, `check-boundaries.ts`, `validate-data.ts`, `vitest run`):
- `npm run typecheck`: 0 errors.
- `npm run check:boundaries`: Checked 434 files, 0 boundary violations.
- `npm run validate:data`: Validated 5 prosthetics, 2 commodities, 22 materials/consumables, 9 recipes, 2 gases/fluids, 5 districts, 4 bark corpora, 3 codex entries.
- `npm run test:sim`: 123 test files passed, 651 tests passed (41.94s).

### 1.3 Active Inference Ledger Status
Direct extraction of `tests/artifacts/inference-ledger.jsonl` (1,477 JSONL entries) via `getInferenceLedgerSummary()` yields:
```
Total Inferences: 1,477
Prompt Tokens: 265,337
Completion Tokens: 504,013
Total Tokens: 769,350
Total Duration: 5,877,203 ms (~5,877s)
Average Latency: 3,980 ms
Success Rate: 100%
By Tier:
- Tier 1 (lfm2.5:24b): 281 entries | 79,498 prompt | 458,188 completion | 537,686 total tokens | Avg 15,197 ms
- Tier 2 (gemma4:12b-extended): 416 entries | 21,457 prompt | 41,625 completion | 63,082 total tokens | Avg 2,106 ms
- Tier 3 (hermes3:8b): 780 entries | 164,382 prompt | 4,200 completion | 168,582 total tokens | Avg 938 ms
```
Cloud Cost Equivalence (Claude 3.5 Sonnet: $3.00/M prompt, $15.00/M completion):
- Prompt Savings: `(265,337 / 1,000,000) * $3.00 = $0.796` (~$0.80)
- Completion Savings: `(504,013 / 1,000,000) * $15.00 = $7.560` (~$7.56)
- Total Estimated Cloud Savings: **$8.36 USD** (Tier 1: $7.11, Tier 2: $0.69, Tier 3: $0.56).

### 1.4 Projection Leak Representation Gaps
In `tests/scripts/projection-cell-scanner.ts:3-8`:
```typescript
export interface ProjectionLeak {
  readonly category: 'RAW_IDENTIFIER' | 'TRUNCATED_STRING' | 'DESYNC_COORDINATES' | 'DUPLICATE_CHRONICLE' | 'MALFORMED_UI_CELL';
  readonly location: string;
  readonly text: string;
  readonly details?: string;
}
```
Currently:
1. `ProjectionLeak` lacks explicit `sourceGroup` (`'HUD' | 'Radar' | 'Modal' | 'Chronicle' | 'TacticalUiBuffer'`).
2. `ProjectionLeak` lacks spatial `coordinate?: { x: number; y: number }`.
3. In `tests/scripts/critic-report.ts`, `formatCriticReport` does not render projection leaks as actionable bug entries; it only notes overall score penalties.
4. Unwired commands (e.g. `FIRE_RANGED_WEAPON`, `EQUIP_ITEM`, `ASCEND_CATACOMBS`) are presented as an unsorted flat list rather than clustered by domain phase category.

### 1.5 Loopback Socket Failure Diagnostics
In `tests/scripts/llm-playtester.ts:54-57` and `tests/scripts/hermes-*.ts`:
```typescript
} catch {
  console.error('FATAL: Local LLM connection failed. Aborting to prevent paid token burn.');
  process.exit(1);
}
```
When loopback socket access is blocked (e.g. due to sandbox restrictions without `BypassSandbox: true`):
- The error does not inform the developer or agent that loopback TCP access failed.
- The error does not provide the explicit remediation:
  `FATAL: Failed to connect to Ollama at http://localhost:11434. In Antigravity/sandbox, verify BypassSandbox: true is set. Run with --mock for deterministic fallback.`
- Neither `llm-playtester.ts` nor `hermes-critic.ts` executes a pre-flight probe via `checkEndpointHealth()` before entering multi-turn execution loops.

---

## 2. Logic Chain

### 2.1 Feature 3: Automated Token Ledger Audit CLI (`npm run audit:tokens`)
1. **Observation**: `local-llm-ledger.ts` aggregates raw metrics (`getInferenceLedgerSummary`), but lacks a CLI entry point, cloud cost formula, and markdown summary table formatter. `package.json` has no `audit:tokens` command.
2. **Inference**:
   - Adding `computeCloudSavings(promptTokens, completionTokens)` calculating `((prompt * 3.0 + completion * 15.0) / 1e6)` rounded to 2 decimal places provides deterministic cost equivalence.
   - Adding `estimatedCloudSavingsUsd` to `TierSummary` and `InferenceLedgerSummary` allows consumers (`critic-report`, `STATE.md`, CLI) to access financial telemetry directly.
   - Adding `formatLedgerSummaryTable(summary)` formats an IBM Plex Mono aligned Markdown table.
   - Adding `if (process.argv[1]?.includes('local-llm-ledger'))` enables `tsx tests/scripts/local-llm-ledger.ts --summary`, `--json`, and `--clear`.
   - Adding `"audit:tokens": "tsx tests/scripts/local-llm-ledger.ts --summary"` to `package.json` exposes a 1-command audit for all agents and CI.
3. **Modularity Budget**: `local-llm-ledger.ts` expands from 142 lines to ~182 lines, remaining safely below the 250-line target ceiling.

### 2.2 Feature 4: Projection Leak Locality & Feedback Actionability
1. **Observation**: When `auditClientProjection` detects raw identifiers (`district_spitalfields_soot_works`), the critic report summarizes it only as an aggregate count (`uiProjectionLeaks: 1`). Workers fixing the leak cannot immediately see which UI component leaked or at what coordinate.
2. **Inference**:
   - Expanding `ProjectionLeak` with `sourceGroup?: ProjectionSourceGroup` and `coordinate?: { x: number; y: number }` preserves backwards compatibility while capturing full locality.
   - In `playtester-projection-audit.ts`, passing `group.name` and the player's coordinate `{ x: pos.x, y: pos.y }` tags each leak with its exact buffer group and position.
   - In `critic-report.ts`:
     - Mapping schema files (`commands.schema.ts`, `domain-commands.schema.ts`, `equipment.schema.ts`, `transit-commands.schema.ts`, `lore-commands.schema.ts`, `skirmish-commands.schema.ts`, `safehouse-commands.schema.ts`) clusters unwired commands into 6 clear functional domains: *Tactical Combat & Physics*, *Equipment & Crafting*, *Transit & Overworld*, *Forensic & Lore*, *Skirmish & Faction*, and *Economy & Contracts*.
     - Formatting projection leaks as explicit bug tickets (`- **[P0_BLOCKER] RAW_IDENTIFIER** in **HUD** at (x, y): Offending token '...'`) provides instant copy-paste actionability.
3. **Modularity Budget**:
   - `projection-cell-scanner.ts`: 42 -> 48 lines.
   - `playtester-projection-audit.ts`: 207 -> 214 lines.
   - `critic-report.ts`: 194 -> ~225 lines (strictly <= 250).

### 2.3 Feature 5: Pre-Flight Loopback Diagnostic Probes
1. **Observation**: Local LLM calls fail abruptly when sandboxed or when Ollama is offline, displaying generic error strings that lead AI agents into fruitless debugging loops.
2. **Inference**:
   - Implementing `formatOllamaConnectionError(endpoint)` in `local-llm-config.ts` returns the verbatim standard diagnostic:
     `FATAL: Failed to connect to Ollama at http://localhost:11434. In Antigravity/sandbox, verify BypassSandbox: true is set. Run with --mock for deterministic fallback.`
   - In `queryLocalOllama`, catching network fetch errors and outputting `formatOllamaConnectionError` ensures zero confusion during live agent execution.
   - In `llm-playtester.ts` and `hermes-critic.ts`, running `await checkEndpointHealth(endpoint)` prior to launching playtest loops avoids wasting turns when the local daemon is unreachable.
3. **Modularity Budget**:
   - `local-llm-config.ts`: 211 -> ~226 lines.
   - `llm-playtester.ts`: 238 -> ~239 lines (strictly <= 250).

---

## 3. Caveats
1. **Read-Only Investigation**: No source code, test files, or scripts were modified during this explorer phase. All proposed code changes below are drop-in specifications for the implementing worker agent.
2. **Pricing Assumption**: Cloud cost savings calculations are based on Claude 3.5 Sonnet standard public API rates ($3.00 / 1M prompt tokens, $15.00 / 1M completion tokens). These constants are centralized in `computeCloudSavings`.
3. **Mock Mode Guarantee**: In `--mock` mode, `checkEndpointHealth` is bypassed completely, ensuring tests and CI suites run 100% deterministically with zero network I/O.

---

## 4. Conclusion & Implementation Specifications

### 4.1 Modularity & Line Count Projections
All 7 affected files will remain strictly below the 250-line target ceiling:
| File | Current Lines | Projected Lines | Limit | Compliant? |
|---|---|---|---|---|
| `package.json` | 53 | 54 | N/A | YES |
| `tests/scripts/local-llm-ledger.ts` | 142 | 182 | <= 250 | YES |
| `tests/scripts/projection-cell-scanner.ts` | 42 | 48 | <= 250 | YES |
| `tests/scripts/playtester-projection-audit.ts` | 207 | 214 | <= 250 | YES |
| `tests/scripts/critic-report.ts` | 194 | 225 | <= 250 | YES |
| `tests/scripts/local-llm-config.ts` | 211 | 226 | <= 250 | YES |
| `tests/scripts/llm-playtester.ts` | 238 | 239 | <= 250 | YES |

---

### 4.2 Drop-In Implementation Guide for the Worker

#### Specification 1: `package.json`
Add line to `"scripts"`:
```json
    "audit:tokens": "tsx tests/scripts/local-llm-ledger.ts --summary",
```

#### Specification 2: `tests/scripts/local-llm-ledger.ts`
Replace lines 45–142 with the following drop-in code:
```typescript
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
```

#### Specification 3: `tests/scripts/projection-cell-scanner.ts`
Replace lines 3–8 with:
```typescript
export type ProjectionSourceGroup = 'HUD' | 'Radar' | 'Modal' | 'Chronicle' | 'TacticalUiBuffer' | 'System';

export interface ProjectionLeak {
  readonly category: 'RAW_IDENTIFIER' | 'TRUNCATED_STRING' | 'DESYNC_COORDINATES' | 'DUPLICATE_CHRONICLE' | 'MALFORMED_UI_CELL';
  readonly location: string;
  readonly text: string;
  readonly sourceGroup?: ProjectionSourceGroup | string;
  readonly coordinate?: { readonly x: number; readonly y: number } | undefined;
  readonly details?: string;
}
```
In `auditUiCellBuffer` (lines 20–41), attach `sourceGroup: 'TacticalUiBuffer', coordinate: { x, y }` to each pushed leak.

#### Specification 4: `tests/scripts/playtester-projection-audit.ts`
1. Update export line 12:
   ```typescript
   export type { AuditProjectionOptions, ProjectionLeak, ProjectionSourceGroup };
   ```
2. In `auditClientProjection`:
   Capture `const playerCoord = pos ? { x: pos.x, y: pos.y } : undefined;`
   In stringGroups loop (lines 101–141), attach `sourceGroup: group.name, coordinate: playerCoord` to:
   - `RAW_IDENTIFIER` leaks
   - `TRUNCATED_STRING` leaks
3. In Check 5 (`DESYNC_COORDINATES`):
   Attach `sourceGroup: 'HUD', coordinate: options.lookCursor`
4. In Check 6 (`DUPLICATE_CHRONICLE`):
   Attach `sourceGroup: 'Chronicle', coordinate: { x: cur.to.x, y: cur.to.y }`

#### Specification 5: `tests/scripts/critic-report.ts`
1. Add `unwiredByCategory` to `CommandCoverage`:
   ```typescript
   export interface CommandCoverage {
     active: string[];
     dormant: string[];
     unwired: string[];
     unwiredByCategory?: Record<string, string[]>;
   }
   ```
2. In `auditCommandCoverage`:
   Add domain mapping:
   ```typescript
   const SCHEMA_DOMAIN_MAP: Record<string, string> = {
     'commands.schema.ts': 'Tactical Combat & Physics',
     'domain-commands.schema.ts': 'Economy & Contracts',
     'safehouse-commands.schema.ts': 'Territory & Safehouse',
     'skirmish-commands.schema.ts': 'Skirmish & Faction',
     'transit-commands.schema.ts': 'Transit & Overworld',
     'witness-commands.schema.ts': 'Witness & Social',
     'lore-commands.schema.ts': 'Forensic & Lore',
     'equipment.schema.ts': 'Equipment & Crafting',
   };
   ```
   During command file scan, map each command to its domain.
   Cluster unwired commands:
   ```typescript
   const unwiredByCategory: Record<string, string[]> = {};
   for (const cmd of unwired) {
     const domain = cmdDomainMap.get(cmd) ?? 'General';
     (unwiredByCategory[domain] ??= []).push(cmd);
   }
   return { active, dormant, unwired, unwiredByCategory };
   ```
3. In `formatCriticReport`:
   Accept `projectionLeaks?: readonly ProjectionLeak[] | undefined;`
   Format unwired categories:
   ```typescript
   const catEntries = Object.entries(data.coverage.unwiredByCategory ?? {});
   const unwiredCategoryBlock = catEntries.length > 0
     ? catEntries.map(([cat, cmds]) => `- **${cat}**: ${cmds.map((c) => `\`${c}\``).join(', ')}`).join('\n')
     : unwiredList;
   ```
   Format actionable projection leaks:
   ```typescript
   let leakSection = '';
   const leaks = data.projectionLeaks ?? [];
   if (leaks.length > 0) {
     const leakRows = leaks.map((l) => {
       const coord = l.coordinate ? `(${l.coordinate.x}, ${l.coordinate.y})` : 'N/A';
       const grp = l.sourceGroup ?? 'General';
       return `- **[P0_BLOCKER] ${l.category}** in **${grp}** at \`${coord}\`: Offending token \`${l.text}\` — ${l.details ?? l.location}`;
     }).join('\n');
     leakSection = `\n### Actionable UI Projection Bug Reports (${leaks.length} Detected)\n${leakRows}\n`;
   } else {
     leakSection = '\n### Actionable UI Projection Bug Reports\n- **Status**: CLEAN — Zero UI projection leaks detected.\n';
   }
   ```
   Embed `unwiredCategoryBlock` into Section 3 and `leakSection` into Section 2.

#### Specification 6: `tests/scripts/local-llm-config.ts`
1. Export diagnostic formatter:
   ```typescript
   export function formatOllamaConnectionError(endpoint?: string): string {
     const target = resolveEndpoint(endpoint);
     let origin = 'http://localhost:11434';
     try {
       origin = new URL(target).origin;
     } catch {
       origin = target;
     }
     return `FATAL: Failed to connect to Ollama at ${origin}. In Antigravity/sandbox, verify BypassSandbox: true is set. Run with --mock for deterministic fallback.`;
   }
   ```
2. In `queryLocalOllama`:
   Wrap `fetch(endpoint, ...)` with network catch:
   ```typescript
       let res: Response;
       try {
         res = await fetch(endpoint, {
           method: 'POST',
           headers: { 'Content-Type': 'application/json' },
           body: JSON.stringify(payload),
           signal: controller.signal,
         });
       } catch (fetchErr: unknown) {
         const guidance = formatOllamaConnectionError(endpoint);
         console.error(guidance);
         throw new Error(`${guidance}\nUnderlying network error: ${fetchErr instanceof Error ? fetchErr.message : String(fetchErr)}`);
       }
       if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
   ```

#### Specification 7: `tests/scripts/llm-playtester.ts`
1. Import `formatOllamaConnectionError` from `./local-llm-config.js`.
2. In `queryLocalLlm`:
   ```typescript
   async function queryLocalLlm(endpoint: string, model: string, prompt: string, tier?: ModelTier): Promise<string> {
     try {
       return await queryLocalOllama(prompt, {
         endpoint,
         model,
         systemPrompt: 'You are playing Aether & Soot, a Victorian roguelike. Return ONLY JSON matching schema. Do not make function or tool calls.',
         formatJson: true,
         temperature: 0.1,
         task: 'llm-playtester',
         tier: tier ?? 'tier3',
       });
     } catch (err: unknown) {
       const msg = err instanceof Error ? err.message : String(err);
       if (!msg.includes('FATAL: Failed to connect to Ollama')) {
         console.error(formatOllamaConnectionError(endpoint));
       }
       process.exit(1);
     }
   }
   ```
3. In CLI block (`if (process.argv[1]?.endsWith('llm-playtester.ts'))`):
   ```typescript
   if (process.argv[1]?.endsWith('llm-playtester.ts')) {
     const cfg = parseCliArgs(process.argv.slice(2));
     if (!cfg.mock) {
       const isHealthy = await checkEndpointHealth(cfg.endpoint);
       if (!isHealthy) {
         console.error(formatOllamaConnectionError(cfg.endpoint));
         process.exit(1);
       }
     }
     console.log(`[llm-playtester] Starting session (mock=${cfg.mock}, turns=${cfg.maxTurns}, seed=${cfg.seed})...`);
     ...
   ```

---

## 5. Verification Method

To independently verify the worker's implementation:
1. **Token Audit CLI Verification**:
   ```bash
   npm run audit:tokens
   ```
   Assert:
   - Output contains `# Local LLM Inference Ledger & Token Audit`
   - Output displays `Total Inferences: 1,477` (or greater)
   - Output displays `Estimated Cloud Cost: $8.36` (matching Claude 3.5 Sonnet formula)
   - Command exits cleanly with code 0.
2. **Deterministic Token Routing & Ledger Unit Tests**:
   ```bash
   npx vitest run tests/sim/local-llm-routing.test.ts
   ```
   Assert: All 8 test suites pass, verifying ledger aggregation, schema compliance, and savings calculation.
3. **Critic Report & Projection Locality Tests**:
   ```bash
   npx vitest run tests/sim/hermes-critic.test.ts tests/sim/phase2-1-identifier-leaks.test.ts
   ```
   Assert: All projection leak tests pass, verifying `sourceGroup`, `coordinate`, and clustered command categories.
4. **Endpoint Health & Diagnostic Probe Test**:
   ```bash
   npx tsx -e "import { formatOllamaConnectionError, checkEndpointHealth } from './tests/scripts/local-llm-config.ts'; console.log(formatOllamaConnectionError()); checkEndpointHealth('http://127.0.0.1:99999/unreachable').then((h) => console.log('Healthy:', h));"
   ```
   Assert:
   - Logs verbatim: `FATAL: Failed to connect to Ollama at http://localhost:11434. In Antigravity/sandbox, verify BypassSandbox: true is set. Run with --mock for deterministic fallback.`
   - Prints `Healthy: false`.
5. **Modularity & 300-Line Ceiling Boundary Check**:
   ```bash
   npm run check:boundaries
   ```
   Assert: 0 boundary violations, 0 files exceeding 300 lines, all modified files <= 250 lines.
6. **Full Verification Suite Gate**:
   ```bash
   npm run verify
   ```
   Assert: Typecheck passes with 0 errors, boundaries pass with 0 violations, data validates 100%, and 651 simulation tests pass.
