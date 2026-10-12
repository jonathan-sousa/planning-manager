import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createRouter, RouterProvider } from '@tanstack/react-router';
import { Amplify } from 'aws-amplify';
import { AuthGate } from './auth/auth-gate';
import { ManagerGate } from './auth/manager-gate';
import { routeTree } from './routeTree.gen';
import './index.css';

const appUrl = `${window.location.origin}/`;

Amplify.configure({
  Auth: {
    Cognito: {
      userPoolId: import.meta.env.VITE_USER_POOL_ID,
      userPoolClientId: import.meta.env.VITE_USER_POOL_CLIENT_ID,
      loginWith: {
        oauth: {
          domain: import.meta.env.VITE_AUTH_DOMAIN,
          scopes: ['openid', 'email', 'profile'],
          redirectSignIn: [appUrl],
          redirectSignOut: [appUrl],
          responseType: 'code',
        },
      },
    },
  },
});

const queryClient = new QueryClient();

const router = createRouter({
  routeTree,
  context: { queryClient },
  defaultPreload: 'intent',
  // React Query owns caching: loaders always run on preload/visit.
  defaultPreloadStaleTime: 0,
  scrollRestoration: true,
});

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <AuthGate>
        <ManagerGate>
          <RouterProvider router={router} />
        </ManagerGate>
      </AuthGate>
    </QueryClientProvider>
  </StrictMode>
);
