import { readdirSync, readFileSync } from 'node:fs';
import { DrizzleQueryError } from 'drizzle-orm/errors';
import { describe, expect, it } from 'vitest';
import { pgError, toErrorResponse, uniqueConstraintNames } from './errors';

const pgFailure = (code: string, constraint?: string) =>
  new DrizzleQueryError('query …', [], Object.assign(new Error('pg'), { code, constraint }));

describe('pgError', () => {
  it('reads the SQLSTATE and constraint through the Drizzle wrapper', () => {
    expect(pgError(pgFailure('23505', 'grades_code_idx'))).toEqual({
      code: '23505',
      constraint: 'grades_code_idx',
    });
  });

  it('returns undefined for errors without a code', () => {
    expect(pgError(new Error('boom'))).toBeUndefined();
    expect(pgError('not an error')).toBeUndefined();
  });
});

describe('toErrorResponse', () => {
  it('knows constraints that exist in the migrations', () => {
    const dir = 'api/db/migrations';
    const sql = readdirSync(dir)
      .filter((file) => file.endsWith('.sql'))
      .map((file) => readFileSync(`${dir}/${file}`, 'utf8'))
      .join();
    for (const name of uniqueConstraintNames) expect(sql).toContain(`"${name}"`);
  });

  it('maps a duplicate code to 409 on the code field', () => {
    expect(toErrorResponse(pgFailure('23505', 'skills_code_idx'), 'POST')).toEqual({
      status: 409,
      body: { error: 'Code déjà utilisé', fields: { code: ['Code déjà utilisé'] } },
    });
  });

  it('maps a foreign key violation by method', () => {
    expect(toErrorResponse(pgFailure('23503'), 'DELETE')?.status).toBe(409);
    expect(toErrorResponse(pgFailure('23503'), 'POST')?.status).toBe(400);
  });

  it('leaves unexpected errors to the 500 handler', () => {
    expect(toErrorResponse(new Error('boom'), 'GET')).toBeUndefined();
  });
});
