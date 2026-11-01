# Task Assignment: Worker — Milestone 1 Iteration 2: Edge Case Hardening

Read:
- `/Users/emmett/Desktop/Game/.agents/teamwork/ORIGINAL_REQUEST.md`
- `/Users/emmett/Desktop/Game/.agents/teamwork/teamwork_challenger_m1_1/handoff.md` (Challenger 1 findings)
- `/Users/emmett/Desktop/Game/.agents/teamwork/teamwork_explorer_m1_it2_1/handoff.md` (Paperdoll hardening diffs)
- `/Users/emmett/Desktop/Game/.agents/teamwork/teamwork_explorer_m1_it2_2/handoff.md` (Chronicle null safety diffs)
- `/Users/emmett/Desktop/Game/.agents/teamwork/teamwork_explorer_m1_it2_3/handoff.md` (Stress test updates)
- `AGENTS.md` and `ARCHITECTURE.md`

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

Your Mission:
Apply the hardening fixes identified by Iteration 2 Explorers:
1. In `src/client/canvas-ui/dossier-paperdoll.ts`:
   - Clamp HP strings and stamina so they never exceed column allocations or clobber column 87:
     Row 2 (rArm): `${Math.min(9999, rArm.hp)}HP`.padStart(5, ' ').slice(0, 6)
     Row 4 (rLeg): `${Math.min(9999, rLeg.hp)}HP`.padStart(5, ' ').slice(0, 6)
     Row 5 (STM): `STM:${Math.min(999, stam)}%`.slice(0, 8)
2. In `src/client/canvas-ui/console-chronicle.ts`:
   - Filter and guard event lines so null/undefined lines never cause `TypeError`:
     `const rawLine = lines[idx]; if (!rawLine) continue;`
3. In `src/client/ui/EventFormatter.ts`:
   - Add strict type-safe fallback in `formatEventMessage` for unknown/unexpected events:
     `const fallback: { turn?: number; type?: string } | null | undefined = ev;`
     `return \`[T\${fallback?.turn ?? 0}] Telegraph dispatch: \${fallback?.type ?? 'UNKNOWN'}.\`;`
4. In `tests/sim/tactical-console-stress.test.ts`:
   - Update Scenario D to assert hardened behavior (right-bezel border at col 87 is preserved as '║', 7-digit HP does not overflow to col 88, unhandled events produce safe ticker lines without throwing).
5. Run `npm run verify` to confirm 0 errors across all gates.
6. Guard: Keep all modified files <= 220 lines. Do NOT touch `src/client/renderer/glyph-stage.ts` (frozen at 239 lines).

Write your completion report to `/Users/emmett/Desktop/Game/.agents/teamwork/teamwork_worker_m1_it2/handoff.md`.
When done, notify me via send_message.

## 2026-11-01T19:26:10Z
[Message] timestamp=2026-11-01T19:26:10Z sender=61239d6e-5e21-48a8-8b66-444d6753c37e priority=MESSAGE_PRIORITY_HIGH content=You are Worker M1 Iteration 2 (Edge Case Hardening).
Your working directory is: /Users/emmett/Desktop/Game/.agents/teamwork/teamwork_worker_m1_it2/
Read:
1. /Users/emmett/Desktop/Game/.agents/teamwork/ORIGINAL_REQUEST.md
2. /Users/emmett/Desktop/Game/.agents/teamwork/teamwork_worker_m1_it2/DISPATCH.md
3. /Users/emmett/Desktop/Game/.agents/teamwork/teamwork_challenger_m1_1/handoff.md
4. /Users/emmett/Desktop/Game/.agents/teamwork/teamwork_explorer_m1_it2_1/handoff.md
5. /Users/emmett/Desktop/Game/.agents/teamwork/teamwork_explorer_m1_it2_2/handoff.md
6. /Users/emmett/Desktop/Game/.agents/teamwork/teamwork_explorer_m1_it2_3/handoff.md
7. AGENTS.md and ARCHITECTURE.md

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

Apply the hardening changes:
1. dossier-paperdoll.ts: clamp HP strings and stamina percentage so they never overflow past column 87.
2. console-chronicle.ts: null/undefined guard on event lines.
3. EventFormatter.ts: safe type-safe fallback for unhandled events.
4. Update tests/sim/tactical-console-stress.test.ts to verify the hardened invariants.
5. Run `npm run verify` to confirm 0 errors across all 4 gates.
6. Guard: Keep all modified files <= 220 lines. Do not touch glyph-stage.ts.

Write your completion report to:
/Users/emmett/Desktop/Game/.agents/teamwork/teamwork_worker_m1_it2/handoff.md
When done, notify me via send_message.
