# Empirical Challenge Report: Milestone 1 Tooling Modularity & Boundary Early Warnings

**Milestone**: M1 (Features 1 & 2: Tooling Modularity Pre-Splitting and Boundary Early Warnings / Layout Compliance)  
**Agent**: `teamwork_challenger_m1_1` (Empirical Challenger: Critic & Specialist)  
**Verdict**: **PASS**  
**Overall Risk Assessment**: **LOW**

---

## 1. Observation

Direct empirical evidence was gathered through independent verification commands, dedicated stress test harnesses, and isolated temporary execution environments:

### 1.1 Full Repository Verification Gate (`npm run verify`)
Executing `npm run verify` synchronously through all four project gates:
- Gate 1 (`tsc --noEmit`): 0 type errors.
- Gate 2 (`tsx tests/scripts/check-boundaries.ts`): Checked 437 files. 0 violations. Emitted 18 non-fatal advisory warnings for files between 240 and 297 lines. Exited with code `0`.
- Gate 3 (`tsx tests/scripts/validate-data.ts`): Validated 5 prosthetics, 2 commodities, 22 materials/consumables, 9 recipes, 2 gases/fluids, 5 districts, 4 bark corpora, 3 codex entries with 0 schema violations.
- Gate 4 (`vitest run`): 124 test files passed, 654 tests passed (0 failures).

### 1.2 Targeted Verification Suites
Executing `npx vitest run tests/sim/check-boundaries.test.ts tests/sim/phase53-governance-state.test.ts`:
- `tests/sim/check-boundaries.test.ts`: 3/3 tests passed.
- `tests/sim/phase53-governance-state.test.ts`: 6/6 tests passed.
- Total: 9/9 passed in 1.51s.

### 1.3 Boundary Limit Stress Testing (`check-boundaries.ts`)
A synthetic file generator was executed across exact boundary line thresholds in an isolated directory:
- **239 lines**: `violations: 0`, `warnings: 0`. Exit code `0`.
- **240 lines**: `violations: 0`, `warnings: 1` (`[check:boundaries] WARNING: ... is near cap (240/300 lines)`). Exit code `0`.
- **300 lines**: `violations: 0`, `warnings: 1` (`[check:boundaries] WARNING: ... is near cap (300/300 lines)`). Exit code `0`.
- **301 lines**: `violations: 1` (`...: 301 lines exceeds hard modularity ceiling (300)`), `warnings: 0`. Exit code `1`.
- **Real CLI Execution**: Spawned `npx tsx tests/scripts/check-boundaries.ts` against the repository: returned exit code `0`. Spawned CLI against synthetic directories with 300 vs 301 lines: confirmed exit `0` on warnings-only and exit `1` on 301 lines.

### 1.4 Layout Compliance Stress Testing (`checkTeamworkLayoutCompliance`)
Layout compliance scanning of `.agents/teamwork/` was tested against synthetic file trees:
- **Forbidden extensions**: `.ts`, `.tsx`, `.js`, `.json`, `.TS`, `.Tsx`, and nested `sub/nested.js` were all detected and flagged with verbatim error:
  `...: Illegal source/data file in .agents/teamwork/ (workspace must contain only metadata .md files)`
- **Reserved rule filenames**: `AGENTS.md`, `GEMINI.md`, `agents.md`, `gemini.md`, `Agents.Md`, and nested `sub/AGENTS.MD` were all detected and flagged with verbatim error:
  `...: Forbidden rule filename in .agents/teamwork/ (AGENTS.md/GEMINI.md are reserved for root)`
- **Permitted metadata files**: `BRIEFING.md`, `progress.md`, `handoff.md`, `plan.md`, `context.md`, `DISPATCH.md`, `README.md`, `.gitkeep`, and `.txt` files produced exactly 0 violations.
- **Current Repository State**: `checkTeamworkLayoutCompliance(process.cwd(), violations)` returned `violations: []` (0 violations).

### 1.5 Edge-Case & Error-Resilience Stress Testing (`state-markdown-compiler.ts` & `critic-domain-targets.ts`)
Synthetic stress tests executed against pure compilers and domain target resolvers:
- **Completely Empty ProjectState**: `compileStateMarkdown` with empty string `lastUpdated: ''`, empty `recentCommits: []`, empty `phases: []`, empty `hotspots: []`, empty `prescriptions: []`, and empty `immediateNextPriority: ''` executed cleanly, rendered empty markdown tables, and defaulted top hotspot to `'none'`. Zero unhandled exceptions.
- **Adversarial `immediateNextPriority` Formats**: Evaluated strings with no colon, multiple colons, bold asterisks (`**Phase 54**: ...`), leading/trailing whitespace, and unicode characters. All compiled without throwing or regex corruption.
- **Roadmap Markdown Edge Cases**: `compileRoadmapMarkdown` tested with empty markdown `''`, missing phase entries (phase numbers not present in roadmap text), mixed array vs string `targetFiles`, and idempotent re-compilation over completed phases. Prevented `*(Completed)* *(Completed)*` duplication and filtered duplicate prescriptions by `id::title`.
- **`compileAgentsMarkdown`**: Tested with empty near caps `[]` and empty markdown `''`. Correctly replaced warning section without crashing.
- **`parseVerifiedPrescriptions`**: Tested with empty strings, strings without `## 5.`, strings with corrupted lines, missing targets/verifications, stop section markers (`### Quarantined`, `## 6.`), and markdown containing pipe characters `|`. Parsed expected valid entries and gracefully discarded malformed lines without throwing.
- **`resolvePhaseDomainTargetFiles`**: Tested with numeric phase IDs, empty strings, all 6 domain keyword sets (`GOVERNANCE_TOOLING`, `ECONOMY_SUPPLY`, `CHRONICLE_WITNESS`, `FORENSIC_CLUES`, `TOPOGRAPHY_ATLAS`, `PREFABS_LANDMARKS`), unmapped domain titles (`"Phase 999: Completely Unknown Domain"`), and non-existent root directories. Verified fallback safely returns `['src/sim/core/engine.ts']`. Zero unhandled exceptions.
- **`collectTelemetryAnomalies`**: Evaluated with zeros, negative numbers, and high numbers. Handled cleanly without NaN or exceptions.
- **`buildDomainPrescriptions`**: Evaluated with empty contexts (`phaseNumber: 0`, empty strings, empty unwired commands, undefined top near-cap file). Generated standard 3-prescription triage records (`P1`, `P2`, `P3`) with zero exceptions.

### 1.6 File Line Count Verification
All 13 files touched in Milestone 1 were measured via `content.split('\n').length`:
- `tests/scripts/state-markdown-compiler.ts`: **130 lines** (<= 250 target ceiling)
- `tests/scripts/update-state.ts`: **132 lines** (<= 250 target ceiling)
- `tests/scripts/critic-domain-targets.ts`: **153 lines** (<= 250 target ceiling)
- `tests/scripts/hermes-critic.ts`: **195 lines** (<= 250 target ceiling)
- `tests/scripts/check-boundaries.ts`: **98 lines** (<= 120 target budget, <= 250 target ceiling)
- `tests/scripts/local-llm-ledger.ts`: **188 lines** (<= 200 target budget, <= 250 target ceiling)
- `tests/scripts/projection-cell-scanner.ts`: **48 lines** (<= 250 target ceiling)
- `tests/scripts/playtester-projection-audit.ts`: **219 lines** (<= 250 target ceiling)
- `tests/scripts/critic-report.ts`: **239 lines** (<= 250 target ceiling)
- `tests/scripts/local-llm-config.ts`: **229 lines** (<= 250 target ceiling)
- `tests/scripts/llm-playtester.ts`: **239 lines** (<= 250 target ceiling)
- `tests/sim/check-boundaries.test.ts`: **68 lines** (<= 250 target ceiling)
- `tests/sim/phase53-governance-state.test.ts`: **204 lines** (<= 250 target ceiling)

---

## 2. Logic Chain

1. **Premise 1 (Modularity Guard)**: AGENTS.md Rule 2.2 and PROJECT.md require all modules to stay <= 250 lines target ceiling and fail if > 300 lines. Pre-splitting `update-state.ts` (down from 245 to 132 lines) into `state-markdown-compiler.ts` (130 lines) and `hermes-critic.ts` (down from 243 to 195 lines) into `critic-domain-targets.ts` (153 lines) brought both modules well under the 250-line target ceiling while preserving all interface contracts and exports.
2. **Premise 2 (Boundary Early Warnings)**: By introducing `WARN_LINES_THRESHOLD = 240` alongside `MAX_LINES_HARD_CEILING = 300`, `check-boundaries.ts` warns agents about files nearing the ceiling without triggering false CI failures. Observation 1.3 proves that files at 239 lines trigger 0 warnings and 0 violations; files at 240 and 300 lines trigger warnings but exit 0; and files at 301 lines trigger a fatal violation and exit 1.
3. **Premise 3 (Teamwork Layout Protection)**: By inspecting `.agents/teamwork/` for source/data extensions (`.ts`, `.tsx`, `.js`, `.json`) and root rule overrides (`AGENTS.md`, `GEMINI.md`), `checkTeamworkLayoutCompliance` ensures agent workspaces cannot contaminate TypeScript builds or override system instructions. Observation 1.4 proves all forbidden variants are rejected while permitted metadata markdown files pass cleanly.
4. **Premise 4 (Resilience Under Degradation)**: Pure compilation functions in `state-markdown-compiler.ts` and domain heuristics in `critic-domain-targets.ts` must tolerate empty states, novel domain descriptions, and missing fields. Observation 1.5 proves that zero unhandled exceptions occur across synthetic empty objects, missing phases, corrupt inputs, or missing directories.
5. **Conclusion**: Features 1 and 2 meet all functional, modularity, and architectural requirements with zero regressions.

---

## 3. Adversarial Review & Stress Test Results

### Challenge Summary
- **Overall risk assessment**: **LOW**
- **Architecture**: Pure deterministic utility separation with zero circular dependencies and zero external dependencies.

### Detailed Challenges

#### Challenge 1: Line Count Boundary Conditions & Exit Codes
- **Assumption challenged**: `check-boundaries.ts` might misclassify boundary lines (e.g. Off-by-One error at 240 or 300 lines, or exit with code 1 when only warnings are present).
- **Attack scenario**: Inject synthetic files of exact line counts 239, 240, 300, and 301 into a mock repository and execute boundary check.
- **Blast radius**: If 240 lines fails the build, CI would break on legitimate near-cap files; if 301 lines passes, modularity creep goes unchecked.
- **Result**: PASSED. 239 lines = clean, 240 lines = warning (exit 0), 300 lines = warning (exit 0), 301 lines = violation (exit 1).

#### Challenge 2: Workspace Layout Bypass via Case Variation or Subdirectories
- **Assumption challenged**: Agents creating illegal files inside subdirectories (e.g. `.agents/teamwork/agent_1/sub/test.ts`) or with uppercase extensions (`.TS`, `.JSON`) or mixed-case rule files (`Agents.Md`) might evade layout detection.
- **Attack scenario**: Inject nested subdirectories with `.TS`, `.Tsx`, `.js`, `.json`, and varied-casing `AGENTS.MD` and `gemini.md`.
- **Blast radius**: Build pollution or unauthorized prompt override injection.
- **Result**: PASSED. Recursive scanner detected all 13 injected forbidden variants.

#### Challenge 3: Compiler Null Pointer Exceptions on Empty State or Corrupted Backlog
- **Assumption challenged**: `compileStateMarkdown` or `compileRoadmapMarkdown` might access undefined array indices (e.g., `state.hotspots[0].file`) or throw during regex parsing of malformed critic outputs.
- **Attack scenario**: Feed empty objects `{ hotspots: [], recentCommits: [], prescriptions: [] }` and malformed Markdown without standard headers into compilers.
- **Blast radius**: Hermes sync crash (`npm run sync:state`) halting automated phase handoff.
- **Result**: PASSED. `state.hotspots[0]` guards fallback to `'none'`, empty commits format cleanly, and regex parser ignores malformed lines with zero unhandled exceptions.

#### Challenge 4: Unmapped Domain Keywords in Phase Titles
- **Assumption challenged**: Hermes critic resolving domain target files for a completely new or unmapped phase domain (e.g., Phase 99 or exotic mechanics) might return empty candidate arrays, leading to downstream undefined errors.
- **Attack scenario**: Call `resolvePhaseDomainTargetFiles` with empty strings, unmapped domain titles, and non-existent root directories.
- **Blast radius**: `hermes:critic` failure during post-phase evaluation.
- **Result**: PASSED. Unmapped domains and missing directories reliably fall back to `['src/sim/core/engine.ts']`.

### Stress Test Matrix

| Scenario | Input | Expected Output | Actual Output | Result |
|---|---|---|---|---|
| Line Count: 239 | 239-line `.ts` file | 0 violations, 0 warnings | 0 violations, 0 warnings | **PASS** |
| Line Count: 240 | 240-line `.ts` file | 0 violations, 1 warning (exit 0) | 0 violations, 1 warning (exit 0) | **PASS** |
| Line Count: 300 | 300-line `.ts` file | 0 violations, 1 warning (exit 0) | 0 violations, 1 warning (exit 0) | **PASS** |
| Line Count: 301 | 301-line `.ts` file | 1 violation (exit 1) | 1 violation (exit 1) | **PASS** |
| Teamwork Layout: Bad Exts | `.ts`, `.tsx`, `.js`, `.json`, `.TS` in `.agents/teamwork/` | Detected and flagged as illegal | 7/7 flagged | **PASS** |
| Teamwork Layout: Rule Files | `AGENTS.md`, `GEMINI.md`, `agents.md` in `.agents/teamwork/` | Detected and flagged as forbidden | 6/6 flagged | **PASS** |
| Teamwork Layout: Clean Workspace | `.md`, `.gitkeep`, `.txt` in `.agents/teamwork/` | 0 violations | 0 violations | **PASS** |
| State Compiler: Empty State | Empty `ProjectState` with empty arrays/strings | Valid Markdown, topHotspot: 'none', 0 exceptions | Valid Markdown, 0 exceptions | **PASS** |
| Roadmap Compiler: Idempotency | Re-compiling already completed roadmap phases | No duplicate `*(Completed)*`, idempotent output | Idempotent, zero duplicate tokens | **PASS** |
| Critic Resolver: Unmapped Domain | `"Phase 999: Exotic Alien Domain"` | Fallback to `src/sim/core/engine.ts` | Returns `['src/sim/core/engine.ts']` | **PASS** |
| Critic Resolver: Missing RootDir | `/nonexistent/dir` | Fallback to `src/sim/core/engine.ts` | Returns `['src/sim/core/engine.ts']` | **PASS** |
| Telemetry Anomalies: Zeros/Negatives | `{ totalProjectionLeaks: 0, unwiredCount: -5 }` | 0 anomalies, zero crashes | 0 anomalies, zero crashes | **PASS** |

### Unchallenged Areas
- Dynamic file writing under concurrent disk I/O contention (out of scope for deterministic CLI scripts).

---

## 4. Caveats

No caveats. All boundary thresholds, layout rules, error paths, and modularity limits were empirically exercised and confirmed.

---

## 5. Conclusion

**Verdict: PASS**

The Milestone 1 implementation of Feature 1 (Tooling Modularity Pre-Splitting) and Feature 2 (Early Warnings & Layout Compliance) is architecturally sound, thoroughly tested, and resilient against edge cases. All 13 affected files conform strictly to line ceilings (all <= 239 lines except tests <= 204 lines). `npm run verify` runs 100% clean with 124 passed test files and 654 passed unit tests.

---

## 6. Verification Method

To independently reproduce and verify this assessment:

1. **Targeted Unit Tests**:
   ```bash
   npx vitest run tests/sim/check-boundaries.test.ts tests/sim/phase53-governance-state.test.ts
   ```
   *Expected*: 2 test files passed, 9 tests passed.

2. **Full Repository Verification Suite**:
   ```bash
   npm run verify
   ```
   *Expected*: All 4 gates pass cleanly (`tsc`, `check-boundaries`, `validate-data`, `test:sim` with 654 tests passed).

3. **Line Count Ceiling Verification**:
   ```bash
   node -e "
   const fs = require('fs');
   const files = [
     'tests/scripts/state-markdown-compiler.ts',
     'tests/scripts/update-state.ts',
     'tests/scripts/critic-domain-targets.ts',
     'tests/scripts/hermes-critic.ts',
     'tests/scripts/check-boundaries.ts',
     'tests/scripts/local-llm-ledger.ts',
     'tests/scripts/projection-cell-scanner.ts',
     'tests/scripts/playtester-projection-audit.ts',
     'tests/scripts/critic-report.ts',
     'tests/scripts/local-llm-config.ts',
     'tests/scripts/llm-playtester.ts',
     'tests/sim/check-boundaries.test.ts',
     'tests/sim/phase53-governance-state.test.ts'
   ];
   for (const f of files) {
     const len = fs.readFileSync(f, 'utf8').split('\n').length;
     console.log(f + ': ' + len + ' lines (' + (len <= 250 ? 'PASS' : 'FAIL') + ')');
   }
   "
   ```
   *Expected*: All 13 files report `PASS` (<= 250 lines).

4. **Teamwork Layout Compliance Check**:
   ```bash
   npx tsx -e "
   import { checkTeamworkLayoutCompliance } from './tests/scripts/check-boundaries.ts';
   const v = [];
   checkTeamworkLayoutCompliance(process.cwd(), v);
   console.log('Layout violations count:', v.length);
   if (v.length !== 0) process.exit(1);
   "
   ```
   *Expected*: `Layout violations count: 0`.
