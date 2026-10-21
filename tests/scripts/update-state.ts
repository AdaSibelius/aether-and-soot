import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

const ROOT_DIR = path.resolve(import.meta.dirname, '../..');

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

export function generateStateContent(commits: string, nextPriority: string, dateStr?: string): string {
  const date = dateStr ?? new Date().toISOString().split('T')[0];
  return `# Project State

**Last Updated:** ${date}

## Recent Commits
${commits}

## Immediate Next Priority
- ${nextPriority}
`;
}

export function updateStateFile(rootDir: string = ROOT_DIR): string {
  const commits = getRecentCommits(3);
  const roadmapPath = path.join(rootDir, 'ROADMAP.md');
  const nextPriority = getNextPriority(roadmapPath);
  const content = generateStateContent(commits, nextPriority);
  const statePath = path.join(rootDir, 'STATE.md');
  fs.writeFileSync(statePath, content, 'utf-8');
  console.log(`[sync:state] Updated ${statePath}`);
  return content;
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
