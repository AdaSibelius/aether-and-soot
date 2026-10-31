# Documentation & Workflow DevOps Audit Report — Aether & Soot

**Date:** 2026-10-31  
**Auditor:** Teamwork Explorer (Track 3: Documentation & Workflow DevOps Sweep)  
**Target Codebase:** `/Users/emmett/Desktop/Game`  
**Tone:** Clinical, Critical, Strictly Objective. Zero conversational padding or flattery.

---

## 1. Executive Summary & Telemetry Overview

A rigorous full-codebase documentation and DevOps audit of *Aether & Soot* was conducted against the live codebase (`375` total TypeScript files, `277` architecture files, `38,001` lines of code, `98` test suites, `505` passing tests).

While the headless simulation core, boundary isolation (`check:boundaries`), and test suite pass with zero errors, active documentation (`ARCHITECTURE.md`, `STATE.md`, `ROADMAP.md`, `AGENTS.md`) suffers from severe architectural drift and desynchronization. If an incoming autonomous AI agent follows existing documentation, it will encounter immediate syntax errors, invalid imports, and conflicting phase directives.

### Key Risk Telemetry
| Audit Domain | Documented Claim | Live Reality | Discrepancy Severity |
| :--- | :--- | :--- | :---: |
| **Command Dispatching** | `ARCHITECTURE.md` Section 4 Step 3: "Add case to `src/sim/core/engine.ts`" | `engine.ts` has no switch block (delegates to `command-router.ts`) | **CRITICAL (P0)** |
| **Command Schema Count** | `ARCHITECTURE.md` Section 3.A: 23 commands listed | `GameCommandSchema` contains **62 command variants** | **HIGH (P1)** |
| **SimEvent Variant Count** | `ARCHITECTURE.md` Section 3.A: "all 34 event types" | `SimEventSchema` contains **108 event variants** | **HIGH (P1)** |
| **System File Registry** | `ARCHITECTURE.md` Section 3.B: 21 domain systems | `src/sim/systems/` contains **63 files** | **HIGH (P1)** |
| **Phase Numbering & State** | `ROADMAP.md` marks Phase 55 completed; `STATE.md` mixes Phase 55/56 titles | Phase 55 is UI Console (`state.json`), Phase 56 Supply Chains unwritten | **CRITICAL (P0)** |
| **Command Coverage Tooling**| `critic-report.ts` audits 6 schema files | Omits `lore-commands.schema.ts` & `equipment.schema.ts` (6 commands ignored) | **MEDIUM (P2)** |
| **Data Validation Script** | `validate-data.ts` hardcodes 3 district files | Any new `.json` in `data/districts/` is silently skipped | **MEDIUM (P2)** |
| **Scout Import Guidance** | `hermes-scout.ts` outputs `src/sim/core/engine.ts (SeededRNG)` | `engine.ts` does not export `SeededRNG` (lives in `rng.ts`) | **HIGH (P1)** |

---

## 2. Axis 1: File Line Counts & Modularity Telemetry Audit

### 2.1. The POSIX `wc -l` vs Node `content.split('\n')` Accounting Drift
Automated tooling (`tests/scripts/check-boundaries.ts`, `tests/scripts/ast-indexer.ts`, `tests/scripts/critic-report.ts`, `tests/scripts/update-state.ts`) computes line count using:
```typescript
const lineCount = content.split('\n').length;
```
Standard POSIX text files end with a trailing newline `\n`. In Node, splitting `text\n` by `\n` returns an array with a trailing empty string element `""`, resulting in `split('\n').length = wc -l + 1`.
- `src/client/bootstrap-loop.ts`: `wc -l` = 270; `split('\n')` = 271.
- `src/client/input/keyboard-router.ts`: `wc -l` = 261; `split('\n')` = 262.
- `src/client/input/modal-nav-router.ts`: `wc -l` = 246; `split('\n')` = 247.
- `src/schemas/components.schema.ts`: `wc -l` = 240; `split('\n')` = 241.
- `src/client/renderer/glyph-stage.ts`: `wc -l` = 239; `split('\n')` = 240.

**Impact**: `AGENTS.md` Rule 1.2 and Rule 2.2 explicitly instruct agents to run `wc -l`. An agent checking `wc -l src/client/renderer/glyph-stage.ts` sees 239 lines and assumes it is safe, but `check-boundaries.ts` and `generate-architecture-map.ts` flag it at 240 lines (threshold trigger). The accounting method must be standardized or explicitly noted.

### 2.2. `AGENTS.md` Rule 2.2 Near-Cap Watchlist Omission
`tests/scripts/check-boundaries.ts` enforces the 300-line modularity ceiling across **both** `src/` and `tests/`:
```typescript
const allFiles = [
  ...collectTypeScriptFiles(path.join(ROOT_DIR, 'src')),
  ...collectTypeScriptFiles(path.join(ROOT_DIR, 'tests')),
];
```
However, `AGENTS.md` Rule 2.2 lists only 5 files in `src/`:
> `src/client/bootstrap-loop.ts` (271 lines), `src/client/input/keyboard-router.ts` (262 lines), `src/client/input/modal-nav-router.ts` (247 lines), `src/schemas/components.schema.ts` (241 lines), `src/client/renderer/glyph-stage.ts` (240 lines).

It omits near-cap tooling scripts:
- `tests/scripts/update-state.ts`: **245 lines** (`wc -l`: 244)
- `tests/scripts/hermes-critic.ts`: **243 lines** (`wc -l`: 242)

`docs/architecture-map.md` correctly includes them in its Near-Cap File Watchlist, but `AGENTS.md` omits them. Tooling scripts are subject to the same hard exit code 1 failure in `check:boundaries`.

### 2.3. High-Velocity Hotspot Table (230–239 Lines)
The following files in `src/` are rapidly approaching the 240-line warning threshold and 300-line ceiling:

| File Path | `split('\n')` | `wc -l` | Primary Responsibility | Risk Analysis |
| :--- | :---: | :---: | :--- | :--- |
| `src/schemas/events.schema.ts` | 238 | 237 | Main `SimEventSchema` discriminated union | Adding 3 more events will trigger near-cap warning |
| `src/sim/systems/furniture.system.ts` | 238 | 237 | Furniture interactions & bed resting | High risk if container/deed logic is added |
| `tests/scripts/llm-playtester.ts` | 238 | 237 | Playtester CLI & loop execution | High risk on scenario expansion |
| `src/sim/systems/district-spawner.ts` | 237 | 236 | NPC/item district spawning | Near threshold |
| `src/sim/systems/safehouse.system.ts` | 235 | 234 | Deeds, barricades & storage | Near threshold |
| `src/schemas/domain-commands.schema.ts` | 234 | 233 | Extracted command schemas | Near threshold |
| `src/client/audio/procedural-synth.ts` | 233 | 232 | WebAudio procedural sound synthesizer | Near threshold |
| `src/schemas/core-events.schema.ts` | 233 | 232 | Movement, stratum & portal events | Near threshold |
| `src/sim/systems/environmental-hazards.system.ts` | 232 | 231 | Soot, acid, cough & gaslight ticks | Near threshold |
| `src/sim/systems/metabolism.system.ts` | 232 | 231 | Toxicity, pain shock & stamina | Near threshold |
| `src/client/ui/SystemMenuModal.tsx` | 231 | 230 | Esc menu & save/load controls | Near threshold |
| `src/schemas/commands.schema.ts` | 230 | 229 | Core `GameCommandSchema` union | Near threshold |
| `src/sim/systems/surgery.system.ts` | 230 | 229 | Corpse harvesting & dissection | Near threshold |

---

## 3. Axis 2: Architectural Documentation Drift (`ARCHITECTURE.md` vs Live Reality)

### 3.1. Fatal Instruction in 6-Step Implementation Recipe (Section 4 Step 3)
`ARCHITECTURE.md` Section 4 dictates:
> **Step 3. Wire into `dispatchCommand` (`src/sim/core/engine.ts`)**:  
> Add a `case` for the new `command.type` in `src/sim/core/engine.ts`.

**Direct Observation**:
Inspection of `src/sim/core/engine.ts` (lines 40–58) reveals:
```typescript
export function dispatchCommand(
  currentState: WorldState,
  rawCommand: GameCommand,
  options?: DispatchCommandOptions,
): DispatchTurnResult {
  const command = GameCommandSchema.parse(rawCommand);
  const rng = new SeededRNG(currentState.rngState);
  const resolution = resolveAction(currentState, command, rng);
  const actingActorId = getActingActorId(command);

  const result = executeSimulationPhases(resolution, actingActorId, rng);

  const shouldAssert = options?.enableInvariantAssertions ?? invariantAssertionsEnabled;
  if (shouldAssert && resolution.status === 'applied') {
    assertWorldInvariants(result.state);
  }

  return result;
}
```
There is **zero** switch statement in `src/sim/core/engine.ts`.
- Command routing actually occurs in `src/sim/core/action-resolver.ts` lines 42–51 (`resolveMoveStepAction`, `resolveUsePortalAction`, `resolveWaitTurnAction`, or `routeDomainCommand`).
- Domain command dispatching actually occurs in `src/sim/core/command-router.ts` (lines 57–226), which houses the 40+ case switch block.
- An incoming agent following `ARCHITECTURE.md` will fail or mistakenly rewrite `engine.ts`.

### 3.2. Data Flow Diagram and Turn Lifecycle Obsolete (Sections 1 & 2)
`ARCHITECTURE.md` Section 1 portrays:
```mermaid
Preact -- "Dispatches GameCommand" --> Engine --> Systems --> World
```
And Section 2 claims:
> 3. Domain System Execution: The `switch (command.type)` block invokes the corresponding pure function in `src/sim/systems/*.system.ts`, returning `{ state, events, apSpent }`.  
> 4. Environmental Thermodynamics Tick: `advanceThermodynamicsTick(nextState)` (`src/sim/systems/thermo.system.ts`) runs double-buffered cellular automata...  
> 5. Energy & Macro-Tick Scheduling: `advanceTurnSchedule(...)` (`src/sim/core/scheduler.ts`) deducts `apSpent`...

**Live Reality**:
- Turn execution is orchestrated by `src/sim/core/simulation-pipeline.ts`:
  1. `resolveAction(currentState, command, rng)` in `action-resolver.ts` checks actor mortality and routes to `spatial-actions.ts` or `command-router.ts`.
  2. `executeSimulationPhases(...)` in `simulation-pipeline.ts` executes sequential pipeline phases:
     - Initiative AP deduction and action application.
     - Environmental hazard ticks (`tickEnvironmentalHazards` in `environmental-hazards.system.ts`).
     - Thermodynamics cellular automata (`advanceThermodynamicsTick` in `thermo.system.ts`).
     - Kinetic momentum collisions and trauma.
     - Diurnal shift schedule advancement & macro-tick economy.
  3. Relational invariants are checked via `assertWorldInvariants` (`src/sim/core/invariants.ts`).

### 3.3. Gross Underreporting of Schemas
- **Commands**: `ARCHITECTURE.md` Section 3.A enumerates 23 command variants.
  - Live codebase: `GameCommandSchema` in `src/schemas/commands.schema.ts` (lines 165–228) defines **62 distinct variants** partitioned across 8 schema files. 39 commands are completely unmentioned.
- **Events**: `ARCHITECTURE.md` Section 3.A and line 131 repeatedly assert "all 34 event types".
  - Live codebase: `SimEventSchema` in `src/schemas/events.schema.ts` contains **108 distinct event variants**. The documentation is 317% out of date.

### 3.4. Stagnant Registries (`src/sim/core/`, `src/sim/systems/`, `src/client/`)
- **Simulation Core (`src/sim/core/`)**:
  - `ARCHITECTURE.md` lists 4 files: `rng.ts`, `world.ts`, `scheduler.ts`, `engine.ts`.
  - Live reality: `src/sim/core/` contains **12 files**. Missing from docs: `action-resolver.ts`, `command-resolution.ts`, `command-router.ts`, `invariants.ts`, `simulation-pipeline.ts`, `spatial-actions.ts`, `world-factory.ts`, `world-migration.ts`.
- **Domain Systems (`src/sim/systems/`)**:
  - `ARCHITECTURE.md` lists 21 system files.
  - Live reality: `src/sim/systems/` contains **63 files**. 42 systems and helper sub-modules are omitted.
- **Presentation Shell (`src/client/`)**:
  - `ARCHITECTURE.md` lists 13 files and portrays a simple Preact HUD.
  - Live reality: `src/client/` contains **62 files** across 7 subdirectories (`audio/`, `canvas-ui/`, `input/`, `persistence/`, `projection/`, `renderer/`, `ui/`). Entire core systems—such as the full PixiJS-rendered Canvas UI console buffer (`src/client/canvas-ui/` with analog Bourdon gauges, vernier scanners, and embarkation ledger), the WebAudio procedural synthesizer (`src/client/audio/`), the keyboard/modal navigation routers (`src/client/input/`), and save-state persistence (`src/client/persistence/`)—are unmentioned.

---

## 4. Axis 3: Project State & Governance Drift (`STATE.md`, `ROADMAP.md`, `.agents/state.json`)

### 4.1. The Phase 55/56 Numbering and Title Collision
A critical contradiction exists between `ROADMAP.md`, `STATE.md`, and `.agents/state.json`:

1. **In `ROADMAP.md` (lines 99–100)**:
   ```markdown
   - [x] **Phase 55: Causal Supply Chains & Disruption Cascades** *(Completed)*: Aggregate macro-tick simulation of 3 vital commodities...
   - [ ] **Phase 56: Bounded World Chronicle, Witness Memory & Rumor Network**: Bounded circular buffer of the last 50 significant historical events...
   ```
2. **In `.agents/state.json` (lines 635–678)**:
   ```json
   {
     "number": 55,
     "title": "High-Density Victorian Mechanical Console UI",
     "status": "COMPLETED"
   },
   {
     "number": 56,
     "title": "Causal Supply Chains & Disruption Cascades",
     "status": "PLANNED"
   },
   {
     "number": 57,
     "title": "Bounded World Chronicle, Witness Memory & Rumor Network",
     "status": "PLANNED"
   }
   ```
3. **In `STATE.md` (lines 10–16)**:
   ```markdown
   ## Immediate Next Priority
   - Phase 56: Causal Supply Chains & Disruption Cascades: Aggregate macro-tick simulation of 3 vital commodities...

   ## 5. Self-Directed Prescriptions for Next Phase
   - **P1: Phase 56** [UNREACHABLE_MECHANIC]: Implement a bounded circular buffer of the last 50 significant historical events in WorldState.chronicle... (Target: src/sim/core/engine.ts)
   ```

**Root Cause**:
When Phase 55 ("High-Density Victorian Mechanical Console UI", verified in `tests/sim/phase55-diegetic-ui.test.ts`) was completed, someone erroneously updated `ROADMAP.md` by replacing Phase 55's title with Phase 56's title ("Causal Supply Chains & Disruption Cascades") and marking it completed.
Because `critic-sanity.ts` parses `ROADMAP.md` checked items (`parseCompletedPhases`), it concluded Phase 55 (Supply Chains) was already complete. Consequently:
- `STATE.md` displays the title of Phase 56 ("Causal Supply Chains & Disruption Cascades").
- But the P1 prescription under it quotes the text of Phase 57 ("Bounded World Chronicle, Witness Memory & Rumor Network") and targets `engine.ts`!
- Neither Phase 56 nor Phase 57 has been implemented. Any agent starting work here is presented with an irreconcilable conflict between title, backlog, and roadmap status.

### 4.2. Stale Git History in `STATE.md`
`STATE.md` lines 5–9 list recent commits up to `c4f1394`.
Live `git log` confirms a newer commit exists on `main`:
`6b8309d feat(procgen): implement thematic architectural POI templates and volumetric smoke hook`.
`STATE.md` was never regenerated after commit `6b8309d`.

### 4.3. Stale & Hallucinatory Prescriptions in `STATE.md`
- **P2 Prescription**: Recommends wiring `REMOVE_PROSTHETIC`, `REPORT_CRIME`, `REST_AT_BED`, `SET_POSTURE` into `playtester-serializer.ts`.
  - **Fact**: All four commands are **already wired** in `tests/scripts/playtester-dispatcher.ts` and `playtester-serializer.ts`. Running `auditCommandCoverage` places them in `dormant`, not `unwired`.
  - The actual unwired commands are: `ASCEND_CATACOMBS`, `SMASH_TERRAIN`, `THROW_FLASK`, `TRAVEL_DISTRICT`, `TRIGGER_SUPPLY_SHOCK`, `UNINSTALL_WEAPON_MOD`.
- **P3 Prescription**: Recommends pre-splitting `tests/scripts/playtester-projection-audit.ts` to enforce the 250-line target, citing verification in `tests/sim/determinism.test.ts`.
  - **Fact**: `playtester-projection-audit.ts` is only **206 lines** (well below 240/250 lines).
  - Furthermore, `tests/sim/determinism.test.ts` does not test or import `playtester-projection-audit.ts`.

---

## 5. Axis 4: Developer Workflow Scripts & Verification Gate Audit

### 5.1. `auditCommandCoverage` Schema Blind Spots (`tests/scripts/critic-report.ts`)
In `tests/scripts/critic-report.ts` (lines 13–20):
```typescript
const cmdFiles = [
  path.join(rootDir, 'src/schemas/commands.schema.ts'),
  path.join(rootDir, 'src/schemas/domain-commands.schema.ts'),
  path.join(rootDir, 'src/schemas/safehouse-commands.schema.ts'),
  path.join(rootDir, 'src/schemas/skirmish-commands.schema.ts'),
  path.join(rootDir, 'src/schemas/transit-commands.schema.ts'),
  path.join(rootDir, 'src/schemas/witness-commands.schema.ts'),
];
```
This hardcoded list omits:
- `src/schemas/lore-commands.schema.ts` (`EMIT_PROCEDURAL_BARK`, `DISSECT_CORPSE_ANATOMY`, `ENFORCE_TURF_AUTHORITY`)
- `src/schemas/equipment.schema.ts` (`EQUIP_ITEM`, `UNEQUIP_ITEM`, `FIRE_RANGED_WEAPON`)

Because `commands.schema.ts` only re-exports these schemas without inlining `type: z.literal(...)`, regex parsing across `cmdFiles` detects only 56 commands out of 62. Six domain commands are completely invisible to the automated critic and coverage reports.

### 5.2. `validate-data.ts` Hardcoded District File Array (`tests/scripts/validate-data.ts`)
In `tests/scripts/validate-data.ts` (line 37):
```typescript
const districtFiles = ['soot_works.json', 'whitechapel_ward.json', 'limehouse_docks.json'];
```
While materials, recipes, and corpora are validated dynamically or by whole-file reads, district validation hardcodes three specific filenames. Any newly authored district file added to `data/districts/` (e.g. `spitalfields.json`) is silently skipped during `npm run validate:data` and `npm run verify`. It should use dynamic directory scanning via `fs.readdirSync`.

### 5.3. `hermes-scout.ts` Erroneous Import Output
In `tests/scripts/hermes-scout.ts` (lines 59–62):
```typescript
const reusable = [
  'src/sim/spatial/grid.ts (isWithinBounds, getTileCell, setTileCell, findEntitiesAtPoint)',
  'src/sim/core/engine.ts (dispatchCommand, SeededRNG)',
];
```
`engine.ts` does **not** export `SeededRNG`. `SeededRNG` is exported exclusively by `src/sim/core/rng.ts`. An agent copying from `hermes:scout` output will generate broken imports:
```typescript
import { SeededRNG } from '../../sim/core/engine.js'; // TS2305: Module has no exported member 'SeededRNG'.
```

### 5.4. Loopback Sockets & Antigravity Sandbox Invariant
All Hermes local LLM tools (`hermes-scout`, `hermes-critic`, `hermes-testgen`, `generate:content`, `playtest`) connect to Ollama at `http://localhost:11434`.
- Under macOS and Antigravity sandboxing, TCP loopback socket connections are blocked unless commands are executed with `BypassSandbox: true`.
- If an agent runs `npm run hermes:*` without `--mock` and without `BypassSandbox: true`, the command hangs or terminates with exit code 1.
- All CLI scripts support `--mock` mode, which functions offline without loopback access.

### 5.5. `package.json` Verify Script Chain Gap
`package.json` line 37 defines:
```json
"verify": "npm run typecheck && npm run check:boundaries && npm run validate:data && npm run test:sim"
```
It does **not** run `npm run check:governance` (`tests/scripts/check-agent-governance.ts`).
While `check:boundaries` guards line counts and module boundaries, agent governance rules (`.agents/rules/*.md` frontmatter, trigger syntax, and `.agents/hooks.json` schema) are not validated as part of the standard pre-commit gate. An invalid rule can be committed unnoticed.

---

## 6. Axis 5: Progressive Disclosure & Governance Rules Audit (`.agents/rules/`)

The `.agents/rules/` directory contains 3 flat markdown rules totaling `4,599` characters:
1. `ecs-simulation.md` (trigger: `glob`, target: `src/sim/**, src/schemas/**, data/**`, 1,440 bytes):
   - Accurately prohibits `Math.random()`, `Date.now()`, and deep OOP inheritance. Enforces 300-line modularity ceiling. Fully aligned with codebase reality.
2. `lore-procgen.md` (trigger: `model_decision`, 1,343 bytes):
   - Defines 1888 Gaslamp thematic anchors, dynamic state grounding, and the zero paid token rule (`generate:content`). Fully aligned.
3. `ui-edison-qud.md` (trigger: `glob`, target: `src/client/**, **/*.css`, 1,824 bytes):
   - Prohibits UI imports in `src/sim/`, mandates glyph atlas registration, and enforces Caves of Qud dual-pane ergonomics. Fully aligned.

`npm run check:governance` validates all 3 rules and `.agents/hooks.json` with 100% PASS.

---

## 7. Sequenced Actionable Remediation Plan

To prevent AI agents from hallucinating or failing during upcoming phases, the following discrete remediations must be executed:

### Step 1: Reconcile Phase Numbering in `ROADMAP.md` and `STATE.md`
- **File**: `ROADMAP.md`
  - Re-insert `Phase 55: High-Density Victorian Mechanical Console UI (Completed)`.
  - Re-label `Phase 56: Causal Supply Chains & Disruption Cascades (PLANNED)`.
  - Re-label `Phase 57: Bounded World Chronicle, Witness Memory & Rumor Network (PLANNED)`.
- **File**: `STATE.md`
  - Align `Immediate Next Priority` with Phase 56 ("Causal Supply Chains & Disruption Cascades").
  - Align P1 prescription with Phase 56 (Macro-commodity supply chains and scarcity events), removing the Phase 57 chronicle description.
  - Run `npm run sync:state` to refresh commit history (`6b8309d`) and verified prescriptions.

### Step 2: Fix False Recipe & Stagnant Registries in `ARCHITECTURE.md`
- **File**: `ARCHITECTURE.md`
  - **Section 4 Step 3**: Change `Wire into dispatchCommand (src/sim/core/engine.ts)` to `Wire into routeDomainCommand (src/sim/core/command-router.ts)` (or `src/sim/core/action-resolver.ts` for spatial actions).
  - **Section 1 & 2**: Update Mermaid diagram and execution order to reflect the `simulation-pipeline.ts` pipeline, `action-resolver.ts`, `command-router.ts`, and `invariants.ts`.
  - **Section 3.A**: Update command count to 62 variants and `SimEvent` count to 108 variants.
  - **Section 3.B & 3.C**: Refresh module tables with current file counts (`src/sim/core/`: 12 files; `src/sim/systems/`: 63 files; `src/client/`: 62 files across 7 subdirectories).

### Step 3: Fix Tooling Blind Spots & Misleading Guidance
- **File**: `tests/scripts/critic-report.ts`
  - Add `src/schemas/lore-commands.schema.ts` and `src/schemas/equipment.schema.ts` to `cmdFiles` in `auditCommandCoverage()`.
- **File**: `tests/scripts/validate-data.ts`
  - Replace hardcoded `districtFiles` array with `fs.readdirSync(path.join(ROOT_DIR, 'data/districts'))` filtering for `.json`.
- **File**: `tests/scripts/hermes-scout.ts`
  - Correct reusable infrastructure template: change `src/sim/core/engine.ts (dispatchCommand, SeededRNG)` to `src/sim/core/rng.ts (SeededRNG)` and `src/sim/core/engine.ts (dispatchCommand)`.
- **File**: `AGENTS.md`
  - Rule 2.2: Add `tests/scripts/update-state.ts` (245 lines) and `tests/scripts/hermes-critic.ts` (243 lines) to the Near-Cap Files Watchlist.
  - Clarify that file line limits in automated checks are measured via JavaScript `split('\n').length` (`wc -l + 1` for newline-terminated files).
- **File**: `package.json`
  - Consider adding `npm run check:governance` into the `verify` chain script.

---
*Report compiled autonomously by Track 3 DevOps Auditor.*
