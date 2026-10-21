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
import { applyPlaytestScenario, getScenarioObjectives } from '../scripts/playtester-scenarios.js';

describe('Headless LLM Playtester Harness', () => {
  const playerId = EntityIdSchema.parse('actor_player');

  function setupWorld() {
    const base = createInitialWorld({ seed: 42, width: 24, height: 24 });
    return generateVictorianDistrict(base).state;
  }

  it('serializes player 11x11 ASCII context with vitals, objectives, and contextual commands', () => {
    const world = setupWorld();
    const context = serializePlayerContext(world, playerId);

    expect(context).toContain('=== AETHER & SOOT');
    expect(context).toContain('Primary Objective:');
    expect(context).toContain('Secondary Directive:');
    expect(context).toContain('[Recent Steps: None]');
    expect(context).toContain('[STRATUM]: STREET');
    expect(context).toContain('[BLOOD]: 100%');
    expect(context).toContain('@'); // Player marker in FOV
    expect(context).toContain('LOCAL SENSORY FOV');
    expect(context).toContain('[AVAILABLE CONTEXTUAL COMMANDS]');

    const customContext = serializePlayerContext(world, playerId, {
      primaryObjective: 'Infiltrate the Clockwork Vault',
      secondaryDirective: 'Silent approach',
      recentPositions: [{ x: 10, y: 12 }, { x: 11, y: 12 }],
      systemFeedback: 'Last action failed. Wall was obstructed.',
    });
    expect(customContext).toContain('Primary Objective: Infiltrate the Clockwork Vault');
    expect(customContext).toContain('Secondary Directive: Silent approach');
    expect(customContext).toContain('[Recent Steps: (10,12), (11,12)]');
    expect(customContext).toContain('[SYSTEM FEEDBACK]: Last action failed. Wall was obstructed.');
  });

  it('parses valid LLM JSON action payloads into canonical GameCommand objects', () => {
    const world = setupWorld();

    const moveRes = parseLlmResponseToCommand(JSON.stringify({ action: 'MOVE', dir: 'E' }), world, playerId);
    expect(moveRes.type).toBe('MOVE_STEP');

    const doorRes = parseLlmResponseToCommand(JSON.stringify({ action: 'TOGGLE_DOOR', dx: 1, dy: 0 }), world, playerId);
    expect(doorRes.type).toBe('TOGGLE_DOOR');

    const steamRes = parseLlmResponseToCommand(JSON.stringify({ action: 'VENT_STEAM', pressureKpa: 45, targetRelX: 0, targetRelY: 0 }), world, playerId);
    expect(steamRes.type).toBe('VENT_STEAM');

    const portalRes = parseLlmResponseToCommand('{"action": "USE_PORTAL"}', world, playerId);
    expect(portalRes.type).toBe('USE_PORTAL');

    const buyRes = parseLlmResponseToCommand('{"action": "BUY", "merchantId": "npc_guild_merchant", "itemId": "loot_tonic"}', world, playerId);
    expect(buyRes.type).toBe('BUY_FROM_MERCHANT');

    const pickupRes = parseLlmResponseToCommand('{"action": "PICK_UP", "itemId": "item_123"}', world, playerId);
    expect(pickupRes.type).toBe('PICK_UP_ITEM');

    // Handles markdown fences and malformed input with safe fallback
    const malformed = parseLlmResponseToCommand('```json\n{ "invalid": true }\n```', world, playerId);
    expect(malformed.type).toBe('WAIT_TURN');

    // Tests resilient LLM output variations observed in local Hermes sessions
    const dirNorth = parseLlmResponseToCommand('{"action": "MOVE", "direction": "NORTH"}', world, playerId);
    expect(dirNorth).toEqual({ type: 'MOVE_STEP', actorId: playerId, dx: 0, dy: -1 });

    const deltaObj = parseLlmResponseToCommand('MOVE {"dx": 1, "dy": 0}', world, playerId);
    expect(deltaObj).toEqual({ type: 'MOVE_STEP', actorId: playerId, dx: 1, dy: 0 });

    const textVector = parseLlmResponseToCommand('MOVE 0 1', world, playerId);
    expect(textVector).toEqual({ type: 'MOVE_STEP', actorId: playerId, dx: 0, dy: 1 });

    const textDirection = parseLlmResponseToCommand('MOVE: "w"', world, playerId);
    expect(textDirection).toEqual({ type: 'MOVE_STEP', actorId: playerId, dx: -1, dy: 0 });

    const caseInsensitiveDoor = parseLlmResponseToCommand('{"action": "toggle_door", "dx": -1, "dy": 0}', world, playerId);
    expect(caseInsensitiveDoor.type).toBe('TOGGLE_DOOR');

    const coordPair = parseLlmResponseToCommand('MOVE: 26, 15', world, playerId);
    expect(coordPair.type).toBe('MOVE_STEP');

    // Tests mock action generation
    const mockAction = generateMockAction(world, playerId);
    expect(['MOVE', 'WAIT', 'ATTACK', 'TOGGLE_DOOR', 'VENT_STEAM', 'USE_PORTAL', 'BUY']).toContain(mockAction.action);
  });

  it('configures distinct gameplay scenarios via applyPlaytestScenario', () => {
    const world = setupWorld();

    const combatWorld = applyPlaytestScenario(world, 'combat');
    const player = combatWorld.entities[playerId]!;
    expect(player.anatomy?.steamReserveKpa).toBe(100);
    const warden = combatWorld.entities['npc_clockwork_warden']!;
    expect(warden.aiController?.hostile).toBe(true);
    expect(warden.aiController?.alertState).toBe('COMBAT');

    const economyWorld = applyPlaytestScenario(world, 'economy');
    const ecoPlayer = economyWorld.entities[playerId]!;
    expect(economyWorld.economy.playerTreasuryPence).toBe(500);
    expect(ecoPlayer.anatomy?.bloodVolumePct).toBe(70);
    expect(economyWorld.entities['npc_guild_merchant']).toBeDefined();

    const transitWorld = applyPlaytestScenario(world, 'transit');
    expect(transitWorld.entities['env_transit_trap']?.trap?.armed).toBe(true);
    expect(transitWorld.entities['env_transit_stairs_down']?.portal).toBeDefined();

    const objs = getScenarioObjectives('combat');
    expect(objs.primary).toContain('hostile');
  });

  it('runs deterministic mock playtest session across scenarios and outputs report', async () => {
    const reportPath = path.join(process.cwd(), 'tests/artifacts/test-playtest-report.md');
    const metrics = await runPlaytestSession({
      mock: true,
      maxTurns: 25,
      seed: 123,
      endpoint: 'http://localhost:11434/api/generate',
      model: 'test-model',
      reportPath,
      scenario: 'combat',
    });

    expect(metrics.turnsSurvived).toBeGreaterThan(0);
    expect(metrics.uniqueTilesVisited).toBeGreaterThanOrEqual(1);
    expect(metrics.hostilesAttacked).toBeGreaterThanOrEqual(1);
    expect(metrics.damageDealt).toBeGreaterThan(0);
    expect(fs.existsSync(reportPath)).toBe(true);

    const reportContent = fs.readFileSync(reportPath, 'utf-8');
    expect(reportContent).toContain('Emergent Sandbox Mechanics Metrics');
    expect(reportContent).toContain('Deterministic Mock Agent');
    expect(reportContent).toContain('Unique Tiles Visited');
    expect(reportContent).toContain('Hostiles Attacked');

    // Cleanup test artifact
    fs.unlinkSync(reportPath);
  });
});

