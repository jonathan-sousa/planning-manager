import { drizzle } from '@aws/aurora-dsql-drizzle';
import * as schema from './schema';

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set`);
  return value;
}

// One pool per Lambda execution environment, reused across warm invocations.
// IAM token generation and TLS are handled by the DSQL connector.
export const db = drizzle({
  connection: {
    host: requireEnv('DATABASE_ENDPOINT'),
    user: 'admin',
    max: 2,
    idleTimeoutMillis: 60_000,
  },
  schema,
});

export type Db = typeof db;
