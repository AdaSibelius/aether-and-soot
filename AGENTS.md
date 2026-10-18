# AGENTS.md — Foundational AI Engineering Rulebook (Aether & Soot)

> **SYSTEM DIRECTIVE**: You are modifying *Aether & Soot*, a deterministic Victorian Steampunk roguelike engineered for autonomous AI workflows. Every rule in this document is enforced by automated verification scripts (`npm run verify`). Read [ARCHITECTURE.md](./ARCHITECTURE.md) before making any changes.

---

## 1. Mandatory Pre-Flight Protocol (Execute Before Writing Code)

### Rule 1.1: The Anti-Duplication Search Rule
Before creating any new type, helper function, component, or system, you **MUST** inspect [ARCHITECTURE.md](./ARCHITECTURE.md) and search the existing codebase (`grep` / file view) to verify it does not already exist:
- **Spatial & Grid Lookups**: Do NOT write custom coordinate math or entity loops. Use `isWithinBounds`, `getTileCell`, `setTileCell`, `findEntitiesAtPoint`, and `findBlockingEntityAtPoint` from `src/sim/spatial/grid.ts`, or `findPortalAtPoint` from `src/sim/spatial/portals.ts`.
- **Line-of-Sight & Pathfinding**: Use `computeVisibleTiles` / `isPointVisible` from `src/sim/spatial/fov.ts` and `hasWalkablePath` from `src/sim/spatial/generator.ts`.
- **Randomness**: Do NOT create new PRNG classes or call non-deterministic browser PRNGs. Use the `SeededRNG` instance hydrated in `src/sim/core/engine.ts` (`rng.nextInt(min, max)`, `rng.nextFloat()`, `rng.nextUint32()`).
- **Schemas & IDs**: Reuse branded schemas (`EntityIdSchema`, `BlueprintIdSchema`, `StratumIdSchema`, `LimbSlotIdSchema`, `FactionIdSchema`, `CommodityIdSchema`) from `src/schemas/primitives.schema.ts`.

### Rule 1.2: The Pre-Flight Impact Analysis Block
Before modifying any file or creating a new feature, you **MUST** output a concise **Impact Analysis Checklist** in your response covering these 5 points:
1. **Schemas Impacted (`src/schemas/`)**: Which Zod schemas (`components`, `commands`, `events`, `blueprint`, `primitives`) require new fields or union variants?
2. **Serialization & Save-State Impact (`WorldStateSchema`)**: Does this change alter `WorldState` structure in `src/sim/core/world.ts`, and will `serializeWorld` / `deserializeWorld` remain 100% compatible?
3. **Existing Infrastructure Reused**: Which exact functions from `src/sim/spatial/` or `src/sim/systems/` will be called instead of writing new utility code?
4. **File Size & Modularity Check**: List the current line counts (`wc -l`) of every file you plan to touch. If any target file will exceed **250 lines** (or is already near the **300-line hard fail limit**, such as `anatomy.system.ts`, `economy.system.ts`, or `generator.ts`), state the name of the new sub-module you will extract.
5. **Client / HUD Impact (`src/client/`)**: Does `projectWorldToVisualFrame` or `formatEventMessage` in `HudLayout.tsx` need to handle new visual flags or `SimEvent` variants?

---

## 2. Non-Negotiable Architectural Guardrails

### Rule 2.1: Strict Headless Separation (`src/sim/` vs `src/client/`)
- Files inside `src/sim/` and `src/schemas/` **MUST NEVER** import from `src/client/`, `pixi.js`, `preact`, or reference browser globals (`window`, `document`, `requestAnimationFrame`, `HTMLCanvasElement`).
- `Math.random()` and `Date.now()` are **STRICTLY FORBIDDEN** in `src/sim/` and `src/schemas/` (even inside comments—`npm run check:boundaries` scans raw file text for those tokens).
- `src/client/` **MUST NEVER** mutate `WorldState` directly. All state changes must flow through `dispatchCommand(state, command)`.

### Rule 2.2: Modularity & File Size Ceiling (Hard Gate: 300 Lines)
- Target file length: **<= 250 lines**.
- Hard automated failure ceiling: **300 lines** (enforced by `tests/scripts/check-boundaries.ts`).
- Keep modules single-responsibility: one domain system per file in `src/sim/systems/`, one UI panel per file in `src/client/ui/`.
- **Warning on Near-Cap Files**: `src/sim/systems/anatomy.system.ts` (293 lines), `src/sim/spatial/generator.ts` (285 lines), and `src/sim/systems/economy.system.ts` (283 lines) are at capacity. Do NOT add new functions to these files—create a new sibling module (e.g., `src/sim/systems/prosthetics.system.ts` or `src/sim/systems/factions.system.ts`) and import it.

### Rule 2.3: Zero Untyped Boundaries & Flat Relational ECS
- `any`, `as unknown as`, and `@ts-ignore` / `@ts-expect-error` are **FORBIDDEN**.
- The project compiles with `"strict": true`, `"noUncheckedIndexedAccess": true`, and `"exactOptionalPropertyTypes": true`. Always guard array/record index lookups (`const cell = grid.cells[idx]; if (!cell) return;`).
- **Flat Relational Entities**: Never nest `EntityRecord` objects inside other `EntityRecord` objects. Store all entities in `state.entities[entityId]` and link them via branded `EntityId` strings.
- **Event Sourcing**: Every gameplay state mutation MUST emit a typed `SimEvent` into the turn log so headless tests and the HUD chronicle can inspect the causal chain.

---

## 3. Mandatory Verification Gate (Run Before Completing Any Turn)

You **MUST** run `npm run verify` after any code or JSON modification and confirm **0 errors** before yielding to the user:

```bash
npm run verify
```

This single command executes all four gates in sequence:
1. `npm run typecheck` (`tsc --noEmit`) — Verifies strict TypeScript types and exhaustive `SimEvent` / `GameCommand` switches.
2. `npm run check:boundaries` (`tsx tests/scripts/check-boundaries.ts`) — Verifies zero forbidden imports, zero `Math.random()` / `Date.now()` tokens in `src/sim/`, and enforces the 300-line ceiling across all `.ts`/`.tsx` files.
3. `npm run validate:data` (`tsx tests/scripts/validate-data.ts`) — Validates all JSON files in `data/` against Zod schemas in `src/schemas/blueprint.schema.ts`.
4. `npm run test:sim` (`vitest run`) — Executes the headless deterministic simulation test suite (`tests/sim/*.test.ts`). Every new feature must include at least one deterministic unit test in `tests/sim/`.

---

## 4. Autonomous Git & GitHub MCP Workflow

- **Never instruct the user to run manual `git` or GitHub CLI commands** when you can execute them directly via the local shell or `github-mcp-server`.
- Track new features and milestones as GitHub Issues via `github-mcp-server` (`issue_write`, `list_issues`).
- Use descriptive feature branches (`feat/<domain>-<feature>`), verify with `npm run verify`, and synchronize with `AdaSibelius/aether-and-soot` via `github-mcp-server` (`create_branch`, `push_files`, `create_pull_request`, `merge_pull_request`).
