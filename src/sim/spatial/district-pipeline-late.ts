import { BlueprintIdSchema, EntityIdSchema } from '../../schemas/primitives.schema.js';
import { createMonorailCarEntity } from '../systems/monorail.system.js';
import { seedSpireGreenhouse } from './building-prefabs.js';
import { spawnCompassGate } from './compass-gates.js';
import { connectivityTargets, PipelineDistrictContext } from './district-pipeline-context.js';
import { enrichLargeScaleDistrict } from './district-scaler.js';
import { ensureDistrictConnectivity } from './district-yards.js';
import { setTileCell } from './grid.js';
import { generateSpireCatwalks, generateUndercroftDungeon } from './strata-dungeons.js';
import { seedDistrictUtilityNetworks, spawnDistrictInfrastructure } from './utility-networks.js';

/** Stage 6: Multi-Stratum Dungeon Weaving (cellular Undercroft sewers, radial Spire web, macro barriers) */
export function executeStage6MultiStratumDungeons(ctx: PipelineDistrictContext): void {
  const underRes = generateUndercroftDungeon(ctx.width, ctx.height, ctx.center, ctx.rng, ctx.entities);
  ctx.undercroft = underRes.grid;
  ctx.entities = underRes.entities;

  const spireRes = generateSpireCatwalks(ctx.width, ctx.height, ctx.liftPos, ctx.rng, ctx.entities);
  const ghRes = ctx.width >= 36 ? seedSpireGreenhouse(spireRes.grid, spireRes.entities, ctx.liftPos) : { grid: spireRes.grid, entities: spireRes.entities, position: ctx.liftPos };
  ctx.spire = ghRes.grid;
  ctx.entities = ghRes.entities;
  ctx.spireGreenhousePos = ghRes.position;

  const critical = [ctx.westGatePos, ctx.eastGatePos, ctx.center, ctx.liftPos, ctx.boilerPos];
  const scaled = enrichLargeScaleDistrict(
    ctx.street,
    ctx.undercroft,
    ctx.currDistrict,
    ctx.rng,
    critical,
    ctx.entities,
    ctx.layout ? { dropHints: ctx.layout.dropPoints, origin: ctx.center } : {},
  );
  ctx.street = scaled.streetGrid;
  ctx.undercroft = scaled.undercroftGrid;
  ctx.entities = scaled.entities;
  ctx.barriersPlaced = scaled.barriersPlaced;
  ctx.sewerDrops = [...scaled.sewerDrops];
}

/** Stage 7: Interactive Utility & Infrastructure (portals, gates, monorail) and the BFS invariant gate */
export function executeStage7InteractiveUtilityInfrastructure(ctx: PipelineDistrictContext): void {
  const westTarget = ctx.compass.west;
  const eastTarget = ctx.compass.east;

  spawnDistrictInfrastructure(
    ctx.entities,
    ctx.liftPos,
    ctx.boilerPos,
    ctx.artificerWorkbench,
    ctx.westGatePos,
    ctx.eastGatePos,
    westTarget,
    eastTarget,
  );
  if (ctx.compass.north) spawnCompassGate(ctx.entities, 'north', ctx.northGatePos, ctx.compass.north);
  if (ctx.compass.south) spawnCompassGate(ctx.entities, 'south', ctx.southGatePos, ctx.compass.south);

  if (ctx.doors.monorailDepot) {
    const carId = 'monorail_car_street_depot';
    ctx.entities[carId] = createMonorailCarEntity(carId, { ...ctx.monorailCarPos, stratum: 'STREET' }, BlueprintIdSchema.parse(westTarget), 75);
  }

  if (ctx.keyPositions.artisanBench) {
    const masterBenchId = EntityIdSchema.parse('station_guild_artisan_bench');
    ctx.entities[masterBenchId] = {
      id: masterBenchId,
      name: 'Guild Master Artificer Workbench',
      visual: { glyph: 'T', fgPrimary: '#D4AF37', fgSecondary: '#CD7F32', bgColor: '#0A0D0E', shaderFlags: ['SPARK_GLINT'] },
      position: { x: ctx.keyPositions.artisanBench.x, y: ctx.keyPositions.artisanBench.y, stratum: 'STREET', blocksMovement: false, blocksSight: false },
      workbench: { stationType: 'ARTIFICER_BENCH', bonusEfficiencyPct: 25 },
    };
  }

  seedDistrictUtilityNetworks(ctx.entities, ctx.currDistrict, ctx.boilerPos, ctx.artificerWorkbench, ctx.center);

  // TSK-P3-04: macro barriers (canal, viaduct, fences) may have severed arteries; punch corridors where needed.
  ctx.street = ensureDistrictConnectivity(ctx.street, ctx.center, connectivityTargets(ctx)).grid;
}

/** Stage 8: Emergence & Atmospheric Seeding */
export function executeStage8EmergenceAtmosphericSeeding(ctx: PipelineDistrictContext): void {
  // Infuse atmospheric soot and steam gradients around the boilerhouse
  for (let dy = -2; dy <= 2; dy++) {
    for (let dx = -2; dx <= 2; dx++) {
      const bx = ctx.boilerPos.x + dx;
      const by = ctx.boilerPos.y + dy;
      if (bx > 0 && by > 0 && bx < ctx.width - 1 && by < ctx.height - 1) {
        ctx.street = setTileCell(ctx.street, bx, by, (c) => ({
          ...c,
          steamPressureKpa: Math.min(100, c.steamPressureKpa + 20),
          coalDustDensity: Math.min(1, c.coalDustDensity + 0.15),
        }));
      }
    }
  }
}
