import { Hono } from 'hono';
import { type Bindings, requireManager } from './middleware/auth';
import { notFound, toErrorResponse } from './lib/errors';
import { accountRoutes } from './routes/accounts';
import { agentRequestRoutes } from './routes/agent-requests';
import { agentRoutes } from './routes/agents';
import { coverageNeedRoutes } from './routes/coverage-needs';
import { coverageOverrideRoutes } from './routes/coverage-overrides';
import { gradeRoutes } from './routes/grades';
import { healthRoutes } from './routes/health';
import { planningRoutes } from './routes/plannings';
import { ruleSettingsRoutes } from './routes/rule-settings';
import { shiftTypeRoutes } from './routes/shift-types';
import { skillRoutes } from './routes/skills';

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
  .notFound((c) => c.json(notFound, 404))

  .route('/health', healthRoutes)
  .route('/grades', gradeRoutes)
  .route('/skills', skillRoutes)
  .route('/agents', agentRoutes)
  .route('/shift-types', shiftTypeRoutes)
  .route('/coverage-needs', coverageNeedRoutes)
  .route('/coverage-overrides', coverageOverrideRoutes)
  .route('/agent-requests', agentRequestRoutes)
  .route('/rule-settings', ruleSettingsRoutes)
  .route('/plannings', planningRoutes)
  .route('/accounts', accountRoutes);

export type AppType = typeof app;
export default app;
