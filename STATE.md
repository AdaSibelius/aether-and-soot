# Project State

**Last Updated:** 2026-10-21

## Recent Commits
- 52e95f6: Add hermes:critic 4-scenario benchmark loop and pre-split legacy hotspots
- b677e4e: docs: sync STATE.md for Phase 39
- dc2ffda: Implement Phase 38: Metabolism, Toxicity & Alchemicals

## Immediate Next Priority
- **Phase 40: CDDA Tool Qualities, Weapon Modifications & Loaded Pressure Chambers**: Pre-split `src/sim/systems/crafting.system.ts` (271 lines) if needed. Add `toolQualities: Record<ToolQualityId, number>` (`SURGERY`, `WRENCHING`, `PRYING`, `ALCHEMICAL`, `LOCKPICKING`) to `ItemBlueprintSchema` for crafting, surgery, and prying. Add `modSlots` and `loadedAmmo` to weapons (`src/sim/systems/weapon-mods.system.ts`) supporting attachable Victorian weapon mods (*Rifled Brass Barrel*, *Acoustic Baffler Silencer*, *High-Pressure Steam Receiver*) and specialized ammo (*Flechette Harpoons*, *Incendiary Phosphor Bolts*).

## 5. Self-Directed Prescriptions for Next Phase
- **P1: NPC Combat Cybernetics & Tonic Usage**: Grant hostile humanoids and cybernetic enforcers the ability to trigger installed limb prosthetics and consume medical tonics when blood drops below 70%.
- **P2: Expand Playtest Serializer Command Surface**: Wire `LOOT_CONTAINER`, `CRAFT_RECIPE`, and `SMASH_TERRAIN` into contextual commands so autonomous agents exercise broader systemic surfaces.
- **P3: Pneumatic Rail & Soundscape Integration**: Advance queued Phase 37/38 audio and transit mechanics to connect multi-district transit with WebAudio synthesis and decibel telemetry.
