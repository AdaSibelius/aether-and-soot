---
name: antigravity-governance
description: >-
  Standard operating protocols for Antigravity pairing: GitHub MCP issue lifecycle,
  STATE.md Sanity Checking, Roadmap Grooming gates (Approve/Tweak/Defer), and Argon escalation.
---

# Antigravity Ecosystem Governance (Aether & Soot)

This skill codifies the governance protocols binding daily-driver agents (Gemini Flash) to executive reasoning oversight (Argon), automated tooling, and the GitHub MCP integration.

---

## Protocol 1: GitHub MCP Issue & Branch Lifecycle

Never instruct the user to run manual git operations. Manage tasks directly through `github-mcp-server`:
1. **Query Existing Issues**:
   - Call `list_issues` on `AdaSibelius/aether-and-soot` with `state: "OPEN"`.
2. **Create Issue (If Missing)**:
   - Call `issue_write` with:
     - `method`: `"create"`
     - `title`: `"[Phase X]: <Phase Title>"` or `"[Tooling]: <Feature Title>"`
     - `body`: Markdown checklist containing all phase deliverables from `ROADMAP.md`.
3. **Branch Creation**:
   - Extract the returned `<issue_number>` and create feature branch:
     ```bash
     git checkout -b feat/issue<issue_number>-<slug>
     ```
   - Always run git commands with `BypassSandbox: true`.
4. **Closing Issues**:
   - Reference `Closes #<issue_number>` in all commit messages and pull requests.

---

## Protocol 2: Antigravity Sanity Check on `STATE.md` Prescriptions

Local LLMs (Tier 1 `lfm2.5:24b` or Tier 3 `hermes3:8b`) can hallucinate prescriptions. Agents must apply the Sanity Check Protocol before implementing any phase:
1. **Filter (Boundary Enforcement)**:
   - Discard suggestions that violate Headless Core/Shell separation (`src/sim/` importing `src/client/`).
   - Discard suggestions attempting to inject gameplay mechanics into `tests/scripts/`.
2. **Evaluate Scope**:
   - Verify that target files do not exceed the 300-line ceiling after edits.
3. **Merge**:
   - Fold **P2** (serializer command surface & cross-wiring) and **P3** (pre-splitting near-cap files >= 240 lines) directly into the active phase work.
   - If a **P1** feature fits the current modularity budget, implement it now. If it exceeds budget, append it to the *Emergent Systemic Backlog* (`Tier F` in `ROADMAP.md`).

---

## Protocol 3: Roadmap Grooming & User Approval Gate ("Approve / Tweak / Defer")

### Pre-Phase Micro-Check (Emergent Systemic Backlog)
When beginning an active phase, scan `Tier F` (or remaining backlog items) in `ROADMAP.md`. If an item directly shares systemic lineage with the current phase and fits within the 300-line file ceiling, pull it into the active phase scope.

### End-of-Tier Macro-Check (Mandatory User Gate)
When completing the final scheduled phase of an active tier (e.g. upon completing **Phase 50** at the end of `Tier E`):
1. Execute verification: `npm run verify`, `npm run hermes:critic`, and `npm run sync:state`.
2. **HALT THE TURN**: Do **NOT** invent an unapproved next phase implementation prompt.
3. Synthesize candidate items from the *Emergent Systemic Backlog* into a proposed next tier of numbered phases (checking 300-line modularity limits, schemas impacted, and test deliverables).
4. Present the proposal in chat asking:
   > *"Active roadmap tier complete. Proposed Phase(s) [X–Y] scoped from the Emergent Systemic Backlog. Do you **Approve**, **Tweak**, or **Defer** before we promote them into `ROADMAP.md`?"*
5. Await explicit user response before promoting phases in `ROADMAP.md`.

---

## Protocol 4: Two-Strike Escalation Invariant (`AGENTS.md` Rule 1.5)

If an agent encounters an `npm run verify` failure (`typecheck`, `check:boundaries`, `validate:data`, or `test:sim`) that it fails to resolve after **two consecutive attempts**:
1. **HALT IMMEDIATELY**: Do not make speculative edits.
2. Do not commit or push broken code.
3. Output the exact escalation trigger block:
   ```text
   [ESCALATION REQUIRED]: Agent looping on <issue>. Switch to high-tier reasoning agent to diagnose architectural conflict.
   ```
4. Yield the turn to allow Argon takeover.
