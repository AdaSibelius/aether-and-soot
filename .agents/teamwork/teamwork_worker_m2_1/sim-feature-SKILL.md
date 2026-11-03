---
name: sim-feature
description: >-
  Step-by-step procedure for adding new ECS systems, game commands, domain events,
  and client projection adapters in Aether & Soot while preserving headless determinism.
---

# Adding a Simulation Feature (Aether & Soot)

This skill guides the implementation of new simulation features, gameplay commands, physical interactions, or domain systems in *Aether & Soot*.

---

## The 6-Step Implementation Recipe

Follow this exact sequence for any new gameplay mechanic:

### 1. Schema First & Automated Scaffolding (`src/schemas/`)
To prevent near-cap files like `src/schemas/domain-events.schema.ts` (243 lines) or `domain-commands.schema.ts` (234 lines) from breaching the 250-line threshold, scaffold modular schema files automatically:
```bash
npm run scaffold:mechanic -- --domain <slug> --command <COMMAND_NAME> --event <EVENT_NAME>
```
*Example for Phase 50 Environmental Agency:*
```bash
npm run scaffold:mechanic -- --domain environmental --command PRY_OBSTACLE --event OBSTACLE_PRIED
```
This generates dedicated sub-schemas (`src/schemas/<domain>-commands.schema.ts` and `src/schemas/<domain>-events.schema.ts`), system stubs, and unit test suites:
- **Components** (`src/schemas/components.schema.ts`): Add new component fields or define new schemas using primitive branded IDs (`EntityIdSchema`, `BlueprintIdSchema`, `StratumIdSchema` from `src/schemas/primitives.schema.ts`).
- **Commands**: Every command must be a discriminated union variant with a unique `type` literal and actor identifier (`actorId` or `attackerId`).
- **Domain Events**: Define the emitted event variant in `SimEventSchema` with `turn: number` and causal parameters.

### 2. Pure Functional System (`src/sim/systems/`)
Implement domain logic as a pure headless function:
- **File Modularity Check**: Check existing system file size (`wc -l src/sim/systems/<domain>.system.ts`). If already $\ge 220$ lines, create a new sub-module (`<domain>-<subdomain>.system.ts`) to prevent breaching the 300-line hard ceiling.
- **Function Contract**:
  ```typescript
  export function resolveFeatureAction(
    state: WorldState,
    command: FeatureActionCommand,
  ): { state: WorldState; events: SimEvent[]; apSpent: number }
  ```
- **PRNG & Determinism**: Use the hydrated `SeededRNG` instance from `state.rngState` or `createInitialWorld`. Never call `Math.random()` or `Date.now()`.
- **Spatial Lookups**: Reuse `findEntitiesAtPoint`, `getTileCell`, `setTileCell`, and `isWithinBounds` from `src/sim/spatial/grid.ts`. Do not write bespoke coordinate loops.

### 3. Wire Engine Command Router (`src/sim/core/engine.ts`)
Add a `case '<COMMAND_TYPE>':` branch to `dispatchCommand()`:
- Validate and route the command payload to your pure system function.
- Return the updated state, accumulated events, and `apSpent`.

### 4. Chronicle & Event Formatting (`src/client/ui/EventFormatter.ts`)
Map the new `SimEvent` variant to an atmospheric Victorian narrative entry:
- Run `npm run hermes:chronicler` or add a typed `case` branch in `formatEventMessage()`.
- Verify exhaustive TypeScript typechecking (`npm run typecheck`).

### 5. Deterministic Unit Tests (`tests/sim/`)
Add a unit test suite in `tests/sim/<feature>.test.ts`:
- **Given**: Seeded initial world (`createInitialWorld({ seed: 42 })`) with test entities.
- **When**: Dispatched command via `dispatchCommand(world, command)`.
- **Then**: Assert state delta, component changes, and emitted `SimEvent`s.

### 6. Verification Gate
Confirm all 4 verification gates exit with 0 errors:
```bash
npm run verify
```
