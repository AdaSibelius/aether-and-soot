import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

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

  const lines = validSection.split('\n');
  const results: BacklogPrescription[] = [];

  for (const rawLine of lines) {
    const line = rawLine.trim();
    // Only match P0 and P1 (P0_BLOCKER and P1_HIGH)
    const match = line.match(/^-\s*\*\*(P[01][A-Za-z0-9_-]*):\s*([^*]+)\*\*(?:\s*\[([A-Z_]+)\])?:\s*(.*)$/);
    if (!match) continue;

    const id = match[1]?.trim() ?? 'P1';
    const title = match[2]?.trim() ?? 'Untitled';
    const category = match[3]?.trim() ?? 'GENERAL';
    const rest = match[4]?.trim() ?? '';

    let directive = rest;
    let targetFiles = 'N/A';
    let verification = 'N/A';

    const targetMatch = rest.match(/\(Target:\s*([^|]+)\|\s*Verification:\s*([^)]+)\)/);
    if (targetMatch) {
      targetFiles = targetMatch[1]?.trim() ?? 'N/A';
      verification = targetMatch[2]?.trim() ?? 'N/A';
      directive = rest.replace(/\(Target:\s*[^|]+\|\s*Verification:\s*[^)]+\)/, '').trim();
    }

    results.push({
      id,
      category,
      title,
      directive: directive.replace(/\|/g, '\\|'),
      targetFiles: targetFiles.replace(/\|/g, '\\|'),
      verification: verification.replace(/\|/g, '\\|'),
    });
  }

  return results;
}

function appendPrescriptionsToFile(filePath: string, prescriptions: readonly BacklogPrescription[]): number {
  if (!fs.existsSync(filePath) || prescriptions.length === 0) return 0;
  const content = fs.readFileSync(filePath, 'utf-8');
  const sectionHeader = '## Autonomous Critic Backlog (Sanity-Verified)';
  const tableHeader = '| Priority | Category | Title | Directive | Target Files | Verification |\n| --- | --- | --- | --- | --- | --- |';

  const newRows: string[] = [];
  for (const p of prescriptions) {
    // Deduplicate against existing entries in the file
    if (content.includes(`| ${p.id} |`) && content.includes(`| ${p.title} |`)) {
      continue;
    }
    newRows.push(`| ${p.id} | ${p.category} | ${p.title} | ${p.directive} | ${p.targetFiles} | ${p.verification} |`);
  }

  if (newRows.length === 0) return 0;

  if (content.includes(sectionHeader)) {
    // Append rows to existing section table
    const sectionIdx = content.indexOf(sectionHeader);
    const afterSection = content.slice(sectionIdx);
    const nextSectionIdx = afterSection.slice(sectionHeader.length).search(/\n##\s+/);
    if (nextSectionIdx === -1) {
      fs.writeFileSync(filePath, `${content.trimEnd()}\n${newRows.join('\n')}\n`, 'utf-8');
    } else {
      const insertionPoint = sectionIdx + sectionHeader.length + nextSectionIdx;
      const before = content.slice(0, insertionPoint).trimEnd();
      const after = content.slice(insertionPoint);
      fs.writeFileSync(filePath, `${before}\n${newRows.join('\n')}\n\n${after.trimStart()}`, 'utf-8');
    }
  } else {
    // Append new section to file
    const block = `\n\n${sectionHeader}\n\n${tableHeader}\n${newRows.join('\n')}\n`;
    fs.writeFileSync(filePath, `${content.trimEnd()}${block}`, 'utf-8');
  }

  return newRows.length;
}

export function routeVerifiedPrescriptionsToRoadmap(
  criticPathOrRootDir: string = ROOT_DIR,
  customRoadmapPath?: string,
  customStatePath?: string,
): { routedCount: number; prescriptions: BacklogPrescription[] } {
  let criticPath = criticPathOrRootDir;
  let roadmapPath = customRoadmapPath ?? path.join(ROOT_DIR, 'ROADMAP.md');
  let statePath = customStatePath ?? path.join(ROOT_DIR, 'STATE.md');

  if (fs.existsSync(criticPathOrRootDir) && fs.statSync(criticPathOrRootDir).isDirectory()) {
    criticPath = path.join(criticPathOrRootDir, 'tests/artifacts/critic-audit.md');
    roadmapPath = customRoadmapPath ?? path.join(criticPathOrRootDir, 'ROADMAP.md');
    statePath = customStatePath ?? path.join(criticPathOrRootDir, 'STATE.md');
  }

  if (!fs.existsSync(criticPath)) {
    return { routedCount: 0, prescriptions: [] };
  }

  const criticContent = fs.readFileSync(criticPath, 'utf-8');
  const prescriptions = parseVerifiedPrescriptions(criticContent);

  const routedRoadmap = appendPrescriptionsToFile(roadmapPath, prescriptions);
  const routedState = appendPrescriptionsToFile(statePath, prescriptions);

  return {
    routedCount: Math.max(routedRoadmap, routedState),
    prescriptions,
  };
}

export function getRecentCommits(count = 3): string {
  try {
    return execSync(`git log -${count} --pretty=format:"- %h: %s"`, {
      cwd: ROOT_DIR,
      encoding: 'utf-8',
    }).trim();
  } catch {
    return '- No git history available';
  }
}

export function getNextPriority(roadmapPath: string): string {
  if (!fs.existsSync(roadmapPath)) {
    return 'ROADMAP.md not found';
  }
  const content = fs.readFileSync(roadmapPath, 'utf-8');
  const match = content.match(/^-\s*\[\s*\]\s*(.*)$/m);
  return match?.[1]?.trim() ?? 'All scheduled phases completed';
}

export function getCriticPrescriptions(criticPath: string): string {
  if (!fs.existsSync(criticPath)) return '';
  const content = fs.readFileSync(criticPath, 'utf-8');
  const idx = content.indexOf('## 5.');
  if (idx === -1) return '';
  const afterMarker = content.slice(idx);
  const stopIndex = afterMarker.search(/\n##\s+[7-9]\./);
  return (stopIndex === -1 ? afterMarker : afterMarker.slice(0, stopIndex)).trim();
}

export function generateStateContent(
  commits: string,
  nextPriority: string,
  criticPrescriptions?: string,
  dateStr?: string,
): string {
  const date = dateStr ?? new Date().toISOString().split('T')[0];
  const prescriptionsBlock = criticPrescriptions ? `\n${criticPrescriptions}\n` : '';
  return `# Project State

**Last Updated:** ${date}

## Recent Commits
${commits}

## Immediate Next Priority
- ${nextPriority}
${prescriptionsBlock}`;
}

export function updateStateFile(rootDir: string = ROOT_DIR): string {
  const commits = getRecentCommits(3);
  const roadmapPath = path.join(rootDir, 'ROADMAP.md');
  const criticPath = path.join(rootDir, 'tests/artifacts/critic-audit.md');
  const statePath = path.join(rootDir, 'STATE.md');
  const nextPriority = getNextPriority(roadmapPath);
  const criticPrescriptions = getCriticPrescriptions(criticPath);
  const content = generateStateContent(commits, nextPriority, criticPrescriptions);
  fs.writeFileSync(statePath, content, 'utf-8');

  // Route sanity-verified critic prescriptions to ROADMAP.md and STATE.md
  routeVerifiedPrescriptionsToRoadmap(criticPath, roadmapPath, statePath);

  console.log(`[sync:state] Updated ${statePath}`);
  return fs.readFileSync(statePath, 'utf-8');
}

if (process.argv[1]?.endsWith('update-state.ts')) {
  try {
    updateStateFile();
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[sync:state] Failed to update STATE.md: ${msg}`);
    process.exit(1);
  }
}
