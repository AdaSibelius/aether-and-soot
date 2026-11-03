import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { ProjectStateSchema } from '../../src/schemas/project-state.schema.js';
import { auditModularityHotspots } from './critic-report.js';
import {
  type BacklogPrescription,
  compileAgentsMarkdown,
  compileRoadmapMarkdown,
  compileStateMarkdown,
  parseVerifiedPrescriptions,
} from './state-markdown-compiler.js';

export type { BacklogPrescription };
export {
  compileAgentsMarkdown,
  compileRoadmapMarkdown,
  compileStateMarkdown,
  parseVerifiedPrescriptions,
};

const ROOT_DIR = path.resolve(import.meta.dirname, '../..');

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
