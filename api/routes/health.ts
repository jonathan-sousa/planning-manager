import { sql } from 'drizzle-orm';
import { Hono } from 'hono';
import { db } from '../../db/client';
import { checkSolverHealth } from '../services/solver';

/** State of the backend for the home page: the database answers, the solver runs. */
export const healthRoutes = new Hono().get('/', async (c) => {
  await db.execute(sql`select 1`);
  const solver = await checkSolverHealth();
  return c.json({ database: 'ok', solver });
});
