// The app as a whole: preflights, the managers guard on every route, the
// health check and the mapping of errors to responses.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { resetDb } from './test/db';
import { body, caller, send } from './test/http';

vi.mock('./db/client', () => import('./test/db'));
const checkSolverHealth = vi.hoisted(() => vi.fn());
vi.mock('./solver-client', () => ({ checkSolverHealth, startSolve: vi.fn() }));

const { default: app } = await import('./app');

beforeEach(async () => {
  await resetDb();
  checkSolverHealth.mockReset();
});

describe('app', () => {
  it('answers CORS preflights without a token', async () => {
    expect((await app.request('/grades', { method: 'OPTIONS' })).status).toBe(204);
  });

  it('keeps every route for the managers group', async () => {
    expect((await send('GET', '/grades', undefined, caller('[OTHERS]'))).status).toBe(403);
    expect((await send('GET', '/plannings/2026-11', undefined, caller('[OTHERS]'))).status).toBe(
      403
    );
  });

  it('checks the database and the solver', async () => {
    const solver = { status: 'OPTIMAL', ortoolsVersion: '9', pythonVersion: '3', database: 'ok' };
    checkSolverHealth.mockResolvedValue(solver);
    expect(await body(await send('GET', '/health'))).toEqual({ database: 'ok', solver });
  });

  it('answers invalid input with French messages per field', async () => {
    const response = await send('POST', '/grades', { code: '', label: 'x'.repeat(101) });
    expect(response.status).toBe(400);
    const error = await body(response);
    expect(error.error).toBe('Données invalides');
    expect(error.fields?.code).toEqual(['Requis']);
    expect(error.fields?.label?.[0]).toMatch(/trop grand/i);
  });

  it('answers a malformed body or id with 400, before any query', async () => {
    const malformed = await app.request(
      '/grades',
      { method: 'POST', body: '{bad', headers: { 'Content-Type': 'application/json' } },
      caller('[MANAGERS]')
    );
    expect(malformed.status).toBe(400);
    expect(await body(malformed)).toEqual({ error: 'Requête invalide' });
    expect((await send('POST', '/shift-types', null)).status).toBe(400);
    expect((await send('DELETE', '/grades/not-a-uuid')).status).toBe(400);
  });

  it('hides an unexpected error behind a 500', async () => {
    checkSolverHealth.mockRejectedValue(new Error('connection lost'));
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const response = await send('GET', '/health');
    expect(response.status).toBe(500);
    expect(await body(response)).toEqual({ error: 'Erreur interne' });
  });
});
