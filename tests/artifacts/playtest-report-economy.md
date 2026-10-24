# Aether & Soot — Headless Autonomous Playtest Report

- **Timestamp**: 2026-10-24T20:15:41.813Z
- **Execution Mode**: Deterministic Mock Agent (playtester-mock.ts) [MOCK_FALLBACK]
- **LLM Telemetry**: Mode: MOCK_FALLBACK | Temperature: 0.1 | Enforce JSON Schema: true
- **Scenario**: **SABOTAGE**
- **Seed**: 102
- **Survival Status**: **SURVIVED**

## Emergent Sandbox Mechanics Metrics

| Metric | Recorded Value | Evaluation Notes |
| :--- | :--- | :--- |
| **Turns Survived** | 50 / 50 | Longevity under autonomous navigation |
| **Acoustic Decibels Emitted** | 120 dB | Footsteps, door actions, and steam releases |
| **Guard Sound Investigations** | 5 | NPCs transitioning to INVESTIGATING |
| **Guard Combat Engagements** | 0 | NPCs acquiring visual lock in COMBAT |
| **Steam Clouds Deployed** | 0 | Vented steam to obscure LOS |
| **Clockwork Traps Triggered** | 0 | Hidden tripwires / spring jaws stepped on |
| **Hostiles Attacked** | 0 | Targeted melee / ranged strikes on hostiles |
| **Attack Hits** | 0 | Clean strikes landing on target |
| **Attack Misses / Obstructed** | 0 | Evasions, range misses, or deflections |
| **Damage Dealt (Player)** | 0 HP | Targeted combat damage to hostiles |
| **Damage Taken (Player)** | 0 HP | Trauma sustained from hostiles or hazards |
| **Items Acquired** | 49 | Picked up from ground or bought from merchants |
| **Items Used** | 0 | Consumed tonics or canisters |
| **Transitions Completed** | 0 | Stratum portals or district gates traversed |
| **Final Blood Volume** | 100% | Haemodynamic stability |
| **Unique Tiles Visited** | 1 | Distinct spatial tiles explored |
| **UI Projection Leaks Detected** | 50 | Client projection HUD/radar/chronicle leaks |

## Command Coverage Matrix

| Category | Count | Share | Command Identifiers |
| :--- | :--- | :--- | :--- |
| **Active Commands** (>0 Dispatches) | 3 | 7% | `BUY_FROM_MERCHANT`, `PRESSURIZE_VESSEL`, `SELL_TO_MERCHANT` |
| **Dormant Commands** (Serializer-Wired, 0 Dispatches) | 8 | - | `ACTIVATE_PROSTHETIC`, `HARVEST_CORPSE`, `INSTALL_PROSTHETIC`, `LOAD_AMMO`, `SALVAGE_ITEM`, `USE_ITEM`, `USE_PORTAL`, `VENT_STEAM` |
| **Unwired Commands** (Missing from Context) | 31 | - | `ACCEPT_CONTRACT`, `APPLY_MOMENTUM_VECTOR`, `ATTACK_ACTOR`, `BREACH_TILE`, `CLEAN_SPILL`, `COAT_WEAPON`, `COMPLETE_CONTRACT`, `CRAFT_RECIPE`, `DAMAGE_LIMB`, `DROP_ITEM` |

## Client UI Projection & Chronicle Leak Audit

- **Total UI Projection Leaks Detected**: **50**
- **Leak Categories Monitored**: Raw snake_case identifiers (`district_`, `landmark_`, `npc_`, `item_`, `mat_`), truncated strings (`_`), coordinate desyncs (LookCursorOverlay vs TileInspectorPanel), and duplicate consecutive chronicle movement entries.
- **Audit Status**: WARNING — 50 projection anomalies detected.

## Command Dispatch Histogram

| Command Type | Dispatches |
| :--- | :--- |
| `SELL_TO_MERCHANT` | 26 |
| `BUY_FROM_MERCHANT` | 23 |
| `PRESSURIZE_VESSEL` | 1 |
