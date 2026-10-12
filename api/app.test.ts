import { beforeAll, describe, expect, it } from 'vitest';
import type { ApiError } from './errors';

// Requests below are rejected before any database access.
let app: (typeof import('./app'))['default'];
beforeAll(async () => {
  process.env.DATABASE_ENDPOINT = 'test.dsql.eu-west-3.on.aws';
  app = (await import('./app')).default;
});

const managerEnv = (groups: string) => ({
  event: { requestContext: { authorizer: { jwt: { claims: { 'cognito:groups': groups } } } } },
});

const post = (path: string, body: unknown, groups = '[MANAGERS]') =>
  app.request(
    path,
    { method: 'POST', body: JSON.stringify(body), headers: { 'Content-Type': 'application/json' } },
    managerEnv(groups)
  );

describe('API', () => {
  it('rejects callers outside the managers group', async () => {
    const response = await post('/grades', { code: 'IDE', label: 'Infirmier' }, '[OTHERS]');
    expect(response.status).toBe(403);
  });

  it('answers invalid input with French messages per field', async () => {
    const response = await post('/grades', { code: '', label: 'Infirmier' });
    expect(response.status).toBe(400);
    const body = (await response.json()) as ApiError;
    expect(body.error).toBe('Données invalides');
    expect(Object.keys(body.fields ?? {})).toEqual(['code']);
    expect(body.fields?.code?.[0]).toMatch(/trop petit/i);
  });

  it('reports cross-field rules on the field at fault', async () => {
    const response = await post('/shift-types', {
      code: 'J',
      label: 'Jour',
      kind: 'WORK',
      startTime: '07:00',
      endTime: null,
      breakMinutes: 0,
      countedMinutes: 690,
      isNight: false,
      color: '#ffcc00',
      archived: false,
    });
    expect(response.status).toBe(400);
    expect((await response.json()) as ApiError).toEqual({
      error: 'Données invalides',
      fields: { endTime: ['Requis pour un poste travaillé'] },
    });
  });

  it('rejects malformed ids before querying', async () => {
    const response = await app.request(
      '/grades/not-a-uuid',
      { method: 'DELETE' },
      managerEnv('[MANAGERS]')
    );
    expect(response.status).toBe(400);
  });
});
