# Task Assignment: M1 Explorer 1 — Tactical Console & Diegetic Gauges

Read:
- `/Users/emmett/Desktop/Game/.agents/teamwork/ORIGINAL_REQUEST.md`
- `/Users/emmett/Desktop/Game/.agents/teamwork/orchestrator_1/PROJECT.md`
- `/Users/emmett/Desktop/Game/.agents/teamwork/teamwork_explorer_survey_1/handoff.md`
- `src/client/canvas-ui/tactical-console.ts`
- `src/client/canvas-ui/analog-gauges.ts`
- `src/client/canvas-ui/industrial-primitives.ts`
- `AGENTS.md` and `ARCHITECTURE.md`

Your Mission:
Formulate an exact, implementation-ready code blueprint and diff specification for the Worker:
1. Restructure the 30-column tactical console (`src/client/canvas-ui/tactical-console.ts`) to achieve high information density and Caves of Qud mechanical aesthetic:
   - Thermodynamic Stress: Internal strain load (kW) + ambient steam (kPa) + soot PPM.
   - Satchel Load: Mass and volume bars with carried/equipped item indicator.
   - Pneumatic Ticker Chronicle: Last 3-4 log events formatted in typewriter ink.
   - Bourdon gauge, Sanguine manometer, Wireframe paperdoll, and compact Vernier.
2. Ensure modularity: `tactical-console.ts` is currently 102 lines. If adding new helpers (like ticker log formatting or satchel rendering), extract to `src/client/canvas-ui/console-chronicle.ts` or `console-satchel.ts` so all files remain <= 200 lines (hard ceiling: 300).
3. Specify exact functions, types, row allocations (0..35), and import statements.
4. Output your detailed plan to `/Users/emmett/Desktop/Game/.agents/teamwork/teamwork_explorer_m1_1/handoff.md`.


## 2026-11-01T18:47:59Z
You are M1 Explorer 1 (Tactical Console & Diegetic Gauges).
Your working directory is: /Users/emmett/Desktop/Game/.agents/teamwork/teamwork_explorer_m1_1/
Read the mandatory files:
1. /Users/emmett/Desktop/Game/.agents/teamwork/ORIGINAL_REQUEST.md
2. /Users/emmett/Desktop/Game/.agents/teamwork/teamwork_explorer_m1_1/DISPATCH.md
3. /Users/emmett/Desktop/Game/.agents/teamwork/orchestrator_1/PROJECT.md
4. /Users/emmett/Desktop/Game/.agents/teamwork/teamwork_explorer_survey_1/handoff.md
5. Relevant files in src/client/canvas-ui/ (tactical-console.ts, analog-gauges.ts, etc.)

Design the exact implementation blueprint for restructuring the 30-column tactical console with:
- Thermodynamic stress states (internal strain + ambient steam & soot)
- Compact satchel load (mass/volume)
- Pneumatic ticker chronicle (action log)
- Preserving existing gauges and modularity <= 220 lines per file (300 hard ceiling).

Write your detailed blueprint and handoff report to:
/Users/emmett/Desktop/Game/.agents/teamwork/teamwork_explorer_m1_1/handoff.md
When done, notify me via send_message.
