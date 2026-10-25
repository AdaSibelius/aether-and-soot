import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  generateScaffoldCode,
  parseScaffoldArgs,
  runScaffold,
  toPascalCase,
} from '../scripts/scaffold-mechanic.js';

describe('Standardized Mechanic Scaffolder (Phase 51)', () => {
  const rootDir = path.resolve(__dirname, '../..');

  it('parses CLI arguments correctly', () => {
    const config = parseScaffoldArgs([
      'node', 'script.js',
      '--domain', 'hazards',
      '--command', 'VENT_STEAM_TRAP',
      '--event', 'STEAM_TRAP_VENTED',
      '--dry-run',
    ]);

    expect(config.domain).toBe('hazards');
    expect(config.command).toBe('VENT_STEAM_TRAP');
    expect(config.event).toBe('STEAM_TRAP_VENTED');
    expect(config.dryRun).toBe(true);
  });

  it('converts snake_case to PascalCase', () => {
    expect(toPascalCase('hazards')).toBe('Hazards');
    expect(toPascalCase('VENT_STEAM_TRAP')).toBe('VentSteamTrap');
    expect(toPascalCase('environmental-agency')).toBe('EnvironmentalAgency');
  });

  it('generates schema, system, and test code compliant with architectural rules', () => {
    const code = generateScaffoldCode({
      domain: 'hazards',
      command: 'VENT_STEAM_TRAP',
      event: 'STEAM_TRAP_VENTED',
      dryRun: true,
      mock: true,
    });

    expect(code.commandSchemaRel).toBe('src/schemas/hazards-commands.schema.ts');
    expect(code.commandSchemaCode).toContain("type: z.literal('VENT_STEAM_TRAP')");
    expect(code.commandSchemaCode).toContain('VentSteamTrapCommandSchema');

    expect(code.eventSchemaRel).toBe('src/schemas/hazards-events.schema.ts');
    expect(code.eventSchemaCode).toContain("type: z.literal('STEAM_TRAP_VENTED')");

    expect(code.systemRel).toBe('src/sim/systems/hazards.system.ts');
    expect(code.systemCode).toContain('export function resolveVentSteamTrap');
    expect(code.systemCode).toContain('STANDARD_ACTION_AP');

    expect(code.testRel).toBe('tests/sim/hazards.test.ts');
    expect(code.testCode).not.toContain('any');
    expect(code.testCode).not.toContain('@ts-ignore');
  });

  it('executes a safe dry-run without writing files to disk', async () => {
    const config = parseScaffoldArgs([
      'node', 'script.js',
      '--domain', 'test_sandbox',
      '--command', 'TRIGGER_TEST',
      '--event', 'TEST_TRIGGERED',
      '--dry-run',
    ]);

    await expect(runScaffold(config, rootDir)).resolves.not.toThrow();
  });
});
