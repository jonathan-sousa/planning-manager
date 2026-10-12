import { fetchAuthSession, signInWithRedirect } from 'aws-amplify/auth';
import { type ClientResponse, hc } from 'hono/client';
import type { AppType } from '../../api/app';

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

/** JSON body of the successful (2xx) variant of a Hono RPC response. */
type SuccessBody<R> =
  R extends ClientResponse<infer T, infer S, 'json'> ? (S extends 200 | 201 ? T : never) : never;

/** Unwraps a Hono RPC response, throwing on non-2xx status. */
export async function unwrap<R extends ClientResponse<unknown>>(
  response: R
): Promise<SuccessBody<R>> {
  if (!response.ok) {
    throw new Error(`${response.status} ${response.statusText}`);
  }
  return response.json() as Promise<SuccessBody<R>>;
}
