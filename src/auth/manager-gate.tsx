import type { ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { signOut } from 'aws-amplify/auth';
import { groupsQuery, MANAGER_GROUP } from './groups';

/** Blocks signed-in users that are not managers. The API enforces the same rule. */
export function ManagerGate({ children }: { children: ReactNode }) {
  const { data: groups, isPending, error } = useQuery(groupsQuery);

  if (isPending) return null;

  // A failed session read is not a missing group: say so rather than deny.
  if (error) {
    return (
      <main className="flex min-h-svh flex-col items-center justify-center gap-4 p-6 text-center">
        <h1 className="text-xl font-semibold">Connexion impossible</h1>
        <p className="text-muted-foreground max-w-md text-sm">{error.message}</p>
        <button className="text-sm underline" onClick={() => window.location.reload()}>
          Réessayer
        </button>
      </main>
    );
  }

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
