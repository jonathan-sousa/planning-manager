import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ValidationError } from './errors';
import { ABSENCE_CODE, requireShiftKind, WORK_SHIFT } from './shift-checks';
import { resetDb } from './test/db';
import { LEAVE, shiftType } from './test/factories';
import { uuid } from './test/http';

vi.mock('../db/client', () => import('./test/db'));

beforeEach(async () => {
  await resetDb();
});

describe('requireShiftKind', () => {
  it('accepts a shift type of the expected kind', async () => {
    const day = await shiftType();
    const leave = await shiftType(LEAVE);
    await expect(requireShiftKind(day.id, WORK_SHIFT)).resolves.toBeUndefined();
    await expect(requireShiftKind(leave.id, ABSENCE_CODE)).resolves.toBeUndefined();
  });

  it('refuses another kind on the shiftTypeId field', async () => {
    const leave = await shiftType(LEAVE);
    const error = await requireShiftKind(leave.id, WORK_SHIFT).catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(ValidationError);
    expect((error as ValidationError).fields).toEqual({ shiftTypeId: [WORK_SHIFT.message] });
  });

  it('leaves no shift type, or an unknown one, to the schema and the foreign key', async () => {
    await expect(requireShiftKind(null, WORK_SHIFT)).resolves.toBeUndefined();
    await expect(requireShiftKind(uuid(9), WORK_SHIFT)).resolves.toBeUndefined();
  });
});
