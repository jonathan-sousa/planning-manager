import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ruleSettings } from '../../db/schema';
import { pool } from '../test/cognito';
import { db, resetDb } from '../test/db';
import { ADMIN, body, caller, send, uuid } from '../test/http';

vi.mock('../../db/client', () => import('../test/db'));
vi.mock('@aws-sdk/client-cognito-identity-provider', async (original) => ({
  ...(await original<object>()),
  CognitoIdentityProviderClient: (await import('../test/cognito')).FakeCognitoClient,
}));

beforeEach(async () => {
  await resetDb();
  pool.reset();
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
