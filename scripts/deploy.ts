/**
 * Deploys a stage: its stacks (and the ones it depends on: the shared mail
 * stack, and for production the us-east-1 edge stack), then its database
 * migrations. Production serves the built app, so it is built first; a
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
  ...args,
]);
run('npx', ['tsx', 'scripts/db-migrate.ts']);
if (stage !== PROD_STAGE) run('npx', ['tsx', 'scripts/write-env.ts']);
