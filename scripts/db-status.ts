/**
 * Progress of the migrations on the stage's database, as the migrator counts
 * them (statements applied and pending), and the DSQL asynchronous jobs in
 * progress (indexes, constraint validations), which the migrator waits for.
 *
 * Usage: [STAGE=<stage>] npm run db:status [-- --watch]
 */
import { drizzle, getMigrationStatus } from '@aws/aurora-dsql-drizzle';
import { sql } from 'drizzle-orm';
import { output, readStageOutputs } from './stage-outputs';

const db = drizzle({
  connection: { host: output(readStageOutputs(), 'DatabaseEndpoint'), user: 'admin', max: 1 },
});

/** Prints the progress; true once nothing is pending. */
async function report(): Promise<boolean> {
  const status = await getMigrationStatus(db, { migrationsFolder: 'db/migrations' });
  const { rows: jobs } = await db.execute<{ job_id: string; status: string; details: string }>(
    sql`SELECT job_id, status, details FROM sys.jobs WHERE status NOT IN ('completed', 'failed', 'cancelled')`
  );
  const running =
    jobs
      .map((job) => [job.job_id, job.status, job.details].filter(Boolean).join(' '))
      .join(' ; ') || 'aucune';
  const total = status.appliedStatements + status.pendingStatements;
  console.log(
    `${new Date().toLocaleTimeString('fr')}  ${status.appliedStatements}/${total} instructions, tâches DSQL en cours : ${running}`
  );
  return status.pendingStatements === 0;
}

try {
  if (process.argv.includes('--watch')) {
    while (!(await report())) await new Promise((resolve) => setTimeout(resolve, 5000));
  } else {
    await report();
  }
} finally {
  await db.$client.end();
}
