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
        <>
          {children}
        </>
      )}
    </Authenticator>
  );
}