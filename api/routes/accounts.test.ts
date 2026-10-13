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
const cognito = vi.hoisted(() => ({
  listAccounts: vi.fn(),
  inviteAccount: vi.fn(),
  resendInvitation: vi.fn(),
  updateAccount: vi.fn(),
  setAccountEnabled: vi.fn(),
}));
vi.mock('../accounts', () => cognito);

const { default: app } = await import('../app');

const as = (groups: string, username = 'me') => ({
  event: {
    requestContext: {
      authorizer: { jwt: { claims: { 'cognito:groups': groups, username } } },
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

const account = (username: string, email: string) => ({
  username,
  email,
  name: '',
  status: 'CONFIRMED',
  enabled: true,
  admin: false,
  createdAt: '2026-10-01T00:00:00.000Z',
});

beforeEach(() => {
  results.length = 0;
  vi.clearAllMocks();
});

describe('accounts', () => {
  it('is for admins only, like changing the rules', async () => {
    expect((await send(manager, 'GET', '/accounts')).status).toBe(403);
    expect((await send(manager, 'PUT', '/rule-settings', {})).status).toBe(403);
    expect(cognito.listAccounts).not.toHaveBeenCalled();
  });

  it('lists accounts with the last bounce or complaint of their email', async () => {
    cognito.listAccounts.mockResolvedValue([
      account('b', 'b@example.org'),
      account('a', 'a@example.org'),
    ]);
    results.push([
      {
        email: 'a@example.org',
        kind: 'BOUNCE',
        detail: 'Permanent / General',
        occurredAt: '2026-10-12',
      },
      { email: 'a@example.org', kind: 'COMPLAINT', detail: null, occurredAt: '2026-10-01' },
    ]);
    const body = (await (await send(admin, 'GET', '/accounts')).json()) as {
      email: string;
      emailIssue: { kind: string } | null;
    }[];
    expect(body.map((item) => [item.email, item.emailIssue?.kind ?? null])).toEqual([
      ['a@example.org', 'BOUNCE'],
      ['b@example.org', null],
    ]);
  });

  it('invites with a normalized email and reports an existing one on the field', async () => {
    cognito.inviteAccount.mockResolvedValueOnce('new');
    const created = await send(admin, 'POST', '/accounts', {
      email: ' Jean.Dupont@Example.org ',
      name: 'Jean Dupont',
      admin: false,
    });
    expect(created.status).toBe(201);
    expect(cognito.inviteAccount).toHaveBeenCalledWith({
      email: 'jean.dupont@example.org',
      name: 'Jean Dupont',
      admin: false,
    });

    cognito.inviteAccount.mockRejectedValueOnce(
      Object.assign(new Error('exists'), { name: 'UsernameExistsException' })
    );
    const duplicate = await send(admin, 'POST', '/accounts', {
      email: 'jean.dupont@example.org',
      name: 'Jean Dupont',
      admin: false,
    });
    expect(duplicate.status).toBe(409);
    expect(((await duplicate.json()) as ApiError).fields?.email).toBeDefined();
  });

  it('never disables or demotes the caller', async () => {
    expect((await send(admin, 'POST', '/accounts/me/disable')).status).toBe(409);
    expect((await send(admin, 'PUT', '/accounts/me', { name: 'Moi', admin: false })).status).toBe(
      409
    );
    expect(cognito.setAccountEnabled).not.toHaveBeenCalled();
    expect(cognito.updateAccount).not.toHaveBeenCalled();

    expect((await send(admin, 'POST', '/accounts/other/disable')).status).toBe(204);
    expect(cognito.setAccountEnabled).toHaveBeenCalledWith('other', false);
  });

  it('resends only an unused invitation', async () => {
    cognito.listAccounts.mockResolvedValue([
      { ...account('new', 'new@example.org'), status: 'FORCE_CHANGE_PASSWORD' },
      account('old', 'old@example.org'),
    ]);
    expect((await send(admin, 'POST', '/accounts/new/resend')).status).toBe(204);
    expect(cognito.resendInvitation).toHaveBeenCalledWith('new@example.org');
    expect((await send(admin, 'POST', '/accounts/old/resend')).status).toBe(409);
  });
});
