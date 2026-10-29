import { EntityRecord } from '../../schemas/components.schema.js';
import { BlueprintIdSchema, EntityIdSchema, Point2D, StratumId } from '../../schemas/primitives.schema.js';

export function createUtilityConduitEntity(
  id: string,
  pos: Point2D & { stratum: StratumId },
  conduitType: 'HIGH_PRESSURE_STEAM_MAIN' | 'HYDRAULIC_DRAINAGE' | 'PNEUMATIC_TRANSIT_TUBE' | 'COAL_GAS_FEED' | 'AETHER_CONDUIT',
  networkId: string,
  pressureKpa: number,
  endpoints: string[] = [],
): EntityRecord {
  const entityId = EntityIdSchema.parse(id);
  return {
    id: entityId,
    name: `${conduitType.replace(/_/g, ' ')} Conduit Node`,
    visual: { glyph: '┼', fgPrimary: '#D4AF37', fgSecondary: '#B7950B', bgColor: '#0A0D0E', shaderFlags: ['SPARK_GLINT'] },
    position: { x: pos.x, y: pos.y, stratum: pos.stratum, blocksMovement: false, blocksSight: false },
    utilityConduit: {
      conduitType,
      networkId,
      operatingPressureKpa: pressureKpa,
      maxPressureKpa: pressureKpa + 100,
      ruptured: false,
      connectedEndpointEntityIds: endpoints.map((e) => EntityIdSchema.parse(e)),
    },
  };
}

export function createHydrologyChannelEntity(
  id: string,
  pos: Point2D & { stratum: StratumId },
  fluidType: 'WATER' | 'SLUDGE' | 'ACID' | 'WHALE_OIL' | 'SEWAGE' = 'WATER',
  drainsIntoStratum?: StratumId,
): EntityRecord {
  const entityId = EntityIdSchema.parse(id);
  return {
    id: entityId,
    name: 'District Hydrology Sluice Channel',
    visual: { glyph: '╫', fgPrimary: '#2874A6', fgSecondary: '#1B4F72', bgColor: '#0A0D0E', shaderFlags: ['PULSE_STEAM'] },
    position: { x: pos.x, y: pos.y, stratum: pos.stratum, blocksMovement: false, blocksSight: false },
    hydrologyChannel: {
      fluidType,
      currentVolumeMl: 25000,
      maxFlowRateMlPerTick: 500,
      sluiceOpen: true,
      drainsIntoStratum,
    },
  };
}

export function spawnDistrictInfrastructure(
  entities: Record<string, EntityRecord>,
  liftPos: Point2D,
  boilerPos: Point2D,
  workbenchPos: Point2D,
  westGatePos: Point2D,
  eastGatePos: Point2D,
  westTarget: string,
  eastTarget: string,
): void {
  const liftUpId = EntityIdSchema.parse('portal_street_lift_up');
  const liftDownId = EntityIdSchema.parse('portal_spire_lift_down');
  const boilerId = EntityIdSchema.parse('vessel_district_boiler');
  const workbenchId = EntityIdSchema.parse('station_artificer_workbench');
  const westGateId = EntityIdSchema.parse('gate_transit_west');
  const eastGateId = EntityIdSchema.parse('gate_transit_east');

  entities[liftUpId] = {
    id: liftUpId, name: 'Pneumatic Freight Elevator (To Spire)',
    visual: { glyph: '^', fgPrimary: '#F4D03F', fgSecondary: '#D4AF37', bgColor: '#0A0D0E', shaderFlags: ['SPARK_GLINT'] },
    position: { x: liftPos.x, y: liftPos.y, stratum: 'STREET', blocksMovement: false, blocksSight: false },
    portal: { target: { x: liftPos.x, y: liftPos.y, stratum: 'SPIRE' }, bidirectional: true, conductsGas: true, apCost: 100, portalLabel: 'Ascend Pneumatic Lift to Brass Spire' },
    crossStratumShaft: { shaftType: 'PNEUMATIC_LIFT', upperStratum: 'SPIRE', lowerStratum: 'STREET', upperCoord: liftPos, lowerCoord: liftPos, operational: true, flowRateUnitsPerTick: 1 },
  };
  entities[liftDownId] = {
    id: liftDownId, name: 'Pneumatic Freight Elevator (To Street)',
    visual: { glyph: 'v', fgPrimary: '#F4D03F', fgSecondary: '#D4AF37', bgColor: '#0A0D0E', shaderFlags: [] },
    position: { x: liftPos.x, y: liftPos.y, stratum: 'SPIRE', blocksMovement: false, blocksSight: false },
    portal: { target: { x: liftPos.x, y: liftPos.y, stratum: 'STREET' }, bidirectional: true, conductsGas: true, apCost: 100, portalLabel: 'Descend Pneumatic Lift to Foundry Street' },
    crossStratumShaft: { shaftType: 'PNEUMATIC_LIFT', upperStratum: 'SPIRE', lowerStratum: 'STREET', upperCoord: liftPos, lowerCoord: liftPos, operational: true, flowRateUnitsPerTick: 1 },
  };
  entities[boilerId] = {
    id: boilerId, name: 'Spitalfields High-Pressure Foundry Boiler',
    visual: { glyph: '0', fgPrimary: '#CD7F32', fgSecondary: '#E67E22', bgColor: '#0A0D0E', shaderFlags: ['PULSE_STEAM'] },
    position: { x: boilerPos.x, y: boilerPos.y, stratum: 'STREET', blocksMovement: false, blocksSight: false },
    pressureVessel: { currentPressureKpa: 180, maxPressureKpa: 300, ruptured: false },
  };
  entities[workbenchId] = {
    id: workbenchId, name: 'Spitalfields Pneumatic Artificer Workbench',
    visual: { glyph: 'T', fgPrimary: '#D4AF37', fgSecondary: '#CD7F32', bgColor: '#0A0D0E', shaderFlags: ['SPARK_GLINT'] },
    position: { x: workbenchPos.x, y: workbenchPos.y, stratum: 'STREET', blocksMovement: false, blocksSight: false },
    workbench: { stationType: 'ARTIFICER_BENCH', bonusEfficiencyPct: 20 },
  };
  entities[westGateId] = {
    id: westGateId, name: `West Transit Gate (To ${westTarget})`,
    visual: { glyph: 'Ω', fgPrimary: '#2E86C1', fgSecondary: '#1B4F72', bgColor: '#0A0D0E', shaderFlags: [] },
    position: { x: westGatePos.x, y: westGatePos.y, stratum: 'STREET', blocksMovement: false, blocksSight: false },
    districtGate: { targetDistrictId: BlueprintIdSchema.parse(westTarget), gateLabel: `Travel to ${westTarget}`, apCost: 100 },
  };
  entities[eastGateId] = {
    id: eastGateId, name: `East Transit Gate (To ${eastTarget})`,
    visual: { glyph: 'Ω', fgPrimary: '#F4D03F', fgSecondary: '#D4AF37', bgColor: '#0A0D0E', shaderFlags: ['SPARK_GLINT'] },
    position: { x: eastGatePos.x, y: eastGatePos.y, stratum: 'STREET', blocksMovement: false, blocksSight: false },
    districtGate: { targetDistrictId: BlueprintIdSchema.parse(eastTarget), gateLabel: `Travel to ${eastTarget}`, apCost: 100 },
  };
}

export function seedDistrictUtilityNetworks(
  entities: Record<string, EntityRecord>,
  districtId: string,
  boilerPos: Point2D,
  workbenchPos: Point2D,
  center: Point2D,
): void {
  const dBlueprint = BlueprintIdSchema.parse(districtId);
  const networkId = `steam_main_${dBlueprint}`;

  const conduit1Id = `conduit_steam_boiler_${dBlueprint}`;
  entities[conduit1Id] = createUtilityConduitEntity(
    conduit1Id,
    { x: boilerPos.x, y: boilerPos.y, stratum: 'STREET' },
    'HIGH_PRESSURE_STEAM_MAIN',
    networkId,
    180,
    ['vessel_district_boiler', 'station_artificer_workbench'],
  );

  const conduit2Id = `conduit_steam_plaza_${dBlueprint}`;
  entities[conduit2Id] = createUtilityConduitEntity(
    conduit2Id,
    { x: center.x, y: center.y, stratum: 'STREET' },
    'HIGH_PRESSURE_STEAM_MAIN',
    networkId,
    160,
    [conduit1Id],
  );

  const conduit3Id = `conduit_steam_bench_${dBlueprint}`;
  entities[conduit3Id] = createUtilityConduitEntity(
    conduit3Id,
    { x: workbenchPos.x, y: workbenchPos.y, stratum: 'STREET' },
    'HIGH_PRESSURE_STEAM_MAIN',
    networkId,
    140,
    [conduit2Id],
  );

  const sluiceId = `hydrology_sluice_${dBlueprint}`;
  entities[sluiceId] = createHydrologyChannelEntity(
    sluiceId,
    { x: center.x, y: center.y + 1, stratum: 'STREET' },
    'WATER',
    'UNDERCROFT',
  );
}
