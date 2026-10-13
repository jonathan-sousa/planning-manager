/**
 * Fills the stage's database with the fictional service of scripts/seed/.
 * Development stages only. Refuses a non-empty database unless `--reset`,
 * which first deletes every reference row (and what depends on them).
 *
 * Usage: npm run db:seed [-- --reset]
 */
import { drizzle } from '@aws/aurora-dsql-drizzle';
import * as schema from '../api/db/schema';
import { buildSeed } from './seed/build';
import { PROD_STAGE } from '../infra/lib/stage';
import { output, readStageOutputs } from './stage-outputs';

const stack = readStageOutputs();
const host = output(stack, 'DatabaseEndpoint');
if (stack.stage === PROD_STAGE) throw new Error('The fictional seed never goes to prod');
const reset = process.argv.includes('--reset');

const month = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Europe/Paris',
  year: 'numeric',
  month: '2-digit',
})
  .format(new Date())
  .slice(0, 7);
const seed = buildSeed(month);

const db = drizzle({ connection: { host, user: 'admin', max: 1 }, schema });
try {
  // Children first on delete, parents first on insert. Well under the
  // 3 000-row limit of a DSQL transaction.
  await db.transactionWithRetry(async (tx) => {
    const existing = await tx.select({ id: schema.grades.id }).from(schema.grades).limit(1);
    if (existing.length > 0 && !reset) {
      throw new Error('The database already holds data: rerun with --reset to replace it');
    }
    if (reset) {
      for (const table of [
        schema.acceptedViolations,
        schema.assignments,
        schema.plannings,
        schema.agentRequests,
        schema.coverageOverrides,
        schema.coverageNeeds,
        schema.agentSkills,
        schema.agents,
        schema.shiftTypes,
        schema.skills,
        schema.grades,
      ]) {
        await tx.delete(table);
      }
    }
    await tx.insert(schema.grades).values(seed.grades);
    await tx.insert(schema.skills).values(seed.skills);
    await tx.insert(schema.shiftTypes).values(seed.shiftTypes);
    await tx.insert(schema.agents).values(seed.agents);
    await tx.insert(schema.agentSkills).values(seed.agentSkills);
    await tx.insert(schema.coverageNeeds).values(seed.coverageNeeds);
    await tx.insert(schema.coverageOverrides).values(seed.coverageOverrides);
    await tx.insert(schema.agentRequests).values(seed.agentRequests);
  });
  const counts = Object.entries(seed).map(([table, rows]) => `${table} ${rows.length}`);
  console.log(`Seeded ${stack.stage}: ${counts.join(', ')}`);
} finally {
  await db.$client.end();
}
