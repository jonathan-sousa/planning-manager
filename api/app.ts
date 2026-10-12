import { zValidator } from '@hono/zod-validator';
import { sql } from 'drizzle-orm';
import { Hono } from 'hono';
import { z } from 'zod';
import { type Bindings, requireManager } from './auth';
import { db } from './db/client';
import { grades } from './db/schema';
import { checkSolverHealth } from './solver-client';

function isPgError(error: unknown): error is Error & { code: string } {
  return error instanceof Error && typeof (error as { code?: unknown }).code === 'string';
}

const gradeInput = z.object({
  code: z.string().trim().min(1).max(10),
  label: z.string().trim().min(1).max(100),
});

const app = new Hono<{ Bindings: Bindings }>()
  // CORS preflights: API Gateway adds the CORS headers itself.
  .options('*', (c) => c.body(null, 204))
  .use('*', requireManager)
  .onError((error, c) => {
    // PostgreSQL unique_violation: the grade code is already taken.
    if (isPgError(error) && error.code === '23505') {
      return c.json({ error: 'Code déjà utilisé' }, 409);
    }
    console.error(error);
    return c.json({ error: 'Internal error' }, 500);
  })

  .get('/health', async (c) => {
    await db.execute(sql`select 1`);
    const solver = await checkSolverHealth();
    return c.json({ database: 'ok', solver });
  })

  .get('/grades', async (c) => {
    const rows = await db.select().from(grades).orderBy(grades.sortOrder, grades.code);
    return c.json(rows);
  })

  .post('/grades', zValidator('json', gradeInput), async (c) => {
    const input = c.req.valid('json');
    const [{ count }] = await db.select({ count: sql<number>`count(*)::int` }).from(grades);
    const [row] = await db
      .insert(grades)
      .values({ ...input, sortOrder: count })
      .returning();
    return c.json(row, 201);
  });

export type AppType = typeof app;
export default app;
