# Project State

**Last Updated:** 2026-10-22

## Recent Commits
- a7b08c9: Formalize Tier E promotion cadence, escalation triggers & GitHub issue tracking in AGENTS.md
- c740317: Establish Roadmap Grooming Protocol, Tier E Emergent Backlog & Mandatory Git Push Gate
- adf7b6b: Update STATE.md and post-Phase 44 critic audit for Phase 45 handoff

## Immediate Next Priority
- **Phase 46: Procedural WebAudio Soundscape & Acoustic Synth Shell**: WebAudio synthesizer wired to finalized `SimEvent` triggers across Phases 37–45.

## 5. Self-Directed Prescriptions for Next Phase (P1, P2, P3)

**P1 — Wire the unwired surface with design intent.** The eight unwired commands are architectural scaffolding; wire them in order of player-impact and thematic fit: PAY_CHIRURGEON_HEAL and INSTALL_PROSTHETIC (character customization tied to character-archetypes.ts), LOAD_AMMO and LOOT_CONTAINER (inventory.system.ts), EMIT_SPARK and PRESSURIZE_VESSEL (environmental hazard/feedback), PRY_OBSTACLE and VENT_STEAM (mechanical interaction). Do not wire all at once — keep the active set small as in the current telemetry. The goal is to expand the player's agency surface without bloating the core loop.

**P2 — Phase 46 soundscape integration.** The priority is the WebAudio synthesizer wired to finalized SimEvent triggers across Phases 37–45. Treat VENT_STEAM as a sonic texture within that shell (steam hiss, pressure release) so the mechanical systems and audio reinforce each other. This is the highest-priority item per telemetry and should be completed before expanding the active command set further.

**P3 — Seed NPC agency from the same architectural pool.** Use the unwired commands as a design brief for NPC behavior: PRESSURIZE_VESSEL and PRY_OBSTACLE suggest that environmental manipulation is a known mechanic; NPCs could use those same actions (or simplified variants) to patrol, defend, or flee. Tie character-archetypes.ts to enemy classes so the same build language defines both player and NPC behavior — this gives NPCs consistent agency without inventing new systems. Even a minimal chase/defend loop wired through USE_PORTAL and VENT_STEAM would give the world actors presence.

## 6. Next-Phase Handoff Prompt

```markdown
Implement **Phase 46: Procedural WebAudio Soundscape & Acoustic Synth Shell**: WebAudio synthesizer wired to finalized `SimEvent` triggers across Phases 37–45. adhering to AGENTS.md and ARCHITECTURE.md:
1. Run `npm run hermes:scout -- --task "the active phase"` and complete the 6-point Pre-Flight Impact Analysis (including STATE.md P1/P2/P3 triage).
2. Pre-split any src/ hotspot >= 245 lines (`src/sim/core/world.ts` (245 lines)) via `npm run hermes:split`.
3. Implement the active phase while folding in P2 (systemic cross-wiring & unwired serializer commands: `EMIT_SPARK`, `INSTALL_PROSTHETIC`, `INSTALL_WEAPON_MOD`, `LOAD_AMMO`) and P3 (serialization & deterministic unit tests in tests/sim/), and promoting any out-of-budget P1 agency items into ROADMAP.md.
4. Delegate blueprints (`generate:content`), event logs (`hermes:chronicler`), and test scaffolding (`hermes:testgen`) to local models.
5. Run `npm run verify`, `npm run hermes:critic`, and `npm run sync:state`, then output the next copy-pasteable prompt.
```
