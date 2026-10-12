/**
 * Applies pending Drizzle migrations to the stage's Aurora DSQL cluster.
 * Reads DATABASE_ENDPOINT from .env.local (written by write-env.ts) and
 * connects as `admin` with the caller's IAM identity.
 */
import { drizzle, migrate } from '@aws/aurora-dsql-drizzle';

process.loadEnvFile('.env.local');

const host = process.env.DATABASE_ENDPOINT;
if (!host) throw new Error('DATABASE_ENDPOINT is not set (run write-env first)');

const db = drizzle({ connection: { host, user: 'admin', max: 1 } });
try {
  const result = await migrate(db, { migrationsFolder: 'api/db/migrations' });
  if (!result.success) throw new Error(result.error.message);
  console.log(`Migrations applied on ${host}`);
} finally {
  await db.$client.end();
}
