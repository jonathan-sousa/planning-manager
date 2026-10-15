// In-memory PostgreSQL (PGlite) standing in for Aurora DSQL in the route
// tests: `vi.mock('<path>/db/client', () => import('<path>/test/db'))`.
import { readdirSync, readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import * as schema from '../../db/schema';

const MIGRATIONS = 'db/migrations';

const client = new PGlite();

// The committed migrations, minus what only DSQL knows: asynchronous index
// creation and constraint validation.
for (const file of readdirSync(MIGRATIONS)
  .filter((name) => name.endsWith('.sql'))
  .sort()) {
  const sql = readFileSync(`${MIGRATIONS}/${file}`, 'utf8');
  for (const statement of sql.split('--> statement-breakpoint')) {
    await client.exec(statement.replaceAll(/\b(INDEX|TABLE) ASYNC\b/g, '$1'));
  }
}

const tables = (
  await client.query<{ name: string }>(
    "SELECT tablename AS name FROM pg_tables WHERE schemaname = 'public'"
  )
).rows.map((row) => `"${row.name}"`);

const pglite = drizzle({ client, schema });

/** The DSQL client's API: DSQL retries a transaction on conflict, PGlite has none. */
export const db = Object.assign(pglite, {
  transactionWithRetry: pglite.transaction.bind(pglite),
});

/** Empties every table between two tests, back to the state after the migrations. */
export async function resetDb() {
  await client.exec(`TRUNCATE ${tables.join(', ')}`);
  await client.exec(`INSERT INTO rule_settings (id) VALUES ('default')`);
}
