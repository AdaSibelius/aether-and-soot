import { resolveEndpoint, resolveModel } from './local-llm-config.js';

export interface CriticConfig {
  readonly skipPlaytest: boolean;
  readonly model: string;
  readonly endpoint: string;
  readonly mock: boolean;
  readonly output: string;
}

export function parseCriticArgs(argv: string[]): CriticConfig {
  const args = argv.slice(2);
  const getArg = (flag: string) => {
    const idx = args.indexOf(flag);
    return idx !== -1 && args[idx + 1] ? args[idx + 1] : undefined;
  };
  return {
    skipPlaytest: args.includes('--skip-playtest'),
    mock: args.includes('--mock'),
    model: getArg('--model') ?? resolveModel('tier1'),
    endpoint: getArg('--endpoint') ?? resolveEndpoint(),
    output: getArg('--output') ?? 'tests/artifacts/critic-audit.md',
  };
}
