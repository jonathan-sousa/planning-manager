import { Hono } from 'hono';
import { describe, expect, it } from 'vitest';
import { type Bindings, callerName, requireAdmin, requireManager } from './auth';

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
});
