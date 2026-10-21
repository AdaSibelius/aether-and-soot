# Project State

**Last Updated:** 2026-10-21

## Recent Commits
- dc2ffda: Implement Phase 38: Metabolism, Toxicity & Alchemicals
- e11de6c: Implement Phase 37: Governor Bandwidth & Active Prosthetics
- b6014b8: Reprioritize ROADMAP.md around Phases 37-46 core simulation systems and sync STATE.md

## Immediate Next Priority
- **Phase 39: Multi-Tile Momentum Physics, Knockback Collisions & Stealth Postures**: Create `src/sim/systems/momentum.system.ts`. Concussive blasts, piledrivers, and harpoon pulls apply directional force vectors (`distanceTiles`, `massKg`) causing multi-tile knockback, wall/actor collision trauma, window smashing, and `ABYSS_DROP` plunges. Add `SET_POSTURE` (`STANDING`, `CROUCHED`, `BRACED`) affecting footstep `noiseDb`, directional furniture cover, and knockback resistance.
