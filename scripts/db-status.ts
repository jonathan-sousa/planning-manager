/**
 * Progress of the migrations on the stage's database: statements applied out
 * of those in api/db/migrations, and the DSQL asynchronous jobs in progress
 * (indexes, constraint validations), which the migrator waits for.
 *
 * Usage: npm run db:status [-- --watch]   (CDK_OUTPUTS for another stage)
 */
import { readdirSync, readFileSync } from 'node:fs';
import { drizzle } from '@aws/aurora-dsql-drizzle';
import { sql } from 'drizzle-orm';
import { output, readStageOutputs } from './stage-outputs';

const dir = 'api/db/migrations';
const total = readdirSync(dir)
  .filter((file) => file.endsWith('.sql'))
  .reduce(
    (sum, file) =>
      sum + readFileSync(`${dir}/${file}`, 'utf8').split('--> statement-breakpoint').length,
    0
  );

const db = drizzle({
  connection: { host: output(readStageOutputs(), 'DatabaseEndpoint'), user: 'admin', max: 1 },
});

async function report() {
  const applied = await db
    .execute<{ n: number }>(sql`SELECT count(*)::int AS n FROM drizzle.__drizzle_migrations`)
    .then(({ rows }) => rows[0]!.n)
    .catch(() => 0);
  const { rows: jobs } = await db.execute<{ job_id: string; status: string; details: string }>(
    sql`SELECT job_id, status, details FROM sys.jobs WHERE status NOT IN ('completed', 'failed', 'cancelled')`
  );
  const running =
    jobs
      .map((job) => [job.job_id, job.status, job.details].filter(Boolean).join(' '))
      .join(' ; ') || 'aucune';
  console.log(
    `${new Date().toLocaleTimeString('fr')}  ${applied}/${total} instructions, tâches DSQL en cours : ${running}`
  );
  return applied;
}

try {
  if (process.argv.includes('--watch')) {
    while ((await report()) < total) await new Promise((resolve) => setTimeout(resolve, 5000));
  } else {
    await report();
  }
} finally {
  await db.$client.end();
}
