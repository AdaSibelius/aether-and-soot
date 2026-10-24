import { describe, expect, it } from 'vitest';
import { resolveInspectedTileCoord } from '../../src/client/client-interactions.js';
import { getEmptyTileDescriptor } from '../../src/client/ui/TileInspectorPanel.js';
import { aggregateChronicleEvents } from '../../src/client/ui/EventFormatter.js';
import { SimEvent } from '../../src/schemas/events.schema.js';
import { EntityIdSchema, FactionIdSchema } from '../../src/schemas/primitives.schema.js';

describe('Phase 2.2: Unified Look Mode State, Tile Inspector Descriptors, and Chronicle Folding', () => {
  describe('resolveInspectedTileCoord', () => {
    it('prioritizes look cursor coordinates when Look Mode is active, preventing split-brain', () => {
      const mouseCoord = { x: 13, y: 22 };
      const lookCoord = { x: 19, y: 19 };

      // Look mode active: should select lookCoord (19, 19) over mouse (13, 22)
      const inspected = resolveInspectedTileCoord(true, lookCoord, mouseCoord);
      expect(inspected).toEqual({ x: 19, y: 19 });
    });

    it('falls back to mouse hover coordinates when Look Mode is inactive', () => {
      const mouseCoord = { x: 13, y: 22 };
      const lookCoord = { x: 19, y: 19 };

      const inspected = resolveInspectedTileCoord(false, lookCoord, mouseCoord);
      expect(inspected).toEqual({ x: 13, y: 22 });
    });

    it('handles null coordinates gracefully', () => {
      expect(resolveInspectedTileCoord(true, null, { x: 10, y: 10 })).toBeNull();
      expect(resolveInspectedTileCoord(false, { x: 10, y: 10 }, null)).toBeNull();
    });
  });

  describe('getEmptyTileDescriptor', () => {
    it('returns "Solid soot-stained brickwork." for SOOT_BRICK_WALL', () => {
      expect(getEmptyTileDescriptor('SOOT_BRICK_WALL')).toBe('Solid soot-stained brickwork.');
    });

    it('returns "Unoccupied cobblestones." on open street and floor tiles', () => {
      expect(getEmptyTileDescriptor('COBBLESTONE_FLOOR')).toBe('Unoccupied cobblestones.');
      expect(getEmptyTileDescriptor('STREET')).toBe('Unoccupied cobblestones.');
      expect(getEmptyTileDescriptor(undefined)).toBe('Unoccupied cobblestones.');
    });
  });

  describe('aggregateChronicleEvents', () => {
    const actorId = EntityIdSchema.parse('actor_player');

    it('collapses 5 consecutive steps West into a single traversal line', () => {
      const events: SimEvent[] = [
        { type: 'ENTITY_MOVED', turn: 1, actorId, from: { x: 24, y: 18, stratum: 'STREET' }, to: { x: 23, y: 18, stratum: 'STREET' }, apSpent: 100 },
        { type: 'ENTITY_MOVED', turn: 2, actorId, from: { x: 23, y: 18, stratum: 'STREET' }, to: { x: 22, y: 18, stratum: 'STREET' }, apSpent: 100 },
        { type: 'ENTITY_MOVED', turn: 3, actorId, from: { x: 22, y: 18, stratum: 'STREET' }, to: { x: 21, y: 18, stratum: 'STREET' }, apSpent: 100 },
        { type: 'ENTITY_MOVED', turn: 4, actorId, from: { x: 21, y: 18, stratum: 'STREET' }, to: { x: 20, y: 18, stratum: 'STREET' }, apSpent: 100 },
        { type: 'ENTITY_MOVED', turn: 5, actorId, from: { x: 20, y: 18, stratum: 'STREET' }, to: { x: 19, y: 18, stratum: 'STREET' }, apSpent: 100 },
      ];

      const lines = aggregateChronicleEvents(events);
      expect(lines).toHaveLength(1);
      expect(lines[0]).toBe('[T1–T5] Traversed 5m West to (19, 18) on STREET [500 AP]');
    });

    it('preserves a single step without folding into a range', () => {
      const events: SimEvent[] = [
        { type: 'ENTITY_MOVED', turn: 1, actorId, from: { x: 24, y: 18, stratum: 'STREET' }, to: { x: 23, y: 18, stratum: 'STREET' }, apSpent: 100 },
      ];

      const lines = aggregateChronicleEvents(events);
      expect(lines).toHaveLength(1);
      expect(lines[0]).toBe('[T1] Stepped to (23, 18) on STREET [100 AP]');
    });

    it('handles other cardinal directions correctly', () => {
      const northSteps: SimEvent[] = [
        { type: 'ENTITY_MOVED', turn: 10, actorId, from: { x: 10, y: 15, stratum: 'STREET' }, to: { x: 10, y: 14, stratum: 'STREET' }, apSpent: 100 },
        { type: 'ENTITY_MOVED', turn: 11, actorId, from: { x: 10, y: 14, stratum: 'STREET' }, to: { x: 10, y: 13, stratum: 'STREET' }, apSpent: 100 },
      ];
      const northLines = aggregateChronicleEvents(northSteps);
      expect(northLines[0]).toBe('[T10–T11] Traversed 2m North to (10, 13) on STREET [200 AP]');

      const eastSteps: SimEvent[] = [
        { type: 'ENTITY_MOVED', turn: 20, actorId, from: { x: 5, y: 5, stratum: 'STREET' }, to: { x: 6, y: 5, stratum: 'STREET' }, apSpent: 100 },
        { type: 'ENTITY_MOVED', turn: 21, actorId, from: { x: 6, y: 5, stratum: 'STREET' }, to: { x: 7, y: 5, stratum: 'STREET' }, apSpent: 100 },
        { type: 'ENTITY_MOVED', turn: 22, actorId, from: { x: 7, y: 5, stratum: 'STREET' }, to: { x: 8, y: 5, stratum: 'STREET' }, apSpent: 100 },
      ];
      const eastLines = aggregateChronicleEvents(eastSteps);
      expect(eastLines[0]).toBe('[T20–T22] Traversed 3m East to (8, 5) on STREET [300 AP]');
    });

    it('preserves five-row log budget for combat, steam, and faction alerts when movement collapses', () => {
      const events: SimEvent[] = [
        // 5 consecutive movement events
        { type: 'ENTITY_MOVED', turn: 1, actorId, from: { x: 24, y: 18, stratum: 'STREET' }, to: { x: 23, y: 18, stratum: 'STREET' }, apSpent: 100 },
        { type: 'ENTITY_MOVED', turn: 2, actorId, from: { x: 23, y: 18, stratum: 'STREET' }, to: { x: 22, y: 18, stratum: 'STREET' }, apSpent: 100 },
        { type: 'ENTITY_MOVED', turn: 3, actorId, from: { x: 22, y: 18, stratum: 'STREET' }, to: { x: 21, y: 18, stratum: 'STREET' }, apSpent: 100 },
        { type: 'ENTITY_MOVED', turn: 4, actorId, from: { x: 21, y: 18, stratum: 'STREET' }, to: { x: 20, y: 18, stratum: 'STREET' }, apSpent: 100 },
        { type: 'ENTITY_MOVED', turn: 5, actorId, from: { x: 20, y: 18, stratum: 'STREET' }, to: { x: 19, y: 18, stratum: 'STREET' }, apSpent: 100 },
        // Followed by combat, steam pressure, and faction alert events
        {
          type: 'COMBAT_ATTACK_RESOLVED',
          turn: 6,
          attackerId: actorId,
          targetId: EntityIdSchema.parse('actor_thug'),
          targetSlot: 'TORSO',
          hit: true,
          damageDealt: 14,
        },
        {
          type: 'STEAM_VENTED',
          turn: 7,
          actorId,
          origin: { x: 19, y: 18, stratum: 'STREET' },
          pressureReleasedKpa: 45,
        },
        {
          type: 'WITNESS_CRIME_REPORTED',
          turn: 8,
          witnessId: EntityIdSchema.parse('npc_bystander'),
          perpetratorId: actorId,
          factionId: FactionIdSchema.parse('CROWN_CONSTABULARY'),
          crime: 'TRESPASS',
          reputationPenalty: -10,
        },
      ];

      // Aggregating with maxLines = 5 preserves all distinct event categories without movement monopolizing the log
      const lines = aggregateChronicleEvents(events, 5);
      expect(lines).toHaveLength(4);
      expect(lines[0]).toBe('[T1–T5] Traversed 5m West to (19, 18) on STREET [500 AP]');
      expect(lines[1]).toContain('struck actor_thug');
      expect(lines[2]).toContain('Vented 45 kPa superheated steam!');
      expect(lines[3]).toContain('ALARM! npc_bystander witnessed TRESPASS');
    });
  });
});
