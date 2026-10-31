# Handoff Report — Systemic Interconnectivity & Simulation Critique (Track 2)

**Author**: Systemic Interconnectivity & Simulation Critic  
**Working Directory**: `/Users/emmett/Desktop/Game/.agents/teamwork/critic_sim_m2`  
**Target Milestone**: M2 / Unified Systemic Mapping & Evaluation (`docs/SYSTEMIC_MAPPING_REPORT.md`)  
**Date**: 2026-10-31T22:25:00Z  
**Handoff Type**: Hard (Task Complete)

---

## 1. Observation

Direct observations from the live codebase in `src/sim/` and `src/schemas/`:

1. **One-Way Upward Steam Bleeding, Zero Gas/Dust/Liquid Downward Drainage**:
   - In `src/sim/systems/thermo.system.ts` (lines 104–142):
     ```typescript
     for (const entity of Object.values(state.entities)) {
       const pos = entity.position;
       const portal = entity.portal;
       if (!pos || !portal || !portal.conductsGas) continue;

       const fromElev = stratumElevation[pos.stratum];
       const toElev = stratumElevation[portal.target.stratum];
       if (toElev <= fromElev) continue;
       // ...
       const transferred = Math.round(sourceCell.steamPressureKpa * 0.3 * 100) / 100;
       nextStrata[pos.stratum] = setTileCell(sourceGrid, pos.x, pos.y, (c) => ({
         ...c, steamPressureKpa: Math.max(0, c.steamPressureKpa - transferred),
       }));
       nextStrata[portal.target.stratum] = setTileCell(targetGrid, portal.target.x, portal.target.y, (c) => ({
         ...c, steamPressureKpa: c.steamPressureKpa + transferred,
       }));
     }
     ```
     Only `steamPressureKpa` is transferred upward. Neither coal dust (`coalDustDensity`, lines 64–70) nor toxic smoke/soot (`smokePpm`) transfer through open portals. Downward drainage of liquids (`NITRIC_ACID`, `WHALE_OIL`, `SLUICE_SLUDGE`, `BLOOD`) from upper to lower strata does not exist.

2. **Blind Strata Gravity Drop**:
   - In `src/sim/systems/physics-traps.system.ts` (lines 84–89):
     ```typescript
     const updatedActor: EntityRecord = {
       ...actor,
       position: { ...actor.position, stratum: 'STREET', x: nx, y: ny },
       anatomy: actor.anatomy
         ? { ...actor.anatomy, steamReserveKpa: Math.max(0, actor.anatomy.steamReserveKpa - steamSpent) }
         : undefined,
     };
     ```
     Knockback into `ABYSS_DROP` on `SPIRE` moves the actor directly to `STREET` at `(nx, ny)` without verifying if `(nx, ny)` on `STREET` is a solid wall (`SOOT_BRICK_WALL`) or impassable obstruction. Falling from `STREET` into `UNDERCROFT` is unimplemented.

3. **Active-Stratum-Only Hazard Simulation**:
   - In `src/sim/core/simulation-pipeline.ts` (lines 42–45):
     ```typescript
     const activeStratum = workingState.entities['actor_player' as EntityId]?.position?.stratum ?? 'STREET';
     const hazardTick = advanceEnvironmentalHazards(workingState, activeStratum);
     workingState = hazardTick.state;
     events.push(...hazardTick.events);
     ```
     `advanceEnvironmentalHazards` (soot drift and acid drips) only simulates the stratum where the player is currently located. Hazards on all other strata freeze completely.

4. **Inert Infrastructure Schemas**:
   - In `src/schemas/world-components.schema.ts` (lines 130–188), `UtilityConduitComponentSchema`, `CrossStratumShaftComponentSchema`, `HydrologyChannelComponentSchema`, and `DistrictGraphNodeComponentSchema` are declared.
   - Grep search for `utilityConduit`, `crossStratumShaft`, `hydrologyChannel`, and `districtGraphNode` in `src/sim/systems/` returned **0 results**. These components are generated in `src/sim/spatial/utility-networks.ts` and `district-scaler.ts` but never read or mutated by any runtime simulation system.

5. **Mathematical Evaporation Without Condensation**:
   - In `src/sim/systems/thermo.system.ts` (lines 58, 78):
     ```typescript
     nextSteam[idx] = (nextSteam[idx] ?? 0) + retainedSteam * STEAM_RETENTION_FACTOR;
     // ...
     steamPressureKpa: rawSteam < 0.05 ? 0 : Math.round(rawSteam * 100) / 100,
     ```
     `STEAM_RETENTION_FACTOR = 0.96`. Steam decays and is zeroed out below 0.05 kPa. It never condenses into water pools, damp surfaces, or rust.

6. **Hazard Erasure Without Residue**:
   - In `src/sim/systems/environmental-hazards.system.ts` (lines 48–54), whale oil ignition clears the liquid (`liquidType: 'NONE'`) and adds steam/smoke, leaving zero ash or scorch terrain.
   - In `src/sim/systems/pyrotechnics.system.ts` (lines 75–80), coal dust ignition zeroes `coalDustDensity` and adds steam, leaving zero soot stains or cinders.

7. **Micro-Macro Economic Severance**:
   - In `src/sim/systems/trade-buy.system.ts` (lines 121–128) and `src/sim/systems/trade-sell.system.ts` (lines 100–107), buying and selling adjusts `state.economy.playerTreasuryPence` and inventories. Neither function mutates `state.economy.marketQuotes`.
   - In `src/sim/systems/economy.system.ts` (lines 41–70), `demandUnits` for commodities are hardcoded constants (`100, 60, 40, 75`).
   - In `src/sim/systems/economy-macro.system.ts` (lines 26–36), supply mean-reverts mathematically toward static demand without any connection to merchant trade volume or physical commodity production.

8. **Unbounded Currency Faucets and Sinks**:
   - In `src/sim/systems/trade-buy.system.ts` (line 121), player purchases decrement `playerTreasuryPence`, but the merchant receives no currency (merchants lack wallet components; money is erased).
   - In `src/sim/systems/trade-sell.system.ts` (line 100), player sales increment `playerTreasuryPence` from thin air; merchants possess infinite liquidity.

9. **Broken Escort Convoy Delivery Invariant**:
   - In `src/sim/systems/supply-escort.system.ts` (lines 132–154):
     ```typescript
     const matchingConvoy = Object.values(state.convoys).find(
       (c) => c.cargoItemId === itemEntityId && (c.stage === 'PREPARATION' || c.stage === 'ESCORT_ASSIGNED' || c.stage === 'IN_TRANSIT'),
     );
     if (!matchingConvoy) return { state, events: [] };
     const updatedConvoy: EscortConvoyRecord = { ...matchingConvoy, stage: 'DELIVERED', completedTurn: turn };
     ```
     `processDropItemDelivery` never checks `dropPos` against `matchingConvoy.destinationPos` or `destinationDistrictId`. Dropping the item anywhere immediately marks the convoy as `DELIVERED` and awards payout and reputation.

10. **Disconnected Pedestal Implementations & Dangling Pointer**:
    - `src/sim/systems/trade-pedestal.ts` (lines 80–97) stocks an abstract `state.economy.storefrontListings` array without spatial entities.
    - `src/sim/systems/npc-ecology.system.ts` (lines 42–80) searches for spatial entities with `tradePedestal` components. When quantity reaches 0 (lines 56–58), `delete nextEntities[itemId]` deletes the entity, but line 76 sets `tradePedestal.itemEntityId = itemId`, pointing to a deleted entity ID.

11. **50% Diurnal Schedule Void**:
    - In `src/sim/core/world.ts` (lines 32–38), `getShiftPhase` returns `DAWN_WHISTLE` (turns 0–24), `FOUNDRY_SHIFT` (25–49), `GASLIGHT_CURFEW` (50–74), `GRAVEYARD_WATCH` (75–99).
    - In `src/sim/systems/npc-ecology.system.ts` (lines 151–189), only `GRAVEYARD_WATCH` (sleeping) and `FOUNDRY_SHIFT` (working) are handled. During `DAWN_WHISTLE` and `GASLIGHT_CURFEW`, the function returns `handled: false`. In `src/sim/systems/ai.system.ts` (lines 181–186), scheduled NPCs freeze in place for 50 turns out of every 100 turns.

12. **Inert Sleeping and Working**:
    - In `src/sim/systems/npc-ecology.system.ts` (lines 164, 187), reaching `restAnchor` or `workAnchor` returns `{ state: workingState, events: [], apSpent: STANDARD_ACTION_AP, handled: true }`. Sleeping does not heal limbs or blood (unlike player `resolveRestAtBed`), and working does not consume materials or produce items.

13. **Naive Cardinal Stepping**:
    - In `src/sim/systems/npc-ecology.system.ts` (lines 159, 182), movement uses `Math.sign(anchor.x - actor.position.x)`. If any obstacle intervenes, `resolveMoveStep` blocks and the NPC loops infinitely on the same blocked step.

14. **Intra-Faction Witness Silo**:
    - In `src/sim/systems/squad-witness.system.ts` (lines 104–106), witness candidates are filtered strictly by `e.aiController?.factionId === victimFactionId`. Constabulary guards ignore violent crimes against non-Crown factions occurring in front of them.

15. **Dormant Enforcement & Crime Systems**:
    - Guards never emit `resolveEnforceTurfAuthority` (`skirmish-turf.system.ts:183`) in `ai.system.ts`.
    - `'TRESPASS'` is never emitted by any system in `src/sim/`.
    - NPC movement never calls `processActorTurfMovement` (`spatial-actions.ts:36`); rival gangs cannot contest turf via movement.

---

## 2. Logic Chain

1. From **Observation 1, 2, and 3**, the simulation's vertical strata model is physically asymmetric and geographically siloed. Atmosphere only rises; gravity fall has no landing validation; and hazards freeze on inactive strata. Therefore, the spatial world cannot support multi-level environmental storytelling (e.g. industrial runoff dripping into sewers, smoke choking upper catwalks).
2. From **Observation 4**, the presence of rich schemas (`UtilityConduitComponent`, `CrossStratumShaftComponent`, `HydrologyChannelComponent`) without execution systems demonstrates an architecture where declarative structures were stubbed out but never integrated into the game loop.
3. From **Observation 5 and 6**, thermodynamics and chemical hazards lack state retention. Energy and matter dissipate without leaving environmental residues (condensation, scorch marks, ash). Therefore, player and world actions leave no persistent physical scars.
4. From **Observation 7 and 8**, micro-trade and macro-economics operate as disjoint systems. Prices in market quotes do not respond to merchant trades, and currency is created/destroyed arbitrarily. Therefore, market simulation lacks economic causality or supply-chain emergence.
5. From **Observation 9 and 10**, convoy delivery has a severe logic bypass (destination coordinate is completely ignored upon drop), and pedestal trading has two conflicting implementations, one of which produces dangling entity pointer bugs.
6. From **Observation 11, 12, and 13**, NPC agency is severely constrained. Diurnal routines are inert no-ops that ignore half the day and lack pathfinding around basic obstacles.
7. From **Observation 14 and 15**, social ecology is fragmented: law enforcement is faction-blind to crimes against other factions, and regulatory commands (`ENFORCE_TURF_AUTHORITY`, `TRESPASS`) are dormant.

---

## 3. Caveats

- **No Caveats**. Codebase analysis was performed directly on live simulation and schema files in `src/sim/` and `src/schemas/`. No implementation code was modified (review-only).

---

## 4. Conclusion

The headless ECS architecture of *Aether & Soot* has solid structural separation and deterministic foundations, but its simulation systems currently run in deep isolation. Interconnectivity between spatial strata, industrial hazards, physical trade, and NPC agency is broken by mathematical voids, missing cross-system calls, naive pathfinding, and dormant schemas.

A comprehensive critique deliverable has been written to:
`/Users/emmett/Desktop/Game/.agents/teamwork/critic_sim_m2/critique.md`

This critique details every finding with line numbers, code quotes, and concrete remediation steps designed to feed directly into the unified report at `docs/SYSTEMIC_MAPPING_REPORT.md`.

---

## 5. Verification Method

To independently verify all observations and claims:

1. **Verify Line Numbers and Implementations**:
   - Inspect `src/sim/systems/thermo.system.ts:104-142` (portal gas transfer).
   - Inspect `src/sim/systems/physics-traps.system.ts:84-89` (Spire gravity drop landing coordinates).
   - Inspect `src/sim/core/simulation-pipeline.ts:42-45` (active stratum hazard execution).
   - Inspect `src/sim/systems/supply-escort.system.ts:132-154` (destination-less drop delivery).
   - Inspect `src/sim/systems/npc-ecology.system.ts:148-191` (50% schedule void, dangling pedestal entity pointer).
   - Inspect `src/sim/systems/squad-witness.system.ts:104-106` (intra-faction crime filter).

2. **Verify Dormant Schemas**:
   - Execute ripgrep across `src/sim/systems/` for `crossStratumShaft`, `utilityConduit`, `hydrologyChannel`, and `districtGraphNode` to confirm zero references.

3. **Verify Test & Verification Baseline**:
   - Run `npm run verify` to confirm the codebase remains in a clean state (0 errors across typecheck, boundaries, data, and tests).

4. **Invalidation Conditions**:
   - The findings in this report would be invalidated if an external system outside `src/sim/systems/` connects micro-trade to market quotes or introduces condensation logic; however, boundary checks strictly prohibit simulation logic outside `src/sim/`.
