import path from 'node:path';
import fs from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  extractModuleSignatures,
  generateMockTestSuite,
  parseTestgenArgs,
  runTestgen,
  validateTypedBoundaries,
  validateTestSuiteStructure,
} from '../scripts/hermes-testgen.js';
import {
  parseVerifiedPrescriptions,
  routeVerifiedPrescriptionsToRoadmap,
} from '../scripts/update-state.js';

describe('Hermes Unit Test Generator (Phase 33 & Phase 1.3)', () => {
  const rootDir = path.resolve(__dirname, '../..');

  it('parses CLI arguments with Tier 1 code model defaults', () => {
    const config = parseTestgenArgs([
      'node',
      'script.js',
      '--target',
      'src/sim/spatial/portals.ts',
      '--output',
      'tests/sim/test-out.test.ts',
      '--mock',
    ]);
    expect(config.target).toBe('src/sim/spatial/portals.ts');
    expect(config.output).toBe('tests/sim/test-out.test.ts');
    expect(config.mock).toBe(true);
    expect(config.model).toMatch(/gemma4:12b-extended|hermes/);
  });

  it('extracts module signatures and imports deterministically', () => {
    const portalsPath = path.join(rootDir, 'src/sim/spatial/portals.ts');
    const { functions, imports } = extractModuleSignatures(portalsPath);

    expect(functions.length).toBeGreaterThanOrEqual(1);
    expect(functions.some((f) => f.includes('findPortalAtPoint'))).toBe(true);
    expect(imports.length).toBeGreaterThanOrEqual(1);
  });

  it('enforces Rule 2.3 untyped code rejection', () => {
    const dirtyCode = `
      export function bad(x: any): void {
        const y = x as unknown as string;
        // @ts-ignore
        console.log(y);
      }
    `;
    const check = validateTypedBoundaries(dirtyCode);
    expect(check.valid).toBe(false);
    expect(check.violations.length).toBe(3);

    const cleanCode = `
      export function good(x: string): number {
        return x.length;
      }
    `;
    expect(validateTypedBoundaries(cleanCode).valid).toBe(true);
  });

  it('enforces Phase 1.3 AST/regex validation gate on test suite structure', () => {
    // 1. Rejects test with fewer than 3 expect assertions
    const tooFewAsserts = `
      describe('Stub', () => {
        it('has one assert', () => {
          // Given (Seeded World)
          const world = createInitialWorld({ seed: 42 });
          // When (Command Dispatched via command-router.ts)
          const res = dispatchCommand(world, { type: 'WAIT_TURN' });
          // Then (ECS Component Delta + Domain Event Emitted + Frame Projection Verified)
          expect(res.state.entities).toBeDefined();
          const frame = projectWorldToVisualFrame(res.state);
        });
      });
    `;
    const res1 = validateTestSuiteStructure(tooFewAsserts);
    expect(res1.valid).toBe(false);
    expect(res1.violations.some((v) => v.includes('at least 3 state-delta expect(...)'))).toBe(true);

    // 2. Rejects test missing Given (Seeded World)
    const missingGiven = `
      describe('Missing Given', () => {
        it('does things without seeded world', () => {
          // When (Command Dispatched via command-router.ts)
          const res = dispatchCommand({} as any, { type: 'WAIT_TURN' });
          expect(res.state.entities).toBeDefined();
          expect(res.events).toBeDefined();
          const frame = projectWorldToVisualFrame(res.state);
          expect(frame).toBeDefined();
        });
      });
    `;
    const res2 = validateTestSuiteStructure(missingGiven);
    expect(res2.valid).toBe(false);
    expect(res2.violations.some((v) => v.includes('Given (Seeded World)'))).toBe(true);

    // 3. Rejects test missing When (Command Dispatched)
    const missingWhen = `
      describe('Missing When', () => {
        it('does not dispatch commands', () => {
          // Given (Seeded World)
          const world = createInitialWorld({ seed: 42 });
          expect(world.entities).toBeDefined();
          expect(world.turnCount).toBe(0);
          const frame = projectWorldToVisualFrame(world);
          expect(frame).toBeDefined();
        });
      });
    `;
    const res3 = validateTestSuiteStructure(missingWhen);
    expect(res3.valid).toBe(false);
    expect(res3.violations.some((v) => v.includes('When (Command Dispatched'))).toBe(true);

    // 4. Rejects test missing Frame Projection
    const missingFrame = `
      describe('Missing Frame', () => {
        it('skips frame projection', () => {
          // Given (Seeded World)
          const world = createInitialWorld({ seed: 42 });
          // When (Command Dispatched via command-router.ts)
          const res = dispatchCommand(world, { type: 'WAIT_TURN' });
          // Then (ECS Component Delta + Domain Event Emitted)
          expect(res.state.entities).toBeDefined();
          expect(res.events).toBeDefined();
          expect(res.state.turnCount).toBe(1);
        });
      });
    `;
    const res4 = validateTestSuiteStructure(missingFrame);
    expect(res4.valid).toBe(false);
    expect(res4.violations.some((v) => v.includes('Frame Projection Verified'))).toBe(true);
  });

  it('generates a valid deterministic test template for portals satisfying validation gate', () => {
    const template = generateMockTestSuite('src/sim/spatial/portals.ts', rootDir);
    expect(template).toContain("import { describe, expect, it } from 'vitest'");
    expect(template).toContain('createInitialWorld({ seed: 42 })');
    expect(template).toContain('findPortalAtPoint');
    expect(template).not.toContain('any');

    const validation = validateTestSuiteStructure(template);
    expect(validation.valid).toBe(true);
  });

  it('runs testgen in mock mode, producing a test that passes vitest run', async () => {
    const tempOutput = 'tests/sim/auto-portals-testgen.test.ts';
    const config = parseTestgenArgs([
      'node',
      'script.js',
      '--target',
      'src/sim/spatial/portals.ts',
      '--output',
      tempOutput,
      '--mock',
    ]);

    const result = await runTestgen(config, rootDir);
    expect(result.success).toBe(true);

    const fullTemp = path.join(rootDir, tempOutput);
    expect(fs.existsSync(fullTemp)).toBe(true);
    // Cleanup generated temp test
    fs.unlinkSync(fullTemp);
  });

  it('routes sanity-verified P0 and P1 critic prescriptions to structured backlog tables with deduplication', () => {
    const mockCriticContent = `
# Critic Audit
## 5. Self-Directed Prescriptions for Next Phase
- **P1: Phase 50 Tactical Breaching** [UNREACHABLE_MECHANIC]: Implement wall breaching and furniture looting. (Target: \`src/sim/core/engine.ts\` | Verification: \`tests/sim/determinism.test.ts\`)
- **P0_BLOCKER: Hotspot Decoupling** [MODULE_SPLIT]: Split oversized domain schemas. (Target: \`src/schemas/events.schema.ts\` | Verification: \`tests/sim/determinism.test.ts\`)
- **P2: Low Priority Polish** [SIM_BALANCE]: Secondary balance tweaks.

### Quarantined Prescriptions (Failed Deterministic Sanity Check)
- [QUARANTINED] **P1: Hallucinated Feature**: Proposes non-existent file path.
`;

    const parsed = parseVerifiedPrescriptions(mockCriticContent);
    expect(parsed.length).toBe(2);
    expect(parsed[0]?.id).toBe('P1');
    expect(parsed[0]?.title).toBe('Phase 50 Tactical Breaching');
    expect(parsed[1]?.id).toBe('P0_BLOCKER');

    const tempDir = path.join(rootDir, 'tests/sim/.temp-backlog');
    fs.mkdirSync(tempDir, { recursive: true });
    const tempCriticPath = path.join(tempDir, 'critic-audit.md');
    const tempRoadmapPath = path.join(tempDir, 'ROADMAP.md');
    const tempStatePath = path.join(tempDir, 'STATE.md');

    fs.writeFileSync(tempCriticPath, mockCriticContent, 'utf-8');
    fs.writeFileSync(tempRoadmapPath, '# Roadmap\n- [ ] Phase 1\n', 'utf-8');
    fs.writeFileSync(tempStatePath, '# State\n## Immediate Next Priority\n- Phase 1\n', 'utf-8');

    // First routing pass: appends 2 rows
    const res1 = routeVerifiedPrescriptionsToRoadmap(tempCriticPath, tempRoadmapPath, tempStatePath);
    expect(res1.routedCount).toBe(2);

    const roadmapContent1 = fs.readFileSync(tempRoadmapPath, 'utf-8');
    expect(roadmapContent1).toContain('## Autonomous Critic Backlog (Sanity-Verified)');
    expect(roadmapContent1).toContain('| P1 | UNREACHABLE_MECHANIC | Phase 50 Tactical Breaching |');
    expect(roadmapContent1).toContain('| P0_BLOCKER | MODULE_SPLIT | Hotspot Decoupling |');

    const stateContent1 = fs.readFileSync(tempStatePath, 'utf-8');
    expect(stateContent1).toContain('## Autonomous Critic Backlog (Sanity-Verified)');

    // Second routing pass: deduplicates and adds 0 rows
    const res2 = routeVerifiedPrescriptionsToRoadmap(tempCriticPath, tempRoadmapPath, tempStatePath);
    expect(res2.routedCount).toBe(0);

    // Cleanup temp directory
    fs.rmSync(tempDir, { recursive: true, force: true });
  });
});
