import { Hono } from 'hono';
import { describe, expect, it, vi } from 'vitest';
import { pool } from '../test/cognito';
import { ADMIN, caller, uuid } from '../test/http';
import {
  type Bindings,
  callerName,
  requireActiveAdmin,
  requireAdmin,
  requireManager,
} from './auth';

vi.mock('@aws-sdk/client-cognito-identity-provider', async (original) => ({
  ...(await original<object>()),
  CognitoIdentityProviderClient: (await import('../test/cognito')).FakeCognitoClient,
}));

const app = new Hono<{ Bindings: Bindings }>()
  .get('/manager', requireManager, (c) => c.text(callerName(c.env.event)))
  .get('/admin', requireAdmin, (c) => c.text('ok'));

const as = (claims: Record<string, unknown> | undefined) => ({
  event: { requestContext: claims ? { authorizer: { jwt: { claims } } } : {} },
});
const status = async (path: string, claims?: Record<string, unknown>) =>
  (await app.request(path, {}, as(claims))).status;
const access = (groups: unknown, username = 'u-1') => ({
  'cognito:groups': groups,
  token_use: 'access',
  username,
});

describe('auth', () => {
  it('reads the groups claim as the authorizer sends it, or as an array', async () => {
    expect(await status('/manager', access('[MANAGERS ADMINS]'))).toBe(200);
    expect(await status('/manager', access('[ADMINS, MANAGERS]'))).toBe(200);
    expect(await status('/manager', access(['MANAGERS']))).toBe(200);
  });

  it('refuses another group, an ID token, or a request without authorizer', async () => {
    expect(await status('/manager', access('[OTHERS]'))).toBe(403);
    expect(await status('/manager', { ...access('[MANAGERS]'), token_use: 'id' })).toBe(403);
    expect(await status('/manager')).toBe(403);
  });

  it('keeps the admin routes for the admins group', async () => {
    expect(await status('/admin', access('[MANAGERS]'))).toBe(403);
    expect(await status('/admin', access('[MANAGERS ADMINS]'))).toBe(200);
  });

  it('names the caller by their Cognito username, 401 without one', async () => {
    const response = await app.request('/manager', {}, as(access('[MANAGERS]', 'u-42')));
    expect(await response.text()).toBe('u-42');
    expect(await status('/manager', access('[MANAGERS]', ''))).toBe(401);
  });

  it('lets an admin through only while Cognito still has them enabled and admin', async () => {
    pool.reset();
    pool.add({ username: uuid(1), email: 'admin@example.org' }, ['MANAGERS', 'ADMINS']);
    const live = new Hono<{ Bindings: Bindings }>().get('/', requireActiveAdmin, (c) =>
      c.text('ok')
    );
    const status = async () => (await live.request('/', {}, caller(ADMIN, uuid(1)))).status;
    expect(await status()).toBe(200);
    pool.get(uuid(1))!.groups.delete('ADMINS');
    expect(await status()).toBe(403);
    pool.get(uuid(1))!.groups.add('ADMINS');
    pool.get(uuid(1))!.enabled = false;
    expect(await status()).toBe(403);
  });
});
