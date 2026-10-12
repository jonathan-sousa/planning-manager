import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { Authenticator, translations } from '@aws-amplify/ui-react';
import '@aws-amplify/ui-react/styles.css';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createRouter, RouterProvider } from '@tanstack/react-router';
import { Amplify } from 'aws-amplify';
import { I18n } from 'aws-amplify/utils';
import { ManagerGate } from './auth/manager-gate';
import { routeTree } from './routeTree.gen';
import './index.css';

Amplify.configure({
  Auth: {
    Cognito: {
      userPoolId: import.meta.env.VITE_USER_POOL_ID,
      userPoolClientId: import.meta.env.VITE_USER_POOL_CLIENT_ID,
    },
  },
});
I18n.putVocabularies(translations);
I18n.setLanguage('fr');

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
      <Authenticator hideSignUp>
        <ManagerGate>
          <RouterProvider router={router} />
        </ManagerGate>
      </Authenticator>
    </QueryClientProvider>
  </StrictMode>
);
