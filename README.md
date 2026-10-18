# Aether & Soot

A deep, emergent, 2D turn-based Victorian Steampunk roguelike blending the simulation depth, anatomical conditions, and systemic interactions of *Cataclysm: Dark Days Ahead (CDDA)* with the stylized palette cycling, glyph/tile hybrid canvas, and CRT shader presentation of *Caves of Qud*.

Built via autonomous AI agent workflows with strict headless Core/Shell separation (`src/sim/` vs `src/client/`).

## Verification Pipeline

```bash
npm run verify
```

Runs:
1. `npm run typecheck` — Strict TypeScript compiler checks (`noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`).
2. `npm run check:boundaries` — Enforces zero client/DOM imports or non-deterministic PRNG calls in `src/sim/` and checks the 300-line modularity ceiling.
3. `npm run validate:data` — Validates all declarative JSON blueprints in `data/` against Zod schemas.
4. `npm run test:sim` — Runs the headless Vitest simulation suite in <250ms.
