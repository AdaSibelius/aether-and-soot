import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { ProjectState, ProjectStateSchema, RoadmapPhase } from '../../src/schemas/project-state.schema.js';
import { auditModularityHotspots } from './critic-report.js';

const ROOT_DIR = path.resolve(import.meta.dirname, '../..');

export interface BacklogPrescription {
  readonly id: string;
  readonly category: string;
  readonly title: string;
  readonly directive: string;
  readonly targetFiles: string;
  readonly verification: string;
}

export function parseVerifiedPrescriptions(criticContent: string): BacklogPrescription[] {
  const p5Idx = criticContent.indexOf('## 5.');
  if (p5Idx === -1) return [];
  const textAfter = criticContent.slice(p5Idx);
  const stopMatch = textAfter.search(/\n(?:###\s+Quarantined|##\s+[6-9]\.)/);
  const validSection = stopMatch === -1 ? textAfter : textAfter.slice(0, stopMatch);
  const results: BacklogPrescription[] = [];

  for (const rawLine of validSection.split('\n')) {
    const m = rawLine.trim().match(/^-\s*\*\*(P[01][A-Za-z0-9_-]*):\s*([^*]+)\*\*(?:\s*\[([A-Z_]+)\])?:\s*(.*)$/);
    if (!m) continue;
    let directive = m[4]?.trim() ?? '';
    const tm = directive.match(/\(Target:\s*([^|]+)\|\s*Verification:\s*([^)]+)\)/);
    const targetFiles = tm ? (tm[1]?.trim().replace(/`/g, '') ?? 'N/A') : 'N/A';
    const verification = tm ? (tm[2]?.trim().replace(/`/g, '') ?? 'N/A') : 'N/A';
    if (tm) directive = directive.replace(/\(Target:\s*[^|]+\|\s*Verification:\s*[^)]+\)/, '').trim();
    results.push({
      id: m[1]?.trim() ?? 'P1',
      title: m[2]?.trim() ?? 'Untitled',
      category: m[3]?.trim() ?? 'GENERAL',
      directive: directive.replace(/\|/g, '\\|'),
      targetFiles: targetFiles.replace(/\|/g, '\\|'),
      verification: verification.replace(/\|/g, '\\|'),
    });
  }
  return results;
}

export function getRecentCommits(count = 3): Array<{ hash: string; message: string }> {
  try {
    const lines = execSync(`git log -${count} --pretty=format:"%h||%s"`, { cwd: ROOT_DIR, encoding: 'utf-8' }).trim().split('\n');
    return lines.map((l) => {
      const [hash = '', message = ''] = l.split('||');
      return { hash: hash.trim(), message: message.trim() };
    }).filter((c) => Boolean(c.hash));
  } catch {
    return [{ hash: '0000000', message: 'No git history available' }];
  }
}

export function compileStateMarkdown(state: ProjectState): string {
  const commitsBlock = state.recentCommits.map((c) => `- ${c.hash}: ${c.message}`).join('\n');
  const seen = new Set<string>();
  const uniquePrescriptions = state.prescriptions.filter((p) => {
    if (seen.has(p.id)) return false;
    seen.add(p.id);
    return true;
  });
  const pList = uniquePrescriptions.map((p) => `- **${p.priority}: ${p.title}** [${p.category}]: ${p.directive} (Target: \`${p.targetFiles.join('`, `')}\` | Verification: \`${p.verification}\`)`).join('\n');
  const tableRows = uniquePrescriptions.map((p) => `| ${p.priority} | ${p.category} | ${p.title} | ${p.directive} | \`${p.targetFiles.join('`, `')}\` | \`${p.verification}\` |`).join('\n');
  const topHotspot = state.hotspots[0] ? `\`${state.hotspots[0].file}\` (${state.hotspots[0].lines} lines)` : 'none';

  const firstColon = state.immediateNextPriority.indexOf(':');
  const phaseTitle = firstColon !== -1 ? state.immediateNextPriority.slice(0, firstColon).replace(/\*+/g, '').trim() : state.immediateNextPriority;
  const phaseDesc = firstColon !== -1 ? state.immediateNextPriority.slice(firstColon + 1).trim() : '';

  return `# Project State

**Last Updated:** ${state.lastUpdated}

## Recent Commits
${commitsBlock}

## Immediate Next Priority
- ${state.immediateNextPriority}

## 5. Self-Directed Prescriptions for Next Phase
${pList}

## 6. Next-Phase Handoff Prompt

\`\`\`markdown
Implement **${phaseTitle}**: ${phaseDesc} adhering to AGENTS.md and ARCHITECTURE.md:
1. Run \`npm run hermes:scout -- --task "the active phase"\` and complete the 6-point Pre-Flight Impact Analysis (including STATE.md P1/P2/P3 triage).
2. Pre-split any src/ hotspot >= 245 lines (${topHotspot}) via \`npm run hermes:split\`.
3. Implement the active phase while folding in P2 (systemic cross-wiring & unwired serializer commands) and P3 (serialization & deterministic unit tests in tests/sim/), and promoting any out-of-budget P1 agency items into ROADMAP.md.
4. Delegate blueprints (\`generate:content\`), event logs (\`hermes:chronicler\`), and test scaffolding (\`hermes:testgen\`) to local models.
5. Run \`npm run verify\`, \`npm run hermes:critic\`, and \`npm run sync:state\`, then output the next copy-pasteable prompt.
\`\`\`

## Autonomous Critic Backlog (Sanity-Verified)

| Priority | Category | Title | Directive | Target Files | Verification |
| --- | --- | --- | --- | --- | --- |
${tableRows}
`;
}

export function compileRoadmapMarkdown(roadmapContent: string, phases: readonly RoadmapPhase[], prescriptions: ReadonlyArray<BacklogPrescription | { id: string; category: string; title: string; directive: string; targetFiles: string[] | string; verification: string }>): string {
  let output = roadmapContent;
  for (const phase of phases) {
    const isCompleted = phase.status === 'COMPLETED';
    const mark = isCompleted ? '[x]' : '[ ]';
    const regex = new RegExp(`^-\\s*\\[[ x]\\](\\s*\\*\\*Phase\\s*${phase.number}\\b[^\\n]*)`, 'm');
    const match = output.match(regex);
    if (match && match[1]) {
      let rest = match[1];
      if (isCompleted && !rest.includes('Completed')) {
        rest = rest.replace(/(\*\*Phase\s*\d+[^:*]+:[^*]+\*\*)/, '$1 *(Completed)*');
      }
      output = output.replace(regex, `- ${mark}${rest}`);
    }
  }

  const backlogHeader = '## Autonomous Critic Backlog (Sanity-Verified)';
  const backlogIdx = output.indexOf(backlogHeader);
  const cleanBody = backlogIdx !== -1 ? output.slice(0, backlogIdx).trimEnd() : output.trimEnd();

  const seen = new Set<string>();
  const tableRows = prescriptions
    .filter((p) => {
      const k = `${p.id}::${p.title}`;
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    })
    .map((p) => {
      const tf = Array.isArray(p.targetFiles) ? p.targetFiles.join(', ') : p.targetFiles;
      return `| ${p.id} | ${p.category} | ${p.title} | ${p.directive} | \`${tf}\` | \`${p.verification}\` |`;
    });

  const tableBlock = `\n\n${backlogHeader}\n\n| Priority | Category | Title | Directive | Target Files | Verification |\n| --- | --- | --- | --- | --- | --- |\n${tableRows.join('\n')}\n`;
  return `${cleanBody}${tableBlock}`;
}

export function compileAgentsMarkdown(content: string, nearCaps: Array<{ file: string; lines: number }>): string {
  const nearCapStr = nearCaps.map((h) => `\`${h.file}\` (${h.lines} lines)`).join(', ');
  const regex = /-\s*\*\*Warning on Near-Cap Files \(>= 240 lines\)\*\*:[^\n]*/;
  return content.replace(regex, `- **Warning on Near-Cap Files (>= 240 lines)**: ${nearCapStr}. Do NOT add new functions to these files—extract sub-modules via \`npm run hermes:split\` before adding new logic.`);
}

export function routeVerifiedPrescriptionsToRoadmap(criticPathOrRootDir: string = ROOT_DIR, customRoadmapPath?: string, customStatePath?: string): { routedCount: number; prescriptions: BacklogPrescription[] } {
  const isDir = fs.existsSync(criticPathOrRootDir) && fs.statSync(criticPathOrRootDir).isDirectory();
  const criticPath = isDir ? path.join(criticPathOrRootDir, 'tests/artifacts/critic-audit.md') : criticPathOrRootDir;
  const roadmapPath = customRoadmapPath ?? (isDir ? path.join(criticPathOrRootDir, 'ROADMAP.md') : path.join(ROOT_DIR, 'ROADMAP.md'));
  const statePath = customStatePath ?? (isDir ? path.join(criticPathOrRootDir, 'STATE.md') : path.join(ROOT_DIR, 'STATE.md'));
  if (!fs.existsSync(criticPath)) return { routedCount: 0, prescriptions: [] };

  const prescriptions = parseVerifiedPrescriptions(fs.readFileSync(criticPath, 'utf-8'));
  if (prescriptions.length === 0) return { routedCount: 0, prescriptions: [] };

  let addedRoadmap = 0;
  if (fs.existsSync(roadmapPath)) {
    const oldRoadmap = fs.readFileSync(roadmapPath, 'utf-8');
    for (const p of prescriptions) {
      if (!oldRoadmap.includes(`| ${p.id} |`) || !oldRoadmap.includes(`| ${p.title} |`)) addedRoadmap++;
    }
    fs.writeFileSync(roadmapPath, compileRoadmapMarkdown(oldRoadmap, [], prescriptions), 'utf-8');
  }
  if (fs.existsSync(statePath)) {
    const oldState = fs.readFileSync(statePath, 'utf-8');
    fs.writeFileSync(statePath, compileRoadmapMarkdown(oldState, [], prescriptions), 'utf-8');
  }
  return { routedCount: addedRoadmap, prescriptions };
}

export function updateStateFile(rootDir: string = ROOT_DIR): string {
  const stateJsonPath = path.join(rootDir, '.agents/state.json');
  const roadmapPath = path.join(rootDir, 'ROADMAP.md');
  const statePath = path.join(rootDir, 'STATE.md');
  const agentsPath = path.join(rootDir, 'AGENTS.md');
  const criticPath = path.join(rootDir, 'tests/artifacts/critic-audit.md');

  if (!fs.existsSync(stateJsonPath)) {
    throw new Error(`.agents/state.json not found at ${stateJsonPath}`);
  }

  const state = ProjectStateSchema.parse(JSON.parse(fs.readFileSync(stateJsonPath, 'utf-8')));
  state.recentCommits = getRecentCommits(3);
  state.lastUpdated = new Date().toISOString().split('T')[0] ?? '2026-10-25';

  const rawHotspots = auditModularityHotspots(rootDir, 230);
  state.hotspots = rawHotspots.map((h) => ({
    file: h.file,
    lines: h.lines,
    threshold: 230,
    status: (h.lines >= 240 ? 'NEAR_CAP' : 'SAFE') as 'SAFE' | 'NEAR_CAP' | 'EXCEEDED',
  }));

  if (fs.existsSync(criticPath)) {
    for (const p of parseVerifiedPrescriptions(fs.readFileSync(criticPath, 'utf-8'))) {
      const item = {
        id: p.id,
        priority: (p.id.startsWith('P0') ? 'P0' : p.id.startsWith('P2') ? 'P2' : p.id.startsWith('P3') ? 'P3' : 'P1') as 'P0' | 'P1' | 'P2' | 'P3',
        category: p.category,
        title: p.title,
        directive: p.directive,
        targetFiles: p.targetFiles.split(',').map((f) => f.trim()).filter((f) => f && f !== 'N/A'),
        verification: p.verification,
      };
      const idx = state.prescriptions.findIndex((ep) => ep.id === p.id);
      if (idx !== -1) state.prescriptions[idx] = item;
      else state.prescriptions.push(item);
    }
  }

  const seenPrescriptionIds = new Set<string>();
  state.prescriptions = state.prescriptions.filter((p) => {
    if (seenPrescriptionIds.has(p.id)) return false;
    seenPrescriptionIds.add(p.id);
    return true;
  });

  fs.writeFileSync(stateJsonPath, JSON.stringify(state, null, 2), 'utf-8');
  fs.writeFileSync(statePath, compileStateMarkdown(state), 'utf-8');

  if (fs.existsSync(roadmapPath)) {
    fs.writeFileSync(roadmapPath, compileRoadmapMarkdown(fs.readFileSync(roadmapPath, 'utf-8'), state.phases, state.prescriptions), 'utf-8');
  }
  if (fs.existsSync(agentsPath)) {
    const nearCaps = rawHotspots.filter((h) => h.lines >= 240);
    fs.writeFileSync(agentsPath, compileAgentsMarkdown(fs.readFileSync(agentsPath, 'utf-8'), nearCaps), 'utf-8');
  }

  console.log(`[sync:state] Compiled STATE.md, ROADMAP.md, and AGENTS.md from .agents/state.json`);
  return fs.readFileSync(statePath, 'utf-8');
}

if (process.argv[1]?.endsWith('update-state.ts')) {
  try {
    updateStateFile();
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[sync:state] Failed to compile state: ${msg}`);
    process.exit(1);
  }
}
