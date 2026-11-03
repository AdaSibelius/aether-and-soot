import { ProjectState, RoadmapPhase } from '../../src/schemas/project-state.schema.js';

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
    if (tm) directive = directive.replace(/\(Target:\s*[^|]+\|\s*Verification:\s*([^)]+)\)/, '').trim();
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
