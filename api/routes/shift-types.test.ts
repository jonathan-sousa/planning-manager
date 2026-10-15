import { beforeEach, describe, expect, it, vi } from 'vitest';
import { expectCrudLifecycle } from '../test/crud';
import { resetDb } from '../test/db';
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
import { body, send } from '../test/http';

vi.mock('../../db/client', () => import('../test/db'));

beforeEach(async () => {
  await resetDb();
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

  it('creates, updates and deletes a shift type', async () => {
    await expectCrudLifecycle('/shift-types', DAY_SHIFT, { ...DAY_SHIFT, label: 'Jour long' });
  });
});
