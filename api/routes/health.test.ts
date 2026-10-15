import { beforeEach, describe, expect, it, vi } from 'vitest';
import { resetDb } from '../test/db';
import { body, send } from '../test/http';

vi.mock('../../db/client', () => import('../test/db'));
const checkSolverHealth = vi.hoisted(() => vi.fn());
vi.mock('../services/solver', () => ({ checkSolverHealth, startSolve: vi.fn() }));

beforeEach(async () => {
  await resetDb();
  checkSolverHealth.mockReset();
});

describe('health', () => {
  it('reports the database and the solver', async () => {
    const solver = { status: 'OPTIMAL', ortoolsVersion: '9', pythonVersion: '3', database: 'ok' };
    checkSolverHealth.mockResolvedValue(solver);
    expect(await body(await send('GET', '/health'))).toEqual({ database: 'ok', solver });
  });

  it('fails when the solver does not answer', async () => {
    checkSolverHealth.mockRejectedValue(new Error('connection lost'));
    vi.spyOn(console, 'error').mockImplementation(() => {});
    expect((await send('GET', '/health')).status).toBe(500);
  });
});
