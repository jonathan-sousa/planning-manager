/**
 * Applies pending Drizzle migrations to the stage's Aurora DSQL cluster, then
 * maps each Lambda's IAM role to its database role (created by a migration).
 * The stage comes from the CDK outputs (scripts/stage-outputs.ts); connects as
 * `admin` with the caller's IAM identity.
 */
import { drizzle, migrate } from '@aws/aurora-dsql-drizzle';
import { sql } from 'drizzle-orm';
import { output, readStageOutputs } from './stage-outputs';

/** Database role of each least-privilege Lambda, and the CDK output with its IAM role ARN. */
const LAMBDA_ROLES = { solver: 'SolverRoleArn', mailer: 'MailerRoleArn' };

const stack = readStageOutputs();
const host = output(stack, 'DatabaseEndpoint');
const iamRoles = Object.entries(LAMBDA_ROLES).map(([role, key]) => {
  const arn = output(stack, key);
  // Inlined in AWS IAM GRANT, which takes no parameters.
  if (!/^arn:aws:iam::\d{12}:role\/[\w+=,.@/-]+$/.test(arn)) {
    throw new Error(`Unexpected ${key}: ${arn}`);
  }
  return { role, arn };
});

const db = drizzle({ connection: { host, user: 'admin', max: 1 } });
try {
  const result = await migrate(db, { migrationsFolder: 'db/migrations' });
  if (!result.success) throw new Error(result.error.message);
  console.log(`Migrations applied on ${host}`);

  // One mapping per database role, to the current function role (a replaced one is revoked).
  for (const { role, arn } of iamRoles) {
    const { rows } = await db.execute<{ arn: string }>(
      sql`SELECT arn FROM sys.iam_pg_role_mappings WHERE pg_role_name = ${role}`
    );
    for (const stale of rows.filter((row) => row.arn !== arn)) {
      await db.execute(sql.raw(`AWS IAM REVOKE ${role} FROM '${stale.arn}'`));
    }
    if (!rows.some((row) => row.arn === arn)) {
      await db.execute(sql.raw(`AWS IAM GRANT ${role} TO '${arn}'`));
    }
  }
  console.log(`Database roles mapped: ${iamRoles.map(({ role }) => role).join(', ')}`);
} finally {
  await db.$client.end();
}
