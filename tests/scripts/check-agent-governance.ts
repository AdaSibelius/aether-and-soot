import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

interface RuleCheckResult {
  readonly filename: string;
  readonly valid: boolean;
  readonly trigger?: string;
  readonly error?: string;
}

interface GovernanceReport {
  readonly rulesValid: boolean;
  readonly hooksValid: boolean;
  readonly totalRuleChars: number;
  readonly ruleChecks: readonly RuleCheckResult[];
  readonly hookErrors: readonly string[];
}

export function auditAgentGovernance(workspaceRoot: string): GovernanceReport {
  const rulesDir = path.join(workspaceRoot, '.agents/rules');
  const hooksFile = path.join(workspaceRoot, '.agents/hooks.json');
  const ruleChecks: RuleCheckResult[] = [];
  const hookErrors: string[] = [];

  let totalRuleChars = 0;

  // 1. Audit Rules Directory
  if (fs.existsSync(rulesDir)) {
    const entries = fs.readdirSync(rulesDir, { withFileTypes: true });
    for (const ent of entries) {
      if (ent.isDirectory()) {
        ruleChecks.push({
          filename: ent.name,
          valid: false,
          error: `Subdirectory '${ent.name}' forbidden in .agents/rules/ (must remain flat).`,
        });
        continue;
      }
      if (!ent.name.endsWith('.md')) {
        ruleChecks.push({
          filename: ent.name,
          valid: false,
          error: `Non-markdown file '${ent.name}' found in .agents/rules/.`,
        });
        continue;
      }

      const filePath = path.join(rulesDir, ent.name);
      const content = fs.readFileSync(filePath, 'utf-8');
      totalRuleChars += content.length;

      const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
      if (!frontmatterMatch) {
        ruleChecks.push({
          filename: ent.name,
          valid: false,
          error: 'Missing YAML frontmatter block (--- ... ---).',
        });
        continue;
      }

      const rawYaml = frontmatterMatch[1] ?? '';
      const triggerMatch = rawYaml.match(/trigger:\s*([a-z_]+)/);
      if (!triggerMatch || !['glob', 'model_decision', 'always_on'].includes(triggerMatch[1] ?? '')) {
        ruleChecks.push({
          filename: ent.name,
          valid: false,
          error: `Invalid or missing snake_case trigger in frontmatter: '${triggerMatch?.[1]}'`,
        });
        continue;
      }

      const trigger = triggerMatch[1]!;
      ruleChecks.push({
        filename: ent.name,
        valid: true,
        trigger,
      });
    }
  } else {
    hookErrors.push('Missing .agents/rules directory');
  }

  // 2. Audit Hooks File
  if (!fs.existsSync(hooksFile)) {
    hookErrors.push('Missing .agents/hooks.json');
  } else {
    try {
      const hooksJson = JSON.parse(fs.readFileSync(hooksFile, 'utf-8')) as Record<string, unknown>;
      const directArrayEvents = ['Stop', 'PreInvocation', 'PostInvocation'];
      for (const ev of directArrayEvents) {
        if (ev in hooksJson) {
          const val = hooksJson[ev];
          if (!Array.isArray(val)) {
            hookErrors.push(`Event '${ev}' must map directly to an array of handler objects.`);
          } else {
            for (const handler of val as Record<string, unknown>[]) {
              if (handler['hooks']) {
                hookErrors.push(`Event '${ev}' must not contain nested 'hooks' wrapper.`);
              }
              const cmd = handler['command'] as string | undefined;
              const resolvedCmd = cmd ? (path.isAbsolute(cmd) ? cmd : path.resolve(workspaceRoot, cmd)) : undefined;
              if (!resolvedCmd) {
                hookErrors.push(`Handler in '${ev}' must specify a command path: '${cmd}'`);
              } else if (!fs.existsSync(resolvedCmd)) {
                hookErrors.push(`Command file does not exist on disk: '${resolvedCmd}'`);
              }
              const timeout = handler['timeout'] as number | undefined;
              if (timeout === undefined || timeout < 15 || timeout > 60) {
                hookErrors.push(`Handler timeout in '${ev}' must be between 15 and 60 seconds (got: ${timeout})`);
              }
            }
          }
        }
      }

      const matchedEvents = ['PreToolUse', 'PostToolUse'];
      for (const ev of matchedEvents) {
        if (ev in hooksJson) {
          const val = hooksJson[ev];
          if (!Array.isArray(val)) {
            hookErrors.push(`Event '${ev}' must map to an array of matcher objects.`);
          } else {
            for (const handler of val as Record<string, unknown>[]) {
              if (!handler['matcher']) {
                hookErrors.push(`Handler in '${ev}' must specify a regex matcher.`);
              }
              const cmd = handler['command'] as string | undefined;
              const resolvedCmd = cmd ? (path.isAbsolute(cmd) ? cmd : path.resolve(workspaceRoot, cmd)) : undefined;
              if (!resolvedCmd) {
                hookErrors.push(`Handler in '${ev}' must specify a command path: '${cmd}'`);
              } else if (!fs.existsSync(resolvedCmd)) {
                hookErrors.push(`Command file does not exist on disk: '${resolvedCmd}'`);
              }
            }
          }
        }
      }
    } catch (err: unknown) {
      hookErrors.push(`Failed to parse .agents/hooks.json: ${(err as Error).message}`);
    }
  }

  // 3. Test execute validate-pre-tool.sh
  const preToolScript = path.join(workspaceRoot, '.agents/hooks/validate-pre-tool.sh');
  if (fs.existsSync(preToolScript)) {
    try {
      const samplePayload = JSON.stringify({
        toolCall: {
          name: 'write_file',
          args: { Path: 'src/client/test.ts', Content: 'console.log("ok");' },
        },
      });
      const out = execFileSync(preToolScript, { input: samplePayload, encoding: 'utf-8' });
      const parsed = JSON.parse(out.trim()) as { allow_tool: boolean };
      if (!parsed.allow_tool) {
        hookErrors.push('validate-pre-tool.sh unexpectedly rejected benign payload.');
      }
    } catch (err: unknown) {
      hookErrors.push(`Failed executing validate-pre-tool.sh: ${(err as Error).message}`);
    }
  }

  const rulesValid = ruleChecks.length > 0 && ruleChecks.every((r) => r.valid);
  const hooksValid = hookErrors.length === 0;

  return {
    rulesValid,
    hooksValid,
    totalRuleChars,
    ruleChecks,
    hookErrors,
  };
}

if (process.argv[1] && process.argv[1].endsWith('check-agent-governance.ts')) {
  const rootDir = process.cwd();
  const report = auditAgentGovernance(rootDir);

  console.log('=== Aether & Soot: Agent Governance Audit ===');
  console.log(`Rules valid: ${report.rulesValid ? 'YES' : 'NO'} (${report.ruleChecks.length} rules, ${report.totalRuleChars} chars)`);
  for (const r of report.ruleChecks) {
    console.log(`  - ${r.filename}: ${r.valid ? `PASS [${r.trigger}]` : `FAIL: ${r.error}`}`);
  }

  console.log(`Hooks valid: ${report.hooksValid ? 'YES' : 'NO'}`);
  for (const err of report.hookErrors) {
    console.log(`  - ERROR: ${err}`);
  }

  const passed = report.rulesValid && report.hooksValid;
  console.log(`Overall Governance Status: ${passed ? '100% PASS' : 'FAIL'}`);
  process.exit(passed ? 0 : 1);
}
