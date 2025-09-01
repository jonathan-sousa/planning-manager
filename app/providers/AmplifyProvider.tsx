'use client';

import { Authenticator } from '@aws-amplify/ui-react';
import '@aws-amplify/ui-react/styles.css';
import ConfigureAmplifyClientSide from '../components/ConfigureAmplify';

interface AmplifyProviderProps {
  children: React.ReactNode;
}

export function AmplifyProvider({ children }: AmplifyProviderProps) {
  return (
    <>
      <ConfigureAmplifyClientSide />
      <Authenticator.Provider>
        {children}
      </Authenticator.Provider>
    </>
  );
}