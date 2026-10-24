import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { resolveEndpoint, resolveModel, queryLocalOllama } from './local-llm-config.js';
import { recordInferenceMetric } from './local-llm-ledger.js';
import { extractFunctionSignaturesViaAst } from './ast-indexer.js';
import {
  validateTypedBoundaries,
  validateTestSuiteStructure,
  validateGeneratedTestSuite,
} from './hermes-testgen-validator.js';
import { generateMockTestSuite } from './hermes-testgen-mock.js';

export {
  validateTypedBoundaries,
  validateTestSuiteStructure,
  validateGeneratedTestSuite,
  generateMockTestSuite,
};

export interface TestgenConfig {
  readonly target: string;
  readonly output: string;
  readonly count: number;
  readonly model: string;
  readonly endpoint: string;
  readonly apiKey: string;
  readonly mock: boolean;
}

export function parseTestgenArgs(argv: string[]): TestgenConfig {
  const args = argv.slice(2);
  let target = 'src/sim/spatial/portals.ts';
  let output = 'tests/sim/auto-portals.test.ts';
  let count = 2;
  let mock = false;
  let model = resolveModel('tier2');
  let endpoint = resolveEndpoint();
  const apiKey = process.env['API_KEY'] ?? 'aether-dev-key';

  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === '--target' && args[i + 1]) target = args[++i] ?? target;
    else if (a === '--output' && args[i + 1]) output = args[++i] ?? output;
    else if (a === '--count' && args[i + 1]) count = Math.max(1, parseInt(args[++i] ?? '2', 10));
    else if (a === '--model' && args[i + 1]) model = args[++i] ?? model;
    else if (a === '--endpoint' && args[i + 1]) endpoint = args[++i] ?? endpoint;
    else if (a === '--mock') mock = true;
  }
  return { target, output, count, model, endpoint, apiKey, mock };
}

export function extractModuleSignatures(filePath: string): { functions: string[]; imports: string[] } {
  return extractFunctionSignaturesViaAst(filePath);
}

export async function requestHermesTestSuite(config: TestgenConfig, signatures: string[], rootDir: string): Promise<string> {
  if (config.mock) {
    recordInferenceMetric({
      timestamp: new Date().toISOString(),
      task: 'hermes-testgen',
      tier: 'tier2',
      model: config.model,
      prompt_tokens: 0,
      completion_tokens: 0,
      duration_ms: 0,
      retry_count: 0,
      success: true,
      cache_hit: true,
    });
    return generateMockTestSuite(config.target, rootDir, signatures);
  }

  const prompt = `You are a strict Vitest test engineer for "Aether & Soot" (Victorian Steampunk roguelike).
Target file: "${config.target}"
Exported signatures:
${signatures.join('\n')}

Requirements:
1. Vitest tests using createInitialWorld({ seed: 42 }) from '../../src/sim/core/world.js'.
2. Structure: Given (Seeded World) -> When (Command Dispatched via command-router.ts) -> Then (ECS Component Delta + Domain Event Emitted + Frame Projection Verified).
3. At least three state-delta expect(...) assertions.
4. Relative imports targeting .js extensions.
5. Strict TypeScript: "noUncheckedIndexedAccess: true". Guard all lookups.
6. FORBIDDEN: any, as unknown as, @ts-ignore.
Output ONLY the TypeScript test file.`;

  try {
    const raw = await queryLocalOllama(prompt, {
      model: config.model,
      endpoint: config.endpoint,
      systemPrompt: 'You are a strict Vitest test engineer for Aether & Soot. Output ONLY valid TypeScript test suites satisfying Given -> When -> Then structure with >= 3 expect() assertions.',
      temperature: 0.2,
      task: 'hermes-testgen',
      tier: 'tier2',
    });
    const clean = raw.trim().replace(/^```[a-z]*\n?/i, '').replace(/\n?```$/i, '').trim();
    if (!clean.includes('describe')) {
      console.error('FATAL: Local LLM connection failed. Aborting to prevent paid token burn.');
      process.exit(1);
    }
    return clean;
  } catch {
    console.error('FATAL: Local LLM connection failed. Aborting to prevent paid token burn.');
    process.exit(1);
  }
}

export async function requestLlmTestRepair(
  config: TestgenConfig,
  currentTestCode: string,
  tscErrors: string,
  attempt: number,
): Promise<string> {
  const prompt = `You are a strict Vitest test engineer fixing a TypeScript compiler error for "Aether & Soot" (Victorian Steampunk roguelike).
Target file: "${config.target}"
Attempt: ${attempt} of 3

Current Test Code:
\`\`\`ts
${currentTestCode}
\`\`\`

TypeScript Compiler Error Diagnostics:
${tscErrors.slice(0, 1500)}

Requirements:
1. Fix all TypeScript compile errors, import specifiers, and variable/parameter types.
2. Structure: Given (Seeded World) -> When (Command Dispatched via command-router.ts) -> Then (Assertions).
3. Strict TypeScript: "noUncheckedIndexedAccess: true". Guard all lookups.
4. FORBIDDEN: any, as unknown as, @ts-ignore.
5. Anti-tautology rule: DO NOT mutate or weaken domain expect() targets. Fix types, mocks, and imports only.
Output ONLY the complete corrected TypeScript test file.`;

  try {
    const raw = await queryLocalOllama(prompt, {
      model: config.model,
      endpoint: config.endpoint,
      systemPrompt: 'You are a strict Vitest repair engineer for Aether & Soot. Return ONLY valid TypeScript test suites. Do not include markdown codeblocks or conversational text.',
      temperature: 0.1,
      task: 'hermes-testgen-repair',
      tier: 'tier2',
      retryCount: attempt,
    });
    const clean = raw.trim().replace(/^```[a-z]*\n?/i, '').replace(/\n?```$/i, '').trim();
    if (!clean.includes('describe')) {
      console.error('FATAL: Local LLM repair failed. Aborting to prevent paid token burn.');
      process.exit(1);
    }
    return clean;
  } catch {
    console.error('FATAL: Local LLM repair failed. Aborting to prevent paid token burn.');
    process.exit(1);
  }
}

export async function runTestgen(config: TestgenConfig, rootDir: string): Promise<{ success: boolean; message: string }> {
  const targetFullPath = path.resolve(rootDir, config.target);
  const outputFullPath = path.resolve(rootDir, config.output);
  const { functions } = extractModuleSignatures(targetFullPath);
  console.log(`[hermes-testgen] Target: ${config.target} (${functions.length} exported functions).`);

  let testCode = await requestHermesTestSuite(config, functions, rootDir);
  const boundaryCheck = validateTypedBoundaries(testCode);
  if (!boundaryCheck.valid) {
    throw new Error(`Rule 2.3 Violation in generated code:\n${boundaryCheck.violations.join('\n')}`);
  }
  const structureCheck = validateTestSuiteStructure(testCode);
  if (!structureCheck.valid) {
    throw new Error(`Rule 1.3 Validation Gate Failed:\n${structureCheck.violations.join('\n')}`);
  }

  fs.mkdirSync(path.dirname(outputFullPath), { recursive: true });
  fs.writeFileSync(outputFullPath, testCode, 'utf-8');

  // Step A: Type & Import Healing loop
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      execSync('npx tsc --noEmit', { cwd: rootDir, stdio: 'pipe' });
      break;
    } catch (err: unknown) {
      const execErr = err as { stdout?: Buffer; stderr?: Buffer };
      const stderr = (execErr.stdout?.toString() ?? '') + (execErr.stderr?.toString() ?? '');
      if (attempt === 3) throw new Error(`[hermes-testgen] tsc compilation failed after 3 attempts:\n${stderr}`);
      console.warn(`[hermes-testgen] tsc error on attempt ${attempt}. Repairing imports/types...`);
      if (config.mock) {
        testCode = generateMockTestSuite(config.target, rootDir, functions);
      } else {
        testCode = await requestLlmTestRepair(config, testCode, stderr, attempt);
      }
      fs.writeFileSync(outputFullPath, testCode, 'utf-8');
    }
  }

  // Step B: Runtime test execution
  try {
    execSync(`npx vitest run ${config.output}`, { cwd: rootDir, stdio: 'pipe' });
    console.log(`[hermes-testgen] Test suite passed cleanly: ${config.output}`);
    return { success: true, message: `Generated ${config.output} and passed vitest run.` };
  } catch (err: unknown) {
    const execErr = err as { stdout?: Buffer; stderr?: Buffer };
    const out = (execErr.stdout?.toString() ?? '') + (execErr.stderr?.toString() ?? '');
    throw new Error(`[hermes-testgen] vitest run failed (anti-tautology rule: expect() targets must not be mutated):\n${out}`);
  }
}

if (process.argv[1]?.endsWith('hermes-testgen.ts')) {
  const config = parseTestgenArgs(process.argv);
  const root = path.resolve(import.meta.dirname, '../..');
  runTestgen(config, root)
    .then((r) => console.log(r.message))
    .catch((err) => {
      console.error(`[hermes-testgen] Error: ${err.message}`);
      process.exit(1);
    });
}
