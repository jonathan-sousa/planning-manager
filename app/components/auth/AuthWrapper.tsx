'use client';

import { Authenticator } from '@aws-amplify/ui-react';
import '@aws-amplify/ui-react/styles.css';

interface AuthWrapperProps {
  children: React.ReactNode;
}

export function AuthWrapper({ children }: AuthWrapperProps) {

  const components = {
    Header() {
      return (
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Planning Manager</h1>
          <p className="text-gray-600 mt-2">Connectez-vous pour accéder à votre espace</p>
        </div>
      );
    },
  };

  const formFields = {
    signIn: {
      username: {
        label: 'Email',
        placeholder: 'Entrez votre email',
      },
      password: {
        label: 'Mot de passe',
        placeholder: 'Entrez votre mot de passe',
      },
    },
    forgotPassword: {
      username: {
        label: 'Email',
        placeholder: 'Entrez votre email',
      },
    },
    confirmResetPassword: {
      confirmation_code: {
        label: 'Code de confirmation',
        placeholder: 'Entrez le code reçu par email',
      },
      password: {
        label: 'Nouveau mot de passe',
        placeholder: 'Entrez votre nouveau mot de passe',
      },
    },
  };

  return (
    <Authenticator
      hideSignUp={true}
      components={components}
      formFields={formFields}
      className="min-h-screen flex items-center justify-center bg-gray-50"
    >
      {({ signOut, user }) => (
        <div className="min-h-screen bg-gray-50">
          <nav className="bg-white shadow-sm border-b">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <div className="flex justify-between h-16">
                <div className="flex items-center">
                  <h1 className="text-xl font-semibold">Planning Manager</h1>
                </div>
                <div className="flex items-center space-x-4">
                  <span className="text-sm text-gray-700">
                    {user?.signInDetails?.loginId}
                  </span>
                  <button
                    onClick={signOut}
                    className="text-sm bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700"
                  >
                    Déconnexion
                  </button>
                </div>
              </div>
            </div>
          </nav>
          <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
            {children}
          </main>
        </div>
      )}
    </Authenticator>
  );
}