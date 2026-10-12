import { fetchAuthSession, signInWithRedirect } from 'aws-amplify/auth';
import { type ClientResponse, hc } from 'hono/client';
import type { AppType } from '../../api/app';
import type { ApiError } from '../../api/errors';

/**
 * Current Cognito access token. When the session is gone (refresh token
 * expired or revoked) the user is sent back to Managed Login.
 */
export async function requireAccessToken(): Promise<string> {
  const { tokens } = await fetchAuthSession();
  if (!tokens) {
    await signInWithRedirect();
    throw new Error('Session expirée');
  }
  return tokens.accessToken.toString();
}

/** Typed client for the HTTP API, authenticated with the Cognito access token. */
export const api = hc<AppType>(import.meta.env.VITE_API_URL, {
  headers: async () => ({ Authorization: `Bearer ${await requireAccessToken()}` }),
});

/** Non-2xx API response, with the per-field messages of a validation error. */
export class ApiRequestError extends Error {
  readonly status: number;
  readonly fields: Record<string, string[]>;

  constructor(status: number, body: Partial<ApiError> | undefined) {
    super(typeof body?.error === 'string' ? body.error : `Erreur ${status}`);
    this.status = status;
    this.fields = body?.fields ?? {};
  }
}

async function throwIfFailed(response: Response): Promise<void> {
  if (!response.ok) {
    const body = (await response.json().catch(() => undefined)) as Partial<ApiError> | undefined;
    throw new ApiRequestError(response.status, body);
  }
}

/** JSON body of the successful (2xx) variant of a Hono RPC response. */
type SuccessBody<R> =
  R extends ClientResponse<infer T, infer S, 'json'> ? (S extends 200 | 201 ? T : never) : never;

/** Unwraps a Hono RPC response, throwing an ApiRequestError on non-2xx status. */
export async function unwrap<R extends ClientResponse<unknown>>(
  response: R
): Promise<SuccessBody<R>> {
  await throwIfFailed(response);
  return response.json() as Promise<SuccessBody<R>>;
}

/** For responses without a body (204). */
export async function expectOk(response: ClientResponse<unknown>): Promise<void> {
  await throwIfFailed(response);
}
