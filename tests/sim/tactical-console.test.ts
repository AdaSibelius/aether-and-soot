import { describe, expect, it } from 'vitest';
import { EntityIdSchema } from '../../src/schemas/primitives.schema.js';
import { createInitialWorld } from '../../src/sim/core/world.js';
import { createUiCellBuffer } from '../../src/client/canvas-ui/cell-buffer.js';
import { drawAtmosphericBarometer } from '../../src/client/canvas-ui/analog-gauges.js';
import { renderConsoleSatchel } from '../../src/client/canvas-ui/console-satchel.js';
import { renderPneumaticTickerChronicle } from '../../src/client/canvas-ui/console-chronicle.js';
import { renderTacticalConsole } from '../../src/client/canvas-ui/tactical-console.js';

describe('Tactical Console & Diegetic Gauges', () => {
  const playerId = EntityIdSchema.parse('actor_player');

  it('renders all 7 instrument tiers within the 30-column console', () => {
    const buf = createUiCellBuffer(88, 36);
    const state = createInitialWorld({ seed: 42 });

    renderTacticalConsole(buf, { x: 58, y: 0, width: 30, height: 36 }, state, playerId);

    // Verify Bezel Header and Bottom Nav
    expect(buf.extractRowString(0)).toContain('AETHER & SOOT CONSOLE');
    const bottomRow = buf.extractRowString(35);
    expect(bottomRow).toContain('[I]NV');
    expect(bottomRow).toContain('[A]NAT');
    expect(bottomRow).toContain('[C]RFT');
    expect(bottomRow).toContain('[ESC]');

    // Verify presence of structural dividers
    expect(buf.getCell(58, 3)?.glyph).toBe('╠');
    expect(buf.getCell(87, 3)?.glyph).toBe('╣');
    expect(buf.getCell(58, 9)?.glyph).toBe('╠');
    expect(buf.getCell(58, 13)?.glyph).toBe('╠');
    expect(buf.getCell(58, 18)?.glyph).toBe('╠');
    expect(buf.getCell(58, 25)?.glyph).toBe('╠');
    expect(buf.getCell(58, 30)?.glyph).toBe('╠');
  });

  it('formats thermodynamic stress and atmospheric barometer correctly', () => {
    const buf = createUiCellBuffer(30, 4);
    drawAtmosphericBarometer(buf, 0, 0, 26, 42, 100, 40, 85, 'ELEVATED');

    const row0 = buf.extractRowString(0);
    const row1 = buf.extractRowString(1);
    const row2 = buf.extractRowString(2);

    expect(row0).toContain('STR:');
    expect(row0).toContain('42/100kW');
    expect(row1).toContain('SOOT:85PPM');
    expect(row1).toContain('STM:40kPa');
    expect(row2).toContain('ATM:[SMOKY]');
    expect(row2).toContain('THM:[ELEVATED]');
  });

  it('renders satchel mass and volume gauges with overload indicator', () => {
    const buf = createUiCellBuffer(30, 4);
    const state = createInitialWorld({ seed: 42 });

    renderConsoleSatchel(buf, 0, 0, 26, state, playerId);

    const row0 = buf.extractRowString(0);
    const row1 = buf.extractRowString(1);
    const row2 = buf.extractRowString(2);
    const row3 = buf.extractRowString(3);

    expect(row0).toContain('MASS:');
    expect(row1).toContain('VOL: ');
    expect(row2).toMatch(/(?:WIELD|TOP):/);
    expect(row3).toContain('PACK:');
  });

  it('renders pneumatic ticker chronicle with typewriter ink entries', () => {
    const buf = createUiCellBuffer(30, 4);
    const state = createInitialWorld({ seed: 42 });

    renderPneumaticTickerChronicle(buf, 0, 0, 26, 4, state);

    // When empty, shows awaiting telegraph
    expect(buf.extractRowString(0)).toContain('Awaiting telegraph');
  });
});
