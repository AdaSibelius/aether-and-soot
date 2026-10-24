export interface ValidationResult {
  readonly valid: boolean;
  readonly violations: readonly string[];
}

export function validateTypedBoundaries(code: string): ValidationResult {
  const violations: string[] = [];
  if (/\bany\b/.test(code)) violations.push('Rule 2.3: "any" is forbidden.');
  if (/as\s+unknown\s+as/.test(code)) violations.push('Rule 2.3: "as unknown as" is forbidden.');
  if (/@ts-ignore|@ts-expect-error/.test(code)) violations.push('Rule 2.3: TypeScript ignore pragmas are forbidden.');
  return { valid: violations.length === 0, violations };
}

export function validateTestSuiteStructure(code: string): ValidationResult {
  const violations: string[] = [];

  // 1. Minimum 3 expect assertions
  const expectMatches = code.match(/\bexpect\s*\(/g);
  const expectCount = expectMatches?.length ?? 0;
  if (expectCount < 3) {
    violations.push(
      `Rule 1.3: Generated test must contain at least 3 state-delta expect(...) assertions (found ${expectCount}).`,
    );
  }

  // 2. Given (Seeded World via createInitialWorld)
  const hasGiven = /\bcreateInitialWorld\s*\(/i.test(code);
  if (!hasGiven) {
    violations.push('Rule 1.3: Missing "Given (Seeded World)" structure: must initialize seeded world state.');
  }

  // 3. When (Command Dispatched via command-router.ts)
  const hasWhen = /\b(?:dispatchCommand|routeDomainCommand)\s*\(/i.test(code);
  if (!hasWhen) {
    violations.push(
      'Rule 1.3: Missing "When (Command Dispatched via command-router.ts)" structure: must dispatch a simulation command.',
    );
  }

  // 4. Then (ECS Component Delta + Domain Event Emitted + Frame Projection Verified)
  const hasEcsDelta =
    /(?:entities\[|state\.entities|anatomy|position|safehouses|furniture|pressureVessel|inventory|components)/i.test(
      code,
    );
  if (!hasEcsDelta) {
    violations.push('Rule 1.3: Missing "Then (ECS Component Delta)" structure: must assert component/entity state delta.');
  }

  const hasDomainEvent = /(?:\.events|\.eventLog)/i.test(code);
  if (!hasDomainEvent) {
    violations.push('Rule 1.3: Missing "Then (Domain Event Emitted)" structure: must assert emitted domain events.');
  }

  const hasFrameProjection = /\bprojectWorldToVisualFrame\s*\(/i.test(code);
  if (!hasFrameProjection) {
    violations.push(
      'Rule 1.3: Missing "Then (Frame Projection Verified)" structure: must verify visual frame projection via projectWorldToVisualFrame.',
    );
  }

  return { valid: violations.length === 0, violations };
}

export function validateGeneratedTestSuite(code: string): ValidationResult {
  const boundary = validateTypedBoundaries(code);
  const structure = validateTestSuiteStructure(code);
  const violations = [...boundary.violations, ...structure.violations];
  return { valid: violations.length === 0, violations };
}
