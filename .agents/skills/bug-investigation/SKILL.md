---
name: bug-investigation
description: >-
  Standard protocol for seeded deterministic reproduction, event log trace inspection,
  minimal diff fixes, and targeted Vitest verification in Aether & Soot.
---

# Deterministic Bug Investigation Protocol (Aether & Soot)

This skill outlines the diagnostic workflow for isolating, reproducing, fixing, and verifying simulation bugs, desyncs, or invariant violations in *Aether & Soot*.

---

## 1. Seeded Deterministic Reproduction

Because *Aether & Soot* uses a bit-exact deterministic PRNG (`SeededRNG` via `xoshiro128**`), any simulation failure is 100% reproducible with its initial seed and command sequence:

1. **Extract Failure Seed & Parameters**:
   - Check playtest reports (`tests/artifacts/playtest-report.md`) or test assertions for the exact `seed` integer and scenario name.
2. **Create Minimal Reproduction Fixture**:
   - In a test file (or temporary scratch script in `.system_generated/scratch/`), instantiate the world with the exact seed:
     ```typescript
     const world = createInitialWorld({ seed: <failure_seed>, width: 24, height: 24 });
     const { state } = generateVictorianDistrict(world);
     ```
3. **Replay Command Stream**:
   - Dispatch the sequence of commands leading to the anomaly:
     ```typescript
     const res1 = dispatchCommand(state, cmd1);
     const res2 = dispatchCommand(res1.state, cmd2);
     ```

---

## 2. Trace Inspection & Causal Audit

1. **Inspect Event Log (`state.eventLog`)**:
   - Check the causal chain of emitted `SimEvent` objects up to the point of failure.
   - Look for unexpected event types, missing preconditions, or unexpected state transitions.
2. **Scan Invariant Guards**:
   - Run `validateWorldInvariants(state)` from `src/sim/core/invariants.ts`.
   - Checks for:
     - Orphaned entity IDs in inventory `containedEntityIds`.
     - Duplicate entity IDs owned across multiple inventories or strata.
     - Missing `prostheticSpec` on entities referenced by `installedProstheticEntityId`.
     - Actors on out-of-bounds or invalid tile coordinates.
3. **Audit Client Projection Leaks**:
   - Run `auditClientProjection(state, playerId)` from `tests/scripts/playtester-projection-audit.ts`.
   - Identifies raw snake_case IDs (`district_`, `item_`, `npc_`), coordinate desyncs, or duplicate chronicle lines.

---

## 3. Minimal Diff Fix Rule

- Fix the root cause in the specific domain system (`src/sim/systems/<domain>.system.ts`) or schema validation rule.
- Do NOT alter surrounding, unrelated code or refactor functional subsystems.
- Preserve file length constraints: ensure the touched file does not exceed **250 lines** (hard limit: 300).
- If the bug was caused by a near-cap file, use `npm run hermes:split` to extract the helper function before applying the fix.

---

## 4. Targeted Verification Sequence

1. **Targeted Vitest Execution**:
   Run only the specific failing test suite first for sub-second feedback:
   ```bash
   npx vitest run tests/sim/<target>.test.ts
   ```
2. **Regression Verification**:
   Execute the full 4-gate verification suite:
   ```bash
   npm run verify
   ```
3. **Inference Ledger Check**:
   If the bug occurred during local LLM playtesting, inspect `tests/artifacts/inference-ledger.jsonl` for retry attempts, token counts, and error status.
