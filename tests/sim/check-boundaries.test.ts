import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  checkTeamworkLayoutCompliance,
  ROOT_DIR,
  runBoundaryChecks,
} from '../scripts/check-boundaries.js';

describe('Feature 2: Boundary Checker & Layout Compliance', () => {
  it('emits advisory warnings for files between 240 and 300 lines without failing the build', () => {
    const result = runBoundaryChecks(ROOT_DIR);
    expect(result.checkedFilesCount).toBeGreaterThan(400);
    expect(result.warnings.length).toBeGreaterThan(0);
    for (const warning of result.warnings) {
      expect(warning).toMatch(/^\[check:boundaries\] WARNING: .* is near cap \(\d+\/300 lines\)$/);
    }
  });

  it('detects and flags illegal code/data files and reserved rule filenames in .agents/teamwork/', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'layout-compliance-'));
    const twDir = path.join(tmpDir, '.agents/teamwork', 'test_agent');
    fs.mkdirSync(twDir, { recursive: true });

    // Valid metadata files
    fs.writeFileSync(path.join(twDir, 'BRIEFING.md'), '# Briefing');
    fs.writeFileSync(path.join(twDir, 'progress.md'), '# Progress');
    fs.writeFileSync(path.join(twDir, '.gitkeep'), '');

    // Forbidden files
    fs.writeFileSync(path.join(twDir, 'forbidden.ts'), 'export const x = 1;');
    fs.writeFileSync(path.join(twDir, 'data.json'), '{}');
    fs.writeFileSync(path.join(twDir, 'script.js'), 'console.log(1);');
    fs.writeFileSync(path.join(twDir, 'view.tsx'), 'export const View = () => null;');
    fs.writeFileSync(path.join(twDir, 'AGENTS.md'), '# Override');

    const violations: string[] = [];
    checkTeamworkLayoutCompliance(tmpDir, violations);

    expect(violations).toHaveLength(5);
    expect(violations.some((v) => v.includes('forbidden.ts'))).toBe(true);
    expect(violations.some((v) => v.includes('data.json'))).toBe(true);
    expect(violations.some((v) => v.includes('script.js'))).toBe(true);
    expect(violations.some((v) => v.includes('view.tsx'))).toBe(true);
    expect(violations.some((v) => v.includes('AGENTS.md'))).toBe(true);

    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('passes layout compliance with zero violations when .agents/teamwork contains only metadata markdown', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'layout-clean-'));
    const twDir = path.join(tmpDir, '.agents/teamwork', 'test_agent');
    fs.mkdirSync(twDir, { recursive: true });

    fs.writeFileSync(path.join(twDir, 'handoff.md'), '# Handoff');
    fs.writeFileSync(path.join(twDir, 'progress.md'), '# Progress');
    fs.writeFileSync(path.join(twDir, '.gitkeep'), '');

    const violations: string[] = [];
    checkTeamworkLayoutCompliance(tmpDir, violations);

    expect(violations).toHaveLength(0);

    fs.rmSync(tmpDir, { recursive: true, force: true });
  });
});
