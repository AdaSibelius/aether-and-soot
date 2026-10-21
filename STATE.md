# Project State

**Last Updated:** 2026-10-21

## Recent Commits
- 3ad97ce: Implement Phase 40: CDDA Tool Qualities, Weapon Modifications & Loaded Chambers
- 379a064: Implement Phase 39: Momentum Physics, Knockback Collisions & Stealth Postures
- 52e95f6: Add hermes:critic 4-scenario benchmark loop and pre-split legacy hotspots

## Immediate Next Priority
- **Phase 42: Witness Attribution, Squad Callouts & Faction Grudge Memory**: Create `src/sim/systems/squad-witness.system.ts`. Gate theft/assault `factionReputation` penalties behind unblinded NPC line-of-sight (`WITNESS_CRIME_REPORTED`), rewarding smog occlusion and stealth. Add `EMIT_SQUAD_CALLOUT` (90 dB acoustic alert) for guards to rally nearby allied squadmates into flanking `COMBAT` states and record a persistent `grudgeTargetId`.

## 5. Self-Directed Prescriptions for Next Phase
- **P1: NPC Combat Cybernetics & Tonic Usage**: Grant hostile humanoids and cybernetic enforcers the ability to trigger installed limb prosthetics and consume medical tonics when blood drops below 70%.
- **P2: Expand Playtest Serializer Command Surface**: Wire `LOOT_CONTAINER`, `CRAFT_RECIPE`, and `SMASH_TERRAIN` into contextual commands so autonomous agents exercise broader systemic surfaces.
- **P3: Pneumatic Rail & Soundscape Integration**: Advance queued Phase 37/38 audio and transit mechanics to connect multi-district transit with WebAudio synthesis and decibel telemetry.
