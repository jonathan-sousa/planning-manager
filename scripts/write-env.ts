/**
 * Writes `.env.local` from the CDK outputs of a development stage (STAGE, or
 * the developer's own): the Vite dev server serves these values as
 * /config.json (vite.config.ts). Run by `npm run infra:deploy`.
 *
 * Usage: npm run env:write
 */
import { writeFileSync } from 'node:fs';
import { output, readStageOutputs } from './stage-outputs';

const stack = readStageOutputs();
const env = {
  STAGE: stack.stage,
  USER_POOL_ID: output(stack, 'UserPoolId'),
  USER_POOL_CLIENT_ID: output(stack, 'UserPoolClientId'),
  AUTH_DOMAIN: output(stack, 'AuthDomain'),
  API_URL: output(stack, 'ApiUrl'),
};
const lines = Object.entries(env).map(([key, value]) => `${key}=${value}`);
writeFileSync(
  '.env.local',
  `# Generated from the CDK outputs (${stack.stage})\n${lines.join('\n')}\n`
);
console.log(`.env.local written for ${stack.stage}`);
