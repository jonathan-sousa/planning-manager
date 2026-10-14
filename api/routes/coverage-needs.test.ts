import { beforeEach, describe, expect, it, vi } from 'vitest';
import { expectCrudLifecycle } from '../test/crud';
import { resetDb } from '../test/db';
import { grade, LEAVE, shiftType } from '../test/factories';
import { body, send } from '../test/http';

vi.mock('../db/client', () => import('../test/db'));

beforeEach(async () => {
  await resetDb();
});

describe('coverage needs', () => {
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

  it('creates, updates and deletes a need', async () => {
    const need = {
      shiftTypeId: (await shiftType()).id,
      gradeId: (await grade()).id,
      skillId: null,
      dayKind: 'WEEKDAY',
      minCount: 2,
      targetCount: null,
    };
    await expectCrudLifecycle('/coverage-needs', need, { ...need, minCount: 3, targetCount: 4 });
  });
});
