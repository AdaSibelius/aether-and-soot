---
name: hermes-tooling
description: >-
  Operational workflows, CLI flags, model tiers, and loopback socket invariants
  for local LLM tools (hermes:scout, hermes:testgen, hermes:critic, hermes:chronicler, hermes:split, generate:content, and playtester).
---

# Local LLM Tooling & Autonomous Pipeline (Aether & Soot)

This skill provides operational procedures, CLI flags, model routing specifications, and safety invariants for running local Ollama inference in *Aether & Soot*.

---

## 1. Model Tier Hierarchy & Routing

All local tools route through `tests/scripts/local-llm-config.ts` connecting to Ollama at `http://localhost:11434/v1/chat/completions`:

| Tier | Default Model | Override Env Variable | Primary Roles |
| :--- | :--- | :--- | :--- |
| **Tier 1 (Reasoning)** | `lfm2.5:24b` | `LLM_MODEL_TIER1` | Deep emergence critique (`hermes:critic`), Stage 3 playtester escalation (stuck/blocked >=3 turns, stratum transit). |
| **Tier 2 (Code/AST)** | `gemma4:12b-extended` | `LLM_MODEL_TIER2` | Codebase scouting (`hermes:scout`), test generation (`hermes:testgen`), modularity file splitting (`hermes:split`). |
| **Tier 3 (Fast)** | `hermes3:8b` | `LLM_MODEL_TIER3` | Blueprint generation (`generate:content`), event chronicler (`hermes:chronicler`), Stage 2 tactical playtester. |

> **Emergency Universal Override**: Setting `LLM_MODEL` forces all tiers to use a single model. This is an emergency diagnostic override that logs a prominent console warning.

---

## 2. Mandatory Loopback Sandbox Permission

- Sandboxed execution blocks TCP socket access to `localhost:11434`.
- When invoking local LLMs in Antigravity via `run_command`, **ALWAYS** set `BypassSandbox: true`.
- If an agent turn encounters a network or timeout failure with a local tool, **DO NOT** attempt to hand-write large content blocks in paid context. Halt and report the infrastructure error.

---

## 3. Tool Reference & Workflows

### A. Codebase Scout (`hermes:scout`)
Scans AST signatures, imports, and file lengths across `src/` to synthesize the 6-point Pre-Flight Impact Analysis Block without polluting conversation context:
```bash
npm run hermes:scout -- --task "<feature description>"
npm run hermes:scout:mock -- --task "<feature description>" # Offline mock mode
```

### B. Unit Test Generator (`hermes:testgen`)
Extracts function signatures via TypeScript AST and queries Tier 2 with a self-healing compiler feedback loop:
```bash
npm run hermes:testgen -- --target src/sim/spatial/portals.ts --output tests/sim/auto-portals.test.ts
npm run hermes:testgen:mock -- --target src/sim/spatial/portals.ts --output tests/sim/auto-portals.test.ts
```

### C. SimEvent Chronicler (`hermes:chronicler`)
Scans `src/schemas/events.schema.ts` and updates `src/client/ui/EventFormatter.ts` with atmospheric Victorian narrative formatting:
```bash
npm run hermes:chronicler
npm run hermes:chronicler:mock
```

### D. Modularity Splitter (`hermes:split`)
Extracts designated functions from files approaching the 300-line ceiling into sibling modules:
```bash
npm run hermes:split -- --source src/sim/systems/target.system.ts --target src/sim/systems/target-helper.ts --extract funcA,funcB
npm run hermes:split:mock -- --source src/sim/systems/target.system.ts --target src/sim/systems/target-helper.ts --extract funcA,funcB
```

### E. Declarative Blueprint Factory (`generate:content`)
Generates Zod-validated JSON records in `data/` at zero paid token cost:
```bash
npm run generate:content -- --type materials --count 5
npm run generate:content -- --type consumables --count 3
npm run generate:content -- --type prosthetics --count 2
npm run generate:content:mock -- --type materials
```

### F. Headless Autonomous Playtester (`playtest`)
Runs headless game sessions evaluating emergence, token efficiency, and client UI projection leaks:
```bash
npm run playtest -- --turns 50 --scenario explore
npm run playtest:mock -- --turns 25 --scenario explore
```

---

## 4. Telemetry & Inference Ledger

All calls to `queryLocalOllama` are recorded in `tests/artifacts/inference-ledger.jsonl`:
- Captured fields: `timestamp`, `task`, `tier`, `model`, `prompt_tokens`, `completion_tokens`, `duration_ms`, `retry_count`, `success`, `cache_hit`.
- Helper `getInferenceLedgerSummary()` aggregates token consumption, latency, and success rates across tiers.
