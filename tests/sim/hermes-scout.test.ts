import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  generateDeterministicScoutReport,
  parseScoutArgs,
  runScout,
  scanCodebaseFiles,
} from '../scripts/hermes-scout.js';

describe('Hermes Codebase Scout (Phase 32)', () => {
  const rootDir = path.resolve(__dirname, '../..');

  it('parses CLI arguments with tiered model routing defaults', () => {
    const config = parseScoutArgs(['node', 'script.js', '--task', 'Add pneumatic railway', '--mock', '--json']);
    expect(config.task).toBe('Add pneumatic railway');
    expect(config.mock).toBe(true);
    expect(config.json).toBe(true);
    expect(config.model).toMatch(/gemma4:12b-extended|hermes/);
  });

  it('scans codebase files, extracts exports and identifies near-cap files', () => {
    const files = scanCodebaseFiles(rootDir);
    expect(files.length).toBeGreaterThan(40);

    const gridFile = files.find((f) => f.relPath.includes('grid.ts'));
    expect(gridFile).toBeDefined();
    expect(gridFile?.exports).toContain('getTileCell');
    expect(gridFile?.exports).toContain('setTileCell');
    expect(gridFile?.lineCount).toBeGreaterThan(50);

    const nearCapFiles = files.filter((f) => f.isNearCap);
    expect(nearCapFiles.length).toBeGreaterThanOrEqual(1);
    expect(nearCapFiles.some((f) => f.lineCount >= 240)).toBe(true);
  });

  it('generates a complete 5-point Pre-Flight checklist deterministically', () => {
    const files = scanCodebaseFiles(rootDir);
    const report = generateDeterministicScoutReport('Add pneumatic steam railway to Spire', files);

    expect(report).toContain('### Pre-Flight Impact Analysis Checklist');
    expect(report).toContain('1. **Schemas Impacted');
    expect(report).toContain('2. **Serialization & Save-State Impact');
    expect(report).toContain('3. **Existing Infrastructure Reused');
    expect(report).toContain('4. **File Size & Modularity Check');
    expect(report).toContain('5. **Client / HUD Impact');
  });

  it('runs scout in mock mode and formats JSON output cleanly', async () => {
    const config = parseScoutArgs(['node', 'script.js', '--task', 'Test Task', '--mock', '--json']);
    const output = await runScout(config, rootDir);
    const parsed = JSON.parse(output) as { task: string; filesCount: number; report: string };

    expect(parsed.task).toBe('Test Task');
    expect(parsed.filesCount).toBeGreaterThan(40);
    expect(parsed.report).toContain('Pre-Flight Impact Analysis');
  });
});
