/**
 * Turns the CDK outputs file into the Vite env file used by `npm run dev`
 * and by the database scripts.
 *
 * Usage: tsx scripts/write-env.ts [cdk-outputs.json]
 */
import { readFileSync, writeFileSync } from 'node:fs';

const outputsFile = process.argv[2] ?? 'cdk-outputs.json';
const outputs: Record<string, Record<string, string>> = JSON.parse(
  readFileSync(outputsFile, 'utf8')
);

const stackName = Object.keys(outputs).find((name) => name.startsWith('PlanningManager-'));
if (!stackName) throw new Error(`No PlanningManager stack in ${outputsFile}`);
const stack = outputs[stackName];

const env = {
  STAGE: stackName.slice('PlanningManager-'.length),
  VITE_USER_POOL_ID: stack.UserPoolId,
  VITE_USER_POOL_CLIENT_ID: stack.UserPoolClientId,
  VITE_AUTH_DOMAIN: stack.AuthDomain,
  VITE_API_URL: stack.ApiUrl,
  DATABASE_ENDPOINT: stack.DatabaseEndpoint,
};

const lines = Object.entries(env).map(([key, value]) => {
  if (!value) throw new Error(`Missing output for ${key} in ${stackName}`);
  return `${key}=${value}`;
});
writeFileSync(
  '.env.local',
  `# Generated from ${outputsFile} (${stackName})\n${lines.join('\n')}\n`
);
console.log(`.env.local written for ${stackName}`);
