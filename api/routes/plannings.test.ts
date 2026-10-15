import { eq } from 'drizzle-orm';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  acceptedViolations,
  assignments,
  monthBalances,
  plannings,
  solveRuns,
} from '../../db/schema';
import type { ApiError } from '../lib/errors';
import { db, resetDb } from '../test/db';
import {
  absenceRequest,
  acceptedViolation,
  agent,
  cell,
  LEAVE,
  monthBalance,
  planning,
  shiftType,
  solveRun,
} from '../test/factories';
import { send, uuid } from '../test/http';

vi.mock('../../db/client', () => import('../test/db'));
const startSolve = vi.hoisted(() => vi.fn(async (_id: string) => {}));
vi.mock('../services/solver', () => ({ startSolve, checkSolverHealth: vi.fn() }));

beforeEach(async () => {
  await resetDb();
  vi.clearAllMocks();
});

const error = async (response: Response) => ((await response.json()) as ApiError).error;
const cellsOf = (month: string) =>
  db.select().from(assignments).where(eq(assignments.month, month));
const planningOf = async (month: string) =>
  (await db.select().from(plannings).where(eq(plannings.month, month)))[0];

describe('creating a month', () => {
  it('starts the draft with the approved absences, locked, within the month and the contract', async () => {
    const joly = await agent({ endDate: '2026-11-02' });
    const leave = await shiftType(LEAVE);
    const day = await shiftType();
    await absenceRequest({
      agentId: joly.id,
      shiftTypeId: leave.id,
      startDate: '2026-10-30',
      endDate: '2026-11-05',
    });
    await absenceRequest({ agentId: joly.id, shiftTypeId: day.id, kind: 'WISH_SHIFT' });
    // An absence whose code was archived since is not written.
    const oldLeave = await shiftType({ ...LEAVE, code: 'CA2', archived: true });
    await absenceRequest({ agentId: joly.id, shiftTypeId: oldLeave.id, startDate: '2026-11-01' });

    const response = await send('POST', '/plannings/2026-11');
    expect(response.status).toBe(201);
    expect(await response.json()).toMatchObject({ month: '2026-11', status: 'DRAFT', version: 0 });
    const cells = await cellsOf('2026-11');
    expect(
      cells
        .map((row) => [row.date, row.shiftTypeId, row.locked, row.source, row.countedMinutes])
        .sort()
    ).toEqual([
      ['2026-11-01', leave.id, true, 'REQUEST', 420],
      ['2026-11-02', leave.id, true, 'REQUEST', 420],
    ]);
  });

  it('refuses a month that already has a planning', async () => {
    await planning('2026-11');
    expect((await send('POST', '/plannings/2026-11')).status).toBe(409);
  });
});

describe('planning cells', () => {
  const save = (version: number, cells: unknown[]) =>
    send('PUT', '/plannings/2026-11/cells', { version, cells });

  it('refuses cells outside the month', async () => {
    await planning('2026-11');
    const joly = await agent();
    const response = await save(0, [
      { agentId: joly.id, date: '2026-12-01', shiftTypeId: null, locked: false },
    ]);
    expect(response.status).toBe(400);
  });

  it('refuses a stale version, a planning no longer in draft, or a missing one', async () => {
    const joly = await agent();
    const edit = [{ agentId: joly.id, date: '2026-11-03', shiftTypeId: null, locked: false }];
    expect((await save(0, edit)).status).toBe(404);

    await planning('2026-11', { version: 4 });
    const stale = await save(3, edit);
    expect(stale.status).toBe(409);
    expect(await error(stale)).toMatch(/rechargez/);

    await db.update(plannings).set({ status: 'PUBLISHED' });
    expect(await error(await save(4, edit))).toMatch(/brouillon/);
    expect((await planningOf('2026-11'))!.version).toBe(4);
  });

  it('refuses a cell outside the contract, an unknown agent or an archived shift', async () => {
    await planning('2026-11');
    const joly = await agent({ startDate: '2027-01-04' });
    const dupont = await agent({ lastName: 'Dupont' });
    const archived = await shiftType({ archived: true });
    const day = await shiftType({ code: 'J2' });
    const fieldError = async (edit: object) => {
      const response = await save(0, [{ date: '2026-11-03', locked: false, ...edit }]);
      expect(response.status).toBe(400);
      return ((await response.json()) as ApiError).fields?.cells?.[0];
    };
    expect(await fieldError({ agentId: joly.id, shiftTypeId: day.id })).toMatch(/Hors contrat/);
    expect(await fieldError({ agentId: uuid(9), shiftTypeId: day.id })).toMatch(/Agent inconnu/);
    expect(await fieldError({ agentId: dupont.id, shiftTypeId: archived.id })).toMatch(/archivé/);
    // Nothing written, version unchanged: the transaction rolled back.
    expect(await cellsOf('2026-11')).toEqual([]);
    expect((await planningOf('2026-11'))!.version).toBe(0);
  });

  it('writes, overwrites and empties cells, and bumps the version', async () => {
    await planning('2026-11', { version: 4 });
    const joly = await agent();
    const day = await shiftType();
    const night = await shiftType({
      code: 'N',
      startTime: '19:00',
      endTime: '07:00',
      isNight: true,
    });
    await cell({ agentId: joly.id, date: '2026-11-03', shiftTypeId: day.id });
    await cell({ agentId: joly.id, date: '2026-11-04', shiftTypeId: day.id });

    const response = await save(4, [
      { agentId: joly.id, date: '2026-11-03', shiftTypeId: night.id, locked: true },
      { agentId: joly.id, date: '2026-11-04', shiftTypeId: null, locked: false },
      { agentId: joly.id, date: '2026-11-05', shiftTypeId: day.id, locked: false },
    ]);
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ version: 5 });
    const cells = await cellsOf('2026-11');
    expect(
      cells.map((row) => [row.date, row.shiftTypeId, row.locked, row.source, row.updatedBy]).sort()
    ).toEqual([
      ['2026-11-03', night.id, true, 'MANUAL', uuid(999)],
      ['2026-11-05', day.id, false, 'MANUAL', uuid(999)],
    ]);
  });

  it('counts the hours of a night across the change of time', async () => {
    await planning('2026-10');
    const joly = await agent();
    const night = await shiftType({
      code: 'N',
      startTime: '19:00',
      endTime: '07:00',
      isNight: true,
    });
    await send('PUT', '/plannings/2026-10/cells', {
      version: 0,
      cells: [{ agentId: joly.id, date: '2026-10-24', shiftTypeId: night.id, locked: false }],
    });
    // The night of 24-25 October 2026 lasts one hour more.
    expect((await cellsOf('2026-10'))[0]!.countedMinutes).toBe(780);
  });
});

describe('planning status', () => {
  const setStatus = (status: string) => send('PUT', '/plannings/2026-11/status', { status });

  /** An agent with an approved absence on 3 November that the grid leaves empty. */
  async function absenceNotPosted() {
    const joly = await agent();
    const leave = await shiftType(LEAVE);
    await absenceRequest({ agentId: joly.id, shiftTypeId: leave.id });
    return joly;
  }

  it('answers 404 for a month without planning', async () => {
    expect((await setStatus('VALIDATED')).status).toBe(404);
  });

  it('refuses a transition that skips a step', async () => {
    await planning('2026-11');
    expect((await setStatus('PUBLISHED')).status).toBe(409);
  });

  it('refuses to validate with an open hard violation', async () => {
    await planning('2026-11');
    await absenceNotPosted();
    const response = await setStatus('VALIDATED');
    expect(response.status).toBe(409);
    expect(await error(response)).toMatch(/1 violation/);
    expect((await planningOf('2026-11'))!.status).toBe('DRAFT');
  });

  it('validates once the hard violation is accepted, and bumps the version', async () => {
    await planning('2026-11', { version: 2 });
    const joly = await absenceNotPosted();
    await acceptedViolation({
      month: '2026-11',
      agentId: joly.id,
      date: '2026-11-03',
      rule: 'APPROVED_ABSENCE',
    });
    const response = await setStatus('VALIDATED');
    expect(response.status).toBe(200);
    expect(await planningOf('2026-11')).toMatchObject({ status: 'VALIDATED', version: 3 });
  });

  it('records the hours of the month when publishing, for this month only', async () => {
    await planning('2026-10', { status: 'PUBLISHED' });
    await planning('2026-11', { status: 'VALIDATED' });
    const joly = await agent();
    const day = await shiftType();
    await cell({ agentId: joly.id, date: '2026-11-03', shiftTypeId: day.id });
    await cell({ agentId: joly.id, date: '2026-11-04', shiftTypeId: day.id });
    await monthBalance({
      agentId: joly.id,
      month: '2026-10',
      creditedMinutes: 1,
      targetMinutes: 2,
    });
    // Left by an earlier publication of November.
    await monthBalance({
      agentId: joly.id,
      month: '2026-11',
      creditedMinutes: 9,
      targetMinutes: 9,
    });

    expect((await setStatus('PUBLISHED')).status).toBe(200);
    expect((await planningOf('2026-11'))!.publishedAt).not.toBeNull();
    const balances = await db.select().from(monthBalances);
    // Full time, 1607 h a year: 30 days of 365.
    expect(
      balances.map((row) => [row.month, row.creditedMinutes, row.targetMinutes]).sort()
    ).toEqual([
      ['2026-10', 1, 2],
      ['2026-11', 1440, 7925],
    ]);
  });

  it('reopens a published month, which keeps its last recorded hours', async () => {
    await planning('2026-11', { status: 'PUBLISHED', publishedAt: '2026-12-01T08:00:00Z' });
    const joly = await agent();
    await monthBalance({
      agentId: joly.id,
      month: '2026-11',
      creditedMinutes: 1,
      targetMinutes: 2,
    });
    expect((await setStatus('DRAFT')).status).toBe(200);
    expect(await planningOf('2026-11')).toMatchObject({ status: 'DRAFT', publishedAt: null });
    expect(await db.select().from(monthBalances)).toHaveLength(1);
  });

  it('reopens a validated month', async () => {
    await planning('2026-11', { status: 'VALIDATED' });
    expect((await setStatus('DRAFT')).status).toBe(200);
    expect((await planningOf('2026-11'))!.status).toBe('DRAFT');
  });
});

describe('accepted violations', () => {
  const accept = (body: object) =>
    send('POST', '/plannings/2026-11/accepted-violations', {
      date: '2026-11-03',
      rule: 'DAILY_REST',
      comment: 'Remplacement en urgence',
      ...body,
    });

  it('accepts a hard violation of a draft, once', async () => {
    await planning('2026-11');
    const joly = await agent();
    const response = await accept({ agentId: joly.id });
    expect(response.status).toBe(201);
    expect(await response.json()).toMatchObject({ acceptedBy: uuid(999), month: '2026-11' });
    expect(await error(await accept({ agentId: joly.id }))).toMatch(/déjà acceptée/);
  });

  it('refuses a date outside the month, a missing planning, or one no longer in draft', async () => {
    const joly = await agent();
    expect((await accept({ agentId: joly.id })).status).toBe(404);
    await planning('2026-11', { status: 'VALIDATED' });
    expect((await accept({ agentId: joly.id })).status).toBe(409);
    expect((await accept({ agentId: joly.id, date: '2026-12-01' })).status).toBe(400);
  });

  it('withdraws an acceptance of a draft', async () => {
    await planning('2026-11');
    const joly = await agent();
    const row = await acceptedViolation({
      month: '2026-11',
      agentId: joly.id,
      date: '2026-11-03',
      rule: 'DAILY_REST',
    });
    const path = `/plannings/2026-11/accepted-violations/${row.id}`;

    await db.update(plannings).set({ status: 'VALIDATED' });
    expect((await send('DELETE', path)).status).toBe(409);

    expect((await send('DELETE', path.replace('2026-11', '2026-12'))).status).toBe(404);

    await db.update(plannings).set({ status: 'DRAFT' });
    expect((await send('DELETE', path)).status).toBe(204);
    expect(await db.select().from(acceptedViolations)).toEqual([]);
    expect((await send('DELETE', path)).status).toBe(404);
  });
});

describe('hour balances', () => {
  const balances = async () =>
    ((await (await send('GET', '/plannings/2026-11')).json()) as { balances: unknown }).balances;

  it('opens a month with the initial balance plus the earlier published gaps', async () => {
    const joly = await agent({ initialBalanceMinutes: 60 });
    const dupont = await agent({ lastName: 'Dupont' });
    await planning('2026-09', { status: 'PUBLISHED' });
    await planning('2026-10', { status: 'PUBLISHED' });
    await planning('2026-11');
    await planning('2026-12', { status: 'PUBLISHED' });
    await monthBalance({
      agentId: joly.id,
      month: '2026-09',
      creditedMinutes: 100,
      targetMinutes: 200,
    });
    await monthBalance({
      agentId: joly.id,
      month: '2026-10',
      creditedMinutes: 100,
      targetMinutes: 150,
    });
    // A later month does not count.
    await monthBalance({
      agentId: joly.id,
      month: '2026-12',
      creditedMinutes: 900,
      targetMinutes: 0,
    });
    expect(await balances()).toEqual({
      opening: expect.arrayContaining([
        { agentId: joly.id, minutes: -90 },
        { agentId: dupont.id, minutes: 0 },
      ]),
      previousMonthOpen: false,
      openingChangedSincePublication: false,
    });
  });

  it('flags a previous month planned but not published', async () => {
    expect(await balances()).toMatchObject({ previousMonthOpen: false });
    await planning('2026-10');
    expect(await balances()).toMatchObject({ previousMonthOpen: true });
    await db.update(plannings).set({ status: 'VALIDATED' });
    expect(await balances()).toMatchObject({ previousMonthOpen: true });
    await db.update(plannings).set({ status: 'PUBLISHED' });
    expect(await balances()).toMatchObject({ previousMonthOpen: false });
  });

  it('flags an earlier month republished after this one was published', async () => {
    const joly = await agent();
    await planning('2026-10', { status: 'PUBLISHED' });
    await planning('2026-11');
    await monthBalance({
      agentId: joly.id,
      month: '2026-10',
      creditedMinutes: 0,
      targetMinutes: 0,
      updatedAt: '2026-12-02T10:00:00Z',
    });
    // Never published: nothing to compare with.
    expect(await balances()).toMatchObject({ openingChangedSincePublication: false });

    await db
      .update(plannings)
      .set({ status: 'PUBLISHED', publishedAt: '2026-12-03T09:00:00Z' })
      .where(eq(plannings.month, '2026-11'));
    expect(await balances()).toMatchObject({ openingChangedSincePublication: false });

    await db
      .update(plannings)
      .set({ publishedAt: '2026-12-01T09:00:00Z' })
      .where(eq(plannings.month, '2026-11'));
    expect(await balances()).toMatchObject({ openingChangedSincePublication: true });
  });
});

describe('reading a month', () => {
  it('returns null before the month is created', async () => {
    expect(await (await send('GET', '/plannings/2026-11')).json()).toMatchObject({
      planning: null,
      assignments: [],
    });
  });

  it('returns the cells of the month and 13 days around it', async () => {
    await planning('2026-10');
    await planning('2026-11');
    await planning('2026-12');
    const joly = await agent();
    const day = await shiftType();
    for (const date of ['2026-10-18', '2026-10-19', '2026-12-13', '2026-12-14']) {
      await cell({ agentId: joly.id, date, shiftTypeId: day.id });
    }
    const body = (await (await send('GET', '/plannings/2026-11')).json()) as {
      assignments: { date: string }[];
    };
    expect(body.assignments.map((row) => row.date).sort()).toEqual(['2026-10-19', '2026-12-13']);
  });
});

describe('solve runs', () => {
  const start = () => send('POST', '/plannings/2026-11/solve-runs', { mode: 'COMPLETE' });
  const minutesAgo = (minutes: number) => new Date(Date.now() - minutes * 60_000).toISOString();

  it('starts the solver on a draft only', async () => {
    await planning('2026-11', { status: 'PUBLISHED', version: 3 });
    expect((await start()).status).toBe(409);

    await db.update(plannings).set({ status: 'DRAFT' });
    const response = await start();
    expect(response.status).toBe(202);
    const run = (await response.json()) as { id: string };
    expect(startSolve).toHaveBeenCalledWith(run.id);
    expect(await db.select().from(solveRuns)).toMatchObject([
      { status: 'PENDING', planningVersion: 3, createdBy: uuid(999) },
    ]);
  });

  it('refuses a second run while one is in progress, not after it expired', async () => {
    await planning('2026-11');
    const running = await solveRun({ month: '2026-11', status: 'RUNNING' });
    const busy = await start();
    expect(busy.status).toBe(409);
    expect(await error(busy)).toMatch(/déjà en cours/);

    await db
      .update(solveRuns)
      .set({ createdAt: minutesAgo(10) })
      .where(eq(solveRuns.id, running.id));
    expect((await start()).status).toBe(202);
  });

  it('marks the run failed when the solver cannot be started', async () => {
    await planning('2026-11');
    startSolve.mockRejectedValueOnce(new Error('throttled'));
    expect((await start()).status).toBe(500);
    expect(await db.select().from(solveRuns)).toMatchObject([{ status: 'FAILED' }]);
  });

  it('reports a run lost by the solver as failed', async () => {
    await planning('2026-11');
    const run = await solveRun({ month: '2026-11', status: 'RUNNING', createdAt: minutesAgo(10) });
    const response = await send('GET', `/plannings/2026-11/solve-runs/${run.id}`);
    expect(await response.json()).toMatchObject({ status: 'FAILED', error: /pas répondu/ });
    expect((await db.select().from(solveRuns))[0]!.status).toBe('FAILED');

    expect((await send('GET', `/plannings/2026-11/solve-runs/${uuid(9)}`)).status).toBe(404);
  });

  it('applies only a finished proposal', async () => {
    await planning('2026-11');
    const run = await solveRun({
      month: '2026-11',
      status: 'APPLIED',
      result: { cells: [], stats: {} },
    });
    const response = await send('POST', `/plannings/2026-11/solve-runs/${run.id}/apply`, {});
    expect(response.status).toBe(409);
    expect(await error(response)).toMatch(/Aucune proposition/);
  });

  it('refuses to apply a proposal computed on an older version', async () => {
    await planning('2026-11', { version: 4 });
    const run = await solveRun({
      month: '2026-11',
      status: 'SUCCEEDED',
      planningVersion: 3,
      result: { cells: [], stats: {} },
    });
    const response = await send('POST', `/plannings/2026-11/solve-runs/${run.id}/apply`, {});
    expect(response.status).toBe(409);
    expect(await error(response)).toMatch(/relancez/);
  });

  it('applies a proposal at the right version', async () => {
    await planning('2026-11', { version: 3 });
    const joly = await agent();
    const day = await shiftType();
    await cell({ agentId: joly.id, date: '2026-11-04', shiftTypeId: day.id, locked: true });
    const run = await solveRun({
      month: '2026-11',
      status: 'SUCCEEDED',
      planningVersion: 3,
      result: {
        cells: [
          { agentId: joly.id, date: '2026-11-03', shiftTypeId: day.id },
          { agentId: joly.id, date: '2026-11-04', shiftTypeId: null },
        ],
        stats: {},
      },
    });
    const response = await send('POST', `/plannings/2026-11/solve-runs/${run.id}/apply`, {});
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ version: 4 });
    expect((await cellsOf('2026-11')).map((row) => [row.date, row.source])).toEqual([
      ['2026-11-03', 'SOLVER'],
    ]);
    expect((await db.select().from(solveRuns))[0]!.status).toBe('APPLIED');
  });
});
