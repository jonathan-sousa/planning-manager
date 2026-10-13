import type { LambdaEvent } from '@hono/aws-lambda';
import { createMiddleware } from 'hono/factory';
import { HTTPException } from 'hono/http-exception';
import { ADMIN_GROUP, MANAGER_GROUP } from './domain';

export type Bindings = {
  event: LambdaEvent;
};

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
  const username = jwtClaims(event)?.username;
  if (typeof username !== 'string' || !username) throw new HTTPException(401);
  return username;
}

const requireGroup = (group: string) =>
  createMiddleware<{ Bindings: Bindings }>(async (c, next) => {
    const claims = jwtClaims(c.env.event);
    // The authorizer also accepts ID tokens (same audience): access tokens only.
    if (claims?.token_use !== 'access' || !parseGroups(claims['cognito:groups']).includes(group)) {
      return c.json({ error: 'Forbidden' }, 403);
    }
    await next();
  });

/** Rejects callers that are not in the managers group. */
export const requireManager = requireGroup(MANAGER_GROUP);
/** Rejects callers that are not in the admins group. */
export const requireAdmin = requireGroup(ADMIN_GROUP);
