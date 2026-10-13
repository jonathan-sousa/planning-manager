/**
 * Applies pending Drizzle migrations to the stage's Aurora DSQL cluster, then
 * maps the solver Lambda's IAM role to the `solver` database role. The stage
 * comes from the CDK outputs (scripts/stage-outputs.ts); connects as `admin`
 * with the caller's IAM identity.
 */
import { drizzle, migrate } from '@aws/aurora-dsql-drizzle';
import { sql } from 'drizzle-orm';
import { output, readStageOutputs } from './stage-outputs';

const stack = readStageOutputs();
const host = output(stack, 'DatabaseEndpoint');
const solverRole = output(stack, 'SolverRoleArn');
// Inlined in AWS IAM GRANT, which takes no parameters.
if (!/^arn:aws:iam::\d{12}:role\/[\w+=,.@/-]+$/.test(solverRole)) {
  throw new Error(`Unexpected SOLVER_ROLE_ARN: ${solverRole}`);
}

const db = drizzle({ connection: { host, user: 'admin', max: 1 } });
try {
  const result = await migrate(db, { migrationsFolder: 'api/db/migrations' });
  if (!result.success) throw new Error(result.error.message);
  console.log(`Migrations applied on ${host}`);

  // One mapping, to the current function role (a replaced role is revoked).
  const { rows } = await db.execute<{ arn: string }>(
    sql`SELECT arn FROM sys.iam_pg_role_mappings WHERE pg_role_name = 'solver'`
  );
  for (const { arn } of rows.filter((row) => row.arn !== solverRole)) {
    await db.execute(sql.raw(`AWS IAM REVOKE solver FROM '${arn}'`));
  }
  if (!rows.some((row) => row.arn === solverRole)) {
    await db.execute(sql.raw(`AWS IAM GRANT solver TO '${solverRole}'`));
  }
  console.log('Solver database role mapped to its IAM role');
} finally {
  await db.$client.end();
}
