import { beforeEach, describe, expect, it, vi } from 'vitest';
import { emailEvents } from '../../db/schema';
import type { ApiError } from '../lib/errors';
import { pool } from '../test/cognito';
import { db, resetDb } from '../test/db';
import { ADMIN, caller, MANAGER, send, uuid } from '../test/http';

vi.mock('../../db/client', () => import('../test/db'));
vi.mock('@aws-sdk/client-cognito-identity-provider', async (original) => ({
  ...(await original<object>()),
  CognitoIdentityProviderClient: (await import('../test/cognito')).FakeCognitoClient,
}));

const ME = uuid(1);
const OTHER = uuid(2);
const admin = caller(ADMIN, ME);
const manager = caller(MANAGER, ME);
const asAdmin = (method: string, path: string, body?: unknown) => send(method, path, body, admin);

beforeEach(async () => {
  await resetDb();
  pool.reset();
  pool.add({ username: ME, email: 'me@example.org', name: 'Moi' }, ['MANAGERS', 'ADMINS']);
  pool.add({ username: OTHER, email: 'other@example.org', name: 'Autre' }, ['MANAGERS']);
});

const commands = () => pool.calls.map(([name]) => name);

describe('accounts', () => {
  it('is for admins only, like changing the rules', async () => {
    expect((await send('GET', '/accounts', undefined, manager)).status).toBe(403);
    expect((await send('PUT', '/rule-settings', {}, manager)).status).toBe(403);
    expect(pool.calls).toEqual([]);
  });

  it('refuses an admin demoted or disabled since their token was issued', async () => {
    pool.get(ME)!.groups.delete('ADMINS');
    expect((await asAdmin('POST', `/accounts/${OTHER}/disable`)).status).toBe(403);

    pool.get(ME)!.groups.add('ADMINS');
    pool.get(ME)!.enabled = false;
    expect((await asAdmin('PUT', '/rule-settings', {})).status).toBe(403);
    expect(pool.get(OTHER)!.enabled).toBe(true);
  });

  it('lists the managers with their admin flag, across pages, sorted by name', async () => {
    pool.add({ username: uuid(3), email: 'zoe@example.org', name: 'Zoé' }, ['MANAGERS']);
    pool.add({ username: uuid(4), email: 'out@example.org', name: 'Hors groupe' });
    pool.add({ username: uuid(5), email: 'eve@example.org', name: 'Ève' }, ['MANAGERS']);
    const body = (await (await asAdmin('GET', '/accounts')).json()) as {
      name: string;
      admin: boolean;
    }[];
    expect(body.map((item) => [item.name, item.admin])).toEqual([
      ['Autre', false],
      ['Ève', false],
      ['Moi', true],
      ['Zoé', false],
    ]);
  });

  it('flags an email whose last SES event is a bounce or a complaint', async () => {
    pool.get(OTHER)!.email = 'Other@Example.org';
    await db.insert(emailEvents).values([
      { email: 'me@example.org', kind: 'DELIVERY', occurredAt: '2026-10-12T00:00:00Z' },
      {
        email: 'other@example.org',
        kind: 'BOUNCE',
        detail: 'Permanent / General',
        occurredAt: '2026-10-11T00:00:00Z',
      },
      {
        email: 'me@example.org',
        kind: 'BOUNCE',
        detail: 'Transient / MailboxFull',
        occurredAt: '2026-10-10T00:00:00Z',
      },
    ]);
    const body = (await (await asAdmin('GET', '/accounts')).json()) as {
      email: string;
      emailIssue: { kind: string; detail: string } | null;
    }[];
    expect(body.map((item) => [item.email, item.emailIssue])).toEqual([
      [
        'Other@Example.org',
        expect.objectContaining({ kind: 'BOUNCE', detail: 'Permanent / General' }),
      ],
      ['me@example.org', null],
    ]);
  });

  it('invites with a normalized email, in the managers group, admin on request', async () => {
    const invite = { email: ' Jean.Dupont@Example.org ', name: 'Jean Dupont', admin: true };
    const response = await asAdmin('POST', '/accounts', invite);
    expect(response.status).toBe(201);
    const { username } = (await response.json()) as { username: string };
    expect(pool.get(username)).toMatchObject({
      email: 'jean.dupont@example.org',
      name: 'Jean Dupont',
      status: 'FORCE_CHANGE_PASSWORD',
      groups: new Set(['MANAGERS', 'ADMINS']),
    });
  });

  it('completes an invitation that stopped before the groups; refuses an existing manager', async () => {
    pool.add({ username: uuid(6), email: 'half@example.org' });
    const resumed = await asAdmin('POST', '/accounts', {
      email: 'half@example.org',
      name: 'Moitié',
      admin: false,
    });
    expect(resumed.status).toBe(200);
    expect(pool.get(uuid(6))!.groups).toEqual(new Set(['MANAGERS']));

    const duplicate = await asAdmin('POST', '/accounts', {
      email: 'other@example.org',
      name: 'Autre',
      admin: false,
    });
    expect(duplicate.status).toBe(409);
    expect(((await duplicate.json()) as ApiError).fields?.email).toBeDefined();
  });

  it('only takes Cognito usernames, never the email alias', async () => {
    expect((await asAdmin('POST', '/accounts/other@example.org/disable')).status).toBe(400);
    expect(pool.get(OTHER)!.enabled).toBe(true);
  });

  it('renames and changes the admin role', async () => {
    const response = await asAdmin('PUT', `/accounts/${OTHER}`, { name: 'Autre nom', admin: true });
    expect(response.status).toBe(204);
    expect(pool.get(OTHER)).toMatchObject({
      name: 'Autre nom',
      groups: new Set(['MANAGERS', 'ADMINS']),
    });
  });

  it('never disables or demotes the caller', async () => {
    expect((await asAdmin('POST', `/accounts/${ME}/disable`)).status).toBe(409);
    expect((await asAdmin('PUT', `/accounts/${ME}`, { name: 'Moi', admin: false })).status).toBe(
      409
    );
    expect(pool.get(ME)).toMatchObject({ enabled: true, groups: new Set(['MANAGERS', 'ADMINS']) });
  });

  it('keeps an enabled admin among the managers', async () => {
    // The caller is an admin outside the managers group: OTHER is the last one listed.
    pool.get(ME)!.groups.delete('MANAGERS');
    pool.get(OTHER)!.groups.add('ADMINS');
    expect((await asAdmin('POST', `/accounts/${OTHER}/disable`)).status).toBe(409);
    expect(
      (await asAdmin('PUT', `/accounts/${OTHER}`, { name: 'Autre', admin: false })).status
    ).toBe(409);
    expect(pool.get(OTHER)).toMatchObject({
      enabled: true,
      groups: new Set(['MANAGERS', 'ADMINS']),
    });

    pool.get(ME)!.groups.add('MANAGERS');
    expect((await asAdmin('POST', `/accounts/${OTHER}/disable`)).status).toBe(204);
    expect(pool.get(OTHER)!.enabled).toBe(false);
  });

  it('resets the MFA of another account only, and signs it out', async () => {
    expect((await asAdmin('POST', `/accounts/${ME}/reset-mfa`)).status).toBe(409);
    expect((await asAdmin('POST', `/accounts/${OTHER}/reset-mfa`)).status).toBe(204);
    expect(pool.get(OTHER)!.mfa).toBe(false);
    expect(commands()).toContain('AdminUserGlobalSignOutCommand');
  });

  it('resends only a pending invitation of an enabled account', async () => {
    pool.add({ username: uuid(6), email: 'new@example.org', status: 'FORCE_CHANGE_PASSWORD' }, [
      'MANAGERS',
    ]);
    pool.add(
      {
        username: uuid(8),
        email: 'off@example.org',
        status: 'FORCE_CHANGE_PASSWORD',
        enabled: false,
      },
      ['MANAGERS']
    );
    expect((await asAdmin('POST', `/accounts/${uuid(6)}/resend`)).status).toBe(204);
    expect(pool.calls.at(-1)).toEqual([
      'AdminCreateUserCommand',
      expect.objectContaining({ Username: 'new@example.org', MessageAction: 'RESEND' }),
    ]);
    expect((await asAdmin('POST', `/accounts/${OTHER}/resend`)).status).toBe(409);
    expect((await asAdmin('POST', `/accounts/${uuid(8)}/resend`)).status).toBe(409);
    expect((await asAdmin('POST', `/accounts/${uuid(9)}/resend`)).status).toBe(404);
  });

  it('disables with a sign-out, and enables again', async () => {
    pool.get(OTHER)!.groups.add('ADMINS');
    expect((await asAdmin('POST', `/accounts/${OTHER}/disable`)).status).toBe(204);
    expect(pool.get(OTHER)!.enabled).toBe(false);
    expect(commands().slice(-2)).toEqual([
      'AdminDisableUserCommand',
      'AdminUserGlobalSignOutCommand',
    ]);
    expect((await asAdmin('POST', `/accounts/${OTHER}/enable`)).status).toBe(204);
    expect(pool.get(OTHER)!.enabled).toBe(true);
  });

  it('answers 404 for an unknown account', async () => {
    expect((await asAdmin('POST', `/accounts/${uuid(9)}/enable`)).status).toBe(404);
  });
});
