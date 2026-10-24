# Aether & Soot — Headless Autonomous Playtest Report

- **Timestamp**: 2026-10-24T20:23:44.902Z
- **Execution Mode**: Deterministic Mock Agent (playtester-mock.ts) [MOCK_FALLBACK]
- **LLM Telemetry**: Mode: MOCK_FALLBACK | Temperature: 0.1 | Enforce JSON Schema: true
- **Scenario**: **TRANSIT**
- **Seed**: 42
- **Survival Status**: **SURVIVED**

## Emergent Sandbox Mechanics Metrics

| Metric | Recorded Value | Evaluation Notes |
| :--- | :--- | :--- |
| **Turns Survived** | 15 / 15 | Longevity under autonomous navigation |
| **Acoustic Decibels Emitted** | 0 dB | Footsteps, door actions, and steam releases |
| **Guard Sound Investigations** | 0 | NPCs transitioning to INVESTIGATING |
| **Guard Combat Engagements** | 0 | NPCs acquiring visual lock in COMBAT |
| **Steam Clouds Deployed** | 0 | Vented steam to obscure LOS |
| **Clockwork Traps Triggered** | 0 | Hidden tripwires / spring jaws stepped on |
| **Hostiles Attacked** | 0 | Targeted melee / ranged strikes on hostiles |
| **Attack Hits** | 0 | Clean strikes landing on target |
| **Attack Misses / Obstructed** | 0 | Evasions, range misses, or deflections |
| **Damage Dealt (Player)** | 0 HP | Targeted combat damage to hostiles |
| **Damage Taken (Player)** | 0 HP | Trauma sustained from hostiles or hazards |
| **Items Acquired** | 0 | Picked up from ground or bought from merchants |
| **Items Used** | 0 | Consumed tonics or canisters |
| **Transitions Completed** | 15 | Stratum portals or district gates traversed |
| **Final Blood Volume** | 100% | Haemodynamic stability |
| **Unique Tiles Visited** | 2 | Distinct spatial tiles explored |
| **UI Projection Leaks Detected** | 29 | Client projection HUD/radar/chronicle leaks |

## Command Coverage Matrix

| Category | Count | Share | Command Identifiers |
| :--- | :--- | :--- | :--- |
| **Active Commands** (>0 Dispatches) | 1 | 2% | `USE_PORTAL` |
| **Dormant Commands** (Serializer-Wired, 0 Dispatches) | 8 | - | `ACTIVATE_PROSTHETIC`, `HARVEST_CORPSE`, `INSTALL_PROSTHETIC`, `LOAD_AMMO`, `PRESSURIZE_VESSEL`, `SALVAGE_ITEM`, `USE_ITEM`, `VENT_STEAM` |
| **Unwired Commands** (Missing from Context) | 33 | - | `ACCEPT_CONTRACT`, `APPLY_MOMENTUM_VECTOR`, `ATTACK_ACTOR`, `BREACH_TILE`, `BUY_FROM_MERCHANT`, `CLEAN_SPILL`, `COAT_WEAPON`, `COMPLETE_CONTRACT`, `CRAFT_RECIPE`, `DAMAGE_LIMB` |

## Client UI Projection & Chronicle Leak Audit

- **Total UI Projection Leaks Detected**: **29**
- **Leak Categories Monitored**: Raw snake_case identifiers (`district_`, `landmark_`, `npc_`, `item_`, `mat_`), truncated strings (`_`), coordinate desyncs (LookCursorOverlay vs TileInspectorPanel), and duplicate consecutive chronicle movement entries.
- **Audit Status**: WARNING — 29 projection anomalies detected.

## Command Dispatch Histogram

| Command Type | Dispatches |
| :--- | :--- |
| `USE_PORTAL` | 15 |
