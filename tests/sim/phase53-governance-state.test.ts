import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { ProjectState, ProjectStateSchema } from '../../src/schemas/project-state.schema.js';
import {
  compileAgentsMarkdown,
  compileRoadmapMarkdown,
  compileStateMarkdown,
  parseVerifiedPrescriptions,
  updateStateFile,
} from '../scripts/update-state.js';
import { resolvePhaseDomainTargetFiles } from '../scripts/hermes-critic.js';

describe('Phase 53: State Machine Modernization & Governance Tooling', () => {
  const rootDir = path.resolve(__dirname, '../..');

  it('validates .agents/state.json against ProjectStateSchema', () => {
    const statePath = path.join(rootDir, '.agents/state.json');
    expect(fs.existsSync(statePath)).toBe(true);

    const raw = JSON.parse(fs.readFileSync(statePath, 'utf-8'));
    const parsed = ProjectStateSchema.parse(raw);

    expect(parsed.version).toBe(1);
    expect(parsed.activePhase).toBeGreaterThanOrEqual(53);
    expect(parsed.immediateNextPriority).toMatch(/Phase\s*\d+/);
    expect(parsed.phases.length).toBeGreaterThanOrEqual(53);

    const phase53 = parsed.phases.find((p) => p.number === 53);
    expect(phase53).toBeDefined();
    expect(phase53?.title).toContain('State Machine Modernization');
    expect(phase53?.status).toBe('COMPLETED');

    // Asserts schema failure on invalid shape
    expect(() => ProjectStateSchema.parse({ ...raw, activePhase: -1 })).toThrow();
    expect(() => ProjectStateSchema.parse({ ...raw, phases: [] })).toThrow();
  });

  it('enforces compiler idempotence on compileStateMarkdown', () => {
    const mockState: ProjectState = {
      version: 1,
      lastUpdated: '2026-10-25',
      activePhase: 53,
      immediateNextPriority: 'Phase 54: Causal Supply Chains & Disruption Cascades: Macro-tick simulation',
      recentCommits: [{ hash: 'abcdef1', message: 'feat: mock commit' }],
      phases: [
        {
          number: 53,
          title: 'State Machine Modernization',
          status: 'COMPLETED',
          tier: 'Tier G',
          summary: 'Tooling test summary',
          details: [],
          targetFiles: ['tests/scripts/update-state.ts'],
        },
      ],
      hotspots: [{ file: 'src/sim/core/engine.ts', lines: 235, threshold: 230, status: 'SAFE' }],
      prescriptions: [
        {
          id: 'P1',
          priority: 'P1',
          category: 'UNREACHABLE_MECHANIC',
          title: 'Phase 54 Supply',
          directive: 'Implement supply simulation.',
          targetFiles: ['src/sim/systems/economy.system.ts'],
          verification: 'tests/sim/determinism.test.ts',
        },
        {
          id: 'P1', // Duplicate ID test
          priority: 'P1',
          category: 'UNREACHABLE_MECHANIC',
          title: 'Phase 54 Supply Duplicate',
          directive: 'Duplicate directive.',
          targetFiles: ['src/sim/systems/economy.system.ts'],
          verification: 'tests/sim/determinism.test.ts',
        },
      ],
    };

    const pass1 = compileStateMarkdown(mockState);
    expect(pass1).toContain('# Project State');
    expect(pass1).toContain('## Recent Commits\n- abcdef1: feat: mock commit');
    expect(pass1).toContain('Implement **Phase 54**: Causal Supply Chains');
    // Verifies duplicate P1 is deduplicated
    expect(pass1.split('| P1 |').length - 1).toBe(1);

    const pass2 = compileStateMarkdown(mockState);
    expect(pass1).toBe(pass2);
  });

  it('enforces compiler idempotence on compileRoadmapMarkdown without regex drift', () => {
    const sampleCritic = `## 5. Self-Directed Prescriptions for Next Phase\n- **P1: Phase 54** [UNREACHABLE_MECHANIC]: Implement supply chains. (Target: \`src/sim/systems/economy.system.ts\` | Verification: \`tests/sim/determinism.test.ts\`)`;
    const parsedPrescriptions = parseVerifiedPrescriptions(sampleCritic);
    expect(parsedPrescriptions.length).toBe(1);
    expect(parsedPrescriptions[0]?.id).toBe('P1');

    const initialContent = `# Roadmap\n\n### Tier G\n\n- [ ] **Phase 53: State Machine Modernization & Governance Tooling**\n- [ ] **Phase 54: Supply Chains**\n`;
    const phases = [
      {
        number: 53,
        title: 'State Machine Modernization & Governance Tooling',
        status: 'COMPLETED' as const,
        tier: 'Tier G',
        summary: 'State modernization',
        details: [],
        targetFiles: [],
      },
    ];
    const prescriptions = [
      {
        id: 'P1',
        category: 'UNREACHABLE_MECHANIC',
        title: 'Phase 54',
        directive: 'Implement supply chains.',
        targetFiles: ['src/sim/systems/economy.system.ts'],
        verification: 'tests/sim/determinism.test.ts',
      },
      {
        id: 'P1',
        category: 'UNREACHABLE_MECHANIC',
        title: 'Phase 54',
        directive: 'Implement supply chains duplicate.',
        targetFiles: ['src/sim/systems/economy.system.ts'],
        verification: 'tests/sim/determinism.test.ts',
      },
    ];

    const pass1 = compileRoadmapMarkdown(initialContent, phases, prescriptions);
    expect(pass1).toContain('- [x] **Phase 53: State Machine Modernization & Governance Tooling** *(Completed)*');
    expect(pass1).toContain('## Autonomous Critic Backlog (Sanity-Verified)');
    // Duplicate title/id must be filtered out
    expect(pass1.split('| P1 |').length - 1).toBe(1);

    // Second compilation pass on the output must be 100% idempotent
    const pass2 = compileRoadmapMarkdown(pass1, phases, prescriptions);
    expect(pass2).toBe(pass1);
    expect(pass2).not.toContain('*(Completed)* *(Completed)*');
  });

  it('compiles AGENTS.md dynamically with live near-cap telemetry', () => {
    const mockAgents = `# Agents\n\n- **Warning on Near-Cap Files (>= 240 lines)**: \`old/file.ts\` (248 lines). Do NOT add new functions to these files—extract sub-modules via \`npm run hermes:split\` before adding new logic.\n`;
    const nearCaps = [
      { file: 'src/client/ui/AtlasWindow.tsx', lines: 247 },
      { file: 'src/sim/systems/trade.system.ts', lines: 242 },
    ];

    const pass1 = compileAgentsMarkdown(mockAgents, nearCaps);
    expect(pass1).toContain('`src/client/ui/AtlasWindow.tsx` (247 lines), `src/sim/systems/trade.system.ts` (242 lines)');

    const pass2 = compileAgentsMarkdown(pass1, nearCaps);
    expect(pass2).toBe(pass1);
  });

  it('resolves phase domain target files based on semantic keywords rather than line count', () => {
    const govFiles = resolvePhaseDomainTargetFiles('Phase 53: State Machine Modernization & Governance Tooling', rootDir);
    expect(govFiles).toEqual(['tests/scripts/update-state.ts', 'src/schemas/project-state.schema.ts']);

    const supplyFiles = resolvePhaseDomainTargetFiles('Phase 54: Causal Supply Chains & Disruption Cascades', rootDir);
    expect(supplyFiles.length).toBeGreaterThanOrEqual(1);

    const fallbackFiles = resolvePhaseDomainTargetFiles('Phase 99: Unknown Exotic Domain', rootDir);
    expect(fallbackFiles.length).toBeGreaterThanOrEqual(1);
    expect(fallbackFiles.some((f) => f.includes('src/sim/core/'))).toBe(true);
  });

  it('executes updateStateFile end-to-end in an isolated mock sandbox directory', () => {
    const tempDir = path.join(rootDir, 'tests/sim/.mock-phase53-state');
    fs.mkdirSync(path.join(tempDir, '.agents'), { recursive: true });

    const mockState = {
      version: 1,
      lastUpdated: '2026-10-25',
      activePhase: 53,
      immediateNextPriority: 'Phase 54: Causal Supply Chains & Disruption Cascades: Macro-tick simulation',
      recentCommits: [{ hash: '0000000', message: 'initial mock' }],
      phases: [
        {
          number: 53,
          title: 'State Machine Modernization',
          status: 'COMPLETED',
          tier: 'Tier G',
          summary: 'Tooling test summary',
          details: [],
          targetFiles: ['tests/scripts/update-state.ts'],
        },
      ],
      hotspots: [],
      prescriptions: [],
    };

    fs.writeFileSync(path.join(tempDir, '.agents/state.json'), JSON.stringify(mockState, null, 2), 'utf-8');
    fs.writeFileSync(path.join(tempDir, 'ROADMAP.md'), '# Roadmap\n- [ ] **Phase 53: State Machine Modernization**\n', 'utf-8');
    fs.writeFileSync(path.join(tempDir, 'STATE.md'), '# State\n', 'utf-8');
    fs.writeFileSync(path.join(tempDir, 'AGENTS.md'), '- **Warning on Near-Cap Files (>= 240 lines)**: none.\n', 'utf-8');

    const result = updateStateFile(tempDir);
    expect(result).toContain('# Project State');
    expect(fs.readFileSync(path.join(tempDir, 'ROADMAP.md'), 'utf-8')).toContain('*(Completed)*');
    expect(fs.readFileSync(path.join(tempDir, 'AGENTS.md'), 'utf-8')).toContain('Warning on Near-Cap Files');

    fs.rmSync(tempDir, { recursive: true, force: true });
  });
});
