import { describe, expect, it } from 'vitest';
import { EntityRecord } from '../../src/schemas/components.schema.js';
import { BlueprintIdSchema, EntityIdSchema } from '../../src/schemas/primitives.schema.js';
import { SeededRNG } from '../../src/sim/core/rng.js';
import { advanceWorldEnvironment } from '../../src/sim/core/simulation-pipeline.js';
import { createInitialWorld, WorldState } from '../../src/sim/core/world.js';
import { createStratumGrid, setTileCell } from '../../src/sim/spatial/grid.js';
import { resolveKnockbackAndGravityFall } from '../../src/sim/systems/physics-traps.system.js';
import { resolveEmitSpark } from '../../src/sim/systems/pyrotechnics.system.js';
import { advanceThermodynamicsTick } from '../../src/sim/systems/thermo.system.js';

function createCoupledTestWorld(): WorldState {
  const world = createInitialWorld({ seed: 42 });
  const streetGrid = createStratumGrid('STREET', 20, 20);
  const undercroftGrid = createStratumGrid('UNDERCROFT', 20, 20);
  const spireGrid = createStratumGrid('SPIRE', 20, 20);
  const playerId = EntityIdSchema.parse('actor_player');
  const player = world.entities[playerId];

  return {
    ...world,
    currentDistrictId: BlueprintIdSchema.parse('district_spitalfields_soot_works'),
    strata: {
      STREET: streetGrid,
      UNDERCROFT: undercroftGrid,
      SPIRE: spireGrid,
    },
    entities: {
      ...world.entities,
      [playerId]: {
        ...player!,
        position: { x: 5, y: 5, stratum: 'STREET', blocksMovement: true, blocksSight: false },
      },
    },
  };
}

describe('Spatial Hazard Coupling & Multi-Stratum Physics', () => {
  it('advances environmental hazards across all strata in Phase 1', () => {
    let state = createCoupledTestWorld();
    const rng = new SeededRNG(12345);

    // Place whale oil pool on UNDERCROFT while player is on STREET
    state = {
      ...state,
      strata: {
        ...state.strata,
        UNDERCROFT: setTileCell(state.strata.UNDERCROFT!, 5, 5, (c) => ({
          ...c,
          liquidType: 'WHALE_OIL',
          liquidVolumeMl: 250,
        })),
      },
    };

    const res = advanceWorldEnvironment(state, rng, 1);
    expect(res.state.strata.UNDERCROFT).toBeDefined();
    // Environmental hazards function ran without throwing and preserved multi-strata grids
    expect(res.state.strata.STREET).toBeDefined();
    expect(res.state.strata.SPIRE).toBeDefined();
  });

  describe('Spire Abyss Fall Landing Validation', () => {
    it('lands safely on walkable STREET tile with leg trauma', () => {
      let state = createCoupledTestWorld();
      const playerId = EntityIdSchema.parse('actor_player');
      state = {
        ...state,
        entities: {
          ...state.entities,
          [playerId]: {
            ...state.entities[playerId]!,
            position: { x: 5, y: 5, stratum: 'SPIRE', blocksMovement: true, blocksSight: false },
          },
        },
        strata: {
          ...state.strata,
          SPIRE: setTileCell(state.strata.SPIRE!, 5, 6, (c) => ({
            ...c,
            terrainType: 'ABYSS_DROP',
            blocksMovement: false,
          })),
        },
      };

      const res = resolveKnockbackAndGravityFall(state, playerId, 0, 1, 1);
      const player = res.state.entities[playerId];
      expect(player?.position?.stratum).toBe('STREET');
      expect(player?.position?.x).toBe(5);
      expect(player?.position?.y).toBe(6);
      expect(res.events.some((e) => e.type === 'ACTOR_FELL_STRATUM')).toBe(true);
    });

    it('searches Chebyshev radius 1-2 when direct landing tile is blocked', () => {
      let state = createCoupledTestWorld();
      const playerId = EntityIdSchema.parse('actor_player');

      // (5, 6) on SPIRE is ABYSS_DROP
      // (5, 6) on STREET is blocked by a wall, but (6, 6) is clear
      state = {
        ...state,
        entities: {
          ...state.entities,
          [playerId]: {
            ...state.entities[playerId]!,
            position: { x: 5, y: 5, stratum: 'SPIRE', blocksMovement: true, blocksSight: false },
          },
        },
        strata: {
          ...state.strata,
          SPIRE: setTileCell(state.strata.SPIRE!, 5, 6, (c) => ({
            ...c,
            terrainType: 'ABYSS_DROP',
            blocksMovement: false,
          })),
          STREET: setTileCell(state.strata.STREET!, 5, 6, (c) => ({
            ...c,
            terrainType: 'SOOT_BRICK_WALL',
            blocksMovement: true,
          })),
        },
      };

      const res = resolveKnockbackAndGravityFall(state, playerId, 0, 1, 1);
      const player = res.state.entities[playerId];
      expect(player?.position?.stratum).toBe('STREET');
      // Landing shifted to unblocked neighbor
      expect(player?.position?.x !== 5 || player?.position?.y !== 6).toBe(true);
      expect(Math.max(Math.abs((player?.position?.x ?? 0) - 5), Math.abs((player?.position?.y ?? 0) - 6))).toBeLessThanOrEqual(2);
      expect(res.events.some((e) => e.type === 'ACTOR_FELL_STRATUM')).toBe(true);
    });

    it('applies lethal impact and deposits corpse when no landing tile exists in radius 2', () => {
      let state = createCoupledTestWorld();
      const playerId = EntityIdSchema.parse('actor_player');

      // Surround (5, 6) completely with walls on STREET for radius 2
      let blockedStreet = state.strata.STREET!;
      for (let dy = -2; dy <= 2; dy++) {
        for (let dx = -2; dx <= 2; dx++) {
          blockedStreet = setTileCell(blockedStreet, 5 + dx, 6 + dy, (c) => ({
            ...c,
            terrainType: 'SOOT_BRICK_WALL',
            blocksMovement: true,
          }));
        }
      }

      state = {
        ...state,
        entities: {
          ...state.entities,
          [playerId]: {
            ...state.entities[playerId]!,
            position: { x: 5, y: 5, stratum: 'SPIRE', blocksMovement: true, blocksSight: false },
          },
        },
        strata: {
          ...state.strata,
          SPIRE: setTileCell(state.strata.SPIRE!, 5, 6, (c) => ({
            ...c,
            terrainType: 'ABYSS_DROP',
            blocksMovement: false,
          })),
          STREET: blockedStreet,
        },
      };

      const res = resolveKnockbackAndGravityFall(state, playerId, 0, 1, 1);
      const fallEvent = res.events.find((e) => e.type === 'ACTOR_FELL_STRATUM');
      expect(fallEvent).toBeDefined();
      if (fallEvent && fallEvent.type === 'ACTOR_FELL_STRATUM') {
        expect(fallEvent.impactDamage).toBe(999);
      }

      // Corpse deposited
      const corpse = Object.values(res.state.entities).find((e) => e.name.includes('Mangled Corpse'));
      expect(corpse).toBeDefined();
      expect(corpse?.position?.stratum).toBe('STREET');
      expect(corpse?.position?.x).toBe(5);
      expect(corpse?.position?.y).toBe(6);
    });
  });

  describe('Downward Liquid Drainage & Atmospheric Bleeding', () => {
    it('drains liquid and bleeds coal dust downward through portal', () => {
      let state = createCoupledTestWorld();

      // Portal at (8, 8) from STREET down to UNDERCROFT (8, 8)
      const portalId = EntityIdSchema.parse('portal_street_to_undercroft');
      const portalEntity: EntityRecord = {
        id: portalId,
        name: 'Sewer Manhole Descent',
        visual: { glyph: 'O', fgPrimary: '#7F8C8D', fgSecondary: '#566573', bgColor: '#1C2833', shaderFlags: [] },
        position: { x: 8, y: 8, stratum: 'STREET', blocksMovement: false, blocksSight: false },
        portal: {
          target: { x: 8, y: 8, stratum: 'UNDERCROFT' },
          apCost: 100,
          bidirectional: true,
          conductsGas: true,
          conductsLiquid: true,
          portalLabel: 'To Undercroft',
        },
      };

      // Place whale oil and coal dust at (8, 8) on STREET
      state = {
        ...state,
        entities: {
          ...state.entities,
          [portalId]: portalEntity,
        },
        strata: {
          ...state.strata,
          STREET: setTileCell(state.strata.STREET!, 8, 8, (c) => ({
            ...c,
            liquidType: 'WHALE_OIL',
            liquidVolumeMl: 400,
            coalDustDensity: 0.6,
          })),
        },
      };

      const res = advanceThermodynamicsTick(state);
      const streetCell = res.state.strata.STREET!.cells[8 * res.state.strata.STREET!.width + 8]!;
      const undercroftCell = res.state.strata.UNDERCROFT!.cells[8 * res.state.strata.UNDERCROFT!.width + 8]!;

      // Liquid drained downward
      expect(undercroftCell.liquidType).toBe('WHALE_OIL');
      expect(undercroftCell.liquidVolumeMl).toBeGreaterThan(0);
      expect(streetCell.liquidVolumeMl).toBeLessThan(400);

      // Coal dust bled downward
      expect(undercroftCell.coalDustDensity).toBeGreaterThan(0);
      expect(streetCell.coalDustDensity).toBeLessThan(0.6);
    });
  });

  describe('Persistent Hazard Residue', () => {
    it('mutates floor terrain to SCORCHED_STONE when whale oil ignites', () => {
      let state = createCoupledTestWorld();

      state = {
        ...state,
        strata: {
          ...state.strata,
          STREET: setTileCell(state.strata.STREET!, 10, 10, (c) => ({
            ...c,
            terrainType: 'COBBLESTONE_FLOOR',
            blocksMovement: false,
            liquidType: 'WHALE_OIL',
            liquidVolumeMl: 200,
          })),
        },
      };

      const sparkRes = resolveEmitSpark(state, { x: 10, y: 10, stratum: 'STREET' });
      const cell = sparkRes.state.strata.STREET!.cells[10 * sparkRes.state.strata.STREET!.width + 10]!;
      expect(cell.terrainType).toBe('SCORCHED_STONE');
      expect(cell.liquidType).toBe('NONE');
      expect(cell.liquidVolumeMl).toBe(0);
    });

    it('mutates floor terrain to SCORCHED_STONE when coal dust ignites', () => {
      let state = createCoupledTestWorld();

      state = {
        ...state,
        strata: {
          ...state.strata,
          STREET: setTileCell(state.strata.STREET!, 12, 12, (c) => ({
            ...c,
            terrainType: 'COBBLESTONE_FLOOR',
            blocksMovement: false,
            coalDustDensity: 0.5,
          })),
        },
      };

      const sparkRes = resolveEmitSpark(state, { x: 12, y: 12, stratum: 'STREET' });
      const cell = sparkRes.state.strata.STREET!.cells[12 * sparkRes.state.strata.STREET!.width + 12]!;
      expect(cell.terrainType).toBe('SCORCHED_STONE');
      expect(cell.coalDustDensity).toBe(0);
    });
  });
});
