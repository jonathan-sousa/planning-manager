import { readFileSync } from 'node:fs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ApiError } from './errors';

// Fake Drizzle client: every builder call returns the same chain, awaiting it
// yields the next queued result in query order, and a transaction runs its
// callback on the same client.
const { db, results } = vi.hoisted(() => {
  const results: unknown[][] = [];
  const db: unknown = new Proxy(() => {}, {
    get: (_target, prop) =>
      prop === 'then'
        ? (resolve: (rows: unknown[]) => void) => resolve(results.shift() ?? [])
        : prop === 'transactionWithRetry'
          ? (transaction: (tx: unknown) => unknown) => transaction(db)
          : () => db,
    apply: () => db,
  });
  return { db, results };
});
vi.mock('./db/client', () => ({ db }));
const startSolve = vi.hoisted(() => vi.fn(async () => {}));
vi.mock('./solver-client', () => ({ startSolve, checkSolverHealth: vi.fn() }));

const { default: app } = await import('./app');
const { countedOn } = await import('./routes/plannings');

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
    results.push([{ id: uuid(4), ...shift }], [], [{ id: uuid(7) }], [], []);
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

  it('freezes the timing of a shift type used in a planning', async () => {
    results.push([{ id: uuid(4), ...shift }], [{ id: uuid(8) }]);
    const response = await send('PUT', `/shift-types/${uuid(4)}`, { ...shift, endTime: '19:30' });
    expect(response.status).toBe(409);
  });

  it('lets a referenced shift type change its hours, or absence for rest', async () => {
    results.push([{ id: uuid(4), ...shift }], [], [{ id: uuid(4), ...shift, endTime: '19:30' }]);
    const retimed = await send('PUT', `/shift-types/${uuid(4)}`, { ...shift, endTime: '19:30' });
    expect(retimed.status).toBe(200);

    const absence = { ...shift, kind: 'ABSENCE', startTime: null, endTime: null, breakMinutes: 0 };
    results.push([{ id: uuid(6), ...absence }], [], [{ id: uuid(6), ...absence, kind: 'REST' }]);
    const rest = await send('PUT', `/shift-types/${uuid(6)}`, { ...absence, kind: 'REST' });
    expect(rest.status).toBe(200);
  });
});

describe('planning cells', () => {
  const cell = { agentId: uuid(1), date: '2026-11-03', shiftTypeId: uuid(2), locked: false };
  const save = (cells: unknown[]) => send('PUT', '/plannings/2026-11/cells', { version: 3, cells });

  it('refuses cells outside the month', async () => {
    expect((await save([{ ...cell, date: '2026-12-01' }])).status).toBe(400);
  });

  it('refuses an edit based on a stale version, or a planning no longer in draft', async () => {
    results.push([], [{ month: '2026-11', status: 'DRAFT' }]);
    const stale = await save([cell]);
    expect(stale.status).toBe(409);
    expect(((await stale.json()) as ApiError).error).toMatch(/rechargez/);

    results.push([], [{ month: '2026-11', status: 'PUBLISHED' }]);
    expect(((await (await save([cell])).json()) as ApiError).error).toMatch(/brouillon/);
  });

  it('refuses a cell outside the agent contract', async () => {
    results.push(
      [{ version: 4 }],
      [{ id: uuid(2), ...shift }],
      [{ id: uuid(1), lastName: 'Joly', startDate: '2027-01-04', endDate: null }]
    );
    const response = await save([cell]);
    expect(response.status).toBe(400);
    expect(((await response.json()) as ApiError).fields?.cells?.[0]).toMatch(/Hors contrat/);
  });

  it('writes the cells and returns the new version', async () => {
    const agent = { id: uuid(1), lastName: 'Joly', startDate: '2026-01-05', endDate: null };
    results.push([{ version: 4 }], [{ id: uuid(2), ...shift }], [agent], [], [{ id: uuid(9) }]);
    const response = await save([cell, { ...cell, date: '2026-11-04', shiftTypeId: null }]);
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ version: 4 });
  });

  it('credits night shifts their real length on daylight saving nights', () => {
    const night = { ...shift, id: uuid(3), startTime: '19:00', endTime: '07:00', isNight: true };
    const row = { ...night, createdAt: '', updatedAt: '' } as Parameters<typeof countedOn>[1];
    expect(countedOn('2026-10-14', row)).toBe(720);
    expect(countedOn('2026-10-24', row)).toBe(780);
    expect(countedOn('2026-03-28', row)).toBe(660);
  });
});

describe('planning status', () => {
  const settings: unknown = JSON.parse(
    readFileSync('fixtures/rule-scenarios/_settings.json', 'utf8')
  );
  const agentRow = {
    id: uuid(1),
    firstName: 'Inès',
    lastName: 'Joly',
    gradeId: uuid(3),
    workTimeRatio: 100,
    nightMode: 'MIXED',
    hoursRegime: 'MIXED_PRORATA',
    active: true,
    startDate: '2020-01-01',
    endDate: null,
  };
  const absence = {
    ...shift,
    id: uuid(2),
    code: 'CA',
    kind: 'ABSENCE',
    startTime: null,
    endTime: null,
  };
  const request = {
    agentId: uuid(1),
    startDate: '2026-11-03',
    endDate: '2026-11-03',
    kind: 'ABSENCE_APPROVED',
    shiftTypeId: uuid(2),
  };
  const setStatus = (status: string) => send('PUT', '/plannings/2026-11/status', { status });
  // Queries of a validation: planning, then the validator inputs, then the accepted violations.
  const validationQueries = (accepted: unknown[]) => [
    [{ month: '2026-11', status: 'DRAFT', version: 2 }],
    [agentRow],
    [],
    [absence],
    [],
    [],
    [],
    [request],
    [settings],
    accepted,
  ];

  it('refuses a transition that skips a step', async () => {
    results.push([{ month: '2026-11', status: 'DRAFT', version: 2 }]);
    expect((await setStatus('PUBLISHED')).status).toBe(409);
  });

  it('refuses to validate with an open hard violation', async () => {
    results.push(...validationQueries([]));
    const response = await setStatus('VALIDATED');
    expect(response.status).toBe(409);
    expect(((await response.json()) as ApiError).error).toMatch(/1 violation/);
  });

  it('validates once the hard violation is accepted', async () => {
    const accepted = [{ agentId: uuid(1), date: '2026-11-03', rule: 'APPROVED_ABSENCE' }];
    results.push(...validationQueries(accepted), [{ month: '2026-11', status: 'VALIDATED' }]);
    const response = await setStatus('VALIDATED');
    expect(response.status).toBe(200);
  });
});

describe('solve runs', () => {
  const run = {
    id: uuid(7),
    month: '2026-11',
    mode: 'COMPLETE',
    status: 'SUCCEEDED',
    planningVersion: 3,
  };

  it('starts the solver on a draft only', async () => {
    results.push([{ month: '2026-11', status: 'PUBLISHED', version: 3 }]);
    expect((await send('POST', '/plannings/2026-11/solve-runs', { mode: 'COMPLETE' })).status).toBe(
      409
    );

    results.push(
      [{ month: '2026-11', status: 'DRAFT', version: 3 }],
      [{ ...run, status: 'PENDING' }]
    );
    const response = await send('POST', '/plannings/2026-11/solve-runs', { mode: 'COMPLETE' });
    expect(response.status).toBe(202);
    expect(startSolve).toHaveBeenCalledWith(uuid(7));
  });

  it('refuses to apply a proposal computed on an older version', async () => {
    results.push([{ ...run, result: { cells: [], stats: {} } }], []);
    const response = await send('POST', `/plannings/2026-11/solve-runs/${uuid(7)}/apply`, {});
    expect(response.status).toBe(409);
    expect(((await response.json()) as ApiError).error).toMatch(/relancez/);
  });

  it('applies a proposal at the right version', async () => {
    const agent = { id: uuid(1), lastName: 'Joly', startDate: '2026-01-05', endDate: null };
    const cells = [{ agentId: uuid(1), date: '2026-11-03', shiftTypeId: uuid(2) }];
    results.push(
      [{ ...run, result: { cells, stats: {} } }],
      [{ version: 4 }],
      [{ id: uuid(2), ...shift }],
      [agent],
      [],
      [{ id: uuid(9) }],
      []
    );
    const response = await send('POST', `/plannings/2026-11/solve-runs/${uuid(7)}/apply`, {});
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ version: 4 });
  });
});
