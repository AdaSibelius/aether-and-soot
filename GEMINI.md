# GEMINI.md — Persistent Workspace Context (Aether & Soot)

Every AI agent session working in this repository MUST read and obey:
1. **[AGENTS.md](./AGENTS.md)** — Mandatory Pre-Flight Impact Analysis, Anti-Duplication Search Rule, 300-line Modularity Ceiling, and Strict Headless Core/Shell Guardrails.
2. **[ARCHITECTURE.md](./ARCHITECTURE.md)** — Complete System Registry, `WorldState` Data Flow, and 6-Step Feature Implementation Recipe.

## Mandatory Verification & Git Sync Gate
Before finishing ANY turn that modifies code or documentation:
1. Run verification and confirm 0 errors:
   ```bash
   npm run verify
   ```
2. Immediately commit and push:
   - If working directly on `main`:
     ```bash
     git add -A && git commit -m "<concise descriptive message>" && git push origin main
     ```
   - If completing a task on a feature branch (`feat/*`, `audit/*`), merge into `main` and prune the branch immediately:
     ```bash
     git add -A && git commit -m "<concise descriptive message>" && git checkout main && git merge --ff-only <branch> && git push origin main && git branch -d <branch> && git push origin --delete <branch>
     ```
3. Confirm clean working tree (`git status --porcelain` is empty) and remote sync before yielding to the user. Never yield with uncommitted or unpushed changes or unmerged feature branches.
