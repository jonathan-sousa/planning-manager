import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  inviteAccount,
  listAccounts,
  liveState,
  resendInvitation,
  resetMfa,
  setAccountEnabled,
  updateAccount,
} from './accounts';
import { pool } from '../test/cognito';
import { uuid } from '../test/http';

vi.mock('@aws-sdk/client-cognito-identity-provider', async (original) => ({
  ...(await original<object>()),
  CognitoIdentityProviderClient: (await import('../test/cognito')).FakeCognitoClient,
}));

const commands = () => pool.calls.map(([name]) => name);

beforeEach(() => {
  pool.reset();
  pool.add({ username: uuid(1), email: 'admin@example.org', name: 'Admin' }, [
    'MANAGERS',
    'ADMINS',
  ]);
  pool.add({ username: uuid(2), email: 'cadre@example.org', name: 'Cadre' }, ['MANAGERS']);
});

describe('accounts', () => {
  it('lists the members of the managers group, across pages, with their admin flag', async () => {
    pool.add({ username: uuid(3), email: 'hors@example.org' });
    pool.add({ username: uuid(4), email: 'autre@example.org', enabled: false }, ['MANAGERS']);
    const accounts = await listAccounts();
    expect(accounts.map((account) => [account.email, account.admin, account.enabled])).toEqual([
      ['admin@example.org', true, true],
      ['cadre@example.org', false, true],
      ['autre@example.org', false, false],
    ]);
    expect(accounts[0]).toMatchObject({ username: uuid(1), name: 'Admin', status: 'CONFIRMED' });
    // Two users a page: the users and both groups are read to the end.
    expect(commands().filter((name) => name === 'ListUsersCommand')).toHaveLength(2);
  });

  it('invites a new account into the managers group, admin on request', async () => {
    const outcome = await inviteAccount({ email: 'new@example.org', name: 'Nouveau', admin: true });
    expect(outcome).toMatchObject({ created: true });
    const { username } = outcome as { username: string };
    expect(pool.get(username)).toMatchObject({
      email: 'new@example.org',
      name: 'Nouveau',
      status: 'FORCE_CHANGE_PASSWORD',
      groups: new Set(['MANAGERS', 'ADMINS']),
    });
  });

  it('gives an existing user outside the app its groups, and reports an existing manager', async () => {
    pool.add({ username: uuid(5), email: 'half@example.org' });
    expect(await inviteAccount({ email: 'half@example.org', name: 'X', admin: false })).toEqual({
      username: uuid(5),
      created: false,
    });
    expect(pool.get(uuid(5))!.groups).toEqual(new Set(['MANAGERS']));
    expect(await inviteAccount({ email: 'cadre@example.org', name: 'X', admin: false })).toBe(
      'exists'
    );
  });

  it('renames and grants or removes the admin role', async () => {
    await updateAccount(uuid(2), { name: 'Cadre de santé', admin: true });
    expect(pool.get(uuid(2))).toMatchObject({
      name: 'Cadre de santé',
      groups: new Set(['MANAGERS', 'ADMINS']),
    });
    await updateAccount(uuid(2), { name: 'Cadre de santé', admin: false });
    expect(pool.get(uuid(2))!.groups).toEqual(new Set(['MANAGERS']));
  });

  it('disables with a sign-out, enables again', async () => {
    await setAccountEnabled(uuid(2), false);
    expect(pool.get(uuid(2))!.enabled).toBe(false);
    expect(commands()).toEqual(['AdminDisableUserCommand', 'AdminUserGlobalSignOutCommand']);
    await setAccountEnabled(uuid(2), true);
    expect(pool.get(uuid(2))!.enabled).toBe(true);
  });

  it('forgets the authenticator app and signs the user out', async () => {
    await resetMfa(uuid(2));
    expect(pool.get(uuid(2))!.mfa).toBe(false);
    expect(commands()).toEqual([
      'AdminSetUserMFAPreferenceCommand',
      'AdminUserGlobalSignOutCommand',
    ]);
  });

  it('resends the invitation to the email', async () => {
    await resendInvitation('cadre@example.org');
    expect(pool.calls).toEqual([
      [
        'AdminCreateUserCommand',
        expect.objectContaining({ Username: 'cadre@example.org', MessageAction: 'RESEND' }),
      ],
    ]);
  });

  it('reads the groups and the enabled flag live, by username or email', async () => {
    expect(await liveState(uuid(1))).toEqual({
      username: uuid(1),
      enabled: true,
      manager: true,
      admin: true,
    });
    pool.get(uuid(2))!.enabled = false;
    expect(await liveState('cadre@example.org')).toMatchObject({
      username: uuid(2),
      enabled: false,
      admin: false,
    });
  });
});
