import { drizzle } from '@aws/aurora-dsql-drizzle';
import * as schema from './schema';

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set`);
  return value;
}

// One connection per Lambda execution environment (one invocation at a time),
// reused while warm. IAM token generation and TLS are handled by the DSQL
// connector; the short idle timeout avoids handing out sockets the server
// closed while the sandbox was frozen.
export const db = drizzle({
  connection: {
    host: requireEnv('DATABASE_ENDPOINT'),
    user: 'admin',
    max: 1,
    idleTimeoutMillis: 10_000,
  },
  schema,
});

export type Db = typeof db;
