// Runs the Python solver on problems in the API's JSON shape (tests only).
import { execFileSync } from 'node:child_process';

export interface SolveOutput {
  cells: { agentId: string; date: string; shiftTypeId: string | null }[];
  stats: Record<string, number | string>;
}

export function solve<P>(problems: P[]): SolveOutput[] {
  const output = execFileSync(
    'uv',
    ['run', '--directory', 'solver', 'python', '-m', 'solver.cli'],
    {
      input: JSON.stringify(problems),
      encoding: 'utf8',
      maxBuffer: 10 * 1024 * 1024,
    }
  );
  return JSON.parse(output) as SolveOutput[];
}
