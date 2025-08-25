"use client";

import { Amplify } from "aws-amplify";
import { ReactNode, useEffect } from "react";

// Configuration Amplify côté client
let isConfigured = false;

interface AmplifyProviderProps {
  children: ReactNode;
}

export default function AmplifyProvider({ children }: AmplifyProviderProps) {
  useEffect(() => {
    const configureAmplify = async () => {
      if (!isConfigured) {
        try {
          const outputs = await import("../../../amplify_outputs.json");
          Amplify.configure(outputs.default);
          isConfigured = true;
          console.log("✅ Amplify configuré avec succès");
        } catch {
          console.warn("⚠️ Amplify configuration not found, running in dev mode without backend");
        }
      }
    };
    
    configureAmplify();
  }, []);

  // Backend minimal sans authentification UI pour le moment
  return <>{children}</>;
}
