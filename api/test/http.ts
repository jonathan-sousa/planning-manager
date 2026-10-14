// Calls the app as API Gateway would, with the claims of a Cognito access token.
import app from '../app';

export const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;

export const MANAGER = '[MANAGERS]';
export const ADMIN = '[MANAGERS ADMINS]';

export function caller(groups: string, username = uuid(999)) {
  return {
    event: {
      requestContext: {
        authorizer: {
          jwt: { claims: { 'cognito:groups': groups, token_use: 'access', username } },
        },
      },
    },
  };
}

/** A request as `as` (a manager by default); the body is sent as JSON. */
export function send(method: string, path: string, body?: unknown, as = caller(MANAGER)) {
  return app.request(
    path,
    {
      method,
      body: body === undefined ? undefined : JSON.stringify(body),
      headers: { 'Content-Type': 'application/json' },
    },
    as
  );
}
