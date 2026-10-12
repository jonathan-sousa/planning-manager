import { type ReactNode, useEffect, useState } from 'react';
import { getCurrentUser, signInWithRedirect } from 'aws-amplify/auth';
import { Hub } from 'aws-amplify/utils';

type AuthState = 'checking' | 'signed-in' | 'failed';

/**
 * Sends anonymous visitors to Cognito Managed Login and renders children once
 * a session exists. The OAuth callback (`?code=…`) is handled by Amplify, which
 * then emits `signInWithRedirect` on the Hub.
 */
export function AuthGate({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>('checking');

  useEffect(() => {
    const unsubscribe = Hub.listen('auth', ({ payload }) => {
      if (payload.event === 'signInWithRedirect') setState('signed-in');
      if (payload.event === 'signInWithRedirect_failure') setState('failed');
    });

    const returningFromLogin = new URLSearchParams(window.location.search).has('code');
    getCurrentUser()
      .then(() => setState('signed-in'))
      .catch(() => {
        if (!returningFromLogin) void signInWithRedirect();
      });

    return unsubscribe;
  }, []);

  if (state === 'signed-in') return children;

  return (
    <main className="flex min-h-svh flex-col items-center justify-center gap-4 p-6 text-center">
      {state === 'checking' ? (
        <p className="text-muted-foreground text-sm">Connexion en cours…</p>
      ) : (
        <>
          <h1 className="text-xl font-semibold">Connexion impossible</h1>
          <button className="text-sm underline" onClick={() => signInWithRedirect()}>
            Réessayer
          </button>
        </>
      )}
    </main>
  );
}
