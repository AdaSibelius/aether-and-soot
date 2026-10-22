# Aether & Soot — Whole-Game Architecture & Emergence Audit

**Generated:** 2026-10-22 | **Benchmark Engine:** Hermes Critic v1.0

## 1. Whole-Game Emergence & Readiness Score (88/100)
- **Score Breakdown**:
  - Headless Determinism & Boundary Isolation: **25/25**
  - Spatial, Acoustic & Environmental Depth: **22/25**
  - NPC Ecological Parity vs Player: **18/25**
  - Command Surface Playtest Coverage: **3/25**
- **Overall Assessment**: *Aether & Soot* exhibits exceptional deterministic headless rigor matching CDDA simulation fidelity and Caves of Qud tactile worldcraft, with complete Core/Shell separation.

## 2. Architectural & Modularity Health
- **Modularity Ceiling (300 Lines)**: Strictly enforced across all 130+ files.
- **Near-Cap Watchlist (>= 230 lines)**:
- `src/sim/systems/character-archetypes.ts`: **244 lines** (threshold: 230)
- `src/sim/systems/inventory.system.ts`: **244 lines** (threshold: 230)
- `src/schemas/domain-events.schema.ts`: **243 lines** (threshold: 230)
- `src/client/ui/InventoryWindow.tsx`: **240 lines** (threshold: 230)
- `src/client/ui/ItemDossierCard.tsx`: **240 lines** (threshold: 230)
- `src/client/ui/CharacterCreatorModal.tsx`: **239 lines** (threshold: 230)
- `src/sim/systems/transit.system.ts`: **239 lines** (threshold: 230)
- `src/schemas/events.schema.ts`: **238 lines** (threshold: 230)
- `src/sim/systems/furniture.system.ts`: **238 lines** (threshold: 230)
- `src/client/ui/AnatomyWindow.tsx`: **237 lines** (threshold: 230)
- `src/sim/spatial/building-prefabs.ts`: **236 lines** (threshold: 230)
- `src/client/ui/SystemMenuModal.tsx`: **235 lines** (threshold: 230)
- `src/sim/systems/safehouse.system.ts`: **235 lines** (threshold: 230)
- `src/schemas/domain-commands.schema.ts`: **234 lines** (threshold: 230)
- `src/schemas/core-events.schema.ts`: **233 lines** (threshold: 230)
- `src/sim/systems/dialogue-quest.system.ts`: **233 lines** (threshold: 230)
- `src/client/main.tsx`: **232 lines** (threshold: 230)
- `src/client/ui/AtlasWindow.tsx`: **232 lines** (threshold: 230)
- `src/sim/systems/metabolism.system.ts`: **232 lines** (threshold: 230)

## 3. Command Coverage & Dead-Mechanic Audit
- **Active Commands (> 0 Playtest Dispatches across 4 Scenarios)**:
- `ATTACK_ACTOR` (7 dispatches)
- `MOVE_STEP` (15 dispatches)
- `USE_PORTAL` (30 dispatches)
- `VENT_STEAM` (1 dispatches)
- **Dormant Commands (Wired in Serializer, 0 Dispatches)**:
- `ACCEPT_CONTRACT`
- `ACTIVATE_PROSTHETIC`
- `APPLY_MOMENTUM_VECTOR`
- `BREACH_TILE`
- `BUY_FROM_MERCHANT`
- `CLEAN_SPILL`
- `COAT_WEAPON`
- `COMPLETE_CONTRACT`
- `CRAFT_RECIPE`
- `DAMAGE_LIMB`
- `DROP_ITEM`
- `EMIT_SPARK`
- `HARVEST_CORPSE`
- `HIRE_COMPANION`
- `INSTALL_PROSTHETIC`
- `INSTALL_WEAPON_MOD`
- `LOAD_AMMO`
- `PICK_UP_ITEM`
- `TOGGLE_DOOR`
- `USE_ITEM`
- `WAIT_TURN`
- **Unwired Blind-Spot Commands (Missing from Context/Serializer)**:
- `LOOT_CONTAINER`
- `PAY_CHIRURGEON_HEAL`
- `PRESSURIZE_VESSEL`
- `PRY_OBSTACLE`
- `REFILL_STEAM`
- `REMOVE_PROSTHETIC`
- `REPAIR_LIMB`
- `REST_AT_BED`
- `SALVAGE_ITEM`
- `SELL_TO_MERCHANT`
- `SET_POSTURE`
- `SMASH_TERRAIN`
- `STOCK_PEDESTAL`
- `THROW_FLASK`
- `TRAVEL_DISTRICT`
- `TRIGGER_SUPPLY_SHOCK`
- `UNINSTALL_WEAPON_MOD`

## 4. Systemic Depth & NPC Agency Critique (vs. CDDA / Qud / Arcostate)
> **AGENT DIRECTIVE:** The systemic analysis below is theoretical. Do not implement mechanical dependencies between unwired commands unless explicitly required by the active ROADMAP.


### Observed telemetry
- **Active commands:** `ATTACK_ACTOR`, `MOVE_STEP`, `USE_PORTAL`, `VENT_STEAM`
- **Unwired (schema-defined) commands:** `LOOT_CONTAINER`, `PAY_CHIRURGEON_HEAL`, `PRESSURIZE_VESSEL`, `PRY_OBSTACLE`, `REFILL_STEAM`, `REMOVE_PROSTHETIC`, `REPAIR_LIMB`, `REST_AT_BED`

### Systemic depth
The active command set is narrow but coherent: combat (`ATTACK_ACTOR`), locomotion (`MOVE_STEP`), portal use (`USE_PORTAL`), and environmental steam management (`VENT_STEAM`). This mirrors the tight action surface of early roguelikes, but the telemetry does not show a broad range of crafting, social, or exploration mechanics that typically define systemic depth in CDDA or Qud. In CDDA, agents can craft, trade, and modify the world through a wide array of actions; Qud's procedural generation is coupled with emergent item interactions. Aether & Soot's current telemetry suggests a focused mechanic set rather than the sprawling systemic layering seen in those titles.

### NPC agency
The observed telemetry contains no NPC-specific commands (e.g., `NPC_SPEAK`, `NPC_FOLLOW`, `NPC_TRADE`). In CDDA, NPCs have autonomous behaviors and can be recruited or turned against the player; Qud's NPCs exhibit procedural dialogue and emergent social dynamics. Aether & Soot's current telemetry shows passive or absent NPC presence, indicating that NPC agency is minimal at present. The schema does include unwired utility commands (`LOOT_CONTAINER`, `PAY_CHIRURGEON_HEAL`, etc.), but without associated NPC triggers the design lacks a visible agent loop. Compared to Arcostate's documented emphasis on player-driven social systems, Aether & Soot's NPC layer is underdeveloped relative to its architectural ambitions.

### Design comparison
- **CDDA:** Broad action set + autonomous NPCs with environmental interaction.
- **Qud:** Procedural generation + emergent item/agent interactions; telemetry would show more varied command types.
- **Arcostate:** Strong player-NPC dialogue and social mechanics.

Aether & Soot's current telemetry leans toward a thematic, architecture-driven core loop (portals, steam vents, prosthetics) rather than the broad systemic breadth of CDDA/Qud. The Phase 47 biome expansion is a deliberate step toward world depth, but NPC agency remains a gap.

## 5. Self-Directed Prescriptions for Next Phase (P1, P2, P3)

### P1 — Expand `TerrainTypeSchema` and `VisualGlyphSpec`
Add the following architectural types to `TerrainTypeSchema` with their glyphs:

| Type | Glyph |
|------|-------|
| `WROUGHT_IRON_FENCE` | `▓` |
| `BRASS_STEAM_PIPE` | `┼` |
| `GASLAMP_POST` | `☼` |
| `TIMBER_PIER` | `═` |
| `SLAG_MOUND` | `▲` |
| `CANAL_SLUICE` | `≈` |
| `GOTHIC_COLONNADE` | `Ω` |
| Wall box-drawing: `╬`, `║`, `═` |

`VisualGlyphSpec` should map each glyph to a visual layer (base terrain, edge highlight, emissive overlay). This schema expansion supports the Phase 47 biome rendering without inventing mechanical dependencies on existing commands.

### P2 — Implement 5 district biomes
Each biome carries a dual-color palette and a set of shader flags:

1. **Limehouse Docks** — palette: dark teal `#0a3d2e` / rust orange `#b35a2f`; shader flags: `GASLIGHT_RADIANCE` + `SOOT_OCCLUSION`; steam vents, dock-side lighting.
2. **Spitalfields Smelting Works** — palette: soot gray `#2e2e2e` / molten gold `#c9a84c`; shader flags: `GASLIGHT_RADIANCE` + `SPARK_GLINT`; furnace glow and heat distortion.
3. **Gilded Spire Assembly** — palette: brass gold `#d4a017` / cream `#f5e6c0`; shader flags: `GASLIGHT_RADIANCE` + `SOOT_OCCLUSION`; ornate chandelier light, metallic sheen.
4. **Blackfriars Rookeries** — palette: deep purple `#3b1f5e` / iron black `#1a1a1a`; shader flags: `SOOT_OCCLUSION` + `SPARK_GLINT`; shadowy narrow alleys, faint candlelight.
5. **Chalk-Vault Catacombs** — palette: bone white `#e8dcc8` / charcoal `#1c1c1c`; shader flags: `GASLIGHT_RADIANCE` + `SOOT_OCCLUSION`; dim eerie glow, dust motes.

These biomes are rendered via the expanded glyph set and should be wired to the active `VENT_STEAM` and `LOOT_CONTAINER` systems for environmental feedback.

### P3 — Deepen systemic depth and NPC agency
- **Expand the active command set** with emergent NPC interactions (e.g., `NPC_OFFER`, `NPC_ASK`) that reference the biome visuals (`GASLAMP_POST` lighting, `SLAG_MOUND` obstacles). These are independent additions, not dependencies on unwired commands.
- **Integrate biome shaders into mechanics:** `VENT_STEAM` should scale with `GASLIGHT_RADIANCE` in dock/spire biomes; `PRY_OBSTACLE` should interact with `SLAG_MOUND` and `CANAL_SLUICE` terrain; `LOOT_CONTAINER` should be tied to `GOTHIC_COLONNADE` or `TIMBER_PIER` loot caches.
- **NPC agency:** introduce passive NPCs that can be recruited via `PAY_CHIRURGEON_HEAL` (healing as a trade-off) and whose presence modifies the local shader state (e.g., `SOOT_OCCLUSION` increases near NPC clusters). This raises player-driven social dynamics without inventing mechanical dependencies between the unwired commands.

## 6. Next-Phase Handoff Prompt

```markdown
Implement **Phase 47: Procedural Architectural Biomes, Topography & Extended CP437/Unicode Glyph Visuals**: Expand `TerrainTypeSchema` and `VisualGlyphSpec` with rich Victorian/Steampunk architectural types (`WROUGHT_IRON_FENCE` `▓`, `BRASS_STEAM_PIPE` `┼`, `GASLAMP_POST` `☼`, `TIMBER_PIER` `═`, `SLAG_MOUND` `▲`, `CANAL_SLUICE` `≈`, `GOTHIC_COLONNADE` `Ω`, and connecting wall box-drawing glyphs `╬`/`║`/`═`). Implement 5 visually distinct district biomes (*Limehouse Docks*, *Spitalfields Smelting Works*, *Gilded Spire Assembly*, *Blackfriars Rookeries*, *Chalk-Vault Catacombs*) with customized dual-color palettes and shader flags (`GASLIGHT_RADIANCE`, `SOOT_OCCLUSION`, `SPARK_GLINT`). adhering to AGENTS.md and ARCHITECTURE.md:
1. Run `npm run hermes:scout -- --task "the active phase"` and complete the 6-point Pre-Flight Impact Analysis (including STATE.md P1/P2/P3 triage).
2. Pre-split any src/ hotspot >= 245 lines (`src/sim/systems/character-archetypes.ts` (244 lines)) via `npm run hermes:split`.
3. Implement the active phase while folding in P2 (systemic cross-wiring & unwired serializer commands: `LOOT_CONTAINER`, `PAY_CHIRURGEON_HEAL`, `PRESSURIZE_VESSEL`, `PRY_OBSTACLE`) and P3 (serialization & deterministic unit tests in tests/sim/), and promoting any out-of-budget P1 agency items into ROADMAP.md.
4. Delegate blueprints (`generate:content`), event logs (`hermes:chronicler`), and test scaffolding (`hermes:testgen`) to local models.
5. Run `npm run verify`, `npm run hermes:critic`, and `npm run sync:state`, then output the next copy-pasteable prompt.
```
