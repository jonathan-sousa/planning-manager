import { sql } from 'drizzle-orm';
import { Hono } from 'hono';
import { type Bindings, requireManager } from './auth';
import { db } from './db/client';
import { toErrorResponse } from './errors';
import { agentRequestRoutes } from './routes/agent-requests';
import { agentRoutes } from './routes/agents';
import { coverageNeedRoutes } from './routes/coverage-needs';
import { coverageOverrideRoutes } from './routes/coverage-overrides';
import { gradeRoutes } from './routes/grades';
import { ruleSettingsRoutes } from './routes/rule-settings';
import { shiftTypeRoutes } from './routes/shift-types';
import { skillRoutes } from './routes/skills';
import { checkSolverHealth } from './solver-client';

const app = new Hono<{ Bindings: Bindings }>()
  // CORS preflights: API Gateway adds the CORS headers itself.
  .options('*', (c) => c.body(null, 204))
  .use('*', requireManager)
  .onError((error, c) => {
    const response = toErrorResponse(error, c.req.method);
    if (response) return c.json(response.body, response.status);
    console.error(error);
    return c.json({ error: 'Erreur interne' }, 500);
  })

  .get('/health', async (c) => {
    await db.execute(sql`select 1`);
    const solver = await checkSolverHealth();
    return c.json({ database: 'ok', solver });
  })

  .route('/grades', gradeRoutes)
  .route('/skills', skillRoutes)
  .route('/agents', agentRoutes)
  .route('/shift-types', shiftTypeRoutes)
  .route('/coverage-needs', coverageNeedRoutes)
  .route('/coverage-overrides', coverageOverrideRoutes)
  .route('/agent-requests', agentRequestRoutes)
  .route('/rule-settings', ruleSettingsRoutes);

export type AppType = typeof app;
export default app;
