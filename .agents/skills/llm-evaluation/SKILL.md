---
name: llm-evaluation
description: >-
  Workflows for running headless autonomous playtests, evaluating token efficiency,
  auditing client UI projection leaks, and generating post-phase critic reports in Aether & Soot.
---

# Autonomous Playtesting & LLM Evaluation (Aether & Soot)

This skill covers the execution of headless playtest sessions, telemetry recording, 3-stage decision policy evaluation, and post-phase critic audits in *Aether & Soot*.

---

## 1. Headless Playtester Architecture

The autonomous playtester drives the headless simulation engine to evaluate emergence, mechanical depth, command coverage, and UI projection leaks:
- Entry point: `tests/scripts/llm-playtester.ts` (`npm run playtest`).
- Sensory Serializer: `tests/scripts/playtester-serializer.ts` (compressed radar & metadata deltas).
- Decision Policy: `tests/scripts/playtester-policy.ts` (3-stage hybrid routing).
- Telemetry Reporter: `tests/scripts/playtest-report.ts` -> `tests/artifacts/playtest-report.md`.

---

## 2. The 3-Stage Decision Policy

To balance tactical intelligence with strict local token conservation, every turn is evaluated through a 3-stage policy:

1. **Stage 1 (Deterministic Guardrails — 0 Tokens)**:
   - *Critical Haemostatic Reflex*: Automatically triggers `USE_ITEM` with haemostatic tonics when `bloodVolumePct <= 35%`.
   - *Adjacent Threat Melee Strike*: Strikes adjacent hostile actors (`ATTACK_ACTOR`).
   - *Corridor Navigation Reflex*: Steps forward along straight unobstructed corridors without LLM queries.
2. **Stage 2 (Fast Model — Tier 3 `hermes3:8b`)**:
   - Standard exploration, picking up ground items, toggling doors, stoking boilers.
3. **Stage 3 (Reasoning Model — Tier 1 `lfm2.5:24b`)**:
   - Escalates only when the agent has been stuck or repeating failed actions for $\ge 3$ consecutive turns, or when evaluating multi-stratum transit.

---

## 3. Playtest Scenarios & Invocations

### Standard Execution Commands
When invoking live models, use unsandboxed permissions (`BypassSandbox: true`):
```bash
# Standard 50-turn exploration playtest
npm run playtest -- --turns 50 --scenario explore

# 50-turn combat survival scenario
npm run playtest -- --turns 50 --scenario combat

# Economic trade & storefront scenario
npm run playtest -- --turns 50 --scenario economy

# Multi-stratum portal transit scenario
npm run playtest -- --turns 50 --scenario transit
```

### Deterministic Mock CI Mode
```bash
npm run playtest:mock -- --turns 25 --scenario explore
```

---

## 4. Playtest Telemetry & Report Analysis

After execution, inspect `tests/artifacts/playtest-report.md`:
- **Token Efficiency Table**:
  - Prompt tokens, completion tokens, average latency per turn.
  - *Survival per 1,000 Tokens*: measures longevity per token consumed.
  - *Policy Stage Distribution*: shows counts of S1 (reflex), S2 (fast model), and S3 (reasoning escalation).
- **Emergent Sandbox Mechanics**:
  - Acoustic decibels emitted, guard alert transitions (`INVESTIGATING`, `COMBAT`), steam clouds deployed, traps triggered.
- **Client UI Projection & Chronicle Leak Audit**:
  - Scans for raw snake_case IDs (`district_`, `item_`, `npc_`), coordinate desyncs, or duplicate chronicle movement logs.

---

## 5. Post-Phase Critic Audit (`npm run hermes:critic`)

At the conclusion of every development phase:
1. Run the local critic loop:
   ```bash
   npm run hermes:critic
   ```
2. Synchronize phase telemetry, verified prescriptions, and next prompt into `STATE.md`:
   ```bash
   npm run sync:state
   ```
3. Inspect `tests/artifacts/critic-audit.md` for whole-game emergence analysis and self-directed prescriptions.
