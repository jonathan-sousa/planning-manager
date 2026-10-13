import type { LambdaEvent } from '@hono/aws-lambda';
import { createMiddleware } from 'hono/factory';

export type Bindings = {
  event: LambdaEvent;
};

/** Every user of the app; admins are managers too. */
export const MANAGER_GROUP = 'MANAGERS';
/** Manage the accounts and the planning rules. */
export const ADMIN_GROUP = 'ADMINS';

/**
 * The HTTP API JWT authorizer serialises array claims as "[A B]" rather than
 * JSON, so `cognito:groups` may arrive as a string.
 */
function parseGroups(claim: unknown): string[] {
  if (Array.isArray(claim)) return claim.map(String);
  if (typeof claim === 'string') {
    return claim
      .replace(/^\[|\]$/g, '')
      .split(/[\s,]+/)
      .filter(Boolean);
  }
  return [];
}

function jwtClaims(event: LambdaEvent): Record<string, unknown> | undefined {
  const { requestContext } = event;
  if (!('authorizer' in requestContext) || !requestContext.authorizer) return undefined;
  const { authorizer } = requestContext;
  return 'jwt' in authorizer ? authorizer.jwt?.claims : undefined;
}

/** Cognito username of the caller (access token `username` claim). */
export function callerName(event: LambdaEvent): string {
  return String(jwtClaims(event)?.username ?? 'inconnu');
}

function callerGroups(event: LambdaEvent): string[] {
  return parseGroups(jwtClaims(event)?.['cognito:groups']);
}

const requireGroup = (group: string) =>
  createMiddleware<{ Bindings: Bindings }>(async (c, next) => {
    if (!callerGroups(c.env.event).includes(group)) {
      return c.json({ error: 'Forbidden' }, 403);
    }
    await next();
  });

/** Rejects callers that are not in the managers group. */
export const requireManager = requireGroup(MANAGER_GROUP);
/** Rejects callers that are not in the admins group. */
export const requireAdmin = requireGroup(ADMIN_GROUP);
