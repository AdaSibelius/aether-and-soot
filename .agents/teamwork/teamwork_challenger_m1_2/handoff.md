# Empirical Challenge Report: Milestone 1 Pipeline Hardening (Features 3, 4, 5)

## Challenge Summary

**Overall risk assessment**: LOW
**Verdict**: **PASS**

All three target features (Feature 3: Token Ledger & Cloud Savings CLI, Feature 4: Projection Leak Locality & Critic Reporting, Feature 5: Diagnostic Loopback Probes) have been subjected to empirical stress testing with adversarial inputs, edge cases, boundary conditions, and mock fault injection. No unhandled exceptions, NaN/overflow regressions, or missing localities were observed.

---

## 1. Observation

### 1.1 Feature 3: Token Ledger & Cloud Savings (`local-llm-ledger.ts`)
- **Arithmetic Edge Cases**:
  Executed `computeCloudSavings(promptTokens, completionTokens)` with 12 distinct boundary vectors:
  - `prompt=0, comp=0` -> `$0.00` (exact 0)
  - `prompt=1, comp=0` -> `$0.00` (sub-cent rounding)
  - `prompt=0, comp=1` -> `$0.00` (sub-cent rounding)
  - `prompt=100,000, comp=0` -> `$0.30`
  - `prompt=0, comp=100,000` -> `$1.50`
  - `prompt=1,000,000, comp=0` -> `$3.00` (Claude 3.5 Sonnet baseline: $3.00 / 1M prompt)
  - `prompt=0, comp=1,000,000` -> `$15.00` (Claude 3.5 Sonnet baseline: $15.00 / 1M completion)
  - `prompt=100,000,000, comp=100,000,000` -> `$1,800.00` (large volume stability)
  - `prompt=265,337, comp=504,013` -> `$8.36` (exact ledger total match)
  - `prompt=33,333, comp=6,666` -> `$0.20`
  - `prompt=123.456, comp=789.012` -> `$0.01` (floating-point inputs handled cleanly)
  - `prompt=-100, comp=0` -> `$0.00`
- **CLI Execution (`npm run audit:tokens`)**:
  Executing `npm run audit:tokens` (`tsx tests/scripts/local-llm-ledger.ts --summary`) exited with code 0 and produced:
  ```markdown
  # Local LLM Inference Ledger & Token Audit

  | Metric | Overall | Tier 1 (Reasoning) | Tier 2 (Code) | Tier 3 (Fast) |
  |---|---|---|---|---|
  | Total Inferences | 1,525 | 297 | 435 | 793 |
  | Prompt Tokens | 265,337 | 79,498 | 21,457 | 164,382 |
  | Completion Tokens | 504,013 | 458,188 | 41,625 | 4,200 |
  | Total Tokens | 769,350 | 537,686 | 63,082 | 168,582 |
  | Avg Duration | 3,854 ms | 14,378 ms | 2,014 ms | 922 ms |
  | Success Rate | 100% | 100% | 100% | 100% |
  | Estimated Cloud Cost | $8.36 | $7.11 | $0.69 | $0.56 |

  > **Cloud API Cost Baseline:** Claude 3.5 Sonnet ($3.00 / 1M prompt tokens, $15.00 / 1M completion tokens).
  ```
- **Empty / Extreme Table Formatting**:
  `formatLedgerSummaryTable` formatted empty summaries with `0%` and `$0.00`, and large 10M-inference datasets without overflow.

---

### 1.2 Feature 4: Projection Leak Locality & Critic Reporting (`critic-report.ts` & `playtester-projection-audit.ts`)
- **Buffer Ingestion & Anomaly Scanning**:
  Injected synthetic anomalies into `UiCellBuffer`:
  - `grid[0][0] = undefined` -> `category: 'MALFORMED_UI_CELL'`, `text: 'MISSING_CELL'`, `sourceGroup: 'TacticalUiBuffer'`, `coordinate: { x: 0, y: 0 }`
  - `grid[0][1] = { glyph: '', ... }` -> `category: 'MALFORMED_UI_CELL'`, `text: 'EMPTY_GLYPH'`, `sourceGroup: 'TacticalUiBuffer'`, `coordinate: { x: 1, y: 0 }`
  - `grid[1][0] = { glyph: 'A', fg: '', ... }` -> `category: 'MALFORMED_UI_CELL'`, `text: 'MISSING_PALETTE_COLOR'`, `sourceGroup: 'TacticalUiBuffer'`, `coordinate: { x: 0, y: 1 }`
  - `grid[1][1] = { glyph: 'B', ..., bg: '' }` -> `category: 'MALFORMED_UI_CELL'`, `text: 'MISSING_PALETTE_COLOR'`, `sourceGroup: 'TacticalUiBuffer'`, `coordinate: { x: 1, y: 1 }`
  - `grid[2][2] = { ..., hitAction: '   ' }` -> `category: 'MALFORMED_UI_CELL'`, `text: 'EMPTY_HIT_ACTION'`, `sourceGroup: 'TacticalUiBuffer'`, `coordinate: { x: 2, y: 2 }`
- **Projection Auditing & Token Matching**:
  - Raw IDs (`district_spitalfields_soot_works`, `mat_vulcanized_rubber`) in Chronicle events were matched and localized to `Chronicle` at player coordinate `(24, 18)`.
  - Look cursor desync (`lookCursor: { x: 10, y: 10 }`, `inspectorTile: { x: 11, y: 11 }`) localized to `HUD` at `(10, 10)`.
  - Duplicate consecutive `ENTITY_MOVED` events localized to `Chronicle` at `(25, 18)`.
- **Actionable Report Formatting**:
  `formatCriticReport` rendered all leaks as actionable P0 blocker tickets:
  ```markdown
  ### Actionable UI Projection Bug Reports (7 Detected)
  - **[P0_BLOCKER] DESYNC_COORDINATES** in **HUD** at `(10, 10)`: Offending token `Look (10, 10) !== Inspector (11, 11)` — LookCursor coordinates do not match hovered TileInspectorPanel coordinates.
  - **[P0_BLOCKER] DUPLICATE_CHRONICLE** in **Chronicle** at `(25, 18)`: Offending token `Duplicate consecutive ENTITY_MOVED to (25, 18) on turn 3` — Consecutive duplicate movement log entries detected in recent chronicle window.
  - **[P0_BLOCKER] MALFORMED_UI_CELL** in **TacticalUiBuffer** at `(0, 0)`: Offending token `MISSING_CELL` — Null cell
  - **[P0_BLOCKER] MALFORMED_UI_CELL** in **TacticalUiBuffer** at `(1, 0)`: Offending token `EMPTY_GLYPH` — Empty glyph
  - **[P0_BLOCKER] MALFORMED_UI_CELL** in **TacticalUiBuffer** at `(0, 1)`: Offending token `MISSING_PALETTE_COLOR` — fg=, bg=#000
  - **[P0_BLOCKER] MALFORMED_UI_CELL** in **TacticalUiBuffer** at `(1, 1)`: Offending token `MISSING_PALETTE_COLOR` — fg=#fff, bg=
  - **[P0_BLOCKER] MALFORMED_UI_CELL** in **TacticalUiBuffer** at `(2, 2)`: Offending token `EMPTY_HIT_ACTION` — Empty hitAction
  ```
- **8 Schema Domain Clustering**:
  All 8 schema files were verified to parse and cluster into functional domains:
  1. `commands.schema.ts` (11 commands) -> **Tactical Combat & Physics**
  2. `domain-commands.schema.ts` (31 commands) -> **Economy & Contracts**
  3. `safehouse-commands.schema.ts` (5 commands) -> **Territory & Safehouse**
  4. `skirmish-commands.schema.ts` (3 commands) -> **Skirmish & Faction**
  5. `transit-commands.schema.ts` (5 commands) -> **Transit & Overworld**
  6. `witness-commands.schema.ts` (2 commands) -> **Witness & Social**
  7. `lore-commands.schema.ts` (3 commands) -> **Forensic & Lore**
  8. `equipment.schema.ts` (3 commands) -> **Equipment & Crafting**
  Rendered output under Section 3 formatted all 8 domains cleanly under `- **Unwired Blind-Spot Commands (Missing from Context/Serializer)**:`.

---

### 1.3 Feature 5: Diagnostic Probes (`local-llm-config.ts`)
- **`formatOllamaConnectionError` Resiliency**:
  Tested across 11 edge-case arguments:
  - `undefined` -> `FATAL: Failed to connect to Ollama at http://localhost:11434. In Antigravity/sandbox, verify BypassSandbox: true is set. Run with --mock for deterministic fallback.`
  - `""` -> falls back to default origin `http://localhost:11434`.
  - Malformed protocol `"://bad-url-protocol"` -> caught, returns target without exception.
  - Non-URL text `"not_a_url_at_all"` -> caught, returns target without exception.
  - Unsupported schemes (`ftp://...`), credentials (`http://user:pass@localhost:11434`), whitespace padding -> stripped/handled safely.
- **`checkEndpointHealth` Probe**:
  Tested against:
  - Unreachable port 99999 -> `false` (10ms)
  - Closed port 54321 -> `false` (4ms)
  - Invalid protocol / malformed string -> `false` (0ms, no uncaught rejection)
  - Non-routable IP with timeout -> `false` (aborted via AbortController)
  - Mocked 200 OK -> `true`
  - Mocked 503 Service Unavailable -> `false`
  - Mocked Abort/Timeout -> `false`

---

### 1.4 Verification Gate Results
- **Targeted Vitest Suite**:
  Command: `npx vitest run tests/sim/local-llm-routing.test.ts tests/sim/hermes-critic.test.ts tests/sim/phase2-1-identifier-leaks.test.ts`
  Result: 3 test files passed, 28 tests passed (duration: 1.48s).
- **Full Verification Suite (`npm run verify`)**:
  1. `npm run typecheck` (`tsc --noEmit`): 0 errors.
  2. `npm run check:boundaries` (`tsx tests/scripts/check-boundaries.ts`): Checked 437 files. Zero Core/Shell or modularity violations (advisory warnings logged for near-cap files without failing).
  3. `npm run validate:data` (`tsx tests/scripts/validate-data.ts`): Validated 5 prosthetics, 2 commodities, 22 materials/consumables, 9 recipes, 2 gases/fluids, 5 districts, 4 bark corpora, 3 codex entries.
  4. `npm run test:sim` (`vitest run`): 124 test files passed, 654 tests passed (duration: 41.23s).

---

## 2. Logic Chain

1. **Feature 3 Integrity**:
   - Observation 1.1 proves that `computeCloudSavings` maps token counts directly to Claude 3.5 Sonnet pricing with exact sub-cent rounding.
   - Running `npm run audit:tokens` generates the expected markdown table directly from `inference-ledger.jsonl`.
   - Therefore, Feature 3 meets all specification requirements and is robust under extreme values.

2. **Feature 4 Locality & Actionability**:
   - Observation 1.2 demonstrates that `UiCellBuffer` anomalies, chronicle leaks, desynced coordinates, and duplicate log entries are captured with both `sourceGroup` and `coordinate`.
   - `critic-report.ts` maps all 8 schema files to their respective domain clusters and emits structured P0 bug tickets.
   - Therefore, Feature 4 delivers concrete, actionable developer feedback.

3. **Feature 5 Diagnostic Robustness**:
   - Observation 1.3 proves that network failures, timeouts, and malformed URL inputs do not cause unhandled rejections or crashes.
   - Connection failures explicitly direct agents to enable `BypassSandbox: true` or run `--mock`.
   - Therefore, Feature 5 satisfies all loopback safety and sandbox diagnostic invariants.

4. **Regression Safety**:
   - Observation 1.4 confirms that the entire test suite (124 files, 654 tests) passes with 0 regressions.
   - Boundaries and typing remain strictly compliant.

---

## 3. Caveats
- No caveats. All 3 target features function deterministically, handle hostile inputs gracefully, and pass full verification.

---

## 4. Conclusion

**Verdict: PASS**

The implementations of Features 3, 4, and 5 in Milestone 1 are verified to be complete, robust, and mathematically accurate. All stress tests succeeded with zero failures.

---

## 5. Verification Method

To independently reproduce this empirical audit:

1. **Run Targeted Vitest Suites**:
   ```bash
   npx vitest run tests/sim/local-llm-routing.test.ts tests/sim/hermes-critic.test.ts tests/sim/phase2-1-identifier-leaks.test.ts
   ```
   *Expected*: 3 test files passed, 28 tests passed.

2. **Run Token Audit CLI**:
   ```bash
   npm run audit:tokens
   ```
   *Expected*: Exits 0, outputs valid Markdown summary table with Sonnet cost equivalence.

3. **Run Full Verification Gate**:
   ```bash
   npm run verify
   ```
   *Expected*: 4/4 gates pass (0 type errors, 0 boundary errors, 0 validation errors, 124 test files passed).
