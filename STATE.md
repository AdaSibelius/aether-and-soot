# Project State

**Last Updated:** 2026-10-22

## Recent Commits
- 22d5b92: Implement Phase 45: Dynamic Turf Skirmishes, Economic Supply Escorts & Royal Society Politics (Closes #42) (#43)
- a7b08c9: Formalize Tier E promotion cadence, escalation triggers & GitHub issue tracking in AGENTS.md
- c740317: Establish Roadmap Grooming Protocol, Tier E Emergent Backlog & Mandatory Git Push Gate

## Immediate Next Priority
- All scheduled phases completed

## 5. Self-Directed Prescriptions for Next Phase (P1, P2, P3)

**P1 — Phase 46: Procedural WebAudio Soundscape & Acoustic Synth Shell.** Implement a WebAudio synthesizer module that maps finalized `SimEvent` triggers from Phases 37–45 to distinct synth patches. Prioritize the events already present in telemetry: `ATTACK_ACTOR` (percussive hit), `VENT_STEAM` (steam-hiss ambient), `USE_PORTAL` (transition tone). Make the soundscape procedural — patch selection and modulation should vary with the phase's environmental state (e.g., steam pressure modulates the hiss pitch). Close the loop: when `VENT_STEAM` fires in-game, the synth emits a matching hiss; when `ATTACK_ACTOR` fires, a sharp percussive hit plays. This ties the soundscape to the active command set without inventing new telemetry.

**P2 — Bridge Unwired Commands into Playable Systems (independent of each other).** First, implement `PAY_CHIRURGEON_HEAL` as an NPC-driven mechanic: the surgeon heals the player when paid, restoring health and giving the chirurgeon agency (the NPC is no longer a dead hook). Tie it to `REST_AT_BED`: the bed NPC can also trigger a rest state that feeds into the Phase 46 soundscape. Second, implement `LOOT_CONTAINER` as a functional loot container — items stored persistently in a container slot, and `REFILL_STEAM` can top up its steam reservoir. These two are independent mechanical systems (healing vs. inventory) and should be wired separately; no dependency between them is invented.

**P3 — Complete Prosthetic & Limb Systems.** Implement `REMOVE_PROSTHETIC` and `REPAIR_LIMB` as a paired player-driven subsystem: the player can remove a prosthetic to access a limb, then repair it to restore full function. This closes the loop with the chirurgeon (the surgeon performs the repair after payment). Ensure `REST_AT_BED` is fully functional — the bed NPC's rest state should emit a calm pad that reinforces the Phase 46 audio theme. P3 is the mechanical cap of the current feature set: once prosthetics are removable and repairable, and the bed heals, the remaining unwired commands (`PRESSURIZE_VESSEL`, `PRY_OBSTACLE`) can be layered on top without breaking the established player/NPC workflow.

## 6. Next-Phase Handoff Prompt

```markdown
Implement **Phase 46: Procedural WebAudio Soundscape & Acoustic Synth Shell**: WebAudio synthesizer wired to finalized `SimEvent` triggers across Phases 37–45. adhering to AGENTS.md and ARCHITECTURE.md:
1. Run `npm run hermes:scout -- --task "the active phase"` and complete the 6-point Pre-Flight Impact Analysis (including STATE.md P1/P2/P3 triage).
2. Pre-split any src/ hotspot >= 245 lines (`src/client/main.tsx` (245 lines)) via `npm run hermes:split`.
3. Implement the active phase while folding in P2 (systemic cross-wiring & unwired serializer commands: `LOOT_CONTAINER`, `PAY_CHIRURGEON_HEAL`, `PRESSURIZE_VESSEL`, `PRY_OBSTACLE`) and P3 (serialization & deterministic unit tests in tests/sim/), and promoting any out-of-budget P1 agency items into ROADMAP.md.
4. Delegate blueprints (`generate:content`), event logs (`hermes:chronicler`), and test scaffolding (`hermes:testgen`) to local models.
5. Run `npm run verify`, `npm run hermes:critic`, and `npm run sync:state`, then output the next copy-pasteable prompt.
```
