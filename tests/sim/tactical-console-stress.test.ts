import { describe, expect, it } from 'vitest';
import { createUiCellBuffer } from '../../src/client/canvas-ui/cell-buffer.js';
import { renderTacticalConsole } from '../../src/client/canvas-ui/tactical-console.js';
import { EntityIdSchema } from '../../src/schemas/primitives.schema.js';
import { SimEvent } from '../../src/schemas/events.schema.js';
import { createInitialWorld } from '../../src/sim/core/world.js';

describe('Challenger M1: Tactical Console Adversarial Stress Testing', () => {
  const playerId = EntityIdSchema.parse('actor_player');
  const CONSOLE_RECT = { x: 58, y: 0, width: 30, height: 36 };
  const SLOTS = ['HEAD', 'TORSO', 'LEFT_ARM', 'RIGHT_ARM', 'LEFT_LEG', 'RIGHT_LEG'] as const;

  function createSentinelBuffer(width = 88, height = 36) {
    return createUiCellBuffer(width, height, { glyph: '~', fg: '#333333', bg: '#000000' });
  }

  function assertNoBufferOverflowOutsideConsole(buf: ReturnType<typeof createSentinelBuffer>) {
    for (let y = 0; y < buf.height; y++) {
      for (let x = 0; x < 58; x++) {
        expect(buf.getCell(x, y)?.glyph, `Buffer clobbered at left (${x},${y})`).toBe('~');
      }
      for (let x = 88; x < buf.width; x++) {
        expect(buf.getCell(x, y)?.glyph, `Buffer clobbered at right (${x},${y})`).toBe('~');
      }
    }
  }

  function assertNoNanOrUndefinedStringLeaks(buf: ReturnType<typeof createSentinelBuffer>) {
    for (let y = 0; y < 36; y++) {
      const row = buf.extractRowString(y).slice(58, 88);
      expect(row).not.toMatch(/NaN|undefined|\[object/i);
    }
  }

  it('stress-tests extreme limb edge cases: 0 limbs, amputated, 100% prosthetics, extreme HP', () => {
    const state = createInitialWorld({ seed: 101 });
    const player = state.entities[playerId]!;

    // Scenario A: 0 limbs in anatomy
    player.anatomy = { ...player.anatomy!, limbs: {} };
    const bufA = createSentinelBuffer();
    expect(() => renderTacticalConsole(bufA, CONSOLE_RECT, state, playerId)).not.toThrow();
    assertNoBufferOverflowOutsideConsole(bufA);
    assertNoNanOrUndefinedStringLeaks(bufA);

    // Scenario B: 100% Prosthetic Limbs & negative HP
    const prostheticLimbs: Record<string, any> = {};
    for (const slot of SLOTS) {
      prostheticLimbs[slot] = { slot, hp: -25, maxHp: 100, amputated: false, installedProstheticEntityId: EntityIdSchema.parse(`prosthetic_${slot.toLowerCase()}`) };
    }
    player.anatomy = { ...player.anatomy!, limbs: prostheticLimbs, toxicityPct: 90, painShock: 85, stamina: 10 };
    const bufB = createSentinelBuffer();
    expect(() => renderTacticalConsole(bufB, CONSOLE_RECT, state, playerId)).not.toThrow();
    assertNoBufferOverflowOutsideConsole(bufB);
    assertNoNanOrUndefinedStringLeaks(bufB);
    const paperdollText = [19, 20, 21, 22, 23, 24].map((r) => bufB.extractRowString(r)).join('\n');
    expect(paperdollText).toContain('⚙');
    expect(paperdollText).toContain('TOX:90%');
    expect(paperdollText).toContain('PAIN:85');

    // Scenario C: High 4-digit HP (9999 HP) preserves border
    for (const slot of SLOTS) {
      prostheticLimbs[slot] = { slot, hp: 9999, maxHp: 50, amputated: false };
    }
    const bufC = createSentinelBuffer(90, 36);
    expect(() => renderTacticalConsole(bufC, CONSOLE_RECT, state, playerId)).not.toThrow();
    assertNoBufferOverflowOutsideConsole(bufC);
    assertNoNanOrUndefinedStringLeaks(bufC);
    expect(bufC.getCell(87, 21)?.glyph, 'Border preserved').toBe('║');

    // Scenario D: Hardened limb HP >= 999,999 preserves border and prevents buffer overflow
    for (const slot of SLOTS) prostheticLimbs[slot] = { slot, hp: 999999, maxHp: 50, amputated: false };
    const bufD = createSentinelBuffer(90, 36);
    expect(() => renderTacticalConsole(bufD, CONSOLE_RECT, state, playerId)).not.toThrow();
    expect(bufD.getCell(87, 21)?.glyph, 'Col 87 border preserved under 6-digit HP').toBe('║');
    assertNoBufferOverflowOutsideConsole(bufD);
    assertNoNanOrUndefinedStringLeaks(bufD);

    for (const slot of SLOTS) prostheticLimbs[slot] = { slot, hp: 9999999, maxHp: 50, amputated: false };
    player.anatomy = { ...player.anatomy!, stamina: 999999, toxicityPct: 999999, painShock: 999999 };
    const bufE = createSentinelBuffer(90, 36);
    expect(() => renderTacticalConsole(bufE, CONSOLE_RECT, state, playerId)).not.toThrow();
    for (let r = 19; r <= 24; r++) {
      expect(bufE.getCell(87, r)?.glyph, `Paperdoll row ${r} border preserved under extreme values`).toBe('║');
    }
    assertNoBufferOverflowOutsideConsole(bufE);
    assertNoNanOrUndefinedStringLeaks(bufE);
  });

  it('stress-tests extreme inventory mass and volume overload & empty inventory', () => {
    const state = createInitialWorld({ seed: 202 });
    const player = state.entities[playerId]!;

    // Scenario A: 500,000g mass overload (20x capacity) and 1,000,000ml volume overload
    player.inventory = {
      ...player.inventory!,
      currentMassGrams: 500_000, maxMassGrams: 25_000, maxVolumeMl: 30_000,
      containedEntityIds: [EntityIdSchema.parse('nonexistent_item_1')],
      equippedSlots: { WIELD: EntityIdSchema.parse('nonexistent_weapon') },
    };

    const bufA = createSentinelBuffer();
    expect(() => renderTacticalConsole(bufA, CONSOLE_RECT, state, playerId)).not.toThrow();
    assertNoBufferOverflowOutsideConsole(bufA);
    assertNoNanOrUndefinedStringLeaks(bufA);
    expect(bufA.extractRowString(14)).toContain('500.0/25k');
    expect(bufA.extractRowString(15)).toContain('VOL: ');
    expect(bufA.extractRowString(16)).toContain('WIELD:');

    // Scenario B: Empty inventory
    player.inventory = { currentMassGrams: 0, maxMassGrams: 25_000, maxVolumeMl: 30_000, containedEntityIds: [] };
    const bufB = createSentinelBuffer();
    expect(() => renderTacticalConsole(bufB, CONSOLE_RECT, state, playerId)).not.toThrow();
    assertNoBufferOverflowOutsideConsole(bufB);
    assertNoNanOrUndefinedStringLeaks(bufB);
    expect(bufB.extractRowString(16)).toContain('WIELD: Bare Hands');
    expect(bufB.extractRowString(17)).toContain('PACK: 0 items');
  });

  it('stress-tests extreme thermodynamic stress, soot PPM > 500, steam kPa > 200', () => {
    const state = createInitialWorld({ seed: 303 });
    const player = state.entities[playerId]!;

    player.anatomy = {
      ...player.anatomy!,
      strainLoadKw: 350, governorCapacityKw: 100, steamReserveKpa: 250, maxSteamReserveKpa: 100, bloodVolumePct: 15,
    };

    const pos = player.position!;
    const grid = state.strata[pos.stratum]!;
    const cell = grid.cells[pos.y * grid.width + pos.x]!;
    cell.smokePpm = 650;
    cell.steamPressureKpa = 240;

    const buf = createSentinelBuffer();
    expect(() => renderTacticalConsole(buf, CONSOLE_RECT, state, playerId)).not.toThrow();
    assertNoBufferOverflowOutsideConsole(buf);
    assertNoNanOrUndefinedStringLeaks(buf);
    expect(buf.extractRowString(10)).toContain('350/100kW');
    expect(buf.extractRowString(11)).toContain('SOOT:650PPM');
    expect(buf.extractRowString(11)).toContain('STM:240kPa');
    expect(buf.extractRowString(12)).toContain('ATM:[TOXIC]');
  });

  it('stress-tests rapid event logs: empty, 1 event, 1,000 rapid event stream, and unhandled event crash', () => {
    const state = createInitialWorld({ seed: 404 });

    // Scenario A: Empty event log
    state.eventLog = [];
    const bufA = createSentinelBuffer();
    renderTacticalConsole(bufA, CONSOLE_RECT, state, playerId);
    expect(bufA.extractRowString(26)).toContain('Awaiting telegraph');

    // Scenario B: Exactly 1 event
    state.eventLog = [
      { type: 'STEAM_VENTED', turn: 1, actorId: playerId, pressureReleasedKpa: 50 } as SimEvent,
    ];
    const bufB = createSentinelBuffer();
    renderTacticalConsole(bufB, CONSOLE_RECT, state, playerId);
    expect(bufB.extractRowString(29)).toContain('Vented 50 kPa');

    // Scenario C: 1,000 rapid movement & combat events
    const rapidEvents: SimEvent[] = [];
    for (let i = 0; i < 1000; i++) {
      rapidEvents.push({
        type: 'ENTITY_MOVED', turn: Math.floor(i / 10), actorId: playerId,
        from: { x: (i % 20), y: 10, stratum: 'STREET' }, to: { x: ((i + 1) % 20), y: 10, stratum: 'STREET' },
        apSpent: 100,
      });
    }
    state.eventLog = rapidEvents;

    const startTime = performance.now();
    const bufC = createSentinelBuffer();
    expect(() => renderTacticalConsole(bufC, CONSOLE_RECT, state, playerId)).not.toThrow();
    const durationMs = performance.now() - startTime;
    expect(durationMs).toBeLessThan(100);
    assertNoBufferOverflowOutsideConsole(bufC);
    assertNoNanOrUndefinedStringLeaks(bufC);
    expect(bufC.extractRowString(29)).toContain('Traversed');

    // Scenario D: Resilient chronicle ticker: unhandled/malformed simulation events never crash
    state.eventLog = [
      { type: 'NONEXISTENT_EVENT_TYPE', turn: 1 } as any, undefined as any, null as any, { type: 'UNKNOWN_FUTURE_EVENT', turn: 5 } as any,
    ];
    const bufD = createSentinelBuffer(90, 36);
    expect(() => renderTacticalConsole(bufD, CONSOLE_RECT, state, playerId)).not.toThrow();
    assertNoBufferOverflowOutsideConsole(bufD);
    assertNoNanOrUndefinedStringLeaks(bufD);
    const tickerText = [26, 27, 28, 29].map((r) => bufD.extractRowString(r)).join('\n');
    expect(tickerText).not.toContain('undefined');
    expect(tickerText).not.toContain('null');
    expect(tickerText).toContain('Telegraph dispatch');
  });

  it('stress-tests tactical vernier hover coordinates: null and extreme out-of-bounds', () => {
    const state = createInitialWorld({ seed: 505 });

    // Scenario A: Null hover coord
    const bufA = createSentinelBuffer();
    expect(() => renderTacticalConsole(bufA, CONSOLE_RECT, state, playerId, { hoveredTile: null })).not.toThrow();
    assertNoBufferOverflowOutsideConsole(bufA);
    assertNoNanOrUndefinedStringLeaks(bufA);

    // Scenario B: Negative out-of-bounds
    const bufB = createSentinelBuffer();
    expect(() => renderTacticalConsole(bufB, CONSOLE_RECT, state, playerId, { hoveredTile: { x: -999, y: -999 } })).not.toThrow();
    assertNoBufferOverflowOutsideConsole(bufB);
    assertNoNanOrUndefinedStringLeaks(bufB);
    expect(bufB.extractRowString(31)).toContain('COORD:(-999,-999)');

    // Scenario C: Positive massive out-of-bounds
    const bufC = createSentinelBuffer();
    expect(() => renderTacticalConsole(bufC, CONSOLE_RECT, state, playerId, { hoveredTile: { x: 88888, y: 99999 } })).not.toThrow();
    assertNoBufferOverflowOutsideConsole(bufC);
    assertNoNanOrUndefinedStringLeaks(bufC);
    expect(bufC.extractRowString(31)).toContain('COORD:(88888,99999)');
  });
});
