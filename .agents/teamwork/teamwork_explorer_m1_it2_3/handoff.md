# Handoff Report: Explorer 3 — Iteration 2 Test Validation Strategy

## 1. Observation

### 1.1 Baseline Test Suite & Invariant Status
- **Target Test File**: `tests/sim/tactical-console-stress.test.ts` (current size: 225 lines, target $\le 250$, hard limit 300).
- **Current Targeted Test Run**:
  ```bash
  npx vitest run tests/sim/tactical-console-stress.test.ts
  ```
  Result: 5 passed in 932ms.
- **Current Verify Gate Run**:
  ```bash
  npm run verify
  ```
  Result: 0 errors, 410 files passed boundaries, 113 test files passed, 590 unit tests passed.

### 1.2 Direct Inspection of Vulnerability Assertions in `tactical-console-stress.test.ts`
1. **Vulnerability A Reproduction Assertion** (lines 76–89):
   ```ts
   // Scenario D: Vulnerability reproduction: unconstrained HP >= 999,999 clobbers border and overflows
   for (const slot of SLOTS) {
     prostheticLimbs[slot] = { slot, hp: 999999, maxHp: 50, amputated: false };
   }
   const bufD = createSentinelBuffer(90, 36);
   renderTacticalConsole(bufD, CONSOLE_RECT, state, playerId);
   expect(bufD.getCell(87, 21)?.glyph, 'Col 87 border overwritten by unconstrained HP').toBe('P');

   for (const slot of SLOTS) {
     prostheticLimbs[slot] = { slot, hp: 9999999, maxHp: 50, amputated: false };
   }
   const bufE = createSentinelBuffer(90, 36);
   renderTacticalConsole(bufE, CONSOLE_RECT, state, playerId);
   expect(bufE.getCell(88, 21)?.glyph, 'Col 88 buffer overflow outside 30-col console').toBe('P');
   ```
   - *Observation*: The test currently actively asserts that `'P'` clobbers column 87 and spills into column 88. Once `dossier-paperdoll.ts` is hardened to clamp or slice HP strings, these assertions will FAIL because column 87 will remain `'║'` and column 88 will remain `'~'`.

2. **Vulnerability B Reproduction Assertion** (lines 193–199):
   ```ts
   // Scenario D: Vulnerability reproduction: unhandled event in eventLog triggers TypeError in console-chronicle
   state.eventLog = [{ type: 'NONEXISTENT_EVENT_TYPE', turn: 1 } as any];
   const bufD = createSentinelBuffer();
   expect(() => renderTacticalConsole(bufD, CONSOLE_RECT, state, playerId)).toThrow(
     /Cannot read properties of undefined/i,
   );
   ```
   - *Observation*: The test currently asserts that an unhandled event throws `TypeError: Cannot read properties of undefined`. Once `console-chronicle.ts` and `EventFormatter.ts` are guarded against null/undefined lines, this assertion will FAIL because the renderer will no longer throw.

3. **Latent Test Suite Gap in `assertNoBufferOverflowOutsideConsole`** (lines 17–23):
   ```ts
   function assertNoBufferOverflowOutsideConsole(buf: ReturnType<typeof createSentinelBuffer>) {
     for (let y = 0; y < buf.height; y++) {
       for (let x = 0; x < 58; x++) {
         expect(buf.getCell(x, y)?.glyph, `Buffer clobbered at (${x},${y})`).toBe('~');
       }
     }
   }
   ```
   - *Observation*: This helper only audits columns $0 \le x < 58$ (left of the console). It does NOT check $x \ge 88$ (right of the console). A buffer overflow on the right side of the console will completely escape detection unless explicitly asserted at individual cells.

---

## 2. Logic Chain

1. **Test Role Shift from Reproduction to Resolution Verification**:
   - In Iteration 1, Challenger 1 wrote tests to reproduce the failure modes reported in `handoff.md`.
   - In Iteration 2, the mission is to verify that both vulnerabilities are definitively resolved.
   - Therefore, the test suite must assert the invariant requirements: zero border clobbering, zero out-of-bounds writes, zero runtime exceptions, and zero `NaN`/`undefined`/`null` string leaks.

2. **Verifying Vulnerability A (Paperdoll Boundary Hardening)**:
   - Console rectangle is $\{ x: 58, y: 0, width: 30, height: 36 \}$.
   - The right bezel border glyph is positioned at $x = 58 + 30 - 1 = 87$.
   - Columns outside the console are $x < 58$ and $x \ge 88$.
   - For all paperdoll rows ($y \in [19, 24]$):
     - At $x = 87$, the cell glyph MUST remain `'║'`.
     - At $x \ge 88$, the cell glyph MUST remain `'~'`.
   - Defensive stress cases to assert:
     - 6-digit HP (`999999`) and 7-digit HP (`9999999`) across all 6 limb slots.
     - Negative HP (`-999999`).
     - Extreme vitals: stamina (`999999`), toxicity (`999999`), pain (`999999`) on Row 24 ($y = 19 + 5$).
   - Bidirectional sentinel helper:
     Updating `assertNoBufferOverflowOutsideConsole` to check both $0 \le x < 58$ and $88 \le x < \text{width}$ guarantees total buffer isolation.

3. **Verifying Vulnerability B (Chronicle Null-Safety Hardening)**:
   - An unhandled event variant (e.g. `{ type: 'NONEXISTENT_EVENT_TYPE', turn: 1 }`) must NOT crash `renderTacticalConsole`.
   - A malformed event log containing `undefined` or `null` entries must NOT crash `renderTacticalConsole`.
   - In all scenarios, `expect(() => renderTacticalConsole(...)).not.toThrow()` must succeed.
   - The chronicle lines rendered at rows 26..29 must NOT contain the literal substrings `"undefined"`, `"null"`, or `"NaN"`.
   - `assertNoNanOrUndefinedStringLeaks(buf)` must pass across all 36 rows.

4. **Modularity & 300-Line Boundary Compliance**:
   - `tests/sim/tactical-console-stress.test.ts` is currently 225 lines.
   - The proposed upgrade adds ~8 lines net (replacing bug assertions with comprehensive invariant checks).
   - Expected post-edit length: ~233 lines ($\le 250$ lines target ceiling, well below 300 lines hard gate).

5. **Reconciliation with `npm run verify`**:
   - `typecheck` (`tsc --noEmit`): Compiles with zero errors under strict TypeScript settings.
   - `check:boundaries`: Passes with zero violations (no forbidden imports, no Math.random, length $\le 300$).
   - `validate:data`: Passes with zero errors.
   - `test:sim`: All 113 test files and all tests pass cleanly.

---

## 3. Caveats

1. **Adversarial Type Casting in Stress Tests**:
   - Testing `{ type: 'NONEXISTENT_EVENT_TYPE' } as any` or `undefined as any` purposefully violates TypeScript compile-time types using `as any` to simulate corrupted memory, untyped network payloads, or backward-incompatible save states. This is standard in adversarial stress testing.
2. **Deterministic Layout Assumptions**:
   - The test assertions rely on the standard console width of 30 columns positioned at $x = 58$. If `CONSOLE_RECT` parameters are changed in future phases, the boundary helper should continue using `rect.x + rect.width`.

---

## 4. Conclusion

The validation strategy requires updating `tests/sim/tactical-console-stress.test.ts` in three targeted locations:
1. Upgrade `assertNoBufferOverflowOutsideConsole` to bidirectional checking ($x < 58$ AND $x \ge 88$).
2. Replace Vulnerability A reproduction assertions with affirmative border preservation and overflow isolation assertions for 6-digit HP, 7-digit HP, negative HP, and extreme vitals.
3. Replace Vulnerability B reproduction assertion with affirmative null/undefined resilience assertions and string leak audits.

### Proposed Code Diffs for `tests/sim/tactical-console-stress.test.ts`

#### Chunk 1: Upgrade `assertNoBufferOverflowOutsideConsole` to Bidirectional
```ts
<<<<
  function assertNoBufferOverflowOutsideConsole(buf: ReturnType<typeof createSentinelBuffer>) {
    for (let y = 0; y < buf.height; y++) {
      for (let x = 0; x < 58; x++) {
        expect(buf.getCell(x, y)?.glyph, `Buffer clobbered at (${x},${y})`).toBe('~');
      }
    }
  }
====
  function assertNoBufferOverflowOutsideConsole(buf: ReturnType<typeof createSentinelBuffer>) {
    for (let y = 0; y < buf.height; y++) {
      for (let x = 0; x < 58; x++) {
        expect(buf.getCell(x, y)?.glyph, `Buffer clobbered at left (${x},${y})`).toBe('~');
      }
      for (let x = 88; x < buf.width; x++) {
        expect(buf.getCell(x, y)?.glyph, `Buffer clobbered at right (${x},${y})`).toBe('~');
      }
    }
  }
>>>>
```

#### Chunk 2: Resolve Vulnerability A (Paperdoll Extreme HP & Vitals Invariant)
```ts
<<<<
    // Scenario D: Vulnerability reproduction: unconstrained HP >= 999,999 clobbers border and overflows
    for (const slot of SLOTS) {
      prostheticLimbs[slot] = { slot, hp: 999999, maxHp: 50, amputated: false };
    }
    const bufD = createSentinelBuffer(90, 36);
    renderTacticalConsole(bufD, CONSOLE_RECT, state, playerId);
    expect(bufD.getCell(87, 21)?.glyph, 'Col 87 border overwritten by unconstrained HP').toBe('P');

    for (const slot of SLOTS) {
      prostheticLimbs[slot] = { slot, hp: 9999999, maxHp: 50, amputated: false };
    }
    const bufE = createSentinelBuffer(90, 36);
    renderTacticalConsole(bufE, CONSOLE_RECT, state, playerId);
    expect(bufE.getCell(88, 21)?.glyph, 'Col 88 buffer overflow outside 30-col console').toBe('P');
====
    // Scenario D: Extreme HP & Vitals Hardening: borders preserved, zero overflow outside console
    for (const slot of SLOTS) {
      prostheticLimbs[slot] = { slot, hp: 999999, maxHp: 50, amputated: false };
    }
    const bufD = createSentinelBuffer(90, 36);
    expect(() => renderTacticalConsole(bufD, CONSOLE_RECT, state, playerId)).not.toThrow();
    expect(bufD.getCell(87, 21)?.glyph, 'Col 87 border preserved under 6-digit HP').toBe('║');
    assertNoBufferOverflowOutsideConsole(bufD);
    assertNoNanOrUndefinedStringLeaks(bufD);

    for (const slot of SLOTS) {
      prostheticLimbs[slot] = { slot, hp: 9999999, maxHp: 50, amputated: false };
    }
    player.anatomy = { ...player.anatomy!, stamina: 999999, toxicityPct: 999999, painShock: 999999 };
    const bufE = createSentinelBuffer(90, 36);
    expect(() => renderTacticalConsole(bufE, CONSOLE_RECT, state, playerId)).not.toThrow();
    for (let r = 19; r <= 24; r++) {
      expect(bufE.getCell(87, r)?.glyph, `Paperdoll row ${r} border preserved under extreme values`).toBe('║');
    }
    assertNoBufferOverflowOutsideConsole(bufE);
    assertNoNanOrUndefinedStringLeaks(bufE);
>>>>
```

#### Chunk 3: Resolve Vulnerability B (Chronicle Unhandled/Corrupt Event Invariant)
```ts
<<<<
    // Scenario D: Vulnerability reproduction: unhandled event in eventLog triggers TypeError in console-chronicle
    state.eventLog = [{ type: 'NONEXISTENT_EVENT_TYPE', turn: 1 } as any];
    const bufD = createSentinelBuffer();
    expect(() => renderTacticalConsole(bufD, CONSOLE_RECT, state, playerId)).toThrow(
      /Cannot read properties of undefined/i,
    );
====
    // Scenario D: Resilient chronicle ticker: unhandled/malformed simulation events never crash
    state.eventLog = [
      { type: 'NONEXISTENT_EVENT_TYPE', turn: 1 } as any,
      undefined as any,
      null as any,
      { type: 'UNKNOWN_FUTURE_EVENT', turn: 5 } as any,
    ];
    const bufD = createSentinelBuffer(90, 36);
    expect(() => renderTacticalConsole(bufD, CONSOLE_RECT, state, playerId)).not.toThrow();
    assertNoBufferOverflowOutsideConsole(bufD);
    assertNoNanOrUndefinedStringLeaks(bufD);
    const tickerText = [26, 27, 28, 29].map((r) => bufD.extractRowString(r)).join('\n');
    expect(tickerText).not.toContain('undefined');
    expect(tickerText).not.toContain('null');
>>>>
```

---

## 5. Verification Method

To independently verify the test strategy and overall repository health:

1. **Verify Line Counts & Modularity**:
   ```bash
   wc -l tests/sim/tactical-console-stress.test.ts src/client/canvas-ui/dossier-paperdoll.ts src/client/canvas-ui/console-chronicle.ts
   ```
   *Expected Result*: All files remain strictly $\le 250$ lines (and well under the 300-line hard ceiling).

2. **Execute Targeted Stress Suite**:
   ```bash
   npx vitest run tests/sim/tactical-console-stress.test.ts
   ```
   *Expected Result*: All 5 test cases pass cleanly (5/5 passed), confirming zero exceptions, zero buffer overflows, zero border clobbering, and zero string leaks.

3. **Execute Full Repository Verification Gate**:
   ```bash
   npm run verify
   ```
   *Expected Result*:
   - `typecheck` (`tsc --noEmit`): exit code 0.
   - `check:boundaries`: 0 violations across all 410+ files.
   - `validate:data`: 0 validation errors.
   - `test:sim`: 113 test files passed, 590+ unit tests passed.

4. **Invalidation Conditions**:
   - If `buf.getCell(87, 21)?.glyph` is anything other than `'║'`, Vulnerability A is NOT resolved.
   - If `buf.getCell(88, y)?.glyph` is anything other than `'~'`, out-of-bounds buffer overflow has occurred.
   - If `renderTacticalConsole` throws any exception when `eventLog` has an unhandled event, Vulnerability B is NOT resolved.
   - If any rendered cell row matches `/undefined|null|NaN/i`, presentation leakage is occurring.
