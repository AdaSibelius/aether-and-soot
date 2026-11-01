# Handoff Report: Explorer 2 — Chronicle Null-Safety & Fallback Hardening Strategy

## 1. Observation

### 1.1 Root Cause Telemetry & Verbatim Code Analysis
Direct code inspection of the chronicle rendering pipeline reveals the causal chain leading to the fatal runtime crash documented in Challenger 1's report:

1. **`src/client/canvas-ui/console-chronicle.ts:63–67`**:
   ```ts
   63:   for (let idx = 0; idx < lines.length; idx++) {
   64:     const rawLine = lines[idx]!;
   65:     // Strip turn range prefix [T123] or [T12–T14] for clean ticker readout
   66:     const clean = rawLine.replace(/^\[T\d+(?:–T\d+)?\]\s*/, '');
   67:     const rowY = y + offset + idx;
   ```
   - **Flaw**: Line 64 uses the TypeScript non-null assertion operator (`!`) to suppress the compiler's `string | undefined` warning (from `noUncheckedIndexedAccess: true`).
   - If any element of `lines` is `undefined`, `null`, or non-string at runtime, line 66 immediately invokes `.replace()` on an undefined reference, crashing with:
     ```
     TypeError: Cannot read properties of undefined (reading 'replace')
       at Module.renderPneumaticTickerChronicle (src/client/canvas-ui/console-chronicle.ts:66:27)
       at Module.renderTacticalConsole (src/client/canvas-ui/tactical-console.ts:130:3)
     ```

2. **`src/client/ui/EventFormatter.ts:7–222`**:
   ```ts
   7:  export function formatEventMessage(ev: SimEvent): string {
   8:    switch (ev.type) {
   9:      case 'ENTITY_MOVED':
   ...
   220:    case 'DISTRICT_CAUSAL_CASCADE_TRIGGERED':
   221:      return `[T${ev.turn}] The unbridled chaos of the causal cascade threatens to engulf the district!`;
   222:    }
   223:  }
   ```
   - **Flaw**: The switch statement handles all currently known variants of the `SimEvent` discriminated union, but completely lacks a `default:` branch.
   - While `tsc --noEmit` considers the switch exhaustive based on `events.schema.ts`, any runtime event with an unexpected, forward-migrated, or adversarial event type (such as `{ type: 'NONEXISTENT_EVENT_TYPE', turn: 1 }` in tests) bypasses all cases.
   - In JavaScript, a switch with no matching case and no default exits without returning a value, evaluating to `undefined`.

3. **`src/client/ui/EventFormatterDomain.ts:38, 42`**:
   ```ts
   38:         result.push(formatEventMessage(ev));
   ...
   42:       result.push(formatEventMessage(ev));
   ```
   - **Flaw**: `aggregateChronicleEvents` pushes the output of `formatEventMessage(ev)` directly into `result: string[]` without verifying that the returned value is a non-empty string.
   - Consequently, `result` contains `undefined`, which flows directly into `lines` in `console-chronicle.ts`.

4. **Line Count & Modularity Status**:
   - `src/client/canvas-ui/console-chronicle.ts`: 81 lines (`wc -l`). Must stay $\le 90$ lines per dispatch contract.
   - `src/client/ui/EventFormatter.ts`: 228 lines (`wc -l`). Must stay $\le 250$ lines (hard modularity limit: 300).
   - `src/client/ui/EventFormatterDomain.ts`: 48 lines (`wc -l`).

---

## 2. Logic Chain

1. **Failure Mechanics Trace**:
   - Step 1: An unrecognized or invalid event enters `state.eventLog` (Observation 1.2).
   - Step 2: `aggregateChronicleEvents` calls `formatEventMessage(ev)` on that event (Observation 1.3).
   - Step 3: `formatEventMessage` lacks a `default` case and returns `undefined` (Observation 1.2).
   - Step 4: `aggregateChronicleEvents` appends `undefined` to `result` (Observation 1.3).
   - Step 5: `console-chronicle.ts` retrieves `lines` with length 1 containing `[undefined]` (Observation 1.1).
   - Step 6: `console-chronicle.ts` skips the `if (lines.length === 0)` guard because `lines.length` is 1.
   - Step 7: In the loop at index 0, `lines[0]!` evaluates to `undefined`.
   - Step 8: `rawLine.replace(...)` triggers fatal `TypeError` (Observation 1.1).

2. **Defense-in-Depth Requirements**:
   - **Layer 1 (Producer / Formatter)**: `EventFormatter.ts` must guarantee that `formatEventMessage` never returns `undefined`, even when fed unknown or malformed events.
   - **Layer 2 (Consumer / Canvas Chronicle)**: `console-chronicle.ts` must never trust incoming array elements to be valid strings. It must:
     a) Filter out empty/non-string items before calculating line counts and offsets.
     b) Guard inside the render loop so `rawLine.replace(...)` is only called on valid strings.

3. **Strict TypeScript & Rule 2.3 Compliance**:
   - Rule 2.3 forbids `any`, `as unknown as`, and `@ts-ignore`.
   - In `EventFormatter.ts`, because the switch covers all declared union members of `SimEvent`, the type of `ev` in `default:` is narrowed by TypeScript to `never`.
   - In TypeScript, `never` is the bottom type and is assignable to any type without a type assertion.
   - Assigning `ev` to `const fallback: { turn?: number; type?: string } | null | undefined = ev;` requires **zero type casts**, compiles with `strict: true`, and safely accesses `fallback?.turn` and `fallback?.type` at runtime.

4. **AST Compatibility**:
   - `tests/scripts/hermes-chronicler.ts:130` uses `lastIndexOf('    case ')` and `indexOf(';\n', lastCaseIndex)` to inject newly generated cases into `EventFormatter.ts`.
   - Placing `default:` after all `case` statements preserves this invariant: `lastIndexOf('    case ')` continues to find the last `case` statement, and new cases are cleanly injected before `default:`.

---

## 3. Caveats

1. **Scope of Hardening**: This strategy focuses strictly on chronicle rendering and formatting (`console-chronicle.ts`, `EventFormatter.ts`, and `EventFormatterDomain.ts`). Paperdoll HP overflow (Challenger Vulnerability A) is tracked separately.
2. **Test Suite Adaptation**: In `tests/sim/tactical-console-stress.test.ts:196`, Scenario D was authored by Challenger 1 to assert that `renderTacticalConsole` threw a `TypeError`. When this hardening fix is applied, that assertion must be updated to `.not.toThrow()` with buffer leak assertions.
3. **Preact HUD Parity**: Preact's `HudLayout.tsx` also consumes `aggregateChronicleEvents`. Hardening `EventFormatter.ts` protects both Canvas and Preact renderers simultaneously.

---

## 4. Conclusion & Exact Replacement Diffs

### 4.1 Implementation Strategy
Apply a synchronized two-layer patch:
1. **Producer Hardening** (`src/client/ui/EventFormatter.ts`): Add a Victorian-styled `default:` case with typed fallback properties.
2. **Consumer Hardening** (`src/client/canvas-ui/console-chronicle.ts`): Cleanse `lines` via `.filter(...)` upon retrieval and replace `lines[idx]!` with a safe `if (!rawLine) continue;` guard.

### 4.2 Exact Replacement Diffs

#### Diff 1: `src/client/canvas-ui/console-chronicle.ts`
```diff
--- src/client/canvas-ui/console-chronicle.ts
+++ src/client/canvas-ui/console-chronicle.ts
@@ -26,3 +26,5 @@
   const maxLines = Math.max(1, height);
   const rawEvents = state.eventLog ?? [];
-  const lines = aggregateChronicleEvents(rawEvents, maxLines);
+  const lines = aggregateChronicleEvents(rawEvents, maxLines).filter(
+    (l): l is string => typeof l === 'string' && l.trim().length > 0,
+  );
   const maxChars = Math.max(10, width);
@@ -63,4 +65,5 @@
   for (let idx = 0; idx < lines.length; idx++) {
-    const rawLine = lines[idx]!;
+    const rawLine = lines[idx];
+    if (!rawLine) continue;
     // Strip turn range prefix [T123] or [T12–T14] for clean ticker readout
     const clean = rawLine.replace(/^\[T\d+(?:–T\d+)?\]\s*/, '');
```

*File metrics after change*: 84 lines (`wc -l`). Well below the 90-line requirement.

#### Diff 2: `src/client/ui/EventFormatter.ts`
```diff
--- src/client/ui/EventFormatter.ts
+++ src/client/ui/EventFormatter.ts
@@ -220,3 +220,9 @@
     case 'DISTRICT_CAUSAL_CASCADE_TRIGGERED':
       return `[T${ev.turn}] The unbridled chaos of the causal cascade threatens to engulf the district!`;
+    default: {
+      const fallback: { turn?: number; type?: string } | null | undefined = ev;
+      const turnPrefix = typeof fallback?.turn === 'number' ? `[T${fallback.turn}] ` : '';
+      const eventType = typeof fallback?.type === 'string' ? fallback.type : 'UNKNOWN_EVENT';
+      return `${turnPrefix}Telegraph dispatch: ${eventType}.`;
+    }
   }
 }
```

*File metrics after change*: 235 lines (`wc -l`). Well below the 250-line target ceiling and 300-line hard ceiling.

#### Diff 3: `tests/sim/tactical-console-stress.test.ts` (Regression Assertion Update)
```diff
--- tests/sim/tactical-console-stress.test.ts
+++ tests/sim/tactical-console-stress.test.ts
@@ -193,7 +193,9 @@
-    // Scenario D: Vulnerability reproduction: unhandled event in eventLog triggers TypeError in console-chronicle
+    // Scenario D: Hardened unhandled event fallback: safe telegraph rendering without runtime crash
     state.eventLog = [{ type: 'NONEXISTENT_EVENT_TYPE', turn: 1 } as any];
     const bufD = createSentinelBuffer();
-    expect(() => renderTacticalConsole(bufD, CONSOLE_RECT, state, playerId)).toThrow(
-      /Cannot read properties of undefined/i,
-    );
+    expect(() => renderTacticalConsole(bufD, CONSOLE_RECT, state, playerId)).not.toThrow();
+    assertNoBufferOverflowOutsideConsole(bufD);
+    assertNoNanOrUndefinedStringLeaks(bufD);
+    expect(bufD.extractRowString(29)).toContain('NONEXISTENT_EVENT_TYPE');
   });
```

---

## 5. Verification Method

To independently verify the hardening once applied:

1. **Targeted Adversarial Stress Test**:
   ```bash
   npx vitest run tests/sim/tactical-console-stress.test.ts
   ```
   *Expected Result*: All 5 test suites pass, specifically confirming that Scenario D executes `.not.toThrow()`, renders the fallback without leaking `undefined` strings, and leaves buffer borders unmolested.

2. **Chronicler Tooling Regression**:
   ```bash
   npx vitest run tests/sim/hermes-chronicler.test.ts
   ```
   *Expected Result*: Passes cleanly, verifying that the AST case injection mechanism in `tests/scripts/hermes-chronicler.ts` is unaffected by the presence of `default:`.

3. **Full Repository Verification**:
   ```bash
   npm run verify
   ```
   *Expected Result*:
   - `typecheck` (`tsc --noEmit`): Exit code 0, 0 type errors.
   - `check:boundaries`: Exit code 0, zero files over 300 lines.
   - `validate:data`: Exit code 0.
   - `test:sim`: All 113+ test files pass.

4. **Line Count Verification**:
   ```bash
   wc -l src/client/canvas-ui/console-chronicle.ts src/client/ui/EventFormatter.ts
   ```
   *Expected Result*:
   - `console-chronicle.ts` $\le 90$ lines (projected: 84).
   - `EventFormatter.ts` $\le 250$ lines (projected: 235).
