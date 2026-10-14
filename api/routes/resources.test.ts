// The reference data routers: grades, skills, agents, shift types, coverage
// needs and overrides, agent requests, rule settings.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { agentSkills, ruleSettings, skills } from '../db/schema';
import type { ApiError } from '../errors';
import { pool } from '../test/cognito';
import { db, resetDb } from '../test/db';
import {
  absenceRequest,
  agent,
  cell,
  DAY_SHIFT,
  grade,
  LEAVE,
  planning,
  shiftType,
} from '../test/factories';
import { ADMIN, caller, send, uuid } from '../test/http';

vi.mock('../db/client', () => import('../test/db'));
vi.mock('@aws-sdk/client-cognito-identity-provider', async (original) => ({
  ...(await original<object>()),
  CognitoIdentityProviderClient: (await import('../test/cognito')).FakeCognitoClient,
}));

beforeEach(async () => {
  await resetDb();
  pool.reset();
});

const body = async <T = ApiError>(response: Response) => (await response.json()) as T;

describe('grades', () => {
  it('appends a new grade at the end of the order', async () => {
    await send('POST', '/grades', { code: 'IDE', label: 'Infirmier' });
    await send('POST', '/grades', { code: 'AS', label: 'Aide-soignant' });
    const rows = await body<{ code: string; sortOrder: number }[]>(await send('GET', '/grades'));
    expect(rows.map((row) => [row.code, row.sortOrder])).toEqual([
      ['IDE', 0],
      ['AS', 1],
    ]);
  });

  it('reports a duplicate code on its field', async () => {
    await grade({ code: 'IDE' });
    const response = await send('POST', '/grades', { code: 'IDE', label: 'Autre' });
    expect(response.status).toBe(409);
    expect((await body(response)).fields).toHaveProperty('code');
  });

  it('refuses to delete a grade still used, and answers 404 for an unknown one', async () => {
    const used = await grade();
    await agent({ gradeId: used.id });
    const response = await send('DELETE', `/grades/${used.id}`);
    expect(response.status).toBe(409);
    expect((await body(response)).error).toMatch(/encore utilisé/);
    expect((await send('PUT', `/grades/${uuid(9)}`, { code: 'X', label: 'X' })).status).toBe(404);
    expect((await send('DELETE', `/grades/${uuid(9)}`)).status).toBe(404);
  });
});

describe('skills', () => {
  it('lists skills by code, in French order', async () => {
    for (const code of ['URG', 'ÉCHO', 'AMB']) await send('POST', '/skills', { code, label: code });
    const rows = await body<{ code: string }[]>(await send('GET', '/skills'));
    expect(rows.map((row) => row.code)).toEqual(['AMB', 'ÉCHO', 'URG']);
  });
});

describe('agents', () => {
  const input = (gradeId: string, skillIds: string[]) => ({
    firstName: 'Inès',
    lastName: 'Joly',
    gradeId,
    skillIds,
    workTimeRatio: 80,
    nightMode: 'DAY_ONLY',
    hoursRegime: 'STANDARD_1607',
    active: true,
    startDate: '2026-01-05',
    endDate: null,
    initialBalanceMinutes: -210,
  });

  it('saves an agent with its skills, and replaces them on update', async () => {
    const ide = await grade();
    const [urg, amb] = await db
      .insert(skills)
      .values([
        { code: 'URG', label: 'Urgences' },
        { code: 'AMB', label: 'Ambulatoire' },
      ])
      .returning();
    const created = await body<{ id: string; skillIds: string[] }>(
      await send('POST', '/agents', input(ide.id, [urg!.id, urg!.id]))
    );
    expect(created.skillIds).toEqual([urg!.id]);

    const updated = await send('PUT', `/agents/${created.id}`, input(ide.id, [amb!.id]));
    expect(updated.status).toBe(200);
    expect(await db.select().from(agentSkills)).toEqual([
      { agentId: created.id, skillId: amb!.id },
    ]);
    const [listed] = await body<{ skillIds: string[]; initialBalanceMinutes: number }[]>(
      await send('GET', '/agents')
    );
    expect(listed).toMatchObject({ skillIds: [amb!.id], initialBalanceMinutes: -210 });
  });

  it('answers 404 for an unknown agent, and refuses an unknown grade', async () => {
    const ide = await grade();
    expect((await send('PUT', `/agents/${uuid(9)}`, input(ide.id, []))).status).toBe(404);
    const response = await send('POST', '/agents', input(uuid(9), []));
    expect(response.status).toBe(400);
    expect((await body(response)).error).toMatch(/Référence inconnue/);
  });

  it('sorts agents by last name then first name, in French order', async () => {
    await agent({ lastName: 'Étienne', firstName: 'Zoé' });
    await agent({ lastName: 'Dupont', firstName: 'Léa' });
    await agent({ lastName: 'Étienne', firstName: 'Ana' });
    const rows = await body<{ lastName: string; firstName: string }[]>(
      await send('GET', '/agents')
    );
    expect(rows.map((row) => `${row.lastName} ${row.firstName}`)).toEqual([
      'Dupont Léa',
      'Étienne Ana',
      'Étienne Zoé',
    ]);
  });
});

describe('shift types', () => {
  const absence = {
    ...DAY_SHIFT,
    kind: 'ABSENCE',
    startTime: null,
    endTime: null,
    breakMinutes: 0,
  };

  it('freezes worked / not worked on a referenced shift type', async () => {
    const day = await shiftType();
    await send('POST', '/coverage-needs', {
      shiftTypeId: day.id,
      gradeId: (await grade()).id,
      skillId: null,
      dayKind: 'WEEKDAY',
      minCount: 1,
      targetCount: null,
    });
    const response = await send('PUT', `/shift-types/${day.id}`, absence);
    expect(response.status).toBe(409);
    expect((await body(response)).fields).toHaveProperty('kind');
  });

  it('freezes the timing of a shift type used in a planning', async () => {
    const day = await shiftType();
    await planning('2026-11');
    await cell({ agentId: (await agent()).id, date: '2026-11-03', shiftTypeId: day.id });
    const response = await send('PUT', `/shift-types/${day.id}`, {
      ...DAY_SHIFT,
      endTime: '19:30',
    });
    expect(response.status).toBe(409);
    // The label stays editable.
    expect(
      (await send('PUT', `/shift-types/${day.id}`, { ...DAY_SHIFT, label: 'Jour long' })).status
    ).toBe(200);
  });

  it('lets a referenced shift type change its hours, or absence for rest', async () => {
    const day = await shiftType();
    const leave = await shiftType(LEAVE);
    await absenceRequest({ agentId: (await agent()).id, shiftTypeId: leave.id });
    await send('POST', '/coverage-needs', {
      shiftTypeId: day.id,
      gradeId: (await grade({ code: 'AS' })).id,
      skillId: null,
      dayKind: 'WEEKDAY',
      minCount: 1,
      targetCount: null,
    });
    expect(
      (await send('PUT', `/shift-types/${day.id}`, { ...DAY_SHIFT, endTime: '19:30' })).status
    ).toBe(200);
    expect((await send('PUT', `/shift-types/${leave.id}`, { ...LEAVE, kind: 'REST' })).status).toBe(
      200
    );
  });

  it('frees the code of an archived shift type', async () => {
    await shiftType({ archived: true });
    expect((await send('POST', '/shift-types', DAY_SHIFT)).status).toBe(201);
    const duplicate = await send('POST', '/shift-types', DAY_SHIFT);
    expect(duplicate.status).toBe(409);
    expect((await body(duplicate)).fields).toHaveProperty('code');
  });
});

describe('coverage needs and overrides', () => {
  it('refuses a need on an absence code, and a second need for the same slot', async () => {
    const ide = await grade();
    const need = (shiftTypeId: string) => ({
      shiftTypeId,
      gradeId: ide.id,
      skillId: null,
      dayKind: 'WEEKDAY',
      minCount: 1,
      targetCount: 2,
    });
    const leave = await shiftType(LEAVE);
    const refused = await send('POST', '/coverage-needs', need(leave.id));
    expect(refused.status).toBe(400);
    expect((await body(refused)).fields).toHaveProperty('shiftTypeId');

    const day = await shiftType();
    expect((await send('POST', '/coverage-needs', need(day.id))).status).toBe(201);
    const duplicate = await send('POST', '/coverage-needs', need(day.id));
    expect(duplicate.status).toBe(409);
    expect((await body(duplicate)).error).toMatch(/besoin existe déjà/);
  });

  it('saves a dated override, once per slot', async () => {
    const override = {
      date: '2026-12-24',
      shiftTypeId: (await shiftType()).id,
      gradeId: (await grade()).id,
      skillId: null,
      minCount: 3,
    };
    expect((await send('POST', '/coverage-overrides', override)).status).toBe(201);
    expect((await send('POST', '/coverage-overrides', override)).status).toBe(409);
    expect(await body<unknown[]>(await send('GET', '/coverage-overrides'))).toHaveLength(1);
  });
});

describe('agent requests', () => {
  const request = (agentId: string, shiftTypeId: string | null, fields: object = {}) => ({
    agentId,
    startDate: '2026-11-03',
    endDate: '2026-11-09',
    kind: 'ABSENCE_APPROVED',
    shiftTypeId,
    comment: null,
    ...fields,
  });

  it('refuses an approved absence overlapping another one', async () => {
    const joly = await agent();
    const leave = await shiftType(LEAVE);
    await absenceRequest({
      agentId: joly.id,
      shiftTypeId: leave.id,
      startDate: '2026-11-09',
      endDate: '2026-11-12',
    });
    const response = await send('POST', '/agent-requests', request(joly.id, leave.id));
    expect(response.status).toBe(400);
    expect((await body(response)).fields).toHaveProperty('startDate');
  });

  it('saves an approved absence without overlap, itself excluded', async () => {
    const joly = await agent();
    const leave = await shiftType(LEAVE);
    const own = await absenceRequest({ agentId: joly.id, shiftTypeId: leave.id });
    const response = await send('PUT', `/agent-requests/${own.id}`, request(joly.id, leave.id));
    expect(response.status).toBe(200);
  });

  it('requires a work shift for a shift wish, an absence code for an approved absence', async () => {
    const joly = await agent();
    const day = await shiftType();
    const leave = await shiftType(LEAVE);
    const wish = await send(
      'POST',
      '/agent-requests',
      request(joly.id, leave.id, { kind: 'WISH_SHIFT' })
    );
    expect(wish.status).toBe(400);
    expect((await body(wish)).fields?.shiftTypeId?.[0]).toMatch(/poste travaillé/);
    const absence = await send('POST', '/agent-requests', request(joly.id, day.id));
    expect((await body(absence)).fields?.shiftTypeId?.[0]).toMatch(/absence ou de repos/);
  });
});

describe('rule settings', () => {
  const ME = uuid(1);

  it('reads the defaults, changed by an active admin only', async () => {
    const settings = await body<Record<string, unknown>>(await send('GET', '/rule-settings'));
    expect(settings).toMatchObject({ minDailyRestMinutes: 720, maxConsecutiveWorkDays: 5 });
    const { id: _id, updatedAt: _updatedAt, ...input } = settings;
    const changed = { ...input, maxConsecutiveWorkDays: 6 };

    expect((await send('PUT', '/rule-settings', changed)).status).toBe(403);

    pool.add({ username: ME, email: 'me@example.org' }, ['MANAGERS', 'ADMINS']);
    const response = await send('PUT', '/rule-settings', changed, caller(ADMIN, ME));
    expect(response.status).toBe(200);
    expect((await db.select().from(ruleSettings))[0]!.maxConsecutiveWorkDays).toBe(6);
  });

  it('refuses a fortnight anchor that is not a Monday', async () => {
    pool.add({ username: ME, email: 'me@example.org' }, ['MANAGERS', 'ADMINS']);
    const {
      id: _id,
      updatedAt: _updatedAt,
      ...input
    } = await body<Record<string, unknown>>(await send('GET', '/rule-settings'));
    const response = await send(
      'PUT',
      '/rule-settings',
      { ...input, fortnightAnchorDate: '2026-01-06' },
      caller(ADMIN, ME)
    );
    expect(response.status).toBe(400);
    expect((await body(response)).fields).toHaveProperty('fortnightAnchorDate');
  });
});
