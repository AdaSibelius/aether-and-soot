import fs from 'node:fs';
import path from 'node:path';
import { PlaytestScenario } from './playtester-scenarios.js';

export interface PlaytestReportConfig {
  readonly mock: boolean;
  readonly maxTurns: number;
  readonly seed: number;
  readonly endpoint: string;
  readonly model: string;
  readonly reportPath: string;
  readonly scenario: PlaytestScenario;
}

export interface PlaytestMetrics {
  turnsSurvived: number;
  totalDecibels: number;
  alertTransitions: { investigating: number; combat: number };
  steamCloudsDeployed: number;
  trapsTriggered: number;
  hostilesAttacked: number;
  attackHits: number;
  attackMisses: number;
  damageDealt: number;
  damageTaken: number;
  itemsAcquired: number;
  itemsUsed: number;
  transitionsCompleted: number;
  finalBloodPct: number;
  uniqueTilesVisited: number;
  commandHistogram: Record<string, number>;
  causeOfDeath?: string;
}

export function writeReport(config: PlaytestReportConfig, metrics: PlaytestMetrics): void {
  const dir = path.dirname(config.reportPath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  const status = metrics.causeOfDeath ? `DEFEATED (${metrics.causeOfDeath})` : 'SURVIVED';
  const histogramRows = Object.entries(metrics.commandHistogram ?? {})
    .sort((a, b) => b[1] - a[1])
    .map(([cmd, count]) => `| \`${cmd}\` | ${count} |`)
    .join('\n');

  const content = `# Aether & Soot — Headless Autonomous Playtest Report

- **Timestamp**: ${new Date().toISOString()}
- **Execution Mode**: ${config.mock ? 'Deterministic Mock Agent (--mock)' : `Local LLM (${config.model} @ ${config.endpoint})`}
- **Scenario**: **${config.scenario.toUpperCase()}**
- **Seed**: ${config.seed}
- **Survival Status**: **${status}**

## Emergent Sandbox Mechanics Metrics

| Metric | Recorded Value | Evaluation Notes |
| :--- | :--- | :--- |
| **Turns Survived** | ${metrics.turnsSurvived} / ${config.maxTurns} | Longevity under autonomous navigation |
| **Acoustic Decibels Emitted** | ${metrics.totalDecibels} dB | Footsteps, door actions, and steam releases |
| **Guard Sound Investigations** | ${metrics.alertTransitions.investigating} | NPCs transitioning to INVESTIGATING |
| **Guard Combat Engagements** | ${metrics.alertTransitions.combat} | NPCs acquiring visual lock in COMBAT |
| **Steam Clouds Deployed** | ${metrics.steamCloudsDeployed} | Vented steam to obscure LOS |
| **Clockwork Traps Triggered** | ${metrics.trapsTriggered} | Hidden tripwires / spring jaws stepped on |
| **Hostiles Attacked** | ${metrics.hostilesAttacked} | Targeted melee / ranged strikes on hostiles |
| **Attack Hits** | ${metrics.attackHits} | Clean strikes landing on target |
| **Attack Misses / Obstructed** | ${metrics.attackMisses} | Evasions, range misses, or deflections |
| **Damage Dealt (Player)** | ${metrics.damageDealt} HP | Targeted combat damage to hostiles |
| **Damage Taken (Player)** | ${metrics.damageTaken} HP | Trauma sustained from hostiles or hazards |
| **Items Acquired** | ${metrics.itemsAcquired} | Picked up from ground or bought from merchants |
| **Items Used** | ${metrics.itemsUsed} | Consumed tonics or canisters |
| **Transitions Completed** | ${metrics.transitionsCompleted} | Stratum portals or district gates traversed |
| **Final Blood Volume** | ${metrics.finalBloodPct}% | Haemodynamic stability |
| **Unique Tiles Visited** | ${metrics.uniqueTilesVisited} | Distinct spatial tiles explored |

## Command Dispatch Histogram

| Command Type | Dispatches |
| :--- | :--- |
${histogramRows || '| None | 0 |'}
`;

  fs.writeFileSync(config.reportPath, content, 'utf-8');
}
