# Project State

**Last Updated:** 2026-10-21

## Recent Commits
- b677e4e: docs: sync STATE.md for Phase 39
- dc2ffda: Implement Phase 38: Metabolism, Toxicity & Alchemicals
- e11de6c: Implement Phase 37: Governor Bandwidth & Active Prosthetics

## Immediate Next Priority
- **Phase 39: Multi-Tile Momentum Physics, Knockback Collisions & Stealth Postures**: Create `src/sim/systems/momentum.system.ts`. Concussive blasts, piledrivers, and harpoon pulls apply directional force vectors (`distanceTiles`, `massKg`) causing multi-tile knockback, wall/actor collision trauma, window smashing, and `ABYSS_DROP` plunges. Add `SET_POSTURE` (`STANDING`, `CROUCHED`, `BRACED`) affecting footstep `noiseDb`, directional furniture cover, and knockback resistance.

## 5. Self-Directed Prescriptions for Next Phase
- **P1: NPC Combat Cybernetics & Tonic Usage**: Grant hostile humanoids and cybernetic enforcers the ability to trigger installed limb prosthetics and consume medical tonics when blood drops below 70%.
- **P2: Expand Playtest Serializer Command Surface**: Wire `LOOT_CONTAINER`, `CRAFT_RECIPE`, and `SMASH_TERRAIN` into contextual commands so autonomous agents exercise broader systemic surfaces.
- **P3: Pneumatic Rail & Soundscape Integration**: Advance queued Phase 37/38 audio and transit mechanics to connect multi-district transit with WebAudio synthesis and decibel telemetry.
