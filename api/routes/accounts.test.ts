import { createMiddleware } from 'hono/factory';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ApiError } from '../errors';

// Fake Drizzle client: awaiting any query yields the next queued result.
const { db, results } = vi.hoisted(() => {
  const results: unknown[][] = [];
  const db: unknown = new Proxy(() => {}, {
    get: (_target, prop) =>
      prop === 'then'
        ? (resolve: (rows: unknown[]) => void) => resolve(results.shift() ?? [])
        : () => db,
    apply: () => db,
  });
  return { db, results };
});
vi.mock('../db/client', () => ({ db }));
vi.mock('../solver-client', () => ({ startSolve: vi.fn(), checkSolverHealth: vi.fn() }));
// Cognito, mocked: `live.admin` is what Cognito says of the caller right now.
const { cognito, live } = vi.hoisted(() => ({
  live: { admin: true },
  cognito: {
    listAccounts: vi.fn(),
    inviteAccount: vi.fn(),
    resendInvitation: vi.fn(),
    updateAccount: vi.fn(),
    setAccountEnabled: vi.fn(),
    resetMfa: vi.fn(),
  },
}));
vi.mock('../accounts', () => ({
  ...cognito,
  requireActiveAdmin: createMiddleware(async (c, next) => {
    if (!live.admin) return c.json({ error: 'Forbidden' }, 403);
    await next();
  }),
}));

const { default: app } = await import('../app');

const uuid = (n: number) => `00000000-0000-4000-8000-00000000000${n}`;
const ME = uuid(1);
const OTHER = uuid(2);

const as = (groups: string) => ({
  event: {
    requestContext: {
      authorizer: {
        jwt: { claims: { 'cognito:groups': groups, token_use: 'access', username: ME } },
      },
    },
  },
});
const admin = as('[MANAGERS ADMINS]');
const manager = as('[MANAGERS]');
const send = (env: object, method: string, path: string, body?: unknown) =>
  app.request(
    path,
    {
      method,
      body: body === undefined ? undefined : JSON.stringify(body),
      headers: { 'Content-Type': 'application/json' },
    },
    env
  );

const account = (username: string, email: string, extra: object = {}) => ({
  username,
  email,
  name: '',
  status: 'CONFIRMED',
  enabled: true,
  admin: false,
  createdAt: '2026-10-01T00:00:00.000Z',
  ...extra,
});

beforeEach(() => {
  results.length = 0;
  live.admin = true;
  vi.clearAllMocks();
});

describe('accounts', () => {
  it('is for admins only, like changing the rules', async () => {
    expect((await send(manager, 'GET', '/accounts')).status).toBe(403);
    expect((await send(manager, 'PUT', '/rule-settings', {})).status).toBe(403);
    expect(cognito.listAccounts).not.toHaveBeenCalled();
  });

  it('refuses an admin demoted or disabled since their token was issued', async () => {
    live.admin = false;
    expect((await send(admin, 'POST', `/accounts/${OTHER}/disable`)).status).toBe(403);
    expect((await send(admin, 'PUT', '/rule-settings', {})).status).toBe(403);
    expect(cognito.setAccountEnabled).not.toHaveBeenCalled();
  });

  it('flags an email whose last SES event is a bounce or a complaint', async () => {
    cognito.listAccounts.mockResolvedValue([
      account(uuid(3), 'b@example.org'),
      account(uuid(4), 'A@Example.org'),
    ]);
    results.push([
      { email: 'b@example.org', kind: 'DELIVERY', detail: null, occurredAt: '2026-10-12' },
      {
        email: 'a@example.org',
        kind: 'BOUNCE',
        detail: 'Permanent / General',
        occurredAt: '2026-10-11',
      },
      {
        email: 'b@example.org',
        kind: 'BOUNCE',
        detail: 'Transient / MailboxFull',
        occurredAt: '2026-10-10',
      },
    ]);
    const body = (await (await send(admin, 'GET', '/accounts')).json()) as {
      email: string;
      emailIssue: { kind: string } | null;
    }[];
    expect(body.map((item) => [item.email, item.emailIssue?.kind ?? null])).toEqual([
      ['A@Example.org', 'BOUNCE'],
      ['b@example.org', null],
    ]);
  });

  it('invites with a normalized email; an existing manager is reported on the field', async () => {
    cognito.inviteAccount.mockResolvedValueOnce({ username: uuid(5), created: true });
    const invite = { email: ' Jean.Dupont@Example.org ', name: 'Jean Dupont', admin: false };
    expect((await send(admin, 'POST', '/accounts', invite)).status).toBe(201);
    expect(cognito.inviteAccount).toHaveBeenCalledWith({
      email: 'jean.dupont@example.org',
      name: 'Jean Dupont',
      admin: false,
    });

    cognito.inviteAccount.mockResolvedValueOnce({ username: uuid(5), created: false });
    expect((await send(admin, 'POST', '/accounts', invite)).status).toBe(200);

    cognito.inviteAccount.mockResolvedValueOnce('exists');
    const duplicate = await send(admin, 'POST', '/accounts', invite);
    expect(duplicate.status).toBe(409);
    expect(((await duplicate.json()) as ApiError).fields?.email).toBeDefined();
  });

  it('only takes Cognito usernames, never the email alias', async () => {
    expect((await send(admin, 'POST', '/accounts/me@example.org/disable')).status).toBe(400);
    expect(cognito.setAccountEnabled).not.toHaveBeenCalled();
  });

  it('never disables or demotes the caller, nor the last active admin', async () => {
    expect((await send(admin, 'POST', `/accounts/${ME}/disable`)).status).toBe(409);
    expect(
      (await send(admin, 'PUT', `/accounts/${ME}`, { name: 'Moi', admin: false })).status
    ).toBe(409);

    cognito.listAccounts.mockResolvedValue([
      account(ME, 'me@example.org', { admin: true, enabled: false }),
      account(OTHER, 'other@example.org', { admin: true }),
    ]);
    expect((await send(admin, 'POST', `/accounts/${OTHER}/disable`)).status).toBe(409);
    expect(
      (await send(admin, 'PUT', `/accounts/${OTHER}`, { name: 'Autre', admin: false })).status
    ).toBe(409);
    expect(cognito.setAccountEnabled).not.toHaveBeenCalled();
    expect(cognito.updateAccount).not.toHaveBeenCalled();

    cognito.listAccounts.mockResolvedValue([
      account(ME, 'me@example.org', { admin: true }),
      account(OTHER, 'other@example.org', { admin: true }),
    ]);
    expect((await send(admin, 'POST', `/accounts/${OTHER}/disable`)).status).toBe(204);
    expect(cognito.setAccountEnabled).toHaveBeenCalledWith(OTHER, false);
  });

  it('resets the MFA of another account only', async () => {
    expect((await send(admin, 'POST', `/accounts/${ME}/reset-mfa`)).status).toBe(409);
    expect((await send(admin, 'POST', `/accounts/${OTHER}/reset-mfa`)).status).toBe(204);
    expect(cognito.resetMfa).toHaveBeenCalledWith(OTHER);
    expect((await send(manager, 'POST', `/accounts/${OTHER}/reset-mfa`)).status).toBe(403);
  });

  it('resends only a pending invitation of an enabled account', async () => {
    cognito.listAccounts.mockResolvedValue([
      account(uuid(6), 'new@example.org', { status: 'FORCE_CHANGE_PASSWORD' }),
      account(uuid(7), 'old@example.org'),
      account(uuid(8), 'off@example.org', { status: 'FORCE_CHANGE_PASSWORD', enabled: false }),
    ]);
    expect((await send(admin, 'POST', `/accounts/${uuid(6)}/resend`)).status).toBe(204);
    expect(cognito.resendInvitation).toHaveBeenCalledWith('new@example.org');
    expect((await send(admin, 'POST', `/accounts/${uuid(7)}/resend`)).status).toBe(409);
    expect((await send(admin, 'POST', `/accounts/${uuid(8)}/resend`)).status).toBe(409);
  });
});
