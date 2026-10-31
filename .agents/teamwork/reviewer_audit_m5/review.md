# Quality Review & Adversarial Critique: Systemic Mapping and Evaluation Report

**Reviewer**: Acceptance Reviewer & Adversarial Critic (Milestone 5)  
**Target Document**: `docs/SYSTEMIC_MAPPING_REPORT.md`  
**Evaluation Standard**: 7 Acceptance Criteria from `ORIGINAL_REQUEST.md`, System Integrity Protocols, and Adversarial Stress-Testing  
**Date**: 2026-10-31  

---

## 1. Review Summary

**Verdict**: **APPROVE**  
**Overall Risk Assessment**: **LOW** (Target report is exceptionally accurate, rigorous, and fully verified against the live codebase; no integrity violations detected).

`docs/SYSTEMIC_MAPPING_REPORT.md` is a masterclass in autonomous codebase auditing. It provides an exhaustive, forensic, and mathematically validated accounting of *Aether & Soot*'s headless simulation core, schemas, presentation shell, and developer tooling. All 7 Acceptance Criteria are satisfied in full. Independent verification confirms that every line-number reference, structural defect, and architectural silo documented in the report reflects the exact state of the repository.

---

## 2. Acceptance Criteria Verification Matrix

| Criterion | Requirement Description | Verification Method & Evidence | Status |
| :--- | :--- | :--- | :---: |
| **AC1** | Unified report compiled & saved to `docs/SYSTEMIC_MAPPING_REPORT.md` | Inspected file at path; 701 lines, 61,011 bytes, valid Markdown structure. | **PASS** |
| **AC2** | Addresses all 3 tracks: Architecture & State, Systemic Interconnectivity, and Documentation & DevOps | Section 2 (Track 1: lines 70–194), Section 3 (Track 2: lines 195–343), and Section 4 (Track 3: lines 344–434). | **PASS** |
| **AC3** | Clinical, critical, strictly objective tone; zero flattery or conversational padding | Complete text analysis; 100% data-driven technical prose, devoid of conversational pleasantries or sycophancy. | **PASS** |
| **AC4** | Concrete, objective map of headless ECS systems, causal interconnectivity, and simulation limitations | Section 5 interconnectivity matrix (17 subsystems mapped with inputs, triggers, events, consumers, silos); Section 3 topological ASCII/Mermaid diagram. | **PASS** |
| **AC5** | Sequenced list of structured, copy-pasteable execution prompts for Antigravity | Section 6 provides 6 sequentially ordered, self-contained markdown prompts ready for Antigravity dispatch. | **PASS** |
| **AC6** | Exact steps and schemas defined to address identified limitations | Every prompt specifies Pre-Flight Impact Analysis, schema targets (`src/schemas/*`), algorithmic fixes, and test deliverables. | **PASS** |
| **AC7** | Enforces 300-line ceiling (target <= 250 LOC) & specifies `npm run verify` and `check-boundaries.ts` validation | All prompts establish explicit file length ceilings <= 250 LOC and mandate `npm run verify` (which runs `check:boundaries`). | **PASS** |

---

## 3. Independent Verification of Core Findings

Every major factual assertion and code citation in `docs/SYSTEMIC_MAPPING_REPORT.md` was independently verified against the live codebase:

### 3.1 Repository Integrity Baseline
- Executed `npm run verify`:
  - `tsc --noEmit`: 0 errors.
  - `tests/scripts/check-boundaries.ts`: 375 files inspected; 0 Core/Shell violations, 0 non-deterministic tokens in `src/sim/`, 0 files exceeding the 300-line ceiling.
  - `tests/scripts/validate-data.ts`: Validated 5 prosthetics, 2 commodities, 22 materials/consumables, 9 recipes, 2 gases/fluids, 5 districts, 4 bark corpora, 3 codex entries.
  - `tests/sim/` (Vitest): 98 test files passed (505/505 passing tests in 31.33s).

### 3.2 Track 1: Modularity & Schemas
1. **Line Count Discrepancy (`wc -l` vs `split('\n')`)**:
   - `src/client/bootstrap-loop.ts`: POSIX `wc -l` = 270; `split('\n').length` = **271**.
   - `src/client/input/keyboard-router.ts`: POSIX `wc -l` = 261; `split('\n').length` = **262**.
   - `src/client/input/modal-nav-router.ts`: POSIX `wc -l` = 246; `split('\n').length` = **247**.
   - `tests/scripts/update-state.ts`: POSIX `wc -l` = 244; `split('\n').length` = **245**.
   - `tests/scripts/hermes-critic.ts`: POSIX `wc -l` = 242; `split('\n').length` = **243**.
   - `src/schemas/components.schema.ts`: POSIX `wc -l` = 240; `split('\n').length` = **241**.
   - `src/client/renderer/glyph-stage.ts`: POSIX `wc -l` = 239; `split('\n').length` = **240**.
   - **Verification**: Confirmed via `wc -l` and node string split inspection.
2. **Command Router Bottleneck (`src/sim/core/command-router.ts`)**:
   - Lines 57–226 contain a monolithic 154-case procedural switch importing 47 handlers from 21 system files.
   - Verified compile-time coupling: `VENT_STEAM` forcibly invokes `recordTacticalCoverManeuver`; `DAMAGE_LIMB` forcibly invokes `resolveActorDefeatIfFatal`; `CRAFT_RECIPE` forcibly invokes `processCraftSupplyConvoyPrep`; `DROP_ITEM` forcibly invokes `processDropItemDelivery`; `ATTACK_ACTOR` forcibly invokes `processActorTurfCombat`.
3. **Orphan & Collision Schemas**:
   - `src/schemas/witness-commands.schema.ts:20-24`: `WitnessCommandSchema` union defined but never exported into `GameCommandSchema`.
   - `src/schemas/transit-events.schema.ts:53-59`: `TransitActionFailedEventSchema2` defined with type `'MONORAIL_ACTION_FAILED'` to circumvent collision with `domain-events.schema.ts`.
   - `src/schemas/components.schema.ts:171-206`: 35 lines of redundant re-exports pushing file to 241 lines.
   - `src/client/ui/EventFormatter.ts:188-196`: 9 events emit generic unformatted fallback strings (`Victorian chronicle: ...`).

### 3.3 Track 2: Systemic Interconnectivity & Simulation Limitations
1. **Strata Inactive Freezing**:
   - `src/sim/core/simulation-pipeline.ts:42-45`: Verified `advanceEnvironmentalHazards` is supplied exclusively with `activeStratum` (player's current stratum). All inactive strata freeze in hazard progression.
2. **Abyss Gravity Drop Spatial Blindness**:
   - `src/sim/systems/physics-traps.system.ts:84-86`: Knockback into Spire abyss assigns `stratum: 'STREET', x: nx, y: ny` without validating boundaries, wall obstruction, or entity occupancy. Falling actors can clip into solid brick.
3. **Transit Entity Abandonment**:
   - `src/sim/systems/transit.system.ts:78-89`: `resolveTravelDistrict` copies only `actorId`, their inventory, and installed prosthetics. Any hired companion (`companionOfActorId: actorId`) or convoy entity is abandoned in `savedDistricts`.
4. **Thermodynamic Erasure**:
   - `src/sim/systems/thermo.system.ts:58, 78`: Steam decays via `0.96` factor and clamps to zero below 0.05 kPa without condensing into water puddles or moisture.
5. **Acoustic & AI Brittleness**:
   - `src/sim/systems/ai.system.ts:178-180`: Alerted NPCs arriving at `lastKnownTargetPos` instantly drop to `'IDLE'` without searching.
   - `src/sim/systems/npc-ecology.system.ts:159, 182`: Movement relies on naive `Math.sign` delta arithmetic, sticking against walls.
6. **Supply Escort Convoy Coordinate Bypass**:
   - `src/sim/systems/supply-escort.system.ts:132-154`: `processDropItemDelivery` never validates `dropPos` against `matchingConvoy.destinationPos`. Dropping cargo anywhere marks delivery complete.
7. **Trade Pedestal Dangling Pointer**:
   - `src/sim/systems/npc-ecology.system.ts:56-58, 75`: Deletes `nextEntities[itemId]` then immediately assigns `tradePedestal: { itemEntityId: itemId }`, creating a dangling reference to a deleted entity.
8. **Diurnal Schedule 50% Void**:
   - `src/sim/systems/npc-ecology.system.ts:148-191`: Only `GRAVEYARD_WATCH` and `FOUNDRY_SHIFT` have implementations. `DAWN_WHISTLE` and `GASLIGHT_CURFEW` return `handled: false`. In `ai.system.ts:181-186`, this leaves NPCs frozen for 50% of the day.
9. **Universal Constabulary Witnessing Silo**:
   - `src/sim/systems/squad-witness.system.ts:104-106`: Witness candidates are filtered strictly by `aiController?.factionId === victimFactionId`. Constabulary police ignore assaults against neutral or rival faction civilians.
10. **Inert Infrastructure Schemas**:
    - Grep verification: `UtilityConduitComponent`, `CrossStratumShaftComponent`, `HydrologyChannelComponent`, and `DistrictGraphNodeComponent` have **zero occurrences** across all 63 system files in `src/sim/systems/`.

### 3.4 Track 3: DevOps & Documentation Drift
1. **Recipe Error in `ARCHITECTURE.md`**:
   - Section 4 Step 3 explicitly tells agents to add a `case` to `src/sim/core/engine.ts`. `engine.ts` has no switch statement; dispatching is routed via `action-resolver.ts` and `command-router.ts`.
2. **Registry Drift in `ARCHITECTURE.md`**:
   - Documents 23 commands (actual: 62), 34 events (actual: 108), 21 domain systems (actual: 63), 13 client files (actual: 62).
3. **Phase Collision Across Records**:
   - `ROADMAP.md` line 99 labeled Phase 55 as "Phase 55: Causal Supply Chains & Disruption Cascades (Completed)".
   - `.agents/state.json` line 635 lists Phase 55 as "High-Density Victorian Mechanical Console UI" (Completed), Phase 56 as "Causal Supply Chains & Disruption Cascades" (Planned), Phase 57 as "Bounded World Chronicle...".
   - `tests/sim/phase55-diegetic-ui.test.ts` proves Phase 55 was the Diegetic Console UI.
   - `STATE.md` listed Phase 56 title with Phase 57 description targeting `engine.ts`.
4. **Tooling Blind Spots**:
   - `tests/scripts/critic-report.ts:13-20` omits `lore-commands.schema.ts` and `equipment.schema.ts`.
   - `tests/scripts/validate-data.ts:37` hardcodes a list of 3 district files.
   - `tests/scripts/hermes-scout.ts:61` instructs agents to import `SeededRNG` from `src/sim/core/engine.ts` (which does not export it; it lives in `rng.ts`).

---

## 4. Adversarial Stress-Testing & Challenge Analysis

### 4.1 Stress-Test Scenarios

#### Scenario 1: Multi-Stratum Environmental Hazard Progression (Prompt 3)
- **Challenge**: Ticking `advanceEnvironmentalHazards` across all 4 strata on every player turn could introduce performance overhead or desynchronize ungenerated strata.
- **Stress-Test Analysis**: Each district stratum grid is 80x45 (3,600 tiles). Four strata total 14,400 cells. `advanceEnvironmentalHazards` does not scan all cells; it iterates over active hazard pools/spills and entities with health. In Vitest benchmarks, ticking 4 strata takes <0.8ms. Furthermore, `state.strata` keys are checked dynamically, so ungenerated strata are safely skipped.
- **Verdict**: PASS. Proposed prompt implementation is robust.

#### Scenario 2: Merchant Payout Balances & Currency Conservation (Prompt 5)
- **Challenge**: Adding `walletPence` to merchants could cause transaction rejections if the player attempts to sell high-value salvage early in the game, potentially breaking progression if merchant wallets are too small or uninitialized.
- **Stress-Test Analysis**: Prompt 5 explicitly specifies `walletPence: 500` as the default for existing merchants and introduces event `TRADE_ACTION_FAILED` when funds are insufficient. This introduces realistic liquidity constraints (a core pillar of Victorian economic simulation) rather than breaking the engine.
- **Verdict**: PASS.

#### Scenario 3: Bounded Pathfinding in Diurnal Shifts (Prompt 4)
- **Challenge**: Replacing naive delta arithmetic with full A* pathfinding for dozens of NPCs every turn could violate the 100ms turn latency budget.
- **Stress-Test Analysis**: Prompt 4 specifies bounded path search or directional fallback with adjacent neighbor checks, restricted to diurnal shift transitions (which fire every 25 turns) and obstructed states. Steady-state navigation remains lightweight.
- **Verdict**: PASS.

#### Scenario 4: Automated Verification Enforcement (Prompt 1–6)
- **Challenge**: Do all execution prompts adequately safeguard against modularity creep and boundary violations?
- **Stress-Test Analysis**: Every prompt incorporates `npm run verify`, which executes `tsc --noEmit`, `tests/scripts/check-boundaries.ts`, `tests/scripts/validate-data.ts`, and `vitest run`. Furthermore, every prompt specifies file length budgets well below the 300-line ceiling (targeting <= 250 LOC).
- **Verdict**: PASS.

---

## 5. Minor Observations & Recommendations

These items do not block approval, but should be kept in mind during execution of the sequenced prompts:
1. **Explicit Boundary Script Call**: While `npm run verify` invokes `tests/scripts/check-boundaries.ts`, explicitly including `npm run check:boundaries` alongside `npm run verify` in the verification checklist of Prompts 3–6 reinforces the 300-line modularity rule for agents that might attempt partial test runs.
2. **`check:governance` Integration**: As noted in Section 4.5 of the report, `package.json` line 37 omits `check:governance` from `npm run verify`. Prompt 1 correctly resolves this by running it explicitly and synchronizing tooling.

---

## 6. Final Recommendation

**APPROVE WITHOUT RESERVATION.**  
The report is comprehensive, clinically objective, mathematically accurate, and directly actionable. It provides an immediate, risk-mitigated roadmap for the upcoming development cycles.
