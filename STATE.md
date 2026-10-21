# Project State

**Last Updated:** 2026-10-21

## Recent Commits
- 379a064: Implement Phase 39: Momentum Physics, Knockback Collisions & Stealth Postures
- 52e95f6: Add hermes:critic 4-scenario benchmark loop and pre-split legacy hotspots
- b677e4e: docs: sync STATE.md for Phase 39

## Immediate Next Priority
- **Phase 41: Surface Liquid Pools, Chemical Reactions & Item Coating**: Extend `TileCellSchema` and `thermo.system.ts` with surface fluids (`liquidType: 'NONE' | 'BLOOD' | 'WHALE_OIL' | 'NITRIC_ACID' | 'SLUICE_SLUDGE'`, `liquidVolumeMl`). Support bleeding trails, slip hazards, spark-ignited whale oil fires, acid corrosion, weapon coating, and thrown flasks.

## 5. Self-Directed Prescriptions for Next Phase
- **P1: NPC Combat Cybernetics & Tonic Usage**: Grant hostile humanoids and cybernetic enforcers the ability to trigger installed limb prosthetics and consume medical tonics when blood drops below 70%.
- **P2: Expand Playtest Serializer Command Surface**: Wire `LOOT_CONTAINER`, `CRAFT_RECIPE`, and `SMASH_TERRAIN` into contextual commands so autonomous agents exercise broader systemic surfaces.
- **P3: Pneumatic Rail & Soundscape Integration**: Advance queued Phase 37/38 audio and transit mechanics to connect multi-district transit with WebAudio synthesis and decibel telemetry.
