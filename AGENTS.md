# AGENTS.md — Autonomous Engineering Constitution (Aether & Soot)

## 1. Architectural Prime Directives (Non-Negotiable)

1. **Strict Headless Separation (`src/sim/` vs `src/client/`)**:
   - Files inside `src/sim/` and `src/schemas/` MUST NEVER import from `src/client/`, `pixi.js`, `preact`, or reference browser globals (`window`, `document`, `requestAnimationFrame`, `HTMLCanvasElement`).
   - `Math.random()` and `Date.now()` are FORBIDDEN in `src/sim/`. All randomness must use the injected `SeededRNG` instance.
2. **File Size & Modularity Ceiling**:
   - Maximum file length: **250 lines** (hard ceiling: 300 lines).
   - Keep modules single-responsibility: one system, one schema domain, or one UI panel per file.
3. **Zero Untyped Boundaries**:
   - `any`, `as unknown as`, and `@ts-ignore` are strictly forbidden.
   - All declarative JSON blueprints in `data/` must be parsed and validated via Zod schemas in `src/schemas/` before entering the simulation.
   - Entity containment and anatomy use flat relational IDs (`EntityId`), never deeply nested mutable object graphs.
4. **Pure System Signatures & Event Sourcing**:
   - Simulation systems in `src/sim/systems/` must be pure functions:
     `(state: WorldState, command: GameCommand, rng: SeededRNG) => SystemResult`
   - Every gameplay state mutation MUST emit a typed `SimEvent` into the turn log for deterministic assertions and replay inspection.

## 2. Mandatory Verification Workflow (Run Before Completing Any Task)

Every agent turn that modifies source code or data files MUST execute the verification pipeline and confirm zero errors:
1. `npm run typecheck` — Validates strict TypeScript contracts (`tsc --noEmit`).
2. `npm run validate:data` — Validates all declarative JSON files in `data/` against Zod schemas.
3. `npm run test:sim` — Runs the headless Vitest simulation suite (`vitest run`).
4. `npm run verify` — Runs the complete verification gate (`typecheck` + `validate:data` + `test:sim` + `check:boundaries`).

## 3. Git & GitHub MCP Autonomous Workflow

- **Never instruct the user to run manual git or GitHub CLI commands** when the agent can execute them directly via the local `git` tool or `github-mcp-server`.
- **Milestone & Issue Tracking**: Track each architectural phase (Phases 1–6) as structured GitHub Issues via `github-mcp-server` (`issue_write`, `sub_issue_write`, `list_issues`).
- **Branch & PR Checkpoints**:
  - Use feature branches (`phase-1/deterministic-kernel`, `phase-2/coq-glyph-shader`, etc.).
  - After `npm run verify` passes, commit atomically and synchronize with GitHub via `github-mcp-server` (`create_branch`, `push_files`, `create_pull_request`, `merge_pull_request`) or `git push`.
