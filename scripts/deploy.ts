/**
 * Deploys a stage, then its database migrations. Production also deploys the
 * stacks it depends on: the shared mail stack, which every stage sends
 * through, and its us-east-1 edge stack. A change to them thus goes out with
 * production only, never from a development stage, which deploys its own
 * stack alone. Production serves the built app, so it is built first; a
 * development stage gets its .env.local for the Vite dev server.
 *
 * Usage: npm run infra:deploy [-- <stage>] [cdk deploy options]
 */
import { spawnSync } from 'node:child_process';
import { PROD_STAGE, resolveStage } from '../infra/lib/stage';
import { outputsFile } from './stage-outputs';

const args = process.argv.slice(2);
const stage = resolveStage(args[0]?.startsWith('-') ? undefined : args.shift());

function run(command: string, commandArgs: string[]) {
  const { status } = spawnSync(command, commandArgs, {
    stdio: 'inherit',
    env: { ...process.env, STAGE: stage },
  });
  if (status !== 0) process.exit(status ?? 1);
}

if (stage === PROD_STAGE) run('npm', ['run', 'build']);
run('npx', [
  'cdk',
  'deploy',
  `PlanningManager-${stage}`,
  '-c',
  `stage=${stage}`,
  '--outputs-file',
  outputsFile(stage),
  ...(stage === PROD_STAGE ? [] : ['--exclusively']),
  ...args,
]);
run('npx', ['tsx', 'scripts/db-migrate.ts']);
if (stage !== PROD_STAGE) run('npx', ['tsx', 'scripts/write-env.ts']);
