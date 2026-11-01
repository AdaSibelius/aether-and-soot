# Handoff Report: Explorer It2.1 — Paperdoll Boundary Hardening Strategy

## 1. Observation

### 1.1 Console Coordinate System & Geometry
In `src/client/canvas-ui/tactical-console.ts:50–59`:
```ts
  drawMachinedBezel(buf, rect, {
    title: 'AETHER & SOOT CONSOLE',
    rivetStyle: 'BRASS_BOLTS',
    fgColor: VICTORIAN_PALETTE.TARNISHED_BRASS,
    bgColor: VICTORIAN_PALETTE.SOOT_IRON_BG,
  });

  const innerX = x + 2;
  const innerW = width - 4; // 26 chars
```
And in `tests/sim/tactical-console-stress.test.ts:25`:
```ts
const CONSOLE_RECT = { x: 58, y: 0, width: 30, height: 36 };
```
- Console origin: `x = 58`, `width = 30`.
- Left Bezel Border (`║`): `column 58` (`rect.x`).
- Left Inner Padding: `column 59` (`rect.x + 1`).
- Content Area (`innerX` to `innerX + innerW - 1`): `columns 60..85` (26 character columns).
- Right Inner Padding: `column 86` (`rect.x + rect.width - 2 = 58 + 28 = 86`).
- Right Bezel Border (`║`): `column 87` (`rect.x + rect.width - 1 = 58 + 29 = 87`).
- Buffer Out-Of-Bounds: `column 88` (`rect.x + rect.width = 58 + 30 = 88`) and beyond.

### 1.2 Unconstrained Write Call Sites in `src/client/canvas-ui/dossier-paperdoll.ts`
In `renderCompactPaperdoll` (lines 146–170), with `x = innerX = 60`:

1. **Right Arm HP (`rArm.hp`) — Line 149**:
   ```ts
   buf.writeString(x + 20, y + 2, `${rArm.hp}HP`.padStart(5, ' '), VICTORIAN_PALETTE.RIVET_STEEL);
   ```
   - Start column: $60 + 20 = 80$.
   - Available space within `innerW`: columns $80, 81, 82, 83, 84, 85$ (exactly 6 characters).
   - Column 86 is right margin padding (`' '`).
   - Column 87 is the right bezel border (`'║'`).
   - When `rArm.hp = 999999` (6 digits), `${rArm.hp}HP` has 8 characters (`"999999HP"`). The 8th character (`'P'`) is written to column $80 + 7 = 87$, clobbering the bezel border glyph `'║'`.
   - When `rArm.hp = 9999999` (7 digits), `${rArm.hp}HP` has 9 characters (`"9999999HP"`). The 9th character (`'P'`) is written to column $80 + 8 = 88$, which is outside the console boundary.

2. **Right Leg HP (`rLeg.hp`) — Line 159**:
   ```ts
   buf.writeString(x + 17, y + 4, `${rLeg.hp}HP`.padStart(5, ' '), VICTORIAN_PALETTE.RIVET_STEEL);
   ```
   - Start column: $60 + 17 = 77$.
   - Available space within `innerW`: columns $77..85$ (9 characters).
   - Column 86 is column $77 + 9$ (10th character).
   - Column 87 is column $77 + 10$ (11th character).
   - When `rLeg.hp >= 100000000` (9 digits), `${rLeg.hp}HP` has $\ge 11$ characters, overwriting column 87.
   - When `rLeg.hp >= 1000000000` (10 digits), `${rLeg.hp}HP` has $\ge 12$ characters, spilling into column 88.

3. **Stamina Readout (`STM:${stam}%`) — Line 169**:
   ```ts
   buf.writeString(x + 18, y + 5, `STM:${stam}%`, VICTORIAN_PALETTE.POLISHED_BRASS);
   ```
   - Start column: $60 + 18 = 78$.
   - Available space within `innerW`: columns $78..85$ (8 characters).
   - Column 86 is column $78 + 8$ (9th character).
   - Column 87 is column $78 + 9$ (10th character).
   - Template boilerplate `STM:%` has 5 characters (`'S'`, `'T'`, `'M'`, `':'`, `'%'`).
   - When `stam` has 5 digits (e.g. `10000`), string has 10 characters (`"STM:10000%"`), clobbering the right border at column 87.
   - When `stam` has 6 digits (e.g. `100000`), string has 11 characters (`"STM:100000%"`), spilling into column 88.

### 1.3 Audit of Challenger 1's Proposal
Challenger 1 suggested:
```ts
buf.writeString(x + 20, y + 2, `${Math.min(9999, rArm.hp)}HP`.padStart(5, ' ').slice(0, 5), VICTORIAN_PALETTE.RIVET_STEEL);
```
- **Flaw Detected**: If `rArm.hp` is `9999` (the high 4-digit HP tested in Scenario C of `tactical-console-stress.test.ts`), `${Math.min(9999, 9999)}HP` is `"9999HP"` (6 characters).
- Applying `.slice(0, 5)` truncates `"9999HP"` to `"9999H"`, dropping the `'P'` unit suffix and corrupting valid 4-digit HP readouts.
- Furthermore, it does not guard negative values (e.g. `hp: -100` would produce `"-100H"`).
- Since column 80 to column 85 provides 6 full character cells inside `innerW`, the slice ceiling must be **6 characters** (`.slice(0, 6)`), not 5.

### 1.4 Test Suite Coupling in `tests/sim/tactical-console-stress.test.ts`
In lines 76–90:
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
Because Scenario D was authored as an adversarial reproduction that deliberately asserts the presence of `'P'` on column 87 and column 88, applying the hardening fix in `dossier-paperdoll.ts` will cause Vitest to fail unless Scenario D's assertions are simultaneously updated to assert border preservation (`'║'`) and untouched sentinel buffer (`'~'`).

---

## 2. Logic Chain

1. **Geometric Boundary Constraints**:
   - `x = innerX = 60`. Content width `innerW = 26`. The content boundary ends at column $60 + 26 - 1 = 85$.
   - Any character written to column 86 lands in the right bezel padding margin.
   - Any character written to column 87 overwrites the double-line bezel frame (`'║'`).
   - Any character written to column 88 or higher breaches the console's allocated 30-column bounding box.
2. **Right Arm HP Derivation**:
   - Starting column is $60 + 20 = 80$.
   - To guarantee that characters never reach column 86, 87, or 88, the string must have length $\le 85 - 80 + 1 = 6$.
   - Clamping `rArm.hp` to `[-999..9999]` ensures the number has at most 4 digits (or a minus sign plus 3 digits).
   - Appending `'HP'` produces at most $4 + 2 = 6$ characters.
   - `.padStart(5, ' ')` pads 1-digit to 3-digit values to 5 characters (aligning directly under `R-ARM`).
   - `.slice(0, 6)` serves as an absolute hard guard enforcing length $\le 6$.
   - Maximum column reached: $80 + 6 - 1 = 85$. Column 86 is empty; column 87 remains `'║'`; column 88 is never accessed.
3. **Right Leg HP Derivation**:
   - Starting column is $60 + 17 = 77$.
   - Applying the identical clamping `[-999..9999]` and `.slice(0, 6)` produces a string of length $\le 6$.
   - Maximum column reached: $77 + 6 - 1 = 82$. This is 3 columns inside `innerW` (column 85) and 5 columns away from the border (column 87). Overflow is mathematically impossible.
4. **Stamina Derivation**:
   - Starting column is $60 + 18 = 78$.
   - To guarantee characters never reach column 86, 87, or 88, the string must have length $\le 85 - 78 + 1 = 8$.
   - Clamping `stam` to `[0..999]` ensures the numeric portion has at most 3 digits.
   - The template `STM:${clamped}%` produces at most $4 + 3 + 1 = 8$ characters.
   - `.slice(0, 8)` enforces length $\le 8$.
   - Maximum column reached: $78 + 8 - 1 = 85$. Column 86 is empty; column 87 remains `'║'`; column 88 is never accessed.
5. **Modularity & File Size Invariant**:
   - `wc -l src/client/canvas-ui/dossier-paperdoll.ts` is currently **170 lines**.
   - The mission requires keeping the file $\le 175$ lines.
   - The in-place replacement diff modifies lines 149, 159, and 169 without introducing any new lines, keeping the file at exactly 170 lines (0 net line increase).
   - Alternatively, defining a 1-line helper `const formatCompactHp = ...` results in 171 lines ($\le 175$ lines and far below the 300-line hard ceiling).

---

## 3. Caveats

1. **Extreme Truncation Visibility**: For values $> 9999$ HP, the value displays as `9999HP`. In Aether & Soot's simulation rules, limb HP is normally calibrated between 10 and 100 HP (with heavy industrial prosthetics reaching a few hundred HP). Clamping at 9999 preserves complete fidelity for all legitimate simulation gameplay while safely absorbing arbitrary 6-digit or 7-digit stress inputs.
2. **Left/Center Limbs**: While `lArm.hp` (line 147) and `torso.hp` (line 148) start at columns 63 and 71, an extreme unconstrained value (e.g. 10 digits) could theoretically collide with the next column to their right. For complete architectural rigor, applying the same `formatCompactHp` formatting across all 5 limb HP slots is recommended and demonstrated below.
3. **Challenger Stress Suite Synchronization**: Because `tests/sim/tactical-console-stress.test.ts` was written to assert the reproduction of the bug (expecting `'P'`), the implementer MUST update Scenario D's assertions alongside `dossier-paperdoll.ts`.

---

## 4. Conclusion

### Strategy A: Primary Surgical In-Place Replacement (Recommended)
Modifies only the three target lines. **0 net lines added. File length remains 170 lines.**

#### Diff for `src/client/canvas-ui/dossier-paperdoll.ts`:
```diff
--- a/src/client/canvas-ui/dossier-paperdoll.ts
+++ b/src/client/canvas-ui/dossier-paperdoll.ts
@@ -149,1 +149,1 @@
-  buf.writeString(x + 20, y + 2, `${rArm.hp}HP`.padStart(5, ' '), VICTORIAN_PALETTE.RIVET_STEEL);
+  buf.writeString(x + 20, y + 2, `${Math.max(-999, Math.min(9999, rArm.hp))}HP`.padStart(5, ' ').slice(0, 6), VICTORIAN_PALETTE.RIVET_STEEL);
@@ -159,1 +159,1 @@
-  buf.writeString(x + 17, y + 4, `${rLeg.hp}HP`.padStart(5, ' '), VICTORIAN_PALETTE.RIVET_STEEL);
+  buf.writeString(x + 17, y + 4, `${Math.max(-999, Math.min(9999, rLeg.hp))}HP`.padStart(5, ' ').slice(0, 6), VICTORIAN_PALETTE.RIVET_STEEL);
@@ -169,1 +169,1 @@
-  buf.writeString(x + 18, y + 5, `STM:${stam}%`, VICTORIAN_PALETTE.POLISHED_BRASS);
+  buf.writeString(x + 18, y + 5, `STM:${Math.max(0, Math.min(999, Math.round(stam)))}%`.slice(0, 8), VICTORIAN_PALETTE.POLISHED_BRASS);
```

### Strategy B: Unified Helper Function Hardening (All Limbs)
Defines a 1-line helper function right above `renderCompactPaperdoll` (line 104) and applies it to all 5 limb HP lines plus stamina. **Adds 1 net line. File length becomes 171 lines ($\le 175$).**

```ts
// Insert at line 104:
const formatCompactHp = (hp: number): string => `${Math.max(-999, Math.min(9999, Math.round(hp)))}HP`.padStart(5, ' ').slice(0, 6);

// Lines 147–149:
buf.writeString(x + 3, y + 2, formatCompactHp(lArm.hp), VICTORIAN_PALETTE.RIVET_STEEL);
buf.writeString(x + 11, y + 2, formatCompactHp(torso.hp), VICTORIAN_PALETTE.RIVET_STEEL);
buf.writeString(x + 20, y + 2, formatCompactHp(rArm.hp), VICTORIAN_PALETTE.RIVET_STEEL);

// Lines 158–159:
buf.writeString(x + 7, y + 4, formatCompactHp(lLeg.hp), VICTORIAN_PALETTE.RIVET_STEEL);
buf.writeString(x + 17, y + 4, formatCompactHp(rLeg.hp), VICTORIAN_PALETTE.RIVET_STEEL);

// Line 169:
buf.writeString(x + 18, y + 5, `STM:${Math.max(0, Math.min(999, Math.round(stam)))}%`.slice(0, 8), VICTORIAN_PALETTE.POLISHED_BRASS);
```

### Required Test Synchronization Diff for `tests/sim/tactical-console-stress.test.ts`
```diff
--- a/tests/sim/tactical-console-stress.test.ts
+++ b/tests/sim/tactical-console-stress.test.ts
@@ -76,14 +76,16 @@
-    // Scenario D: Vulnerability reproduction: unconstrained HP >= 999,999 clobbers border and overflows
+    // Scenario D: Hardened limb HP >= 999,999 preserves border and prevents buffer overflow
     for (const slot of SLOTS) {
       prostheticLimbs[slot] = { slot, hp: 999999, maxHp: 50, amputated: false };
     }
     const bufD = createSentinelBuffer(90, 36);
-    renderTacticalConsole(bufD, CONSOLE_RECT, state, playerId);
-    expect(bufD.getCell(87, 21)?.glyph, 'Col 87 border overwritten by unconstrained HP').toBe('P');
+    expect(() => renderTacticalConsole(bufD, CONSOLE_RECT, state, playerId)).not.toThrow();
+    assertNoBufferOverflowOutsideConsole(bufD);
+    expect(bufD.getCell(87, 21)?.glyph, 'Col 87 border preserved under 6-digit HP').toBe('║');
 
     for (const slot of SLOTS) {
       prostheticLimbs[slot] = { slot, hp: 9999999, maxHp: 50, amputated: false };
     }
     const bufE = createSentinelBuffer(90, 36);
-    renderTacticalConsole(bufE, CONSOLE_RECT, state, playerId);
-    expect(bufE.getCell(88, 21)?.glyph, 'Col 88 buffer overflow outside 30-col console').toBe('P');
+    expect(() => renderTacticalConsole(bufE, CONSOLE_RECT, state, playerId)).not.toThrow();
+    assertNoBufferOverflowOutsideConsole(bufE);
+    expect(bufE.getCell(87, 21)?.glyph, 'Col 87 border preserved under 7-digit HP').toBe('║');
+    expect(bufE.getCell(88, 21)?.glyph, 'Col 88 remains untouched sentinel').toBe('~');
```

---

## 5. Verification Method

1. **Verify Line Counts & Modularity Ceilings**:
   ```bash
   wc -l src/client/canvas-ui/dossier-paperdoll.ts
   ```
   *Expected Result*: 170 lines (Strategy A) or 171 lines (Strategy B). Both satisfy $\le 175$ lines and $\le 300$ line hard limit.
2. **Execute Targeted Stress Tests**:
   ```bash
   npx vitest run tests/sim/tactical-console-stress.test.ts
   ```
   *Expected Result*: All 5 test suites pass with 0 errors.
3. **Execute Full Repository Verification Gate**:
   ```bash
   npm run verify
   ```
   *Expected Result*: All 4 verification stages (`typecheck`, `check:boundaries`, `validate:data`, `test:sim`) exit with code 0.
4. **Invalidation Conditions**:
   - If `buf.getCell(87, 21)?.glyph !== '║'`, the hardening failed to protect the console border.
   - If `buf.getCell(88, 21)?.glyph !== '~'`, a string write spilled outside the 30-column console bounding box.
   - If `wc -l src/client/canvas-ui/dossier-paperdoll.ts` exceeds 175 lines, the modularity budget is violated.
