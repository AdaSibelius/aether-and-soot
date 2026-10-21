import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { EntityIdSchema } from '../../src/schemas/primitives.schema.js';
import { createInitialWorld } from '../../src/sim/core/world.js';
import { generateVictorianDistrict } from '../../src/sim/spatial/generator.js';
import {
  generateMockAction,
  parseLlmResponseToCommand,
  serializePlayerContext,
} from '../scripts/playtester-serializer.js';
import { runPlaytestSession } from '../scripts/llm-playtester.js';

describe('Headless LLM Playtester Harness', () => {
  const playerId = EntityIdSchema.parse('actor_player');

  function setupWorld() {
    const base = createInitialWorld({ seed: 42, width: 24, height: 24 });
    return generateVictorianDistrict(base).state;
  }

  it('serializes player 11x11 ASCII context with vitals and shift clock', () => {
    const world = setupWorld();
    const context = serializePlayerContext(world, playerId);

    expect(context).toContain('=== AETHER & SOOT');
    expect(context).toContain('[STRATUM]: STREET');
    expect(context).toContain('[BLOOD]: 100%');
    expect(context).toContain('@'); // Player marker in FOV
    expect(context).toContain('LOCAL SENSORY FOV');
  });

  it('parses valid LLM JSON action payloads into canonical GameCommand objects', () => {
    const world = setupWorld();

    const moveRes = parseLlmResponseToCommand(
      JSON.stringify({ action: 'MOVE', dir: 'E' }),
      world,
      playerId,
    );
    expect(moveRes.type).toBe('MOVE_STEP');
    if (moveRes.type === 'MOVE_STEP') {
      expect(moveRes.dx).toBe(1);
      expect(moveRes.dy).toBe(0);
    }

    const doorRes = parseLlmResponseToCommand(
      JSON.stringify({ action: 'TOGGLE_DOOR', dx: 1, dy: 0 }),
      world,
      playerId,
    );
    expect(doorRes.type).toBe('TOGGLE_DOOR');

    const steamRes = parseLlmResponseToCommand(
      JSON.stringify({ action: 'VENT_STEAM', pressureKpa: 45, targetRelX: 0, targetRelY: 0 }),
      world,
      playerId,
    );
    expect(steamRes.type).toBe('VENT_STEAM');

    // Handles markdown fences and malformed input with safe fallback
    const malformed = parseLlmResponseToCommand('```json\n{ "invalid": true }\n```', world, playerId);
    expect(malformed.type).toBe('WAIT_TURN');

    // Tests mock action generation
    const mockAction = generateMockAction(world, playerId);
    expect(['MOVE', 'WAIT', 'ATTACK', 'TOGGLE_DOOR', 'VENT_STEAM']).toContain(mockAction.action);
  });

  it('runs deterministic mock playtest session and outputs report', async () => {
    const reportPath = path.join(process.cwd(), 'tests/artifacts/test-playtest-report.md');
    const metrics = await runPlaytestSession({
      mock: true,
      maxTurns: 25,
      seed: 123,
      endpoint: 'http://localhost:11434/api/generate',
      model: 'test-model',
      reportPath,
    });

    expect(metrics.turnsSurvived).toBe(25);
    expect(metrics.totalDecibels).toBeGreaterThanOrEqual(0);
    expect(fs.existsSync(reportPath)).toBe(true);

    const reportContent = fs.readFileSync(reportPath, 'utf-8');
    expect(reportContent).toContain('Emergent Sandbox Mechanics Metrics');
    expect(reportContent).toContain('Deterministic Mock Agent');

    // Cleanup test artifact
    fs.unlinkSync(reportPath);
  });
});
