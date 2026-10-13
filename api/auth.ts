import type { LambdaEvent } from '@hono/aws-lambda';
import { createMiddleware } from 'hono/factory';

export type Bindings = {
  event: LambdaEvent;
};

const MANAGER_GROUP = 'MANAGERS';

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

/** Rejects callers that are not in the managers group. */
export const requireManager = createMiddleware<{ Bindings: Bindings }>(async (c, next) => {
  const claims = jwtClaims(c.env.event);
  if (!claims || !parseGroups(claims['cognito:groups']).includes(MANAGER_GROUP)) {
    return c.json({ error: 'Forbidden' }, 403);
  }
  await next();
});
