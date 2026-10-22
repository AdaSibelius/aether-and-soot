# Project State

**Last Updated:** 2026-10-22

## Recent Commits
- 1e47c24: Implement Phase 46: Procedural WebAudio Soundscape & Acoustic Synth Shell (Closes #44) (#45)
- 22d5b92: Implement Phase 45: Dynamic Turf Skirmishes, Economic Supply Escorts & Royal Society Politics (Closes #42) (#43)
- a7b08c9: Formalize Tier E promotion cadence, escalation triggers & GitHub issue tracking in AGENTS.md

## Immediate Next Priority
- **Phase 47: Procedural Architectural Biomes, Topography & Extended CP437/Unicode Glyph Visuals**: Expand `TerrainTypeSchema` and `VisualGlyphSpec` with rich Victorian/Steampunk architectural types (`WROUGHT_IRON_FENCE` `▓`, `BRASS_STEAM_PIPE` `┼`, `GASLAMP_POST` `☼`, `TIMBER_PIER` `═`, `SLAG_MOUND` `▲`, `CANAL_SLUICE` `≈`, `GOTHIC_COLONNADE` `Ω`, and connecting wall box-drawing glyphs `╬`/`║`/`═`). Implement 5 visually distinct district biomes (*Limehouse Docks*, *Spitalfields Smelting Works*, *Gilded Spire Assembly*, *Blackfriars Rookeries*, *Chalk-Vault Catacombs*) with customized dual-color palettes and shader flags (`GASLIGHT_RADIANCE`, `SOOT_OCCLUSION`, `SPARK_GLINT`).

## 5. Self-Directed Prescriptions for Next Phase (P1, P2, P3)

**P1 — Phase 47: Procedural Architectural Biomes, Topography & Extended CP437/Unicode Glyph Visuals.** Expand `TerrainTypeSchema` and `VisualGlyphSpec` with rich Victorian Steampunk architectural types (`WROUGHT_IRON_FENCE` `▓`, `BRASS_STEAM_PIPE` `┼`, `GASLAMP_POST` `☼`, `TIMBER_PIER` `═`, `SLAG_MOUND` `▲`, `CANAL_SLUICE` `≈`, `GOTHIC_COLONNADE` `Ω`, and connecting wall box-drawing glyphs `╬`/`║`/`═`). Deliver 5 distinct district biomes (*Limehouse Docks*, *Spitalfields Foundry*, *Gilded Spire Assembly*, *Blackfriars Rookeries*, *Chalk-Vault Catacombs*) with customized dual-color palettes and shader flags (`GASLIGHT_RADIANCE`, `SOOT_OCCLUSION`, `SPARK_GLINT`).

**P2 — Visual & Topographical Projection Decoupling.** Pre-split visual projection logic from `src/client/projection/frame-adapter.ts` (currently 207 lines) into specialized sub-modules for biome palette mapping and dynamic box-drawing wall connection resolution so frame projection remains strictly under the 250-line ceiling.

**P3 — Modularity & Serializer Safety.** Pre-split `src/client/main.tsx` (244 lines) via `npm run hermes:split`. Ensure new architectural terrain types and visual glyphs are 100% serializable in `WorldState` and tested with deterministic tests in `tests/sim/`.

## 6. Next-Phase Handoff Prompt

```markdown
Implement **Phase 47: Procedural Architectural Biomes, Topography & Extended CP437/Unicode Glyph Visuals**: Expand `TerrainTypeSchema` and `VisualGlyphSpec` with rich Victorian/Steampunk architectural types (`WROUGHT_IRON_FENCE` `▓`, `BRASS_STEAM_PIPE` `┼`, `GASLAMP_POST` `☼`, `TIMBER_PIER` `═`, `SLAG_MOUND` `▲`, `CANAL_SLUICE` `≈`, `GOTHIC_COLONNADE` `Ω`, and connecting wall box-drawing glyphs `╬`/`║`/`═`). Implement 5 visually distinct district biomes (*Limehouse Docks*, *Spitalfields Smelting Works*, *Gilded Spire Assembly*, *Blackfriars Rookeries*, *Chalk-Vault Catacombs*) with customized dual-color palettes and shader flags (`GASLIGHT_RADIANCE`, `SOOT_OCCLUSION`, `SPARK_GLINT`) adhering to AGENTS.md and ARCHITECTURE.md:
1. Run `npm run hermes:scout -- --task "the active phase"` and complete the 6-point Pre-Flight Impact Analysis (including STATE.md P1/P2/P3 triage).
2. Pre-split any src/ hotspot >= 245 lines (`src/client/main.tsx` (244 lines)) via `npm run hermes:split`.
3. Implement the active phase while folding in P2 (biome palette mapping & box-drawing wall connection resolution) and P3 (serialization & deterministic unit tests in tests/sim/), and promoting any out-of-budget P1 agency items into ROADMAP.md.
4. Delegate blueprints (`generate:content`), event logs (`hermes:chronicler`), and test scaffolding (`hermes:testgen`) to local models.
5. Run `npm run verify`, `npm run hermes:critic`, and `npm run sync:state`, then output the next copy-pasteable prompt.
```
