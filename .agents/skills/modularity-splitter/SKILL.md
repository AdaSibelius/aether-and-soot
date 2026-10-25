---
name: modularity-splitter
description: >-
  Deterministic AST-guided modularity splitter for .ts and .tsx files approaching
  the 240-line warning threshold and 300-line hard modularity ceiling in Aether & Soot.
---

# Modularity Splitter & TSX Bisection Skill (Aether & Soot)

This skill provides operational workflows and automated commands to safely bisect domain systems (`.ts`) and Preact UI components (`.tsx`) before they breach the 300-line hard failure ceiling (`AGENTS.md` Rule 2.2).

---

## 1. Modularity Thresholds & Watchlist

- **Target file length**: $\le 250$ lines.
- **Warning threshold**: $\ge 240$ lines.
- **Hard failure ceiling**: $300$ lines (enforced by `npm run check:boundaries`).

To inspect current repository line counts and near-cap files:
```bash
npm run generate:arch-map
```

---

## 2. The 3-Step Bisection Workflow

### Step 1: List Extraction Candidates
List all top-level functions, components, interfaces, and consts with their line numbers:
```bash
npx tsx tests/scripts/hermes-split.ts --source <path_to_file> --list-candidates
```
*Example:*
```bash
npx tsx tests/scripts/hermes-split.ts --source src/client/ui/AnatomyWindow.tsx --list-candidates
```

### Step 2: Safe Dry-Run Simulation
Simulate the split to verify symbol extraction count, import reconciliation, and line reductions without touching disk:
```bash
npx tsx tests/scripts/hermes-split.ts \
  --source src/client/ui/AnatomyWindow.tsx \
  --target src/client/ui/AnatomyGraftPanel.tsx \
  --extract AnatomyGraftPanel \
  --dry-run
```

### Step 3: Atomic Execution & Auto-Rollback
Execute the split. `hermes-split` automatically:
1. Slices the target AST blocks and dependent internal functions.
2. Generates the target file with reconciled imports.
3. Rewrites the source file with re-exports (`export { ... } from './target.js'`).
4. Runs `npx tsc --noEmit && tsx tests/scripts/check-boundaries.ts`.
5. **Rolls back automatically** to the original file if verification fails!
```bash
npx tsx tests/scripts/hermes-split.ts \
  --source src/client/ui/AnatomyWindow.tsx \
  --target src/client/ui/AnatomyGraftPanel.tsx \
  --extract AnatomyGraftPanel
```

---

## 3. TSX / Preact Component Specifics

When bisecting `.tsx` files:
- Use `.js` in import specifiers (e.g. `import { SubPanel } from './SubPanel.js';`) to adhere to ESM module resolution.
- Ensure optional component props satisfy `"exactOptionalPropertyTypes": true` by typing optional parameters as `type?: T | undefined;`.
- Sibling panels in `src/client/ui/` should take explicit readonly props and pass commands via `onCommand: (cmd: GameCommand) => void`.
