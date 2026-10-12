import { fetchAuthSession } from 'aws-amplify/auth';
import { type ClientResponse, hc } from 'hono/client';
import type { AppType } from '../../api/app';

/** Typed client for the HTTP API, authenticated with the Cognito access token. */
export const api = hc<AppType>(import.meta.env.VITE_API_URL, {
  headers: async () => {
    const { tokens } = await fetchAuthSession();
    return { Authorization: `Bearer ${tokens?.accessToken.toString() ?? ''}` };
  },
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
