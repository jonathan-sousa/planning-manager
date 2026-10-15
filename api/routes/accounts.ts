import { desc, inArray } from 'drizzle-orm';
import { Hono } from 'hono';
import {
  type Account,
  inviteAccount,
  listAccounts,
  resendInvitation,
  resetMfa,
  setAccountEnabled,
  updateAccount,
} from '../services/accounts';
import { type Bindings, callerName, requireActiveAdmin, requireAdmin } from '../middleware/auth';
import { db } from '../../db/client';
import { emailEvents } from '../../db/schema';
import { type ApiError, notFound } from '../lib/errors';
import { accountInput, accountUpdateInput, usernameParam } from '../../shared/schemas';
import { compareFr } from '../lib/sort';
import { validate } from '../middleware/validate';

const refused = (error: string): ApiError => ({ error });

/** True when the change would leave no enabled admin. */
const lastAdmin = (accounts: Account[], username: string) =>
  !accounts.some((account) => account.admin && account.enabled && account.username !== username);

/** Accounts of the app, for admins only: invitations, admin role, access. */
export const accountRoutes = new Hono<{ Bindings: Bindings }>()
  .use('*', requireAdmin, requireActiveAdmin)

  /** Accounts, with their email flagged when its last SES event is a bounce or a complaint. */
  .get('/', async (c) => {
    const accounts = await listAccounts();
    const emails = accounts.map((account) => account.email.toLowerCase());
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
          const event = lastEvent.get(account.email.toLowerCase());
          return {
            ...account,
            emailIssue:
              event && event.kind !== 'DELIVERY'
                ? { kind: event.kind, detail: event.detail, occurredAt: event.occurredAt }
                : null,
          };
        })
        .sort((a, b) => compareFr(a.name || a.email, b.name || b.email)),
      200
    );
  })

  .post('/', validate('json', accountInput), async (c) => {
    const outcome = await inviteAccount(c.req.valid('json'));
    if (outcome === 'exists') {
      const message = 'Un compte existe déjà avec cet email';
      return c.json({ error: message, fields: { email: [message] } } satisfies ApiError, 409);
    }
    return c.json(outcome, outcome.created ? 201 : 200);
  })

  .put(
    '/:username',
    validate('param', usernameParam),
    validate('json', accountUpdateInput),
    async (c) => {
      const { username } = c.req.valid('param');
      const input = c.req.valid('json');
      if (!input.admin) {
        if (username === callerName(c.env.event)) {
          return c.json(refused('Vous ne pouvez pas retirer votre propre rôle admin.'), 409);
        }
        if (lastAdmin(await listAccounts(), username)) {
          return c.json(refused('Il faut au moins un admin actif.'), 409);
        }
      }
      await updateAccount(username, input);
      return c.body(null, 204);
    }
  )

  .post('/:username/resend', validate('param', usernameParam), async (c) => {
    const account = (await listAccounts()).find(
      (item) => item.username === c.req.valid('param').username
    );
    if (!account) return c.json(notFound, 404);
    if (!account.enabled || account.status !== 'FORCE_CHANGE_PASSWORD') {
      return c.json(refused('Aucune invitation en attente pour ce compte'), 409);
    }
    await resendInvitation(account.email);
    return c.body(null, 204);
  })

  /** A lost phone: the account enrolls a new authenticator app at its next sign-in. */
  .post('/:username/reset-mfa', validate('param', usernameParam), async (c) => {
    const { username } = c.req.valid('param');
    if (username === callerName(c.env.event)) {
      return c.json(refused('Vous ne pouvez pas réinitialiser votre propre MFA.'), 409);
    }
    await resetMfa(username);
    return c.body(null, 204);
  })

  .post('/:username/disable', validate('param', usernameParam), async (c) => {
    const { username } = c.req.valid('param');
    if (username === callerName(c.env.event)) {
      return c.json(refused('Vous ne pouvez pas désactiver votre propre compte.'), 409);
    }
    if (lastAdmin(await listAccounts(), username)) {
      return c.json(refused('Il faut au moins un admin actif.'), 409);
    }
    await setAccountEnabled(username, false);
    return c.body(null, 204);
  })

  .post('/:username/enable', validate('param', usernameParam), async (c) => {
    await setAccountEnabled(c.req.valid('param').username, true);
    return c.body(null, 204);
  });
