import { queryOptions, useQuery } from '@tanstack/react-query';
import { fetchAuthSession, signInWithRedirect } from 'aws-amplify/auth';

export const MANAGER_GROUP = 'MANAGERS';
export const ADMIN_GROUP = 'ADMINS';

/** Groups of the signed-in user, from the access token (the API checks the same claim). */
export const groupsQuery = queryOptions({
  queryKey: ['auth-groups'],
  queryFn: async (): Promise<string[]> => {
    const { tokens } = await fetchAuthSession();
    if (!tokens) {
      await signInWithRedirect();
      throw new Error('Session expirée');
    }
    const groups = tokens.accessToken.payload['cognito:groups'];
    return Array.isArray(groups) ? groups.map(String) : [];
  },
});

/** Admins manage the accounts and the planning rules. */
export function useIsAdmin(): boolean {
  return useQuery(groupsQuery).data?.includes(ADMIN_GROUP) ?? false;
}
