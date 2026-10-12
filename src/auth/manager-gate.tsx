import type { ReactNode } from 'react';
import { useAuthenticator } from '@aws-amplify/ui-react';
import { useQuery } from '@tanstack/react-query';
import { fetchAuthSession } from 'aws-amplify/auth';

const MANAGER_GROUP = 'MANAGERS';

async function fetchGroups(): Promise<string[]> {
  const { tokens } = await fetchAuthSession();
  const groups = tokens?.accessToken.payload['cognito:groups'];
  return Array.isArray(groups) ? groups.map(String) : [];
}

export function ManagerGate({ children }: { children: ReactNode }) {
  const { user, signOut } = useAuthenticator((context) => [context.user]);
  const { data: groups, isPending } = useQuery({
    queryKey: ['auth-groups', user.userId],
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
        <button className="text-sm underline" onClick={signOut}>
          Se déconnecter
        </button>
      </main>
    );
  }

  return children;
}
