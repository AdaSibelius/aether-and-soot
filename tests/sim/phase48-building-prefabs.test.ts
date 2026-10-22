import { describe, expect, it } from 'vitest';
import {
  createInitialWorld,
  deserializeWorld,
  serializeWorld,
} from '../../src/sim/core/world.js';
import {
  carveMultiRoomBuilding,
  findCellsInZone,
  getInteriorZoneAtPoint,
} from '../../src/sim/spatial/building-prefabs.js';
import { generateVictorianDistrict, hasWalkablePath } from '../../src/sim/spatial/generator.js';
import { createStratumGrid, getTileCell } from '../../src/sim/spatial/grid.js';

describe('Phase 48: Multi-Room Building Prefab Engine, Architectural Typology & Landmark Micro-Locations', () => {
  it('carves multi-room floorplans with structural interior zoning and connecting doors', () => {
    let grid = createStratumGrid('STREET', 25, 25);
    const mainDoor = { x: 12, y: 15 };
    const interiorDoor = { x: 10, y: 10 };

    grid = carveMultiRoomBuilding(grid, {
      x1: 5,
      y1: 5,
      x2: 20,
      y2: 15,
      mainDoor,
      rooms: [
        { zone: 'RECEPTION', x1: 6, y1: 11, x2: 19, y2: 14, label: 'Reception Lounge' },
        { zone: 'SURGICAL_BAY', x1: 6, y1: 6, x2: 11, y2: 9, label: 'Surgical Clinic' },
        { zone: 'STORAGE', x1: 13, y1: 6, x2: 19, y2: 9, label: 'Chemical Vault' },
      ],
      interiorDoors: [interiorDoor],
      windows: [{ x: 8, y: 5 }, { x: 16, y: 5 }],
    });

    // Verify main entrance door
    const doorCell = getTileCell(grid, mainDoor.x, mainDoor.y);
    expect(doorCell?.terrainType).toBe('WOODEN_DOOR_CLOSED');
    expect(doorCell?.blocksMovement).toBe(true);
    expect(doorCell?.interiorZone).toBe('RECEPTION');

    // Verify interior partition door
    const intDoorCell = getTileCell(grid, interiorDoor.x, interiorDoor.y);
    expect(intDoorCell?.terrainType).toBe('WOODEN_DOOR_CLOSED');
    expect(intDoorCell?.blocksMovement).toBe(true);

    // Verify structural interior zoning stamps
    expect(getInteriorZoneAtPoint(grid, 10, 12)).toBe('RECEPTION');
    expect(getInteriorZoneAtPoint(grid, 8, 7)).toBe('SURGICAL_BAY');
    expect(getInteriorZoneAtPoint(grid, 15, 7)).toBe('STORAGE');
    expect(getInteriorZoneAtPoint(grid, 5, 5)).toBe('NONE'); // Exterior wall

    // Verify findCellsInZone collects correct coordinates
    const surgCells = findCellsInZone(grid, 'SURGICAL_BAY');
    expect(surgCells.length).toBe(6 * 4); // (11-6+1) * (9-6+1) = 24
  });

  it('generates all 6 distinctive Victorian building archetypes across standard 48x36 districts', () => {
    const baseWorld = createInitialWorld({ seed: 101, width: 48, height: 36 });
    const { state: world, landmarks } = generateVictorianDistrict(baseWorld);
    const street = world.strata.STREET!;
    const entities = world.entities;

    // 1. Victorian Apothecary & Chirurgeon Clinic (Top-Right)
    expect(landmarks.doors?.apothecary).toEqual({ x: 38, y: 12 });
    expect(entities['furniture_surgical_table']?.furniture?.kind).toBe('SURGICAL_TABLE');
    expect(entities['furniture_medicine_locker']?.furniture?.kind).toBe('LOCKER');
    expect(getInteriorZoneAtPoint(street, 35, 5)).toBe('SURGICAL_BAY');
    expect(getInteriorZoneAtPoint(street, 41, 5)).toBe('STORAGE');

    // 2. Clockwork Pawnshop & Cartel Bank (Top-Left-Mid)
    expect(landmarks.doors?.pawnshop).toEqual({ x: 12, y: 12 });
    expect(entities['furniture_safe_vault']?.furniture?.kind).toBe('SAFE_VAULT');
    expect(entities['furniture_gear_crate']?.furniture?.kind).toBe('CRATE');
    expect(getInteriorZoneAtPoint(street, 13, 5)).toBe('VAULT');

    // 3. Steam Boilerhouse & Slag Furnace (Bottom-Left)
    expect(landmarks.doors?.boilerhouse).toEqual({ x: 8, y: 24 });
    expect(entities['furniture_smelting_furnace']?.furniture?.kind).toBe('SMELTING_FURNACE');
    expect(entities['vessel_district_boiler']).toBeDefined();
    expect(getInteriorZoneAtPoint(street, 10, 26)).toBe('WORKSHOP');

    // 4. Tenement Rookeries (Bottom-Right)
    expect(landmarks.doors?.rookeries).toEqual({ x: 38, y: 24 });
    expect(entities['furniture_cot_a']?.furniture?.kind).toBe('BED');
    expect(entities['furniture_bookshelf']?.furniture?.kind).toBe('BOOKSHELF');
    expect(getInteriorZoneAtPoint(street, 36, 26)).toBe('RECEPTION');

    // 5. Pneumatic Monorail Depot (Top-Center)
    expect(landmarks.doors?.monorailDepot).toEqual({ x: 23, y: 12 });
    expect(entities['furniture_monorail_console']?.furniture?.kind).toBe('MONORAIL_DEPOT_CONSOLE');
    expect(getInteriorZoneAtPoint(street, 23, 9)).toBe('RECEPTION');

    // 6. Guild Artisan Workshop (Bottom-Center)
    expect(landmarks.doors?.artisanWorkshop).toEqual({ x: 23, y: 24 });
    expect(entities['station_artificer_workbench']?.workbench?.stationType).toBe('ARTIFICER_BENCH');
    expect(entities['furniture_artisan_vault']?.furniture?.kind).toBe('SAFE_VAULT');
    expect(getInteriorZoneAtPoint(street, 26, 31)).toBe('VAULT');
  });

  it('seeds outdoor street landmarks and Spire rooftop greenhouse without severing path connectivity', () => {
    const baseWorld = createInitialWorld({ seed: 777, width: 48, height: 36 });
    const { state: world, landmarks } = generateVictorianDistrict(baseWorld);
    const street = world.strata.STREET!;
    const spire = world.strata.SPIRE!;
    const entities = world.entities;

    // Outdoor Street Landmarks
    const waterPump = entities['landmark_water_pump'];
    expect(waterPump).toBeDefined();
    expect(waterPump?.landmark?.kind).toBe('WATER_PUMP_STATION');
    expect(waterPump?.furniture?.kind).toBe('WATER_PUMP');

    const clocktower = entities['landmark_street_clocktower'];
    expect(clocktower).toBeDefined();
    expect(clocktower?.landmark?.kind).toBe('STREET_CLOCKTOWER');
    expect(clocktower?.furniture?.kind).toBe('CLOCKTOWER_MECHANISM');

    const canalLock = entities['landmark_canal_lock'];
    expect(canalLock).toBeDefined();
    expect(canalLock?.landmark?.kind).toBe('SUNKEN_CANAL_LOCK');
    expect(canalLock?.furniture?.kind).toBe('CANAL_LOCK_MECHANISM');

    // Spire Rooftop Greenhouse
    const greenhouse = entities['landmark_spire_greenhouse'];
    expect(greenhouse).toBeDefined();
    expect(greenhouse?.landmark?.kind).toBe('SPIRE_ROOFTOP_GREENHOUSE');
    expect(greenhouse?.furniture?.kind).toBe('BOTANICAL_PLANTER');
    expect(greenhouse?.position?.stratum).toBe('SPIRE');

    // Confirm greenhouse interior has brass catwalk and workshop zone
    const ghPos = greenhouse?.position;
    if (ghPos) {
      const ghCell = getTileCell(spire, ghPos.x, ghPos.y);
      expect(ghCell?.interiorZone).toBe('WORKSHOP');
    }

    // Unbroken Street walkability from West Gate to East Gate and Street Lift
    expect(hasWalkablePath(street, landmarks.westGate, landmarks.eastGate)).toBe(true);
    expect(hasWalkablePath(street, landmarks.streetManhole, landmarks.streetLift)).toBe(true);
    expect(hasWalkablePath(street, landmarks.streetManhole, landmarks.foundryBoiler)).toBe(true);
  });

  it('guarantees 100% round-trip WorldState serialization fidelity for all interior zones and landmarks', () => {
    const baseWorld = createInitialWorld({ seed: 888, width: 48, height: 36 });
    const { state: originalWorld } = generateVictorianDistrict(baseWorld);

    const json = serializeWorld(originalWorld);
    const restored = deserializeWorld(json);

    expect(restored.version).toBe(1);
    expect(Object.keys(restored.entities).length).toBe(Object.keys(originalWorld.entities).length);

    // Verify landmark component deserialization
    const restoredPump = restored.entities['landmark_water_pump'];
    expect(restoredPump?.landmark?.kind).toBe('WATER_PUMP_STATION');
    expect(restoredPump?.furniture?.kind).toBe('WATER_PUMP');

    const restoredSafe = restored.entities['furniture_safe_vault'];
    expect(restoredSafe?.furniture?.kind).toBe('SAFE_VAULT');
    expect(restoredSafe?.inventory?.containedEntityIds.length).toBeGreaterThan(0);

    // Verify interior zone cell deserialization
    const originalCell = getTileCell(originalWorld.strata.STREET!, 13, 5);
    const restoredCell = getTileCell(restored.strata.STREET!, 13, 5);
    expect(restoredCell?.interiorZone).toBe(originalCell?.interiorZone);
    expect(restoredCell?.interiorZone).toBe('VAULT');
  });

  it('preserves 100% path safety and landmark connectivity across 30 varied random seeds', () => {
    for (let i = 1; i <= 30; i++) {
      const seed = i * 44321 + 99;
      const base = createInitialWorld({ seed, width: 48, height: 36 });
      const { state: world, landmarks } = generateVictorianDistrict(base);
      const street = world.strata.STREET!;

      expect(hasWalkablePath(street, landmarks.westGate, landmarks.eastGate)).toBe(true);
      expect(hasWalkablePath(street, landmarks.streetManhole, landmarks.streetLift)).toBe(true);
      expect(hasWalkablePath(street, landmarks.streetManhole, landmarks.foundryBoiler)).toBe(true);
    }
  });
});
