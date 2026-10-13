import { desc, inArray } from 'drizzle-orm';
import { Hono } from 'hono';
import {
  inviteAccount,
  listAccounts,
  resendInvitation,
  setAccountEnabled,
  updateAccount,
} from '../accounts';
import { type Bindings, callerName, requireAdmin } from '../auth';
import { db } from '../db/client';
import { emailEvents } from '../db/schema';
import type { ApiError } from '../errors';
import { accountInput, accountUpdateInput, usernameParam } from '../schemas';
import { compareFr } from '../sort';
import { validate } from '../validate';

const errorName = (error: unknown) => (error instanceof Error ? error.name : '');

const notSelf = (action: string): ApiError => ({
  error: `Vous ne pouvez pas ${action} votre propre compte.`,
});

/** Accounts of the app, for admins only: invitations, admin role, access. */
export const accountRoutes = new Hono<{ Bindings: Bindings }>()
  .use('*', requireAdmin)

  /** Accounts with the last SES bounce or complaint on their email. */
  .get('/', async (c) => {
    const accounts = await listAccounts();
    const emails = accounts.map((account) => account.email);
    const events = emails.length
      ? await db
          .select()
          .from(emailEvents)
          .where(inArray(emailEvents.email, emails))
          .orderBy(desc(emailEvents.occurredAt))
      : [];
    const lastEvent = new Map<string, (typeof events)[number]>();
    for (const event of events) if (!lastEvent.has(event.email)) lastEvent.set(event.email, event);
    return c.json(
      accounts
        .map((account) => {
          const event = lastEvent.get(account.email);
          return {
            ...account,
            emailIssue: event
              ? { kind: event.kind, detail: event.detail, occurredAt: event.occurredAt }
              : null,
          };
        })
        .sort((a, b) => compareFr(a.name || a.email, b.name || b.email)),
      200
    );
  })

  .post('/', validate('json', accountInput), async (c) => {
    try {
      const username = await inviteAccount(c.req.valid('json'));
      return c.json({ username }, 201);
    } catch (error) {
      if (errorName(error) === 'UsernameExistsException') {
        const message = 'Un compte existe déjà avec cet email';
        return c.json({ error: message, fields: { email: [message] } } satisfies ApiError, 409);
      }
      throw error;
    }
  })

  .put(
    '/:username',
    validate('param', usernameParam),
    validate('json', accountUpdateInput),
    async (c) => {
      const { username } = c.req.valid('param');
      const input = c.req.valid('json');
      if (!input.admin && username === callerName(c.env.event)) {
        return c.json(notSelf('retirer le rôle admin de'), 409);
      }
      await updateAccount(username, input);
      return c.body(null, 204);
    }
  )

  .post('/:username/resend', validate('param', usernameParam), async (c) => {
    const account = (await listAccounts()).find(
      (item) => item.username === c.req.valid('param').username
    );
    if (!account) return c.json({ error: 'Introuvable' } satisfies ApiError, 404);
    if (account.status !== 'FORCE_CHANGE_PASSWORD') {
      return c.json({ error: 'Invitation déjà utilisée' } satisfies ApiError, 409);
    }
    await resendInvitation(account.email);
    return c.body(null, 204);
  })

  .post('/:username/disable', validate('param', usernameParam), async (c) => {
    const { username } = c.req.valid('param');
    if (username === callerName(c.env.event)) return c.json(notSelf('désactiver'), 409);
    await setAccountEnabled(username, false);
    return c.body(null, 204);
  })

  .post('/:username/enable', validate('param', usernameParam), async (c) => {
    await setAccountEnabled(c.req.valid('param').username, true);
    return c.body(null, 204);
  });
