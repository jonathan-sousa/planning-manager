import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ApiError } from './errors';

// Fake Drizzle client: every builder call returns the same chain, and awaiting
// it yields the next queued result, in query order.
const { db, results } = vi.hoisted(() => {
  const results: unknown[][] = [];
  const db: unknown = new Proxy(() => {}, {
    get: (_target, prop) =>
      prop === 'then'
        ? (resolve: (rows: unknown[]) => void) => resolve(results.shift() ?? [])
        : () => db,
    apply: () => db,
  });
  return { db, results };
});
vi.mock('./db/client', () => ({ db }));

const { default: app } = await import('./app');

const env = {
  event: {
    requestContext: { authorizer: { jwt: { claims: { 'cognito:groups': '[MANAGERS]' } } } },
  },
};
const send = (method: string, path: string, body: unknown) =>
  app.request(
    path,
    { method, body: JSON.stringify(body), headers: { 'Content-Type': 'application/json' } },
    env
  );

const uuid = (n: number) => `00000000-0000-4000-8000-00000000000${n}`;
const shift = {
  code: 'J',
  label: 'Jour',
  kind: 'WORK',
  startTime: '07:00',
  endTime: '19:00',
  breakMinutes: 20,
  countedMinutes: 720,
  isNight: false,
  color: '#f59e0b',
  archived: false,
};
const request = {
  agentId: uuid(1),
  startDate: '2026-11-03',
  endDate: '2026-11-09',
  kind: 'ABSENCE_APPROVED',
  shiftTypeId: uuid(2),
  comment: null,
};

beforeEach(() => {
  results.length = 0;
});

describe('checks that read the database', () => {
  it('refuses a coverage need on an absence code', async () => {
    results.push([{ kind: 'ABSENCE' }]);
    const response = await send('POST', '/coverage-needs', {
      shiftTypeId: uuid(2),
      gradeId: uuid(3),
      skillId: null,
      dayKind: 'WEEKDAY',
      minCount: 1,
      targetCount: null,
    });
    expect(response.status).toBe(400);
    expect(((await response.json()) as ApiError).fields).toHaveProperty('shiftTypeId');
  });

  it('refuses an approved absence overlapping another one', async () => {
    results.push([{ kind: 'ABSENCE' }], [{ id: uuid(9) }]);
    const response = await send('POST', '/agent-requests', request);
    expect(response.status).toBe(400);
    expect(((await response.json()) as ApiError).fields).toHaveProperty('startDate');
  });

  it('saves an approved absence without overlap', async () => {
    results.push([{ kind: 'ABSENCE' }], [], [{ id: uuid(5), ...request }]);
    expect((await send('PUT', `/agent-requests/${uuid(5)}`, request)).status).toBe(200);
  });

  it('freezes worked / not worked on a referenced shift type', async () => {
    results.push([{ id: uuid(4), ...shift }], [{ id: uuid(7) }], [], []);
    const response = await send('PUT', `/shift-types/${uuid(4)}`, {
      ...shift,
      kind: 'ABSENCE',
      startTime: null,
      endTime: null,
      breakMinutes: 0,
    });
    expect(response.status).toBe(409);
    expect(((await response.json()) as ApiError).fields).toHaveProperty('kind');
  });

  it('lets a referenced shift type change its hours, or absence for rest', async () => {
    results.push([{ id: uuid(4), ...shift }], [{ id: uuid(4), ...shift, endTime: '19:30' }]);
    const retimed = await send('PUT', `/shift-types/${uuid(4)}`, { ...shift, endTime: '19:30' });
    expect(retimed.status).toBe(200);

    const absence = { ...shift, kind: 'ABSENCE', startTime: null, endTime: null, breakMinutes: 0 };
    results.push([{ id: uuid(6), ...absence }], [{ id: uuid(6), ...absence, kind: 'REST' }]);
    const rest = await send('PUT', `/shift-types/${uuid(6)}`, { ...absence, kind: 'REST' });
    expect(rest.status).toBe(200);
  });
});
