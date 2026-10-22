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
2. Immediately stage, commit, and push to GitHub (using `BypassSandbox: true` for `.git` and network access):
   ```bash
   git add -A && git commit -m "<concise descriptive message>" && git push origin <branch>
   ```
3. Confirm clean working tree (`git status --porcelain` is empty) and remote sync before yielding to the user. Never yield with uncommitted or unpushed changes.
