---
name: feature-recipe
description: >-
  Standard 6-step feature implementation recipe, schema update guidelines,
  command dispatching, state migration, and modularity splitting patterns for Aether & Soot.
---

# Feature Implementation Recipe & Modularity Patterns (Aether & Soot)

This skill provides step-by-step procedures for implementing new gameplay mechanics, expanding schemas, splitting near-cap modules, and maintaining deterministic save-state compatibility in *Aether & Soot*.

---

## 1. The 6-Step Implementation Recipe

Follow this sequence for any new gameplay command, physical interaction, or system:

### Step 1: Schemas First (`src/schemas/`)
- **Components**: Add new fields or component schemas to `src/schemas/components.schema.ts` (or `src/schemas/world-components.schema.ts`).
- **Commands**: Add the new command variant to `GameCommandSchema` in `src/schemas/commands.schema.ts`. Use discriminated unions keyed by `type`.
- **Domain Events**: Add corresponding event variants to `src/schemas/domain-events.schema.ts` and ensure they are aggregated in `src/schemas/events.schema.ts` (`SimEventSchema`).
- **Primitives**: Reuse branded types (`EntityIdSchema`, `BlueprintIdSchema`, `StratumIdSchema`) from `src/schemas/primitives.schema.ts`.

### Step 2: Pure Domain System (`src/sim/systems/`)
- Check file length: `wc -l src/sim/systems/<domain>.system.ts`.
- **If the file is >= 220 lines**, split or create a new dedicated system module (`<subdomain>.system.ts`) rather than risk breaching the 300-line hard ceiling.
- Implement pure functions following the functional signature:
  ```typescript
  export function resolveAction(
    state: WorldState,
    command: ActionCommand,
  ): { state: WorldState; events: SimEvent[]; apSpent: number }
  ```
- **Determinism**: Use the passed world's hydrated `SeededRNG` (`rng.nextInt()`, `rng.nextFloat()`). Never use `Math.random()` or `Date.now()`.
- **Spatial Lookups**: Always use `isWithinBounds`, `getTileCell`, `findEntitiesAtPoint`, and `findBlockingEntityAtPoint` from `src/sim/spatial/grid.ts`.

### Step 3: Wire into Engine Dispatcher (`src/sim/core/engine.ts`)
- Add a `case '<COMMAND_TYPE>':` branch to `dispatchCommand()`.
- Pass validated command payloads to your pure system function.
- Return the updated state, events, and `apSpent`.

### Step 4: Chronicle Synchronization (`src/client/ui/EventFormatter.ts`)
- Format every new `SimEvent` variant into atmospheric Victorian narrative prose.
- Delegate this to the local chronicler:
  ```bash
  npm run hermes:chronicler
  ```
- Verify that `formatEventMessage()` handles all union members exhaustively without TypeScript compile errors.

### Step 5: Deterministic Unit Tests (`tests/sim/`)
- Create or update a test suite in `tests/sim/<feature>.test.ts`.
- Follow the Given -> When -> Then pattern:
  - **Given**: Seeded world (`createInitialWorld({ seed: 42 })`) with explicit test entities.
  - **When**: Dispatched command via `dispatchCommand(world, command)`.
  - **Then**: Assert component mutation, emitted `SimEvent`s, and deterministic world state.
- Alternatively, scaffold initial test structure using `npm run hermes:testgen`.

### Step 6: Verification Gate
- Run all four automated quality gates:
  ```bash
  npm run verify
  ```
- Confirm 0 errors across TypeScript typecheck, boundary check, data validation, and simulation test suite.

---

## 2. Modularity & Pre-Splitting Workflow (Rule 2.2)

- Target line ceiling: **<= 250 lines**.
- Hard failure ceiling: **300 lines** (enforced by `tests/scripts/check-boundaries.ts`).
- When a file reaches **>= 240 lines**, pre-split it before adding logic:
  ```bash
  npm run hermes:split -- --source src/sim/systems/target.system.ts --target src/sim/systems/target-helper.ts --extract funcA,funcB
  ```
- Preserve public interfaces by re-exporting extracted symbols from the original module if needed.

---

## 3. Save-State Compatibility & Serialization Invariants

- All world mutations must remain 100% JSON-serializable.
- `serializeWorld(state)` and `deserializeWorld(json)` must produce identical state structures.
- Entities must remain flat: store in `state.entities[entityId]` and reference by branded `EntityId` strings. Never embed `EntityRecord` instances within other entity components.
