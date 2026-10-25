import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  collectAllArchitectureFiles,
  generateArchitectureMap,
  writeArchitectureMap,
} from '../scripts/generate-architecture-map.js';

describe('Architecture Map Generator (Phase 4)', () => {
  const rootDir = process.cwd();

  it('collects all source and tooling files from src/ and tests/scripts/', () => {
    const files = collectAllArchitectureFiles(rootDir);
    expect(files.length).toBeGreaterThan(50);

    const relPaths = files.map((f) => f.relPath);
    expect(relPaths.some((p) => p.startsWith('src/schemas/'))).toBe(true);
    expect(relPaths.some((p) => p.startsWith('src/sim/core/'))).toBe(true);
    expect(relPaths.some((p) => p.startsWith('src/client/'))).toBe(true);
    expect(relPaths.some((p) => p.startsWith('tests/scripts/'))).toBe(true);

    // Every file must have positive lines and non-empty hash
    for (const f of files) {
      expect(f.lineCount).toBeGreaterThan(0);
      expect(f.hash).toBeDefined();
    }
  });

  it('generates markdown architecture map with health telemetry and modularity watchlist', () => {
    const map = generateArchitectureMap(rootDir);

    expect(map).toContain('# System Architecture Map — Aether & Soot');
    expect(map).toContain('## Codebase Telemetry & Modularity Health');
    expect(map).toContain('- **Modularity Gate Status**:');
    expect(map).toContain('Ring 1: Schemas & Contracts');
    expect(map).toContain('Ring 2: Simulation Core & Scheduling');
    expect(map).toContain('Ring 3: Presentation Shell & Renderer');
    expect(map).toContain('Tooling & Headless LLM Pipeline');

    // Confirm that table rows contain line counts and status emojis
    expect(map).toMatch(/\| `src\/sim\/core\/world\.ts` \| \d+ \| (✅ OK|⚠️ WARN|❌ FAIL) \|/);
  });

  it('writes architecture map to target path and persists file', () => {
    const tempOut = path.join(rootDir, 'docs/test-architecture-map.md');
    try {
      const writtenPath = writeArchitectureMap(rootDir, tempOut);
      expect(fs.existsSync(writtenPath)).toBe(true);
      const content = fs.readFileSync(writtenPath, 'utf-8');
      expect(content).toContain('# System Architecture Map — Aether & Soot');
    } finally {
      if (fs.existsSync(tempOut)) fs.unlinkSync(tempOut);
    }
  });
});
