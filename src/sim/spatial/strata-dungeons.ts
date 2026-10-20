import { EntityRecord } from '../../schemas/components.schema.js';
import { BlueprintIdSchema, EntityId, EntityIdSchema, Point2D } from '../../schemas/primitives.schema.js';
import { SeededRNG } from '../core/rng.js';
import { createEntityFromBlueprint } from '../data/item-catalog.js';
import { createDefaultNpcAnatomy } from '../systems/district-spawner.js';
import { buildSolidStratumGrid, carveCorridor, carveRoom } from './district-layout.js';
import { StratumGrid } from './grid.js';

export interface StrataDungeonResult {
  readonly grid: StratumGrid;
  readonly entities: Record<string, EntityRecord>;
}

function seedDungeonContainer(
  entities: Record<string, EntityRecord>,
  items: readonly { id: string; blueprintId: string; quantity: number }[],
): EntityRecord['inventory'] {
  const containedEntityIds: EntityId[] = [];
  let totalMass = 0;
  for (const it of items) {
    const eid = EntityIdSchema.parse(it.id);
    const created = createEntityFromBlueprint(BlueprintIdSchema.parse(it.blueprintId), eid, it.quantity);
    if (created) {
      entities[eid] = created;
      containedEntityIds.push(eid);
      totalMass += (created.item?.massGrams ?? 0) * (created.item?.quantity ?? 1);
    }
  }
  return { containedEntityIds, currentMassGrams: totalMass, maxMassGrams: 50000, maxVolumeMl: 50000 };
}

export function generateUndercroftDungeon(
  width: number,
  height: number,
  entryPos: Point2D,
  _rng: SeededRNG,
  existingEntities: Record<string, EntityRecord>,
): StrataDungeonResult {
  let grid = buildSolidStratumGrid('UNDERCROFT', width, height);
  const entities: Record<string, EntityRecord> = { ...existingEntities };

  const rX = (ratio: number) => Math.max(3, Math.min(width - 4, Math.floor(width * ratio)));
  const rY = (ratio: number) => Math.max(3, Math.min(height - 4, Math.floor(height * ratio)));

  // 6 peripheral chambers + 1 central entry chamber (7 interconnected rooms)
  const chambers: Point2D[] = [
    { x: rX(0.22), y: rY(0.22) },
    { x: rX(0.50), y: rY(0.20) },
    { x: rX(0.78), y: rY(0.22) },
    { x: rX(0.22), y: rY(0.78) },
    { x: rX(0.50), y: rY(0.80) },
    { x: rX(0.78), y: rY(0.78) },
  ];

  // Carve entry chamber at ladder position
  grid = carveRoom(grid, entryPos.x, entryPos.y, 2, 2, 'IRON_GRATE', 0.15);

  // Carve all peripheral chambers
  for (let i = 0; i < chambers.length; i++) {
    const ch = chambers[i]!;
    const dust = 0.15 + (i % 3) * 0.1;
    grid = carveRoom(grid, ch.x, ch.y, 2, 2, 'IRON_GRATE', dust);
  }

  // Sluice corridors connecting chambers into an unbroken dungeon loop
  grid = carveCorridor(grid, chambers[0]!, chambers[1]!, 'IRON_GRATE');
  grid = carveCorridor(grid, chambers[1]!, chambers[2]!, 'IRON_GRATE');
  grid = carveCorridor(grid, chambers[3]!, chambers[4]!, 'IRON_GRATE');
  grid = carveCorridor(grid, chambers[4]!, chambers[5]!, 'IRON_GRATE');
  grid = carveCorridor(grid, chambers[0]!, chambers[3]!, 'IRON_GRATE');
  grid = carveCorridor(grid, chambers[2]!, chambers[5]!, 'IRON_GRATE');
  grid = carveCorridor(grid, chambers[1]!, entryPos, 'IRON_GRATE');
  grid = carveCorridor(grid, entryPos, chambers[4]!, 'IRON_GRATE');

  // Spawn Undercroft Syndicate Fixer & Smugglers
  const fixerId = EntityIdSchema.parse('npc_undercroft_syndicate_fixer');
  const fixPos = chambers[5]!;
  entities[fixerId] = {
    id: fixerId, name: 'Sump Syndicate Fixer',
    visual: { glyph: 'F', fgPrimary: '#AF7AC5', fgSecondary: '#7D3C98', bgColor: '#0A0D0E', shaderFlags: [] },
    position: { x: fixPos.x, y: fixPos.y, stratum: 'UNDERCROFT', blocksMovement: true, blocksSight: false },
    actor: { energy: 0, speed: 100, isPlayer: false },
    aiController: { factionId: 'UNDERCROFT_SYNDICATE', role: 'FIXER', hostile: false, alertState: 'IDLE' },
    combatStats: { meleeDamage: 12, accuracyPct: 85, armorReduction: 1 },
    anatomy: createDefaultNpcAnatomy(40, 25),
    inventory: seedDungeonContainer(entities, [{ id: 'loot_fix_pouch', blueprintId: 'item_crown_pence_pouch', quantity: 2 }]),
  };

  const hostileId = EntityIdSchema.parse('npc_undercroft_feral_lurker');
  const hostPos = chambers[0]!;
  entities[hostileId] = {
    id: hostileId, name: 'Feral Sewer Lurker',
    visual: { glyph: 'r', fgPrimary: '#E74C3C', fgSecondary: '#922B21', bgColor: '#0A0D0E', shaderFlags: [] },
    position: { x: hostPos.x, y: hostPos.y, stratum: 'UNDERCROFT', blocksMovement: true, blocksSight: false },
    actor: { energy: 0, speed: 110, isPlayer: false },
    aiController: { factionId: 'UNDERCROFT_SYNDICATE', role: 'SCAVENGER', hostile: true, alertState: 'IDLE' },
    combatStats: { meleeDamage: 15, accuracyPct: 80, armorReduction: 0 },
    anatomy: createDefaultNpcAnatomy(35, 20),
  };

  // Heavy Brass Gear Crate in Flooded Vault
  const crateId = EntityIdSchema.parse('furniture_undercroft_crate');
  const cratePos = chambers[3]!;
  entities[crateId] = {
    id: crateId, name: 'Heavy Smuggler Gear Crate',
    visual: { glyph: '⌸', fgPrimary: '#D4AF37', fgSecondary: '#8B6914', bgColor: '#0A0D0E', shaderFlags: [] },
    position: { x: cratePos.x + 1, y: cratePos.y, stratum: 'UNDERCROFT', blocksMovement: true, blocksSight: false },
    furniture: { kind: 'CRATE', label: 'Heavy Smuggler Gear Crate' },
    inventory: seedDungeonContainer(entities, [
      { id: 'loot_undercroft_gears', blueprintId: 'mat_brass_gears', quantity: 2 },
      { id: 'loot_undercroft_coal', blueprintId: 'commodity_anthracite_briquette', quantity: 2 },
    ]),
  };

  return { grid, entities };
}

export function generateSpireCatwalks(
  width: number,
  height: number,
  entryPos: Point2D,
  _rng: SeededRNG,
  existingEntities: Record<string, EntityRecord>,
): StrataDungeonResult {
  let grid = buildSolidStratumGrid('SPIRE', width, height);
  const entities: Record<string, EntityRecord> = { ...existingEntities };

  const rX = (ratio: number) => Math.max(3, Math.min(width - 4, Math.floor(width * ratio)));
  const rY = (ratio: number) => Math.max(3, Math.min(height - 4, Math.floor(height * ratio)));

  // 6 elevated platforms + entry lift platform
  const platforms: Point2D[] = [
    { x: rX(0.22), y: rY(0.22) },
    { x: rX(0.50), y: rY(0.20) },
    { x: rX(0.78), y: rY(0.22) },
    { x: rX(0.22), y: rY(0.78) },
    { x: rX(0.50), y: rY(0.80) },
    { x: rX(0.78), y: rY(0.78) },
  ];

  // Carve entry platform around pneumatic lift
  grid = carveRoom(grid, entryPos.x, entryPos.y, 2, 2, 'BRASS_CATWALK', 0);

  // Carve all tower platforms
  for (const pl of platforms) {
    grid = carveRoom(grid, pl.x, pl.y, 2, 2, 'BRASS_CATWALK', 0);
  }

  // Narrow brass sky-bridges interconnecting all tower platforms
  grid = carveCorridor(grid, platforms[0]!, platforms[1]!, 'BRASS_CATWALK');
  grid = carveCorridor(grid, platforms[1]!, platforms[2]!, 'BRASS_CATWALK');
  grid = carveCorridor(grid, platforms[3]!, platforms[4]!, 'BRASS_CATWALK');
  grid = carveCorridor(grid, platforms[4]!, platforms[5]!, 'BRASS_CATWALK');
  grid = carveCorridor(grid, platforms[0]!, platforms[3]!, 'BRASS_CATWALK');
  grid = carveCorridor(grid, platforms[2]!, platforms[5]!, 'BRASS_CATWALK');
  grid = carveCorridor(grid, platforms[1]!, entryPos, 'BRASS_CATWALK');
  grid = carveCorridor(grid, entryPos, platforms[4]!, 'BRASS_CATWALK');

  // Spawn Spire Clockwork Artificer
  const artificerId = EntityIdSchema.parse('npc_spire_artificer');
  const artPos = platforms[4]!;
  entities[artificerId] = {
    id: artificerId, name: 'Spire Clockwork Artificer',
    visual: { glyph: 'A', fgPrimary: '#F4D03F', fgSecondary: '#D4AF37', bgColor: '#0A0D0E', shaderFlags: ['SPARK_GLINT'] },
    position: { x: artPos.x, y: artPos.y, stratum: 'SPIRE', blocksMovement: true, blocksSight: false },
    actor: { energy: 0, speed: 100, isPlayer: false },
    aiController: { factionId: 'CLOCKWORK_GUILD', role: 'MERCHANT', hostile: false, alertState: 'IDLE' },
    combatStats: { meleeDamage: 10, accuracyPct: 85, armorReduction: 2 },
    anatomy: createDefaultNpcAnatomy(45, 25),
  };

  // Clockwork Sentry Guard
  const sentryId = EntityIdSchema.parse('npc_spire_sentry_guard');
  const sentryPos = platforms[3]!;
  entities[sentryId] = {
    id: sentryId, name: 'Brass Sentry Automaton',
    visual: { glyph: 'S', fgPrimary: '#5DADE2', fgSecondary: '#2E86C1', bgColor: '#0A0D0E', shaderFlags: [] },
    position: { x: sentryPos.x, y: sentryPos.y, stratum: 'SPIRE', blocksMovement: true, blocksSight: false },
    actor: { energy: 0, speed: 90, isPlayer: false },
    aiController: { factionId: 'CLOCKWORK_GUILD', role: 'GUARD', hostile: false, alertState: 'IDLE' },
    combatStats: { meleeDamage: 16, accuracyPct: 90, armorReduction: 3 },
    anatomy: createDefaultNpcAnatomy(55, 30),
  };

  // Constabulary Armoury Locker on Watchtower Platform
  const lockerId = EntityIdSchema.parse('furniture_spire_armoury');
  const lockerPos = platforms[0]!;
  entities[lockerId] = {
    id: lockerId, name: 'Spire Watch Armoury Locker',
    visual: { glyph: '⌸', fgPrimary: '#7F8C8D', fgSecondary: '#34495E', bgColor: '#0A0D0E', shaderFlags: [] },
    position: { x: lockerPos.x + 1, y: lockerPos.y, stratum: 'SPIRE', blocksMovement: true, blocksSight: false },
    furniture: { kind: 'LOCKER', label: 'Spire Watch Armoury Locker' },
    inventory: seedDungeonContainer(entities, [
      { id: 'loot_spire_plate', blueprintId: 'mat_cast_iron_plate', quantity: 2 },
      { id: 'loot_spire_pipe', blueprintId: 'weapon_heavy_pipe_wrench', quantity: 1 },
    ]),
  };

  // High-Pressure Steam Vessel on Crane Spire Platform
  const boilerId = EntityIdSchema.parse('vessel_spire_crane_boiler');
  const boilerPos = platforms[5]!;
  entities[boilerId] = {
    id: boilerId, name: 'Rooftop Steam Crane Accumulator',
    visual: { glyph: '0', fgPrimary: '#CD7F32', fgSecondary: '#E67E22', bgColor: '#0A0D0E', shaderFlags: ['PULSE_STEAM'] },
    position: { x: boilerPos.x - 1, y: boilerPos.y, stratum: 'SPIRE', blocksMovement: true, blocksSight: false },
    pressureVessel: { currentPressureKpa: 140, maxPressureKpa: 280, ruptured: false },
  };

  // Technical Library Bookshelf on Observatory Platform
  const bookId = EntityIdSchema.parse('furniture_spire_bookshelf');
  const bookPos = platforms[2]!;
  entities[bookId] = {
    id: bookId, name: 'Observatory Folio Bookshelf',
    visual: { glyph: 'E', fgPrimary: '#A04000', fgSecondary: '#6E2C00', bgColor: '#0A0D0E', shaderFlags: [] },
    position: { x: bookPos.x + 1, y: bookPos.y, stratum: 'SPIRE', blocksMovement: true, blocksSight: false },
    furniture: { kind: 'BOOKSHELF', label: 'Observatory Folio Bookshelf' },
    inventory: seedDungeonContainer(entities, [
      { id: 'loot_spire_manual_pneumatic', blueprintId: 'book_pneumatic_schematic', quantity: 1 },
      { id: 'loot_spire_manual_ocular', blueprintId: 'book_ocular_schematic', quantity: 1 },
    ]),
  };

  return { grid, entities };
}
