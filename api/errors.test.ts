import { DrizzleQueryError } from 'drizzle-orm/errors';
import { describe, expect, it } from 'vitest';
import { pgErrorCode } from './errors';

describe('pgErrorCode', () => {
  it('reads the SQLSTATE through the Drizzle wrapper', () => {
    const cause = Object.assign(new Error('duplicate key'), { code: '23505' });
    expect(pgErrorCode(new DrizzleQueryError('insert …', [], cause))).toBe('23505');
  });

  it('returns undefined for errors without a code', () => {
    expect(pgErrorCode(new Error('boom'))).toBeUndefined();
    expect(pgErrorCode('not an error')).toBeUndefined();
  });
});
