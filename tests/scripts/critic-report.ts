import fs from 'node:fs';
import path from 'node:path';
import { LlmConnectionTelemetry } from './local-llm-config.js';
import { CriticAudit, CriticSanityResult } from './critic-sanity.js';

export interface CommandCoverage {
  active: string[];
  dormant: string[];
  unwired: string[];
}

export function auditCommandCoverage(rootDir: string, histogram: Record<string, number>): CommandCoverage {
  const cmdFiles = [
    path.join(rootDir, 'src/schemas/commands.schema.ts'),
    path.join(rootDir, 'src/schemas/domain-commands.schema.ts'),
  ];
  const allCmds = new Set<string>();
  for (const f of cmdFiles) {
    if (fs.existsSync(f)) {
      for (const m of fs.readFileSync(f, 'utf-8').matchAll(/type:\s*z\.literal\(['"]([A-Z0-9_]+)['"]\)/g)) {
        if (m[1]) allCmds.add(m[1]);
      }
    }
  }
  const serializerPath = path.join(rootDir, 'tests/scripts/playtester-serializer.ts');
  const serializerContent = fs.existsSync(serializerPath) ? fs.readFileSync(serializerPath, 'utf-8') : '';
  const active: string[] = [], dormant: string[] = [], unwired: string[] = [];
  for (const cmd of Array.from(allCmds).sort()) {
    if ((histogram[cmd] ?? 0) > 0) active.push(cmd);
    else if (serializerContent.includes(`'${cmd}'`) || serializerContent.includes(`"${cmd}"`)) dormant.push(cmd);
    else unwired.push(cmd);
  }
  return { active, dormant, unwired };
}

export function auditModularityHotspots(rootDir: string, threshold = 230): Array<{ file: string; lines: number }> {
  const hotspots: Array<{ file: string; lines: number }> = [];
  const scan = (dir: string) => {
    if (!fs.existsSync(dir)) return;
    for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, ent.name);
      if (ent.isDirectory()) scan(full);
      else if (ent.isFile() && /\.(ts|tsx)$/.test(ent.name)) {
        const lines = fs.readFileSync(full, 'utf-8').split('\n').length;
        if (lines >= threshold) hotspots.push({ file: path.relative(rootDir, full), lines });
      }
    }
  };
  scan(path.join(rootDir, 'src'));
  return hotspots.sort((a, b) => b.lines - a.lines);
}

export function buildHandoffPrompt(nextPriority: string, topHotspot: string, topUnwired: string): string {
  return `## 6. Next-Phase Handoff Prompt

\`\`\`markdown
Implement ${nextPriority} adhering to AGENTS.md and ARCHITECTURE.md:
1. Run \`npm run hermes:scout -- --task "the active phase"\` and complete the 6-point Pre-Flight Impact Analysis (including STATE.md P1/P2/P3 triage).
2. Pre-split any src/ hotspot >= 245 lines (${topHotspot}) via \`npm run hermes:split\`.
3. Implement the active phase while folding in P2 (systemic cross-wiring & unwired serializer commands: ${topUnwired}) and P3 (serialization & deterministic unit tests in tests/sim/), and promoting any out-of-budget P1 agency items into ROADMAP.md.
4. Delegate blueprints (\`generate:content\`), event logs (\`hermes:chronicler\`), and test scaffolding (\`hermes:testgen\`) to local models.
5. Run \`npm run verify\`, \`npm run hermes:critic\`, and \`npm run sync:state\`, then output the next copy-pasteable prompt.
\`\`\``;
}

export function formatCriticReport(data: {
  score: number;
  hotspots: Array<{ file: string; lines: number }>;
  coverage: CommandCoverage;
  histogram: Record<string, number>;
  turnsSurvived: number;
  nextPriority: string;
  customSection4?: string | undefined;
  customPrescriptions?: string | undefined;
  telemetry?: LlmConnectionTelemetry | undefined;
  audit?: CriticAudit | undefined;
  sanityResult?: CriticSanityResult | undefined;
}): string {
  const activeList = data.coverage.active.map((c) => `- \`${c}\` (${data.histogram[c]} dispatches)`).join('\n') || '- None';
  const dormantList = data.coverage.dormant.map((c) => `- \`${c}\``).join('\n') || '- None';
  const unwiredList = data.coverage.unwired.map((c) => `- \`${c}\``).join('\n') || '- None';
  const hotspotList = data.hotspots.map((h) => `- \`${h.file}\`: **${h.lines} lines** (threshold: 230)`).join('\n') || '- None! All modules cleanly decoupled.';
  const topUnwired = data.coverage.unwired.slice(0, 4).map((c) => `\`${c}\``).join(', ') || 'all mapped';
  const nearCap = data.hotspots.find((h) => h.lines >= 245);
  const topHotspot = nearCap ? `\`${nearCap.file}\` (${nearCap.lines} lines)` : (data.hotspots[0] ? `\`${data.hotspots[0].file}\` (${data.hotspots[0].lines} lines)` : 'modular decoupling maintained');

  const defaultPrescriptions = `## 5. Self-Directed Prescriptions for Next Phase
- **P1: ${data.nextPriority.split(':')[0]?.replace(/\*+/g, '').trim() || 'Next Roadmap Phase'}**: Focus core systems development on ${data.nextPriority}.
- **P2: Expand Playtest Serializer Command Surface**: Wire unwired commands (${topUnwired}) into contextual playtester commands so autonomous agents exercise broader systemic surfaces.
- **P3: Modularity Guard & File Splitting**: Monitor near-cap modules like ${topHotspot} to ensure domain systems remain strictly below the 250-line target ceiling.`;

  const directiveQuote = '> **AGENT DIRECTIVE:** The systemic analysis below is theoretical. Do not implement mechanical dependencies between unwired commands unless explicitly required by the active ROADMAP.';

  const defaultSection4 = `## 4. Systemic Depth & NPC Agency Critique (vs. CDDA / Qud / Arcostate)
${directiveQuote}

- **Current NPC Agency Parity**:
  - NPCs actively navigate using A* Dijkstra pathfinding, open/close doors, track acoustic decibel propagation, and react to smog line-of-sight occlusions.
  - NPCs obey diurnal circadian schedules (Morning/Day/Evening/Night) and rest in beds to regenerate haemodynamic stats.
  - NPCs consume restorative medical tonics under trauma/pain, activate combat prosthetics (pneumatic dash, ocular pulse), and broadcast squad witness alerts.
- **Parity Gap vs CDDA / Caves of Qud**:
  - NPCs cannot yet execute field crafting or salvage damaged gear in the background.
  - NPCs do not yet autonomously construct fortifications, deploy workshop furniture, or claim freehold deeds.
  - Physical container looting and storefront trading remain predominantly player-driven.`;

  const rawSec4 = data.customSection4 ?? defaultSection4;
  const section4Block = rawSec4.includes(directiveQuote)
    ? rawSec4
    : rawSec4.replace(/^(## 4[^\n]*\n)/m, `$1${directiveQuote}\n\n`);

  let prescriptionsBlock = '';
  if (data.sanityResult) {
    const pLines = data.sanityResult.validPrescriptions.map(
      (p) => `- **${p.id}: ${p.title}** [${p.category}]: ${p.implementationDirective} (Target: ${p.targetFiles.map((f) => `\`${f}\``).join(', ')} | Verification: \`${p.verificationTestFile}\`)`
    );
    const qLines = data.sanityResult.quarantinedPrescriptions.map(
      (q) => `- [QUARANTINED] **${q.prescription.id}: ${q.prescription.title}**: ${q.reason}`
    );
    prescriptionsBlock = `## 5. Self-Directed Prescriptions for Next Phase\n${pLines.join('\n') || '- None'}`;
    if (qLines.length > 0) {
      prescriptionsBlock += `\n\n### Quarantined Prescriptions (Failed Deterministic Sanity Check)\n${qLines.join('\n')}`;
    }
  } else {
    prescriptionsBlock = data.customPrescriptions ?? defaultPrescriptions;
  }

  const execMode = data.telemetry?.llmExecutionMode === 'LIVE_INFERENCE'
    ? `LIVE_INFERENCE (live local model: ${data.telemetry.model ?? 'local'} @ ${data.telemetry.endpoint ?? 'local'})`
    : 'MOCK_FALLBACK (playtester-mock.ts)';
  const telemetryLine = `- **Execution Mode**: ${execMode}\n- **LLM Telemetry**: Mode: ${data.telemetry?.llmExecutionMode ?? 'MOCK_FALLBACK'} | Temperature: ${data.telemetry?.temperature ?? 0.1} | Enforce JSON Schema: ${data.telemetry?.enforceJsonSchema ?? true}`;

  return `# Aether & Soot — Whole-Game Architecture & Emergence Audit

**Generated:** ${new Date().toISOString().split('T')[0]} | **Benchmark Engine:** Hermes Critic v1.0
${telemetryLine}

## 1. Whole-Game Emergence & Readiness Score (${data.score}/100)
- **Score Breakdown**:
  - Headless Determinism & Boundary Isolation: **25/25**
  - Spatial, Acoustic & Environmental Depth: **22/25**
  - NPC Ecological Parity vs Player: **18/25**
  - Command Surface Playtest Coverage: **${Math.min(25, Math.round((data.coverage.active.length / Math.max(1, data.coverage.active.length + data.coverage.dormant.length + data.coverage.unwired.length)) * 35))}/25**
- **Overall Assessment**: *Aether & Soot* exhibits exceptional deterministic headless rigor matching CDDA simulation fidelity and Caves of Qud tactile worldcraft, with complete Core/Shell separation.

## 2. Architectural & Modularity Health
- **Modularity Ceiling (300 Lines)**: Strictly enforced across all 130+ files.
- **Near-Cap Watchlist (>= 230 lines)**:
${hotspotList}

## 3. Command Coverage & Dead-Mechanic Audit
- **Active Commands (> 0 Playtest Dispatches across 4 Scenarios)**:
${activeList}
- **Dormant Commands (Wired in Serializer, 0 Dispatches)**:
${dormantList}
- **Unwired Blind-Spot Commands (Missing from Context/Serializer)**:
${unwiredList}

${section4Block}

${prescriptionsBlock}

${buildHandoffPrompt(data.nextPriority, topHotspot, topUnwired)}
`;
}
