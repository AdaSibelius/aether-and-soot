# Task Assignment: M1 Explorer It2.1 — Paperdoll Boundary Hardening

Read:
- `/Users/emmett/Desktop/Game/.agents/teamwork/ORIGINAL_REQUEST.md`
- `/Users/emmett/Desktop/Game/.agents/teamwork/teamwork_challenger_m1_1/handoff.md` (Challenger 1 findings on Vulnerability A)
- `src/client/canvas-ui/dossier-paperdoll.ts` lines 140–175

Your Mission:
Formulate the exact hardening strategy for `dossier-paperdoll.ts`:
1. Prevent string length overflow on `rArm.hp` (line 149), `rLeg.hp` (line 159), and `STM:${stam}%` (line 169) so characters never clobber column 87 or spill into column 88 even on 6-digit or 7-digit HP values.
2. Provide exact replacement diff lines.
3. Keep `dossier-paperdoll.ts` <= 175 lines.
4. Output your report to `/Users/emmett/Desktop/Game/.agents/teamwork/teamwork_explorer_m1_it2_1/handoff.md`.

## 2026-11-01T19:19:32Z
You are M1 It2 Explorer 1.
Your working directory is: /Users/emmett/Desktop/Game/.agents/teamwork/teamwork_explorer_m1_it2_1/
Read:
1. /Users/emmett/Desktop/Game/.agents/teamwork/ORIGINAL_REQUEST.md
2. /Users/emmett/Desktop/Game/.agents/teamwork/teamwork_explorer_m1_it2_1/DISPATCH.md
3. /Users/emmett/Desktop/Game/.agents/teamwork/teamwork_challenger_m1_1/handoff.md
4. src/client/canvas-ui/dossier-paperdoll.ts lines 140–175

Formulate the exact hardening strategy for dossier-paperdoll.ts to prevent string overflow past column 87.
Write your report to:
/Users/emmett/Desktop/Game/.agents/teamwork/teamwork_explorer_m1_it2_1/handoff.md
When done, notify me via send_message.
