---
trigger: glob
globs: "src/sim/**, src/schemas/**, data/**"
description: "Data-driven flat relational ECS and deterministic emergent simulation standards."
---

# ECS & Headless Simulation Guardrails

## 1. Bit-Exact PRNG Determinism
- Non-deterministic browser or platform calls (`Math.random()`, `Date.now()`, `performance.now()`) are STRICTLY FORBIDDEN anywhere in `src/sim/` and `src/schemas/`.
- All pseudorandom variations must draw from `SeededRNG` using the `xoshiro128**` state tuple stored inside `WorldState.rngState`.

## 2. Flat Relational ECS Architecture
- Entities live exclusively in `state.entities[EntityId]`.
- NEVER construct deep OOP inheritance trees (`class Actor extends Entity`).
- NEVER nest raw entity objects inside other entity records. Link components using branded `EntityId` strings.

## 3. Mandatory SimEvent Emission (Event Sourcing)
- Every gameplay state mutation MUST emit a strongly-typed `SimEvent` variant into `state.eventLog`.
- Never modify entity HP, inventory, positions, or thermodynamics silently without an event.
- Every new `SimEvent` variant must be exhaustively formatted in `src/client/ui/EventFormatter.ts`.

## 4. Modularity & File Size Ceiling (300 Lines)
- Target file size is <= 250 lines.
- Hard automated failure threshold is 300 lines (enforced by `check-boundaries.ts`).
- When a system approaches 240 lines, proactively extract sub-domain helper systems via AST splitting.
