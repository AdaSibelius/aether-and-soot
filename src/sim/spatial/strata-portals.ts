import { EntityRecord } from '../../schemas/components.schema.js';
import { EntityIdSchema, Point2D, StratumId, VisualGlyphSpec } from '../../schemas/primitives.schema.js';
import { PipelineDistrictContext } from './district-pipeline-context.js';
import { setTileCell, StratumGrid } from './grid.js';

export interface StrataPortalPair {
  readonly upperEntity: EntityRecord;
  readonly lowerEntity: EntityRecord;
}

export interface StrataPortalNetwork {
  readonly streetUndercroftManhole: StrataPortalPair;
  readonly streetSpireElevator: StrataPortalPair;
  readonly streetMineHoist: StrataPortalPair;
  readonly undercroftCatacombsStairs: StrataPortalPair;
  readonly secondaryDrops: readonly StrataPortalPair[];
}

export function createBidirectionalPortalPair(config: {
  readonly upperId: string;
  readonly lowerId: string;
  readonly upperPos: Point2D & { stratum: StratumId; depthLevel?: number };
  readonly lowerPos: Point2D & { stratum: StratumId; depthLevel?: number };
  readonly upperLabel: string;
  readonly lowerLabel: string;
  readonly upperVisual: VisualGlyphSpec;
  readonly lowerVisual: VisualGlyphSpec;
  readonly shaftType?: 'PNEUMATIC_LIFT' | 'SEWER_SIPHON' | 'STEAM_RISER' | 'GRAVITY_CHUTE' | 'MONORAIL_ELEVATOR';
  readonly flowRateUnitsPerTick?: number;
}): StrataPortalPair {
  const makeHalf = (
    id: string, name: string, visual: VisualGlyphSpec,
    pos: Point2D & { stratum: StratumId; depthLevel?: number },
    target: Point2D & { stratum: StratumId; depthLevel?: number },
    label: string,
  ): EntityRecord => ({
    id: EntityIdSchema.parse(id),
    name,
    visual,
    position: { x: pos.x, y: pos.y, stratum: pos.stratum, ...(pos.depthLevel !== undefined ? { depthLevel: pos.depthLevel } : {}), blocksMovement: false, blocksSight: false },
    portal: { target: { x: target.x, y: target.y, stratum: target.stratum, ...(target.depthLevel !== undefined ? { depthLevel: target.depthLevel } : {}) }, bidirectional: true, conductsGas: true, apCost: 100, portalLabel: label },
    ...(config.shaftType ? {
      crossStratumShaft: {
        shaftType: config.shaftType,
        upperStratum: config.upperPos.stratum,
        lowerStratum: config.lowerPos.stratum,
        upperCoord: { x: config.upperPos.x, y: config.upperPos.y },
        lowerCoord: { x: config.lowerPos.x, y: config.lowerPos.y },
        operational: true,
        flowRateUnitsPerTick: config.flowRateUnitsPerTick ?? 1,
      },
    } : {}),
  });

  const upperEntity = makeHalf(config.upperId, config.upperLabel, config.upperVisual, config.upperPos, config.lowerPos, config.lowerLabel);
  const lowerEntity = makeHalf(config.lowerId, config.lowerLabel, config.lowerVisual, config.lowerPos, config.upperPos, config.upperLabel);
  return { upperEntity, lowerEntity };
}

export function spawnStreetUndercroftManholePair(
  entities: Record<string, EntityRecord>,
  streetPos: Point2D,
  undercroftPos: Point2D,
  index = 0,
): StrataPortalPair {
  const pair = createBidirectionalPortalPair({
    upperId: index === 0 ? 'portal_street_manhole' : `portal_street_manhole_${index}`,
    lowerId: index === 0 ? 'portal_undercroft_ladder' : `portal_undercroft_ladder_${index}`,
    upperPos: { ...streetPos, stratum: 'STREET' },
    lowerPos: { ...undercroftPos, stratum: 'UNDERCROFT' },
    upperLabel: 'Street Sewer Manhole Cover',
    lowerLabel: 'Undercroft Maintenance Ladder',
    upperVisual: { glyph: '0', fgPrimary: '#7F8C8D', fgSecondary: '#5D6D7E', bgColor: '#0A0D0E', shaderFlags: [] },
    lowerVisual: { glyph: '^', fgPrimary: '#D4AF37', fgSecondary: '#B7950B', bgColor: '#0A0D0E', shaderFlags: [] },
    shaftType: 'SEWER_SIPHON',
  });
  entities[pair.upperEntity.id] = pair.upperEntity;
  entities[pair.lowerEntity.id] = pair.lowerEntity;
  return pair;
}

export function spawnStreetSpireElevatorPair(
  entities: Record<string, EntityRecord>,
  streetPos: Point2D,
  spirePos: Point2D,
): StrataPortalPair {
  const pair = createBidirectionalPortalPair({
    upperId: 'portal_spire_lift_down',
    lowerId: 'portal_street_lift_up',
    upperPos: { ...spirePos, stratum: 'SPIRE' },
    lowerPos: { ...streetPos, stratum: 'STREET' },
    upperLabel: 'Pneumatic Freight Elevator (To Street)',
    lowerLabel: 'Pneumatic Freight Elevator (To Spire)',
    upperVisual: { glyph: 'v', fgPrimary: '#F4D03F', fgSecondary: '#D4AF37', bgColor: '#0A0D0E', shaderFlags: [] },
    lowerVisual: { glyph: '^', fgPrimary: '#F4D03F', fgSecondary: '#D4AF37', bgColor: '#0A0D0E', shaderFlags: ['SPARK_GLINT'] },
    shaftType: 'PNEUMATIC_LIFT',
  });
  entities[pair.upperEntity.id] = pair.upperEntity;
  entities[pair.lowerEntity.id] = pair.lowerEntity;
  return pair;
}

export function spawnStreetMineHoistPair(
  entities: Record<string, EntityRecord>,
  streetPos: Point2D,
  minePos: Point2D,
): StrataPortalPair {
  const pair = createBidirectionalPortalPair({
    upperId: 'portal_street_mine_hoist',
    lowerId: 'portal_mine_hoist_cage',
    upperPos: { ...streetPos, stratum: 'STREET' },
    lowerPos: { ...minePos, stratum: 'CATACOMBS', depthLevel: 1 },
    upperLabel: 'Freight Mine Headframe Hoist',
    lowerLabel: 'Mine Headframe Hoist Cage',
    upperVisual: { glyph: 'H', fgPrimary: '#E67E22', fgSecondary: '#A04000', bgColor: '#0A0D0E', shaderFlags: ['PULSE_STEAM'] },
    lowerVisual: { glyph: 'H', fgPrimary: '#E67E22', fgSecondary: '#A04000', bgColor: '#0A0D0E', shaderFlags: ['PULSE_STEAM'] },
  });
  entities[pair.upperEntity.id] = pair.upperEntity;
  entities[pair.lowerEntity.id] = pair.lowerEntity;
  return pair;
}

export function spawnUndercroftCatacombsStairsPair(
  entities: Record<string, EntityRecord>,
  undercroftPos: Point2D,
  catacombsPos: Point2D,
  depthLevel = 1,
): StrataPortalPair {
  const pair = createBidirectionalPortalPair({
    upperId: 'stairs_undercroft_to_catacombs',
    lowerId: `stairs_catacombs_up_d${depthLevel}`,
    upperPos: { ...undercroftPos, stratum: 'UNDERCROFT' },
    lowerPos: { ...catacombsPos, stratum: 'CATACOMBS', depthLevel },
    upperLabel: 'Stone Stairwell Down to Catacombs',
    lowerLabel: 'Stone Stairwell Up to Undercroft',
    upperVisual: { glyph: '>', fgPrimary: '#E74C3C', fgSecondary: '#922B21', bgColor: '#0A0D0E', shaderFlags: [] },
    lowerVisual: { glyph: '<', fgPrimary: '#D4AC0D', fgSecondary: '#7D6608', bgColor: '#0A0D0E', shaderFlags: [] },
  });
  entities[pair.upperEntity.id] = pair.upperEntity;
  entities[pair.lowerEntity.id] = pair.lowerEntity;
  return pair;
}

function ensureWalkableLanding(grid: StratumGrid, pos: Point2D, fallbackTerrain: 'COBBLESTONE_FLOOR' | 'IRON_GRATE'): StratumGrid {
  const cell = grid.cells[pos.y * grid.width + pos.x];
  if (cell && cell.blocksMovement) {
    return setTileCell(grid, pos.x, pos.y, (c) => ({
      ...c,
      terrainType: fallbackTerrain,
      blocksMovement: false,
      blocksSight: false,
    }));
  }
  return grid;
}

export function linkAllStrataPortals(
  ctx: PipelineDistrictContext,
  strataGrids: Partial<Record<StratumId, StratumGrid>>,
  entities: Record<string, EntityRecord>,
  options?: { mineHoistPos?: Point2D; mineFloorPos?: Point2D },
): StrataPortalNetwork {
  const streetUndercroftManhole = spawnStreetUndercroftManholePair(entities, ctx.center, ctx.center);
  const streetSpireElevator = spawnStreetSpireElevatorPair(entities, ctx.liftPos, ctx.liftPos);

  const mineStreetPos = options?.mineHoistPos ?? ctx.mineHoistPos ?? { x: Math.min(ctx.width - 4, ctx.center.x + 8), y: 5 };
  const mineFloorPos = options?.mineFloorPos ?? mineStreetPos;
  const streetMineHoist = spawnStreetMineHoistPair(entities, mineStreetPos, mineFloorPos);

  const existingCatStair = entities['stairs_undercroft_to_catacombs'];
  const catacombsUnderPos = existingCatStair?.position
    ? { x: existingCatStair.position.x, y: existingCatStair.position.y }
    : { x: Math.floor(ctx.width * 0.5), y: Math.floor(ctx.height * 0.25) };
  const catacombsFloorPos = { x: 5, y: 5 };
  const undercroftCatacombsStairs = spawnUndercroftCatacombsStairsPair(entities, catacombsUnderPos, catacombsFloorPos, 1);

  const secondaryDrops: StrataPortalPair[] = [];
  if (ctx.sewerDrops) {
    for (let i = 0; i < ctx.sewerDrops.length; i++) {
      const dropPos = ctx.sewerDrops[i]!;
      secondaryDrops.push(spawnStreetUndercroftManholePair(entities, dropPos, dropPos, i + 1));
    }
  }

  // Link any template-instantiated portals on STREET targeting UNDERCROFT that lack an undercroft return portal
  for (const entity of Object.values(entities)) {
    if (entity.position?.stratum === 'STREET' && entity.portal?.target.stratum === 'UNDERCROFT') {
      const pos = entity.position;
      const hasReturn = Object.values(entities).some(
        (e) =>
          e.position?.stratum === 'UNDERCROFT' &&
          e.position.x === pos.x &&
          e.position.y === pos.y &&
          e.portal?.target.stratum === 'STREET',
      );
      if (!hasReturn) {
        const returnId = EntityIdSchema.parse(`${entity.id}_return_undercroft`);
        entities[returnId] = {
          id: returnId,
          name: `${entity.name} (Ladder Up)`,
          visual: { glyph: '^', fgPrimary: '#D4AF37', fgSecondary: '#B7950B', bgColor: '#0A0D0E', shaderFlags: [] },
          position: { x: pos.x, y: pos.y, stratum: 'UNDERCROFT', blocksMovement: false, blocksSight: false },
          portal: {
            target: { x: pos.x, y: pos.y, stratum: 'STREET' },
            bidirectional: true,
            conductsGas: true,
            apCost: 100,
            portalLabel: `Ascend ${entity.name} to Street`,
          },
        };
      }
    }
  }

  // Ensure walkable landings on all strata
  if (strataGrids.STREET) {
    strataGrids.STREET = ensureWalkableLanding(strataGrids.STREET, ctx.center, 'COBBLESTONE_FLOOR');
    strataGrids.STREET = ensureWalkableLanding(strataGrids.STREET, ctx.liftPos, 'COBBLESTONE_FLOOR');
    strataGrids.STREET = ensureWalkableLanding(strataGrids.STREET, mineStreetPos, 'COBBLESTONE_FLOOR');
  }
  if (strataGrids.UNDERCROFT) {
    strataGrids.UNDERCROFT = ensureWalkableLanding(strataGrids.UNDERCROFT, ctx.center, 'IRON_GRATE');
    strataGrids.UNDERCROFT = ensureWalkableLanding(strataGrids.UNDERCROFT, catacombsUnderPos, 'IRON_GRATE');
  }
  if (strataGrids.SPIRE) {
    strataGrids.SPIRE = ensureWalkableLanding(strataGrids.SPIRE, ctx.liftPos, 'IRON_GRATE');
  }

  return {
    streetUndercroftManhole,
    streetSpireElevator,
    streetMineHoist,
    undercroftCatacombsStairs,
    secondaryDrops,
  };
}
