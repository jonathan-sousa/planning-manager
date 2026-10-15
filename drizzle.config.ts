import { defineConfig } from 'drizzle-kit';

// Migrations are generated with `npm run db:generate`, which runs drizzle-kit
// then rewrites the SQL for Aurora DSQL (CREATE INDEX ASYNC, etc.).
export default defineConfig({
  dialect: 'postgresql',
  schema: './db/schema.ts',
  out: './db/migrations',
});
