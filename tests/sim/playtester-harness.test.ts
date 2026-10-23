import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { EntityIdSchema } from '../../src/schemas/primitives.schema.js';
import { createInitialWorld } from '../../src/sim/core/world.js';
import { generateVictorianDistrict } from '../../src/sim/spatial/generator.js';
import {
  parseLlmResponseToCommand,
  serializePlayerContext,
  auditClientProjection,
} from '../scripts/playtester-serializer.js';
import { runPlaytestSession } from '../scripts/llm-playtester.js';
import { applyPlaytestScenario, getScenarioObjectives } from '../scripts/playtester-scenarios.js';

describe('Headless LLM Playtester Harness', () => {
  const playerId = EntityIdSchema.parse('actor_player');

  function setupWorld() {
    const base = createInitialWorld({ seed: 42, width: 24, height: 24 });
    return generateVictorianDistrict(base).state;
  }

  it('serializes player context and attaches clientProjectionAudit scanning UI leaks', () => {
    const world = setupWorld();
    const context = serializePlayerContext(world, playerId, {
      lookCursor: { x: 5, y: 5 },
      inspectorTile: { x: 6, y: 5 }, // intentional coordinate desync for test
    });

    expect(context).toContain('=== AETHER & SOOT');
    expect(context).toContain('[CLIENT PROJECTION AUDIT]: Leaks Detected:');
    const audit = (world as { clientProjectionAudit?: any }).clientProjectionAudit;
    expect(audit).toBeDefined();
    expect(audit.lookCursorSync.synchronized).toBe(false);
    expect(audit.leaks.some((l: any) => l.category === 'DESYNC_COORDINATES')).toBe(true);

    // Test duplicate chronicle detection and raw identifier detection
    const leakState = {
      ...world,
      eventLog: [
        { type: 'ENTITY_MOVED', actorId: playerId, from: { x: 1, y: 1, stratum: 'STREET' }, to: { x: 2, y: 2, stratum: 'STREET' }, turn: 1, apSpent: 100 },
        { type: 'ENTITY_MOVED', actorId: playerId, from: { x: 1, y: 1, stratum: 'STREET' }, to: { x: 2, y: 2, stratum: 'STREET' }, turn: 2, apSpent: 100 },
      ],
    } as any;
    const leakAudit = auditClientProjection(leakState, playerId);
    expect(leakAudit.leaks.some((l) => l.category === 'DUPLICATE_CHRONICLE')).toBe(true);
    expect(leakAudit.leaks.some((l) => l.category === 'RAW_IDENTIFIER')).toBe(true);
  });

  it('parses extended action repertoire including stoking, crafting, grafting, and transit', () => {
    const world = setupWorld();

    expect(parseLlmResponseToCommand('{"action": "STOKE_BOILER", "pressureKpa": 50}', world, playerId).type).toBe('REFILL_STEAM');
    expect(parseLlmResponseToCommand('{"action": "SALVAGE_ITEM", "itemId": "item_scrap"}', world, playerId).type).toBe('SALVAGE_ITEM');
    expect(parseLlmResponseToCommand('{"action": "GRAFT_PROSTHETIC", "prostheticId": "item_leg", "slot": "LEFT_LEG"}', world, playerId).type).toBe('INSTALL_PROSTHETIC');
    expect(parseLlmResponseToCommand('{"action": "FIELD_REPAIR_LIMB", "slot": "LEFT_ARM"}', world, playerId).type).toBe('REPAIR_LIMB');
    expect(parseLlmResponseToCommand('{"action": "PRY_OBJECT", "toolId": "item_crowbar"}', world, playerId).type).toBe('PRY_OBSTACLE');
    expect(parseLlmResponseToCommand('{"action": "CLAIM_SAFEHOUSE", "claimVault": true}', world, playerId).type).toBe('CLAIM_WORKSHOP_DEED');
    expect(parseLlmResponseToCommand('{"action": "STOCK_PEDESTAL", "commodityId": "ANTHRACITE_COAL", "quantity": 2, "pricePence": 30}', world, playerId).type).toBe('STOCK_PEDESTAL');
    expect(parseLlmResponseToCommand('{"action": "DISPATCH_MONORAIL"}', world, playerId).type).toBe('LAUNCH_MONORAIL');
    expect(parseLlmResponseToCommand('{"action": "ACCEPT_CONTRACT", "contractId": "contract_1"}', world, playerId).type).toBe('ACCEPT_CONTRACT');
    expect(parseLlmResponseToCommand('{"action": "PRESSURIZE_VESSEL", "vesselId": "env_boiler", "pressureKpa": 50}', world, playerId).type).toBe('PRESSURIZE_VESSEL');
    expect(parseLlmResponseToCommand('{"action": "SELL_TO_MERCHANT", "merchantId": "npc_m", "commodityId": "ANTHRACITE_COAL", "quantity": 1}', world, playerId).type).toBe('SELL_TO_MERCHANT');
  });

  it('configures distinct 50-turn goal-conditioned scenarios in applyPlaytestScenario', () => {
    const world = setupWorld();

    const surgicalWorld = applyPlaytestScenario(world, 'surgical');
    expect(surgicalWorld.entities['env_boiler_surgical']).toBeDefined();
    expect(surgicalWorld.entities['item_strider_leg']).toBeDefined();
    expect(getScenarioObjectives('surgical').primary).toContain('graft');

    const sabotageWorld = applyPlaytestScenario(world, 'sabotage');
    expect(sabotageWorld.entities['env_foundry_boiler']).toBeDefined();
    expect(sabotageWorld.entities['npc_coal_broker']).toBeDefined();
    expect(getScenarioObjectives('sabotage').primary).toContain('300 kPa');

    const transitWorld = applyPlaytestScenario(world, 'safehouse_transit');
    expect(transitWorld.entities['env_monorail_cab']).toBeDefined();
    expect(getScenarioObjectives('safehouse_transit').primary).toContain('monorail');
  });

  it('runs 50-turn evaluation session across new scenarios and writes reports with matrices', async () => {
    const reportPath = path.join(process.cwd(), 'tests/artifacts/test-playtest-report.md');
    const ecoReportPath = path.join(process.cwd(), 'tests/artifacts/playtest-report-economy.md');

    // 1. Surgical Scenario
    const surgMetrics = await runPlaytestSession({
      mock: true, maxTurns: 50, seed: 101, endpoint: 'http://localhost:11434',
      model: 'test-model', reportPath, scenario: 'surgical',
    });
    expect(surgMetrics.turnsSurvived).toBe(50);
    expect(surgMetrics.commandHistogram['INSTALL_PROSTHETIC']).toBeGreaterThanOrEqual(1);

    // 2. Sabotage Scenario
    const sabMetrics = await runPlaytestSession({
      mock: true, maxTurns: 50, seed: 102, endpoint: 'http://localhost:11434',
      model: 'test-model', reportPath, scenario: 'sabotage',
    });
    expect(sabMetrics.turnsSurvived).toBe(50);
    expect(sabMetrics.commandHistogram['PRESSURIZE_VESSEL']).toBeGreaterThanOrEqual(1);

    // 3. Safehouse & Monorail Transit Scenario
    const transMetrics = await runPlaytestSession({
      mock: true, maxTurns: 50, seed: 103, endpoint: 'http://localhost:11434',
      model: 'test-model', reportPath, scenario: 'safehouse_transit',
    });
    expect(transMetrics.turnsSurvived).toBe(50);
    expect(transMetrics.commandHistogram['CLAIM_WORKSHOP_DEED']).toBeGreaterThanOrEqual(1);

    // Check report artifacts
    expect(fs.existsSync(reportPath)).toBe(true);
    const reportContent = fs.readFileSync(reportPath, 'utf-8');
    expect(reportContent).toContain('Command Coverage Matrix');
    expect(reportContent).toContain('Client UI Projection & Chronicle Leak Audit');
    expect(reportContent).toContain('UI Projection Leaks Detected');

    expect(fs.existsSync(ecoReportPath)).toBe(true);
    const ecoContent = fs.readFileSync(ecoReportPath, 'utf-8');
    expect(ecoContent).toContain('Command Coverage Matrix');

    if (fs.existsSync(reportPath)) fs.unlinkSync(reportPath);
  });
});
