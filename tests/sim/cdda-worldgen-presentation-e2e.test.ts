import { Container } from 'pixi.js';
import { describe, expect, it } from 'vitest';
import {
  DOUBLE_BOX_GLYPHS,
  MIXED_BOX_GLYPHS,
  resolveExtendedConnectingWallGlyph,
} from '../../src/client/projection/extended-box-drawing.js';
import { projectWorldToVisualFrame } from '../../src/client/projection/frame-adapter.js';
import { createExtendedGlyphAtlas } from '../../src/client/renderer/glyph-atlas-extended.js';
import { createProceduralTileset } from '../../src/client/renderer/procedural-tileset.js';
import { SteampunkRenderPipeline } from '../../src/client/renderer/steampunk-pipeline.js';
import { TacticalLayerComposer } from '../../src/client/renderer/tactical-layer-composer.js';
import { TilesetManager } from '../../src/client/renderer/tileset-manager.js';
import { BlueprintIdSchema, EntityIdSchema, StratumId } from '../../src/schemas/primitives.schema.js';
import { dispatchCommand } from '../../src/sim/core/engine.js';
import { SeededRNG } from '../../src/sim/core/rng.js';
import {
  assertWorldInvariants,
  createInitialWorld,
  deserializeWorld,
  serializeWorld,
  WorldState,
} from '../../src/sim/core/world.js';
import { generateVictorianDistrict, hasWalkablePath } from '../../src/sim/spatial/generator.js';
import { getTileCell, StratumGrid } from '../../src/sim/spatial/grid.js';
import { generateSubterraneanMineStratum } from '../../src/sim/spatial/mines-generation.js';

describe('CDDA Worldgen & Presentation E2E Integration Suite (Milestone 4)', () => {
  const playerId = EntityIdSchema.parse('actor_player');
  const urbanDistrictId = BlueprintIdSchema.parse('district_whitechapel_ward');
  const mixedGlyphSet = new Set<string>(Object.values(MIXED_BOX_GLYPHS));

  function isReachableOrAdjacent(
    grid: StratumGrid,
    start: { x: number; y: number },
    target: { x: number; y: number },
  ): boolean {
    if (hasWalkablePath(grid, start, target)) return true;
    const deltas = [
      { dx: 1, dy: 0 },
      { dx: -1, dy: 0 },
      { dx: 0, dy: 1 },
      { dx: 0, dy: -1 },
    ];
    for (const { dx, dy } of deltas) {
      const adj = { x: target.x + dx, y: target.y + dy };
      if (adj.x >= 0 && adj.y >= 0 && adj.x < grid.width && adj.y < grid.height) {
        const cell = getTileCell(grid, adj.x, adj.y);
        if (cell && !cell.blocksMovement && hasWalkablePath(grid, start, adj)) return true;
      }
    }
    return false;
  }

  function createUnified4StratumWorld(seed: number): {
    state: WorldState;
    landmarks: ReturnType<typeof generateVictorianDistrict>['landmarks'];
  } {
    const base = createInitialWorld({ seed, width: 48, height: 36, currentDistrictId: urbanDistrictId });
    const { state, landmarks } = generateVictorianDistrict(base);
    const streetHoist = state.entities['portal_street_mine_hoist'];
    const hoistPos = streetHoist?.position
      ? { x: streetHoist.position.x, y: streetHoist.position.y }
      : { x: 24, y: 5 };
    const mine = generateSubterraneanMineStratum(48, 36, hoistPos, new SeededRNG(seed), 1);
    const unifiedState: WorldState = {
      ...state,
      strata: { ...state.strata, CATACOMBS: mine.grid },
      entities: { ...state.entities, ...mine.entities },
    };
    assertWorldInvariants(unifiedState);
    return { state: unifiedState, landmarks };
  }

  it('stamps CDDA building archetypes with room zoning, wrought iron bars, and dense Steampunk fixtures', () => {
    const { state } = createUnified4StratumWorld(1888);
    const street = state.strata.STREET!;
    const fixtureKinds = new Set(Object.values(state.entities).map((e) => e.furniture?.kind).filter(Boolean));
    for (const kind of [
      'ARTIFICER_BENCH',
      'COAL_STOVE',
      'IRON_BOILER',
      'ROLL_TOP_DESK',
      'PNEUMATIC_DISPATCH',
      'FILING_CABINET',
      'VALVE_MANIFOLD',
      'SAFE_VAULT',
    ] as const) {
      expect(fixtureKinds.has(kind)).toBe(true);
    }

    const holdingCellFence = street.cells.find((c) => c.terrainType === 'WROUGHT_IRON_FENCE');
    expect(holdingCellFence).toBeDefined();
    expect(holdingCellFence!.blocksMovement).toBe(true);
    expect(holdingCellFence!.blocksSight).toBe(false);

    const zones = new Set(street.cells.map((c) => c.interiorZone).filter((z) => z !== 'NONE'));
    expect(zones.has('PUBLIC_BAR')).toBe(true);
    expect(zones.has('HOLDING_CELL')).toBe(true);
    expect(zones.has('WORKSHOP')).toBe(true);
  });

  it('verifies cross-stratum portal reciprocity, round-trip USE_PORTAL transit, and 100% BFS walkability', () => {
    const { state, landmarks } = createUnified4StratumWorld(1901);
    const portals = Object.values(state.entities).filter((e) => e.portal !== undefined);

    for (const targetStratum of ['UNDERCROFT', 'SPIRE', 'CATACOMBS'] as const) {
      expect(portals.some((p) => p.portal?.target.stratum === targetStratum)).toBe(true);
    }
    for (const portal of portals) {
      const origin = portal.position!;
      const target = portal.portal!.target;
      const counter = portals.find(
        (p) =>
          p.position?.stratum === target.stratum &&
          p.position.x === target.x &&
          p.position.y === target.y &&
          p.portal?.target.stratum === origin.stratum,
      );
      expect(counter).toBeDefined();
    }

    const manhole = portals.find((p) => p.position?.stratum === 'STREET' && p.portal?.target.stratum === 'UNDERCROFT')!;
    const positionedWorld: WorldState = {
      ...state,
      entities: {
        ...state.entities,
        [playerId]: { ...state.entities[playerId]!, position: { ...manhole.position!, blocksMovement: true, blocksSight: false } },
      },
    };
    const descend = dispatchCommand(positionedWorld, { type: 'USE_PORTAL', actorId: playerId });
    expect(descend.events.some((e) => e.type === 'STRATUM_CHANGED')).toBe(true);
    expect(descend.state.entities[playerId]!.position!.stratum).toBe('UNDERCROFT');

    const ascend = dispatchCommand(descend.state, { type: 'USE_PORTAL', actorId: playerId });
    expect(ascend.events.some((e) => e.type === 'STRATUM_CHANGED')).toBe(true);
    expect(ascend.state.entities[playerId]!.position!.stratum).toBe('STREET');

    const street = state.strata.STREET!;
    const plaza = landmarks.streetManhole;
    expect(hasWalkablePath(street, plaza, landmarks.westGate)).toBe(true);
    expect(hasWalkablePath(street, plaza, landmarks.eastGate)).toBe(true);
    if (landmarks.doors) {
      for (const doorPos of Object.values(landmarks.doors)) {
        expect(isReachableOrAdjacent(street, plaza, doorPos)).toBe(true);
      }
    }
    expect(hasWalkablePath(state.strata.UNDERCROFT!, landmarks.undercroftLadder, { x: 10, y: 7 })).toBe(true);
    expect(hasWalkablePath(state.strata.SPIRE!, landmarks.spireLift, { x: 10, y: 7 })).toBe(true);
    const mineHoist = state.entities['portal_mine_hoist_cage']!;
    expect(
      hasWalkablePath(
        state.strata.CATACOMBS!,
        { x: mineHoist.position!.x, y: mineHoist.position!.y },
        { x: 24, y: Math.min(29, Math.floor(36 * 0.78)) },
      ),
    ).toBe(true);
  });

  it('projects multi-stratum worlds into RenderCellLayers and autotiles CP437 box-drawing junctions', () => {
    const { state } = createUnified4StratumWorld(2026);
    const strataList: StratumId[] = ['STREET', 'UNDERCROFT', 'SPIRE', 'CATACOMBS'];

    for (const stratum of strataList) {
      const liveWorld: WorldState = {
        ...state,
        entities: {
          ...state.entities,
          [playerId]: { ...state.entities[playerId]!, position: { x: 23, y: 18, stratum, blocksMovement: true, blocksSight: false } },
        },
      };
      const frame = projectWorldToVisualFrame(liveWorld, playerId, 12);
      expect(frame.activeStratum).toBe(stratum);
      expect(frame.cells.length).toBe(480);
      for (const cell of frame.cells) {
        expect(cell.layers?.floor).toBeDefined();
      }
      const pCell = frame.cells.find((c) => c.worldX === 23 && c.worldY === 18);
      expect(pCell?.layers?.actor?.glyph).toBe('@');
      if (stratum === 'SPIRE') {
        expect(frame.cells.some((c) => c.isUnderlay === true)).toBe(true);
      }
    }

    const street = state.strata.STREET!;
    const resolvedGlyphs = new Set<string>();
    let mixedJunctionCount = 0;
    let solidInteriorCount = 0;
    for (let y = 0; y < street.height; y++) {
      for (let x = 0; x < street.width; x++) {
        const cell = street.cells[y * street.width + x];
        if (cell && (cell.terrainType === 'SOOT_BRICK_WALL' || cell.terrainType === 'TIMBER_STRUT' || cell.terrainType === 'COUNTER_BARRIER')) {
          const glyph = resolveExtendedConnectingWallGlyph(street, x, y);
          resolvedGlyphs.add(glyph);
          if (glyph === DOUBLE_BOX_GLYPHS.SOLID_INTERIOR) solidInteriorCount++;
          if (mixedGlyphSet.has(glyph)) mixedJunctionCount++;
        }
      }
    }
    expect(resolvedGlyphs.has(DOUBLE_BOX_GLYPHS.VERTICAL)).toBe(true);
    expect(resolvedGlyphs.has(DOUBLE_BOX_GLYPHS.HORIZONTAL)).toBe(true);
    expect(solidInteriorCount).toBeGreaterThan(50);
    expect(mixedJunctionCount).toBeGreaterThan(5);
  });

  it('maintains presentation mode cycling, uTacticalSplit = 58/88, and bit-exact multi-seed determinism', () => {
    for (const seed of [4001, 7777, 9999]) {
      const world1 = createUnified4StratumWorld(seed);
      const world2 = createUnified4StratumWorld(seed);
      expect(world1.state.strata.STREET?.cells).toEqual(world2.state.strata.STREET?.cells);
      expect(world1.state.entities).toEqual(world2.state.entities);
      const restored = deserializeWorld(serializeWorld(world1.state));
      assertWorldInvariants(restored);
      expect(restored.strata.CATACOMBS?.cells).toEqual(world1.state.strata.CATACOMBS?.cells);
    }

    const { state } = createUnified4StratumWorld(4001);
    const frame = projectWorldToVisualFrame(state, playerId, 12);
    const atlas = createExtendedGlyphAtlas(12, 20);
    const tileset = createProceduralTileset(12, 20);
    const manager = new TilesetManager(atlas, tileset, 'CP437_ASCII');
    const composer = new TacticalLayerComposer(new Container(), atlas, frame.width, frame.height, manager);
    const pipeline = new SteampunkRenderPipeline(frame.width * 12, frame.height * 20, false);

    composer.renderLayeredCells(frame);
    expect(manager.resolveLayerVisual(frame.cells[0]!.layers!.floor, 'floor', true, true).tint).not.toBe(0xffffff);
    manager.setMode('GRAPHICAL_TILESET');
    composer.renderLayeredCells(frame);
    expect(manager.resolveLayerVisual(frame.cells[0]!.layers!.floor, 'floor', true, true).tint).toBe(0xffffff);
    manager.setMode('HYBRID_OVERLAY');
    composer.renderLayeredCells(frame);
    expect(manager.resolveLayerVisual({ glyph: '@', fgPrimary: '#ffd700', tileKey: 'tile_actor_player' }, 'actor', true, true).tint).toBe(0xffd700);
    expect(composer.getSpritePool('floor').length).toBe(480);
    expect(pipeline.getTacticalSplit()).toBeCloseTo(58.0 / 88.0, 4);
    composer.destroy();
  });
});
