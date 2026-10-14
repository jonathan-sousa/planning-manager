import { beforeEach, describe, expect, it, vi } from 'vitest';
import { expectCrudLifecycle } from '../test/crud';
import { resetDb } from '../test/db';
import { grade, LEAVE, shiftType } from '../test/factories';
import { body, send } from '../test/http';

vi.mock('../db/client', () => import('../test/db'));

beforeEach(async () => {
  await resetDb();
});

describe('coverage overrides', () => {
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

  it('creates, updates and deletes an override, on a work shift only', async () => {
    const override = {
      date: '2026-12-24',
      shiftTypeId: (await shiftType()).id,
      gradeId: (await grade()).id,
      skillId: null,
      minCount: 3,
    };
    await expectCrudLifecycle('/coverage-overrides', override, { ...override, minCount: 1 });
    const leave = await shiftType(LEAVE);
    const refused = await send('POST', '/coverage-overrides', {
      ...override,
      shiftTypeId: leave.id,
    });
    expect((await body(refused)).fields).toHaveProperty('shiftTypeId');
  });
});
