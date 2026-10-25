# Aether & Soot — Visual Interface Gallery

This directory contains high-resolution direct captures of *Aether & Soot* running at 1056×720px widescreen canvas (88×36 CP437 character-cell grid) with GLSL CRT scanline shaders, brass-riveted double-line instrument bezels, and segmented telemetry meters.

All screenshots were generated deterministically via `npm run capture:screenshots`.

---

## 1. Victorian Steampunk Street Overworld & Main HUD
![01_main_street_hud.png](./01_main_street_hud.png)
- **District**: Spitalfields Smelting Works (`STREET` stratum).
- **HUD Bezels**: Gold brass double-line CP437 borders (`╔═[ TACTICAL TELEMETRY ]═╗`).
- **Telemetry**: Discrete segmented character-cell bars (`[██████████████░░░░]`) for Sanguine Volume and Boiler Steam Pressure.
- **Proximity Radar**: Distance in meters to street portals, pneumatic lifts, and district landmarks.
- **Pneumatic Chronicle**: Brass-framed action ticker tape recording physical state transitions.

---

## 2. CDDA-Style Artificer Workstation & Schematic Dossier (`[C] Craft`)
![02_artificer_workstation.png](./02_artificer_workstation.png)
- **CDDA Category Tabs**: `[ ALL ]`, `[ WEAPONS ]`, `[ PROSTHETICS ]`, `[ STEAM ]`, `[ ALCHEMY ]`.
- **Schematic Catalog**: Scrollable recipe catalog with dynamic steam pressure (`kPa`) requirements.
- **Schematic Dossier**: Live inspection displaying assembly station requirements, AP cost, and component have/need inventory checklists (`0/2 Crystallised Aether Salt`, `0/1 Vulcanized Rubber`).

---

## 3. Metropolitan Stratum Atlas & District Dossier (`[W] Atlas`)
![03_metropolitan_atlas.png](./03_metropolitan_atlas.png)
- **Topography Minimap**: Live ASCII minimap of the current stratum displaying player `@`, transit gates `╬`, stairwells (`>`, `<`), walls `█`, and explored terrain `·`.
- **District Dossier**: Stratum altitude, dawn/dusk shift chronometer, ambient steam kPa, coal dust opacity, and connecting transit gates.

---

## 4. Borough Turf Sectors & Commodity Exchange (`[M] Market`)
![04_market_exchange_turf.png](./04_market_exchange_turf.png)
- **Borough Turf Visualizer**: 4 political sectors (`IRON` Iron Foundry Guild, `SYND` Black-Market Cartel Syndicate, `GUILD` Clockwork Guild, `CROWN` Her Majesty's Metropolitan Constabulary).
- **Commodity Exchange**: Live quotes for Anthracite Coal, Phosphor Bronze, Aether Vials, and Clockwork Mainsprings.
- **Broker Counter**: Stationed merchant tariff rates and faction political standing.

---

## 5. Naturalist Philosophy Codex & Specimen Anatomy Ledger (`[K] Codex`)
![05_naturalist_codex.png](./05_naturalist_codex.png)
- **Specimen Roster**: Dissected Automata, Steam-Lathe Watch Hounds, Spire Conservatory Aether-Ferns, and High-Pressure Boilers.
- **Field Annotations**: Non-overlapping anatomical diagram sketches (`(o)-[☼]`) aligned alongside tactical vulnerability analysis, armor ratings, and harvest yields.
- **Observer Field Notes**: Victorian natural philosopher field records and morphological traits.

---

## 6. Vitruvian Anatomy & Mechanical Graft Bay (`[A] Anatomy`)
![06_vitruvian_paperdoll.png](./06_vitruvian_paperdoll.png)
- **Vitruvian Paperdoll**: Anatomical wireframe representing 6 targeted limb slots (`HEAD`, `TORSO`, `LEFT_ARM`, `RIGHT_ARM`, `LEFT_LEG`, `RIGHT_LEG`).
- **Limb Telemetry**: Individual limb hit points and biological/prosthetic socket statuses.

---

## 7. Satchel Inventory & Portable Dial Gauges (`[I] Satchel`)
![07_satchel_inventory.png](./07_satchel_inventory.png)
- **Tactile Dial Gauges**: Segmented analog gauges for steam reservoir kPa and haemodynamic blood volume percentage.
- **Pneumatic Compartments**: Compartment slots with lettered hotkeys for immediate item consumption, equipment toggling, or discarding.

---

## 8. Look Mode Coordinate Targeting & Tactical Inspector (`[L] Look`)
![08_tactical_look_mode.png](./08_tactical_look_mode.png)
- **Targeting Overlay**: Dynamic coordinate cursor (`[WASD]` / Arrows to move).
- **Quick Strike Hotkeys**: `1-6` / `F` to execute targeted limb attacks directly against hovered actors.
- **Canvas Tile Inspector**: Comprehensive coordinate telemetry, terrain material properties, atmospheric steam/coal density, and actor entity profiles.

---

## 9. Character Creation & Victorian Vocation Embarkation (`[N] Embark`)
![09_character_embarkation.png](./09_character_embarkation.png)
- **Vocations**: Disgraced Street Chirurgeon, Foundry Master Artificer, Clockwork War Veteran, Undercroft Aether Smuggler.
- **Traits & Quirks**: Night Optics, Boiler Heart, Pack Mule, Iron Fists, Cartel Connections, Tinker Savant.
- **Stratum Embarkation**: Choose starting stratum (`STREET` Spitalfields Foundry Row, `SPIRE` Belgravia Sky-Walk, or `UNDERCROFT` Fleet Ditch Flooded Sump).
