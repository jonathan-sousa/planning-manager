import type { ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchAuthSession, signInWithRedirect, signOut } from 'aws-amplify/auth';

const MANAGER_GROUP = 'MANAGERS';

async function fetchGroups(): Promise<string[]> {
  const { tokens } = await fetchAuthSession();
  if (!tokens) {
    await signInWithRedirect();
    throw new Error('Session expirée');
  }
  const groups = tokens.accessToken.payload['cognito:groups'];
  return Array.isArray(groups) ? groups.map(String) : [];
}

/** Blocks signed-in users that are not managers. The API enforces the same rule. */
export function ManagerGate({ children }: { children: ReactNode }) {
  const { data: groups, isPending } = useQuery({
    queryKey: ['auth-groups'],
    queryFn: fetchGroups,
  });

  if (isPending) return null;

  if (!groups?.includes(MANAGER_GROUP)) {
    return (
      <main className="flex min-h-svh flex-col items-center justify-center gap-4 p-6 text-center">
        <h1 className="text-xl font-semibold">Accès refusé</h1>
        <p className="text-muted-foreground max-w-md text-sm">
          Votre compte n'appartient pas au groupe des managers. Contactez l'administrateur de
          l'application.
        </p>
        <button className="text-sm underline" onClick={() => signOut()}>
          Se déconnecter
        </button>
      </main>
    );
  }

  return children;
}
