import { queryOptions, useQuery } from '@tanstack/react-query';
import { fetchAuthSession, signInWithRedirect } from 'aws-amplify/auth';
import { ADMIN_GROUP } from '../../api/domain';

export interface Session {
  /** Cognito username (a UUID). */
  username: string;
  email: string;
  /** Groups of the access token, the claim the API checks. */
  groups: string[];
}

/** The signed-in user, from the Cognito tokens; signs in again when the session is gone. */
export const sessionQuery = queryOptions({
  queryKey: ['session'],
  queryFn: async (): Promise<Session> => {
    const { tokens } = await fetchAuthSession();
    if (!tokens) {
      await signInWithRedirect();
      throw new Error('Session expirée');
    }
    const groups = tokens.accessToken.payload['cognito:groups'];
    return {
      username: String(tokens.accessToken.payload.username ?? ''),
      email: String(tokens.idToken?.payload.email ?? ''),
      groups: Array.isArray(groups) ? groups.map(String) : [],
    };
  },
});

export function useSession(): Session | undefined {
  return useQuery(sessionQuery).data;
}

/** Admins manage the accounts and the planning rules. */
export function useIsAdmin(): boolean {
  return useSession()?.groups.includes(ADMIN_GROUP) ?? false;
}
